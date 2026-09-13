/**
 * Shared constants for the boot loader.
 *
 * Values only - the markup lives in `components/BootLoaderHead.tsx` (server) and
 * `components/BootLoader.tsx` (client). It exists because those two run in
 * different environments and must agree on the timings and attribute names.
 *
 * There is deliberately no "already seen" flag. Earlier versions gated the
 * loader on localStorage and then sessionStorage, which meant it was really
 * answering "has this browser visited before" when the question that matters is
 * "is anything still loading right now". Those come apart exactly when the
 * loader is needed: clear the HTTP cache but keep the flag and you get a slow,
 * uncovered load. The loader is now shown whenever the essentials are not ready
 * and hidden the moment they are, so a warm cache dismisses it in a few frames
 * without any bookkeeping.
 */

/** Global holding the moment the loader first painted, set before paint. */
export const BOOT_START_GLOBAL = '__hestiaBootStart';

/** How long the fill takes. Mirrored by the CSS animation. */
export const FILL_DURATION_MS = 1400;

/** Mirrors the overlay's opacity transition. */
export const FADE_DURATION_MS = 400;

/**
 * One breath of the pulse that runs after the fill completes.
 *
 * On a slow connection the fill finishes seconds before the page is ready, and
 * a full, motionless mark looks like the loader has hung. Slow on purpose - it
 * should read as waiting, not as a spinner.
 */
export const BREATHE_DURATION_MS = 1800;

/**
 * Below this the loader is removed with no fade, on the basis that nothing was
 * painted yet. Kept small on purpose: anything longer and the mark is briefly
 * visible before vanishing, which reads as a glitch. Past this point the loader
 * commits to the full fill instead - see BOOT_MIN_VISIBLE_MS.
 */
export const BOOT_IMPERCEPTIBLE_MS = 120;

/**
 * Once the loader has been seen at all, it stays for at least this long. A
 * half-drawn mark that disappears mid-fill looks broken, so a load that is
 * merely quick rather than instant still gets the whole animation.
 */
export const BOOT_MIN_VISIBLE_MS = FILL_DURATION_MS;

/**
 * Only reached if React never mounts, so the overlay cannot be left covering
 * the site.
 */
export const BOOT_FAILSAFE_MS = 20000;

/**
 * Routes warmed while the loader is up - everything a signed-out visitor can
 * reach from the navbar. Prefetching these means the first navigation after the
 * loader does not hit the network.
 */
export const BOOT_WARM_ROUTES = [
  '/about',
  '/connect',
  '/resources',
  '/contact',
] as const;

/** Images warmed while the loader is up. */
export const BOOT_WARM_IMAGES = ['/logo.svg'] as const;

/**
 * Upper bound on waiting for webfonts. Worth a moment so headings do not
 * reflow the instant the loader lifts, but not worth holding the site for.
 */
export const BOOT_FONT_TIMEOUT_MS = 2000;

/**
 * Upper bound on warming. The loader should cover a slow load, but a stalled
 * request must not hold the screen forever.
 */
export const BOOT_WARM_TIMEOUT_MS = 10000;

/**
 * Theme colours as literals rather than `var(--background)`.
 *
 * The custom properties live in globals.css, which is render-blocking but still
 * arrives after the document. The loader has to paint before then, so it cannot
 * depend on them.
 */
export const BOOT_COLORS = {
  lightBackground: '#b3d0da',
  lightForeground: '#1c575e',
  darkBackground: '#1e2c33',
  darkForeground: '#c29ec1',
} as const;

