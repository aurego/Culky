// Mon profil et mes réglages : photo, pseudo, bio, visibilité par défaut, personnes bloquées, suppression du compte.
import { Platform } from 'react-native';
import type { Visibilite } from './activites';
import { supabase } from './supabase';

export type ChampsProfil = Partial<{
  pseudo: string;
  bio: string | null;
  photo_url: string | null;
  visibilite_defaut: Visibilite;
  commentaires_reserves_abonnes: boolean;
  univers_choisis: string[];
}>;

export async function mettreAJourProfil(moi: string, champs: ChampsProfil): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('profils').update(champs).eq('id', moi);
  if (error) throw error;
}

export const photoPossible = Platform.OS === 'web' && typeof document !== 'undefined';

// Choisir une photo (web) : on la recadre en carré de 512 px, puis on la range dans « avatars/<moi>/ ».
export function choisirPhoto(): Promise<Blob | null> {
  return new Promise((ok) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    champ.onchange = () => {
      const fichier = champ.files?.[0];
      if (!fichier) return ok(null);
      const img = new window.Image();
      img.onload = () => {
        const cote = Math.min(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        c.getContext('2d')!.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, 512, 512);
        c.toBlob((b) => ok(b), 'image/jpeg', 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(fichier);
    };
    champ.click();
  });
}

export async function envoyerPhoto(moi: string, photo: Blob): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const chemin = `${moi}/photo-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(chemin, photo, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const url = supabase.storage.from('avatars').getPublicUrl(chemin).data.publicUrl;
  await mettreAJourProfil(moi, { photo_url: url });
  return url;
}

// Une photo souvenir (concert, expo) : on garde son format, au plus 1080 px de côté.
export function choisirPhotoSouvenir(): Promise<Blob | null> {
  return new Promise((ok) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    champ.onchange = () => {
      const fichier = champ.files?.[0];
      if (!fichier) return ok(null);
      const img = new window.Image();
      img.onload = () => {
        const r = Math.min(1, 1080 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => ok(b), 'image/jpeg', 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(fichier);
    };
    champ.click();
  });
}

export async function envoyerSouvenir(moi: string, photo: Blob): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const chemin = `${moi}/souvenir-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('souvenirs').upload(chemin, photo, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('souvenirs').getPublicUrl(chemin).data.publicUrl;
}

// ——— Bloquer ———
export type PersonneBloquee = { id: string; pseudo: string };

export async function mesBlocages(moi: string): Promise<PersonneBloquee[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('blocages').select('bloque_id, profil:profils!blocages_bloque_id_fkey(pseudo)').eq('bloqueur_id', moi);
  if (error) throw error;
  return ((data ?? []) as unknown as { bloque_id: string; profil: { pseudo: string } | null }[]).map((l) => ({ id: l.bloque_id, pseudo: l.profil?.pseudo ?? '?' }));
}

export async function bloquer(moi: string, autre: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('blocages').insert({ bloqueur_id: moi, bloque_id: autre });
  if (error && error.code !== '23505') throw error;
}

export async function debloquer(moi: string, autre: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('blocages').delete().eq('bloqueur_id', moi).eq('bloque_id', autre);
  if (error) throw error;
}

export async function jAiBloque(moi: string, autre: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from('blocages').select('bloque_id').eq('bloqueur_id', moi).eq('bloque_id', autre).maybeSingle();
  return !!data;
}

export async function supprimerMonCompte(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('supprimer_mon_compte');
  if (error) throw error;
  await supabase.auth.signOut();
}
