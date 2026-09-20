import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Clé d'API protégeant les routes d'administration (upload / suppression audio).
// Définissez ADMIN_API_KEY dans l'environnement pour une valeur stable et persistante ;
// sinon une clé aléatoire est générée à chaque démarrage et affichée dans la console.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || crypto.randomBytes(24).toString('hex');
if (!process.env.ADMIN_API_KEY) {
  console.log(`⚠️  ADMIN_API_KEY non définie : clé temporaire générée pour cette session.`);
  console.log(`🔑 Clé d'administration : ${ADMIN_API_KEY}`);
  console.log(`   Définissez la variable d'environnement ADMIN_API_KEY pour une clé stable en production.`);
}

const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const providedKey = req.header('x-admin-key');
  if (!providedKey || providedKey !== ADMIN_API_KEY) {
    return res.status(401).json({ success: false, error: 'Non autorisé : clé admin invalide ou manquante' });
  }
  next();
};

// Dossier de stockage des fichiers audio
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'audios', 'serigne-aboul-baraka-mbacke');
const AZAN_DIR = path.join(__dirname, 'uploads', 'audios', 'azan');

// S'assurer que les dossiers d'upload existent
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(AZAN_DIR)) {
  fs.mkdirSync(AZAN_DIR, { recursive: true });
}

// Configuration de Multer pour le nommage normalisé (ex: 001.mp3, 114.mp3)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, _file, cb) => {
    const surahNumber = parseInt(req.body.surahNumber, 10);
    if (!surahNumber || surahNumber < 1 || surahNumber > 114) {
      return cb(new Error('Numéro de sourate invalide (1 à 114)'), '');
    }
    const paddedNumber = String(surahNumber).padStart(3, '0');
    cb(null, `${paddedNumber}.mp3`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Limite de 100 Mo par fichier audio
  fileFilter: (_req, file, cb) => {
    const hasMp3Extension = file.originalname.toLowerCase().endsWith('.mp3');
    const hasAudioMimetype = file.mimetype.includes('audio');
    if (hasMp3Extension && hasAudioMimetype) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers MP3 (extension .mp3 et type audio) sont autorisés'));
    }
  },
});

// Upload de l'azan (fichier unique : touba.mp3)
const azanStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AZAN_DIR),
  filename: (_req, _file, cb) => cb(null, 'touba.mp3'),
});

const azanUpload = multer({
  storage: azanStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Limite de 20 Mo (un azan est court)
  fileFilter: (_req, file, cb) => {
    const hasMp3Extension = file.originalname.toLowerCase().endsWith('.mp3');
    const hasAudioMimetype = file.mimetype.includes('audio');
    if (hasMp3Extension && hasAudioMimetype) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers MP3 (extension .mp3 et type audio) sont autorisés'));
    }
  },
});

// Middleware pour servir les fichiers audio statiques
app.use('/audios/serigne-aboul-baraka-mbacke', express.static(UPLOAD_DIR));
app.use('/audios/azan', express.static(AZAN_DIR));

// Servir l'interface d'administration Web
app.use('/admin', express.static(path.join(__dirname, 'public')));

// API: statut des 114 sourates (fichiers téléversés ou manquants)
app.get('/api/admin/audio-status', requireAdminAuth, (_req: Request, res: Response) => {
  const statusList = Array.from({ length: 114 }, (_, i) => {
    const surahNumber = i + 1;
    const padded = String(surahNumber).padStart(3, '0');
    const fileName = `${padded}.mp3`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    const exists = fs.existsSync(filePath);

    return {
      surahNumber,
      fileName,
      exists,
      url: exists ? `/audios/serigne-aboul-baraka-mbacke/${fileName}` : null,
      sizeBytes: exists ? fs.statSync(filePath).size : 0,
    };
  });

  res.json({
    reciter: 'Serigne Aboul Baraka Mbacké',
    totalSurahs: 114,
    uploadedCount: statusList.filter((s) => s.exists).length,
    surahs: statusList,
  });
});

// API: Uploader le fichier MP3 d'une sourate
app.post('/api/admin/upload-audio', requireAdminAuth, upload.single('audio'), (req: Request, res: Response) => {
  try {
    const surahNumber = parseInt(req.body.surahNumber, 10);
    const paddedNumber = String(surahNumber).padStart(3, '0');
    const fileName = `${paddedNumber}.mp3`;

    res.json({
      success: true,
      message: `Audio pour la Sourate ${surahNumber} téléversé avec succès !`,
      fileName,
      url: `/audios/serigne-aboul-baraka-mbacke/${fileName}`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
// API: Supprimer le fichier MP3 d'une sourate
app.delete('/api/admin/delete-audio/:surahNumber', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const surahNumber = parseInt(req.params.surahNumber, 10);
    if (!surahNumber || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({ success: false, error: 'Numéro de sourate invalide (1 à 114)' });
    }
    const paddedNumber = String(surahNumber).padStart(3, '0');
    const fileName = `${paddedNumber}.mp3`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({
        success: true,
        message: `Fichier MP3 de la sourate ${surahNumber} supprimé avec succès !`,
      });
    } else {
      return res.status(404).json({ success: false, error: 'Fichier non trouvé' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: statut du fichier audio de l'azan (Grande Mosquée de Touba)
app.get('/api/admin/azan-status', requireAdminAuth, (_req: Request, res: Response) => {
  const filePath = path.join(AZAN_DIR, 'touba.mp3');
  const exists = fs.existsSync(filePath);
  res.json({
    exists,
    url: exists ? '/audios/azan/touba.mp3' : null,
    sizeBytes: exists ? fs.statSync(filePath).size : 0,
  });
});

// API: Uploader le fichier MP3 de l'azan (Grande Mosquée de Touba)
app.post('/api/admin/upload-azan', requireAdminAuth, azanUpload.single('audio'), (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: `Audio de l'azan de Touba téléversé avec succès !`,
    url: '/audios/azan/touba.mp3',
  });
});

// API: Supprimer le fichier MP3 de l'azan
app.delete('/api/admin/delete-azan', requireAdminAuth, (_req: Request, res: Response) => {
  try {
    const filePath = path.join(AZAN_DIR, 'touba.mp3');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ success: true, message: `Fichier audio de l'azan supprimé avec succès !` });
    }
    return res.status(404).json({ success: false, error: 'Fichier non trouvé' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint de santé
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'AL BARAKA Backend & Admin Audio API' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Serveur AL BARAKA démarré sur http://localhost:${PORT}`);
  console.log(`🎙️ Interface Admin Audio : http://localhost:${PORT}/admin`);
  console.log(`🎵 Dossier d'écoute MP3  : http://localhost:${PORT}/audios/serigne-aboul-baraka-mbacke/`);
  console.log(`====================================================`);
});
