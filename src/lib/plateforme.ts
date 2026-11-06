// Petits réglages qui changent selon l'appareil.
import { Platform } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

// Les écrans qui s'ouvrent « en feuille » sur iPhone (Enregistrer, Conseiller…) : iOS gère déjà le haut,
// on ne garde donc que les marges du bas et des côtés (sinon un grand vide apparaît en haut).
export const bordsFeuille: Edge[] | undefined = Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : undefined;
