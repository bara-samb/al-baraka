const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SECRETS_DIR = path.join(__dirname, 'secrets');
const CLIENT_FILE = path.join(SECRETS_DIR, 'client_secret.json');
const TOKEN_FILE = path.join(SECRETS_DIR, 'token.json');
const STATE_FILE = path.join(__dirname, 'out', 'youtube-uploaded.json');

async function main() {
  if (!fs.existsSync(CLIENT_FILE) || !fs.existsSync(TOKEN_FILE)) {
    console.error('Identifiants YouTube introuvables.');
    return;
  }
  const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8')).installed;
  const auth = new google.auth.OAuth2(client_id, client_secret);
  auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));

  const youtube = google.youtube({ version: 'v3', auth });

  // 1. Infos globales de la chaîne
  const channelRes = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    mine: true
  });
  const channel = channelRes.data.items?.[0];
  if (!channel) {
    console.log('Aucune chaîne trouvée.');
    return;
  }

  console.log('====================================================');
  console.log(`CHAINE YOUTUBE : ${channel.snippet.title}`);
  console.log(`Abonnés        : ${channel.statistics.subscriberCount}`);
  console.log(`Vues totales   : ${channel.statistics.viewCount}`);
  console.log(`Vidéos totales : ${channel.statistics.videoCount}`);
  console.log('====================================================\n');

  // 2. Détail par vidéo
  if (!fs.existsSync(STATE_FILE)) {
    console.log('Aucune vidéo enregistrée dans out/youtube-uploaded.json.');
    return;
  }
  const uploaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const entries = Object.entries(uploaded);
  const ids = entries.map(([_, v]) => v.videoId).filter(Boolean);

  if (!ids.length) {
    console.log('Aucun ID de vidéo à analyser.');
    return;
  }

  // L'API accepte jusqu'à 50 IDs à la fois
  const videoRes = await youtube.videos.list({
    part: ['snippet', 'statistics', 'status'],
    id: ids.slice(0, 50).join(',')
  });

  const videos = (videoRes.data.items || []).map(v => ({
    id: v.id,
    title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    privacyStatus: v.status.privacyStatus,
    views: Number(v.statistics.viewCount || 0),
    likes: Number(v.statistics.likeCount || 0),
    comments: Number(v.statistics.commentCount || 0),
  }));

  // Trier par nombre de vues décroissant
  videos.sort((a, b) => b.views - a.views);

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;

  console.log('CLASSEMENT DES VIDÉOS PAR VUES :');
  console.log('----------------------------------------------------');
  for (const v of videos) {
    totalViews += v.views;
    totalLikes += v.likes;
    totalComments += v.comments;
    const status = v.privacyStatus === 'public' ? 'Public' : `Privé/Prog (${v.privacyStatus})`;
    console.log(`• [${v.views} vues | ${v.likes} likes] - ${v.title} (${status})`);
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL SUR CES VIDÉOS : ${totalViews} vues | ${totalLikes} likes | ${totalComments} commentaires`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Erreur API YouTube :', err.message);
});
