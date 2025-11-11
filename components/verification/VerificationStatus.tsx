'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/lib/supabase/types';
import { useVerificationStatus } from '@/lib/verification/useVerificationStatus';

type VerificationStatusProps = {
  variant?: 'page' | 'embedded';
};

export function VerificationStatus({ variant = 'embedded' }: VerificationStatusProps) {
  const router = useRouter();
  const {
    loading,
    refreshing,
    error,
    actionLoading,
    polling,
    needsVerification,
    currentStatus,
    attemptCount,
    verifiedAge,
    fetchProfile,
    handleStartVerification,
  } = useVerificationStatus();

  const isRetryable = currentStatus === 'requires_input' || currentStatus === 'failed';
  const statusCopy = getStatusCopy(currentStatus);

  if (loading) {
    if (variant === 'page') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="size-12 animate-spin" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-10 px-4">
        <Loader2 className="size-6 animate-spin text-foreground" />
      </div>
    );
  }

  if (error) {
    const content = (
      <div className="max-w-lg w-full text-center space-y-4">
        <ShieldAlert className="mx-auto size-10 text-destructive" />
        <p className="text-lg">{error}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => fetchProfile()}>
            Try again
          </Button>
          <Button asChild>
            <Link href="/connect">Sign in</Link>
          </Button>
        </div>
      </div>
    );

    if (variant === 'page') {
      return <div className="min-h-screen flex items-center justify-center px-6">{content}</div>;
    }
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center space-y-4">
        {content}
      </div>
    );
  }

  if (!needsVerification) {
    const message = (
      <div className="max-w-xl text-center space-y-6">
        <ShieldCheck className="mx-auto size-12 text-primary" />
        <div>
          <h1 className="text-3xl font-semibold text-primary">You’re verified!</h1>
          <p className="mt-3 text-foreground">
            Thanks for completing identity verification. You can now access the Connect experience.
          </p>
          {typeof verifiedAge === 'number' ? (
            <p className="mt-2 text-sm text-foreground">Age verified from ID: {verifiedAge}</p>
          ) : null}
        </div>
        <div className="flex justify-center gap-4 flex-wrap">
          <Button onClick={() => router.replace('/connect')}>Open Connect</Button>
          <Button variant="outline" onClick={() => router.replace('/')}>
            Go home
          </Button>
        </div>
      </div>
    );

    if (variant === 'page') {
      return <div className="screen-height flex items-center justify-center px-6">{message}</div>;
    }

    return (
      <div className="rounded-lg border border-border bg-card/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ShieldCheck className="size-10 text-primary flex-shrink-0 self-center sm:self-auto" />
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-primary">Identity verified</h2>
            <p className="text-sm text-foreground">
              You’re all set. Head back to the Connect experience to start matching with others.
            </p>
            {typeof verifiedAge === 'number' ? (
              <p className="text-sm text-foreground">Age verified from ID: {verifiedAge}</p>
            ) : null}
            <div className="flex gap-3 pt-2 flex-wrap justify-center sm:justify-start">
              <Button size="sm" onClick={() => router.replace('/connect')}>
                Open Connect
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusSection = (
    <section className="rounded-lg border border-border bg-card/60 p-6 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-sm uppercase tracking-wide text-secondary-foreground">Current status</p>
          <p className="text-lg font-medium capitalize">{currentStatus.replace('_', ' ')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchProfile({ silent: true })}
          disabled={refreshing}
          aria-label="Refresh status"
          className="mx-auto sm:mx-0">
          <RefreshCcw className={`size-5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-foreground">{statusCopy}</p>
      {attemptCount > 0 ? <p className="text-sm text-foreground">Attempts so far: {attemptCount}</p> : null}
    </section>
  );

  const expectations = (
    <div className="rounded-lg border border-dashed border-border p-6 space-y-3">
      <p className="font-medium text-center sm:text-left">What to expect</p>
      <ul className="list-disc list-inside text-sm text-foreground space-y-1 pl-4 sm:pl-6 text-left">
        <li>Click “Start verification” to launch the secure Stripe Identity flow in a new tab.</li>
        <li>Have a government-issued ID ready.</li>
        <li>We’ll update your status automatically once Stripe completes the checks.</li>
      </ul>
    </div>
  );

  const actionButton = (
    <Button className="w-full" onClick={() => handleStartVerification(isRetryable)} disabled={actionLoading}>
      {actionLoading ? 'Starting…' : isRetryable ? 'Retry verification' : 'Start verification'}
    </Button>
  );

  const pollingNotice = polling ? (
    <p className="text-center text-sm text-foreground">
      Waiting for Stripe to finish… we’ll refresh your status automatically.
    </p>
  ) : null;

  if (variant === 'page') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-3xl space-y-8">
          <header className="text-center space-y-3 px-2">
            <h1 className="text-3xl md:text-4xl font-serif tracking-wide">Verify Your Identity</h1>
            <p className="text-foreground max-w-xl mx-auto text-base sm:text-lg">
              We partner with Stripe to securely confirm you meet our age and safety requirements. The process usually
              takes a few minutes and you’ll only need a valid photo ID and your camera.
            </p>
          </header>

          {statusSection}

          <div className="space-y-4">
            {expectations}
            {actionButton}
            {pollingNotice}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statusSection}
      {expectations}
      {actionButton}
      {pollingNotice}
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

export default VerificationStatus;
