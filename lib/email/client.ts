import { Resend } from 'resend';
import { emailEnv, isEmailConfigured } from './env';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

let client: Resend | null = null;

const getClient = (): Resend | null => {
  if (!emailEnv.RESEND_API_KEY) return null;
  client ??= new Resend(emailEnv.RESEND_API_KEY);
  return client;
};

/**
 * Sends mail and never throws.
 *
 * Callers here are on paths where the email is secondary to work that has
 * already been committed — a moderation report is in the database before we
 * try to notify anyone. Surfacing a provider outage as an exception would
 * fail the request and lose the user's action, so failures are returned and
 * logged instead.
 */
export async function sendEmail(
  input: SendEmailInput,
  context: string
): Promise<SendEmailResult> {
  const resend = getClient();

  if (!resend) {
    console.warn(
      `[email:${context}] RESEND_API_KEY not set; email not sent.\n`,
      JSON.stringify({ to: input.to, subject: input.subject }, null, 2)
    );
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY not set' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: emailEnv.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    if (error) {
      console.error(`[email:${context}] Resend rejected the message`, error);
      return { ok: false, skipped: false, reason: error.message };
    }

    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    console.error(`[email:${context}] Unexpected error while sending`, error);
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { isEmailConfigured };
