import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/webrtc/useRTCSession';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { MessageInput } from './MessageInput';
import { cn } from '@/lib/utils';

interface ChatSectionProps {
  messages: ChatMessage[];
  isPeerTyping: boolean;
  isChatReady: boolean;
  onSendMessage: (text: string) => boolean;
  onTypingStart: () => void;
  onTypingStop: () => void;
  className?: string;
  compact?: boolean; // Compact mode for floating window
}

export function ChatSection({
  messages,
  isPeerTyping,
  isChatReady,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  className,
  compact = false,
}: ChatSectionProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  return (
    <div
      className={cn(
        'flex flex-col',
        compact
          ? 'h-full text-sm'
          : 'h-[calc(100vh-20rem)] md:h-[calc(100vh-14rem)]',
        className
      )}
    >
      {/* Connection status indicator */}
      {!isChatReady && (
        <div className="px-4 py-2 text-sm text-muted-foreground text-center border-b">
          Connecting chat...
        </div>
      )}

      {/* Messages */}
      <div
        className={cn(
          'flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40',
          compact ? 'px-2 py-2 space-y-2' : 'px-4 py-4'
        )}
      >
        {messages.length === 0 && isChatReady && (
          <div className="text-center text-muted-foreground py-8">
            <p>Start a conversation!</p>
            <p className="text-sm mt-1">Your messages will appear here</p>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} compact={compact} />
        ))}
        {isPeerTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        disabled={!isChatReady}
        compact={compact}
      />
    </div>
  );
}
