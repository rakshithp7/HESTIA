import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Privacy | Hestia',
  description:
    'The terms for using Hestia, and what we do with your information.',
};

const LAST_UPDATED = '13 September 2026';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl md:text-2xl">{title}</h3>
      <div className="space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <div>
      <section className="bg-primary/70 text-primary-foreground px-6 py-10 md:px-12">
        <div className="max-w-8xl mx-auto">
          <h2 className="text-3xl md:text-5xl mb-4 drop-shadow-sm">
            Terms &amp; Privacy
          </h2>
          <p className="text-md md:text-lg leading-relaxed drop-shadow-sm">
            What you agree to by using Hestia, and what happens to your
            information.
          </p>
          <p className="mt-3 text-sm opacity-80 drop-shadow-sm">
            Last updated {LAST_UPDATED}
          </p>
        </div>
      </section>

      <div className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-3xl space-y-10">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-base leading-relaxed">
              <strong>Hestia is not an emergency service.</strong> Nobody here
              is a doctor, therapist or counsellor, and conversations are not
              watched as they happen. If you are in danger or thinking about
              harming yourself, contact your local emergency number or a crisis
              line now — some are listed on our{' '}
              <Link href="/resources" className="underline">
                resources page
              </Link>
              .
            </p>
          </div>

          <h2 className="text-2xl md:text-3xl">Terms of use</h2>

          <Section title="Who can use Hestia">
            <p>
              You must be 16 or older. We confirm your age from a
              government-issued photo ID before you can be matched with anyone.
            </p>
            <p>
              That date of birth places you in one of two groups: 16 to 17, or
              18 and over. <strong>The two are never matched together.</strong>{' '}
              Our systems enforce this; it does not rely on anyone being honest.
            </p>
            <p>
              One account per person. Do not create an account for someone else,
              lend yours out, or misrepresent your age.
            </p>
          </Section>

          <Section title="What Hestia is not">
            <p>
              Hestia is peer support — ordinary people listening to each other.
              It is not therapy, counselling, medical care or professional
              advice, and nobody you speak to is acting as a professional.
              Nothing here replaces care from a qualified person.
            </p>
          </Section>

          <Section title="How to behave here">
            <p>People come here at difficult moments. Do not:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>harass, threaten, bully or demean anyone</li>
              <li>
                encourage self-harm, suicide, disordered eating or substance
                misuse
              </li>
              <li>send sexual content or solicit anyone sexually</li>
              <li>
                ask for or share identifying details — yours or anyone
                else&apos;s
              </li>
              <li>record, screenshot or repost a conversation</li>
              <li>advertise, recruit or sell anything</li>
            </ul>
            <p>
              What someone tells you here is theirs, not yours to repeat
              elsewhere.
            </p>
          </Section>

          <Section title="Reports, blocks and bans">
            <p>
              You can block someone at any time; blocked members are never
              matched with you again. You can also report someone during or
              after a session.
            </p>
            <p>
              <strong>
                Filing a report saves the text of that chat and shares it with
                our moderators
              </strong>{' '}
              so they can see what happened. Voice calls are never recorded, so
              a report about a call carries only what you write in it.
            </p>
            <p>
              Moderators can suspend or permanently ban accounts. We may end
              your access at any time if you break these terms or put someone at
              risk.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              Hestia is free and provided as-is. We cannot promise it will
              always be available, that a match will be found, or that a
              conversation will help. We may change or withdraw features.
            </p>
          </Section>

          <h2 className="pt-4 text-2xl md:text-3xl">Privacy</h2>

          <Section title="What we hold">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Your email address</strong> — to sign you in and contact
                you.
              </li>
              <li>
                <strong>Your first and last name</strong> — typed by you when
                creating an account.
              </li>
              <li>
                <strong>Your date of birth</strong> — read from your ID during
                verification. This is what sets your age group.
              </li>
              <li>
                <strong>Verification status</strong> and the reference numbers
                Stripe gives us.
              </li>
              <li>
                <strong>The topic you type</strong> while waiting, and a
                mathematical representation of it used to find someone with a
                similar one. Both are removed when you leave the queue.
              </li>
              <li>
                <strong>Who you have blocked</strong>, and any bans on your
                account.
              </li>
              <li>
                <strong>Reports</strong> — the reasons, your notes, both
                members&apos; email addresses, and the chat text from that
                session.
              </li>
            </ul>
          </Section>

          <Section title="What we do not hold">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Your ID document.</strong> It goes to Stripe and never
                reaches us. We receive only your date of birth and whether the
                check passed.
              </li>
              <li>
                <strong>Voice conversations.</strong> Audio travels directly
                between the two of you and is never recorded.
              </li>
              <li>
                <strong>Chat messages</strong>, unless someone reports the
                session. Messages pass directly between you; they are only saved
                if a report is filed.
              </li>
            </ul>
          </Section>

          <Section title="Who else is involved">
            <p>Each provider receives only what it needs:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Supabase</strong> — accounts, database, live connections
              </li>
              <li>
                <strong>Stripe Identity</strong> — checks your ID, returns your
                date of birth
              </li>
              <li>
                <strong>Google</strong> — turns your topic into the
                representation used for matching
              </li>
              <li>
                <strong>Metered</strong> — relays calls when a direct connection
                fails
              </li>
              <li>
                <strong>Resend</strong> — sends our emails
              </li>
              <li>
                <strong>Netlify</strong> — hosts the site
              </li>
            </ul>
            <p>
              We do not sell your information and we do not use it for
              advertising.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Account details stay while your account exists. Queue topics are
              cleared as soon as you stop waiting. Reports and bans are kept
              while they are needed for safety — otherwise someone could erase
              their own history.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You can ask for a copy of what we hold, ask us to correct it, or
              ask us to delete your account. Write to us from the{' '}
              <Link href="/contact" className="underline">
                contact page
              </Link>
              .
            </p>
            <p>
              Deleting your account removes your profile. Reports involving you
              may be kept where they are still needed to protect other people.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If we change any of this in a way that matters, we will update the
              date at the top of this page.
            </p>
          </Section>

          <p className="border-t pt-6 text-base leading-relaxed">
            Questions? Reach us through the{' '}
            <Link href="/contact" className="underline">
              contact page
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
