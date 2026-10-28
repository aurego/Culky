// La palette d'émotions du cahier des charges (section 2).
// Les 6 premières sont celles affichées d'abord sur l'écran « Nouvelle activité ».

export type Emotion = { id: string; emoji: string; label: string; famille: string };

export const emotions: Emotion[] = [
  // Le cœur
  { id: 'coup-de-coeur', emoji: '❤️', label: 'Coup de cœur', famille: 'Le cœur' },
  { id: 'emu', emoji: '🥹', label: 'Ému·e', famille: 'Le cœur' },
  { id: 'bouleverse', emoji: '😭', label: 'Bouleversé·e', famille: 'Le cœur' },
  { id: 'attendri', emoji: '🤍', label: 'Attendri·e', famille: 'Le cœur' },
  { id: 'nostalgique', emoji: '🕰️', label: 'Nostalgique', famille: 'Le cœur' },
  { id: 'melancolique', emoji: '🌧️', label: 'Mélancolique', famille: 'Le cœur' },
  // L'émerveillement
  { id: 'emerveille', emoji: '✨', label: 'Émerveillé·e', famille: "L'émerveillement" },
  { id: 'transporte', emoji: '🌊', label: 'Transporté·e', famille: "L'émerveillement" },
  { id: 'captive', emoji: '🤩', label: 'Captivé·e', famille: "L'émerveillement" },
  { id: 'surpris', emoji: '😮', label: 'Surpris·e', famille: "L'émerveillement" },
  { id: 'inspire', emoji: '💡', label: 'Inspiré·e', famille: "L'émerveillement" },
  // L'énergie
  { id: 'electrise', emoji: '⚡', label: 'Électrisé·e', famille: "L'énergie" },
  { id: 'danse', emoji: '💃', label: "J'ai dansé", famille: "L'énergie" },
  { id: 'mort-de-rire', emoji: '🤣', label: 'Mort·e de rire', famille: "L'énergie" },
  { id: 'diverti', emoji: '😄', label: 'Diverti·e', famille: "L'énergie" },
  { id: 'frissons', emoji: '🫣', label: 'Frissons garantis', famille: "L'énergie" },
  // La réflexion
  { id: 'questionne', emoji: '🤔', label: 'Questionné·e', famille: 'La réflexion' },
  { id: 'trouble', emoji: '🌀', label: 'Troublé·e', famille: 'La réflexion' },
  { id: 'secoue', emoji: '🌪️', label: 'Secoué·e', famille: 'La réflexion' },
  { id: 'revolte', emoji: '🔥', label: 'Révolté·e', famille: 'La réflexion' },
  { id: 'habite', emoji: '💭', label: 'Encore habité·e', famille: 'La réflexion' },
  { id: 'apaise', emoji: '🌿', label: 'Apaisé·e', famille: 'La réflexion' },
  // Le négatif sympa
  { id: 'mitige', emoji: '😐', label: 'Mitigé·e', famille: 'Le négatif sympa' },
  { id: 'sur-ma-faim', emoji: '🍽️', label: 'Resté·e sur ma faim', famille: 'Le négatif sympa' },
  { id: 'perplexe', emoji: '🤨', label: 'Perplexe', famille: 'Le négatif sympa' },
  { id: 'pas-ma-tasse', emoji: '☕', label: 'Pas ma tasse de thé', famille: 'Le négatif sympa' },
  { id: 'sieste', emoji: '😴', label: 'Petite sieste', famille: 'Le négatif sympa' },
];

export const emotionsFavorites = ['coup-de-coeur', 'bouleverse', 'emerveille', 'mort-de-rire', 'habite', 'mitige'];

export const emotionParId = (id: string) => emotions.find((e) => e.id === id);
