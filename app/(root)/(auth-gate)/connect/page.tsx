'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ConnectPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'voice' | 'chat' | null>(null);

  function onConnect() {
    if (mode === 'voice' && topic.trim().length > 0) {
      const params = new URLSearchParams({ topic: topic.trim() });
      router.push(`/connect/session?${params.toString()}`);
    }
  }

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-xl mt-24 text-center space-y-8">
        <h2 className="text-2xl md:text-4xl mb-8">What’s on your mind?</h2>
        <input
          type="text"
          placeholder="Type here..."
          className="w-3/4 rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <div className="mt-4 flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            aria-label="Call"
            className={`size-24 ${mode === 'voice' ? 'border-primary bg-primary/20' : ''}`}
            onClick={() => setMode('voice')}>
            <Phone className="size-10" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Chat"
            className={`size-24 ${mode === 'chat' ? 'border-primary bg-primary/20' : ''}`}
            onClick={() => setMode('chat')}>
            <MessageSquare className="size-10" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="mt-6"
          onClick={onConnect}
          disabled={!(mode === 'voice' && topic.trim().length > 0)}>
          Connect
        </Button>
      </div>
    </div>
  );
}
