import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { fetchActiveBan } from '@/lib/moderation/server-bans';
import { fetchMeetsMinimumAge } from '@/lib/verification/server-age';

export const runtime = 'nodejs';

const VALID_MODES = new Set(['voice', 'chat']);

export async function POST(req: Request) {
  try {
    const guard = await requireUser('match/register');
    if ('response' in guard) return guard.response;
    const { user } = guard;
    const [ban, meetsMinimumAge] = await Promise.all([
      fetchActiveBan(user.id),
      fetchMeetsMinimumAge(user.id),
    ]);

    // The matching RPCs already refuse underage callers; this exists so the UI
    // gets a reason instead of a session that silently never matches.
    if (!meetsMinimumAge) {
      return NextResponse.json(
        {
          error: 'Age verification required',
          reason: 'under_16_or_unverified',
        },
        { status: 403 }
      );
    }

    if (ban) {
      return NextResponse.json(
        {
          error: 'User is banned',
          bannedUntil: ban.ends_at,
          reason: ban.reason,
          banId: ban.id,
        },
        { status: 403 }
      );
    }

    const payload = (await req.json().catch(() => null)) as {
      roomId?: string;
      topic?: string;
      mode?: string;
      peerUserId?: string;
    } | null;

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { roomId, topic, mode, peerUserId } = payload;

    if (!roomId || !topic || !mode || !peerUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: 'Invalid session mode' },
        { status: 400 }
      );
    }

    if (peerUserId === user.id) {
      return NextResponse.json(
        { error: 'Peer cannot be the same as reporter' },
        { status: 400 }
      );
    }

    const service = getSupabaseServiceClient();

    const { data: blockedRows, error: blockedError } = await service
      .from('blocked_users')
      .select('user_id, blocked_user_id')
      .or(
        `and(user_id.eq.${user.id},blocked_user_id.eq.${peerUserId}),and(user_id.eq.${peerUserId},blocked_user_id.eq.${user.id})`
      );

    if (blockedError) {
      console.error('[match/register] Block lookup failed', blockedError);
      return NextResponse.json(
        { error: 'Failed to verify safety status' },
        { status: 500 }
      );
    }

    const blockedBySelf = blockedRows?.some(
      (entry) =>
        entry.user_id === user.id && entry.blocked_user_id === peerUserId
    );
    const blockedByPeer = blockedRows?.some(
      (entry) =>
        entry.user_id === peerUserId && entry.blocked_user_id === user.id
    );

    if (blockedBySelf || blockedByPeer) {
      return NextResponse.json(
        {
          error: 'Users are blocked from matching',
          blockedBy: blockedBySelf ? 'self' : 'peer',
        },
        { status: 409 }
      );
    }

    const [peer1Id, peer2Id] = [user.id, peerUserId].sort();

    const { error: upsertError } = await service.from('active_matches').upsert(
      {
        room_id: roomId,
        topic,
        mode,
        peer1_id: peer1Id,
        peer2_id: peer2Id,
      },
      { onConflict: 'room_id' }
    );

    if (upsertError) {
      console.error('[match/register] Failed to store match', upsertError);
      return NextResponse.json(
        { error: 'Unable to store active match' },
        { status: 500 }
      );
    }

    return NextResponse.json({ roomId });
  } catch (error) {
    console.error('[match/register] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
