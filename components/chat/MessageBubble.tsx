import React from 'react';
import { UserIcon } from 'lucide-react';
import { ChatMessage } from '@/lib/webrtc/useRTCSession';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isFromMe = message.sender === 'me';

  return (
    <div className={`flex w-full items-end gap-2 ${isFromMe ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
        <UserIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div
        className={`w-fit max-w-xs rounded-2xl border-2 p-3 text-base ${
          isFromMe ? 'border-foreground bg-foreground text-background' : 'border-primary/60 bg-card'
        }`}>
        {message.text}
      </div>
    </div>
  );
}
