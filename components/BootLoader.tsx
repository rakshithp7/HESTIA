'use client';

import { useEffect, useState } from 'react';
import { BOOT_FLAG, BOOT_STORAGE_KEY } from '@/lib/boot-loader';

/**
 * First-visit splash: the Hestia mark fills from the bottom up over a solid
 * background, then fades out.
 *
 * Shown once per browser. The decision is made by the blocking script in
 * `app/layout.tsx` rather than here, because a `useEffect` runs after first
 * paint - deciding in React would let a frame of the real page through before
 * the overlay appeared. The overlay is always in the server HTML and CSS keeps
 * it hidden unless that script added the flag, so there is no hydration
 * mismatch either way.
 */

/** Long enough to read as deliberate, short enough not to be in the way. */
const FILL_DURATION_MS = 1400;
/** Matches the opacity transition in globals.css. */
const FADE_DURATION_MS = 400;
/**
 * Cap on waiting for `window.load`. A single slow image must not hold the
 * splash open, so the fill animation wins after this regardless.
 */
const MAX_ASSET_WAIT_MS = 4000;

export function BootLoader() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains(BOOT_FLAG)) return;

    let dismissTimer: number | undefined;
    let removeTimer: number | undefined;

    const dismiss = () => {
      setDone(true);
      try {
        localStorage.setItem(BOOT_STORAGE_KEY, '1');
      } catch {
        // Private browsing or storage disabled - the splash just shows again.
      }
      // Kept mounted through the fade so the transition can run, then the flag
      // goes so the overlay stops covering anything.
      removeTimer = window.setTimeout(() => {
        root.classList.remove(BOOT_FLAG);
      }, FADE_DURATION_MS);
    };

    // Hold until the fill has finished and the page's own assets are in, so the
    // splash does not hand over to a half-painted screen.
    const started = performance.now();
    const waitForAssets = () =>
      new Promise<void>((resolve) => {
        if (document.readyState === 'complete') return resolve();
        const onLoad = () => resolve();
        window.addEventListener('load', onLoad, { once: true });
        window.setTimeout(() => {
          window.removeEventListener('load', onLoad);
          resolve();
        }, MAX_ASSET_WAIT_MS);
      });

    void waitForAssets().then(() => {
      const remaining = FILL_DURATION_MS - (performance.now() - started);
      dismissTimer = window.setTimeout(dismiss, Math.max(remaining, 0));
    });

    return () => {
      window.clearTimeout(dismissTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div
      id="boot-loader"
      data-state={done ? 'done' : 'loading'}
      role="status"
      aria-label="Loading Hestia"
    >
      <div className="boot-logo" />
    </div>
  );
}
