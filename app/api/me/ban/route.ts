import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { fetchActiveBan } from '@/lib/moderation/server-bans';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const guard = await requireUser('me/ban');
    if ('response' in guard) return guard.response;

    const ban = await fetchActiveBan(guard.user.id);
    return NextResponse.json({ ban });
  } catch (err) {
    console.error('[me/ban] Unexpected error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
