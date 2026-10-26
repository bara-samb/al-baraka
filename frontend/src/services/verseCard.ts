import { Platform, Share } from 'react-native';
import { mushafLight as P } from '../components/mushaf/mushafTheme';
import { getAudioUrlForSurah } from '../config/audioConfig';
import { getAyahBoundsSeconds } from './audioService';
import { getFrenchVerseTranslation } from './quranService';
import { getMushafVerse, surahNameAr, surahNameLatin, toArabicDigits } from './warshMushafService';

/**
 * Partage d'un verset aux couleurs de l'app. Sur le web : une image (papier ivoire, cadre vert
 * et or, texte Warsh et traduction française) dessinée dans un canvas, ou une vidéo de cette
 * image sur la récitation du verset. Ailleurs, ou si le navigateur ne sait pas partager de
 * fichier, un texte mis en forme.
 */

const W = 1080;
const H = 1350;
const SITE = 'al-baraka-app.pages.dev';
const WARSH_FONT = 'KFGQPC_Warsh';
const LATIN_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const cleanText = (text: string) => text.replace(/۞\s*/g, '').trim();

export interface VerseCard {
  surah: number;
  ayah: number;
  /** Image finale, sans barre de progression. */
  canvas: HTMLCanvasElement;
  blob: Blob;
  /** Traduction française, ou null hors connexion. */
  french: string | null;
}

/** Vrai sur le web, où l'image (et la vidéo) peuvent être dessinées. */
export const canDrawCard = (): boolean => Platform.OS === 'web' && typeof document !== 'undefined';

/** Vrai si le navigateur sait enregistrer une vidéo du canvas avec le son. */
export const canRecordVideo = (): boolean =>
  canDrawCard() &&
  typeof MediaRecorder !== 'undefined' &&
  typeof (HTMLCanvasElement.prototype as any).captureStream === 'function' &&
  typeof (window as any).AudioContext !== 'undefined';

const shareText = (surah: number, ayah: number, french: string | null) => {
  const verse = getMushafVerse(surah, ayah);
  if (!verse) return '';
  return (
    `${cleanText(verse.text)} ﴿${toArabicDigits(ayah)}﴾\n\n` +
    (french ? `« ${french} »\n\n` : '') +
    `${surahNameLatin(surah)} (${surahNameAr(surah)}) · verset ${ayah}\n` +
    `Mushaf Warsh, page ${verse.page}\n\n` +
    `AL BARAKA · Récitation de Serigne Aboul Baraka Mbacké\nhttps://${SITE}`
  );
};

/** Traduction française, abandonnée au bout de quelques secondes (connexion lente). */
const frenchWithTimeout = (surah: number, ayah: number): Promise<string | null> =>
  Promise.race([
    getFrenchVerseTranslation(surah, ayah),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

// Coupe un texte en lignes d'au plus `maxWidth` pixels (mot par mot).
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

const drawCard = async (surah: number, ayah: number, text: string, page: number, french: string | null): Promise<HTMLCanvasElement> => {
  await Promise.all([document.fonts.load(`64px ${WARSH_FONT}`), document.fonts.ready]).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

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

  // Verset puis traduction : la plus grande taille qui tient dans la zone. Si même la plus
  // petite ne suffit pas (très longs versets), la traduction est écourtée.
  const verse = `${cleanText(text)} ${toArabicDigits(ayah)}`;
  const areaTop = 340;
  const areaBottom = H - 290;
  const maxWidth = W - 240;
  const gap = 34;
  let size = 96;
  let arLines: string[] = [];
  let frLines: string[] = [];
  let frSize = 0;
  for (; size >= 30; size -= 2) {
    ctx.direction = 'rtl';
    ctx.font = `${size}px ${WARSH_FONT}`;
    arLines = wrap(ctx, verse, maxWidth);
    ctx.direction = 'ltr';
    frSize = Math.max(24, Math.round(size * 0.46));
    ctx.font = `italic ${frSize}px ${LATIN_FONT}`;
    frLines = french ? wrap(ctx, `« ${french} »`, maxWidth) : [];
    const height = arLines.length * size * 1.9 + (frLines.length ? gap + frLines.length * frSize * 1.45 : 0);
    if (height <= areaBottom - areaTop) break;
  }
  size = Math.max(size, 30);
  const arHeight = arLines.length * size * 1.9;
  const roomForFrench = areaBottom - areaTop - arHeight - gap;
  const maxFrLines = Math.max(0, Math.floor(roomForFrench / (frSize * 1.45)));
  if (frLines.length > maxFrLines) {
    frLines = frLines.slice(0, maxFrLines);
    if (frLines.length) frLines[frLines.length - 1] = `${frLines[frLines.length - 1].replace(/[\s,;.»]*$/, '')}… »`;
  }
  const frHeight = frLines.length ? gap + frLines.length * frSize * 1.45 : 0;
  let y = areaTop + (areaBottom - areaTop - arHeight - frHeight) / 2;

  ctx.fillStyle = P.ink;
  ctx.direction = 'rtl';
  ctx.font = `${size}px ${WARSH_FONT}`;
  arLines.forEach((l) => {
    ctx.fillText(l, W / 2, y + size * 0.95);
    y += size * 1.9;
  });
  ctx.direction = 'ltr';
  if (frLines.length) {
    y += gap;
    ctx.fillStyle = P.muted;
    ctx.font = `italic ${frSize}px ${LATIN_FONT}`;
    frLines.forEach((l) => {
      ctx.fillText(l, W / 2, y + frSize * 0.72);
      y += frSize * 1.45;
    });
  }

  // Référence.
  ctx.fillStyle = P.title;
  ctx.font = `bold 34px ${LATIN_FONT}`;
  ctx.fillText(`${surahNameLatin(surah)} · verset ${ayah}`, W / 2, H - 240);
  ctx.fillStyle = P.muted;
  ctx.font = `26px ${LATIN_FONT}`;
  ctx.fillText(`Mushaf Warsh · page ${page}${french ? ' · trad. M. Hamidullah' : ''}`, W / 2, H - 197);

  // Pied : récitateur et adresse.
  ctx.strokeStyle = P.goldSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, H - 162);
  ctx.lineTo(W / 2 + 120, H - 162);
  ctx.stroke();
  ctx.fillStyle = P.ink;
  ctx.font = `28px ${LATIN_FONT}`;
  ctx.fillText('Récitation de Serigne Aboul Baraka Mbacké', W / 2, H - 126);
  ctx.fillStyle = P.gold;
  ctx.font = `bold 26px ${LATIN_FONT}`;
  ctx.fillText(SITE, W / 2, H - 88);

  return canvas;
};

/** Prépare l'image d'un verset (avec sa traduction si la connexion le permet). Web uniquement. */
export const buildVerseCard = async (surah: number, ayah: number): Promise<VerseCard | null> => {
  const verse = getMushafVerse(surah, ayah);
  if (!verse || !canDrawCard()) return null;
  const french = await frenchWithTimeout(surah, ayah);
  const canvas = await drawCard(surah, ayah, verse.text, verse.page, french);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? { surah, ayah, canvas, blob, french } : null;
};

/**
 * Partage un fichier par le partage du téléphone, ou le télécharge (navigateur d'ordinateur).
 * Doit être appelé juste après un toucher de l'utilisateur, sinon le navigateur refuse.
 */
export const shareFile = async (blob: Blob, fileName: string, surah: number, ayah: number): Promise<void> => {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    // Annulation par l'utilisateur : rien à faire.
    await navigator.share({ files: [file], text: `${surahNameLatin(surah)} · verset ${ayah} — https://${SITE}` }).catch(() => {});
    return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
};

/** Partage le texte mis en forme (applications natives, ou image impossible). */
export const shareVerseText = async (surah: number, ayah: number, french?: string | null): Promise<void> => {
  const message = shareText(surah, ayah, french === undefined ? await frenchWithTimeout(surah, ayah) : french);
  if (message) await Share.share({ message }).catch(() => {});
};

/** Partage direct de l'image (ou du texte hors web), sans passer par la fenêtre de partage. */
export const shareVerse = async (surah: number, ayah: number): Promise<void> => {
  const card = await buildVerseCard(surah, ayah);
  if (!card) return shareVerseText(surah, ayah);
  await shareFile(card.blob, `al-baraka-${surah}-${ayah}.png`, surah, ayah);
};

const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export interface VerseRecording {
  /** Promesse de la vidéo terminée. */
  done: Promise<Blob>;
  /** Interrompt l'enregistrement (la promesse est alors rejetée). */
  cancel: () => void;
}

/**
 * Enregistre la vidéo d'un verset : l'image du verset, une barre de progression dorée, et la
 * récitation du verset (de son début à sa fin dans le MP3 de la sourate). L'enregistrement se
 * fait en temps réel et sans son dans le haut-parleur.
 *
 * Doit être appelé directement depuis un toucher de l'utilisateur : le son ne peut démarrer
 * qu'ainsi sur iPhone. Tout ce qui précède la lecture est donc synchrone.
 */
export const recordVerseVideo = (card: VerseCard, onProgress: (ratio: number) => void): VerseRecording => {
  const bounds = getAyahBoundsSeconds(card.surah, card.ayah);
  if (!bounds) return { done: Promise.reject(new Error('Minutage du verset indisponible')), cancel: () => {} };
  const { startSec, endSec } = bounds;
  const duration = endSec - startSec;

  // Son : élément audio → AudioContext → flux enregistrable (rien vers le haut-parleur).
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx: AudioContext = new AudioCtx();
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = getAudioUrlForSurah(card.surah);
  const source = audioCtx.createMediaElementSource(audio);
  const destination = audioCtx.createMediaStreamDestination();
  source.connect(destination);
  audioCtx.resume().catch(() => {});
  // Déverrouille la lecture tant que le toucher de l'utilisateur est encore valable.
  const unlock = audio.play().then(() => audio.pause()).catch(() => {});

  // Image : la carte, redessinée à chaque image avec la barre de progression.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const drawFrame = (ratio: number) => {
    ctx.drawImage(card.canvas, 0, 0);
    ctx.fillStyle = P.goldSoft;
    roundRect(ctx, 140, H - 60, W - 280, 8, 4);
    ctx.fill();
    ctx.fillStyle = P.gold;
    roundRect(ctx, 140, H - 60, Math.max(8, (W - 280) * ratio), 8, 4);
    ctx.fill();
  };
  drawFrame(0);

  const stream = new MediaStream([
    ...(canvas as any).captureStream(30).getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);
  const mimeType = VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  let timer: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  const cleanup = () => {
    if (timer) clearInterval(timer);
    audio.pause();
    audio.removeAttribute('src');
    audioCtx.close().catch(() => {});
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      cleanup();
      if (cancelled) return reject(new Error('cancelled'));
      resolve(new Blob(chunks, { type: (recorder.mimeType || mimeType || 'video/webm').split(';')[0] }));
    };
    const fail = (err: unknown) => {
      cleanup();
      if (recorder.state !== 'inactive') recorder.stop();
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    audio.onerror = () => fail(new Error('Audio indisponible'));

    unlock.then(async () => {
      if (cancelled) return reject(new Error('cancelled'));
      // Se place au début du verset (certains navigateurs mobiles demandent d'insister).
      await new Promise<void>((res) => {
        const seek = () => {
          audio.currentTime = startSec;
        };
        audio.onseeked = () => {
          if (Math.abs(audio.currentTime - startSec) < 0.5) res();
          else seek();
        };
        if (audio.readyState >= 1) seek();
        else audio.onloadedmetadata = seek;
      });
      if (cancelled) return reject(new Error('cancelled'));
      recorder.start(500);
      await audio.play();
      const safety = Date.now() + (duration + 15) * 1000;
      timer = setInterval(() => {
        const ratio = Math.min(1, Math.max(0, (audio.currentTime - startSec) / duration));
        drawFrame(ratio);
        onProgress(ratio);
        if (audio.currentTime >= endSec || audio.ended || Date.now() > safety) {
          drawFrame(1);
          onProgress(1);
          clearInterval(timer);
          audio.pause();
          // Une courte image fixe à la fin, pour que la dernière syllabe ne soit pas coupée.
          setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 400);
        }
      }, 1000 / 30);
    }).catch(fail);
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      if (recorder.state !== 'inactive') recorder.stop();
      else cleanup();
    },
  };
};

/** Extension du fichier vidéo selon le format produit par le navigateur. */
export const videoExtension = (blob: Blob): string => (blob.type.includes('mp4') ? 'mp4' : 'webm');
