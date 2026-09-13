import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SuggestedMatch, RTCSessionConfig } from '../types';
import { MatchRequestToast } from '@/components/MatchRequestToast';
import { ensureQueued } from '../ensure-queued';

// Matchmaking Constants
const POLLING_INTERVAL_MS = 3000;
/**
 * How often the queue row's `updated_at` is refreshed.
 *
 * find_match ignores rows older than 15s and deletes them at 20s, so the old
 * 10s left a single late heartbeat able to make a member invisible. This runs
 * on its own timer rather than inside the poll: the poll holds a re-entrancy
 * guard that a hung request would never release, and the row must keep
 * breathing even when a poll is stuck.
 */
const HEARTBEAT_INTERVAL_MS = 5000;
/**
 * Consecutive failed upkeep attempts before the member is told. Below this a
 * blip is invisible to them; above it the row is about to be deleted and a
 * silent spinner would be a lie.
 */
const MAX_QUEUE_UPKEEP_FAILURES = 3;
const MATCH_THRESHOLD_START = 0.8;
const MATCH_THRESHOLD_MIN = 0.65;
const MATCH_THRESHOLD_DECAY_RATE = 0.01;
const MATCH_THRESHOLD_EPSILON = 0.001;

type UseMatchQueueProps = {
  currentUserId: string | null;
  config: RTCSessionConfig;
};

type UseMatchQueueResult = {
  status: 'idle' | 'waiting' | 'matched' | 'error'; // local status regarding queue
  activeQueueId: string | null;
  roomId: string | null;
  peerUserId: string | null;
  isInitiator: boolean;
  suggestedMatch: SuggestedMatch | null;
  enterQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  acceptSuggestedMatch: (
    overrideMatch?: { queueId: string },
    isResponse?: boolean
  ) => Promise<void>;
  rejectSuggestedMatch: () => Promise<void>;
  resetMatchState: () => void;
};

export function useMatchQueue({
  currentUserId,
  config,
}: UseMatchQueueProps): UseMatchQueueResult {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // State
  const [status, setStatus] = useState<
    'idle' | 'waiting' | 'matched' | 'error'
  >('idle');
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [suggestedMatch, setSuggestedMatch] = useState<SuggestedMatch | null>(
    null
  );

  // Refs for logic that needs latest state in intervals/callbacks
  const activeQueueIdRef = useRef<string | null>(null);
  const suggestedMatchRef = useRef<SuggestedMatch | null>(null);
  const myEmbeddingRef = useRef<number[] | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);
  const hasConsentedToQueueIdRef = useRef<string | null>(null);
  const upkeepFailuresRef = useRef(0);

  // Sync refs
  useEffect(() => {
    activeQueueIdRef.current = activeQueueId;
  }, [activeQueueId]);
  useEffect(() => {
    suggestedMatchRef.current = suggestedMatch;
  }, [suggestedMatch]);

  const resetMatchState = useCallback(() => {
    setStatus('idle');
    setActiveQueueId(null);
    setRoomId(null);
    setPeerUserId(null);
    setIsInitiator(false);
    setSuggestedMatch(null);
    hasConsentedToQueueIdRef.current = null;
    isPollingRef.current = false;
  }, []);

  const leaveQueue = useCallback(async () => {
    const queueId = activeQueueIdRef.current;
    if (!queueId) return;

    // Optimistic reset
    resetMatchState();

    try {
      await supabase.from('match_queue').delete().eq('id', queueId);
      // console.log('[RTC] Removed from match queue', queueId);
    } catch (err) {
      console.error('[RTC] Failed to remove from queue', err);
    }
  }, [supabase, resetMatchState]);

  const enterQueue = useCallback(async () => {
    if (!currentUserId || !config.topic) return;

    // reset state
    resetMatchState();
    setStatus('waiting');

    try {
      // 0. SELF-HEAL
      const { error: cleanupError } = await supabase
        .from('match_queue')
        .delete()
        .eq('user_id', currentUserId);

      if (cleanupError) {
        console.warn('[RTC] Cleanup warning:', cleanupError);
      }

      // 1. Get Embedding
      // If topic hasn't changed and we have embedding, we could cache, but safe to fetch.
      const embedRes = await fetch('/api/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: config.topic }),
      });
      if (!embedRes.ok) throw new Error('Failed to generate embedding');
      const { embedding } = await embedRes.json();
      myEmbeddingRef.current = embedding;

      startTimeRef.current = Date.now();

      // 2. Insert into Queue
      const { data, error } = await supabase
        .from('match_queue')
        .insert({
          user_id: currentUserId,
          topic: config.topic,
          topic_embedding: embedding,
          mode: config.mode,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;

      setActiveQueueId(data.id);
      // console.log('[RTC] Entered match queue', data.id);
    } catch (err) {
      console.error('[RTC] Queue entry failed', err);
      setStatus('error');
      toast.error('Failed to join matchmaking queue');
    }
  }, [currentUserId, config, supabase, resetMatchState]);

  // Helper to send signals
  const sendSignal = useCallback(
    (
      type: 'consent' | 'reject',
      targetQueueId: string,
      payload?: Record<string, unknown>
    ) => {
      if (!activeQueueId) return;
      const channel = supabase.channel(`queue:${targetQueueId}`);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type, fromQueueId: activeQueueId, ...payload },
          });
          setTimeout(() => {
            supabase.removeChannel(channel);
          }, 1000);
        }
      });
    },
    [supabase, activeQueueId]
  );

  const acceptSuggestedMatch = useCallback(
    async (overrideMatch?: { queueId: string }, isResponse = false) => {
      const target = overrideMatch || suggestedMatch;
      if (!target || !currentUserId || !activeQueueId) return;

      try {
        const { error: updateError } = await supabase
          .from('match_queue')
          .update({ consented_queue_id: target.queueId })
          .eq('id', activeQueueId);

        if (updateError) {
          console.error('[RTC] Failed to update consent in DB', updateError);
          toast.error('Failed to connect');
          return;
        }

        // console.log('[RTC] Consented to:', target.queueId);
        hasConsentedToQueueIdRef.current = target.queueId;

        const isPeerKnownConsented =
          suggestedMatch?.queueId === target.queueId &&
          suggestedMatch?.peerConsentedToMe;

        if (isResponse || isPeerKnownConsented) {
          toast.success('Match accepted! Connecting...');
        } else {
          toast.success('Waiting for peer to accept...');
        }

        sendSignal('consent', target.queueId, { topic: config.topic });
      } catch (err) {
        console.error('[RTC] Accept match error', err);
      }
    },
    [
      suggestedMatch,
      currentUserId,
      activeQueueId,
      supabase,
      config.topic,
      sendSignal,
    ]
  );

  const rejectSuggestedMatch = useCallback(async () => {
    if (!activeQueueId) return;
    try {
      await supabase
        .from('match_queue')
        .update({ consented_queue_id: null })
        .eq('id', activeQueueId);
      hasConsentedToQueueIdRef.current = null;

      if (suggestedMatch?.queueId) {
        sendSignal('reject', suggestedMatch.queueId);
      }

      setSuggestedMatch(null);
    } catch (e) {
      console.error(e);
    }
  }, [activeQueueId, suggestedMatch, supabase, sendSignal]);

  // Polling Logic
  useEffect(() => {
    if (status !== 'waiting' || !currentUserId || !activeQueueId) return;

    let cancelled = false;
    upkeepFailuresRef.current = 0;

    const interval = setInterval(async () => {
      if (!myEmbeddingRef.current || isPollingRef.current) return;

      isPollingRef.current = true;
      try {
        // Put the row back if it has already been removed. This has to happen
        // before find_match, which returns nothing at all when the caller has
        // no waiting row - that is how members ended up watching a search that
        // could never succeed.
        try {
          const { queueId, reinserted } = await ensureQueued(
            supabase,
            activeQueueId,
            {
              userId: currentUserId,
              topic: config.topic,
              mode: config.mode,
              embedding: myEmbeddingRef.current,
            }
          );
          upkeepFailuresRef.current = 0;

          if (reinserted) {
            // The member may have left, or re-queued on a new topic, while the
            // check above was in flight. Re-inserting then would leave a
            // waiting row nobody owns, which another member can be matched
            // into for up to 15s and then find empty.
            if (cancelled || activeQueueIdRef.current !== activeQueueId) {
              await supabase.from('match_queue').delete().eq('id', queueId);
              return;
            }

            console.warn('[RTC] Queue row had been dropped; re-joined');
            // The replacement row has no consent on it, and the peer's consent
            // points at the row that was deleted. Keeping the old belief would
            // show "peer accepted" for a pairing that can never complete.
            hasConsentedToQueueIdRef.current = null;
            setSuggestedMatch(null);
            setActiveQueueId(queueId);
            return;
          }
        } catch (err) {
          upkeepFailuresRef.current += 1;
          console.error('[RTC] Queue upkeep failed', err);
          if (upkeepFailuresRef.current >= MAX_QUEUE_UPKEEP_FAILURES) {
            setStatus('error');
            toast.error('Lost your place in the queue. Please try again.');
            return;
          }
        }

        if (cancelled) return;

        const elapsedSec =
          (Date.now() - (startTimeRef.current || Date.now())) / 1000;
        const decay = elapsedSec * MATCH_THRESHOLD_DECAY_RATE;
        const currentThreshold = Math.max(
          MATCH_THRESHOLD_MIN,
          MATCH_THRESHOLD_START - decay
        );

        // Identity, search vector, mode and blocks are all derived server-side
        // from auth.uid() and the caller's own queue row. The threshold is the
        // only input the client still supplies, and the RPC clamps it.
        const { data, error } = await supabase.rpc('find_match', {
          p_threshold: currentThreshold,
        });

        if (error) {
          console.error('[RTC] find_match RPC error', error);
        } else {
          const match = data && data[0];
          if (match && match.match_found) {
            // console.log('[RTC] Match found via RPC!', match);
            setIsInitiator(true);
            setRoomId(match.match_room_id);
            setPeerUserId(match.peer_user_id);
            setStatus('matched');
            setSuggestedMatch(null);
            return;
          }
        }

        // Suggestion Fallback
        if (currentThreshold <= MATCH_THRESHOLD_MIN + MATCH_THRESHOLD_EPSILON) {
          // The suggestion is built server-side: the browser is not allowed to
          // read other members' queue rows, and the minimum similarity is
          // enforced by /api/match/suggest.
          const response = await fetch('/api/match/suggest', {
            method: 'POST',
          });

          if (!response.ok) {
            console.error('[RTC] Suggestion request failed', response.status);
            return;
          }

          const { suggestion } = (await response.json()) as {
            suggestion: SuggestedMatch | null;
          };

          if (suggestion) {
            setSuggestedMatch((prev) => {
              const isSamePeer = prev?.queueId === suggestion.queueId;
              const effectiveConsent = isSamePeer
                ? prev?.peerConsentedToMe || suggestion.peerConsentedToMe
                : suggestion.peerConsentedToMe;

              if (
                isSamePeer &&
                prev?.peerConsentedToMe === effectiveConsent &&
                prev?.topic === suggestion.topic &&
                prev?.similarity === suggestion.similarity
              )
                return prev;

              return { ...suggestion, peerConsentedToMe: effectiveConsent };
            });
          }
        }
      } catch (err) {
        console.error('[RTC] Poll error', err);
      } finally {
        isPollingRef.current = false;
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, currentUserId, activeQueueId, supabase, config.topic, config.mode]);

  // Heartbeat, on its own timer.
  //
  // Deliberately not folded into the poll: the poll guards against re-entrancy
  // with a ref that is only released in a `finally`, so a request that never
  // settles would stop the row being refreshed and it would be deleted at 20s -
  // the very failure this file exists to prevent.
  useEffect(() => {
    if (!activeQueueId || status !== 'waiting') return;
    const interval = setInterval(async () => {
      const { error } = await supabase
        .from('match_queue')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeQueueId);
      if (error) console.error('[RTC] Heartbeat failed', error);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeQueueId, status, supabase]);

  // Realtime Listeners
  useEffect(() => {
    if (!activeQueueId || status !== 'waiting') return;
    const qId = activeQueueId;

    const channel = supabase
      .channel(`queue:${qId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_queue',
          filter: `id=eq.${qId}`,
        },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new as {
            status: string;
            room_id: string;
          };
          if (newRow.status === 'matched' && newRow.room_id) {
            // console.log('[RTC] Match found via Realtime!', newRow.room_id);
            setIsInitiator(false); // Passive
            setRoomId(newRow.room_id);
            // Wait, we need peerUserId. Ideally the row would have it or we fetch it?
            // The polling RPC returns peer_user_id. The table update probably doesn't have it easily unless we query room?
            // Actually, in the original code, the logic for passive match via Realtime DID NOT set peerUserId initially?
            // Checking original code: `updateRoomId(newRow.room_id); updateStatus('connecting');`
            // It seems it didn't strictly need peerUserId for connection if it just joins room.
            // BUT `peerUserId` is useful for UI.
            // We can fetch the room details or infer it.
            // For now, let's just transition status and let the Session orchestrator handle peer info if needed?
            // Or better, fetch it.
            setStatus('matched');
          }
        }
      )
      .on('broadcast', { event: 'signal' }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signal = (payload as any).payload as {
          type: string;
          fromQueueId: string;
          topic?: string;
        };
        if (signal?.type === 'consent') {
          const isActiveSuggestion =
            suggestedMatchRef.current?.queueId === signal.fromQueueId;

          if (hasConsentedToQueueIdRef.current === signal.fromQueueId) {
            toast.success('Peer accepted! Joining room...');
          } else if (!isActiveSuggestion) {
            // Toast logic...
            const peerTopic = signal.topic ? `"${signal.topic}"` : 'A peer';
            toast.custom(
              (t) => (
                <MatchRequestToast
                  peerTopic={peerTopic}
                  toastId={t}
                  onAccept={() => acceptSuggestedMatch({ queueId: signal.fromQueueId }, true)}
                  onDismiss={() => sendSignal('reject', signal.fromQueueId)}
                />
              ),
              { duration: 5000 }
            );
          }
          setSuggestedMatch((prev) =>
            prev ? { ...prev, peerConsentedToMe: true } : null
          );
        } else if (signal?.type === 'reject') {
          if (suggestedMatchRef.current?.queueId === signal.fromQueueId) {
            setSuggestedMatch(null);
          }
        }
      })
      .subscribe();

    // Monitor logic...
    // Simplification: We can keep the active logic here or in `useRTCSession`?
    // It's better here.
    let suggestedChannel: RealtimeChannel | null = null;
    if (suggestedMatch?.queueId) {
      suggestedChannel = supabase
        .channel(`watch-suggestion:${suggestedMatch.queueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'match_queue',
            filter: `id=eq.${suggestedMatch.queueId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setSuggestedMatch(null);
              toast.error('Match no longer available');
            } else if (payload.eventType === 'UPDATE') {
              const newState = payload.new as { status: string };
              if (newState.status !== 'waiting') {
                setSuggestedMatch(null);
                toast.error('Match no longer available');
              }
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (suggestedChannel) supabase.removeChannel(suggestedChannel);
    };
  }, [
    activeQueueId,
    status,
    supabase,
    suggestedMatch,
    acceptSuggestedMatch,
    sendSignal,
  ]);

  return {
    status,
    activeQueueId,
    roomId,
    peerUserId,
    isInitiator,
    suggestedMatch,
    enterQueue,
    leaveQueue,
    acceptSuggestedMatch,
    rejectSuggestedMatch,
    resetMatchState,
  };
}
