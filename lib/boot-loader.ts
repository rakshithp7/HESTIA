/**
 * Shared constants for the first-visit splash.
 *
 * The blocking script in `app/layout.tsx` and the `BootLoader` component both
 * need these, and they are stringified into that script, so they live here
 * rather than being duplicated.
 */

/** Set once the splash has played, so it never plays again in this browser. */
export const BOOT_STORAGE_KEY = 'hestia:booted';

/** Class on `<html>` while the splash should be visible. */
export const BOOT_FLAG = 'first-visit';

/**
 * Safety net: if React never mounts, nothing would remove the flag and the
 * overlay would cover the site permanently. The inline script clears it after
 * this regardless.
 */
const BOOT_FAILSAFE_MS = 6000;

/**
 * Runs before first paint, inlined in `<head>`.
 *
 * Also applies the theme class. `ThemeProvider` does this in an effect, which
 * is after first paint - fine for the app, but the splash paints a solid
 * `var(--background)` immediately and would flash the light colour before
 * flipping to dark.
 */
export const bootLoaderScript = `
(function () {
  try {
    var d = document.documentElement;
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      d.classList.add('dark');
    }
    if (!localStorage.getItem('${BOOT_STORAGE_KEY}')) {
      d.classList.add('${BOOT_FLAG}');
      setTimeout(function () { d.classList.remove('${BOOT_FLAG}'); }, ${BOOT_FAILSAFE_MS});
    }
  } catch (e) {}
})();
`;
