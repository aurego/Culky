// Un écran vide, toujours présenté de la même façon : le petit K, une phrase, un ou deux gestes utiles.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, univers, type UniversId } from '../theme';
import { IconeCulkoko } from './Icones';

type Geste = { texte: string; onPress: () => void };

export function EtatVide({ titre, texte, principal, secondaire, compact = false, couleur = 'cine' }: { titre: string; texte: string; principal?: Geste; secondaire?: Geste; compact?: boolean; couleur?: UniversId }) {
  return (
    <View style={[styles.carte, compact && { paddingVertical: 16 }]}>
      {!compact ? (
        <View style={[styles.mascotte, { backgroundColor: univers[couleur].teinte }]}>
          <IconeCulkoko taille={40} interieur={univers[couleur].teinte} />
        </View>
      ) : null}
      <Text style={styles.titre}>{titre}</Text>
      <Text style={styles.texte}>{texte}</Text>
      {principal ? (
        <Pressable accessibilityRole="button" onPress={principal.onPress} style={styles.principal}>
          <Text style={styles.principalTexte}>{principal.texte}</Text>
        </Pressable>
      ) : null}
      {secondaire ? (
        <Pressable accessibilityRole="button" onPress={secondaire.onPress} style={styles.secondaire}>
          <Text style={styles.secondaireTexte}>{secondaire.texte}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Un chargement qui a échoué : le message, et un bouton pour réessayer (le « tirer vers le bas » n'existe pas sur le web).
export function ErreurChargement({ texte, onReessayer }: { texte: string; onReessayer: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.erreur}>
      <Text style={styles.texte}>{texte}</Text>
      <Pressable accessibilityRole="button" onPress={onReessayer} style={styles.reessayer}>
        <Text style={styles.secondaireTexte}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  erreur: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  reessayer: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1.5, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  carte: { backgroundColor: colors.carte, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center', gap: 8 },
  mascotte: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  titre: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko, textAlign: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  principal: { marginTop: 8, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  principalTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
  secondaire: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  secondaireTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
});
