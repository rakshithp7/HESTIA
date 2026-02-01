import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseSessionReportProps {
  roomId: string | null;
  peerUserId: string | null;
  chatMessages: any[]; // Replace 'any' with actual type if available/exported, e.g. ChatMessage
  // methods
  markUserBlocked?: (userId: string) => void;
  end?: () => void;
}

export function useSessionReport({ roomId, peerUserId, chatMessages, markUserBlocked, end }: UseSessionReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleReason = useCallback((reason: string) => {
    setReasons((prev) => (prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason]));
  }, []);

  const reset = useCallback(() => {
    setReasons([]);
    setNotes('');
    setIsSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        reset();
      }
    },
    [reset]
  );

  const submitReport = useCallback(async () => {
    if (!reasons.length || !roomId || !peerUserId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          reasons: reasons,
          notes: notes.trim(),
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
      handleOpenChange(false);
    } catch (error) {
      console.error('[useSessionReport] Failed to submit report', error);
      toast.error('We could not submit your report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [reasons, roomId, peerUserId, notes, chatMessages, markUserBlocked, end, handleOpenChange]);

  return {
    isOpen,
    openReport: () => setIsOpen(true),
    closeReport: () => handleOpenChange(false),
    onOpenChange: handleOpenChange,
    reasons,
    toggleReason,
    notes,
    setNotes,
    isSubmitting,
    submitReport,
  };
}
