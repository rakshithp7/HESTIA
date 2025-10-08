'use client';
import { createContext, useContext } from 'react';
import { useRTCSession } from '@/lib/webrtc/useRTCSession';

// Context for sharing RTC session data
export const RTCSessionContext = createContext<ReturnType<typeof useRTCSession> | null>(null);

export function useRTCSessionContext() {
  const context = useContext(RTCSessionContext);
  if (!context) {
    throw new Error('useRTCSessionContext must be used within RTCSessionProvider');
  }
  return context;
}
