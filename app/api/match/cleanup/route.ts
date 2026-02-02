import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { fetchActiveBan } from '@/lib/moderation/server-bans';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('[match/cleanup] Supabase user error', userError);
      return NextResponse.json(
        { error: 'Unable to verify session' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [ban] = await Promise.all([fetchActiveBan(user.id)]);

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
    } | null;
    if (!payload?.roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const service = getSupabaseServiceClient();

    const { data: match, error: matchError } = await service
      .from('active_matches')
      .select('room_id, peer1_id, peer2_id')
      .eq('room_id', payload.roomId)
      .maybeSingle();

    if (matchError && matchError.code !== 'PGRST116') {
      console.error('[match/cleanup] Failed to load match', matchError);
      return NextResponse.json(
        { error: 'Failed to lookup match' },
        { status: 500 }
      );
    }

    if (match && ![match.peer1_id, match.peer2_id].includes(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await service
      .from('active_matches')
      .delete()
      .eq('room_id', payload.roomId);

    if (deleteError) {
      console.error('[match/cleanup] Failed to delete match', deleteError);
      return NextResponse.json(
        { error: 'Failed to cleanup match' },
        { status: 500 }
      );
    }

    return NextResponse.json({ roomId: payload.roomId });
  } catch (error) {
    console.error('[match/cleanup] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
