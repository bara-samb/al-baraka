# Déploiement d'AL BARAKA (gratuit)

- **Récitations audio (≈ 1,8 Go)** : Cloudflare R2 (offre gratuite jusqu'à 10 Go, carte
  bancaire enregistrée mais rien n'est prélevé), servies par le site lui-même à l'adresse
  `/audio/…` (fonction `frontend/functions/audio/[[path]].js`, lecture par plages). Démarrage
  rapide, y compris au milieu d'une longue sourate. Copie de secours sur Internet Archive
  (archive.org), gratuite mais lente (souvent 5 à 10 s avant le premier son).
- **Site web (PWA)** : Cloudflare Pages — offre gratuite, sans moyen de paiement.
  En ligne : https://al-baraka-app.pages.dev
- **Application Android (Play Store)** : EAS Build (Expo), qui lit l'audio au même endroit.

Toutes les commandes `npm run …` se lancent depuis `frontend/`.

## 1. Audio sur Cloudflare R2

Une seule fois (déjà fait) : activer R2 dans le tableau de bord Cloudflare, puis créer l'espace :

```bash
npx wrangler r2 bucket create al-baraka-audio
```

Le lien entre le site et cet espace est déclaré dans `frontend/wrangler.toml` (`[[r2_buckets]]`,
nom `AUDIO`). Envoyer les fichiers (relançable sans risque : ceux déjà envoyés, notés avec leur
taille dans `backend/uploads/.r2-uploaded.txt`, sont ignorés) :

```bash
npm run audio:upload:r2
```

Les MP3 de `backend/uploads/audios/serigne-aboul-baraka-mbacke/` sont lus par le site à l'adresse :

```
EXPO_PUBLIC_AUDIO_BASE_URL=https://al-baraka-app.pages.dev/audio/serigne-aboul-baraka-mbacke/
```

(dans `frontend/.env`, dans `.github/workflows/deploy-web.yml` et pour EAS, voir plus bas).

## 1 bis. Copie de secours sur archive.org

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

Pour revenir à archive.org en cas de besoin, utiliser cette adresse dans `EXPO_PUBLIC_AUDIO_BASE_URL` :

```
https://archive.org/download/al-baraka-serigne-aboul-baraka-mbacke-warsh/audios/serigne-aboul-baraka-mbacke/
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

Ensuite, **chaque push sur `main`** qui touche `frontend/` met le site à jour automatiquement
(GitHub Action `.github/workflows/deploy-web.yml`, suivi dans l'onglet *Actions* du dépôt).
Elle a besoin, une seule fois, de deux secrets dans GitHub (*Settings* → *Secrets and
variables* → *Actions* → *New repository secret*) :

- `CLOUDFLARE_API_TOKEN` : sur https://dash.cloudflare.com/profile/api-tokens → *Create Token*
  → *Create Custom Token*, permission *Account* → *Cloudflare Pages* → *Edit*.
- `CLOUDFLARE_ACCOUNT_ID` : l'identifiant du compte (*Account ID*, affiché par
  `npx wrangler whoami` ou dans la colonne de droite du tableau de bord).

Pour mettre en ligne sans passer par GitHub (depuis votre ordinateur) :

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
eas env:create --environment production --environment preview --name EXPO_PUBLIC_AUDIO_BASE_URL --value "https://al-baraka-app.pages.dev/audio/serigne-aboul-baraka-mbacke/" --visibility plaintext
eas build -p android --profile preview    # APK à installer directement pour tester (gratuit)
eas build -p android --profile production # fichier .aab pour le Play Store
eas submit -p android                     # envoi vers la Play Console
```

Le fichier `.env` n'est pas envoyé à EAS (il n'est pas versionné) : c'est pourquoi l'adresse
audio est déclarée avec `eas env:create`.

## Mettre à jour

- **Code ou textes** : `npm run deploy:web` (site) et `eas build` (Android).
- **Un MP3 corrigé** : le remplacer dans `backend/uploads/audios/`, puis `npm run audio:upload:r2`
  (fichiers dont la taille a changé ; si elle est identique, retirer sa ligne de
  `backend/uploads/.r2-uploaded.txt`) et `npm run audio:upload` (copie archive.org).
- **Minutages des versets** (après changement d'audio) : voir
  `backend/scripts/generate-ayah-timings.js`, puis redéployer.
