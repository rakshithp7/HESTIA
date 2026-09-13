# Notes for coding agents

Read [SETUP.md](./SETUP.md) for commands and environment. This file is the
things that are not obvious from the code and have already caused real bugs.

## Never trust a successful write

Four changes in one evening reported success and silently changed nothing:

- `create or replace function` matches on **argument types**. Replacing a
  5-argument function leaves a 6-argument overload of the same name untouched
  and live. An un-hardened `find_match` survived a security migration this way.
  Drop overloads explicitly.
- Revoking `EXECUTE` from `anon` and `authenticated` does nothing on its own,
  because Postgres grants it to `PUBLIC` by default and the roles inherit that.
- Revoking from `PUBLIC` alone also does nothing, because Supabase grants
  `EXECUTE` to `anon` and `authenticated` explicitly via
  `ALTER DEFAULT PRIVILEGES`, and an explicit grant survives a `PUBLIC` revoke.
  **Both revokes are required.**
- A column-level `REVOKE UPDATE (col)` is a no-op while a table-level `UPDATE`
  grant exists. Revoke the table grant, then re-grant the safe columns.

After any change to grants, policies or functions, probe the live API with the
browser key. `tests/security-posture.test.ts` exists for exactly this and has
already caught a regression within minutes of it shipping.

## Matching is server-derived

`find_match` and `suggested_match_for` are the only ways into the queue, and
they derive everything from the caller: identity from `auth.uid()`, blocks,
ban status, and age band. Arguments a client passes for those are ignored shims
kept only so the deployed client keeps working.

Anything that must not be bypassable belongs **inside those functions**, not in
an API route. Routes duplicate the checks so the UI can show a reason, but the
database is what enforces them.

Ship the migration before the client that depends on it, and avoid leaving two
overloads of the same function — PostgREST returns `PGRST203` when a call is
ambiguous.

## Age policy

16 and over. Two bands that never match each other: 16-17, and 18+. No date of
birth on file means no band and no matching — it fails closed. The birthdate
comes from Stripe Identity and members hold no `UPDATE` grant on that column, so
it cannot be forged.

## Deploys are manual

The Netlify site has no git build hook. `git push` deploys nothing. Production
only changes via `npx netlify deploy --build --prod`. Confirm the account and
project with `npx netlify status` first.

## Verify claims before reporting them

Separate what was measured from what was inferred, and say which is which. When
chasing a UI bug, measure the thing being described rather than a proxy for it —
`getComputedStyle` does not apply `:hover`, so it cannot tell you what a hovered
element looks like.

## Conventions

- No attribution trailers in commit messages.
- Comments explain why, not what, and are written as if the reader knows the
  language but not the history.
