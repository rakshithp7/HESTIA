import {
  BOOT_COLORS,
  BOOT_FAILSAFE_MS,
  BOOT_FLAG,
  BOOT_MASK_ASPECT,
  BOOT_START_GLOBAL,
  BOOT_STORAGE_KEY,
  FADE_DURATION_MS,
  FILL_DURATION_MS,
} from '@/lib/boot-loader';

/**
 * Everything the first-visit splash needs in order to paint before anything
 * else loads. Server component - it renders into `<head>`.
 *
 * This is inline rather than in globals.css because the splash exists to cover
 * a slow load, and globals.css is a 78 kB render-blocking request that on a slow
 * connection arrives long after the document. The mask is a 9.8 kB quantised
 * alpha channel rather than the 98 kB logo.png for the same reason, and is
 * preloaded so it starts downloading before the stylesheet is even parsed.
 *
 * An earlier version depended on both of those, and on a slow connection the
 * splash never appeared at all.
 */

const styles = `
#boot-loader{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:${BOOT_COLORS.lightBackground};opacity:1;transition:opacity ${FADE_DURATION_MS}ms ease}
html.dark #boot-loader{background:${BOOT_COLORS.darkBackground}}
html.${BOOT_FLAG} #boot-loader{display:flex}
#boot-loader[data-state='done']{opacity:0;pointer-events:none}
.boot-logo{position:relative;width:clamp(96px,18vmin,160px);aspect-ratio:${BOOT_MASK_ASPECT};-webkit-mask-image:url(/splash-mask.png);mask-image:url(/splash-mask.png);-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
.boot-logo::before{content:'';position:absolute;inset:0;background:${BOOT_COLORS.lightForeground};opacity:.18}
.boot-logo::after{content:'';position:absolute;right:0;bottom:0;left:0;height:0;background:${BOOT_COLORS.lightForeground};animation:boot-fill ${FILL_DURATION_MS}ms cubic-bezier(.4,0,.2,1) forwards}
html.dark .boot-logo::before,html.dark .boot-logo::after{background:${BOOT_COLORS.darkForeground}}
@keyframes boot-fill{from{height:0}to{height:100%}}
@media (prefers-reduced-motion:reduce){#boot-loader{transition:none}.boot-logo::after{height:100%;animation:none}}
`;

/**
 * Applies the theme class and decides whether the splash shows, before paint.
 *
 * Theme is set here rather than left to `ThemeProvider`, which does it in an
 * effect: that runs after first paint, so the splash would flash its light
 * background before flipping to dark.
 */
const script = `
(function () {
  try {
    var d = document.documentElement;
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      d.classList.add('dark');
    }
    if (!localStorage.getItem('${BOOT_STORAGE_KEY}')) {
      d.classList.add('${BOOT_FLAG}');
      window.${BOOT_START_GLOBAL} = Date.now();
      setTimeout(function () { d.classList.remove('${BOOT_FLAG}'); }, ${BOOT_FAILSAFE_MS});
    }
  } catch (e) {}
})();
`;

export function BootLoaderHead() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/splash-mask.png"
        fetchPriority="high"
      />
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
