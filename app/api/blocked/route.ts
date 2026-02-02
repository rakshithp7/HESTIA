import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('[blocked] Supabase user error', userError);
      return NextResponse.json(
        { error: 'Unable to verify session' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = getSupabaseServiceClient();
    const [
      { data: blockedData, error: blockedError },
      { data: blockedByData, error: blockedByError },
    ] = await Promise.all([
      service
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('user_id', user.id),
      service
        .from('blocked_users')
        .select('user_id')
        .eq('blocked_user_id', user.id),
    ]);

    if (blockedError || blockedByError) {
      console.error(
        '[blocked] Failed to load blocked lists',
        blockedError ?? blockedByError
      );
      return NextResponse.json(
        { error: 'Unable to load blocked users' },
        { status: 500 }
      );
    }

    const blockedUserIds =
      blockedData?.map((entry) => entry.blocked_user_id) ?? [];
    const blockedByUserIds = blockedByData?.map((entry) => entry.user_id) ?? [];

    let blockedUsers: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    }[] = [];

    if (blockedUserIds.length) {
      const { data: profilesData, error: profilesError } = await service
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', blockedUserIds);

      if (profilesError) {
        console.error(
          '[blocked] Failed to load blocked user profiles',
          profilesError
        );
        return NextResponse.json(
          { error: 'Unable to load blocked users' },
          { status: 500 }
        );
      }

      blockedUsers = blockedUserIds.map((id) => {
        const profile = profilesData?.find((p) => p.id === id);
        return {
          id,
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null,
        };
      });
    }

    return NextResponse.json({ blockedUsers, blockedByUserIds });
  } catch (error) {
    console.error('[blocked] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('[blocked] Supabase user error', userError);
      return NextResponse.json(
        { error: 'Unable to verify session' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as {
      blockedUserId?: string;
    } | null;
    if (!payload?.blockedUserId) {
      return NextResponse.json(
        { error: 'Missing blockedUserId' },
        { status: 400 }
      );
    }

    const service = getSupabaseServiceClient();
    const { error } = await service
      .from('blocked_users')
      .delete()
      .eq('user_id', user.id)
      .eq('blocked_user_id', payload.blockedUserId);

    if (error) {
      console.error('[blocked] Failed to remove blocked user', error);
      return NextResponse.json(
        { error: 'Unable to remove blocked user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ blockedUserId: payload.blockedUserId });
  } catch (error) {
    console.error('[blocked] Unexpected delete error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
