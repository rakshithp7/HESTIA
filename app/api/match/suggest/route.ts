import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { fetchMeetsMinimumAge } from '@/lib/verification/server-age';

export const runtime = 'nodejs';

// Below this the topics have nothing to do with each other and offering the
// match would read as noise. Kept server-side so a client cannot widen it.
const SUGGESTED_MATCH_MIN_SIMILARITY = 0.1;

type SuggestionRow = {
  queue_id: string;
  topic: string;
  similarity: number;
  peer_consented_to_me: boolean | null;
};

export async function POST() {
  try {
    const guard = await requireUser('match/suggest');
    if ('response' in guard) return guard.response;
    const { user } = guard;

    if (!(await fetchMeetsMinimumAge(user.id))) {
      return NextResponse.json(
        { error: 'Age verification required', reason: 'under_16_or_unverified' },
        { status: 403 }
      );
    }

    const service = getSupabaseServiceClient();

    // The RPC derives the search vector, mode and block list from the caller's
    // own waiting row, and returns nothing if they are banned or not queued.
    const { data, error } = await service.rpc('suggested_match_for', {
      p_caller: user.id,
      p_min_similarity: SUGGESTED_MATCH_MIN_SIMILARITY,
    });

    if (error) {
      console.error('[match/suggest] suggested_match_for failed', error);
      return NextResponse.json(
        { error: 'Unable to load suggestion' },
        { status: 500 }
      );
    }

    const best = (data as SuggestionRow[] | null)?.[0];

    if (!best) {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({
      suggestion: {
        queueId: best.queue_id,
        topic: best.topic,
        similarity: best.similarity,
        peerConsentedToMe: best.peer_consented_to_me ?? false,
      },
    });
  } catch (error) {
    console.error('[match/suggest] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
