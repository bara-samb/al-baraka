# Déploiement d'AL BARAKA (gratuit, sans carte bancaire)

- **Récitations audio (≈ 1,8 Go)** : Internet Archive (archive.org) — gratuit, sans limite de
  stockage ni de trafic ; sert les MP3 en `audio/mpeg`, avec lecture par plages et CORS ouvert.
- **Site web (PWA)** : Cloudflare Pages — offre gratuite, sans moyen de paiement.
  En ligne : https://al-baraka-app.pages.dev
- **Application Android (Play Store)** : EAS Build (Expo), qui lit l'audio au même endroit.

Toutes les commandes `npm run …` se lancent depuis `frontend/`.

## 1. Audio sur archive.org

Une seule fois :

1. Créer un compte gratuit sur https://archive.org/account/signup (e-mail + mot de passe) et
   confirmer l'e-mail reçu.
2. Installer l'outil et s'y connecter **dans votre terminal** (il demande e-mail et mot de passe) :
   ```bash
   python -m pip install --user internetarchive==5.11.1
   ia configure
   ```

Puis envoyer les fichiers (relançable sans risque : ce qui est déjà en ligne est ignoré) :

```bash
npm run audio:upload
```

Les MP3 sont lus dans `backend/uploads/audios/` et publiés dans l'élément
`al-baraka-serigne-aboul-baraka-mbacke-warsh`, avec la même arborescence
(`audios/serigne-aboul-baraka-mbacke/NNN.mp3`, `audios/azan/touba.mp3`). Un nouvel élément peut
mettre quelques minutes à être accessible.

Enfin, créer `frontend/.env` à partir de `frontend/.env.example` avec l'adresse affichée à la fin :

```
EXPO_PUBLIC_AUDIO_BASE_URL=https://archive.org/download/al-baraka-serigne-aboul-baraka-mbacke-warsh/audios/serigne-aboul-baraka-mbacke/
```

## 2. Site web sur Cloudflare

Une seule fois :

1. Créer un compte gratuit sur https://dash.cloudflare.com/sign-up.
2. Se connecter depuis le terminal (une page s'ouvre dans le navigateur, cliquer sur *Allow*) :
   ```bash
   npx wrangler login
   ```
   En cas d'erreur « CSRF » : fermer les onglets Cloudflare, couper le VPN du navigateur, se
   connecter d'abord sur https://dash.cloudflare.com, puis relancer la commande.
3. Créer le projet Pages (déjà fait pour `al-baraka-app` ; `--force` évite que wrangler le
   redirige vers Workers) :
   ```bash
   npx wrangler pages project create al-baraka-app --production-branch main --force
   ```

Puis, à chaque mise à jour du site :

```bash
npm run deploy:web       # exporte le site puis le met en ligne (wrangler pages deploy)
```

La configuration est dans `frontend/wrangler.toml` (dossier `dist` ; sans `404.html`, Pages
renvoie l'app pour toute adresse inconnue) et les règles de cache dans `frontend/public/_headers`.

`deploy:web` refuse de construire le site si `EXPO_PUBLIC_AUDIO_BASE_URL` n'est pas définie
(sinon l'app chercherait l'audio sur un serveur local). L'adresse du site
s'affiche à la fin ; un nom de domaine peut se brancher plus tard dans le tableau de bord
Cloudflare : *Workers & Pages* → `al-baraka-app` → *Custom domains*.

## 3. Application Android (Play Store)

L'ouverture d'un compte développeur Google Play coûte **25 $ une seule fois** (carte Visa ou
Mastercard). En attendant, l'app s'installe gratuitement depuis le site (PWA : menu du
navigateur → « Installer l'application » / « Ajouter à l'écran d'accueil »).

```bash
npm install -g eas-cli
eas login
eas init                                  # relie le projet à votre compte Expo (gratuit)
eas env:create --environment production --name EXPO_PUBLIC_AUDIO_BASE_URL --value "https://archive.org/download/al-baraka-serigne-aboul-baraka-mbacke-warsh/audios/serigne-aboul-baraka-mbacke/" --visibility plaintext
eas build -p android --profile preview    # APK à installer directement pour tester (gratuit)
eas build -p android --profile production # fichier .aab pour le Play Store
eas submit -p android                     # envoi vers la Play Console
```

Le fichier `.env` n'est pas envoyé à EAS (il n'est pas versionné) : c'est pourquoi l'adresse
audio est déclarée avec `eas env:create`.

## Mettre à jour

- **Code ou textes** : `npm run deploy:web` (site) et `eas build` (Android).
- **Un MP3 corrigé** : le remplacer dans `backend/uploads/audios/`, puis `npm run audio:upload`
  (seuls les fichiers modifiés sont renvoyés).
- **Minutages des versets** (après changement d'audio) : voir
  `backend/scripts/generate-ayah-timings.js`, puis redéployer.
