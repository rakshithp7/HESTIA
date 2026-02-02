'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOptionalRTCSession } from '@/components/providers/RTCSessionProvider';

export function SessionTitleHandler() {
  const pathname = usePathname();
  const sessionContext = useOptionalRTCSession();

  const isConnected = sessionContext?.rtcSession?.status === 'connected';

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isConnected) {
      let isDotVisible = true;

      const blink = () => {
        const prefix = isDotVisible ? '❇️' : '⠀';
        document.title = `${prefix} Connected with a peer`;
        isDotVisible = !isDotVisible;
      };

      // Run immediately
      blink();

      // Blink every 1 second
      intervalId = setInterval(blink, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, pathname]);

  return null;
}
