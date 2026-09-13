import { describe, it, expect } from 'vitest';
import { ensureQueued, type QueueClient } from '@/lib/webrtc/ensure-queued';

type Call = { op: string; table: string; column?: string; value?: string };

/**
 * Stub standing in for the Supabase client, recording what was asked of it.
 *
 * Table names and `eq` arguments are captured, not ignored, so a query against
 * the wrong row or column fails the test rather than passing quietly.
 */
function stubClient(opts: {
  existing: { id: string } | null;
  selectError?: unknown;
  deleteError?: unknown;
  insertError?: unknown;
  insertedId?: string;
}) {
  const calls: Call[] = [];
  let inserted: Record<string, unknown> | null = null;

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              return {
                maybeSingle: async () => {
                  calls.push({ op: 'select', table, column, value });
                  return {
                    data: opts.existing,
                    error: opts.selectError ?? null,
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq: async (column: string, value: string) => {
              calls.push({ op: 'delete', table, column, value });
              return { error: opts.deleteError ?? null };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          calls.push({ op: 'insert', table });
          inserted = row;
          return {
            select() {
              return {
                single: async () => ({
                  data: opts.insertError
                    ? null
                    : { id: opts.insertedId ?? 'new-row' },
                  error: opts.insertError ?? null,
                }),
              };
            },
          };
        },
      };
    },
  } as unknown as QueueClient;

  return { client, calls, inserted: () => inserted };
}

const entry = {
  userId: 'user-1',
  topic: 'exam stress',
  mode: 'chat',
  embedding: [0.1, 0.2],
};

describe('ensureQueued', () => {
  it('leaves a live row alone', async () => {
    const { client, calls } = stubClient({ existing: { id: 'row-1' } });

    const result = await ensureQueued(client, 'row-1', entry);

    expect(result).toEqual({ queueId: 'row-1', reinserted: false });
    expect(calls).toEqual([
      { op: 'select', table: 'match_queue', column: 'id', value: 'row-1' },
    ]);
  });

  it('re-joins the queue when the row has been deleted underneath it', async () => {
    // The case that made members wait forever: find_match removes rows older
    // than 20s, and a throttled tab can miss that many heartbeats.
    const { client, calls, inserted } = stubClient({
      existing: null,
      insertedId: 'row-2',
    });

    const result = await ensureQueued(client, 'row-1', entry);

    expect(result).toEqual({ queueId: 'row-2', reinserted: true });
    expect(calls).toEqual([
      { op: 'select', table: 'match_queue', column: 'id', value: 'row-1' },
      { op: 'delete', table: 'match_queue', column: 'user_id', value: 'user-1' },
      { op: 'insert', table: 'match_queue' },
    ]);
    // A row whose topic, mode or embedding disagreed with the session would be
    // matched on the wrong thing.
    expect(inserted()).toEqual({
      user_id: 'user-1',
      topic: 'exam stress',
      topic_embedding: [0.1, 0.2],
      mode: 'chat',
      status: 'waiting',
    });
  });

  it('does not re-insert when the existence check itself failed', async () => {
    // A transient error is not evidence the row is gone; re-inserting would
    // leave the member with two rows.
    const { client, calls } = stubClient({
      existing: null,
      selectError: new Error('network'),
    });

    await expect(ensureQueued(client, 'row-1', entry)).rejects.toThrow(
      'network'
    );
    expect(calls.map((c) => c.op)).toEqual(['select']);
  });

  it('does not insert when clearing the old rows failed', async () => {
    // match_queue has no unique constraint on user_id, so inserting after a
    // failed delete would leave two waiting rows for one member.
    const { client, calls } = stubClient({
      existing: null,
      deleteError: new Error('delete blocked'),
    });

    await expect(ensureQueued(client, 'row-1', entry)).rejects.toThrow(
      'delete blocked'
    );
    expect(calls.map((c) => c.op)).toEqual(['select', 'delete']);
  });

  it('surfaces an insert failure rather than reporting success', async () => {
    const { client } = stubClient({
      existing: null,
      insertError: new Error('insert blocked'),
    });

    await expect(ensureQueued(client, 'row-1', entry)).rejects.toThrow(
      'insert blocked'
    );
  });
});
