// Écran de bienvenue : épuré. La maille de Kulky (qui dit déjà « on se relie par la culture »),
// la devise, une ligne discrète avec les 4 univers, et les deux boutons.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimationArrivee } from '../components/AnimationArrivee';
import { BoutonPrincipal } from '../components/Base';
import { colors, fonts, univers, universIds, categorieIds, categories } from '../theme';

export default function Bienvenue() {
  // La ligne des univers et les boutons arrivent en douceur, une fois la maille tissée.
  // Au plus tard au bout de 1,2 s, même si l'animation n'est pas finie : on n'attend pas pour s'inscrire.
  const suite = useRef(new Animated.Value(0)).current;
  const dejaMontree = useRef(false);
  const montrerSuite = useCallback(() => {
    if (dejaMontree.current) return;
    dejaMontree.current = true;
    Animated.timing(suite, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  }, [suite]);
  useEffect(() => {
    const t = setTimeout(montrerSuite, 1200);
    return () => clearTimeout(t);
  }, [montrerSuite]);
  const glisse = { opacity: suite, transform: [{ translateY: suite.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.haut}>
        <AnimationArrivee taille={58} onFini={montrerSuite} />
        <Animated.View style={[styles.univers, glisse]} accessibilityLabel="Livres, ciné, concerts, spectacles, expos">
          {categorieIds.map((id) => (
            <View key={id} style={styles.unUnivers}>
              <View style={[styles.point, { backgroundColor: univers[categories[id].univers].couleur }]} />
              <Text style={styles.universTexte}>{categories[id].label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
      <Animated.View style={[styles.bas, glisse]}>
        <BoutonPrincipal label="Créer mon Kulky" onPress={() => router.push({ pathname: '/connexion', params: { mode: 'inscription' } })} />
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/connexion', params: { mode: 'connexion' } })} style={styles.lien}>
          <Text style={styles.lienTexte}>J’ai déjà un compte</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24 },
  haut: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 28 },
  univers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 8 },
  unUnivers: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  point: { width: 8, height: 8, borderRadius: 4 },
  universTexte: { fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.gris },
  bas: { paddingBottom: 24, gap: 6, width: '100%', maxWidth: 420, alignSelf: 'center' },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
