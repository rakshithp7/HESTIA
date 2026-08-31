import { NextResponse } from 'next/server';
import { isEmailConfigured, sendEmail } from '@/lib/email/client';
import { emailEnv } from '@/lib/email/env';
import {
  contactAcknowledgement,
  contactNotification,
} from '@/lib/email/templates';
import { clientIpFrom, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 5000;

const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
};

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export async function POST(req: Request) {
  try {
    const payload = (await req
      .json()
      .catch(() => null)) as ContactPayload | null;

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const name = asTrimmedString(payload.name);
    const email = asTrimmedString(payload.email);
    const message = asTrimmedString(payload.message);

    if (!message) {
      return NextResponse.json(
        { error: 'A message is required.' },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (
      name.length > MAX_NAME ||
      email.length > MAX_EMAIL ||
      message.length > MAX_MESSAGE
    ) {
      return NextResponse.json(
        { error: 'That submission is too long.' },
        { status: 400 }
      );
    }

    // Rate limit only well-formed submissions. Counting rejected ones would
    // let a couple of typos lock someone out of a form they are using to ask
    // for help, and a request that fails validation sends no mail anyway.
    const ip = clientIpFrom(req.headers);
    const limit = rateLimit(`contact:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        }
      );
    }

    // Never report success for a message we cannot actually deliver: a page
    // that says "we are here to listen" must not swallow what it is sent.
    if (!emailEnv.CONTACT_INBOX_TO || !isEmailConfigured()) {
      console.error(
        '[contact] Email is not configured (needs RESEND_API_KEY and CONTACT_INBOX_TO)'
      );
      return NextResponse.json(
        {
          error: 'Contact is temporarily unavailable. Please try again later.',
        },
        { status: 503 }
      );
    }

    const notification = contactNotification({ name, email, message });
    const delivery = await sendEmail(
      {
        to: emailEnv.CONTACT_INBOX_TO,
        subject: notification.subject,
        html: notification.html,
        text: notification.text,
        replyTo: email,
      },
      'contact-notification'
    );

    // The submitter is told the message landed only if it actually did.
    if (!delivery.ok) {
      return NextResponse.json(
        {
          error:
            'We could not deliver your message right now. Please try again later.',
        },
        { status: 502 }
      );
    }

    // Best effort: the team already has the message, so a failed receipt
    // must not turn a successful submission into an error for the user.
    const ack = contactAcknowledgement({ name, message });
    await sendEmail(
      {
        to: email,
        subject: ack.subject,
        html: ack.html,
        text: ack.text,
      },
      'contact-acknowledgement'
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[contact] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
