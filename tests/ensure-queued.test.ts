import { describe, it, expect } from 'vitest';
import { ensureQueued, type QueueClient } from '@/lib/webrtc/ensure-queued';

/**
 * Stub standing in for the Supabase client, recording what was asked of it.
 *
 * Only the three calls `ensureQueued` makes are modelled: the existence check,
 * the tidy-up delete, and the re-insert.
 */
function stubClient(opts: {
  existing: { id: string } | null;
  selectError?: unknown;
  insertedId?: string;
}) {
  const calls: string[] = [];

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_col: string, _val: string) {
              return {
                maybeSingle: async () => {
                  calls.push(`select ${table}`);
                  return { data: opts.existing, error: opts.selectError ?? null };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq: async (_col: string, _val: string) => {
              calls.push(`delete ${table}`);
              return { error: null };
            },
          };
        },
        insert(_row: unknown) {
          calls.push(`insert ${table}`);
          return {
            select() {
              return {
                single: async () => ({
                  data: { id: opts.insertedId ?? 'new-row' },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  } as unknown as QueueClient;

  return { client, calls };
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
    expect(calls).toEqual(['select match_queue']);
  });

  it('re-joins the queue when the row has been deleted underneath it', async () => {
    // This is the case that made members wait forever: find_match removes rows
    // older than 20s, and a throttled tab can miss that many heartbeats.
    const { client, calls } = stubClient({ existing: null, insertedId: 'row-2' });

    const result = await ensureQueued(client, 'row-1', entry);

    expect(result).toEqual({ queueId: 'row-2', reinserted: true });
    expect(calls).toEqual([
      'select match_queue',
      'delete match_queue',
      'insert match_queue',
    ]);
  });

  it('does not re-insert when the existence check itself failed', async () => {
    // A transient error is not evidence the row is gone; re-inserting would
    // leave the member with two rows.
    const { client, calls } = stubClient({
      existing: null,
      selectError: new Error('network'),
    });

    await expect(ensureQueued(client, 'row-1', entry)).rejects.toThrow('network');
    expect(calls).toEqual(['select match_queue']);
  });
});
