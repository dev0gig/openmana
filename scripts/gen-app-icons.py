#!/usr/bin/env python3
"""Scales OpenMana's temporary app icon (the unchanged Anvil icon) for the web.

    python3 scripts/gen-app-icons.py          # or: npm run icons

Source: assets/app-icon/anvil-icon.png (provenance: assets/app-icon/PROVENANCE.md).
Like Anvil's own generator (dev0gig/anvil scripts/gen-icons.py) every file is
a plain Lanczos downscale of the whole image: no crop, frame, rounding, mask,
shadow or padding. The image is full-bleed, so the same pixels serve as
"any" and as "maskable" icon in the web app manifest (the launcher mask only
trims the painted edge, as on Android with Anvil's adaptive icon).

Needs Pillow. The output is deterministic; src/app/pwa.test.ts checks sizes
and the source checksum.
"""

import hashlib
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
SOURCE = REPO / "assets/app-icon/anvil-icon.png"
SOURCE_SHA256 = "6415e9ea97ee21fe8d53590c670d91b41dfe9efe9ad9fa16557c32421c4246e8"
PUBLIC = REPO / "public"

PNGS = {
    "icons/icon-192.png": 192,  # manifest (any + maskable), sidebar/header logo
    "icons/icon-512.png": 512,  # manifest (any + maskable), start page
    "apple-touch-icon.png": 180,  # iOS/iPadOS home screen
}
FAVICON_SIZES = [16, 32, 48]  # favicon.ico (browser tabs)


def main() -> None:
    data = SOURCE.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != SOURCE_SHA256:
        raise SystemExit(f"{SOURCE} has SHA-256 {digest}, expected {SOURCE_SHA256} (see PROVENANCE.md)")
    with Image.open(SOURCE) as original:
        if original.width != original.height:
            raise SystemExit("the icon must be square; no automatic cropping")
        image = original.convert("RGB")
    for name, edge in PNGS.items():
        target = PUBLIC / name
        target.parent.mkdir(parents=True, exist_ok=True)
        image.resize((edge, edge), Image.Resampling.LANCZOS).save(target, optimize=True)
        print(f"{name}: {edge} px")
    favicon = image.resize((256, 256), Image.Resampling.LANCZOS)
    favicon.save(PUBLIC / "favicon.ico", sizes=[(s, s) for s in FAVICON_SIZES])
    print(f"favicon.ico: {', '.join(f'{s} px' for s in FAVICON_SIZES)}")


if __name__ == "__main__":
    main()
