'use client';
import React, { createContext, useContext } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Phone, AlertTriangle, XSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Create a context to share the end function
export const SessionContext = createContext<{ end?: () => void }>({});

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const topic = (params.get('topic') || '').toString();
  const isChat = pathname?.endsWith('/chat');

  // Get the end function from context if available
  const sessionContext = useContext(SessionContext);

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-6xl mt-4">
        {/* Topic Row */}
        <div className="mb-8 flex items-center gap-4">
          <div className="text-2xl">Conversation topic:</div>
          <p className="text-2xl font-bold">{topic}</p>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">{children}</div>

          {/* Right Actions */}
          <div className="pl-8 w-[84px] shrink-0 flex flex-col items-center justify-start gap-8 pt-6">
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                aria-label="End Session"
                className="flex w-[90px] h-[90px] flex-col items-center justify-center gap-1 hover:bg-accent/80"
                onClick={() => {
                  // Call end function if available (for voice sessions)
                  if (sessionContext.end && !isChat) {
                    sessionContext.end();
                    // Short delay to ensure the end message is sent
                    setTimeout(() => router.push('/connect'), 300);
                  } else {
                    // For chat or if end function not available
                    router.push('/connect');
                  }
                }}>
                <XSquare className="size-8 text-destructive" />
                <span className="text-[14px] opacity-80 text-center">End Session</span>
              </Button>
            </div>
            <div className="flex flex-col items-center gap-1">
              {isChat ? (
                <Button
                  variant="ghost"
                  aria-label="Switch to Call"
                  className="flex w-[90px] h-[90px] flex-col items-center justify-center gap-1 hover:bg-accent/80"
                  onClick={() => router.push(`/connect/session?topic=${encodeURIComponent(topic)}`)}>
                  <Phone className="size-8" />
                  <span className="text-[14px] opacity-80 text-center">Switch to Call</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  aria-label="Switch to Text"
                  className="flex w-[90px] h-[90px] flex-col items-center justify-center gap-1 hover:bg-accent/80"
                  onClick={() => router.push(`/connect/session/chat?topic=${encodeURIComponent(topic)}`)}>
                  <MessageSquare className="size-8" />
                  <span className="text-[14px] opacity-80 text-center">Switch to Text</span>
                </Button>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                aria-label="Report an Issue"
                className="flex w-[90px] h-[90px] flex-col items-center justify-center gap-1 hover:bg-accent/80"
                onClick={() => router.push(`/contact?topic=${encodeURIComponent(topic)}`)}>
                <AlertTriangle className="size-8" />
                <span className="text-[14px] opacity-80 text-center">Report an Issue</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
