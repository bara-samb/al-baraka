"""
Génère le logo de l'app (icônes PWA, favicon) et l'image d'aperçu des liens partagés
(Open Graph) à partir de la photo de Serigne Aboul Baraka Mbacké.

    python -m pip install --user Pillow==12.0.0
    python scripts/make-icons.py          (depuis frontend/)

Le logo est la photo seule, cadrée sur le visage et les épaules. L'aperçu est carré :
WhatsApp affiche une vignette carrée découpée au centre de l'image, et le titre et la
description (balises de public/index.html) s'affichent déjà à côté.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "src" / "assets" / "serigne_abdou_bara.jpg"
ICONS = ROOT / "public" / "icons"
PUBLIC = ROOT / "public"

# Cadrages de la photo (913 x 1024 ; visage vers (430, 415)).
LOGO_CROP = (250, 290, 610, 650)  # tête et épaules
FAVICON_CROP = (320, 320, 540, 540)  # visage, lisible à 48 px
PREVIEW_CROP = (150, 285, 570, 705)  # buste, sans le poteau doré à droite


def photo(crop, px):
    return Image.open(PHOTO).convert("RGB").crop(crop).resize((px, px), Image.LANCZOS)


def rounded(img, radius_ratio=90 / 512):
    s = img.size[0]
    mask = Image.new("L", (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=round(s * 4 * radius_ratio), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask.resize((s, s), Image.LANCZOS))
    return out


def main():
    rounded(photo(LOGO_CROP, 512)).save(ICONS / "icon-512.png", optimize=True)
    rounded(photo(LOGO_CROP, 192)).save(ICONS / "icon-192.png", optimize=True)
    # Maskable et iPhone : carré plein, le système arrondit lui-même les coins.
    photo(LOGO_CROP, 512).save(ICONS / "icon-maskable-512.png", optimize=True)
    photo(LOGO_CROP, 180).save(ICONS / "apple-touch-icon.png", optimize=True)
    rounded(photo(FAVICON_CROP, 48)).save(ICONS / "favicon-48.png", optimize=True)
    photo(PREVIEW_CROP, 600).save(PUBLIC / "og-photo.jpg", quality=90, optimize=True, progressive=True)
    print("Icones et apercu generes.")


if __name__ == "__main__":
    main()
