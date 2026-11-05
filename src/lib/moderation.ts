// La modération : l'équipe Kulky (table « moderateurs », remplie à la main dans Supabase) regarde les signalements.
// La base vérifie elle-même qui a le droit : une personne qui n'est pas modératrice ne lit rien et ne supprime rien.
// Ce qu'une modératrice peut faire : lire et classer un signalement, corriger ou supprimer une œuvre,
// supprimer une activité ou un commentaire signalé, retirer la photo d'une activité ou d'un profil signalé.
import { supabase } from './supabase';

export async function estModerateur(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('est_moderateur');
  if (error) return false;
  return data === true;
}

export type OeuvreSignalee = { id: string; titre: string; createur: string | null; image_url: string | null };

export type Signalement = {
  id: string;
  raison: string | null;
  cree_le: string;
  activite_id: string | null;
  commentaire_id: string | null;
  profil_signale_id: string | null;
  auteur: { pseudo: string } | null; // qui a signalé
  activite: { id: string; mots: string | null; photo_url: string | null; auteur: { pseudo: string } | null; oeuvre: OeuvreSignalee | null } | null;
  commentaire: { id: string; texte: string; auteur: { pseudo: string } | null } | null;
  profil: { id: string; pseudo: string; bio: string | null; photo_url: string | null } | null;
};

export async function listerSignalements(): Promise<Signalement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('signalements')
    .select(
      'id, raison, cree_le, activite_id, commentaire_id, profil_signale_id, ' +
        'auteur:profils!signalements_auteur_id_fkey(pseudo), ' +
        'activite:activites(id, mots, photo_url, auteur:profils!activites_auteur_id_fkey(pseudo), oeuvre:oeuvres(id, titre, createur, image_url)), ' +
        'commentaire:commentaires(id, texte, auteur:profils!commentaires_auteur_id_fkey(pseudo)), ' +
        'profil:profils!signalements_profil_signale_id_fkey(id, pseudo, bio, photo_url)',
    )
    .order('cree_le', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as Signalement[];
}

// Supprimer une ligne et vérifier qu'elle est bien partie (la base ne dit rien quand une règle l'empêche).
async function supprimerUne(table: 'activites' | 'commentaires' | 'signalements', id: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Rien n’a été supprimé : ce contenu n’existe plus, ou tu n’as pas le droit.');
}

// Classer un signalement (après l'avoir traité, ou s'il n'y a rien à faire).
export const classerSignalement = (id: string) => supprimerUne('signalements', id);
// Supprimer une activité ou un commentaire signalé (le signalement part avec).
export const supprimerActiviteSignalee = (id: string) => supprimerUne('activites', id);
export const supprimerCommentaireSignale = (id: string) => supprimerUne('commentaires', id);

// Corriger une œuvre (titre faux, insultant, image qui n'est pas la bonne…).
export async function corrigerOeuvre(id: string, champs: { titre: string; createur: string | null; image_url: string | null }): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from('oeuvres').update(champs).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('L’œuvre n’a pas pu être corrigée.');
}

// Retrouver le dossier et le nom d'un fichier à partir de son adresse publique.
function fichierDe(url: string): { dossier: 'avatars' | 'souvenirs'; chemin: string } | null {
  const m = url.match(/\/storage\/v1\/object\/public\/(avatars|souvenirs)\/(.+)$/);
  return m ? { dossier: m[1] as 'avatars' | 'souvenirs', chemin: decodeURIComponent(m[2]) } : null;
}

async function effacerFichier(url: string): Promise<void> {
  if (!supabase) return;
  const f = fichierDe(url);
  if (!f) return; // une adresse qui ne vient pas de notre stockage : rien à effacer chez nous
  const { data, error } = await supabase.storage.from(f.dossier).remove([f.chemin]);
  if (error) throw error;
  if (!data?.length) throw new Error('La photo n’a pas pu être retirée.');
}

// La photo souvenir d'une activité signalée : le fichier est effacé ; l'adresse reste sur l'activité
// (si la photo doit vraiment disparaître de la carte, supprimer l'activité).
export async function retirerPhotoActivite(url: string): Promise<void> {
  await effacerFichier(url);
}

// La photo d'un profil signalé : le fichier est effacé et le profil n'a plus de photo.
export async function retirerPhotoProfil(profilId: string, url: string): Promise<void> {
  if (!supabase) return;
  await effacerFichier(url);
  const { error } = await supabase.from('profils').update({ photo_url: null }).eq('id', profilId);
  if (error) throw error;
}

// Effacer la bio d'un profil signalé.
export async function effacerBio(profilId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from('profils').update({ bio: null }).eq('id', profilId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('La bio n’a pas pu être effacée.');
}
