import React from 'react';
import { ChatMessage } from '@/lib/webrtc/useRTCSession';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isFromMe = message.sender === 'me';

  return (
    <div className={isFromMe ? 'flex justify-end' : ''}>
      <div
        className={`w-fit max-w-xs rounded-2xl border-2 p-3 ${
          isFromMe ? 'border-foreground bg-foreground text-background' : 'border-primary/60 bg-card/40'
        }`}>
        {message.text}
      </div>
    </div>
  );
}
