'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, MessageSquare, Users } from 'lucide-react';
import { useGlobalPresence } from '@/hooks/use-global-presence';

export default function ConnectPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'voice' | 'chat' | null>(null);

  const { peersOnline } = useGlobalPresence({ status: 'idle' });

  function onConnect() {
    if (!mode || topic.trim().length === 0) return;

    const params = new URLSearchParams({
      topic: topic.trim(),
      mode,
    });

    router.push(`/connect/session?${params.toString()}`);
  }

  return (
    <div className="px-6 py-0 md:py-8 md:px-12">
      <div className="mx-auto max-w-xl mt-24 text-center space-y-8">
        <h2 className="text-3xl mb-8">What's on your mind?</h2>

        <Input
          type="text"
          placeholder="Type here..."
          className="w-3/4 px-4 py-6 text-base"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <TooltipProvider>
          <div className="mt-4 flex items-center justify-center gap-4 md:gap-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Call"
                  className={`size-40 md:size-48 ${mode === 'voice' ? 'border-primary bg-primary/20' : ''}`}
                  onClick={() => setMode('voice')}>
                  <Phone className="size-20 md:size-24" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-base'>Start a voice & chat session</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Chat"
                  className={`size-40 md:size-48 ${mode === 'chat' ? 'border-primary bg-primary/20' : ''}`}
                  onClick={() => setMode('chat')}>
                  <MessageSquare className="size-20 md:size-24" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className='text-base'>Start a chat only session</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <Button
          variant="outline_fill"
          size="2xl"
          className="mt-6"
          onClick={onConnect}
          disabled={!(mode && topic.trim().length > 0)}>
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
