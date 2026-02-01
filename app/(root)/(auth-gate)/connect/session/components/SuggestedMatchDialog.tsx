import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SuggestedMatchDialogProps {
  suggestedMatch: { topic: string; peerConsentedToMe: boolean } | null;
  onAccept?: () => Promise<void>;
  onReject?: () => void;
}

export function SuggestedMatchDialog({
  suggestedMatch,
  onAccept,
  onReject
}: SuggestedMatchDialogProps) {
  const [isAccepting, setIsAccepting] = useState(false);

  // Reset state when dialog closes or match changes
  useEffect(() => {
    if (!suggestedMatch) setIsAccepting(false);
  }, [suggestedMatch]);

  return (
    <Dialog
      open={!!suggestedMatch}
      onOpenChange={(open) => {
        if (!open) {
          setIsAccepting(false);
          onReject?.();
        }
      }}
    >
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>No perfect match found</DialogTitle>
          <DialogDescription asChild className="space-y-2">
            <div className="text-sm text-muted-foreground">
              <div>Hey we couldn&apos;t find you a great match... the closest topic we could find was &quot;<b>{suggestedMatch?.topic}</b>&quot;.</div>
              {suggestedMatch?.peerConsentedToMe && (
                <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 p-2 rounded-md">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </div>
                  Your peer wants to connect!
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onReject?.()} disabled={isAccepting}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setIsAccepting(true);
              await onAccept?.();
            }}
            disabled={isAccepting}
          >
            {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {suggestedMatch?.peerConsentedToMe ? "Accept & Connect" : (isAccepting ? "Waiting for peer..." : "Connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
