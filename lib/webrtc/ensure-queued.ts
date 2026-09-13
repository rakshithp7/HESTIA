import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimal client surface, so this is testable without a real connection. */
export type QueueClient = Pick<SupabaseClient, 'from'>;

export type QueueEntry = {
  userId: string;
  topic: string;
  mode: string;
  embedding: number[];
};

/**
 * Make sure the caller still has a waiting row, re-inserting it if not.
 *
 * find_match deletes stale rows, and find_match returns nothing at all when the
 * caller has no row - so a member whose row was collected sat on a search that
 * could never succeed. Returns the id of the live row.
 */
export async function ensureQueued(
  client: QueueClient,
  queueId: string,
  entry: QueueEntry
): Promise<{ queueId: string; reinserted: boolean }> {
  const { data: existing, error } = await client
    .from('match_queue')
    .select('id')
    .eq('id', queueId)
    .maybeSingle();

  // A failed check is not evidence the row is gone; re-inserting on a transient
  // error would leave the member with two rows.
  if (error) throw error;

  if (existing) return { queueId, reinserted: false };

  // No unique constraint on user_id, so a failed delete here would mean two
  // waiting rows after the insert.
  const { error: deleteError } = await client
    .from('match_queue')
    .delete()
    .eq('user_id', entry.userId);

  if (deleteError) throw deleteError;

  const { data: created, error: insertError } = await client
    .from('match_queue')
    .insert({
      user_id: entry.userId,
      topic: entry.topic,
      topic_embedding: entry.embedding,
      mode: entry.mode,
      status: 'waiting',
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { queueId: created.id as string, reinserted: true };
}
