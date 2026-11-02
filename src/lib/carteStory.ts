// La carte à partager en story (Instagram, WhatsApp…) après chaque enregistrement.
// Une image verticale 1080 × 1920, dessinée dans le navigateur, aux couleurs de Kulky.
// Chaque partage est une petite publicité : la carte porte le logo, la promesse et l'adresse de l'appli.
import { Platform } from 'react-native';
import { colors, univers, type UniversId } from '../theme';

export type InfosCarte = {
  univers: UniversId;
  titre: string;
  createur?: string | null;
  imageUrl?: string | null;
  emotion?: { emoji: string; label: string } | null;
  rang?: string | null; // « ton 3e livre de l'année »
  commence?: boolean;
  passe?: boolean; // ajouté après coup : « J'ai lu » plutôt que « Je viens de finir »
  pseudo?: string | null;
};

export const L = 1080;
export const H = 1920;
// Le nom et l'adresse de l'appli, en un seul endroit (le nom définitif viendra plus tard).
const site = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://culky.vercel.app').replace(/^https?:\/\//, '');

const verbesPasses: Record<UniversId, string> = {
  livres: 'J’ai lu',
  cine: 'J’ai vu',
  concerts: 'J’étais au concert',
  expos: 'J’ai visité',
};

const verbes: Record<UniversId, string> = {
  livres: 'Je viens de finir',
  cine: 'Je viens de voir',
  concerts: 'J’étais au concert',
  expos: 'Je viens de visiter',
};

export const partageCartePossible = Platform.OS === 'web' && typeof document !== 'undefined';

// « ton 3e livre de l'année » → « Mon 3e livre de 2026 »
function rangALaPremierePersonne(rang: string): string {
  const r = rang.replace(/^ton /, 'mon ').replace(/^ta /, 'ma ').replace('de l’année', `de ${new Date().getFullYear()}`);
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function chargerImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // sans autorisation du site d'origine, on se passe de la couverture
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url.replace('http://', 'https://');
    setTimeout(() => ok(null), 4000);
  });
}

export function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number, max: number): string[] {
  const mots = texte.split(/\s+/);
  const res: string[] = [];
  let ligne = '';
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width <= largeur || !ligne) ligne = essai;
    else {
      res.push(ligne);
      ligne = mot;
    }
  }
  if (ligne) res.push(ligne);
  if (res.length > max) {
    const coupe = res.slice(0, max);
    coupe[max - 1] = `${coupe[max - 1].replace(/[\s,;:.]+\S*$/, '')}…`;
    return coupe;
  }
  return res;
}

export function rectArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, l, h, r);
}

// Le Kulkoko : le K kawaii, corps et bras symétriques en une seule silhouette (mêmes formes que l'icône).
// Le K kawaii. Plein (bordeaux, visage blanc) pour la signature, ou en contour (comme dans le logo de l'appli).
function dessinerCulkoko(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number, contour?: { couleur: string; interieur: string }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(taille / 24, taille / 24);
  const couleur = contour?.couleur ?? colors.culkoko;
  const forme = () => {
    const p = new Path2D();
    for (const angle of [-48, 48]) {
      const m = new DOMMatrix().translate(10.2, 12).rotate(angle);
      const r = new Path2D();
      r.roundRect(0, -2.6, 11.4, 5.2, 1.8);
      p.addPath(r, m);
    }
    p.roundRect(2, 2.5, 9.5, 19, 3);
    return p;
  };
  ctx.fillStyle = couleur;
  if (contour) {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke(forme());
    ctx.fill(forme(), 'nonzero');
    ctx.fillStyle = contour.interieur;
  }
  ctx.fill(forme(), 'nonzero');
  const traits = contour ? couleur : '#FFFFFF';
  ctx.fillStyle = traits;
  for (const cx of [5.2, 8.4]) {
    ctx.beginPath();
    ctx.arc(cx, 9.6, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = traits;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D('M5.7 12.6c.6.7 1.6.7 2.2 0'));
  ctx.fillStyle = contour ? '#F28B73' : '#F7B3C0';
  for (const cx of [4, 9.6]) {
    ctx.beginPath();
    ctx.arc(cx, 12, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Une toile 1080 × 1920 : fond teinté, confettis Kulky et logo. Partagée par toutes les cartes.
export async function preparerToile(teinte: string): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;
  // Le fond : la teinte de l'univers, avec quelques confettis aux couleurs de Kulky.
  ctx.fillStyle = teinte;
  ctx.fillRect(0, 0, L, H);
  const confettis: [number, number, number, string][] = [
    [120, 300, -20, univers.cine.couleur],
    [960, 250, 25, univers.concerts.couleur],
    [80, 1180, 35, univers.expos.couleur],
    [1000, 1080, -30, colors.culkoko],
    [930, 520, 10, univers.livres.couleur],
    [170, 760, -40, univers.concerts.couleur],
  ];
  for (const [x, y, a, c] of confettis) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((a * Math.PI) / 180);
    ctx.fillStyle = c;
    rectArrondi(ctx, -18, -28, 36, 56, 10);
    ctx.fill();
    ctx.restore();
  }

  // Le logo.
  ctx.textBaseline = 'alphabetic';
  ctx.font = '800 96px Poppins_800ExtraBold, Poppins, sans-serif';
  // Le K kawaii en première lettre (plein, bordeaux), puis « ulky » : turquoise, ambre, corail, vert.
  const lettres: [string, string][] = [
    ['u', univers.livres.couleur],
    ['l', univers.concerts.couleur],
    ['k', univers.cine.couleur],
    ['y', univers.expos.couleur],
  ];
  // Même placement que dans l'appli : le K a la hauteur du « l » et se pose sur la ligne de base.
  const F = 96;
  const u = (F * 0.75) / 19.7;
  const largeurK = (19.8 - 2) * u + F * 0.02;
  const largeurLogo = largeurK + lettres.reduce((s, [l]) => s + ctx.measureText(l).width, 0);
  let lx = (L - largeurLogo) / 2;
  dessinerCulkoko(ctx, lx - 2 * u, 190 - 21.5 * u, 24 * u);
  lx += largeurK;
  for (const [l, c] of lettres) {
    ctx.fillStyle = c;
    ctx.fillText(l, lx, 190);
    lx += ctx.measureText(l).width;
  }

  return { canvas, ctx };
}

// La signature en bas de chaque carte : le Kulkoko, la promesse, l'adresse.
export function signer(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center';
  dessinerCulkoko(ctx, L / 2 - 60, H - 300, 120);
  ctx.fillStyle = colors.encre;
  ctx.font = '700 38px DMSans_700Bold, "DM Sans", sans-serif';
  ctx.fillText('Célèbre chaque activité culturelle', L / 2, H - 82);
  ctx.fillStyle = colors.gris;
  ctx.font = '500 34px DMSans_500Medium, "DM Sans", sans-serif';
  ctx.fillText(site, L / 2, H - 36);
}

export function enImage(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Image impossible'))), 'image/png'));
}

export async function dessinerCarte(infos: InfosCarte): Promise<Blob> {
  const u = univers[infos.univers];
  const { canvas, ctx } = await preparerToile(u.teinte);

  // La carte blanche au centre.
  const cx = 90;
  const cy = 300;
  const cl = L - 180;
  const ch = 1150;
  ctx.save();
  ctx.shadowColor = 'rgba(31, 27, 36, 0.14)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#FFFFFF';
  rectArrondi(ctx, cx, cy, cl, ch, 56);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = u.texteFonce;
  ctx.font = '600 44px Poppins_600SemiBold, Poppins, sans-serif';
  ctx.fillText((infos.commence ? 'Je commence' : infos.passe ? verbesPasses[infos.univers] : verbes[infos.univers]).toUpperCase(), L / 2, cy + 110);

  // La couverture (ou un aplat coloré avec l'émotion).
  const iw = 380;
  const ih = 540;
  const ix = (L - iw) / 2;
  const iy = cy + 160;
  const image = infos.imageUrl ? await chargerImage(infos.imageUrl) : null;
  ctx.save();
  rectArrondi(ctx, ix, iy, iw, ih, 28);
  ctx.clip();
  if (image) {
    const r = Math.max(iw / image.width, ih / image.height);
    ctx.drawImage(image, ix + (iw - image.width * r) / 2, iy + (ih - image.height * r) / 2, image.width * r, image.height * r);
  } else {
    ctx.fillStyle = u.couleur;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.font = '180px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(infos.emotion?.emoji ?? (infos.commence ? '📖' : '🎉'), L / 2, iy + ih / 2 + 64);
  }
  ctx.restore();

  // Le titre et l'auteur.
  let y = iy + ih + 110;
  ctx.fillStyle = colors.encre;
  ctx.font = '800 68px Poppins_800ExtraBold, Poppins, sans-serif';
  for (const l of lignes(ctx, infos.titre, cl - 120, 3)) {
    ctx.fillText(l, L / 2, y);
    y += 80;
  }
  if (infos.createur) {
    ctx.fillStyle = colors.gris;
    ctx.font = '400 40px DMSans_400Regular, "DM Sans", sans-serif';
    ctx.fillText(lignes(ctx, infos.createur, cl - 160, 1)[0], L / 2, y + 4);
    y += 60;
  }

  // L'émotion, dans une pastille.
  if (infos.emotion) {
    ctx.font = '700 42px DMSans_700Bold, "DM Sans", sans-serif';
    const texte = `${infos.emotion.emoji}  ${infos.emotion.label}`;
    const pl = ctx.measureText(texte).width + 80;
    ctx.fillStyle = u.teinte;
    rectArrondi(ctx, (L - pl) / 2, y + 10, pl, 90, 45);
    ctx.fill();
    ctx.fillStyle = colors.encre;
    ctx.fillText(texte, L / 2, y + 70);
  }

  // Sous la carte : le rang de l'année, puis la signature Kulky.
  if (infos.rang && !infos.commence) {
    ctx.fillStyle = colors.encre;
    ctx.font = '800 60px Poppins_800ExtraBold, Poppins, sans-serif';
    ctx.fillText(rangALaPremierePersonne(infos.rang), L / 2, cy + ch + 115);
  }
  signer(ctx);

  return enImage(canvas);
}

// Partage la carte : la feuille de partage du téléphone (Instagram, WhatsApp…) si le navigateur
// la propose, sinon on télécharge l'image pour la poster soi-même.
export async function partagerCarte(infos: InfosCarte): Promise<'partage' | 'telechargee' | 'annule'> {
  const blob = await dessinerCarte(infos);
  const nom = `kulky-${infos.titre.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`;
  return partagerImage(blob, nom, `${infos.titre} · sur Kulky`);
}

export async function partagerImage(blob: Blob, nom: string, texte: string): Promise<'partage' | 'telechargee' | 'annule'> {
  const fichier = new File([blob], nom, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [fichier] })) {
    try {
      await nav.share({ files: [fichier], text: texte });
      return 'partage';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'annule';
    }
  }
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 5000);
  return 'telechargee';
}
