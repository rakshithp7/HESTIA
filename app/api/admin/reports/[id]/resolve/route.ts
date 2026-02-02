import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/require-admin';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { ModerationReportStatus } from '@/lib/supabase/types';

export const runtime = 'nodejs';

type ResolvePayload = {
  status?: ModerationReportStatus;
  notes?: string;
};

const RESOLVABLE_STATUSES: ModerationReportStatus[] = ['resolved', 'dismissed'];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminUser();
  if ('response' in guard) {
    return guard.response;
  }

  try {
    const payload = (await request
      .json()
      .catch(() => null)) as ResolvePayload | null;
    if (!payload?.status || !RESOLVABLE_STATUSES.includes(payload.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const resolutionNotes = payload.notes?.trim() || null;
    const service = getSupabaseServiceClient();
    const { id } = await context.params;
    const now = new Date().toISOString();

    const { data, error } = await service
      .from('moderation_reports')
      .update({
        status: payload.status,
        resolved_by: guard.user.id,
        resolved_at: now,
        resolution_notes: resolutionNotes,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin/report/resolve] Failed to update report', error);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    console.error('[admin/report/resolve] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
