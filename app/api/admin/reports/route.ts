import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { requireAdminUser } from '@/lib/auth/require-admin';
import type { ActiveUserBan, ModerationReportStatus } from '@/lib/supabase/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireAdminUser();
  if ('response' in guard) {
    return guard.response;
  }

  try {
    const service = getSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const validStatuses: ModerationReportStatus[] = ['pending', 'resolved', 'dismissed'];
    const statusFilter = validStatuses.includes(statusParam as ModerationReportStatus)
      ? (statusParam as ModerationReportStatus)
      : null;
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    let query = service.from('moderation_reports').select('*').order('created_at', { ascending: false }).limit(limit);

    if (statusFilter && validStatuses.includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('[admin/reports] Failed to fetch reports', error);
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    const reportedIds = Array.from(
      new Set((reports ?? []).map((report) => report.reported_id).filter((id): id is string => Boolean(id)))
    );

    let activeBans: ActiveUserBan[] = [];
    if (reportedIds.length > 0) {
      const { data: bans, error: bansError } = await service
        .from('active_user_bans')
        .select('*')
        .in('user_id', reportedIds);
      if (bansError && bansError.code !== 'PGRST116') {
        console.error('[admin/reports] Failed to fetch active bans', bansError);
        return NextResponse.json({ error: 'Failed to fetch active bans' }, { status: 500 });
      }
      activeBans = bans ?? [];
    }

    const banMap = new Map(activeBans.map((ban) => [ban.user_id, ban]));
    const enrichedReports =
      reports?.map((report) => ({
        ...report,
        activeBan: banMap.get(report.reported_id) ?? null,
      })) ?? [];

    return NextResponse.json({ reports: enrichedReports });
  } catch (error) {
    console.error('[admin/reports] Unexpected error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
