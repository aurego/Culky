// La petite barre de progression en haut des écrans d'inscription.
import { View } from 'react-native';
import { colors } from '../theme';

export function Etapes({ actuelle, total }: { actuelle: number; total: number }) {
  return (
    <View accessibilityLabel={`Étape ${actuelle} sur ${total}`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < actuelle ? colors.culkoko : colors.bordure }} />
      ))}
    </View>
  );
}
