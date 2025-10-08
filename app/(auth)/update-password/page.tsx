'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const password = String(formData.get('password') || '');

    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.replace('/connect'), 1200);
  }

  return (
    <div className="screen-height flex items-start md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-5xl md:text-6xl tracking-widest uppercase mb-10">SET NEW PASSWORD</h1>
        <form className="mx-auto w-full max-w-xl space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-lg tracking-wide">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter a new password"
              className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive -mt-2">{error}</p> : null}
          {success ? <p className="text-sm">Password updated. Redirecting…</p> : null}

          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
