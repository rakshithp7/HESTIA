'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const RESEND_COOLDOWNS = [60, 120, 300, 600];

function formatCooldown(seconds: number) {
  if (seconds <= 0) {
    return '';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

type AuthFormsProps = {
  initialMode?: 'signIn' | 'signUp';
};

export function AuthForms({ initialMode = 'signIn' }: AuthFormsProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [lastSignUpEmail, setLastSignUpEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<
    string | null
  >(null);
  const [resendStep, setResendStep] = useState(0);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const intervalId = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [resendCooldown]);

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(false);
    setResendError(null);
    setResendSuccessMessage(null);
    setEmailUnconfirmed(false);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      const lowerCaseMessage = (signInError.message || '').toLowerCase();
      const isEmailNotConfirmed =
        lowerCaseMessage.includes('email not confirmed') ||
        (lowerCaseMessage.includes('not confirmed') &&
          lowerCaseMessage.includes('email'));
      if (isEmailNotConfirmed) {
        setEmailUnconfirmed(true);
        setLastSignUpEmail(email);
        setError(
          'Please verify your email before signing in or resend the verification email below.'
        );
        return;
      }
      setEmailUnconfirmed(false);
      setError(signInError.message);
      return;
    }
    setEmailUnconfirmed(false);
    setLastSignUpEmail(null);
    setResendStep(0);
    setResendCooldown(0);
    router.refresh();
  }

  async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResendError(null);
    setResendSuccessMessage(null);
    setEmailUnconfirmed(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/age-verification`,
        data: { first_name: firstName, last_name: lastName },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setLastSignUpEmail(email);
    setResendCooldown(RESEND_COOLDOWNS[0]);
    setResendStep(RESEND_COOLDOWNS.length > 1 ? 1 : 0);

    // Reset the form fields
    form.reset();

    // Set success message and switch to sign in mode
    setSignUpSuccess(true);
    setMode('signIn');
  }

  async function onResendVerification() {
    if (!lastSignUpEmail || resendCooldown > 0 || resendLoading) return;
    setResendError(null);
    setResendSuccessMessage(null);
    setResendLoading(true);

    const { error: resendAttemptError } = await supabase.auth.resend({
      type: 'signup',
      email: lastSignUpEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/age-verification`,
      },
    });

    setResendLoading(false);

    if (resendAttemptError) {
      setResendError(resendAttemptError.message);
      return;
    }

    setResendSuccessMessage(
      'Verification email sent again. Please check your inbox.'
    );
    const cooldownIndex = Math.min(resendStep, RESEND_COOLDOWNS.length - 1);
    setResendCooldown(RESEND_COOLDOWNS[cooldownIndex]);
    setResendStep(Math.min(cooldownIndex + 1, RESEND_COOLDOWNS.length - 1));
  }

  return (
    <div className="mt-8 md:mt-16 flex items-start md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-5xl md:text-6xl tracking-widest uppercase mb-10">
          {mode === 'signUp' ? 'CREATE ACCOUNT' : 'SIGN IN TO CONNECT'}
        </h1>

        {mode === 'signUp' ? (
          <form
            key="signUp"
            className="mx-auto w-full max-w-xl space-y-6"
            onSubmit={onSignUp}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-base tracking-wide">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Enter your first name"
                  className="px-4 py-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-base tracking-wide">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Enter your last name"
                  className="px-4 py-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="px-4 py-2"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base tracking-wide">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                className="px-4 py-2"
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive -mt-2">{error}</p>
            ) : null}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? 'Creating account…' : 'Create my account'}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Button
                type="button"
                variant="link"
                className="underline-offset-4 px-0 h-auto"
                onClick={() => {
                  setMode('signIn');
                  setError(null);
                  setResendCooldown(0);
                  setResendError(null);
                  setResendSuccessMessage(null);
                  setLastSignUpEmail(null);
                  setResendStep(0);
                  setEmailUnconfirmed(false);
                  setResendLoading(false);
                }}
              >
                Sign in
              </Button>
            </div>
          </form>
        ) : (
          <form
            key="signIn"
            className="mx-auto w-full max-w-xl space-y-6"
            onSubmit={onSignIn}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="px-4 py-2"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base tracking-wide">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="px-4 py-2"
                required
              />
              <Link
                href="/forgot-password"
                className="text-base underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {error ? (
              <p className="text-sm text-destructive -mt-2">{error}</p>
            ) : null}
            {(signUpSuccess || emailUnconfirmed) && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  emailUnconfirmed && !signUpSuccess
                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                    : 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                }`}
              >
                <p
                  className={`font-medium ${
                    emailUnconfirmed && !signUpSuccess
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-green-800 dark:text-green-300'
                  }`}
                >
                  {signUpSuccess
                    ? 'Account created successfully!'
                    : 'Email not confirmed yet'}
                </p>
                <p
                  className={`mt-1 ${
                    emailUnconfirmed && !signUpSuccess
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-green-700 dark:text-green-400'
                  }`}
                >
                  {signUpSuccess
                    ? 'Please check your email to verify your account before signing in.'
                    : 'Verify your email before signing in, or resend the verification message below.'}
                </p>
                {lastSignUpEmail ? (
                  <div className="mt-3 space-y-2">
                    <p
                      className={
                        emailUnconfirmed && !signUpSuccess
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-green-700 dark:text-green-400'
                      }
                    >
                      Didn&apos;t receive an email? We sent it to{' '}
                      <span className="font-medium">{lastSignUpEmail}</span>.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onResendVerification}
                        disabled={resendCooldown > 0 || resendLoading}
                      >
                        {resendLoading
                          ? 'Resending…'
                          : 'Resend verification email'}
                      </Button>
                      {resendCooldown > 0 ? (
                        <span
                          className={
                            emailUnconfirmed && !signUpSuccess
                              ? 'text-sm text-amber-700 dark:text-amber-400'
                              : 'text-sm text-green-700 dark:text-green-400'
                          }
                        >
                          You can resend in {formatCooldown(resendCooldown)}.
                        </span>
                      ) : null}
                    </div>
                    {resendError ? (
                      <p className="text-sm text-destructive">{resendError}</p>
                    ) : null}
                    {resendSuccessMessage ? (
                      <p
                        className={
                          emailUnconfirmed && !signUpSuccess
                            ? 'text-sm text-amber-700 dark:text-amber-400'
                            : 'text-sm text-green-700 dark:text-green-400'
                        }
                      >
                        {resendSuccessMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? 'Signing In…' : 'Sign In'}
            </Button>

            <div className="text-center text-sm">
              New here?{' '}
              <Button
                type="button"
                variant="link"
                className="underline-offset-4 px-0 h-auto"
                onClick={() => {
                  setMode('signUp');
                  setError(null);
                  setSignUpSuccess(false);
                  setResendCooldown(0);
                  setResendError(null);
                  setResendSuccessMessage(null);
                  setLastSignUpEmail(null);
                  setResendStep(0);
                  setEmailUnconfirmed(false);
                  setResendLoading(false);
                }}
              >
                Create an account
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
