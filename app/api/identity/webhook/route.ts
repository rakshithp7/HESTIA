import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import {
  constructIdentityWebhookEvent,
  retrieveSensitiveVerificationSession,
} from '@/lib/stripe/identity';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { nextProfileStatusForSession } from '@/lib/verification';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBody = await req.arrayBuffer();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Stripe signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructIdentityWebhookEvent(Buffer.from(rawBody), signature);
  } catch (error) {
    console.error('[identity/webhook] Signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'identity.verification_session.verified':
    case 'identity.verification_session.requires_input':
    case 'identity.verification_session.canceled':
    case 'identity.verification_session.processing': {
      const verificationSession = event.data
        .object as Stripe.Identity.VerificationSession;
      await handleVerificationSessionUpdate(verificationSession);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleVerificationSessionUpdate(
  session: Stripe.Identity.VerificationSession
) {
  const profileId = session.metadata?.profile_id;

  if (!profileId) {
    console.warn(
      '[identity/webhook] Verification session missing profile metadata',
      session.id
    );
    return;
  }

  const supabase = getSupabaseServiceClient();

  const verificationStatus = nextProfileStatusForSession(session);
  const isVerified = verificationStatus === 'verified';
  const isTerminal =
    session.status === 'verified' || session.status === 'canceled';

  const lastReport = session.last_verification_report;
  const lastReportId =
    typeof lastReport === 'string' ? lastReport : (lastReport?.id ?? null);

  const updatePayload: Record<string, unknown> = {
    verification_status: verificationStatus,
    verification_required: !isVerified,
    stripe_session_id: session.id,
    stripe_verification_id: lastReportId,
    verification_completed_at: isTerminal ? new Date().toISOString() : null,
  };

  if (isVerified) {
    try {
      const sensitiveSession = await retrieveSensitiveVerificationSession(
        session.id,
        {
          expand: ['verified_outputs.dob', 'last_verification_report.document'],
        }
      );
      const reportObject =
        typeof sensitiveSession.last_verification_report === 'object'
          ? sensitiveSession.last_verification_report
          : null;
      const dob =
        sensitiveSession.verified_outputs?.dob ?? reportObject?.document?.dob;
      if (dob?.day && dob?.month && dob?.year) {
        const dobIso = `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`;
        updatePayload.date_of_birth = dobIso;
      }
    } catch (error) {
      console.error(
        '[identity/webhook] Failed to retrieve sensitive verification session for DOB',
        {
          profileId,
          sessionId: session.id,
          error,
        }
      );
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', profileId);

  if (error) {
    console.error('[identity/webhook] Failed to update profile', {
      profileId,
      error,
    });
  }
}
