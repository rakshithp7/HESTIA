import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/require-admin';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { BanDurationLabel } from '@/lib/supabase/types';
import { resolveBanWindow } from '@/lib/moderation/bans';

export const runtime = 'nodejs';

type BanPayload = {
  durationLabel?: BanDurationLabel;
  customEndsAt?: string;
  reason?: string;
  notes?: string;
};

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
      .catch(() => null)) as BanPayload | null;
    if (!payload?.durationLabel) {
      return NextResponse.json(
        { error: 'Missing duration label' },
        { status: 400 }
      );
    }

    if (payload.durationLabel === 'custom' && !payload.customEndsAt) {
      return NextResponse.json(
        { error: 'Custom bans require an end time' },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const service = getSupabaseServiceClient();

    const { data: report, error: reportError } = await service
      .from('moderation_reports')
      .select('id, reported_id')
      .eq('id', id)
      .maybeSingle();

    if (reportError) {
      console.error('[admin/report/ban] Failed to load report', reportError);
      return NextResponse.json(
        { error: 'Failed to load report' },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const { data: activeBan, error: activeBanError } = await service
      .from('active_user_bans')
      .select('*')
      .eq('user_id', report.reported_id)
      .maybeSingle();

    if (activeBanError && activeBanError.code !== 'PGRST116') {
      console.error(
        '[admin/report/ban] Failed to check active ban',
        activeBanError
      );
      return NextResponse.json(
        { error: 'Failed to check active ban' },
        { status: 500 }
      );
    }

    if (activeBan) {
      return NextResponse.json(
        { error: 'User already has an active ban', ban: activeBan },
        { status: 409 }
      );
    }

    const { startsAt, endsAt } = resolveBanWindow(payload.durationLabel, {
      customEndsAt: payload.customEndsAt,
    });
    const reason = payload.reason?.trim() || null;
    const notes = payload.notes?.trim() || null;
    const now = new Date().toISOString();

    const { data: ban, error: insertError } = await service
      .from('user_bans')
      .insert({
        user_id: report.reported_id,
        report_id: report.id,
        reason,
        notes,
        duration_label: payload.durationLabel,
        issued_by: guard.user.id,
        starts_at: startsAt,
        ends_at: endsAt,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[admin/report/ban] Failed to issue ban', insertError);
      return NextResponse.json(
        { error: 'Failed to issue ban' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ban });
  } catch (error) {
    console.error('[admin/report/ban] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
