import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createVerificationSession } from '@/lib/stripe/identity';
import type { Profile } from '@/lib/supabase/types';
import { nextProfileStatusForSession } from '@/lib/verification';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('[identity/session] Supabase user error', userError);
      return NextResponse.json(
        { error: 'Failed to load session' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>();

    if (profileError || !profile) {
      console.error('[identity/session] Failed to load profile', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (
      profile.verification_status === 'verified' &&
      profile.verification_required === false
    ) {
      return NextResponse.json(
        { error: 'Profile already verified' },
        { status: 400 }
      );
    }

    const verificationSession = await createVerificationSession({
      profileId: profile.id,
      email: user.email,
    });

    const lastReport = verificationSession.last_verification_report;
    const lastReportId =
      typeof lastReport === 'string' ? lastReport : (lastReport?.id ?? null);

    const updatePayload = {
      verification_status: nextProfileStatusForSession(verificationSession),
      verification_attempts: profile.verification_attempts + 1,
      stripe_session_id: verificationSession.id,
      stripe_verification_id: lastReportId,
      verification_initiated_at: new Date().toISOString(),
      verification_completed_at: null,
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profile.id)
      .select('verification_status')
      .single();

    if (updateError) {
      console.error('[identity/session] Failed to update profile', updateError);
      return NextResponse.json(
        { error: 'Failed to persist verification session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: verificationSession.id,
      clientSecret: verificationSession.client_secret,
      url: verificationSession.url,
      status: verificationSession.status,
    });
  } catch (error) {
    console.error('[identity/session] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
