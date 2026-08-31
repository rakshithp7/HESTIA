import { emailEnv } from './env';

export type EmailBody = { subject: string; html: string; text: string };

/** Report fields are user-supplied; escape before interpolating into HTML. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const layout = (heading: string, bodyHtml: string): string => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(heading)}</h1>
  ${bodyHtml}
  <p style="font-size:12px;color:#767676;margin-top:32px;border-top:1px solid #e5e5e5;padding-top:16px;">
    Sent by Hestia.
  </p>
</div>`;

const field = (label: string, value: string): string =>
  `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;

export type ModerationAlertInput = {
  reportId: string | null;
  roomId: string;
  topic: string | null;
  mode: string | null;
  reasons: string[];
  notes: string | null;
  reporterId: string;
  reportedId: string;
};

/**
 * Deliberately excludes the chat transcript. Session conversations stay in
 * Postgres behind admin auth rather than being copied into an inbox, a
 * forwarding chain, and the mail provider's logs.
 */
export function moderationAlert(input: ModerationAlertInput): EmailBody {
  const adminUrl = `${emailEnv.SITE_URL}/admin/reports`;
  const reasonList = input.reasons.join(', ');
  const subject = `[Hestia] New report: ${reasonList.slice(0, 60)}`;

  const html = layout(
    'A session was reported',
    [
      field('Reasons', reasonList),
      input.notes ? field('Notes', input.notes) : '',
      field('Topic', input.topic ?? 'unknown'),
      field('Mode', input.mode ?? 'unknown'),
      field('Room', input.roomId),
      field('Reporter ID', input.reporterId),
      field('Reported ID', input.reportedId),
      input.reportId ? field('Report ID', input.reportId) : '',
      `<p style="margin:24px 0 0;"><a href="${adminUrl}" style="background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Open moderation dashboard</a></p>`,
      `<p style="font-size:13px;color:#767676;margin-top:16px;">The chat transcript is not included in this email. View it in the dashboard.</p>`,
    ].join('\n')
  );

  const text = [
    'A session was reported.',
    '',
    `Reasons: ${reasonList}`,
    input.notes ? `Notes: ${input.notes}` : null,
    `Topic: ${input.topic ?? 'unknown'}`,
    `Mode: ${input.mode ?? 'unknown'}`,
    `Room: ${input.roomId}`,
    `Reporter ID: ${input.reporterId}`,
    `Reported ID: ${input.reportedId}`,
    input.reportId ? `Report ID: ${input.reportId}` : null,
    '',
    `Open the moderation dashboard: ${adminUrl}`,
    'The chat transcript is not included in this email.',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export type ContactSubmission = {
  name: string;
  email: string;
  message: string;
};

export function contactNotification(input: ContactSubmission): EmailBody {
  const subject = `[Hestia] Contact form: ${input.name || input.email}`;

  const html = layout(
    'New contact form submission',
    [
      field('Name', input.name || '(not provided)'),
      field('Email', input.email),
      `<p style="margin:16px 0 0;"><strong>Message</strong></p>`,
      `<p style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px;margin:8px 0 0;">${escapeHtml(input.message)}</p>`,
      `<p style="font-size:13px;color:#767676;margin-top:16px;">Reply directly to this email to respond to the sender.</p>`,
    ].join('\n')
  );

  const text = [
    'New contact form submission.',
    '',
    `Name: ${input.name || '(not provided)'}`,
    `Email: ${input.email}`,
    '',
    'Message:',
    input.message,
  ].join('\n');

  return { subject, html, text };
}

export function contactAcknowledgement(input: {
  name: string;
  message: string;
}): EmailBody {
  const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
  const subject = 'We received your message';

  const html = layout(
    'Thanks for reaching out',
    [
      `<p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>`,
      `<p style="margin:0 0 12px;">Your message reached the Hestia team and someone will read it. We usually reply within a few days.</p>`,
      `<p style="margin:0 0 8px;"><strong>What you sent us</strong></p>`,
      `<p style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px;margin:0 0 16px;">${escapeHtml(input.message)}</p>`,
      `<p style="margin:0;font-size:13px;color:#767676;">If you are in immediate danger or crisis, please contact your local emergency services or a crisis line right away &mdash; this inbox is not monitored around the clock.</p>`,
    ].join('\n')
  );

  const text = [
    greeting,
    '',
    'Your message reached the Hestia team and someone will read it. We usually reply within a few days.',
    '',
    'What you sent us:',
    input.message,
    '',
    'If you are in immediate danger or crisis, please contact your local emergency services or a crisis line right away - this inbox is not monitored around the clock.',
  ].join('\n');

  return { subject, html, text };
}
