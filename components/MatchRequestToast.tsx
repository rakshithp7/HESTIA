import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface MatchRequestToastProps {
  peerTopic: string;
  toastId: string | number;
  onAccept: () => void;
  onDismiss: () => void;
}

export function MatchRequestToast({
  peerTopic,
  toastId,
  onAccept,
  onDismiss,
}: MatchRequestToastProps) {
  const handleAccept = () => {
    onAccept();
    toast.dismiss(toastId);
  };

  const handleDismiss = () => {
    onDismiss();
    toast.dismiss(toastId);
  };

  return (
    <div
      className="relative overflow-hidden bg-accent border-border border rounded-xl p-4 shadow-lg flex flex-col justify-around min-w-[350px] min-h-[180px]"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Content */}
      <div className="flex flex-col gap-1 items-center">
        <div className="text-lg font-medium text-foreground">
          {peerTopic} wants to connect!
        </div>
        <div className="text-sm text-muted-foreground">
          They are suggested as a similar match.
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={handleDismiss} className="px-8">
          Dismiss
        </Button>
        <Button onClick={handleAccept} className="px-8">
          Connect
        </Button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-1 left-4 right-4 h-1">
        <div className="h-full w-full bg-primary/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary origin-left animate-toast-progress rounded-full" />
        </div>
      </div>
    </div>
  );
}
