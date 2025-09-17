'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(false);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.refresh();
  }

  async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

    // Reset the form fields
    form.reset();

    // Set success message and switch to sign in mode
    setSignUpSuccess(true);
    setMode('signIn');
  }

  return (
    <div className="mt-8 md:mt-16 flex items-start md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-5xl md:text-6xl tracking-widest uppercase mb-10">
          {mode === 'signUp' ? 'CREATE ACCOUNT' : 'SIGN IN TO CONNECT'}
        </h1>

        {mode === 'signUp' ? (
          <form className="mx-auto w-full max-w-xl space-y-6" onSubmit={onSignUp}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="block text-lg tracking-wide">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Enter your first name"
                  className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="block text-lg tracking-wide">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Enter your last name"
                  className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-lg tracking-wide">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-lg tracking-wide">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive -mt-2">{error}</p> : null}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? 'Creating account…' : 'Create my account'}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <button
                type="button"
                className="underline-offset-4 underline hover:cursor-pointer"
                onClick={() => {
                  setMode('signIn');
                  setError(null);
                }}>
                Sign in
              </button>
            </div>
          </form>
        ) : (
          <form className="mx-auto w-full max-w-xl space-y-6" onSubmit={onSignIn}>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-lg tracking-wide">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-lg tracking-wide">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              />
              <Link href="/forgot-password" className="text-base underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>

            {error ? <p className="text-sm text-destructive -mt-2">{error}</p> : null}
            {signUpSuccess && (
              <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-md p-3 text-sm">
                <p className="font-medium text-green-800 dark:text-green-300">Account created successfully!</p>
                <p className="text-green-700 dark:text-green-400 mt-1">
                  Please check your email to verify your account before signing in.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? 'Signing In…' : 'Sign In'}
            </Button>

            <div className="text-center text-sm">
              New here?{' '}
              <button
                type="button"
                className="underline-offset-4 underline hover:cursor-pointer"
                onClick={() => {
                  setMode('signUp');
                  setError(null);
                  setSignUpSuccess(false);
                }}>
                Create an account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
