import React from 'react';
import { User2 } from 'lucide-react';
import { ChatMessage } from '@/lib/webrtc/useRTCSession';

interface MessageBubbleProps {
  message: ChatMessage;
  compact?: boolean;
}

export function MessageBubble({
  message,
  compact = false,
}: MessageBubbleProps) {
  const isFromMe = message.sender === 'me';

  return (
    <div
      className={`flex w-full items-end gap-2 ${isFromMe ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
        <User2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <div
        className={`w-fit max-w-xs rounded-2xl border-2 p-3 ${compact ? 'text-sm' : 'text-base'} ${
          isFromMe
            ? 'border-foreground bg-foreground text-background'
            : 'border-primary/60 bg-card'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
