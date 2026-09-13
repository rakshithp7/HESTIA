'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BOOT_IMPERCEPTIBLE_MS,
  BOOT_MIN_VISIBLE_MS,
  BOOT_START_GLOBAL,
  BOOT_WARM_IMAGES,
  BOOT_WARM_ROUTES,
  BOOT_FONT_TIMEOUT_MS,
  BOOT_WARM_TIMEOUT_MS,
  FADE_DURATION_MS,
} from '@/lib/boot-loader';

/**
 * Boot loader: the Hestia mark fills from the bottom up over a solid background
 * while the site's shared assets and main route bundles are fetched.
 *
 * Shown whenever those are not ready, and dismissed the moment they are. There
 * is no "already seen" flag - see the note in lib/boot-loader.ts. On a warm
 * cache warming resolves within a few frames, and the overlay is removed with
 * no fade, so nothing is perceptible. On a cold or slow load it stays up for as
 * long as the work takes.
 */

/**
 * Resolves when the document is parsed and styled - not when every last image
 * has arrived.
 *
 * `load` was the obvious signal and the wrong one: it waits on every image on
 * the page, so on a slow connection the loader sat there for seconds after the
 * page was perfectly ready to look at. Stylesheets are render-blocking, so by
 * the time this fires the CSS is in and the page will not reflow underneath the
 * user; the remaining images land behind the skeletons.
 */
function domReady(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState !== 'loading') return resolve();
    document.addEventListener('DOMContentLoaded', () => resolve(), {
      once: true,
    });
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
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [instant, setInstant] = useState(false);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let dismissTimer: number | undefined;
    let hideTimer: number | undefined;
    let cancelled = false;

    const shownAt =
      (window as unknown as Record<string, number | undefined>)[
        BOOT_START_GLOBAL
      ] ?? Date.now();

    const dismiss = (withFade: boolean) => {
      if (cancelled) return;
      setInstant(!withFade);
      setState('done');
      // Kept in the tree through the fade so the transition can run, then
      // removed from layout entirely.
      hideTimer = window.setTimeout(
        () => setHidden(true),
        withFade ? FADE_DURATION_MS : 0
      );
    };

    // Started but deliberately not awaited. Warming the other routes makes the
    // next navigation instant, but holding the loading screen until four route
    // bundles have downloaded makes the current page arrive later than it
    // needs to - which on a slow connection is the opposite of the goal.
    for (const route of BOOT_WARM_ROUTES) {
      try {
        router.prefetch(route);
      } catch {
        // Prefetch is best effort.
      }
    }
    for (const src of BOOT_WARM_IMAGES) void imageLoaded(src);

    // What the loader actually waits on: the things that decide whether this
    // screen is ready to look at. Webfonts are bounded separately - they are
    // worth a short wait to avoid text reflowing under the user, but not worth
    // holding the whole site for.
    const warm = Promise.all([
      domReady(),
      withTimeout(
        document.fonts?.ready ?? Promise.resolve(),
        BOOT_FONT_TIMEOUT_MS
      ),
    ]);

    void withTimeout(warm, BOOT_WARM_TIMEOUT_MS).then(() => {
      if (cancelled) return;
      const elapsed = Date.now() - shownAt;

      // Everything was already cached - the user has effectively not seen the
      // overlay, so take it away without animating.
      if (elapsed < BOOT_IMPERCEPTIBLE_MS) {
        dismiss(false);
        return;
      }

      // It has been on screen long enough to register, so let the fill finish
      // rather than cutting it off part-way.
      const remaining = BOOT_MIN_VISIBLE_MS - elapsed;
      dismissTimer = window.setTimeout(
        () => dismiss(true),
        Math.max(remaining, 0)
      );
    });

    return () => {
      cancelled = true;
      window.clearTimeout(dismissTimer);
      window.clearTimeout(hideTimer);
    };
  }, [router]);

  return (
    <div
      id="boot-loader"
      data-state={state}
      data-instant={instant ? 'true' : undefined}
      hidden={hidden}
      role="status"
      aria-label="Loading Hestia"
    >
      <div className="boot-logo" />
    </div>
  );
}
