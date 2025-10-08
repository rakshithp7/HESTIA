import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/types';

export default async function AgeVerificationPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let profile: Profile | null = null;

  if (session?.user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle<Profile>();
    if (!error) {
      profile = data;
    }
  }

  const status = profile?.verification_status ?? 'unverified';
  const needsAttention = status === 'requires_input' || status === 'failed';
  const isPending = status === 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-xl w-full p-8 text-center space-y-6">
        <h2 className="text-xl md:text-2xl font-serif tracking-wide">AGE VERIFICATION</h2>
        {needsAttention ? <AttentionBanner status={status} /> : isPending ? <PendingBanner /> : null}

        <div className="text-left text-base md:text-lg text-primary-dark space-y-4 font-serif">
          <p>Hi! Great to see you. We are so glad you have found us, and are excited to hear your story.</p>
          <p>
            Before you can chat with others, we ask that you verify your age with us (it&apos;s easy, I promise!)
            through uploading a photo ID.
          </p>
          <p>
            We want to make sure that all users are at least 16 years old, but also ensure that users are matched with
            chat buddies within their age group. Once you complete this step, you have the option to create an account
            and save your verification information. Otherwise, feel free to continue as a guest (though you will have to
            re-verify).
          </p>
        </div>
        <Button asChild variant="outline" className="hover:underline text-sm">
          <Link href="/verify">{needsAttention ? 'Resume verification' : 'Verify my age'}</Link>
        </Button>
      </div>
    </div>
  );
}

function AttentionBanner({ status }: { status: Profile['verification_status'] }) {
  const message =
    status === 'requires_input'
      ? 'We need a bit more information to confirm your age. Please resume verification below.'
      : 'The last verification attempt did not complete successfully. Try again with a clearer photo ID.';

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function PendingBanner() {
  return (
    <div className="rounded-md border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary-foreground">
      We&apos;re reviewing your latest submission. You&apos;ll receive an update shortly.
    </div>
  );
}
