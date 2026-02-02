'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/types';
import { profileNeedsVerification } from '@/lib/verification';

const POLL_INTERVAL_MS = 5000;

function getAgeFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function useVerificationStatus() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchProfile = useCallback(
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
        console.error('[verification] Failed to fetch user', userError);
        setError(
          'Unable to load your account details. Please refresh and try again.'
        );
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
        console.error('[verification] Failed to fetch profile', profileError);
        setError(
          'We could not load your profile right now. Please try again shortly.'
        );
      } else {
        setProfile(data);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await fetchProfile();
    })();
    return () => {
      active = false;
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(() => {
      fetchProfile({ silent: true }).catch((err) => {
        console.error('[verification] Polling refresh failed', err);
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchProfile, polling]);

  useEffect(() => {
    if (!profileNeedsVerification(profile)) {
      setPolling(false);
    }
  }, [profile]);

  const handleStartVerification = useCallback(
    async (isRetry: boolean) => {
      setActionLoading(true);
      setError(null);

      try {
        const response = await fetch(
          isRetry ? '/api/identity/retry' : '/api/identity/session',
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message =
            typeof body?.error === 'string'
              ? body.error
              : 'Could not start verification session.';
          setError(message);
          return;
        }

        const data: { url?: string | null } = await response.json();

        if (data.url) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
          setError(
            'Session created but verification URL was not provided. Please contact support.'
          );
        }

        await fetchProfile({ silent: true });
        setPolling(true);
      } catch (err) {
        console.error('[verification] Failed to start verification', err);
        setError(
          'Something went wrong while starting verification. Please try again.'
        );
      } finally {
        setActionLoading(false);
      }
    },
    [fetchProfile]
  );

  const needsVerification = profileNeedsVerification(profile);
  const currentStatus = profile?.verification_status ?? 'unverified';
  const attemptCount = profile?.verification_attempts ?? 0;
  const verifiedAge = useMemo(
    () => getAgeFromDob(profile?.date_of_birth ?? null),
    [profile?.date_of_birth]
  );

  return {
    profile,
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
    setError,
    setPolling,
  };
}
