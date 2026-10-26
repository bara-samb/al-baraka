"""
Génère le logo de l'app (icônes PWA, favicon, icône des images de partage) : la photo de
Serigne Aboul Baraka Mbacké dans un médaillon doré, au centre de l'étoile à huit branches du
Mushaf (۞), sur fond vert.

    python -m pip install --user Pillow==12.0.0
    python scripts/make-icons.py          (depuis frontend/)

La photo du médaillon est public/og-photo.jpg (aperçu des liens partagés, déjà cadré sur le
visage et les épaules). Tout est dessiné quatre fois plus grand puis réduit, pour des traits nets.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "public" / "og-photo.jpg"
ICONS = ROOT / "public" / "icons"

# Couleurs du Mushaf clair (src/components/mushaf/mushafTheme.ts).
GREEN_TOP = (26, 110, 83)
GREEN_BOTTOM = (11, 58, 43)
GOLD_LIGHT = (241, 216, 150)
GOLD_DARK = (176, 131, 44)

SS = 4  # suréchantillonnage


def gradient(size, top, bottom, diagonal=False):
    """Dégradé vertical (ou diagonal) de `top` à `bottom`."""
    w, h = size
    line = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        line.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    if not diagonal:
        return line.resize((w, h), Image.BILINEAR)
    big = line.resize((w * 2, h * 2), Image.BILINEAR).rotate(-45, resample=Image.BILINEAR)
    return big.crop((w // 2, h // 2, w // 2 + w, h // 2 + h))


def design(px, rounded=True, scale=1.0):
    """Icône carrée de `px` pixels. `scale` < 1 resserre le motif (zone sûre des icônes maskable)."""
    s = px * SS
    u = s / 512  # unité : le motif est décrit sur une grille de 512
    c = s / 2

    def at(v):  # coordonnée de la grille 512, resserrée autour du centre
        return c + (v - 256) * u * scale

    img = gradient((s, s), GREEN_TOP, GREEN_BOTTOM).convert("RGBA")

    # Étoile : deux carrés, l'un tourné de 45°, en traits dorés (dégradé diagonal).
    stroke = Image.new("L", (s, s), 0)
    draw = ImageDraw.Draw(stroke)
    width = max(1, round(9 * u * scale))
    lo, hi = at(90), at(422)
    draw.rectangle((lo, lo, hi, hi), outline=255, width=width)
    star2 = Image.new("L", (s, s), 0)
    ImageDraw.Draw(star2).rectangle((lo, lo, hi, hi), outline=255, width=width)
    stroke = Image.composite(Image.new("L", (s, s), 255), stroke, star2.rotate(45, resample=Image.BICUBIC, center=(c, c)))

    # Médaillon : la photo dans un cercle, cerclé d'or.
    r = 158 * u * scale
    box = (round(c - r), round(c - r), round(c + r), round(c + r))
    side = box[2] - box[0]
    face = Image.open(PHOTO).convert("RGB").resize((side, side), Image.LANCZOS)
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, side - 1, side - 1), fill=255)
    # L'étoile passe derrière le médaillon.
    stroke.paste(0, box, mask)
    ring = round(7 * u * scale)
    ImageDraw.Draw(stroke).ellipse(box, outline=255, width=ring)

    gold = gradient((s, s), GOLD_LIGHT, GOLD_DARK, diagonal=True)
    img.paste(face, box[:2], mask)
    img.paste(gold, (0, 0), stroke)

    if rounded:
        corners = Image.new("L", (s, s), 0)
        ImageDraw.Draw(corners).rounded_rectangle((0, 0, s - 1, s - 1), radius=round(90 * u), fill=255)
        img.putalpha(corners)
    return img.resize((px, px), Image.LANCZOS)


def main():
    design(512).save(ICONS / "icon-512.png", optimize=True)
    design(192).save(ICONS / "icon-192.png", optimize=True)
    # Maskable et iPhone : carré plein, le système arrondit lui-même les coins. Le motif de la
    # version maskable tient dans la zone sûre (cercle de 80 %), certains Android le rognent.
    design(512, rounded=False, scale=0.8).save(ICONS / "icon-maskable-512.png", optimize=True)
    design(180, rounded=False).convert("RGB").save(ICONS / "apple-touch-icon.png", optimize=True)
    design(48).save(ICONS / "favicon-48.png", optimize=True)
    # Icône dessinée en haut des images de partage (src/services/verseCard.ts).
    design(256).save(ICONS / "app-badge-256.png", optimize=True)
    print("Icones generees.")


if __name__ == "__main__":
    main()
