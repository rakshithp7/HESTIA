#!/usr/bin/env python3
"""Regenerate lib/boot-mask.ts from public/logo.png.

The boot loader masks with the logo's alpha channel. It cannot fetch that over
the network - on a slow connection the mark would be invisible until it
downloaded, which is exactly when the loader is needed - so the mask is inlined
as a data URI. Getting it small enough means dropping to the alpha channel only,
resizing to display width, and quantising.

Usage: python3 scripts/generate-boot-mask.py
"""
import base64
import io
from pathlib import Path

from PIL import Image

SOURCE = Path('public/logo.png')
TARGET = Path('lib/boot-mask.ts')
# The overlay renders at most 160 CSS px wide, so there is nothing to gain above
# this. 4 levels keeps the silhouette clean while compressing well.
WIDTH = 160
LEVELS = 4


def main() -> None:
    alpha = Image.open(SOURCE).convert('RGBA').getchannel('A')
    height = round(alpha.height * WIDTH / alpha.width)
    resized = alpha.resize((WIDTH, height), Image.LANCZOS)

    step = 256 // LEVELS
    quantised = resized.point(
        lambda v: min(255, (v // step) * step + (step // 2 if v >= step else 0))
    )

    mask = Image.new('RGBA', (WIDTH, height), (255, 255, 255, 0))
    mask.putalpha(quantised)

    buf = io.BytesIO()
    mask.save(buf, format='PNG', optimize=True)
    encoded = base64.b64encode(buf.getvalue()).decode()

    TARGET.write_text(
        f'''/**
 * The Hestia mark as a mask, inlined.
 *
 * Generated from {SOURCE}: alpha channel only, resized to {WIDTH}px wide and
 * quantised to {LEVELS} levels, which is what gets it small enough to inline.
 *
 * It is inline rather than a file because the boot loader must not depend on
 * the network. As a separate request the mark was still invisible on a slow
 * connection until it downloaded, which defeats the point of a loading screen.
 * The full logo.png is {SOURCE.stat().st_size / 1024:.0f} kB; this is {len(buf.getvalue()) / 1024:.1f} kB, {len(encoded) / 1024:.1f} kB as base64.
 *
 * Regenerate with {__file__.split('/')[-1] and 'scripts/generate-boot-mask.py'} if the logo changes.
 */
export const BOOT_MASK_WIDTH = {WIDTH};
export const BOOT_MASK_HEIGHT = {height};
export const BOOT_MASK_DATA_URI =
  'data:image/png;base64,{encoded}';
'''
    )
    print(f'{TARGET}: {WIDTH}x{height}, {len(encoded) / 1024:.1f} kB base64')


if __name__ == '__main__':
    main()
