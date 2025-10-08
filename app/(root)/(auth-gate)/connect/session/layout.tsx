'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useRTCSession } from '@/lib/webrtc/useRTCSession';
import { RTCSessionContext } from '@/lib/rtc-session-context';

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const topic = (params.get('topic') || '').toString();
  const rawMode = (params.get('mode') || '').toString();
  const mode = rawMode === 'chat' ? 'chat' : 'voice';

  const rtcSession = useRTCSession({ topic, mode });

  return (
    <RTCSessionContext.Provider value={rtcSession}>
      <div className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-9xl mt-4">
          {/* Topic Row */}
          <div className="mb-8 flex items-center gap-4">
            <div className="text-2xl">Conversation topic:</div>
            <p className="text-2xl font-bold">{topic}</p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </div>
    </RTCSessionContext.Provider>
  );
}
