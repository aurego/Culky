// Après « expo export » : ajoute à dist/index.html ce qui permet d'installer Kulky sur l'écran d'accueil
// (titre, icône iPhone, manifeste Android, couleur), et l'aperçu quand on partage le lien.
const fs = require('fs');
const chemin = 'dist/index.html';
let html = fs.readFileSync(chemin, 'utf8');
const balises = `
<title>Kulky</title>
<meta name="description" content="Ta culture, avec tes amis. Livres, films, concerts, spectacles et expos.">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kulky">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#FBF7F2">
<meta property="og:title" content="Kulky · Ta culture, avec tes amis">
<meta property="og:description" content="Livres, films, concerts, spectacles et expos : garde ce que tu vis et partage-le avec tes amis.">
<meta property="og:image" content="https://kulky.fr/partage.png">
`;
if (!html.includes('rel="manifest"')) {
  html = html.replace(/<title>[^<]*<\/title>/, '').replace('</head>', `${balises}</head>`);
  fs.writeFileSync(chemin, html);
}
console.log('Entête web ajoutée.');
