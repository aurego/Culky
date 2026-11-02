// Les notifications dans l'appli : la base les crée toute seule, on les lit, on les regroupe, on les marque lues.
import { jourLong } from './dates';
import { supabase } from './supabase';

export type Notification = {
  id: string;
  type: 'culkoko' | 'abonne' | 'conseil' | 'invitation_acceptee' | 'merci' | 'boucle' | 'sortie_invitation' | 'sortie_reponse' | 'sortie_veille' | 'sortie_jour' | string;
  detail: string | null;
  lue: boolean;
  cree_le: string;
  acteur_id: string | null;
  activite_id: string | null;
  sortie_id: string | null;
  acteur: { pseudo: string } | null;
  oeuvre: { titre: string } | null;
  sortie: { date_prevue: string; heure: string | null } | null;
};

// Une ligne affichée : parfois plusieurs notifications regroupées (« sofia et 4 autres… »).
export type LigneNotif = { cle: string; notifs: Notification[]; lue: boolean; texte: string; date: string };

export async function lireNotifications(moi: string): Promise<Notification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, type, detail, lue, cree_le, acteur_id, activite_id, sortie_id, acteur:profils!notifications_acteur_id_fkey(pseudo), oeuvre:oeuvres(titre), sortie:sorties(date_prevue, heure)',
    )
    .eq('destinataire_id', moi)
    .order('cree_le', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as unknown as Notification[];
}

export async function compterNonLues(moi: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('destinataire_id', moi).eq('lue', false);
  return count ?? 0;
}

export async function marquerToutLu(moi: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('notifications').update({ lue: true }).eq('destinataire_id', moi).eq('lue', false);
}

// Prépare les rappels du jour pour la personne connectée (la base évite les doublons).
export async function preparerRappels(): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('generer_rappels');
}

const titre = (n: Notification) => (n.oeuvre?.titre ? `« ${n.oeuvre.titre} »` : 'ton activité');

function quiEtAutres(notifs: Notification[]): string {
  const noms = [...new Set(notifs.map((n) => n.acteur?.pseudo ?? 'Quelqu’un'))];
  if (noms.length === 1) return noms[0];
  if (noms.length === 2) return `${noms[0]} et ${noms[1]}`;
  return `${noms[0]} et ${noms.length - 1} autres`;
}

function texte(notifs: Notification[]): string {
  const n = notifs[0];
  const qui = quiEtAutres(notifs);
  const plusieurs = new Set(notifs.map((x) => x.acteur_id)).size > 1;
  const heure = n.sortie?.heure ? `, à ${n.sortie.heure}` : '';
  switch (n.type) {
    case 'culkoko':
      return `${qui} ${plusieurs ? 't’ont' : 't’a'} envoyé un Culkoko pour ${titre(n)}`;
    case 'abonne':
      return `${qui} ${plusieurs ? 'te suivent' : 'te suit'} maintenant`;
    case 'conseil':
      return `${qui} a pensé à toi : ${titre(n)}`;
    case 'voyage':
      return n.acteur ? `Ton conseil ${titre(n)} voyage : ${n.acteur.pseudo} l’a conseillé à son tour !` : `Ton conseil ${titre(n)} continue son voyage, de main en main !`;
    case 'invitation_acceptee':
      return `${qui} a rejoint Culky grâce à ton conseil ${titre(n)} ! Vous vous suivez maintenant.`;
    case 'merci':
      return `${qui} te dit merci pour ton conseil ${titre(n)} 🙏`;
    case 'boucle':
      return `🎯 Ton conseil a touché juste : ${qui} a vécu ${titre(n)}`;
    case 'sortie_invitation':
      return `${qui} te propose une sortie : ${titre(n)}${n.sortie ? `, ${jourLong(n.sortie.date_prevue).toLowerCase()}` : ''}`;
    case 'sortie_reponse':
      return n.detail === 'partant' ? `${qui} est partant·e pour ${titre(n)} !` : `${qui} ne pourra pas venir à ${titre(n)}`;
    case 'sortie_veille':
      return `Demain : ${titre(n)}${heure}`;
    case 'sortie_jour':
      return `C’est aujourd’hui : ${titre(n)}${heure} !`;
    default:
      return 'Du nouveau sur Culky';
  }
}

// On regroupe les Culkoko d'une même activité et les nouveaux abonnés du même jour.
export function regrouper(notifs: Notification[]): LigneNotif[] {
  const lignes: LigneNotif[] = [];
  const index = new Map<string, LigneNotif>();
  for (const n of notifs) {
    const jour = n.cree_le.slice(0, 10);
    const cle = n.type === 'culkoko' ? `culkoko:${n.activite_id}` : n.type === 'abonne' ? `abonne:${jour}` : n.id;
    const ligne = index.get(cle);
    if (ligne) {
      ligne.notifs.push(n);
      ligne.lue = ligne.lue && n.lue;
    } else {
      const nouvelle = { cle, notifs: [n], lue: n.lue, texte: '', date: n.cree_le };
      index.set(cle, nouvelle);
      lignes.push(nouvelle);
    }
  }
  return lignes.map((l) => ({ ...l, texte: texte(l.notifs) }));
}
