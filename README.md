# AL BARAKA

**Le Saint Coran en riwaya Warsh, récité par Serigne Aboul Baraka Mbacké.**

Application gratuite et sans publicité, utilisable dans le navigateur et installable sur
Android et iPhone (PWA). Une version Android native (Play Store) est prévue avec le même code.

🔗 **En ligne : https://al-baraka-app.pages.dev**

---

## Sommaire

1. [Pourquoi AL BARAKA](#1-pourquoi-al-baraka)
2. [Fonctionnalités](#2-fonctionnalités)
3. [Installer l'application sur son téléphone](#3-installer-lapplication-sur-son-téléphone)
4. [Architecture](#4-architecture)
5. [Structure du dépôt](#5-structure-du-dépôt)
6. [Démarrer en local](#6-démarrer-en-local)
7. [Commandes](#7-commandes)
8. [Données coraniques](#8-données-coraniques)
9. [Les récitations audio](#9-les-récitations-audio)
10. [Données enregistrées sur l'appareil](#10-données-enregistrées-sur-lappareil)
11. [Mise en ligne](#11-mise-en-ligne)
12. [Statistiques de fréquentation](#12-statistiques-de-fréquentation)
13. [Feuille de route](#13-feuille-de-route)
14. [Sources et remerciements](#14-sources-et-remerciements)

---

## 1. Pourquoi AL BARAKA

L'application est née de deux objectifs :

1. **Valoriser un qari sénégalais.** AL BARAKA rassemble la récitation intégrale des 114 sourates
   par **Serigne Aboul Baraka Mbacké** et la rend accessible partout, au Sénégal comme dans la
   diaspora.
2. **Promouvoir la riwaya Warsh et servir de référence.** La lecture Warsh est répandue en
   Afrique de l'Ouest et du Nord, mais elle est difficile à maîtriser et les outils numériques
   fiables sont rares. Avec AL BARAKA, on touche un verset du Mushaf Warsh et on l'entend
   aussitôt, correctement récité : on sait comment se lit un mot ou un passage.

## 2. Fonctionnalités

| Écran | Ce qu'il propose |
|---|---|
| **Accueil** | Basmala et date (hégirienne et grégorienne) ; « Reprendre » sépare **l'écoute** (dernière sourate et position audio) et **la lecture** (dernière page du Mushaf) ; **verset du jour** (« Voir plus » ouvre sa page) ; favoris ; contact ; réglages ; thème clair ou sombre. |
| **Verset du jour** | Texte Warsh, écoute du seul verset, partage, traduction française (Muhammad Hamidullah) ; traduction wolof à venir. |
| **Mushaf** | Les 604 pages du Mushaf Warsh (Complexe Roi Fahd), page par page, en plein écran (la barre d'onglets se cache) ; index des sourates et des Juz' ; recherche d'un mot arabe sans tenir compte des voyelles ; signet ; taille du texte réglable. Toucher un verset propose de **l'écouter**, de **suivre la récitation** à partir de ce verset (verset surligné et page tournée automatiquement), de l'ajouter aux favoris ou de le **partager en image**. |
| **Lecteur audio** | Les 114 sourates ; lecture et pause, avance et retour ; lecture en arrière-plan avec le nom de la sourate sur l'écran de verrouillage (Media Session sur le web). |
| **Chapelet** | Compteur de zikr avec objectifs (33, 99, 100 ou personnalisé), vibration, statistiques et remise à zéro confirmée. |
| **Sadaqah** | Soutien au projet. |
| **Favoris** | Sourates et versets enregistrés. |

Autres caractéristiques :

- **Thème clair aux couleurs du Mushaf** (ivoire, vert, or) et **thème sombre**, au choix dans
  l'app : le mode sombre du téléphone n'est pas appliqué au site.
- **Partage en image** : chaque verset est dessiné sur une carte 1080x1350 (cadre vert et or,
  bandeau de sourate, référence, page du Mushaf, récitateur, adresse du site), envoyée par le
  partage du téléphone ou téléchargée.
- **Bouton retour du téléphone** géré dans la PWA : il ferme la fenêtre ouverte ou revient à
  l'écran précédent au lieu de quitter l'app.
- **Fonctionne hors ligne** pour le texte (embarqué dans l'app). L'audio, lui, demande une
  connexion.

## 3. Installer l'application sur son téléphone

Aucun store n'est nécessaire.

- **Android (Chrome, Samsung Internet)** : ouvrir https://al-baraka-app.pages.dev, puis menu ⋮ →
  **« Installer l'application »** ou **« Ajouter à l'écran d'accueil »**.
- **iPhone (Safari)** : ouvrir le lien, puis bouton **Partager** → **« Sur l'écran d'accueil »**.

L'icône AL BARAKA apparaît alors avec les autres applications et s'ouvre en plein écran.

## 4. Architecture

```
                 ┌───────────────────────── Cloudflare ─────────────────────────┐
 Téléphone /     │                                                              │
 navigateur ───► │  Pages : site (PWA) exporté par Expo   ───  /audio/…  ───►   │
 (PWA)           │          + service worker (sw.js)            Pages Function │
                 │                                              (lecture par   │
                 │                                               plages, cache │
                 │                                               de proximité) │
                 │                                                    │         │
                 │                                                    ▼         │
                 │                                    R2 « al-baraka-audio »    │
                 │                                    (114 MP3, ≈ 1,8 Go)       │
                 └──────────────────────────────────────────────────────────────┘
                                 │
                                 └──► api.alquran.cloud (liste des sourates, traduction française)
```

- **Application** : React Native + Expo SDK 54, en TypeScript. Le même code produit le site web
  (React Native Web) et l'application Android ou iOS.
- **Navigation** : React Navigation (onglets du bas et pile d'écrans).
- **Audio** : `expo-av` (sur le web, un élément `<audio>` HTML).
- **Hébergement** : Cloudflare Pages (gratuit). Le site est redéployé automatiquement à chaque
  push sur `main` par une GitHub Action.
- **Récitations** : Cloudflare R2, servies par la fonction `frontend/functions/audio/[[path]].js` :
  - **Lecture par plages (`Range`)** : on peut démarrer au milieu d'une longue sourate sans
    télécharger le début.
  - **Cache Cloudflare de proximité** : chaque fichier est copié près de l'auditeur dès la
    première écoute.
  - **Cache du navigateur** : 30 jours.
- **Texte du Coran** : embarqué dans l'app (`warshMushaf.json`). Aucun appel réseau n'est
  nécessaire pour lire le Mushaf.
- **Backend Express** (`backend/`) : serveur **de développement uniquement**, qui sert les MP3
  en local. Il n'est pas utilisé en production.

## 5. Structure du dépôt

```
AL BARAKA/
├── README.md                    ce fichier
├── DEPLOIEMENT.md               mise en ligne pas à pas (R2, Pages, EAS)
├── .github/workflows/
│   └── deploy-web.yml           déploiement automatique du site à chaque push sur main
├── frontend/                    l'application (Expo / React Native)
│   ├── App.tsx                  point d'entrée : polices, thème, navigation
│   ├── app.json                 configuration Expo (nom, icônes, identifiants Android/iOS)
│   ├── eas.json                 profils de build Android (APK de test, AAB Play Store)
│   ├── wrangler.toml            configuration Cloudflare Pages + lien vers R2
│   ├── functions/audio/[[path]].js   fonction Cloudflare qui sert les récitations
│   ├── public/                  fichiers web : index.html, manifeste PWA, sw.js, _headers, icônes
│   ├── assets/fonts/            police KFGQPC Warsh (et sa licence)
│   ├── scripts/                 vérification de l'adresse audio, correctif d'export, envoi R2, icônes
│   └── src/
│       ├── screens/             Accueil, Mushaf, Lecteur, Chapelet, Verset, Sourate, Recherche, Favoris
│       ├── components/          modales (réglages, partage, contact, sadaqah…), lecteur, mushaf/
│       ├── navigation/          onglets, pile d'écrans, bouton retour du web
│       ├── services/            audio, signets, favoris, chapelet, recherche, carte de partage…
│       ├── context/ThemeContext.tsx   couleurs des thèmes clair et sombre
│       ├── config/audioConfig.ts      adresse des MP3 (production ou serveur local)
│       ├── data/                Mushaf Warsh, minutages des versets, correspondance Warsh/Hafs
│       └── assets/              photo du récitateur
└── backend/                     outils hors application
    ├── server.ts                serveur Express de développement (audio local, envoi de MP3)
    ├── scripts/                 génération des données (Mushaf, minutages, correspondance) et envoi archive.org
    └── uploads/                 MP3 001…114 (non versionnés, trop volumineux)
```

Le dossier `AL BARAKA SONGS/` (enregistrements d'origine) et `backend/uploads/` ne sont pas
versionnés, car ils pèsent plusieurs gigaoctets.

## 6. Démarrer en local

Prérequis : **Node.js 22** et **npm**. Pour les scripts audio, il faut aussi **ffmpeg**.

```bash
git clone https://github.com/bara-samb/al-baraka.git
cd al-baraka/frontend
npm install
cp .env.example .env        # puis renseigner EXPO_PUBLIC_AUDIO_BASE_URL
npm run web                 # ouvre l'app dans le navigateur
```

**Où l'app cherche l'audio :**
- **Avec `EXPO_PUBLIC_AUDIO_BASE_URL`** (adresse https terminée par `/`) : l'app lit les
  récitations en ligne. Pour lire celles de production :
  `https://al-baraka-app.pages.dev/audio/serigne-aboul-baraka-mbacke/`
- **Sans cette variable** : l'app cherche le serveur de développement local sur le port 4000.
  Elle détecte d'elle-même l'adresse du PC depuis Expo Go et l'émulateur Android.

Pour lancer ce serveur local, il faut les MP3 dans `backend/uploads/audios/serigne-aboul-baraka-mbacke/` :

```bash
cd backend
npm install
npm run dev
```

**Sur un téléphone avec Expo Go** : `npm start` dans `frontend/`, puis scanner le QR code.
Le téléphone et le PC doivent être sur le même Wi-Fi.

## 7. Commandes

À lancer depuis `frontend/` :

| Commande | Rôle |
|---|---|
| `npm start` | Serveur Expo (Expo Go, émulateurs) |
| `npm run web` | Version web en développement |
| `npm run android` / `npm run ios` | Lancement sur émulateur |
| `npm run build:web` | Export du site dans `dist/`. Refuse de construire si l'adresse audio manque, puis corrige les chemins des polices d'icônes pour Cloudflare Pages |
| `npm run deploy:web` | Export puis mise en ligne manuelle sur Cloudflare Pages |
| `npm run audio:upload:r2` | Envoi des MP3 vers R2 (relançable : ce qui est déjà envoyé est ignoré) |
| `npm run audio:upload` | Copie de secours des MP3 sur archive.org |

À lancer depuis `backend/scripts/` (avec `node`) :

| Script | Rôle |
|---|---|
| `build-warsh-mushaf.js` | Construit `warshMushaf.json` à partir des données KFGQPC : 6214 versets, 604 pages, Juz' et huitièmes de Hizb |
| `build-hafs-mapping.js` | Construit `warshHafsMap.json` : correspondance Warsh → Hafs, pour aller chercher les traductions |
| `generate-ayah-timings.js` | Construit `ayahTimings.json` : instant de début de chaque verset dans les 114 MP3 |
| `detect-ayah-pauses.js <n>` | Contrôle manuel du découpage d'une sourate |
| `upload-audio-archive.py` | Envoi sur archive.org (appelé par `npm run audio:upload`) |

## 8. Données coraniques

| Fichier (`frontend/src/data/`) | Contenu |
|---|---|
| `warshMushaf.json` | Texte du Mushaf Warsh du Complexe Roi Fahd (KFGQPC), numérotation Warsh (madani), pages, Juz', huitièmes de Hizb (۞) |
| `ayahTimings.json` | Pour chaque sourate, la seconde où commence chaque verset dans l'enregistrement |
| `warshHafsMap.json` | Pour chaque verset Warsh, le ou les versets Hafs correspondants |

**Pourquoi une correspondance Warsh → Hafs ?** Le découpage en versets n'est pas le même en
Warsh et en Hafs. Les traductions en ligne (api.alquran.cloud, `fr.hamidullah`) suivent la
numérotation Hafs. L'app convertit donc chaque verset Warsh vers son ou ses équivalents Hafs
avant de demander la traduction.

**Comment sont obtenus les minutages ?** Il n'existe pas de fichier par verset : chaque sourate
est un seul enregistrement. Le script `backend/scripts/lib/silenceSegmenter.js` calcule le
découpage :
1. Il repère les pauses dans l'audio.
2. Il estime la durée attendue de chaque verset d'après son texte (lettres, voyelles longues,
   madd).
3. Il choisit, pour toute la sourate à la fois, les pauses les plus cohérentes avec ces durées.

Ces minutages servent à trois choses : écouter un seul verset, démarrer une sourate à un verset
précis, et surligner le verset récité dans le Mushaf.

## 9. Les récitations audio

- **Les fichiers** : 114 fichiers `001.mp3` à `114.mp3`, environ 1,8 Go au total.
- **En production** : à l'adresse `https://al-baraka-app.pages.dev/audio/serigne-aboul-baraka-mbacke/NNN.mp3`.
- **Copie de secours** : sur archive.org (élément `al-baraka-serigne-aboul-baraka-mbacke-warsh`),
  plus lente.
- **Remplacer un enregistrement** :
  1. Remplacer le MP3 dans `backend/uploads/audios/serigne-aboul-baraka-mbacke/`.
  2. Relancer `npm run audio:upload:r2`.
  3. Régénérer les minutages avec `generate-ayah-timings.js`.
  4. Redéployer.

  Le détail est dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

**Lecture sur mobile.** Certains navigateurs ignorent la position de départ demandée et
repartent du début de la sourate. Le service audio (`src/services/audioService.ts`) vérifie la
position réelle et repositionne la lecture tant que le bon verset n'est pas atteint. Quand on
écoute un seul verset, la lecture s'arrête d'elle-même à la fin de ce verset.

## 10. Données enregistrées sur l'appareil

Rien n'est envoyé à un serveur, et il n'y a pas de compte. Tout est gardé dans le stockage local
du navigateur ou du téléphone (AsyncStorage) :

| Clé | Contenu |
|---|---|
| `@albaraka_theme_mode` | Thème clair ou sombre |
| `@albaraka_arabic_font_size` | Taille du texte arabe |
| `@albaraka_last_listen` | Dernière sourate écoutée et position |
| `@albaraka_last_read_bookmark` | Dernier verset lu |
| `@albaraka_mushaf_last_page` | Dernière page ouverte du Mushaf |
| `@albaraka_mushaf_signet` | Signet du Mushaf |
| `@albaraka_fav_surahs` / `@albaraka_fav_ayahs` | Favoris |
| `@albaraka_tasbih_stats` | Statistiques du chapelet |
| `@albaraka_surah_list` | Liste des sourates mise en cache |
| `@albaraka_numbering` | Repère de migration (ancienne numérotation Hafs → Warsh) |

Ces données sont liées à l'adresse du site. **Si l'adresse change** (passage de `pages.dev` à un
nom de domaine), les utilisateurs repartent de zéro et doivent réinstaller l'app. D'où l'intérêt
de choisir le nom de domaine définitif avant la promotion.

## 11. Mise en ligne

Tout est détaillé dans **[DEPLOIEMENT.md](DEPLOIEMENT.md)**. En résumé :

- **Site** : chaque push sur `main` qui touche `frontend/` déclenche la GitHub Action
  `deploy-web.yml`. Elle exporte le site et le publie sur Cloudflare Pages. Elle a besoin de deux
  secrets GitHub : `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
- **Audio** : `npm run audio:upload:r2`.
- **Nom de domaine** : dans Cloudflare, *Workers & Pages* → `al-baraka-app` → *Custom domains*.
  Pensez ensuite à remplacer l'adresse dans `EXPO_PUBLIC_AUDIO_BASE_URL`, à la fois dans
  `deploy-web.yml` et dans `.env`.
- **Android (Play Store)** : par EAS Build (`eas build -p android`), ou en local avec Gradle. Le
  compte développeur Google Play coûte 25 $, une seule fois.

**Mettre à jour l'app installée.** Le service worker (`public/sw.js`) charge la page depuis le
réseau en priorité, donc une mise à jour arrive à la réouverture de l'app. Pour vider les
anciens caches, augmentez `CACHE_VERSION` dans ce fichier.

## 12. Statistiques de fréquentation

On utilise **Cloudflare Web Analytics**, gratuit et sans cookies. Pour l'activer : tableau de bord
Cloudflare → *Workers & Pages* → `al-baraka-app` → *Metrics* → *Web Analytics* → *Enable*.

On y voit :
- les visiteurs et les pages vues ;
- les pays et les appareils ;
- l'origine des visites (WhatsApp, Facebook…).

## 13. Feuille de route

- [ ] Traduction en **wolof** des versets (source reconnue à trouver)
- [ ] Nom de domaine définitif (`albarakacoran.com` / `.org` sont libres)
- [ ] Publication sur le **Play Store**
- [ ] Notification de lecture en arrière-plan sur Android natif (migration vers `expo-audio`)
- [ ] Écoute hors ligne dans la PWA

## 14. Sources et remerciements

- **Récitation** : Serigne Aboul Baraka Mbacké.
- **Texte et police du Mushaf Warsh** : King Fahd Glorious Quran Printing Complex (KFGQPC),
  via [quran-data-kfgqpc](https://github.com/thetruetruth/quran-data-kfgqpc). La police est
  incluse sans modification, selon sa licence (`frontend/assets/fonts/KFGQPC_Warsh-LICENSE.txt`) :
  elle ne peut être ni vendue ni modifiée.
- **Traduction française** : Muhammad Hamidullah, via [api.alquran.cloud](https://alquran.cloud/api).
- **Hébergement** : Cloudflare Pages et R2.

---

Dépôt : [github.com/bara-samb/al-baraka](https://github.com/bara-samb/al-baraka)
