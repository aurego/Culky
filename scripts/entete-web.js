// Après « expo export » : ajoute à dist/index.html ce qui permet d'installer Kulky sur l'écran d'accueil
// (titre, icône iPhone, manifeste Android, couleur), et l'aperçu quand on partage le lien.
const fs = require('fs');
const chemin = 'dist/index.html';
let html = fs.readFileSync(chemin, 'utf8');
const balises = `
<title>Kulky</title>
<style id="kulky-ios">
  /* iPhone : la page ne doit jamais glisser ni zoomer quand le clavier s'ouvre (sinon la barre du bas reste au milieu). */
  html, body { position: fixed; inset: 0; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; }
  /* Au moins 16 px dans les champs : en dessous, l'iPhone zoome tout seul sur la page et n'en revient pas. */
  input, textarea, select { font-size: 16px !important; }
</style>
<script>
  // Quand le clavier se ferme, on remet la page exactement en place et on prévient l'appli que la taille a changé.
  (function () {
    function recaler() { setTimeout(function () { window.scrollTo(0, 0); document.body.scrollTop = 0; window.dispatchEvent(new Event('resize')); }, 80); }
    document.addEventListener('focusout', recaler, true);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (window.visualViewport.height >= window.innerHeight - 1) recaler(); });
  })();
</script>
<meta name="description" content="Ta culture, avec tes amis. Livres, films, concerts, spectacles et expos.">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kulky">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#F3ECE3">
<meta property="og:title" content="Kulky · Comme une appli de sport, mais pour ta culture">
<meta property="og:description" content="Garde tes livres, films, concerts, spectacles et expos, et partage-les avec tes amis.">
<meta property="og:image" content="https://kulky.fr/apercu-kulky-2.png">
`;
if (!html.includes('rel="manifest"')) {
  html = html
    .replace(/<title>[^<]*<\/title>/, '')
    // Pas de zoom automatique sur iPhone, et la page garde la largeur de l’écran.
    .replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />')
    .replace('</head>', `${balises}</head>`);
  fs.writeFileSync(chemin, html);
}
console.log('Entête web ajoutée.');
