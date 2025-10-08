import Stripe from 'stripe';
import { serverEnv } from '@/lib/env/server';

const stripeClient = new Stripe(serverEnv.STRIPE_SECRET_KEY);

export type CreateVerificationSessionParams = {
  profileId: string;
  email?: string | null;
  metadata?: Record<string, string | undefined>;
};

export async function createVerificationSession({
  profileId,
  email,
  metadata = {},
}: CreateVerificationSessionParams): Promise<Stripe.Identity.VerificationSession> {
  const params: Stripe.Identity.VerificationSessionCreateParams = {
    client_reference_id: profileId,
    verification_flow: serverEnv.STRIPE_IDENTITY_FLOW_ID,
    metadata: {
      profile_id: profileId,
      ...(email ? { email } : {}),
      ...metadata,
    },
    return_url: serverEnv.STRIPE_IDENTITY_RETURN_URL,
  };

  if (email) {
    params.provided_details = { email };
  }

  return stripeClient.identity.verificationSessions.create(params);
}

export function constructIdentityWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  return stripeClient.webhooks.constructEvent(
    payload,
    signature,
    serverEnv.STRIPE_WEBHOOK_SECRET_IDENTITY
  );
}

export async function retrieveVerificationSession(
  verificationSessionId: string
): Promise<Stripe.Identity.VerificationSession> {
  return stripeClient.identity.verificationSessions.retrieve(verificationSessionId);
}

export async function retrieveVerificationReport(
  verificationReportId: string
): Promise<Stripe.Identity.VerificationReport> {
  return stripeClient.identity.verificationReports.retrieve(verificationReportId);
}
