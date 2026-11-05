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

// Une image tout juste choisie, avant recadrage : son adresse et sa taille réelle en pixels.
export type ImageBrute = { uri: string; largeur: number; hauteur: number };
// La zone gardée après recadrage, en pixels de l'image d'origine.
export type Zone = { x: number; y: number; largeur: number; hauteur: number };

// Le format des photos : un carré pour le profil, un bandeau pour la photo souvenir
// (le même que sur la carte du fil, pour que ce qu'on cadre soit exactement ce que les amis voient).
export const FORMAT_PROFIL = { ratio: 1, largeur: 512 };
export const FORMAT_SOUVENIR = { ratio: 1.6, largeur: 1080 };

// Choisir une image : un champ fichier sur le web, la galerie sur téléphone (sans recadrage du système,
// c'est l'écran de recadrage de Kulky qui s'en charge, partout pareil).
export function choisirImage(): Promise<ImageBrute | null> {
  if (Platform.OS === 'web') {
    return new Promise((ok) => {
      const champ = document.createElement('input');
      champ.type = 'file';
      champ.accept = 'image/*';
      champ.onchange = () => {
        const fichier = champ.files?.[0];
        if (!fichier) return ok(null);
        const uri = URL.createObjectURL(fichier);
        const img = new window.Image();
        img.onload = () => ok({ uri, largeur: img.naturalWidth, hauteur: img.naturalHeight });
        img.onerror = () => ok(null);
        img.src = uri;
      };
      champ.click();
    });
  }
  return (async () => {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
    const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    const image = choix.canceled ? null : choix.assets[0];
    if (!image || !image.width || !image.height) return null;
    return { uri: image.uri, largeur: image.width, hauteur: image.height };
  })();
}

// Découpe la zone choisie et la réduit à la bonne taille (JPEG).
export async function recadrer(image: ImageBrute, zone: Zone, format: { ratio: number; largeur: number }): Promise<PhotoChoisie> {
  const largeur = Math.round(Math.min(format.largeur, zone.largeur));
  const hauteur = Math.round(largeur / format.ratio);
  if (Platform.OS === 'web') {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = image.uri;
    });
    const c = document.createElement('canvas');
    c.width = largeur;
    c.height = hauteur;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, zone.x, zone.y, zone.largeur, zone.hauteur, 0, 0, largeur, hauteur);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Image illisible');
    return { donnees: blob, apercu: URL.createObjectURL(blob) };
  }
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const r = await manipulateAsync(
    image.uri,
    [
      { crop: { originX: Math.round(zone.x), originY: Math.round(zone.y), width: Math.round(zone.largeur), height: Math.round(zone.hauteur) } },
      { resize: { width: largeur, height: hauteur } },
    ],
    { compress: 0.85, format: SaveFormat.JPEG },
  );
  const donnees = await (await fetch(r.uri)).arrayBuffer();
  return { donnees, apercu: r.uri };
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
