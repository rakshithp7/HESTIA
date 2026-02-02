import type Stripe from 'stripe';
import { Profile, ProfileVerificationStatus } from '@/lib/supabase/types';

const STRIPE_STATUS_MAP: Record<
  Stripe.Identity.VerificationSession.Status,
  ProfileVerificationStatus
> = {
  canceled: 'failed',
  processing: 'pending',
  requires_input: 'requires_input',
  verified: 'verified',
};

export function mapStripeStatus(
  status: Stripe.Identity.VerificationSession.Status
): ProfileVerificationStatus {
  return STRIPE_STATUS_MAP[status] ?? 'failed';
}

export function profileNeedsVerification(
  profile: Profile | null | undefined
): boolean {
  if (!profile) return true;
  if (profile.verification_required === false) return false;
  return profile.verification_status !== 'verified';
}

export function nextProfileStatusForSession(
  session: Stripe.Identity.VerificationSession
): ProfileVerificationStatus {
  return mapStripeStatus(session.status);
}
