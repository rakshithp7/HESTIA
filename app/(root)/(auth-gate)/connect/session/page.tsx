'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Phone, MessageSquare, XSquare, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSection } from '@/components/chat/ChatSection';
import { useRTCSessionContext } from '@/lib/rtc-session-context';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ActiveUserBan } from '@/lib/supabase/types';
import { profileNeedsVerification } from '@/lib/verification';
import { getBanRemainingSeconds } from '@/lib/moderation/bans';
import { useGlobalPresence } from '@/hooks/use-global-presence';

import { useProfileVerification } from '@/hooks/use-profile-verification';
import { useBanCheck } from '@/hooks/use-ban-check';
import { useSessionReport } from '@/hooks/use-session-report';
import { VoiceSection } from './components/VoiceSection';
import { ReportDialog } from './components/ReportDialog';
import { SuggestedMatchDialog } from './components/SuggestedMatchDialog';

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
    suggestedMatch,
    rejectSuggestedMatch,
    acceptSuggestedMatch,
  } = rtcHook;

  // Track global presence
  useGlobalPresence({
    status: 'active',
    topic: topic || undefined,
  });

  const {
    profile,
    loading: profileLoading,
    error: profileError,
    userId,
    refetch: refetchProfile,
  } = useProfileVerification();

  const {
    activeBan,
    loading: banLoading,
    error: banError,
    refetch: refetchBan,
  } = useBanCheck(userId);

  const {
    isOpen: isReportOpen,
    openReport: handleReport,
    onOpenChange: handleReportDialogChange,
    reasons: reportReasons,
    toggleReason: handleToggleReportReason,
    notes: reportNotes,
    setNotes: setReportNotes,
    isSubmitting: isSubmittingReport,
    submitReport: handleReportSubmit,
  } = useSessionReport({
    roomId,
    peerUserId,
    chatMessages,
    markUserBlocked,
    end,
  });

  const isChatMode = mode === 'chat';
  const isMatching = status === 'idle' || status === 'waiting' || status === 'connecting';
  const [mobilePanel, setMobilePanel] = useState<'voice' | 'chat'>(isChatMode ? 'chat' : 'voice');
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    setMobilePanel(isChatMode ? 'chat' : 'voice');
  }, [isChatMode]);

  const handleDisconnect = useCallback(() => {
    if (typeof end === 'function') {
      setIsDisconnecting(true);
      end();
      setTimeout(() => router.push('/connect'), 300);
    } else {
      router.push('/connect');
    }
  }, [end, router]);

  const handleRequestLocalAudio = useCallback(async () => {
    console.log('Requesting local audio from stable wrapper');
    try {
      return await requestLocalAudio();
    } catch (err) {
      console.error('Error in handleRequestLocalAudio:', err);
      return false;
    }
  }, [requestLocalAudio]);

  if (profileLoading) {
    return <VerificationLoadingState />;
  }

  if (profileError) {
    return <VerificationErrorState message={profileError} onRetry={refetchProfile} />;
  }

  if (profileNeedsVerification(profile)) {
    return <VerificationBlockedState onGoToVerify={() => router.replace('/verify')} />;
  }

  if (banLoading) {
    return <BanLoadingState />;
  }

  if (banError) {
    return <BanErrorState message={banError} onRetry={refetchBan} />;
  }

  if (activeBan) {
    return <BannedState ban={activeBan} onRetry={refetchBan} />;
  }

  if (isDisconnecting) {
    return <DisconnectingState />;
  }

  if (status === 'ended' || status === 'media-error' || status === 'permission-denied' || status === 'no-mic') {
    return <SessionEndedState status={status} onExit={handleDisconnect} />;
  }

  if (isMatching) {
    return (
      <>
        <MatchingState status={status} onCancel={handleDisconnect} />
        {/* Suggested Match Fallback Dialog */}
        <SuggestedMatchDialog
          suggestedMatch={suggestedMatch}
          onAccept={acceptSuggestedMatch}
          onReject={() => {
            rejectSuggestedMatch();
            // Fix Bug 2: If I cancel/close the suggestion, I should be removed from the queue.
            handleDisconnect();
          }}
        />
      </>
    );
  }

  const hasVoiceSection = !isChatMode;

  return (
    <>
      <div className="flex screen-height flex-col gap-6 md:flex-row md:gap-8">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex h-full flex-1 flex-col gap-4 md:flex-row">
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
                'flex min-h-0 h-full flex-1 flex-col rounded-xl border-muted-foreground/20 border-2',
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

      <ReportDialog
        open={isReportOpen}
        onOpenChange={handleReportDialogChange}
        reasons={reportReasons}
        toggleReason={handleToggleReportReason}
        notes={reportNotes}
        setNotes={setReportNotes}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmittingReport}
      />
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
  const statusDescription = useMemo(() => {
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
  const info = useMemo(() => {
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
          variant="outline"
          aria-label="End Session"
          className="flex flex-col h-fit w-[120px] p-4 bg-primary/10"
          onClick={onDisconnect}>
          <XSquare className="size-6 text-destructive" />
          <span className="text-base opacity-80 text-center leading-tight whitespace-normal">End Session</span>
        </Button>
        <Button
          variant="outline"
          aria-label="Report an Issue"
          className="flex flex-col h-fit w-[120px] p-4 bg-primary/10"
          onClick={onReport}>
          <AlertTriangle className="size-6" />
          <span className="text-base opacity-80 text-center leading-tight whitespace-normal">Report an Issue</span>
        </Button>
      </div>
    </div>
  );
}