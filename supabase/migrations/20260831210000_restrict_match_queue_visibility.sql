-- Restrict match_queue visibility.
--
-- The previous policy let any authenticated user select every waiting row:
--
--   create policy "Users can view waiting match requests"
--     on match_queue for select to authenticated
--     using (status = 'waiting');
--
-- Because the anon key ships in the client bundle, any signed-in member could
-- read the topic and user_id of everyone currently waiting. For a product whose
-- premise is anonymity, that is the wrong default.
--
-- Matching itself does not depend on this policy: find_match and debug_matches
-- are SECURITY DEFINER and bypass RLS. The only client code that reads another
-- member's row directly is the Realtime watcher in useMatchQueue, which follows
-- the suggested peer's row to notice when it is deleted or stops waiting. This
-- migration keeps exactly that much visibility and no more.

-- Helper returning the queue rows the caller is linked to by mutual consent.
-- SECURITY DEFINER so the policy below can reference match_queue without
-- triggering recursive RLS evaluation on the same table.
create or replace function public.consent_linked_queue_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct linked_id), '{}')
  from (
    -- Rows this user has consented to.
    select mine.consented_queue_id as linked_id
    from match_queue mine
    where mine.user_id = auth.uid()
      and mine.consented_queue_id is not null

    union

    -- Rows that have consented to this user.
    select theirs.id as linked_id
    from match_queue theirs
    where theirs.consented_queue_id in (
      select mine.id from match_queue mine where mine.user_id = auth.uid()
    )
  ) links
  where linked_id is not null;
$$;

comment on function public.consent_linked_queue_ids is
  'Queue rows the current user is linked to by mutual consent. Used by match_queue RLS so a member can watch only the peer they are negotiating with.';

revoke all on function public.consent_linked_queue_ids() from public;
grant execute on function public.consent_linked_queue_ids() to authenticated;

-- Replace the blanket policy with a consent-scoped one.
drop policy if exists "Users can view waiting match requests" on match_queue;

create policy "Users can view consent-linked match requests"
  on match_queue for select
  to authenticated
  using (
    status = 'waiting'
    and id = any (public.consent_linked_queue_ids())
  );

-- The pre-existing "Users can view their own match requests" policy still
-- covers a member reading their own row; policies are OR'd.
