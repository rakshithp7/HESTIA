import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Minimal surface of the client this needs, so the logic can be tested without
 * a real Supabase connection.
 */
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
 * `find_match` deletes any row whose `updated_at` is older than 20 seconds, and
 * the heartbeat that keeps it fresh is a timer. Browsers clamp timers in hidden
 * tabs - and apply intensive throttling after a tab has been hidden for five
 * minutes - so a member who is simply looking at another window can miss enough
 * heartbeats to have their row deleted underneath them.
 *
 * Nothing noticed. The client kept polling `find_match`, which returns
 * immediately when the caller has no queue row, so the member waited forever on
 * a screen that looked like it was still searching. Widening the margins does
 * not fix this, because a throttled tab can miss any fixed interval; the queue
 * entry has to be able to heal itself.
 *
 * Returns the id of the live row - the existing one, or the replacement.
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

  if (error) {
    // A failed check is not evidence the row is gone. Re-inserting here would
    // risk a duplicate row for the same member on any transient error.
    throw error;
  }

  if (existing) return { queueId, reinserted: false };

  // Clear anything else this member has left behind before re-joining, so a
  // half-dead row cannot linger and be matched against. `match_queue` has no
  // unique constraint on `user_id`, so if this fails the insert below would
  // give the member two waiting rows - exactly what it is here to prevent.
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
