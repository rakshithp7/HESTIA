import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchActiveBan } from '@/lib/moderation/server-bans';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('[me/ban] Supabase user error', error);
      return NextResponse.json(
        { error: 'Unable to verify session' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ban = await fetchActiveBan(user.id);
    return NextResponse.json({ ban });
  } catch (err) {
    console.error('[me/ban] Unexpected error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
