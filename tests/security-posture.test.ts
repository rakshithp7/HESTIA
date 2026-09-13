import { describe, it, expect } from 'vitest';

/**
 * Live security-posture checks.
 *
 * These probe the deployed PostgREST surface with the publishable (anon) key -
 * the same key that ships in the browser bundle, so this is the real attack
 * surface rather than a model of it.
 *
 * They exist because three separate fixes on 2026-09-12 reported success and
 * silently changed nothing: a column-level revoke against a table-level grant,
 * a role-level revoke against an inherited PUBLIC grant, and a
 * `create or replace` that missed another overload of the same function. Each
 * was caught only by probing afterwards. These tests are that probe, kept.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && anon);

async function anonRpc(fn: string, body: unknown) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anon as string,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function anonSelect(table: string) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: anon as string, Authorization: `Bearer ${anon}` },
  });
  return res.status;
}

const someUuid = '00000000-0000-0000-0000-000000000000';

describe.skipIf(!configured)('anon cannot reach privileged helpers', () => {
  it('cannot ask whether an arbitrary member is banned', async () => {
    const { status } = await anonRpc('caller_has_active_ban', {
      p_caller: someUuid,
    });
    expect(status).toBe(401);
  });

  it('cannot read an arbitrary member block list', async () => {
    const { status } = await anonRpc('matching_excluded_user_ids', {
      p_caller: someUuid,
    });
    expect(status).toBe(401);
  });

  it('cannot ask whether an arbitrary member is an adult', async () => {
    const { status } = await anonRpc('caller_is_adult', { p_caller: someUuid });
    expect(status).toBe(401);
  });

  it('cannot read the ban list', async () => {
    expect(await anonSelect('active_user_bans')).toBe(401);
  });

  it('cannot invoke trigger functions as RPCs', async () => {
    const { status } = await anonRpc('handle_new_user', {});
    expect(status).toBe(404);
  });
});

describe.skipIf(!configured)('retired matching surfaces stay retired', () => {
  it('debug_matches no longer exists', async () => {
    const { status, body } = await anonRpc('debug_matches', {
      p_user_id: someUuid,
      p_topic_embedding: [],
      p_mode: 'chat',
      p_my_queue_id: null,
    });
    expect(status).toBe(404);
    expect(body?.code).toBe('PGRST202');
  });

  it('the un-hardened 6-argument find_match overload is gone', async () => {
    // Identity spoofing, block bypass and threshold bypass all lived here.
    const { status, body } = await anonRpc('find_match', {
      p_user_id: someUuid,
      p_topic_embedding: Array(768).fill(0.1),
      p_mode: 'chat',
      p_queue_id: someUuid,
      p_excluded_user_ids: [],
      p_threshold: 0,
    });
    expect(status).toBe(404);
    expect(body?.code).toBe('PGRST202');
  });

  it('suggestions are service-role only', async () => {
    const { status } = await anonRpc('suggested_match_for', {
      p_caller: someUuid,
      p_min_similarity: 0.1,
    });
    expect(status).toBe(401);
  });
});

describe.skipIf(!configured)('matching still works for real callers', () => {
  it('find_match accepts the current client shape', async () => {
    const { status } = await anonRpc('find_match', { p_threshold: 0.7 });
    expect(status).toBe(200);
  });

  it('find_match still accepts the legacy five-argument shape', async () => {
    // A browser on an older bundle must keep matching until it reloads.
    const { status } = await anonRpc('find_match', {
      p_user_id: someUuid,
      p_topic_embedding: Array(768).fill(0.1),
      p_mode: 'chat',
      p_excluded_user_ids: [],
      p_threshold: 0.7,
    });
    expect(status).toBe(200);
  });
});
