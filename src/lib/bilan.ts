// « Ton année culturelle » : le bilan de l'année, à la manière d'un Wrapped, et son image à partager.
import { emotionParId } from '../data/emotions';
import { colors, univers, universIds, type UniversId } from '../theme';
import { L, lignes, partagerImage, preparerToile, rectArrondi, signer, enImage } from './carteStory';
import { supabase } from './supabase';

export type Bilan = {
  annee: number;
  total: number;
  parUnivers: Record<UniversId, number>;
  emotion: { emoji: string; label: string; fois: number } | null; // la plus ressentie
  emotions: { emoji: string; phrase: string }[]; // les 3 plus ressenties, racontées : « 3 coups de cœur »
  mois: { nom: string; n: number } | null;
  premier: { titre: string; date: string } | null;
  coupsDeCoeur: string[]; // titres marqués « Coup de cœur »
  graceAuxAmis: number; // découvertes vécues grâce à un conseil
  conseilsJustes: number; // mes conseils qui ont touché juste
  voyage: number; // personnes touchées plus loin, de main en main
};

const nomsMois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

type Ligne = { date_activite: string; emotions: string[]; grace_a: string | null; oeuvre: { titre: string; univers: UniversId } | null };

export async function calculerBilan(moi: string, annee = new Date().getFullYear()): Promise<Bilan> {
  const parUnivers = { livres: 0, cine: 0, concerts: 0, expos: 0 } as Record<UniversId, number>;
  const vide: Bilan = { annee, total: 0, parUnivers, emotion: null, emotions: [], mois: null, premier: null, coupsDeCoeur: [], graceAuxAmis: 0, conseilsJustes: 0, voyage: 0 };
  if (!supabase) return vide;
  const [a, c] = await Promise.all([
    supabase
      .from('activites')
      .select('date_activite, emotions, grace_a, oeuvre:oeuvres(titre, univers)')
      .eq('auteur_id', moi)
      .eq('etat', 'fini')
      .gte('date_activite', `${annee}-01-01`)
      .lte('date_activite', `${annee}-12-31`)
      .order('date_activite', { ascending: true }),
    supabase.from('penses').select('id', { count: 'exact', head: true }).eq('expediteur_id', moi).not('activite_bouclee_id', 'is', null),
  ]);
  if (a.error) throw a.error;
  const v = await supabase.rpc('voyages_de_mes_conseils').then((r) => (r.data ?? []) as { plus_loin: number }[], () => []);
  const activites = (a.data ?? []) as unknown as Ligne[];
  const emotions = new Map<string, number>();
  const mois = new Array(12).fill(0);
  for (const x of activites) {
    const u = x.oeuvre?.univers;
    if (u && universIds.includes(u)) parUnivers[u] += 1;
    for (const e of x.emotions ?? []) emotions.set(e, (emotions.get(e) ?? 0) + 1);
    mois[Number(x.date_activite.slice(5, 7)) - 1] += 1;
  }
  const classees = [...emotions.entries()].sort((p, q) => q[1] - p[1]);
  const [emotionId, fois] = classees[0] ?? [null, 0];
  const em = emotionId ? emotionParId(emotionId) : null;
  const meilleurMois = mois.reduce((best, n, i) => (n > mois[best] ? i : best), 0);
  const premier = activites[0];
  return {
    annee,
    total: activites.length,
    parUnivers,
    emotion: em ? { emoji: em.emoji, label: em.label, fois } : null,
    emotions: classees
      .slice(0, 3)
      .map(([id, n]) => ({ e: emotionParId(id), phrase: raconterEmotion(id, n) }))
      .filter((x) => x.e)
      .map((x) => ({ emoji: x.e!.emoji, phrase: x.phrase })),
    mois: mois[meilleurMois] > 0 ? { nom: nomsMois[meilleurMois], n: mois[meilleurMois] } : null,
    premier: premier?.oeuvre ? { titre: premier.oeuvre.titre, date: premier.date_activite } : null,
    coupsDeCoeur: activites.filter((x) => x.emotions?.includes('coup-de-coeur') && x.oeuvre).map((x) => x.oeuvre!.titre),
    graceAuxAmis: activites.filter((x) => x.grace_a).length,
    conseilsJustes: c.count ?? 0,
    voyage: v.reduce((n, x) => n + (x.plus_loin ?? 0), 0),
  };
}

// Une émotion racontée avec son nombre : « 3 coups de cœur », « Captivé·e 2 fois », « Mort·e de rire 1 fois ».
const fois = (n: number) => `${n} fois`;
const phrases: Record<string, (n: number) => string> = {
  'coup-de-coeur': (n) => `${n} coup${n > 1 ? 's' : ''} de cœur`,
  danse: (n) => `Tu as dansé ${fois(n)}`,
  frissons: (n) => `Des frissons ${fois(n)}`,
  'sur-ma-faim': (n) => `Resté·e sur ta faim ${fois(n)}`,
  'pas-ma-tasse': (n) => `Pas ta tasse de thé ${fois(n)}`,
  sieste: (n) => `${n} petite${n > 1 ? 's' : ''} sieste${n > 1 ? 's' : ''}`,
  habite: (n) => `Encore habité·e ${fois(n)}`,
};
export function raconterEmotion(id: string, n: number): string {
  if (phrases[id]) return phrases[id](n);
  const e = emotionParId(id);
  return e ? `${e.label} ${fois(n)}` : '';
}

const noms: Record<UniversId, [string, string]> = {
  livres: ['livre', 'livres'],
  cine: ['film', 'films'],
  concerts: ['concert', 'concerts'],
  expos: ['expo', 'expos'],
};
export const nomUnivers = (u: UniversId, n: number) => (n > 1 ? noms[u][1] : noms[u][0]);

// L'image du bilan, 1080 × 1920, à poster en story.
export async function dessinerBilan(b: Bilan, pseudo: string): Promise<Blob> {
  const { canvas, ctx } = await preparerToile('#FDE6E0');
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.culkoko;
  ctx.font = '600 46px Poppins_600SemiBold, Poppins, sans-serif';
  ctx.fillText(`L’ANNÉE CULTURELLE ${b.annee}`, L / 2, 290);
  ctx.fillStyle = colors.encre;
  ctx.font = '800 64px Poppins_800ExtraBold, Poppins, sans-serif';
  ctx.fillText(/^[aeiouyhéèêàâîôû]/i.test(pseudo) ? `d’${pseudo}` : `de ${pseudo}`, L / 2, 370);

  // Le grand chiffre.
  ctx.font = '800 300px Poppins_800ExtraBold, Poppins, sans-serif';
  ctx.fillText(String(b.total), L / 2, 690);
  ctx.font = '600 52px Poppins_600SemiBold, Poppins, sans-serif';
  ctx.fillText(b.total > 1 ? 'moments de culture' : 'moment de culture', L / 2, 780);

  // Les quatre univers, en tuiles.
  const tuiles = universIds.filter((u) => b.parUnivers[u] > 0);
  const tl = 200;
  const ecart = 24;
  let tx = (L - (tuiles.length * tl + (tuiles.length - 1) * ecart)) / 2;
  for (const u of tuiles) {
    ctx.fillStyle = univers[u].teinte;
    rectArrondi(ctx, tx, 850, tl, 200, 32);
    ctx.fill();
    ctx.fillStyle = colors.encre;
    ctx.font = '800 80px Poppins_800ExtraBold, Poppins, sans-serif';
    ctx.fillText(String(b.parUnivers[u]), tx + tl / 2, 955);
    ctx.font = '500 34px DMSans_500Medium, "DM Sans", sans-serif';
    ctx.fillText(nomUnivers(u, b.parUnivers[u]), tx + tl / 2, 1010);
    tx += tl + ecart;
  }

  // Trois lignes marquantes.
  const faits: [string, string][] = [];
  if (b.emotions[0]) faits.push([b.emotions[0].emoji, b.emotions[0].phrase.replace(/^Tu as/, 'J’ai').replace('ta faim', 'ma faim').replace('ta tasse', 'ma tasse')]);
  if (b.mois) faits.push(['✨', `Mon mois le plus culturel : ${b.mois.nom}`]);
  // Pas deux cœurs de suite : si l'émotion en tête est déjà le coup de cœur, on raconte autre chose.
  const coeurEnTete = b.emotions[0]?.phrase.includes('coup');
  if (b.coupsDeCoeur.length && !coeurEnTete) faits.push(['❤️', `Coup de cœur : ${b.coupsDeCoeur[0]}`]);
  else if (b.premier) faits.push(['🌱', `Pour commencer l’année : ${b.premier.titre}`]);
  let y = 1140;
  for (const [emoji, texte] of faits.slice(0, 3)) {
    ctx.fillStyle = '#FFFFFF';
    rectArrondi(ctx, 90, y, L - 180, 130, 36);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = '60px sans-serif';
    ctx.fillText(emoji, 130, y + 87);
    ctx.fillStyle = colors.encre;
    ctx.font = '700 38px DMSans_700Bold, "DM Sans", sans-serif';
    ctx.fillText(lignes(ctx, texte, L - 380, 1)[0], 230, y + 78);
    ctx.textAlign = 'center';
    y += 155;
  }
  signer(ctx);
  return enImage(canvas);
}

export async function partagerBilan(b: Bilan, pseudo: string) {
  const blob = await dessinerBilan(b, pseudo);
  return partagerImage(blob, `culky-mon-annee-${b.annee}.png`, `Mon année culturelle ${b.annee} · sur Kulky`);
}

