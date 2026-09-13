import {
  BOOT_COLORS,
  BOOT_FAILSAFE_MS,
  BOOT_START_GLOBAL,
  BREATHE_DURATION_MS,
  FADE_DURATION_MS,
  FILL_DURATION_MS,
} from '@/lib/boot-loader';
import {
  BOOT_MASK_DATA_URI,
  BOOT_MASK_HEIGHT,
  BOOT_MASK_WIDTH,
} from '@/lib/boot-mask';

/**
 * Everything the boot loader needs in order to paint before anything else
 * loads. Server component - it renders into `<head>`.
 *
 * Nothing here touches the network. globals.css is a 77 kB render-blocking
 * request that on a slow connection arrives long after the document, so the
 * styles are inline; and the mask is a 7 kB data URI rather than a file,
 * because as a separate request the mark stayed invisible until it downloaded -
 * which is exactly the case the loader exists to cover.
 *
 * Once the fill completes the mark breathes rather than sitting still. On a slow
 * connection the 1400ms fill finishes long before the page does, and a finished,
 * motionless logo reads as frozen - the breathing is what says the work is still
 * going.
 *
 * The overlay is visible by default and is dismissed once the client says the
 * essentials are ready, rather than being switched on by a flag. On a warm cache
 * that happens within a few frames and `data-instant` removes it with no fade,
 * so there is nothing to see.
 */

const styles = `
:root{--boot-mask:url(${BOOT_MASK_DATA_URI})}
#boot-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:${BOOT_COLORS.lightBackground};opacity:1;transition:opacity ${FADE_DURATION_MS}ms ease}
html.dark #boot-loader{background:${BOOT_COLORS.darkBackground}}
#boot-loader[data-state='done']{opacity:0;pointer-events:none}
#boot-loader[data-instant='true']{transition:none}
#boot-loader[hidden]{display:none}
.boot-logo{position:relative;width:clamp(96px,18vmin,160px);aspect-ratio:${BOOT_MASK_WIDTH} / ${BOOT_MASK_HEIGHT};-webkit-mask-image:var(--boot-mask);mask-image:var(--boot-mask);-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
.boot-logo::before{content:'';position:absolute;inset:0;background:${BOOT_COLORS.lightForeground};opacity:.18}
.boot-logo::after{content:'';position:absolute;right:0;bottom:0;left:0;height:0;background:${BOOT_COLORS.lightForeground};animation:boot-fill ${FILL_DURATION_MS}ms cubic-bezier(.4,0,.2,1) forwards,boot-breathe ${BREATHE_DURATION_MS}ms ease-in-out ${FILL_DURATION_MS}ms infinite}
html.dark .boot-logo::before,html.dark .boot-logo::after{background:${BOOT_COLORS.darkForeground}}
@keyframes boot-fill{from{height:0}to{height:100%}}
@keyframes boot-breathe{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){#boot-loader{transition:none}.boot-logo::after{height:100%;animation:none}}
`;

/**
 * Records when the loader painted and applies the theme class, before paint.
 *
 * Theme is set here rather than left to `ThemeProvider`, which does it in an
 * effect: that runs after first paint, so the loader would flash its light
 * background before flipping to dark.
 *
 * The failsafe only matters if React never mounts - without it a broken bundle
 * would leave the overlay covering the site permanently.
 */
const script = `
(function () {
  try {
    var d = document.documentElement;
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      d.classList.add('dark');
    }
  } catch (e) {}
  window.${BOOT_START_GLOBAL} = Date.now();
  setTimeout(function () {
    var el = document.getElementById('boot-loader');
    if (el) { el.setAttribute('data-state', 'done'); el.hidden = true; }
  }, ${BOOT_FAILSAFE_MS});
})();
`;

export function BootLoaderHead() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
