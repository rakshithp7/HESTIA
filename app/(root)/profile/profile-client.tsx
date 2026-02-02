'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import VerificationStatus from '@/components/verification/VerificationStatus';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ProfileClientProps = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  initialSection?: string;
};

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile' },
  { id: 'verification', label: 'Verification Status' },
  { id: 'blocked', label: 'Blocked Users' },
] as const;

type NavItemId = (typeof NAV_ITEMS)[number]['id'];

type BlockedUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

export default function ProfileClient({
  email,
  firstName,
  lastName,
  initialSection,
}: ProfileClientProps) {
  const supabase = createSupabaseBrowserClient();

  const sanitizeSection = useCallback((section?: string): NavItemId => {
    const candidate = section as NavItemId | undefined;
    return candidate && NAV_ITEMS.some((item) => item.id === candidate)
      ? candidate
      : 'profile';
  }, []);

  const [activeSection, setActiveSection] = useState<NavItemId>(() =>
    sanitizeSection(initialSection)
  );
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const displayName =
    [firstName, lastName]
      .filter((part) => (part ?? '').trim().length > 0)
      .join(' ') ||
    email ||
    'Account';

  const fetchBlockedUsers = useCallback(async () => {
    setBlockedLoading(true);
    setBlockedError(null);
    try {
      const response = await fetch('/api/blocked');
      if (!response.ok) {
        throw new Error('Unable to load blocked users');
      }
      const data = (await response.json()) as { blockedUsers?: BlockedUser[] };
      setBlockedUsers(data.blockedUsers ?? []);
    } catch (err) {
      console.error('[profile] Failed to fetch blocked users', err);
      setBlockedError('Unable to load blocked users right now.');
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  useEffect(() => {
    setActiveSection(sanitizeSection(initialSection));
  }, [initialSection, sanitizeSection]);

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

  async function handleUnblock(userId: string) {
    setRemovingId(userId);
    try {
      const response = await fetch('/api/blocked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: userId }),
      });
      if (!response.ok) {
        throw new Error('Failed to unblock user');
      }
      setBlockedUsers((prev) => prev.filter((entry) => entry.id !== userId));
    } catch (err) {
      console.error('[profile] Failed to unblock user', err);
      setBlockedError('Unable to unblock that user. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  const renderBlockedUsers = () => {
    if (blockedLoading) {
      return (
        <div className="flex items-center gap-3 text-base text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading blocked users…</span>
        </div>
      );
    }

    if (blockedError) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-base text-destructive flex items-center justify-between">
          <span>{blockedError}</span>
          <Button size="sm" variant="ghost" onClick={() => fetchBlockedUsers()}>
            Retry
          </Button>
        </div>
      );
    }

    if (!blockedUsers.length) {
      return (
        <p className="text-base text-muted-foreground">
          You haven’t blocked anyone yet.
        </p>
      );
    }

    return (
      <ul className="space-y-3">
        {blockedUsers.map((blockedUser) => {
          const initials = [blockedUser.firstName, blockedUser.lastName]
            .filter((part) => (part ?? '').trim().length > 0)
            .map((part) => (part ?? '').trim().charAt(0).toUpperCase())
            .join('');
          const label = initials || 'Blocked user';

          return (
            <li
              key={blockedUser.id}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-3 py-2"
            >
              <div>
                <p className="text-base font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">
                  User ID: <span className="font-mono">{blockedUser.id}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={removingId === blockedUser.id}
                onClick={() => handleUnblock(blockedUser.id)}
              >
                {removingId === blockedUser.id ? 'Removing…' : 'Unblock'}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-5xl space-y-8 text-foreground">
        <header className="space-y-2">
          <p className="text-lg uppercase tracking-[0.15em] text-foreground">
            Account
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Welcome back, {displayName}
          </h1>
          <p className="text-base text-foreground">
            Manage your password and review your verification status.
          </p>
        </header>

        <div className="md:hidden">
          <Select
            value={activeSection}
            onValueChange={(value) => setActiveSection(value as NavItemId)}
          >
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

        <div className="flex flex-col md:flex-row gap-4">
          <aside className="hidden md:block md:w-64">
            <nav className="rounded-2xl border border-border/70 bg-card/20 p-4 shadow-sm text-foreground">
              <ul className="space-y-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'w-full justify-start rounded-lg px-3 py-2 text-base font-semibold transition-all text-left h-12',
                          isActive
                            ? 'bg-primary/80 text-primary-foreground shadow-sm ring-1 ring-border/60'
                            : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                        )}
                      >
                        {item.label}
                      </Button>
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
                  <p className="text-base text-foreground">
                    Update your password to keep your account protected.
                  </p>
                </div>

                <form
                  onSubmit={handlePasswordChange}
                  className="space-y-4 max-w-xl"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-password"
                      className="text-base font-medium text-foreground"
                    >
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
                  {error ? (
                    <p className="text-base text-destructive">{error}</p>
                  ) : null}
                  {success ? (
                    <p className="text-base text-emerald-600 dark:text-emerald-400">
                      {success}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating…' : 'Update password'}
                  </Button>
                </form>
              </section>
            ) : null}

            {activeSection === 'verification' ? (
              <section className="space-y-6 rounded-2xl border border-border/60 bg-card/20 p-6 shadow-sm text-foreground">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">
                    Verification status
                  </h2>
                  <p className="text-base text-foreground">
                    View your current status or resume the Stripe Identity flow.
                  </p>
                </div>
                <VerificationStatus variant="embedded" />
              </section>
            ) : null}

            {activeSection === 'blocked' ? (
              <section className="space-y-6 rounded-2xl border border-border/60 bg-card/20 p-6 shadow-sm text-foreground">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Blocked users</h2>
                  <p className="text-base text-foreground">
                    Manage the people you’ve blocked. Removing someone allows
                    the matching system to pair you again.
                  </p>
                </div>
                {renderBlockedUsers()}
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
