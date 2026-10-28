// Données d'exemple, le temps de brancher Supabase.
// Elles reprennent les maquettes V1 ; elles disparaîtront quand les vraies données arriveront.
import type { UniversId } from '../theme';

export type ActiviteDemo = {
  id: string;
  auteur: string;
  initiale: string;
  verbe: string;
  oeuvre: string;
  univers: UniversId;
  detail?: string;
  lieu: string;
  quand: string;
  avec?: string;
  emotions: string[];
  mots?: string;
  culkoko: number;
  commentaires: number;
};

export const filDemo: ActiviteDemo[] = [
  {
    id: 'a1',
    auteur: 'Sofia',
    initiale: 'S',
    verbe: 'a vu',
    oeuvre: '[Titre du film]',
    univers: 'cine',
    detail: 'au cinéma',
    lieu: 'Cinéma Utopia',
    quand: 'il y a 2 h',
    avec: 'Paul',
    emotions: ['bouleverse', 'habite'],
    mots: 'Je suis restée assise pendant tout le générique.',
    culkoko: 12,
    commentaires: 3,
  },
  {
    id: 'a2',
    auteur: 'Paul',
    initiale: 'P',
    verbe: 'était au concert de',
    oeuvre: '[Artiste]',
    univers: 'concerts',
    lieu: 'Le Bikini',
    quand: 'hier',
    emotions: ['danse', 'electrise'],
    culkoko: 7,
    commentaires: 1,
  },
];

export const etapeDemo = {
  auteur: 'Marie',
  nombre: 20,
  texte: 'a fini son 20e livre de l’année',
  objectif: 'Objectif 2026 : 30 livres',
};

export type EnvieDemo = {
  id: string;
  titre: string;
  univers: UniversId;
  sousTitre: string;
  alerte?: string;
  amisAussi?: string[];
};

export const enviesDemo: EnvieDemo[] = [
  {
    id: 'e1',
    titre: '[Titre de l’expo]',
    univers: 'expos',
    sousTitre: 'Les Abattoirs · Toulouse',
    alerte: 'Ferme dans 10 jours',
    amisAussi: ['S', 'P', 'M'],
  },
  {
    id: 'e2',
    titre: '[Titre du film]',
    univers: 'cine',
    sousTitre: 'Ajouté depuis le fil de Paul',
    alerte: 'Quitte bientôt l’affiche',
  },
  {
    id: 'e3',
    titre: '[Titre du livre]',
    univers: 'livres',
    sousTitre: 'Pensé par Sofia · « Il m’a fait penser à toi »',
  },
];

export const pensesDemo = [
  {
    id: 'p1',
    de: 'Sofia',
    initiale: 'S',
    oeuvre: '[Titre du livre]',
    univers: 'livres' as UniversId,
    mot: 'Il m’a fait penser à toi, avec ton amour des romans russes.',
    quand: 'hier',
  },
  {
    id: 'p2',
    de: 'Paul',
    initiale: 'P',
    oeuvre: '[Titre de l’expo]',
    univers: 'expos' as UniversId,
    mot: 'Et je t’accompagnerais bien !',
    quand: 'il y a 3 jours',
  },
];

export const carnetDemo = {
  pseudo: 'Claire',
  initiale: 'C',
  bio: 'Romans russes, cinéma coréen et concerts dans les petites salles.',
  abonnes: 128,
  abonnements: 94,
  preferes: ['[Livre 1]', '[Livre 2]', '[Livre 3]'],
  annee: { livres: 34, cine: 52, concerts: 8, expos: 5 } as Record<UniversId, number>,
  objectif: { univers: 'livres' as UniversId, cible: 40 },
  journal: [
    { id: 'j1', titre: '[Titre du film]', univers: 'cine' as UniversId, quand: 'Hier', emotion: 'bouleverse' },
    { id: 'j2', titre: 'Le Comte de Monte-Cristo', univers: 'livres' as UniversId, quand: 'Il y a 3 jours', emotion: 'coup-de-coeur' },
  ],
};
