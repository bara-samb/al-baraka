# Vidéos AL BARAKA (YouTube, Shorts, TikTok)

Cet outil fabrique les vidéos des récitations de Serigne Aboul Baraka Mbacké à partir des
données de l'application, puis aide à les publier.

- **Vidéos longues (YouTube, 16:9)** : une vidéo par sourate. Un écran titre avec la basmala,
  puis chaque verset (texte Warsh et traduction française) affiché pendant qu'il est récité,
  et un écran final qui renvoie vers l'application.
- **Clips verticaux (Shorts et TikTok, 9:16)** : quelques versets consécutifs, 60 s au plus. Les
  marges laissent la place aux boutons de TikTok et de YouTube.

Les images sont dessinées par Chrome avec la police Warsh officielle de l'application. Les
minutages viennent de `frontend/src/data/ayahTimings.json`. Un verset trop long pour un seul
écran est découpé en plusieurs écrans.

## Installation (une seule fois)

Il faut **Node.js 22**, **Google Chrome**, et les MP3 dans
`backend/uploads/audios/serigne-aboul-baraka-mbacke/`. ffmpeg est installé avec l'outil.

```bash
cd video
npm install
```

## 1. Fabriquer les vidéos

```bash
node render.js long 1            # Al-Fatiha, vidéo YouTube
node render.js long 78-114       # tout le Juz' Amma
node render.js long all          # les 114 sourates (plusieurs heures)
node render.js shorts 112-114    # clips verticaux des trois dernières sourates
node render.js shorts 36 --max 45   # Ya-Sin en clips de 45 s au plus
```

Option `--no-fr` : sans la traduction française.

Les vidéos arrivent dans `out/youtube/` et `out/shorts/`. Chaque vidéo a un `.json` (titre,
description, mots-clés), et chaque clip un `.txt` (légende TikTok). Ce qui existe déjà n'est pas
refait : on peut relancer une commande interrompue.

**À regarder avant de publier.** Le découpage par verset est calculé automatiquement d'après les
pauses du récitateur. Il peut se tromper d'un verset par endroits. Il faut donc regarder chaque
vidéo avant de la publier : une erreur dans un texte du Coran n'est pas acceptable. Pour
corriger un minutage, voir `backend/scripts/detect-ayah-pauses.js` (README principal, §7).

## 2. Publier sur YouTube automatiquement

### Une seule fois : l'accès à la chaîne

1. Sur https://console.cloud.google.com, créer un projet (par exemple « AL BARAKA »).
2. *API et services* → *Bibliothèque* : activer **YouTube Data API v3**.
3. *Écran de consentement OAuth* : type « Externe », ajouter votre adresse Gmail comme
   utilisateur test.
4. *Identifiants* → *Créer des identifiants* → *ID client OAuth* → type **Application de
   bureau**. Télécharger le JSON et l'enregistrer sous `video/secrets/client_secret.json`.
5. Au premier envoi, une page Google s'ouvre : choisir **la chaîne AL BARAKA** et accepter.

Ensuite, `node upload-youtube.js setup` ouvre la page d'autorisation, puis crée les playlists
(« Coran complet », « Juz' Amma », « Un verset par jour »). Chaque vidéo est rangée
automatiquement dans la bonne playlist.

### Envoi automatique chaque jour

`publier.cmd` envoie 2 sourates et 3 clips par jour. Une sourate est publiée chaque jour à 18 h,
et deux clips à 12 h et 20 h. Le journal est dans `out/publication.log`. La tâche Windows
« AL BARAKA - Publication YouTube » lance ce fichier chaque jour à 10 h (ou dès que le PC est
allumé, si 10 h est passé).

### L'envoi à la main

```bash
node upload-youtube.js long --start 2026-11-01 --hours 18
node upload-youtube.js shorts --start 2026-11-01 --hours 12,19
```

Les vidéos partent en privé, **programmées** : YouTube les publie seul, un créneau après
l'autre (`--hours 12,19` donne deux publications par jour, à 12 h et à 19 h). L'API gratuite
permet **6 envois par jour** (`--limit`). Relancez la même commande chaque jour : elle reprend
où elle s'était arrêtée (`out/youtube-uploaded.json`) et continue le calendrier.

> **Important : l'audit de l'API.** Tant que le projet Google n'est pas validé, YouTube
> **bloque en privé** toutes les vidéos envoyées par l'API, même programmées. Il faut demander
> l'audit (gratuit) avec le formulaire *YouTube API Services – Audit and Quota Extension*. Cela
> prend en général de quelques jours à quelques semaines.
> En attendant : envoyez les vidéos depuis **YouTube Studio** (jusqu'à 15 à la fois), en
> copiant titre et description depuis les `.json`, et programmez-les dans Studio.

## 3. Publier sur TikTok

TikTok n'autorise la publication automatique qu'aux applications validées par TikTok, et une
application non validée ne peut publier qu'en privé. La méthode la plus simple :

```bash
node plan.js --start 2026-11-01 --hours 12,19
```

Le script crée `out/calendrier-tiktok.csv`, qui s'ouvre dans Excel : date, heure, fichier et
légende de chaque clip. Ensuite, sur **TikTok Studio** dans le navigateur
(https://www.tiktok.com/tiktokstudio/upload) :

1. Envoyer le clip.
2. Coller la légende.
3. Choisir *Programmer* (jusqu'à 10 jours à l'avance).

Les mêmes clips servent pour les **YouTube Shorts**.

## 4. Clips d'installation (un par semaine)

Sur TikTok, le clip qui montre comment installer l'appli est celui qui a eu le plus de
réactions. `installer.js` en fabrique un par vendredi : le verset du jour de l'application
(texte Warsh et traduction, pendant sa récitation), puis les gestes pour installer AL BARAKA sur
Android et sur iPhone, pendant que la récitation continue. Un verset de plus de 30 s est remplacé
par le suivant de la liste.

```bash
node installer.js                          # les 8 prochains vendredis
node installer.js --start 2026-11-06 --weeks 12
```

Les clips arrivent dans `out/installer/`, avec la date de publication (vendredi, 14 h) dans
leur `.json`. `publier.cmd` les envoie sur YouTube une semaine à l'avance, programmés à leur
date (`node upload-youtube.js installer`), et `plan.js` les ajoute au calendrier TikTok. Comme
les autres clips, regardez-les avant de les publier.

## Rappels

- Ne publiez qu'avec **l'accord écrit** de Serigne Aboul Baraka Mbacké ou de sa famille,
  partage des revenus compris.
- La police Warsh (KFGQPC) est utilisée sans modification. Sa licence interdit de la vendre ;
  on ne vend pas la police, seulement des vidéos de récitation. En cas de doute, demandez une
  autorisation écrite au Complexe Roi Fahd.
- `secrets/` contient l'accès à votre chaîne : ne le partagez jamais. Il est exclu de Git.
