/**
 * Shared constants for the first-visit splash.
 *
 * This file is values only - the markup lives in `components/BootLoaderHead.tsx`
 * (server) and `components/BootLoader.tsx` (client). It exists because those two
 * run in different environments and must agree on the storage key, the class
 * name and the timings.
 */

/** Set once the splash has played, so it never plays again in this browser. */
export const BOOT_STORAGE_KEY = 'hestia:booted';

/** Class on `<html>` while the splash should be visible. */
export const BOOT_FLAG = 'first-visit';

/** Global holding the moment the splash became visible, set before paint. */
export const BOOT_START_GLOBAL = '__hestiaSplashStart';

/** How long the fill takes. Mirrored by the CSS animation. */
export const FILL_DURATION_MS = 1400;

/** Mirrors the overlay's opacity transition. */
export const FADE_DURATION_MS = 400;

/**
 * Only reached if React never mounts at all, so the overlay cannot be left
 * covering the site. Generous, because a slow connection is exactly when the
 * splash matters most - an earlier 6s value fired during a normal slow-4G load
 * and tore the splash down before it was ever seen.
 */
export const BOOT_FAILSAFE_MS = 20000;

/**
 * Theme colours as literals rather than `var(--background)`.
 *
 * The custom properties live in globals.css, which is render-blocking but still
 * arrives after the document. The splash has to paint before then, so it cannot
 * depend on them.
 */
export const BOOT_COLORS = {
  lightBackground: '#b3d0da',
  lightForeground: '#1c575e',
  darkBackground: '#1e2c33',
  darkForeground: '#c29ec1',
} as const;

/** Intrinsic size of `/splash-mask.png`, used for the overlay's aspect ratio. */
export const BOOT_MASK_ASPECT = '256 / 398';
