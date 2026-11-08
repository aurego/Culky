// Couleurs, polices et univers de Kulky, repris des maquettes V1.
// Si tu veux changer une couleur partout dans l'appli, c'est ici.

export const colors = {
  fond: '#F3ECE3', // beige de fond des écrans (assez soutenu pour que les cartes blanches ressortent)
  carte: '#FFFFFF',
  encre: '#1F1B24', // texte principal
  gris: '#4F4757', // texte secondaire
  bordure: '#E4DCD1',
  separateur: '#EAE1D6',
  beige: '#F4EEE6',
  culkoko: '#9B2335', // bordeaux : titres de page, bouton principal, +, Kulkoko
  sousTitre: '#1F6E6A', // turquoise foncé : sous-titres de section (pour ne pas mettre du bordeaux partout)
};

export const fonts = {
  titre: 'Poppins_600SemiBold',
  titreGras: 'Poppins_800ExtraBold',
  texte: 'DMSans_400Regular',
  texteMoyen: 'DMSans_500Medium',
  texteGras: 'DMSans_700Bold',
};

export type UniversId = 'livres' | 'cine' | 'concerts' | 'expos';

export const univers: Record<
  UniversId,
  { label: string; couleur: string; teinte: string; texteFonce: string }
> = {
  livres: { label: 'Livres', couleur: '#3FB6B0', teinte: '#DDF3F1', texteFonce: '#1F6E6A' },
  cine: { label: 'Ciné', couleur: '#F28B73', teinte: '#FDE6E0', texteFonce: '#9C3F28' },
  concerts: { label: 'Concerts et spectacles', couleur: '#E8A631', teinte: '#FBEFD6', texteFonce: '#7A5410' },
  expos: { label: 'Expos', couleur: '#2BA77F', teinte: '#DAF0E6', texteFonce: '#1D6E54' },
};

export const universIds: UniversId[] = ['livres', 'cine', 'concerts', 'expos'];

// Les 5 catégories qu'on retrouve partout (filtres, envies, cartes) : les mêmes que sur l'écran « + ».
// Concerts et spectacles partagent l'univers « Scène » (et sa couleur), mais on les distingue toujours.
export type CategorieId = UniversId | 'spectacles';
export const categorieIds: CategorieId[] = ['livres', 'cine', 'concerts', 'spectacles', 'expos'];
export const categories: Record<CategorieId, { label: string; univers: UniversId }> = {
  livres: { label: 'Livres', univers: 'livres' },
  cine: { label: 'Ciné', univers: 'cine' },
  concerts: { label: 'Concerts', univers: 'concerts' },
  spectacles: { label: 'Spectacles', univers: 'concerts' },
  expos: { label: 'Expos', univers: 'expos' },
};
export const categorieDe = (o: { univers: UniversId; genre?: string | null }): CategorieId =>
  o.univers === 'concerts' && o.genre === 'spectacle' ? 'spectacles' : o.univers;
