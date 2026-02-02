'use client';
import React from 'react';
import { useRTCSessionContext } from '@/components/providers/RTCSessionProvider';

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionConfig } = useRTCSessionContext();

  // Get topic from the global session config
  const topic = sessionConfig?.topic || '';

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-9xl mt-4">
        {/* Topic Row */}
        {topic && (
          <div className="mb-8 flex items-center gap-4 whitespace-nowrap overflow-x-auto">
            <div className="text-lg">Conversation topic:</div>
            <p className="text-lg font-bold">{topic}</p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
