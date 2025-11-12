import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/require-admin';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function POST(_: Request, context: { params: { banId: string } }) {
  const guard = await requireAdminUser();
  if ('response' in guard) {
    return guard.response;
  }

  try {
    const { banId } = context.params;
    const service = getSupabaseServiceClient();
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await service
      .from('user_bans')
      .select('id, lifted_at')
      .eq('id', banId)
      .maybeSingle();

    if (fetchError) {
      console.error('[admin/ban/lift] Failed to load ban', fetchError);
      return NextResponse.json({ error: 'Failed to load ban' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Ban not found' }, { status: 404 });
    }

    if (existing.lifted_at) {
      return NextResponse.json({ error: 'Ban already lifted' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await service
      .from('user_bans')
      .update({
        lifted_at: now,
        lifted_by: guard.user.id,
        updated_at: now,
      })
      .eq('id', banId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[admin/ban/lift] Failed to lift ban', updateError);
      return NextResponse.json({ error: 'Failed to lift ban' }, { status: 500 });
    }

    return NextResponse.json({ ban: updated });
  } catch (error) {
    console.error('[admin/ban/lift] Unexpected error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
