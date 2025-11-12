import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { ChatMessage } from '@/lib/webrtc/useRTCSession';

export const runtime = 'nodejs';

type ReportPayload = {
  roomId?: string;
  reasons?: string[];
  notes?: string;
  chatLog?: ChatMessage[];
};

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('[report] Supabase user error', userError);
      return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as ReportPayload | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { roomId, reasons, notes = '', chatLog = [] } = payload;

    if (!roomId || !Array.isArray(reasons) || reasons.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const service = getSupabaseServiceClient();

    const { data: match, error: matchError } = await service
      .from('active_matches')
      .select('room_id, topic, mode, peer1_id, peer2_id, created_at')
      .eq('room_id', roomId)
      .maybeSingle();

    if (matchError) {
      console.error('[report] Failed to load match', matchError);
      return NextResponse.json({ error: 'Unable to locate session metadata' }, { status: 500 });
    }

    if (!match || ![match.peer1_id, match.peer2_id].includes(user.id)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const reportedUserId = match.peer1_id === user.id ? match.peer2_id : match.peer1_id;

    const [reporterUser, reportedUser] = await Promise.all([
      service.auth.admin.getUserById(user.id).catch((error) => {
        console.error('[report] Failed to load reporter user', error);
        return null;
      }),
      service.auth.admin.getUserById(reportedUserId).catch((error) => {
        console.error('[report] Failed to load reported user', error);
        return null;
      }),
    ]);

    const reporterEmail = reporterUser?.data?.user?.email ?? null;
    const reportedEmail = reportedUser?.data?.user?.email ?? null;

    const reportEnvelope = {
      roomId,
      topic: match.topic,
      mode: match.mode,
      createdAt: match.created_at,
      reporter: { id: user.id, email: reporterEmail },
      reported: { id: reportedUserId, email: reportedEmail },
      reasons,
      notes: notes.trim() || null,
      chatLog,
    };

    console.log('[report] moderation payload\n', JSON.stringify(reportEnvelope, null, 2));

    const { error: blockError } = await service.from('blocked_users').upsert(
      {
        user_id: user.id,
        blocked_user_id: reportedUserId,
      },
      { onConflict: 'user_id,blocked_user_id' }
    );

    if (blockError) {
      console.error('[report] Failed to block reported user', blockError);
    }

    const { error: cleanupError } = await service.from('active_matches').delete().eq('room_id', roomId);
    if (cleanupError) {
      console.error('[report] Failed to cleanup match after report', cleanupError);
    }

    return NextResponse.json({ reportedUserId });
  } catch (error) {
    console.error('[report] Unexpected error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
