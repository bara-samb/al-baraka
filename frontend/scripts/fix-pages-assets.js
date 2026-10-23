/**
 * Après `expo export` : Cloudflare Pages n'envoie jamais les dossiers nommés `node_modules`.
 * Or Expo range les polices d'icônes (Ionicons…) dans `dist/assets/node_modules/` : en ligne,
 * elles renvoyaient la page HTML et les icônes s'affichaient comme des carrés vides.
 * On renomme le dossier en `vendor_modules` et on met à jour les chemins dans le bundle.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const from = path.join(dist, 'assets', 'node_modules');
const to = path.join(dist, 'assets', 'vendor_modules');

if (!fs.existsSync(from)) {
  console.log('fix-pages-assets : rien à renommer.');
  process.exit(0);
}
fs.rmSync(to, { recursive: true, force: true });
fs.renameSync(from, to);

const jsDir = path.join(dist, '_expo', 'static', 'js', 'web');
let patched = 0;
for (const name of fs.readdirSync(jsDir).filter((n) => n.endsWith('.js'))) {
  const file = path.join(jsDir, name);
  const code = fs.readFileSync(file, 'utf8');
  const next = code.split('/assets/node_modules/').join('/assets/vendor_modules/');
  if (next !== code) {
    fs.writeFileSync(file, next);
    patched++;
  }
}
if (!patched) {
  console.error('fix-pages-assets : aucun chemin « /assets/node_modules/ » trouvé dans le bundle.');
  process.exit(1);
}
console.log(`fix-pages-assets : polices et images déplacées dans assets/vendor_modules (${patched} bundle(s)).`);
