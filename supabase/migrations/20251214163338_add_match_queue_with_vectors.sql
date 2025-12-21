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
  consented_queue_id uuid, -- Added for mutual consent logic
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Policy: Users can view waiting match requests (for discovery/client-side checks)
drop policy if exists "Users can view waiting match requests" on match_queue;
create policy "Users can view waiting match requests"
  on match_queue for select
  to authenticated
  using (status = 'waiting');

-- Policy: Users can update their own requests
drop policy if exists "Users can update their own match requests" on match_queue;
create policy "Users can update their own match requests"
  on match_queue for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own match requests
drop policy if exists "Users can delete their own match requests" on match_queue;
create policy "Users can delete their own match requests"
  on match_queue for delete
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
drop function if exists debug_matches(uuid, vector(768), text);

-- Debug Function to inspect similarity scores and consent
create or replace function debug_matches(
  p_user_id uuid,
  p_topic_embedding vector(768),
  p_mode text,
  p_my_queue_id uuid default null
)
returns table (
  queue_id uuid, -- Added queue_id to return
  topic text,
  similarity float,
  peer_consented_to_me boolean -- Added to return consent status
)
language plpgsql
security definer
as $$
declare
    v_my_queue_record record;
begin
  -- Get my record to check for consents against me
  select * into v_my_queue_record from match_queue where id = p_my_queue_id;

  return query
  select
    mq.id as queue_id,
    mq.topic,
    (1 - (mq.topic_embedding <=> p_topic_embedding))::float as similarity,
    case
      when p_my_queue_id is not null then (mq.consented_queue_id = p_my_queue_id)
      else false
    end as peer_consented_to_me
  from match_queue mq
  where mq.mode = p_mode
    and mq.user_id != p_user_id
    and mq.status = 'waiting'
    -- FILTER STALE USERS: Must have heartbeated recently
    and mq.updated_at > now() - interval '15 seconds'
  order by similarity desc
  limit 5;
end;
$$;


-- Optimistic Fix for find_match RPC to prevent deadlocks and race conditions
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
  v_my_queue_record record;
  v_is_match_found boolean := false;
  v_updated_count int;
begin
  -- Lazy Cleanup: Remove any request that hasn't heartbeated in 20 seconds
  delete from match_queue
  where updated_at < now() - interval '20 seconds';

  -- 1. Get My ID/Status (No Lock - Optimistic Read)
  select * into v_my_queue_record
  from match_queue 
  where user_id = p_user_id and status = 'waiting' 
  limit 1;
  
  if v_my_queue_record.id is null then
     -- caller not found or not waiting
     return query select false, null::text, null::uuid;
     return;
  end if;

  -- 2. Priority Check: Mutual Consent (No Lock - Optimistic Read)
  if v_my_queue_record.consented_queue_id is not null then
    select 
      id, 
      user_id
    into v_match
    from match_queue
    where id = v_my_queue_record.consented_queue_id
      and status = 'waiting'
      and consented_queue_id = v_my_queue_record.id -- They must point back to me
      and updated_at > now() - interval '15 seconds' -- Ensure they are alive
    limit 1;
    
    if found then
      v_is_match_found := true;
    end if;
  end if;

  -- 3. If no mutual consent match, Find the best semantic match (No Lock - Optimistic Read)
  if not v_is_match_found then
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
      and updated_at > now() - interval '15 seconds' -- Ensure they are alive
    order by topic_embedding <=> p_topic_embedding asc
    limit 1;
    
    if found then
      v_is_match_found := true;
    end if;
  end if;

  if v_is_match_found then
    -- Generate simple room ID
    v_room_id := 'room_' || encode(gen_random_bytes(12), 'hex');
    
    -- 4. Atomic Update: Mark BOTH as matched
    -- We use a single UPDATE statement to minimize deadlock risk, relying on Postgres internal locking order.
    -- If a deadlock occurs, we catch it and return false (letting the other transaction win or retry).
    
    with updates as (
        update match_queue 
        set status = 'matched', room_id = v_room_id
        where id in (v_my_queue_record.id, v_match.id)
          and status = 'waiting' -- Ensure they are STILL waiting
        returning id
    )
    select count(*) into v_updated_count from updates;

    if v_updated_count = 2 then
        -- Success! Both updated.
        return query select 
          true as match_found,
          v_room_id as match_room_id,
          v_match.user_id as peer_user_id;
    else
        -- Failed to grab both (race condition). 
        -- Likely one was taken by someone else or cancelled.
        return query select false, null::text, null::uuid;
    end if;
  else
    return query select false, null::text, null::uuid;
  end if;

EXCEPTION 
  WHEN deadlock_detected THEN
    -- If we deadlock, it means another transaction (likely the peer finding us) is working.
    -- We simply yield.
    return query select false, null::text, null::uuid;
end;
$$;
