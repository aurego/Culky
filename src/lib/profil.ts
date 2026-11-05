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

// Les règles du pseudo (les mêmes que celles de la base) : lettres latines, accents compris,
// chiffres, point, tiret, tiret bas, 2 à 30 caractères ; « Kulky », « admin », « support »… réservés.
export const REGLE_PSEUDO = 'Lettres, chiffres, point, tiret ou tiret bas, sans espace (2 à 30 caractères).';
const motsReserves = '(admln|moderat|modo|support|equlpe|staff|offlclel|root|systeme|system)';

export function problemePseudo(pseudo: string): string | null {
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9._-]{2,30}$/.test(pseudo)) return REGLE_PSEUDO;
  const squelette = pseudo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Œœ]/g, 'o')
    .toLowerCase()
    .replace(/[._-]/g, '')
    .replace(/[i1]/g, 'l')
    .replace(/0/g, 'o');
  if (/[ck]ulky/.test(squelette) || new RegExp(`^${motsReserves}|${motsReserves}$`).test(squelette)) return 'Ce pseudo est réservé. Essaie une variante\u202f!';
  return null;
}

export async function mettreAJourProfil(moi: string, champs: ChampsProfil): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('profils').update(champs).eq('id', moi);
  if (error) throw error;
}

// Les photos marchent partout : sur le web (un champ fichier + une toile) et sur téléphone (la galerie).
export const photoPossible = Platform.OS !== 'web' || typeof document !== 'undefined';

// Une photo choisie : les octets à envoyer, et une adresse pour l'aperçu à l'écran.
export type PhotoChoisie = { donnees: Blob | ArrayBuffer; apercu: string };

// Sur le web : on lit le fichier, puis on le redessine à la bonne taille.
function choisirSurLeWeb(dessiner: (img: HTMLImageElement) => HTMLCanvasElement): Promise<PhotoChoisie | null> {
  return new Promise((ok) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    champ.onchange = () => {
      const fichier = champ.files?.[0];
      if (!fichier) return ok(null);
      const img = new window.Image();
      img.onload = () => {
        const c = dessiner(img);
        URL.revokeObjectURL(img.src);
        c.toBlob((b) => ok(b ? { donnees: b, apercu: URL.createObjectURL(b) } : null), 'image/jpeg', 0.85);
      };
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(fichier);
    };
    champ.click();
  });
}

// Sur téléphone : la galerie (Kulky demande la permission la première fois), puis on réduit la photo.
async function choisirSurLeTelephone(carre: boolean): Promise<PhotoChoisie | null> {
  const ImagePicker = await import('expo-image-picker');
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: carre, aspect: carre ? [1, 1] : undefined, quality: 1 });
  const image = choix.canceled ? null : choix.assets[0];
  if (!image) return null;
  const cote = carre ? 512 : 1080;
  const plusLarge = (image.width ?? 0) >= (image.height ?? 0);
  const taille = carre ? { width: 512, height: 512 } : plusLarge ? { width: Math.min(cote, image.width || cote) } : { height: Math.min(cote, image.height || cote) };
  const petite = await manipulateAsync(image.uri, [{ resize: taille }], { compress: 0.85, format: SaveFormat.JPEG });
  const donnees = await (await fetch(petite.uri)).arrayBuffer();
  return { donnees, apercu: petite.uri };
}

// La photo de profil : un carré de 512 px, rangé dans « avatars/<moi>/ ».
export function choisirPhoto(): Promise<PhotoChoisie | null> {
  if (Platform.OS !== 'web') return choisirSurLeTelephone(true);
  return choisirSurLeWeb((img) => {
    const cote = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    c.getContext('2d')!.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, 512, 512);
    return c;
  });
}

export async function envoyerPhoto(moi: string, photo: PhotoChoisie): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const chemin = `${moi}/photo-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(chemin, photo.donnees, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const url = supabase.storage.from('avatars').getPublicUrl(chemin).data.publicUrl;
  await mettreAJourProfil(moi, { photo_url: url });
  return url;
}

// Une photo souvenir (concert, expo) : on garde son format, au plus 1080 px de côté.
export function choisirPhotoSouvenir(): Promise<PhotoChoisie | null> {
  if (Platform.OS !== 'web') return choisirSurLeTelephone(false);
  return choisirSurLeWeb((img) => {
    const r = Math.min(1, 1080 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  });
}

export async function envoyerSouvenir(moi: string, photo: PhotoChoisie): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const chemin = `${moi}/souvenir-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('souvenirs').upload(chemin, photo.donnees, { contentType: 'image/jpeg' });
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
