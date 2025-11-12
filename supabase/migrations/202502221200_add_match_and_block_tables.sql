create table if not exists public.active_matches (
  room_id text primary key,
  topic text not null,
  mode text not null check (mode in ('voice', 'chat')),
  peer1_id uuid not null references auth.users (id) on delete cascade,
  peer2_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists active_matches_peer1_idx on public.active_matches (peer1_id);
create index if not exists active_matches_peer2_idx on public.active_matches (peer2_id);

create table if not exists public.blocked_users (
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id)
);

create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_user_id);

alter table if exists public.active_matches enable row level security;
alter table if exists public.blocked_users enable row level security;

drop policy if exists "blocked users owner select" on public.blocked_users;
create policy "blocked users owner select"
  on public.blocked_users
  for select
  using (auth.uid() = user_id);

drop policy if exists "blocked users owner insert" on public.blocked_users;
create policy "blocked users owner insert"
  on public.blocked_users
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "blocked users owner delete" on public.blocked_users;
create policy "blocked users owner delete"
  on public.blocked_users
  for delete
  using (auth.uid() = user_id);