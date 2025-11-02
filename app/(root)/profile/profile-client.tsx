'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import VerificationStatus from '@/components/verification/VerificationStatus';
import { cn } from '@/lib/utils';

type ProfileClientProps = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile' },
  { id: 'verification', label: 'Verification Status' },
] as const;

type NavItemId = (typeof NAV_ITEMS)[number]['id'];

export default function ProfileClient({ email, firstName, lastName }: ProfileClientProps) {
  const supabase = createSupabaseBrowserClient();
  const [activeSection, setActiveSection] = useState<NavItemId>('profile');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const displayName =
    [firstName, lastName].filter((part) => (part ?? '').trim().length > 0).join(' ') || email || 'Account';

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword('');
    setSuccess('Password updated successfully.');
    setTimeout(() => setSuccess(null), 2500);
  }

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-5xl space-y-8 text-foreground">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.15em] text-foreground">Account</p>
          <h1 className="text-3xl md:text-4xl font-semibold">Welcome back, {displayName}</h1>
          <p className="text-foreground">Manage your password and review your verification status.</p>
        </header>

        <div className="md:hidden">
          <Select value={activeSection} onValueChange={(value) => setActiveSection(value as NavItemId)}>
            <SelectTrigger className="w-full justify-between h-12! text-foreground">
              <SelectValue placeholder="Choose section" />
            </SelectTrigger>
            <SelectContent>
              {NAV_ITEMS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <aside className="hidden md:block md:w-64">
            <nav className="rounded-2xl border border-border/70 bg-card/20 p-4 shadow-sm text-foreground">
              <ul className="space-y-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-sm font-semibold transition-all text-left',
                          isActive
                            ? 'bg-primary/80 text-primary-foreground shadow-sm ring-1 ring-border/60'
                            : 'text-foreground/70 hover:bg-background/60 hover:text-foreground'
                        )}>
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <main className="flex-1 space-y-8">
            {activeSection === 'profile' ? (
              <section className="space-y-6 rounded-2xl border border-border/60 bg-card/20 p-6 shadow-sm backdrop-blur text-foreground">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Security</h2>
                  <p className="text-sm text-foreground">Update your password to keep your account protected.</p>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium text-foreground">
                      New password
                    </Label>
                    <Input
                      id="new-password"
                      name="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter a new password"
                      className="bg-background/80 px-4 py-2 text-base text-foreground placeholder:text-foreground"
                      required
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating…' : 'Update password'}
                  </Button>
                </form>
              </section>
            ) : null}

            {activeSection === 'verification' ? (
              <section className="space-y-6 rounded-2xl border border-border/60 bg-card/20 p-6 shadow-sm text-foreground">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Verification status</h2>
                  <p className="text-sm text-foreground">
                    View your current status or resume the Stripe Identity flow.
                  </p>
                </div>
                <VerificationStatus variant="embedded" />
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
