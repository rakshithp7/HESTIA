'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  audioStream?: MediaStream | null;
  isActive: boolean;
  className?: string;
  barCount?: number;
  color?: string;
  muted?: boolean;
  soundThreshold?: number; // Threshold for sound detection
}

export default function AudioWaveform({
  audioStream,
  isActive,
  className,
  barCount = 30,
  color = 'currentColor',
  muted = false,
  soundThreshold = 15, // Default threshold value
}: AudioWaveformProps) {
  const [levels, setLevels] = useState<number[]>(Array(barCount).fill(0));
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Track audio tracks count to detect changes
  const [audioTrackCount, setAudioTrackCount] = useState(0);

  // Update track count when stream changes
  useEffect(() => {
    const count = audioStream?.getAudioTracks().length || 0;
    setAudioTrackCount(count);
  }, [audioStream]);

  // Set up audio analyzer when stream is available and has audio tracks
  useEffect(() => {
    if (!audioStream || !isActive || audioTrackCount === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      analyzerRef.current = null;
      return;
    }

    // Create audio context and analyzer if needed
    if (!audioContextRef.current) {
      // Handle AudioContext with proper typing
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;

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

    // Connect stream to analyzer
    if (!audioContextRef.current || !analyzerRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(audioStream);
    source.connect(analyzerRef.current);

    // Start visualization loop
    const analyzer = analyzerRef.current;
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const updateLevels = () => {
      const analyzer = analyzerRef.current;
      if (!analyzer || !isActive) return;

      // If muted, show flat line regardless of audio input
      if (muted) {
        setLevels(Array(barCount).fill(5)); // Minimum height for visibility
        animationRef.current = requestAnimationFrame(updateLevels);
        return;
      }

      analyzer.getByteFrequencyData(dataArray);

      // Check if there's any sound using the configurable threshold
      // Calculate average sound level for better detection
      const avgSoundLevel = Array.from(dataArray).reduce((sum, value) => sum + value, 0) / dataArray.length;
      const hasSoundActivity = avgSoundLevel > soundThreshold;

      // Process frequency data into bar heights
      const newLevels = Array(barCount).fill(0);

      if (hasSoundActivity) {
        // Only show waveform activity if there's sound
        const step = Math.floor(dataArray.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const start = i * step;
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[start + j] || 0;
          }
          // Normalize to 0-100 and add some base height
          const avg = sum / step;
          newLevels[i] = Math.max(5, Math.min(100, (avg / 255) * 100));
        }
      } else {
        // If no sound, set all bars to minimum height (flat line)
        for (let i = 0; i < barCount; i++) {
          newLevels[i] = 5; // Minimum height for visibility
        }
      }

      setLevels(newLevels);
      animationRef.current = requestAnimationFrame(updateLevels);
    };

    animationRef.current = requestAnimationFrame(updateLevels);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      source.disconnect();
    };
  }, [audioStream, isActive, barCount, muted, soundThreshold, audioTrackCount]);

  // When not active or when muted, show appropriate visualization
  useEffect(() => {
    if (!isActive || audioStream) return;

    let frame = 0;
    const idleAnimation = () => {
      frame++;

      // For muted state or inactive state, show flat line
      if (muted || !isActive) {
        setLevels(Array(barCount).fill(5)); // Flat line at minimum height
      } else {
        // For idle state (not muted but no stream), show gentle waves
        const newLevels = Array(barCount)
          .fill(0)
          .map((_, i) => {
            // Generate gentle sine wave pattern
            const phase = (i / barCount) * Math.PI * 2;
            const time = frame * 0.05;
            const value = Math.sin(phase + time) * 10 + Math.sin(phase * 2.5 + time * 0.7) * 5;
            return Math.max(5, Math.min(30, value + 15)); // Keep between 5-30%
          });

        setLevels(newLevels);
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
    <div className={cn('flex items-end justify-center gap-[2px] h-20 w-full', className)}>
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
