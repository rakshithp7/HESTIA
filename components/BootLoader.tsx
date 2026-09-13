'use client';

import { useEffect, useState } from 'react';
import {
  BOOT_FLAG,
  BOOT_START_GLOBAL,
  BOOT_STORAGE_KEY,
  FADE_DURATION_MS,
  FILL_DURATION_MS,
} from '@/lib/boot-loader';

/**
 * First-visit splash: the Hestia mark fills from the bottom up over a solid
 * background, then fades out.
 *
 * Whether it shows at all is decided by the blocking script in
 * `lib/boot-loader.ts`, not here - a `useEffect` runs after first paint, so
 * deciding in React would let a frame of the real page through first. The
 * overlay is always in the server HTML and CSS keeps it hidden unless that
 * script set the flag, so there is no hydration mismatch either way.
 */

/**
 * Cap on waiting for `window.load`. The splash exists to cover a slow load, so
 * this is not short - but it is bounded, because one stalled image must not
 * hold the screen indefinitely.
 */
const MAX_ASSET_WAIT_MS = 8000;

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

    // Measured from when the splash actually appeared, which the blocking
    // script recorded before paint. Timing from this effect instead would cut
    // the animation short on a slow connection, where hydration can happen
    // seconds after the overlay first showed.
    const shownAt =
      (window as unknown as Record<string, number | undefined>)[
        BOOT_START_GLOBAL
      ] ?? Date.now();

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
      const remaining = FILL_DURATION_MS - (Date.now() - shownAt);
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
