import { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/types';
import { useRouter } from 'next/navigation';

export function useProfileVerification() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (id: string, options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single<Profile>();

        if (error) {
          console.error(
            '[useProfileVerification] Failed to load profile',
            error
          );
          setError(
            'Unable to confirm your verification status. Please refresh.'
          );
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error(
          '[useProfileVerification] Unexpected profile fetch error',
          err
        );
        setError('Unable to confirm your verification status. Please refresh.');
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [supabase]
  );

  const handleProfileRetry = useCallback(async () => {
    if (userId) {
      await fetchProfile(userId);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      await fetchProfile(user.id);
    }
  }, [fetchProfile, supabase, userId]);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const initialiseProfile = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error(
            '[useProfileVerification] Failed to resolve user',
            error
          );
          setError(
            'Unable to confirm your verification status. Please refresh.'
          );
          setLoading(false);
          return;
        }

        if (!user) {
          setError('Your session has expired. Please sign in again.');
          setLoading(false);
          router.replace('/connect');
          return;
        }

        setUserId(user.id);
        await fetchProfile(user.id);

        channel = supabase
          .channel(`profile-verification-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              setProfile(payload.new as Profile);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.debug(
                '[useProfileVerification] Subscribed to profile verification updates'
              );
            }
          });
      } catch (err) {
        console.error(
          '[useProfileVerification] Unexpected profile initialisation error',
          err
        );
        if (isMounted) {
          setError(
            'Unable to confirm your verification status. Please refresh.'
          );
          setLoading(false);
        }
      }
    };

    initialiseProfile();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchProfile, router, supabase]);

  return {
    profile,
    loading,
    error,
    userId,
    refetch: handleProfileRetry,
  };
}
