import { Platform, Share } from 'react-native';
import { mushafLight as P } from '../components/mushaf/mushafTheme';
import { getMushafVerse, surahNameAr, surahNameLatin, toArabicDigits } from './warshMushafService';

/**
 * Partage d'un verset aux couleurs de l'app : sur le web, une image (papier ivoire, cadre
 * vert et or, texte Warsh) dessinée dans un canvas ; ailleurs, ou si le navigateur ne sait
 * pas partager d'image, un texte mis en forme.
 */

const W = 1080;
const H = 1350;
const SITE = 'al-baraka-app.pages.dev';
const WARSH_FONT = 'KFGQPC_Warsh';
const LATIN_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const cleanText = (text: string) => text.replace(/۞\s*/g, '').trim();

const shareAsText = async (surah: number, ayah: number, text: string, page: number) => {
  const message =
    `${cleanText(text)} ﴿${toArabicDigits(ayah)}﴾\n\n` +
    `${surahNameLatin(surah)} (${surahNameAr(surah)}) · verset ${ayah}\n` +
    `Mushaf Warsh, page ${page}\n\n` +
    `AL BARAKA · Récitation de Serigne Aboul Baraka Mbacké\nhttps://${SITE}`;
  await Share.share({ message }).catch(() => {});
};

// Coupe le texte arabe en lignes d'au plus `maxWidth` pixels (mot par mot).
const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawCard = async (surah: number, ayah: number, text: string, page: number): Promise<Blob | null> => {
  await Promise.all([document.fonts.load(`64px ${WARSH_FONT}`), document.fonts.ready]).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fond, cadre vert, filet d'or.
  ctx.fillStyle = P.greenDeep;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = P.page;
  roundRect(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.fill();
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 3;
  roundRect(ctx, 62, 62, W - 124, H - 124, 26);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // En-tête.
  ctx.fillStyle = P.gold;
  ctx.font = `bold 30px ${LATIN_FONT}`;
  ctx.letterSpacing = '8px';
  ctx.fillText('AL BARAKA', W / 2, 130);
  ctx.letterSpacing = '0px';

  // Bandeau de la sourate.
  const bannerY = 180;
  ctx.fillStyle = P.green;
  roundRect(ctx, 140, bannerY, W - 280, 120, 60);
  ctx.fill();
  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = P.onGreen;
  ctx.direction = 'rtl';
  ctx.font = `56px ${WARSH_FONT}`;
  ctx.fillText(`سورة ${surahNameAr(surah)}`, W / 2, bannerY + 58);
  ctx.direction = 'ltr';

  // Verset : la plus grande taille qui tient dans la zone.
  const verse = `${cleanText(text)} ${toArabicDigits(ayah)}`;
  const areaTop = 350;
  const areaBottom = H - 300;
  const maxWidth = W - 240;
  let size = 72;
  let lines: string[] = [];
  ctx.direction = 'rtl';
  for (; size >= 30; size -= 2) {
    ctx.font = `${size}px ${WARSH_FONT}`;
    lines = wrap(ctx, verse, maxWidth);
    if (lines.length * size * 1.9 <= areaBottom - areaTop) break;
  }
  const lineHeight = size * 1.9;
  const startY = areaTop + (areaBottom - areaTop - lines.length * lineHeight) / 2 + lineHeight / 2;
  ctx.fillStyle = P.ink;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineHeight));
  ctx.direction = 'ltr';

  // Référence.
  ctx.fillStyle = P.title;
  ctx.font = `bold 34px ${LATIN_FONT}`;
  ctx.fillText(`${surahNameLatin(surah)} · verset ${ayah}`, W / 2, H - 250);
  ctx.fillStyle = P.muted;
  ctx.font = `26px ${LATIN_FONT}`;
  ctx.fillText(`Mushaf Warsh · page ${page}`, W / 2, H - 205);

  // Pied : récitateur et adresse.
  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, H - 165);
  ctx.lineTo(W / 2 + 120, H - 165);
  ctx.stroke();
  ctx.fillStyle = P.ink;
  ctx.font = `28px ${LATIN_FONT}`;
  ctx.fillText('Récitation de Serigne Aboul Baraka Mbacké', W / 2, H - 128);
  ctx.fillStyle = P.gold;
  ctx.font = `bold 26px ${LATIN_FONT}`;
  ctx.fillText(SITE, W / 2, H - 90);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

export const shareVerse = async (surah: number, ayah: number): Promise<void> => {
  const verse = getMushafVerse(surah, ayah);
  if (!verse) return;
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    await shareAsText(surah, ayah, verse.text, verse.page);
    return;
  }

  const blob = await drawCard(surah, ayah, verse.text, verse.page);
  if (!blob) {
    await shareAsText(surah, ayah, verse.text, verse.page);
    return;
  }
  const file = new File([blob], `al-baraka-${surah}-${ayah}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    // Annulation par l'utilisateur : rien à faire.
    await navigator.share({ files: [file], text: `${surahNameLatin(surah)} · verset ${ayah} — https://${SITE}` }).catch(() => {});
    return;
  }
  // Navigateur d'ordinateur : l'image est téléchargée.
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
};
