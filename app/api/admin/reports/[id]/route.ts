import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/require-admin';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { UserBan } from '@/lib/supabase/types';
import { isBanActive } from '@/lib/moderation/bans';

export const runtime = 'nodejs';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ('response' in guard) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const service = getSupabaseServiceClient();

    const { data: report, error: reportError } = await service
      .from('moderation_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (reportError) {
      console.error('[admin/report] Failed to load report', reportError);
      return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
    }

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const { data: bans, error: bansError } = await service
      .from('user_bans')
      .select('*')
      .eq('user_id', report.reported_id)
      .order('created_at', { ascending: false });

    if (bansError && bansError.code !== 'PGRST116') {
      console.error('[admin/report] Failed to load bans', bansError);
      return NextResponse.json({ error: 'Failed to load bans' }, { status: 500 });
    }

    const typedBans = (bans ?? []) as UserBan[];
    const activeBan = typedBans.find((ban) => isBanActive(ban));

    return NextResponse.json({
      report,
      bans: typedBans,
      activeBan: activeBan ?? null,
    });
  } catch (error) {
    console.error('[admin/report] Unexpected error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
