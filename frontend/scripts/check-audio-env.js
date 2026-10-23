/**
 * Vérifie, avant un export de production, que l'adresse publique de l'audio est configurée :
 * sans elle, l'app chercherait les récitations sur un serveur de développement (localhost).
 */
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
let value = process.env.EXPO_PUBLIC_AUDIO_BASE_URL;
if (!value && fs.existsSync(envFile)) {
  const match = fs.readFileSync(envFile, 'utf8').match(/^EXPO_PUBLIC_AUDIO_BASE_URL=(.*)$/m);
  value = match && match[1].trim();
}

if (!value || !/^https:\/\/.+\/$/.test(value)) {
  console.error(
    '\n❌ EXPO_PUBLIC_AUDIO_BASE_URL manquante ou invalide (adresse https terminée par /).\n' +
      '   Copiez frontend/.env.example en frontend/.env et renseignez l\'adresse du bucket R2.\n'
  );
  process.exit(1);
}
console.log(`Audio : ${value}`);
