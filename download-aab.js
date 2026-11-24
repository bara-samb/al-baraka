const fs = require('fs');
const https = require('https');

const url = 'https://expo.dev/artifacts/eas/DbO8i5mjfIK3_ihybDjZXF3TMFXgfbi3dbPWjNsj9gA.aab';
const dest = 'al-baraka-v1.0.0-build5.aab';

console.log('Téléchargement de :', url);

function download(targetUrl) {
  https.get(targetUrl, (res) => {
    // Si redirection 301 ou 302
    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
      console.log('Redirection vers :', res.headers.location);
      return download(res.headers.location);
    }

    if (res.statusCode !== 200) {
      console.error('Erreur HTTP :', res.statusCode);
      process.exit(1);
    }

    const totalBytes = Number(res.headers['content-length'] || 0);
    console.log(`Taille totale attendue : ${(totalBytes / (1024 * 1024)).toFixed(2)} Mo`);

    const file = fs.createWriteStream(dest);
    let downloaded = 0;

    res.on('data', (chunk) => {
      downloaded += chunk.length;
      process.stdout.write(`Progression : ${(downloaded / (1024 * 1024)).toFixed(2)} Mo\r`);
    });

    res.pipe(file);

    file.on('finish', () => {
      file.close(() => {
        console.log(`\n✓ Téléchargement terminé avec succès ! (${(downloaded / (1024 * 1024)).toFixed(2)} Mo)`);
      });
    });
  }).on('error', (err) => {
    console.error('Erreur téléchargement :', err.message);
    process.exit(1);
  });
}

download(url);
