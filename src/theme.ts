// Couleurs, polices et univers de Culky, repris des maquettes V1.
// Si tu veux changer une couleur partout dans l'appli, c'est ici.

export const colors = {
  fond: '#FBF7F2', // crème de fond des écrans
  carte: '#FFFFFF',
  encre: '#1F1B24', // texte principal
  gris: '#5E5664', // texte secondaire
  bordure: '#E4DCD1',
  separateur: '#F0E9E0',
  beige: '#F4EEE6',
  culkoko: '#9B2335', // bordeaux du Culkoko et des boutons principaux
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
  concerts: { label: 'Concerts', couleur: '#E8A631', teinte: '#FBEFD6', texteFonce: '#7A5410' },
  expos: { label: 'Expos', couleur: '#2BA77F', teinte: '#DAF0E6', texteFonce: '#1D6E54' },
};

export const universIds: UniversId[] = ['livres', 'cine', 'concerts', 'expos'];
