/**
 * Envoie ou programme sur TikTok les clips verticaux générés par render.js,
 * en pilotant Google Chrome via Puppeteer.
 *
 *   node upload-tiktok.js setup          Ouvre Chrome pour vous connecter à TikTok (une seule fois)
 *   node upload-tiktok.js [--limit 2]    Publie/programme les prochains clips prévus
 *   node upload-tiktok.js --dry-run      Remplit le formulaire sans cliquer sur "Publier"
 *   node upload-tiktok.js --connect      Se connecte à un Chrome déjà ouvert sur le port 9222
 *
 * Les identifiants et cookies sont conservés dans secrets/tiktok-chrome-profile/
 * L'état des envois est enregistré dans out/tiktok-uploaded.json
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT_DIR = __dirname;
const OUT_DIR = path.join(ROOT_DIR, 'out');
const SECRETS_DIR = path.join(ROOT_DIR, 'secrets');
const PROFILE_DIR = path.join(SECRETS_DIR, 'tiktok-chrome-profile');
const STATE_FILE = path.join(OUT_DIR, 'tiktok-uploaded.json');
const CALENDAR_FILE = path.join(OUT_DIR, 'calendrier-tiktok.csv');
const SHORTS_DIR = path.join(OUT_DIR, 'shorts');
const INSTALLER_DIR = path.join(OUT_DIR, 'installer');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ];
  const found = candidates.find((c) => c && fs.existsSync(c));
  if (!found) {
    throw new Error('Google Chrome introuvable. Installez Chrome ou définissez CHROME_PATH.');
  }
  return found;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCalendar() {
  if (!fs.existsSync(CALENDAR_FILE)) {
    throw new Error(`Le calendrier ${CALENDAR_FILE} est introuvable. Lancez d'abord "node plan.js".`);
  }
  const lines = fs.readFileSync(CALENDAR_FILE, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const items = [];
  // Parse CSV (délimiteur ;)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Regex pour découper les colonnes entre guillemets
    const cols = line.match(/(?:^|;)("(?:[^"]|"")*"|[^;]*)/g);
    if (!cols || cols.length < 4) continue;
    const clean = cols.map(c => c.replace(/^;/, '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
    const [dateStr, heureStr, file, caption] = clean;
    items.push({ dateStr, heureStr, file, caption });
  }
  return items;
}

async function getBrowser(connectMode) {
  if (connectMode) {
    console.log('Connexion au Chrome existant (http://localhost:9222)...');
    return await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  console.log(`Lancement de Chrome avec le profil : ${PROFILE_DIR}`);
  return await puppeteer.launch({
    executablePath: findChrome(),
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });
}

async function setup() {
  console.log('=== CONFIGURATION DU COMPTE TIKTOK ===');
  console.log('Une fenêtre Chrome va s\'ouvrir.');
  console.log('1. Connectez-vous à votre compte TikTok si ce n\'est pas déjà fait.');
  console.log('2. Cochez "Se souvenir de moi" ou laissez la session s\'enregistrer.');
  console.log('3. Une fois connecté sur TikTok Studio, fermez simplement la fenêtre Chrome.\n');

  const browser = await getBrowser(false);
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });
  } catch (e) {
    // Navigation standard
  }
  console.log('Page ouverte. En attente de votre connexion...');

  // Boucle de surveillance : attend que l'utilisateur soit connecté ou ferme Chrome
  return new Promise((resolve) => {
    browser.on('disconnected', () => {
      console.log('Fenêtre fermée : session et cookies enregistrés avec succès !');
      resolve();
    });

    const checkInterval = setInterval(async () => {
      try {
        const url = page.url();
        if (url.includes('/tiktokstudio/upload') && !url.includes('/login')) {
          console.log('\n>>> ✓ Connecté avec succès sur TikTok Studio !');
          console.log('>>> Vous pouvez fermer la fenêtre Chrome quand vous voulez.');
          clearInterval(checkInterval);
        }
      } catch (err) {
        // La page ou le navigateur a peut-être été fermé
        clearInterval(checkInterval);
        resolve();
      }
    }, 4000);
  });
}

async function uploadClip(page, item, dryRun) {
  // Trouver le fichier vidéo réel
  let videoPath = path.join(SHORTS_DIR, item.file);
  if (item.file.startsWith('installer/')) {
    videoPath = path.join(INSTALLER_DIR, item.file.replace('installer/', ''));
  }
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Fichier vidéo introuvable : ${videoPath}`);
  }

  console.log(`\nPréparation : ${item.file} (${path.basename(videoPath)})`);
  console.log(`Date programmée : ${item.dateStr} à ${item.heureStr}`);

  await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'networkidle2' });
  await sleep(3000);

  // Vérifier si connecté
  if (page.url().includes('/login')) {
    throw new Error('Vous n\'êtes pas connecté à TikTok ! Lancez d\'abord : node upload-tiktok.js setup');
  }

  // Trouver l'input de fichier vidéo
  console.log('Recherche du champ d\'envoi de fichier...');
  let fileInput = await page.$('input[type="file"][accept*="video"]');
  if (!fileInput) {
    fileInput = await page.$('input[type="file"]');
  }

  // Si l'input est dans un iframe (TikTok Creator)
  if (!fileInput) {
    for (const frame of page.frames()) {
      fileInput = await frame.$('input[type="file"]');
      if (fileInput) break;
    }
  }

  if (!fileInput) {
    throw new Error('Impossible de trouver le bouton d\'upload vidéo sur TikTok Studio.');
  }

  console.log(`Sélection de la vidéo : ${videoPath}`);
  await fileInput.uploadFile(videoPath);
  console.log('Vidéo envoyée, attente du traitement par TikTok...');

  // Attendre que le champ de légende soit actif (souvent un contenteditable ou input)
  await sleep(7000);

  // Sélecteurs possibles pour la légende TikTok
  const captionSelectors = [
    'div[contenteditable="true"]',
    '.public-DraftEditor-content',
    'div[data-placeholder]',
    'div[role="combobox"]',
    'textarea'
  ];

  let captionBox = null;
  for (const sel of captionSelectors) {
    captionBox = await page.$(sel);
    if (captionBox) break;
  }

  if (captionBox) {
    console.log('Remplissage de la légende...');
    await captionBox.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    // On tape la légende
    await captionBox.type(item.caption, { delay: 15 });
  } else {
    console.log('Champ de légende non détecté automatiquement, veuillez vérifier.');
  }

  // Option de programmation (Schedule)
  console.log('Recherche de l\'option de programmation (Schedule)...');
  try {
    const scheduleSwitch = await page.$('input[type="checkbox"][aria-label*="Schedule"], .schedule-switch, input[type="radio"][value*="schedule"]');
    if (scheduleSwitch) {
      const isChecked = await (await scheduleSwitch.getProperty('checked')).jsonValue();
      if (!isChecked) {
        await scheduleSwitch.click();
        await sleep(1000);
      }
    }
  } catch (e) {
    // Optionnel si le bouton direct suffit
  }

  if (dryRun) {
    console.log('MODE TEST (--dry-run) : La vidéo a été chargée sans cliquer sur Publier.');
    await sleep(5000);
    return true;
  }

  // Bouton de validation (Post / Schedule / Publier / Programmer)
  console.log('Recherche du bouton de publication...');
  await sleep(3000);

  const buttonSelectors = [
    'button[type="button"]:not([disabled])',
    'button.btn-post',
    'button[data-e2e="post_video_button"]'
  ];

  let postButton = null;
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await page.evaluate(el => el.innerText || '', btn)).toLowerCase().trim();
    if (text === 'programmer' || text === 'publier' || text === 'post' || text === 'schedule') {
      postButton = btn;
      break;
    }
  }

  if (postButton) {
    console.log('Clic sur le bouton de publication...');
    await postButton.click();
    await sleep(5000);
    console.log(`✓ ${item.file} publié ou programmé avec succès !`);
    return true;
  } else {
    console.log('Bouton de validation non détecté automatiquement. Vous pouvez cliquer manuellement.');
    await sleep(5000);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('setup') || args.includes('login')) {
    await setup();
    return;
  }

  const limit = Number(arg('limit', 2));
  const dryRun = args.includes('--dry-run');
  const connectMode = args.includes('--connect');

  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const calendar = loadCalendar();

  const todo = calendar.filter(item => !state[item.file]);
  if (!todo.length) {
    console.log('Tous les clips du calendrier TikTok ont déjà été envoyés !');
    return;
  }

  console.log(`=== PUBLICATION TIKTOK (${Math.min(limit, todo.length)} clip(s) à traiter sur ${todo.length} restant(s)) ===`);

  const browser = await getBrowser(connectMode);
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  let doneCount = 0;
  for (const item of todo.slice(0, limit)) {
    try {
      const ok = await uploadClip(page, item, dryRun);
      if (ok && !dryRun) {
        state[item.file] = {
          file: item.file,
          date: item.dateStr,
          heure: item.heureStr,
          uploadedAt: new Date().toISOString()
        };
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        doneCount++;
      }
    } catch (err) {
      console.error(`✗ Erreur pour ${item.file} :`, err.message);
      break;
    }
  }

  console.log(`\nFin de session : ${doneCount} clip(s) envoyé(s).`);
  if (!connectMode) {
    console.log('Fermeture du navigateur...');
    await browser.close();
  }
}

main().catch(err => {
  console.error('Erreur :', err.message || err);
  process.exit(1);
});
