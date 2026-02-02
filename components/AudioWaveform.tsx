'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  audioStream?: MediaStream | null;
  isActive: boolean;
  className?: string;
  barCount?: number;
  color?: string;
  muted?: boolean;
  soundThreshold?: number; // Threshold for sound detection
  compact?: boolean; // Compact mode for floating window
}

export default function AudioWaveform({
  audioStream,
  isActive,
  className,
  barCount: initialBarCount = 30,
  color = 'currentColor',
  muted = false,
  soundThreshold = 15, // Default threshold value
  compact = false,
}: AudioWaveformProps) {
  // Memoize bar count calculation
  const barCount = useMemo(
    () => (compact ? Math.floor(initialBarCount * 0.6) : initialBarCount),
    [compact, initialBarCount]
  );

  const [levels, setLevels] = useState<number[]>(() => Array(barCount).fill(5));
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Use refs to store reusable arrays (avoid allocations in hot path)
  const levelsBufferRef = useRef<number[]>(new Array(barCount).fill(5));
  const lastUpdateTimeRef = useRef<number>(0);

  // Track audio tracks count to detect changes
  const [audioTrackCount, setAudioTrackCount] = useState(0);

  // Update track count when stream changes or tracks are added/removed
  useEffect(() => {
    const updateTrackCount = () => {
      setAudioTrackCount(audioStream?.getAudioTracks().length || 0);
    };

    updateTrackCount();

    if (audioStream) {
      audioStream.addEventListener('addtrack', updateTrackCount);
      audioStream.addEventListener('removetrack', updateTrackCount);
    }

    return () => {
      if (audioStream) {
        audioStream.removeEventListener('addtrack', updateTrackCount);
        audioStream.removeEventListener('removetrack', updateTrackCount);
      }
    };
  }, [audioStream]);

  // Update buffer size when barCount changes
  useEffect(() => {
    levelsBufferRef.current = new Array(barCount).fill(5);
    setLevels(Array(barCount).fill(5));
  }, [barCount]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Set up audio analyzer when stream is available and has audio tracks
  useEffect(() => {
    if (!audioStream || !isActive || audioTrackCount === 0) {
      // Clean up visualization if stream becomes invalid/inactive
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Initialize AudioContext if not exists
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: new () => AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) return;

      try {
        const context = new AudioContextClass();
        audioContextRef.current = context;
        const analyzer = context.createAnalyser();
        analyzerRef.current = analyzer;
        analyzer.fftSize = 256;
      } catch (err) {
        console.error('Failed to create audio context:', err);
        return;
      }
    }

    const context = audioContextRef.current;
    const analyzer = analyzerRef.current;

    if (!context || !analyzer) return;

    // Resume context if suspended
    if (context.state === 'suspended') {
      context.resume().catch((err) => {
        console.error('Failed to resume audio context:', err);
      });
    }

    // Disconnect any existing source before creating a new one
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (err) {
        console.error('Error disconnecting previous source:', err);
      }
      sourceRef.current = null;
    }

    // Connect stream to analyzer
    try {
      const source = context.createMediaStreamSource(audioStream);
      source.connect(analyzer);
      sourceRef.current = source;
    } catch (err) {
      console.error('Error creating MediaStreamSource:', err);
      return;
    }

    // Reuse data array and levels buffer
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    const step = Math.floor(dataArray.length / barCount);
    const UPDATE_THROTTLE = 50; // Update UI every 50ms (~20fps) instead of 60fps

    const updateLevels = () => {
      if (!analyzer || !isActive) return;

      const now = performance.now();

      // If muted, show flat line (only update UI, not on every frame)
      if (muted) {
        if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
          // Only update if levels aren't already flat
          if (levelsBufferRef.current[0] !== 5) {
            for (let i = 0; i < barCount; i++) {
              levelsBufferRef.current[i] = 5;
            }
            setLevels([...levelsBufferRef.current]);
            lastUpdateTimeRef.current = now;
          }
        }
        animationRef.current = requestAnimationFrame(updateLevels);
        return;
      }

      analyzer.getByteFrequencyData(dataArray);

      // Optimized: Calculate average without creating intermediate array
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avgSoundLevel = sum / dataArray.length;
      const hasSoundActivity = avgSoundLevel > soundThreshold;

      // Reuse levels buffer instead of creating new array
      if (hasSoundActivity) {
        for (let i = 0; i < barCount; i++) {
          const start = i * step;
          let barSum = 0;
          for (let j = 0; j < step; j++) {
            barSum += dataArray[start + j] || 0;
          }
          const avg = barSum / step;
          levelsBufferRef.current[i] = Math.max(
            5,
            Math.min(100, (avg / 255) * 100)
          );
        }
      } else {
        for (let i = 0; i < barCount; i++) {
          levelsBufferRef.current[i] = 5;
        }
      }

      // Throttle state updates to reduce re-renders
      if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
        setLevels([...levelsBufferRef.current]);
        lastUpdateTimeRef.current = now;
      }

      animationRef.current = requestAnimationFrame(updateLevels);
    };

    animationRef.current = requestAnimationFrame(updateLevels);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    };
  }, [audioStream, isActive, barCount, muted, soundThreshold, audioTrackCount]);

  // When not active or when muted, show appropriate visualization
  useEffect(() => {
    if (!isActive || audioStream) return;

    let frame = 0;
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 50; // Update every 50ms for smoother idle animation

    const idleAnimation = (timestamp: number) => {
      frame++;

      // Throttle updates
      if (timestamp - lastUpdate < UPDATE_INTERVAL) {
        animationRef.current = requestAnimationFrame(idleAnimation);
        return;
      }
      lastUpdate = timestamp;

      // For muted state or inactive state, show flat line
      if (muted || !isActive) {
        // Only update once if already flat
        if (levelsBufferRef.current[0] !== 5) {
          for (let i = 0; i < barCount; i++) {
            levelsBufferRef.current[i] = 5;
          }
          setLevels([...levelsBufferRef.current]);
        }
      } else {
        // For idle state (not muted but no stream), show gentle waves
        for (let i = 0; i < barCount; i++) {
          const phase = (i / barCount) * Math.PI * 2;
          const time = frame * 0.05;
          const value =
            Math.sin(phase + time) * 10 +
            Math.sin(phase * 2.5 + time * 0.7) * 5;
          levelsBufferRef.current[i] = Math.max(5, Math.min(30, value + 15));
        }
        setLevels([...levelsBufferRef.current]);
      }

      animationRef.current = requestAnimationFrame(idleAnimation);
    };

    animationRef.current = requestAnimationFrame(idleAnimation);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioStream, barCount, muted]);

  return (
    <div
      className={cn(
        'flex items-end justify-center gap-[2px] w-full',
        compact ? 'h-6' : 'h-20',
        className
      )}
    >
      {levels.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-75 ease-out"
          style={{
            height: `${height}%`,
            backgroundColor: color,
            opacity: isActive ? 0.8 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
