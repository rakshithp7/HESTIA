'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useRTCSession } from '@/lib/webrtc/useRTCSession';
import type { SessionMode } from '@/lib/webrtc/useRTCSession';

interface SessionConfig {
  topic: string;
  mode: SessionMode;
}

interface RTCSessionContextValue {
  // Session configuration
  sessionConfig: SessionConfig | null;
  isSessionActive: boolean;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;

  // Session control
  startSession: (topic: string, mode: SessionMode) => void;
  endSession: () => void;

  // RTC Session hook data (only available when session is active)
  rtcSession: ReturnType<typeof useRTCSession> | null;
}

const RTCSessionContext = createContext<RTCSessionContextValue | null>(null);

export function useRTCSessionContext() {
  const context = useContext(RTCSessionContext);
  if (!context) {
    throw new Error(
      'useRTCSessionContext must be used within RTCSessionProvider'
    );
  }
  return context;
}

// Hook that can be used without throwing error (returns null if no provider)
export function useOptionalRTCSession() {
  return useContext(RTCSessionContext);
}

interface RTCSessionProviderProps {
  children: React.ReactNode;
}

export function RTCSessionProvider({ children }: RTCSessionProviderProps) {
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(
    null
  );
  const [isMinimized, setIsMinimized] = useState(false);

  // ALWAYS call useRTCSession to avoid hook order violations
  // Use empty string for topic when no session (hook will handle it gracefully)
  const rtcSession = useRTCSession({
    topic: sessionConfig?.topic || '',
    mode: sessionConfig?.mode || 'chat',
  });

  const startSession = useCallback((topic: string, mode: SessionMode) => {
    console.log('[RTCSessionProvider] Starting session:', { topic, mode });
    setSessionConfig({ topic, mode });
    setIsMinimized(false);
  }, []);

  const endSession = useCallback(() => {
    console.log('[RTCSessionProvider] Ending session');
    // Call the RTC session's end method if available
    if (rtcSession?.end) {
      rtcSession.end();
    }
    setSessionConfig(null);
    setIsMinimized(false);
  }, [rtcSession]);

  // Auto-end session if RTC status becomes 'ended'
  useEffect(() => {
    if (rtcSession?.status === 'ended' && sessionConfig) {
      console.log('[RTCSessionProvider] RTC session ended, cleaning up');
      setSessionConfig(null);
      setIsMinimized(false);
    }
  }, [rtcSession?.status, sessionConfig]);

  const value: RTCSessionContextValue = {
    sessionConfig,
    isSessionActive: sessionConfig !== null,
    isMinimized,
    setIsMinimized,
    startSession,
    endSession,
    // Only provide rtcSession when we have an active session config
    rtcSession: sessionConfig ? rtcSession : null,
  };

  return (
    <RTCSessionContext.Provider value={value}>
      {children}
    </RTCSessionContext.Provider>
  );
}
