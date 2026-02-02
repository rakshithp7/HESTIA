'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import { PhoneCall } from '@/components/animate-ui/icons/phone-call';
import { MessageSquareMore } from '@/components/animate-ui/icons/message-square-more';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { useGlobalPresence } from '@/hooks/use-global-presence';
import { useRTCSessionContext } from '@/components/providers/RTCSessionProvider';

export default function ConnectPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'voice' | 'chat' | null>(null);
  const { startSession, isSessionActive, sessionConfig } =
    useRTCSessionContext();

  const { peersOnline } = useGlobalPresence({ status: 'idle' });

  // Redirect to active session if one exists
  useEffect(() => {
    if (isSessionActive && sessionConfig) {
      const params = new URLSearchParams({
        topic: sessionConfig.topic,
        mode: sessionConfig.mode,
      });
      router.replace(`/connect/session?${params.toString()}`);
    }
  }, [isSessionActive, sessionConfig, router]);

  function onConnect() {
    if (!mode || topic.trim().length === 0) return;

    // Start the global session
    startSession(topic.trim(), mode);

    // Navigate to session page
    const params = new URLSearchParams({
      topic: topic.trim(),
      mode,
    });

    router.push(`/connect/session?${params.toString()}`);
  }

  return (
    <div className="px-6 py-0 md:py-8 md:px-12">
      <div className="mx-auto max-w-xl mt-24 text-center space-y-8">
        <h2 className="text-3xl mb-8">What&apos;s on your mind?</h2>

        <div className="flex w-full flex-col items-center gap-2">
          <Input
            type="text"
            placeholder="Type here..."
            className="w-3/4 px-4 py-6 text-base"
            value={topic}
            maxLength={100}
            onChange={(e) => setTopic(e.target.value)}
          />
          <span className="w-3/4 text-right text-xs text-muted-foreground">
            {topic.length}/100
          </span>
        </div>

        <TooltipProvider>
          <div className="mt-4 flex items-center justify-center gap-4 md:gap-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Call"
                  className={`size-40 md:size-48 ${mode === 'voice' ? 'border-primary bg-primary/20' : ''}`}
                  onClick={() => setMode('voice')}
                >
                  {/* <PhoneCall className='size-20 md:size-24' animateOnHover /> */}
                  <AnimateIcon animateOnHover>
                    <PhoneCall className="size-20 md:size-24" />
                  </AnimateIcon>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-base">
                Start a voice & chat session
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Chat"
                  className={`size-40 md:size-48 ${mode === 'chat' ? 'border-primary bg-primary/20' : ''}`}
                  onClick={() => setMode('chat')}
                >
                  <AnimateIcon animateOnHover>
                    <MessageSquareMore className="size-20 md:size-24" />
                  </AnimateIcon>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-base">
                Start a chat only session
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <Button
          variant="outline_fill"
          size="2xl"
          className="mt-6"
          onClick={onConnect}
          disabled={!(mode && topic.trim().length > 0)}
        >
          Connect
        </Button>
      </div>

      <div className="flex items-center justify-center mt-12 gap-6 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
        <div className="flex items-center gap-2">
          <Users className="size-4" />
          <span>{peersOnline} online</span>
        </div>
        {/* <div className="flex items-center gap-2">
          <Globe className="size-4" />
          <span>{activeTopicCount} active topics</span>
        </div> */}
      </div>
    </div>
  );
}
