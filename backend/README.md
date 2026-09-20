# Backend & Stockage Audio - AL BARAKA

Ce dossier contient les ressources et la configuration pour le backend et l'hébergement des fichiers audio MP3 de l'application **AL BARAKA**.

## 1. Hébergement des Fichiers Audio MP3
Les récitations audio de **Serigne Aboul Baraka Mbacké** sont stockées à distance et nommées selon la convention à 3 chiffres :
- `001.mp3` (Sourate Al-Fatiha)
- `002.mp3` (Sourate Al-Baqarah)
- ...
- `114.mp3` (Sourate An-Nas)

### Options d'hébergement recommandées :
1. **Supabase Storage** (Recommandé - Bucket public avec CDN gratuit).
2. **AWS S3 / Cloudflare R2** avec distribution CloudFront.
3. **GitHub Releases** (Solution gratuite simple pour MVP).

## 2. API Node.js / Express Optionnelle (`server.ts`)
Si vous souhaitez ajouter des fonctionnalités personnalisées (statistiques d'écoute, favoris synchronisés, gestion des récitateurs), un serveur Express TypeScript basique est prêt dans ce dossier.

### Démarrage du serveur backend :
```bash
npm install
npm run dev
```
