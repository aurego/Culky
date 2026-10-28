// Les icônes de l'appli, dessinées en traits fins comme dans les maquettes.
import Svg, { Circle, Path } from 'react-native-svg';
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

export const IconeCadeau = ({ taille = 24, couleur = colors.gris, epaisseur = 1.8 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M20 12v8H4v-8M2 7h20v5H2zM12 21V7M12 7C10 3 7 4 7 6s5 1 5 1 5 1 5-1-3-3-5 1z" />
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

export const IconeCulkoko = ({ taille = 18, couleur = colors.culkoko, epaisseur = 2 }: Props) => (
  <Svg {...base(taille, couleur, epaisseur)}>
    <Path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
  </Svg>
);

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
