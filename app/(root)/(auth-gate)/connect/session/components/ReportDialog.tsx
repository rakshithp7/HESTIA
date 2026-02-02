import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const REPORT_REASONS = [
  'Inappropriate behavior',
  'Harassment or bullying',
  'Hate speech',
  'Spam or self-promotion',
  'Safety concern',
] as const;

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: string[];
  toggleReason: (reason: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function ReportDialog({
  open,
  onOpenChange,
  reasons,
  toggleReason,
  notes,
  setNotes,
  onSubmit,
  isSubmitting,
}: ReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this conversation</DialogTitle>
          <DialogDescription className="text-base">
            Select everything that applies. We will end this session and match
            you with someone new.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {REPORT_REASONS.map((reason) => {
            const checked = reasons.includes(reason);
            return (
              <label
                key={reason}
                className="flex items-center gap-3 rounded-lg p-1"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleReason(reason)}
                  aria-label={reason}
                />
                <span className="text-base leading-tight">{reason}</span>
              </label>
            );
          })}
        </div>
        <div className="space-y-2 pt-4">
          <div className="flex items-center justify-between text-base font-medium">
            <span>Additional details</span>
            <span className="text-sm text-muted-foreground">Optional</span>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Share anything else that might help our safety team review this conversation."
            maxLength={500}
            aria-label="Additional report details"
          />
          <p className="text-sm text-muted-foreground text-right">
            {notes.length}/500
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || reasons.length === 0}
          >
            {isSubmitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
