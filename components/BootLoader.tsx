'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BOOT_FLAG,
  BOOT_START_GLOBAL,
  BOOT_STORAGE_KEY,
  BOOT_WARM_IMAGES,
  BOOT_WARM_ROUTES,
  BOOT_WARM_TIMEOUT_MS,
  FADE_DURATION_MS,
  FILL_DURATION_MS,
} from '@/lib/boot-loader';

/**
 * First-visit splash and preloader: the Hestia mark fills from the bottom up
 * over a solid background while the site's shared assets and main route bundles
 * are fetched, then fades out.
 *
 * Whether it shows at all is decided by the blocking script in
 * `BootLoaderHead`, not here - a `useEffect` runs after first paint, so deciding
 * in React would let a frame of the real page through first. The overlay is
 * always in the server HTML and CSS keeps it hidden unless that script set the
 * flag, so there is no hydration mismatch either way.
 */

/** Resolves when `load` fires, or immediately if it already has. */
function pageLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') return resolve();
    window.addEventListener('load', () => resolve(), { once: true });
  });
}

function imageLoaded(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    // A failed warm-up is not a failed page load - resolve either way.
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function withTimeout(work: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    work.then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  ]);
}

export function BootLoader() {
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains(BOOT_FLAG)) return;

    let dismissTimer: number | undefined;
    let removeTimer: number | undefined;
    let cancelled = false;

    const dismiss = () => {
      if (cancelled) return;
      setDone(true);
      try {
        sessionStorage.setItem(BOOT_STORAGE_KEY, '1');
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
    // the fill short on a slow connection, where hydration can happen seconds
    // after the overlay first showed.
    const shownAt =
      (window as unknown as Record<string, number | undefined>)[
        BOOT_START_GLOBAL
      ] ?? Date.now();

    // The point of holding the screen: fetch the things the next interaction
    // will need, so navigation after the splash does not hit the network.
    const warm = Promise.all([
      pageLoaded(),
      document.fonts?.ready ?? Promise.resolve(),
      ...BOOT_WARM_IMAGES.map(imageLoaded),
      ...BOOT_WARM_ROUTES.map(async (route) => {
        try {
          router.prefetch(route);
        } catch {
          // Prefetch is best effort; never block the splash on it.
        }
      }),
    ]);

    void withTimeout(warm, BOOT_WARM_TIMEOUT_MS).then(() => {
      if (cancelled) return;
      // Never cut the fill animation off part-way, however fast warming was.
      const remaining = FILL_DURATION_MS - (Date.now() - shownAt);
      dismissTimer = window.setTimeout(dismiss, Math.max(remaining, 0));
    });

    return () => {
      cancelled = true;
      window.clearTimeout(dismissTimer);
      window.clearTimeout(removeTimer);
    };
  }, [router]);

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
