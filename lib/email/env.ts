/**
 * Email configuration is intentionally optional.
 *
 * `lib/env/server.ts` throws at module load for missing values, which is right
 * for Stripe and Supabase — the app cannot function without them. Email is
 * different: a checkout without a mail provider should still boot, and local
 * development should not require a Resend account. When these are unset the
 * senders in `lib/email/client.ts` fall back to logging.
 */
const optionalEnv = (key: string): string | null => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) return null;
  return value.trim();
};

export const emailEnv = {
  RESEND_API_KEY: optionalEnv('RESEND_API_KEY'),
  EMAIL_FROM: optionalEnv('EMAIL_FROM') ?? 'Hestia <onboarding@resend.dev>',
  MODERATION_ALERT_TO: optionalEnv('MODERATION_ALERT_TO'),
  CONTACT_INBOX_TO: optionalEnv('CONTACT_INBOX_TO'),
  SITE_URL: optionalEnv('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000',
};

export const isEmailConfigured = (): boolean =>
  Boolean(emailEnv.RESEND_API_KEY);
