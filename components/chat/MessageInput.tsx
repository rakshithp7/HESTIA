import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MessageInputProps {
  onSendMessage: (text: string) => boolean;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, onTypingStart, onTypingStop, disabled = false }: MessageInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [sendError, setSendError] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);

      // Clear send error when user starts typing again
      if (sendError) {
        setSendError(false);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // If we have text and weren't typing before, send typing start
      if (value.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart();
      }

      // Set timeout to stop typing indicator
      const timeout = setTimeout(() => {
        isTypingRef.current = false;
        onTypingStop();
      }, 3000); // Stop typing after 3 seconds of inactivity

      typingTimeoutRef.current = timeout;
    },
    [onTypingStart, onTypingStop, sendError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim() && !disabled) {
        // Stop typing indicator when sending
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        isTypingRef.current = false;
        onTypingStop();

        // Send message
        const success = onSendMessage(inputValue.trim());
        if (success) {
          setInputValue('');
          setSendError(false);
        } else {
          setSendError(true);
        }
      }
    },
    [inputValue, disabled, onSendMessage, onTypingStop]
  );

  return (
    <div className="flex-shrink-0 p-4">
      {sendError && (
        <div className="mb-2 text-sm text-destructive text-center">Failed to send message. Please try again.</div>
      )}
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center gap-2 rounded-full border px-5 py-3 ${
            sendError ? 'border-destructive bg-destructive/5' : 'bg-input'
          }`}>
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={disabled ? 'Connecting...' : 'Your message here...'}
            className="flex-1 border-0 bg-transparent dark:bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            disabled={disabled}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || disabled}
            variant="ghost"
            size="icon"
            className="opacity-80 disabled:opacity-40"
            aria-label="Send">
            ➤
          </Button>
        </div>
      </form>
    </div>
  );
}
