-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store match requests
create table if not exists match_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  topic_embedding vector(768),
  status text not null default 'waiting' check (status in ('waiting', 'matched')),
  mode text not null default 'chat',
  room_id text, -- ID of the room to join when matched
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure columns exist (idempotent for existing tables)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'match_queue' and column_name = 'room_id') then
    alter table match_queue add column room_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'match_queue' and column_name = 'mode') then
    alter table match_queue add column mode text not null default 'chat';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'match_queue' and column_name = 'topic_embedding') then
    alter table match_queue add column topic_embedding vector(768);
  end if;
end $$;

-- Index for faster vector search
create index if not exists match_queue_topic_embedding_idx on match_queue using ivfflat (topic_embedding vector_cosine_ops)
with (lists = 100);

-- Enable RLS
alter table match_queue enable row level security;

-- Policy: Users can insert their own requests
drop policy if exists "Users can insert their own match requests" on match_queue;
create policy "Users can insert their own match requests"
  on match_queue for insert
  with check (auth.uid() = user_id);

-- Policy: Users can view their own requests
drop policy if exists "Users can view their own match requests" on match_queue;
create policy "Users can view their own match requests"
  on match_queue for select
  using (auth.uid() = user_id);

-- Policy: Users can update their own requests
drop policy if exists "Users can update their own match requests" on match_queue;
create policy "Users can update their own match requests"
  on match_queue for update
  using (auth.uid() = user_id);

-- CRITICAL: Add to publication for Realtime
-- This checks if the 'supabase_realtime' publication exists and then adds the table.
-- If publication doesn't exist (local dev sometimes), we ignore or create it.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime for table match_queue;
  else
    alter publication supabase_realtime add table match_queue;
  end if;
exception
  when duplicate_object then
    null; -- Table already added
end $$;

-- Cleanup old function signatures if they exist to prevent overloading confusion
drop function if exists find_match(uuid, vector(768), text, float);
drop function if exists find_match(uuid, vector(768), text, uuid[], float);


-- Function to find a match
create or replace function find_match(
  p_user_id uuid,
  p_topic_embedding vector(768),
  p_mode text,
  p_excluded_user_ids uuid[] default '{}',
  p_threshold float default 0.7 
)
returns table (
  match_found boolean,
  match_room_id text,
  peer_user_id uuid
) 
language plpgsql
security definer
as $$
declare
  v_match record;
  v_room_id text;
begin
  -- Lazy Cleanup: Remove any request that hasn't heartbeated in 2 minutes
  delete from match_queue
  where updated_at < now() - interval '2 minutes';

  -- 1. Lock the Caller's row to ensure they are still waiting
  -- If we can't lock it (someone else matched us?), simply return nothing.
  perform 1 from match_queue 
  where user_id = p_user_id and status = 'waiting' 
  for update nowait;
  
  -- If performs fails (row locked or not found), we might want to exit? 
  -- Actually, let's just proceed. The final update will fail if conditions met.

  -- 2. Find the best match
  select 
    id, 
    user_id
  into v_match
  from match_queue
  where status = 'waiting'
    and mode = p_mode
    and user_id != p_user_id
    and not (user_id = any(p_excluded_user_ids))
    and 1 - (topic_embedding <=> p_topic_embedding) > p_threshold
  order by topic_embedding <=> p_topic_embedding asc
  limit 1
  for update skip locked;

  if v_match.id is not null then
    -- Generate simple room ID
    v_room_id := 'room_' || encode(gen_random_bytes(12), 'hex');
    
    -- 3. Atomic Update: Mark BOTH as matched
    
    -- Update Peer
    update match_queue 
    set status = 'matched', room_id = v_room_id
    where id = v_match.id;

    -- Update Caller (Self)
    -- This ensures that when this RPC returns, the caller is ALSO officially 'matched'
    -- This triggers the Realtime event for the caller too (though they get the return value)
    update match_queue
    set status = 'matched', room_id = v_room_id
    where user_id = p_user_id and status = 'waiting';

    return query select 
      true as match_found,
      v_room_id as match_room_id,
      v_match.user_id as peer_user_id;
  end if;

  return query select false, null::text, null::uuid;
EXCEPTION 
  WHEN lock_not_available THEN
    -- If we couldn't lock our own row, it means we are being matched by someone else right now!
    -- Return false, and let the other process handle it.
    return query select false, null::text, null::uuid;
end;
$$;

-- Debug Function to inspect similarity scores
create or replace function debug_matches(
  p_user_id uuid,
  p_topic_embedding vector(768),
  p_mode text
)
returns table (
  topic text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    match_queue.topic,
    (1 - (match_queue.topic_embedding <=> p_topic_embedding))::float as similarity
  from match_queue
  where mode = p_mode
    and user_id != p_user_id
    and status = 'waiting'
  order by similarity desc
  limit 5;
end;
$$;
