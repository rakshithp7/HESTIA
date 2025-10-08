'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/types';
import { profileNeedsVerification } from '@/lib/verification';

const POLL_INTERVAL_MS = 5000;

export default function VerifyPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [polling, setPolling] = React.useState(false);

  const fetchProfile = React.useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (options.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('[verify] Failed to fetch user', userError);
        setError('Unable to load your account details. Please refresh and try again.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!user) {
        setError('You need to sign in to verify your identity.');
        setProfile(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

      if (profileError) {
        console.error('[verify] Failed to fetch profile', profileError);
        setError('We could not load your profile right now. Please try again shortly.');
      } else {
        setProfile(data);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [supabase]
  );

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  React.useEffect(() => {
    if (!polling) return;

    const interval = setInterval(() => {
      fetchProfile({ silent: true }).catch((err) => {
        console.error('[verify] Polling refresh failed', err);
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchProfile, polling]);

  React.useEffect(() => {
    if (!profileNeedsVerification(profile)) {
      setPolling(false);
    }
  }, [profile]);

  const handleStartVerification = React.useCallback(
    async (isRetry: boolean) => {
      setActionLoading(true);
      setError(null);

      try {
        const response = await fetch(isRetry ? '/api/identity/retry' : '/api/identity/session', {
          method: 'POST',
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = typeof body?.error === 'string' ? body.error : 'Could not start verification session.';
          setError(message);
          return;
        }

        const data: { url?: string | null } = await response.json();

        if (data.url) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
          setError('Session created but verification URL was not provided. Please contact support.');
        }

        await fetchProfile({ silent: true });
        setPolling(true);
      } catch (err) {
        console.error('[verify] Failed to start verification', err);
        setError('Something went wrong while starting verification. Please try again.');
      } finally {
        setActionLoading(false);
      }
    },
    [fetchProfile]
  );

  const needsVerification = profileNeedsVerification(profile);
  const currentStatus = profile?.verification_status ?? 'unverified';
  const attemptCount = profile?.verification_attempts ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-12 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center space-y-4">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <p className="text-lg">{error}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => fetchProfile()}>
              Try again
            </Button>
            <Button asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-6">
          <ShieldCheck className="mx-auto size-12 text-primary" />
          <div>
            <h1 className="text-3xl font-semibold">You’re verified!</h1>
            <p className="mt-3 text-foreground">
              Thanks for completing identity verification. You can now access the Connect experience.
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Button onClick={() => router.replace('/connect')}>Open Connect</Button>
            <Button variant="outline" onClick={() => router.replace('/')}>
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isRetryable = currentStatus === 'requires_input' || currentStatus === 'failed';
  const statusCopy = getStatusCopy(currentStatus);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl w-full space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-serif tracking-wide">Verify Your Identity</h1>
          <p className="text-foreground max-w-xl mx-auto">
            We partner with Stripe to securely confirm you meet our age and safety requirements. The process usually
            takes a few minutes and you’ll only need a valid photo ID and your camera.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-secondary-foreground">Current status</p>
              <p className="text-lg font-medium capitalize">{currentStatus.replace('_', ' ')}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => fetchProfile({ silent: true })} disabled={refreshing}>
              <RefreshCcw className={`size-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-muted-foreground">{statusCopy}</p>
          {attemptCount > 0 ? <p className="text-sm text-muted-foreground">Attempts so far: {attemptCount}</p> : null}
        </section>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-6 space-y-3">
            <p className="font-medium">What to expect</p>
            <ul className="list-disc list-inside text-sm text-foreground space-y-1">
              <li>Click “Start verification” to launch the secure Stripe Identity flow in a new tab.</li>
              <li>Have a government-issued ID ready and be prepared to take a live selfie.</li>
              <li>We’ll update your status automatically once Stripe completes the checks.</li>
            </ul>
          </div>

          <Button className="w-full" onClick={() => handleStartVerification(isRetryable)} disabled={actionLoading}>
            {actionLoading ? 'Starting…' : isRetryable ? 'Retry verification' : 'Start verification'}
          </Button>

          {polling ? (
            <p className="text-center text-sm text-foreground">
              Waiting for Stripe to finish… we’ll refresh your status automatically.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getStatusCopy(status: Profile['verification_status']) {
  switch (status) {
    case 'pending':
      return 'Stripe is reviewing your submission. This usually takes a few minutes—feel free to stay on this page.';
    case 'requires_input':
      return 'Stripe needs more information. Click retry to provide the requested details and finish verification.';
    case 'failed':
      return 'We could not confirm your identity. Retry the process with a clearer photo ID or reach out to support.';
    case 'verified':
      return 'You’re all set! Head back to the Connect experience.';
    default:
      return 'Let’s get you verified so you can access the Connect experience.';
  }
}
