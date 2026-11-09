// Fabrique les pages légales publiques du site (www.kulky.fr/confidentialite, /conditions, /mentions-legales)
// à partir du même texte que l'appli (src/data/legal.ts) : une seule source, jamais de décalage.
// Lancer : node scripts/pages-legales-site.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/data/legal.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
const { pagesLegales, miseAJourLegale, contactKulky } = mod.exports;

const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lier = (t) => echapper(t).replace(new RegExp(contactKulky.replace('.', '\\.'), 'g'), `<a href="mailto:${contactKulky}">${contactKulky}</a>`);
const paragraphe = (t) => t.split('\n').map((l) => `<p>${lier(l)}</p>`).join('\n      ');

const fichiers = { confidentialite: 'confidentialite.html', conditions: 'conditions.html', mentions: 'mentions-legales.html' };
const style = fs.readFileSync(path.join(__dirname, '../site/supprimer-mon-compte.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];

for (const [cle, fichier] of Object.entries(fichiers)) {
  const page = pagesLegales[cle];
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(page.titre)} · Kulky</title>
<meta name="description" content="${echapper(page.titre)} de Kulky, le réseau social de ta culture.">
<link rel="icon" href="favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;800&family=DM+Sans:wght@400;500;700&display=swap">
${style}
</head>
<body>
<main>
  <a class="mot" href="/" aria-label="Kulky, retour à l’accueil"><span>k</span><span>u</span><span>l</span><span>k</span><span>y</span></a>

  <h1>${echapper(page.titre)}</h1>
  ${page.intro ? `<p>${lier(page.intro)}</p>` : ''}
${page.sections
  .map(
    (s) => `
  <h2>${echapper(s.titre)}</h2>
  <div class="carte">
      ${paragraphe(s.texte)}
  </div>`,
  )
  .join('\n')}

  <p class="petit">Mise à jour : ${echapper(miseAJourLegale)}.</p>

  <footer>
    <a href="/">kulky.fr</a> · <a href="/confidentialite">Ma vie privée</a> · <a href="/conditions">Conditions d’utilisation</a> · <a href="/mentions-legales">Mentions légales</a> · <a href="/supprimer-mon-compte">Supprimer mon compte</a>
  </footer>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, '../site', fichier), html);
  console.log('écrit :', fichier);
}
