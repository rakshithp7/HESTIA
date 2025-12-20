'use client';
import React from 'react';
import { MicOff, Loader2, Mic, Phone, MessageSquare, XSquare, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import AudioWaveform from '@/components/AudioWaveform';
import { ChatSection } from '@/components/chat/ChatSection';
import { useRTCSessionContext } from '@/lib/rtc-session-context';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ActiveUserBan, Profile } from '@/lib/supabase/types';
import { profileNeedsVerification } from '@/lib/verification';
import { toast } from 'sonner';
import { getBanRemainingSeconds } from '@/lib/moderation/bans';

import { useGlobalPresence } from '@/hooks/use-global-presence';

const REPORT_REASONS = [
  'Inappropriate behavior',
  'Harassment or bullying',
  'Hate speech',
  'Spam or self-promotion',
  'Safety concern',
] as const;

export default function ConnectSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');
  const rtcHook = useRTCSessionContext();
  const {
    status,
    mode,
    roomId,
    peerUserId,
    muted,
    setMuted,
    setAudioElementRef,
    micReady,
    micPermissionChecked,
    requestLocalAudio,
    localStream,
    remoteStream,
    // Chat functionality
    chatMessages,
    isPeerTyping,
    isChatReady,
    sendChatMessage,
    sendTypingStart,
    sendTypingStop,
    end,
    markUserBlocked,
  } = rtcHook;

  // Track global presence
  useGlobalPresence({
    status: 'active',
    topic: topic || undefined,
  });

  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [activeBan, setActiveBan] = React.useState<ActiveUserBan | null>(null);
  const [banLoading, setBanLoading] = React.useState(true);
  const [banError, setBanError] = React.useState<string | null>(null);

  const isChatMode = mode === 'chat';
  const isMatching = status === 'idle' || status === 'waiting' || status === 'connecting';
  const [mobilePanel, setMobilePanel] = React.useState<'voice' | 'chat'>(isChatMode ? 'chat' : 'voice');
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [reportReasons, setReportReasons] = React.useState<string[]>([]);
  const [reportNotes, setReportNotes] = React.useState('');
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);

  const handleToggleReportReason = React.useCallback((reason: string) => {
    setReportReasons((prev) => (prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason]));
  }, []);

  const resetReportState = React.useCallback(() => {
    setReportReasons([]);
    setReportNotes('');
    setIsSubmittingReport(false);
  }, []);

  const handleReportDialogChange = React.useCallback(
    (open: boolean) => {
      setIsReportOpen(open);
      if (!open) {
        resetReportState();
      }
    },
    [resetReportState]
  );

  const fetchProfile = React.useCallback(
    async (id: string, options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setProfileLoading(true);
      }
      setProfileError(null);

      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single<Profile>();

        if (error) {
          console.error('[connect/session] Failed to load profile', error);
          setProfileError('Unable to confirm your verification status. Please refresh.');
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('[connect/session] Unexpected profile fetch error', err);
        setProfileError('Unable to confirm your verification status. Please refresh.');
      } finally {
        if (!options.silent) {
          setProfileLoading(false);
        }
      }
    },
    [supabase]
  );

  React.useEffect(() => {
    setMobilePanel(isChatMode ? 'chat' : 'voice');
  }, [isChatMode]);

  React.useEffect(() => {
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
          console.error('[connect/session] Failed to resolve user', error);
          setProfileError('Unable to confirm your verification status. Please refresh.');
          setProfileLoading(false);
          return;
        }

        if (!user) {
          setProfileError('Your session has expired. Please sign in again.');
          setProfileLoading(false);
          router.replace('/connect');
          return;
        }

        setUserId(user.id);
        await fetchProfile(user.id);

        channel = supabase
          .channel(`profile-verification-${user.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            (payload) => {
              setProfile(payload.new as Profile);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.debug('[connect/session] Subscribed to profile verification updates');
            }
          });
      } catch (err) {
        console.error('[connect/session] Unexpected profile initialisation error', err);
        if (isMounted) {
          setProfileError('Unable to confirm your verification status. Please refresh.');
          setProfileLoading(false);
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

  const fetchActiveBan = React.useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setBanLoading(true);
      }
      setBanError(null);
      try {
        const response = await fetch('/api/me/ban');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to check ban status');
        }
        const payload = (await response.json()) as { ban: ActiveUserBan | null };
        setActiveBan(payload.ban ?? null);
      } catch (err) {
        console.error('[connect/session] Failed to load ban status', err);
        setBanError((err as Error).message);
      } finally {
        setBanLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!userId) return;
    void fetchActiveBan();
  }, [fetchActiveBan, userId]);

  const handleBanRetry = React.useCallback(() => {
    void fetchActiveBan();
  }, [fetchActiveBan]);

  const handleDisconnect = React.useCallback(() => {
    if (typeof end === 'function') {
      setIsDisconnecting(true);
      end();
      setTimeout(() => router.push('/connect'), 300);
    } else {
      router.push('/connect');
    }
  }, [end, router]);

  const handleReport = React.useCallback(() => {
    setIsReportOpen(true);
  }, []);

  const handleReportSubmit = React.useCallback(async () => {
    if (!reportReasons.length || !roomId || !peerUserId) {
      return;
    }

    setIsSubmittingReport(true);

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          reasons: reportReasons,
          notes: reportNotes.trim(),
          chatLog: chatMessages,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to submit report');
      }

      const { reportedUserId } = (await response.json().catch(() => ({}))) as { reportedUserId?: string };
      if (reportedUserId) {
        markUserBlocked?.(reportedUserId);
      } else {
        markUserBlocked?.(peerUserId);
      }

      if (typeof end === 'function') {
        end();
      }

      toast.success('Thanks for helping keep the community safe.');
      handleReportDialogChange(false);
    } catch (error) {
      console.error('[connect/session] Failed to submit report', error);
      toast.error('We could not submit your report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [chatMessages, end, handleReportDialogChange, markUserBlocked, peerUserId, reportNotes, reportReasons, roomId]);

  const handleRequestLocalAudio = React.useCallback(async () => {
    console.log('Requesting local audio from stable wrapper');
    try {
      return await requestLocalAudio();
    } catch (err) {
      console.error('Error in handleRequestLocalAudio:', err);
      return false;
    }
  }, [requestLocalAudio]);

  const handleProfileRetry = React.useCallback(async () => {
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

  if (profileLoading) {
    return <VerificationLoadingState />;
  }

  if (profileError) {
    return <VerificationErrorState message={profileError} onRetry={handleProfileRetry} />;
  }

  if (profileNeedsVerification(profile)) {
    return <VerificationBlockedState onGoToVerify={() => router.replace('/verify')} />;
  }

  if (banLoading) {
    return <BanLoadingState />;
  }

  if (banError) {
    return <BanErrorState message={banError} onRetry={handleBanRetry} />;
  }

  if (activeBan) {
    return <BannedState ban={activeBan} onRetry={handleBanRetry} />;
  }

  if (isDisconnecting) {
    return <DisconnectingState />;
  }

  if (status === 'ended' || status === 'media-error' || status === 'permission-denied' || status === 'no-mic') {
    return <SessionEndedState status={status} onExit={handleDisconnect} />;
  }

  if (isMatching) {
    return <MatchingState status={status} onCancel={handleDisconnect} />;
  }

  const hasVoiceSection = !isChatMode;
  const canSubmitReport = reportReasons.length > 0 && !!roomId && !!peerUserId;
  const isReportSubmitDisabled = isSubmittingReport || !canSubmitReport;

  return (
    <>
      <div className="flex screen-height flex-col gap-6 md:flex-row md:gap-8">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex h-full flex-1 flex-col gap-6 md:flex-row">
            {!isChatMode && (
              <div className={cn('h-full p-1 md:w-1/4', mobilePanel === 'voice' ? 'flex md:flex' : 'hidden md:flex')}>
                <VoiceSection
                  status={status}
                  muted={muted}
                  setMuted={setMuted}
                  setAudioElementRef={setAudioElementRef}
                  micReady={micReady}
                  micPermissionChecked={micPermissionChecked}
                  requestLocalAudio={handleRequestLocalAudio}
                  localStream={localStream}
                  remoteStream={remoteStream}
                />
              </div>
            )}

            <div
              className={cn(
                'flex min-h-0 h-full flex-1 flex-col rounded-xl bg-accent/40',
                isChatMode ? 'w-full' : 'md:w-3/4',
                !isChatMode && mobilePanel === 'voice' ? 'hidden md:flex' : 'flex md:flex'
              )}>
              <ChatSection
                messages={chatMessages}
                isPeerTyping={isPeerTyping}
                isChatReady={isChatReady}
                onSendMessage={sendChatMessage}
                onTypingStart={sendTypingStart}
                onTypingStop={sendTypingStop}
              />
            </div>
          </div>

          <MobileSessionActions
            isVisible={hasVoiceSection}
            mobilePanel={mobilePanel}
            setMobilePanel={setMobilePanel}
            onDisconnect={handleDisconnect}
            onReport={handleReport}
          />
          {!hasVoiceSection && <MobileChatOnlyActions onDisconnect={handleDisconnect} onReport={handleReport} />}
        </div>

        <DesktopActions onDisconnect={handleDisconnect} onReport={handleReport} />
      </div>

      <Dialog open={isReportOpen} onOpenChange={handleReportDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this conversation</DialogTitle>
            <DialogDescription>
              Select everything that applies. We will end this session and match you with someone new.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {REPORT_REASONS.map((reason) => {
              const checked = reportReasons.includes(reason);
              return (
                <label key={reason} className="flex items-center gap-3 rounded-lg p-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => handleToggleReportReason(reason)}
                    aria-label={reason}
                  />
                  <span className="text-sm leading-tight">{reason}</span>
                </label>
              );
            })}
          </div>
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Additional details</span>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Textarea
              value={reportNotes}
              onChange={(event) => setReportNotes(event.target.value)}
              placeholder="Share anything else that might help our safety team review this conversation."
              maxLength={500}
              aria-label="Additional report details"
            />
            <p className="text-xs text-muted-foreground text-right">{reportNotes.length}/500</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleReportDialogChange(false)}
              disabled={isSubmittingReport}>
              Cancel
            </Button>
            <Button type="button" onClick={handleReportSubmit} disabled={isReportSubmitDisabled}>
              {isSubmittingReport ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VerificationLoadingState() {
  return (
    <div className="flex h-full w-full items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking your verification status…</p>
      </div>
    </div>
  );
}

function VerificationErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <ShieldAlert className="mx-auto size-12 text-destructive" />
        <p className="text-base text-muted-foreground">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}

function BanLoadingState() {
  return (
    <div className="flex h-full w-full items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking your moderation status…</p>
      </div>
    </div>
  );
}

function BanErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <ShieldAlert className="mx-auto size-12 text-destructive" />
        <p className="text-base text-muted-foreground">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}

function BannedState({ ban, onRetry }: { ban: ActiveUserBan; onRetry: () => void }) {
  const endDate = new Date(ban.ends_at);
  const remainingSeconds = getBanRemainingSeconds(ban);
  const remainingLabel =
    remainingSeconds !== null
      ? formatDuration(remainingSeconds)
      : `until ${endDate.toLocaleString()}`;

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12">
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <ShieldAlert className="mx-auto size-14 text-destructive" />
        <h2 className="text-2xl font-semibold">Access temporarily suspended</h2>
        <p className="text-muted-foreground">
          An administrator has paused your access {remainingSeconds !== null ? `for ${remainingLabel}` : remainingLabel}.
          You won’t be able to start new sessions until the ban expires.
        </p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <strong>Ends:</strong> {endDate.toLocaleString()}
          </p>
          {ban.reason && (
            <p>
              <strong>Reason:</strong> {ban.reason}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onRetry}>
            Check again
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function VerificationBlockedState({ onGoToVerify }: { onGoToVerify: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <ShieldAlert className="mx-auto size-14 text-amber-500" />
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Verification Required</h2>
          <p className="text-muted-foreground">
            We need to confirm your identity before you can continue in Connect. This protects the community and keeps
            conversations safe.
          </p>
        </div>
        <Button onClick={onGoToVerify}>Start verification</Button>
      </div>
    </div>
  );
}

function DisconnectingState() {
  return (
    <div className="flex h-full w-full items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Wrapping up your session…</p>
      </div>
    </div>
  );
}

function MatchingState({ status, onCancel }: { status: string; onCancel: () => void }) {
  const statusDescription = React.useMemo(() => {
    switch (status) {
      case 'waiting':
        return 'Waiting for someone to join the conversation';
      case 'connecting':
        return 'Connecting you with a new friend';
      default:
        return 'Finding the best possible match';
    }
  }, [status]);

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center py-12">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative h-36 w-36">
          <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-ping" />
          <div className="absolute inset-6 rounded-full border-2 border-primary/60 animate-ping [animation-delay:150ms]" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary/10" />
        </div>
        <div className="text-2xl font-semibold tracking-wide">Looking for a friend...</div>
        <p className="text-sm text-muted-foreground">{statusDescription}</p>
        <Button type="button" variant="outline" size="sm" className="mt-4 gap-2" onClick={onCancel}>
          <XSquare className="size-4" />
          <span>Cancel</span>
        </Button>
      </div>
    </div>
  );
}

function SessionEndedState({ status, onExit }: { status: string; onExit: () => void }) {
  const info = React.useMemo(() => {
    switch (status) {
      case 'media-error': return { title: 'Connection Failed', desc: 'We could not establish a media connection. This is likely a firewall or network issue.' };
      case 'permission-denied': return { title: 'Microphone Denied', desc: 'Please allow microphone access to use this feature.' };
      case 'no-mic': return { title: 'No Microphone', desc: 'We could not find a microphone on your device.' };
      default: return { title: 'Session Ended', desc: 'The connection has been closed.' };
    }
  }, [status]);

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center py-12">
      <div className="flex flex-col items-center gap-6 text-center max-w-md px-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-wide">{info.title}</h2>
          <p className="text-sm text-muted-foreground">{info.desc}</p>
        </div>
        <Button onClick={onExit} size="lg">
          Return to Home
        </Button>
      </div>
    </div>
  );
}

type MobilePanel = 'voice' | 'chat';

type ActionHandlers = {
  onDisconnect: () => void;
  onReport: () => void;
};

function MobileSessionActions({
  isVisible,
  mobilePanel,
  setMobilePanel,
  onDisconnect,
  onReport,
}: {
  isVisible: boolean;
  mobilePanel: MobilePanel;
  setMobilePanel: React.Dispatch<React.SetStateAction<MobilePanel>>;
} & ActionHandlers) {
  if (!isVisible) return null;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => setMobilePanel((prev) => (prev === 'voice' ? 'chat' : 'voice'))}
          aria-pressed={mobilePanel === 'chat'}>
          {mobilePanel === 'voice' ? <MessageSquare className="size-4" /> : <Phone className="size-4" />}
          <span className="text-sm font-medium">{mobilePanel === 'voice' ? 'Show Chat' : 'Show Audio'}</span>
        </Button>
        <Button type="button" size="sm" variant="destructive" className="flex-1 gap-2" onClick={onDisconnect}>
          <XSquare className="size-4" />
          <span className="text-sm font-semibold">Disconnect</span>
        </Button>
      </div>
      <Button type="button" variant="ghost" className="w-full gap-2 " onClick={onReport}>
        <AlertTriangle className="size-4" />
        <span className="text-sm font-mediumaccent">Report an Issue</span>
      </Button>
    </div>
  );
}

function MobileChatOnlyActions({ onDisconnect, onReport }: ActionHandlers) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <Button type="button" size="sm" variant="destructive" className="w-full gap-2" onClick={onDisconnect}>
        <XSquare className="size-4" />
        <span className="text-sm font-semibold">Disconnect</span>
      </Button>
      <Button type="button" variant="ghost" className="w-full gap-2" onClick={onReport}>
        <AlertTriangle className="size-4" />
        <span className="text-sm font-medium">Report an Issue</span>
      </Button>
    </div>
  );
}

function DesktopActions({ onDisconnect, onReport }: ActionHandlers) {
  return (
    <div className="hidden md:flex md:w-[80px] flex-col items-center gap-8 pt-6">
      <div className="flex flex-col items-center gap-4 justify-evenly h-full w-full">
        <Button
          variant="ghost"
          aria-label="End Session"
          className="flex flex-col h-fit w-[120px] p-4 bg-primary/10"
          onClick={onDisconnect}>
          <XSquare className="size-6 text-destructive" />
          <span className="text-base opacity-80 text-center leading-tight">End Session</span>
        </Button>
        <Button
          variant="ghost"
          aria-label="Report an Issue"
          className="flex flex-col h-fit w-[120px] p-4 bg-primary/10"
          onClick={onReport}>
          <AlertTriangle className="size-6" />
          <span className="text-base opacity-80 text-center leading-tight">Report an Issue</span>
        </Button>
      </div>
    </div>
  );
}

function VoiceSection({
  status,
  muted,
  setMuted,
  setAudioElementRef,
  micReady,
  micPermissionChecked,
  requestLocalAudio,
  localStream,
  remoteStream,
}: {
  status: string;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  setAudioElementRef: (el: HTMLAudioElement | null) => void;
  micReady: boolean;
  micPermissionChecked: boolean;
  requestLocalAudio: () => Promise<boolean>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}) {
  const getStatusInfo = () => {
    switch (status) {
      case 'waiting':
        return { text: 'Waiting...', icon: <Loader2 className="size-4 animate-spin" /> };
      case 'connecting':
        return { text: 'Connecting...', icon: <Loader2 className="size-4 animate-spin" /> };
      case 'connected':
        return { text: 'Connected', icon: null };
      case 'permission-denied':
        return { text: 'Mic denied', icon: null };
      case 'no-mic':
        return { text: 'No mic', icon: null };
      case 'media-error':
        return { text: 'Mic error', icon: null };
      case 'ended':
        return { text: 'Call ended', icon: null };
      default:
        return { text: 'Init...', icon: <Loader2 className="size-4 animate-spin" /> };
    }
  };

  const statusInfo = getStatusInfo();

  const getMicStatusInfo = () => {
    if (!micPermissionChecked) {
      return { text: 'Checking mic...', icon: <Loader2 className="size-4 animate-spin" /> };
    }
    switch (status) {
      case 'permission-denied':
        return { text: 'Mic access denied', icon: null };
      case 'no-mic':
        return { text: 'No mic detected', icon: null };
      default:
        return { text: 'Mic required', icon: null };
    }
  };

  const micStatusInfo = getMicStatusInfo();

  return (
    <div className="flex flex-col gap-4 h-full w-full">
      {/* Peer Voice Panel */}
      <div className="relative rounded-2xl border-2 border-secondary p-4 h-1/2">
        <div className="absolute left-2 top-2 text-xs opacity-70">Peer</div>
        <div className="flex flex-col items-center justify-center pt-6 h-full">
          {status === 'connected' ? (
            <AudioWaveform
              audioStream={remoteStream}
              isActive={status === 'connected'}
              color="var(--secondary)"
              className="mb-8 h-16"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              {statusInfo.icon}
              <div className="mt-2 text-sm">{statusInfo.text}</div>
            </div>
          )}
        </div>
        <audio ref={setAudioElementRef} autoPlay playsInline className="hidden" />
      </div>

      {/* Your Voice Panel */}
      <div className="relative rounded-2xl border-2 border-primary p-4 h-1/2">
        <div className="absolute right-2 top-2 text-xs opacity-70">You</div>
        <div className="flex flex-col items-center justify-center pt-6 h-full">
          {micReady ? (
            <>
              <AudioWaveform
                audioStream={localStream}
                isActive={micReady}
                muted={muted}
                color="var(--primary)"
                className="mb-4 h-16"
              />
              <div className="text-xs opacity-70 mb-4">{muted ? 'Muted' : 'Speaking'}</div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setMuted(!muted)}
                aria-label={muted ? 'Unmute' : 'Mute'}>
                <MicOff className="size-3" />
                <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              {micPermissionChecked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mb-2 gap-1"
                  onClick={() => requestLocalAudio().catch((err) => console.error('Error enabling microphone:', err))}>
                  <Mic className="size-3" />
                  <span className="text-xs">Enable Mic</span>
                </Button>
              )}
              <div className="flex flex-col items-center gap-2">
                {micStatusInfo.icon}
                <div className="text-xs opacity-70">{micStatusInfo.text}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
