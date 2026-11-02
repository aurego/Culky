// L'écran qui fête chaque activité, juste après « Publier ».
// C'est le cœur de l'axe de Culky : « Chaque lecture et chaque sortie culturelle mérite d'être célébrée. »
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { emotionParId } from '../data/emotions';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';

const bravos: Record<UniversId, string[]> = {
  livres: ['Bravo, encore un livre de lu !', 'Belle lecture !', 'Une page de plus à ton histoire !'],
  cine: ['Belle séance !', 'Clap de fin, et bravo !', 'Un film de plus dans ta collection !'],
  concerts: ['Quel concert !', 'Les oreilles encore pleines de musique ?', 'Un concert de plus, bravo !'],
  expos: ['Belle visite !', 'Une expo de plus dans tes yeux !', 'Bravo pour cette sortie !'],
};

const nombreConfettis = 18;
const couleurs = [...universIds.map((u) => univers[u].couleur), colors.culkoko];

export default function Celebration() {
  const p = useLocalSearchParams<{ univers?: string; titre?: string; commence?: string; rang?: string; emotion?: string }>();
  const u: UniversId = universIds.includes(p.univers as UniversId) ? (p.univers as UniversId) : 'livres';
  const commence = p.commence === '1';
  const emotion = p.emotion ? emotionParId(p.emotion) : undefined;
  const titre = useRef(commence ? 'Bonne lecture !' : bravos[u][Math.floor(Math.random() * bravos[u].length)]).current;

  const echelle = useRef(new Animated.Value(0.3)).current;
  const eclat = useRef(new Animated.Value(0)).current;
  const natif = Platform.OS !== 'web';

  useEffect(() => {
    Animated.parallel([
      Animated.spring(echelle, { toValue: 1, friction: 4, tension: 80, useNativeDriver: natif }),
      Animated.timing(eclat, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: natif }),
    ]).start();
  }, [echelle, eclat, natif]);

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.centre}>
        <View style={styles.scene} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: nombreConfettis }, (_, i) => {
            const angle = (i / nombreConfettis) * Math.PI * 2;
            const distance = 92 + (i % 3) * 18;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: couleurs[i % couleurs.length],
                    opacity: eclat.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0.85] }),
                    transform: [
                      { translateX: eclat.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] }) },
                      { translateY: eclat.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] }) },
                      { rotate: eclat.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 220}deg`] }) },
                    ],
                  },
                ]}
              />
            );
          })}
          <Animated.View style={[styles.medaille, { backgroundColor: univers[u].couleur, transform: [{ scale: echelle }] }]}>
            <Text style={styles.medailleEmoji}>{commence ? '📖' : emotion?.emoji ?? '🎉'}</Text>
          </Animated.View>
        </View>

        <Text accessibilityRole="header" style={styles.titre}>{titre}</Text>
        {p.titre ? <Text style={styles.oeuvre}>{p.titre}</Text> : null}
        {commence ? (
          <Text style={styles.texte}>Il rejoint tes lectures en cours. On fêtera ça quand tu l’auras fini !</Text>
        ) : (
          <>
            {p.rang ? (
              <Text style={styles.rang}>
                C’est <Text style={{ color: univers[u].texteFonce }}>{p.rang}</Text>.
              </Text>
            ) : null}
            <Text style={styles.texte}>C’est dans ton journal. Tes amis vont pouvoir te féliciter 🎉</Text>
          </>
        )}
      </View>

      <View style={styles.bas}>
        <BoutonPrincipal label="Voir mon journal" onPress={() => router.replace('/carnet')} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.lien}>
          <Text style={styles.lienTexte}>Retour à l’accueil</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  scene: { width: 280, height: 290, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  confetti: { position: 'absolute', width: 12, height: 18, borderRadius: 4 },
  medaille: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', shadowColor: colors.encre, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  medailleEmoji: { fontSize: 60 },
  titre: { fontFamily: fonts.titreGras, fontSize: 30, lineHeight: 36, color: colors.encre, textAlign: 'center' },
  oeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.gris, textAlign: 'center' },
  rang: { fontFamily: fonts.titre, fontSize: 20, lineHeight: 27, color: colors.encre, textAlign: 'center', marginTop: 6 },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.gris, textAlign: 'center', marginTop: 4 },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
