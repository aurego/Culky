// Les icônes de l'appli, dessinées en traits fins comme dans les maquettes.
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

type Props = { taille?: number; couleur?: string; epaisseur?: number };

const base = (taille: number, couleur: string, epaisseur: number) => ({
  width: taille,
  height: taille,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: couleur,
  strokeWidth: epaisseur,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconeAccueil = ({ taille = 24, couleur = colors.gris, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const IconeEnvies = ({ taille = 24, couleur = colors.gris, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M6 3h12v18l-6-4-6 4z" />
  </Svg>
);

// « Conseiller » : la petite pensée, un nuage qui sourit (« Claire a pensé à toi »).
export const IconePensee = ({ taille = 24, couleur = colors.gris, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M7.5 16a4.2 4.2 0 0 1-.2-8.4 5.2 5.2 0 0 1 9.9-.3A4.1 4.1 0 0 1 17 16z" />
    <Circle cx="6" cy="19.3" r="1.3" />
    <Circle cx="3.3" cy="21.6" r="0.7" />
    <Circle cx="10.4" cy="11" r="0.95" fill={couleur} stroke="none" />
    <Circle cx="13.8" cy="11" r="0.95" fill={couleur} stroke="none" />
    <Path d="M11.2 13.2c.6.6 1.4.6 2 0" strokeWidth={1.2} />
  </Svg>
);

export const IconeCarnet = ({ taille = 24, couleur = colors.gris, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z" />
    <Path d="M5 17a2 2 0 0 1 2-2h12" />
  </Svg>
);

export const IconePlus = ({ taille = 24, couleur = colors.encre, epaisseur = 2 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconeFermer = ({ taille = 22, couleur = colors.encre, epaisseur = 2 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const IconeCloche = ({ taille = 22, couleur = colors.encre, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
    <Path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

// Le Culkoko : le K dodu, avec ses yeux, ses joues roses et ses traits d'applaudissement.
// « plein » = Culkoko donné : le corps se remplit, les yeux prennent la couleur du fond.
type PropsCulkoko = Props & { plein?: boolean; fond?: string };
export const IconeCulkoko = ({ taille = 20, couleur = colors.culkoko, plein = false, fond = '#FFFFFF' }: PropsCulkoko) => {
  const yeux = plein ? fond : couleur;
  return (
    <Svg {...base(taille, couleur, 2)}>
      <Rect x="2.5" y="3" width="9.5" height="18" rx="4.75" fill={plein ? couleur : 'none'} />
      <Path d="M12 12l4.8-5.4M12 14.5l6 6.5" strokeWidth={3} />
      <Path d="M19 2.8l.3 1.9M21.6 5.2l-1.8.8M21.8 8.6l-1.9-.2" strokeWidth={1.6} />
      <Circle cx="5.6" cy="10" r="1.05" fill={yeux} stroke="none" />
      <Circle cx="8.9" cy="10" r="1.05" fill={yeux} stroke="none" />
      <Path d="M6.15 13c.6.7 1.6.7 2.2 0" stroke={yeux} strokeWidth={1.3} />
      <Circle cx="4.5" cy="12.4" r="0.75" fill="#F28B73" stroke="none" />
      <Circle cx="10" cy="12.4" r="0.75" fill="#F28B73" stroke="none" />
    </Svg>
  );
};

export const IconeBulle = ({ taille = 18, couleur = colors.encre, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </Svg>
);

export const IconeReglages = ({ taille = 20, couleur = colors.encre, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
  </Svg>
);

export const IconeMonde = ({ taille = 16, couleur = colors.gris, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </Svg>
);

export const IconePhoto = ({ taille = 22, couleur = colors.encre, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M4 7h3l2-3h6l2 3h3v13H4z" />
    <Circle cx="12" cy="13" r="4" />
  </Svg>
);

export const IconeRetour = ({ taille = 24, couleur = colors.encre, epaisseur = 2.2 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const IconeAmis = ({ taille = 22, couleur = colors.encre, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Circle cx="9" cy="8" r="3.5" />
    <Path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <Path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.6 5.2" />
  </Svg>
);
