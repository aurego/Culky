// « Pensé à toi » : envoyer une œuvre à quelqu'un parce qu'elle nous a fait penser à lui,
// et savoir quand le conseil a touché juste (la « boucle bouclée »).
import type { UniversId } from '../theme';
import { nouveauCode } from './invitation';
import { supabase } from './supabase';

export type Ami = { id: string; pseudo: string; univers_choisis: UniversId[]; dejaVecu?: boolean };

type OeuvreCourte = { id: string; titre: string; createur: string | null; univers: UniversId; image_url: string | null };

export type PenseRecu = {
  id: string;
  mot: string | null;
  propose_accompagner: boolean;
  cree_le: string;
  activite_bouclee_id: string | null;
  merci_le: string | null;
  oeuvre: OeuvreCourte;
  expediteur: { id: string; pseudo: string };
};

export type PenseEnvoye = {
  id: string;
  mot: string | null;
  cree_le: string;
  merci_le: string | null;
  oeuvre: OeuvreCourte;
  destinataire: { pseudo: string } | null; // null : envoyé par lien à quelqu'un qui n'est pas encore inscrit
  activite: { emotions: string[]; etat: 'commence' | 'fini' } | null; // la boucle bouclée
};

// Les personnes à qui je peux envoyer un « pensé à toi » : celles que je suis et celles qui me suivent.
export async function mesAmis(moi: string): Promise<Ami[]> {
  if (!supabase) return [];
  const [suivis, abonnes] = await Promise.all([
    supabase.from('abonnements').select('suivi_id').eq('abonne_id', moi),
    supabase.from('abonnements').select('abonne_id').eq('suivi_id', moi),
  ]);
  const ids = [...new Set([...(suivis.data ?? []).map((l) => l.suivi_id as string), ...(abonnes.data ?? []).map((l) => l.abonne_id as string)])];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profils').select('id, pseudo, univers_choisis').in('id', ids).order('pseudo');
  if (error) throw error;
  return (data ?? []) as Ami[];
}

export async function envoyerPenses(moi: string, oeuvreId: string, destinataires: string[], mot: string, accompagner: boolean): Promise<void> {
  if (!supabase || destinataires.length === 0) return;
  const { error } = await supabase.from('penses').insert(
    destinataires.map((d) => ({ expediteur_id: moi, destinataire_id: d, oeuvre_id: oeuvreId, mot: mot.trim() || null, propose_accompagner: accompagner })),
  );
  if (error) throw error;
}

// Mes amis, triés pour une œuvre donnée : ceux qui aiment cet univers d'abord,
// et ceux qui l'ont déjà vécue signalés (inutile de la leur conseiller).
export async function amisPourOeuvre(moi: string, oeuvreId: string, univers: UniversId): Promise<Ami[]> {
  const amis = await mesAmis(moi);
  if (!supabase || amis.length === 0) return amis;
  const { data } = await supabase.from('activites').select('auteur_id').eq('oeuvre_id', oeuvreId).in('auteur_id', amis.map((a) => a.id));
  const vecu = new Set((data ?? []).map((l) => l.auteur_id as string));
  const score = (a: Ami) => (vecu.has(a.id) ? 2 : a.univers_choisis?.includes(univers) ? 0 : 1);
  return amis.map((a) => ({ ...a, dejaVecu: vecu.has(a.id) })).sort((x, y) => score(x) - score(y) || x.pseudo.localeCompare(y.pseudo));
}

// « Merci ! » en un geste, pour la personne qui a reçu le conseil.
export async function direMerci(penseId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('penses').update({ merci_le: new Date().toISOString() }).eq('id', penseId);
  if (error) throw error;
}

// Pour quelqu'un qui n'a pas encore Culky : un pensé sans destinataire, avec un code d'invitation.
export async function creerInvitation(moi: string, oeuvreId: string, mot: string, accompagner: boolean): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const code = nouveauCode();
  const { error } = await supabase
    .from('penses')
    .insert({ expediteur_id: moi, destinataire_id: null, oeuvre_id: oeuvreId, mot: mot.trim() || null, propose_accompagner: accompagner, code_invitation: code });
  if (error) throw error;
  return code;
}

const oeuvreColonnes = 'oeuvre:oeuvres(id, titre, createur, univers, image_url)';

export async function pensesRecus(moi: string): Promise<PenseRecu[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('penses')
    .select(`id, mot, propose_accompagner, cree_le, activite_bouclee_id, merci_le, ${oeuvreColonnes}, expediteur:profils!penses_expediteur_id_fkey(id, pseudo)`)
    .eq('destinataire_id', moi)
    .order('cree_le', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PenseRecu[];
}

export async function pensesEnvoyes(moi: string): Promise<PenseEnvoye[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('penses')
    .select(`id, mot, cree_le, merci_le, ${oeuvreColonnes}, destinataire:profils!penses_destinataire_id_fkey(pseudo), activite:activites!penses_activite_bouclee_id_fkey(emotions, etat)`)
    .eq('expediteur_id', moi)
    .order('cree_le', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PenseEnvoye[];
}

// Quand je vis une œuvre qu'on m'avait conseillée : la boucle se boucle pour chaque pensé reçu.
// Renvoie le pseudo de la première personne qui y avait pensé (« grâce à Sofia »).
export async function bouclerLaBoucle(moi: string, oeuvreId: string, activiteId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('penses')
    .select('id, expediteur_id, expediteur:profils!penses_expediteur_id_fkey(pseudo)')
    .eq('destinataire_id', moi)
    .eq('oeuvre_id', oeuvreId)
    .is('activite_bouclee_id', null)
    .order('cree_le', { ascending: true });
  const lignes = (data ?? []) as unknown as { id: string; expediteur_id: string; expediteur: { pseudo: string } | null }[];
  if (lignes.length === 0) return null;
  await supabase.from('penses').update({ activite_bouclee_id: activiteId }).in('id', lignes.map((l) => l.id));
  await supabase.from('activites').update({ grace_a: lignes[0].expediteur_id }).eq('id', activiteId);
  return lignes[0].expediteur?.pseudo ?? null;
}

// Combien de mes pensés ont inspiré une activité (« Tes pensés ont inspiré 12 sorties »).
export function nombreInspires(envoyes: PenseEnvoye[]): number {
  return envoyes.filter((p) => p.activite).length;
}
