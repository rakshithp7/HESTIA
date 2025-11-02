'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    setLoading(true);

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSentTo(email);
  }

  return (
    <div className="screen-height flex items-start md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-5xl md:text-6xl tracking-widest uppercase mb-10">RESET PASSWORD</h1>

        <form className="mx-auto w-full max-w-xl space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-lg tracking-wide">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              className="px-4 py-2 text-base"
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive -mt-2">{error}</p> : null}
          {sentTo ? (
            <p className="text-sm">Check your email ({sentTo}) for the reset link.</p>
          ) : (
            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
