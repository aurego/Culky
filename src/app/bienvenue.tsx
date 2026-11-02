// Écran de bienvenue : la promesse de Culky en une phrase, et « Commencer ».
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimationArrivee } from '../components/AnimationArrivee';
import { BoutonPrincipal } from '../components/Base';
import { colors, fonts, univers, universIds } from '../theme';

export default function Bienvenue() {
  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.haut}>
        <AnimationArrivee taille={50} />
        <Text style={styles.promesse}>Chaque lecture et chaque sortie culturelle mérite d’être célébrée.</Text>
        <Text style={styles.sousPromesse}>Fais découvrir tes coups de cœur, découvre ceux de tes amis.</Text>
        <View style={styles.univers}>
          {universIds.map((id) => (
            <View key={id} style={[styles.pastille, { backgroundColor: univers[id].teinte }]}>
              <View style={[styles.point, { backgroundColor: univers[id].couleur }]} />
              <Text style={styles.pastilleTexte}>{univers[id].label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.bas}>
        <BoutonPrincipal label="Créer mon Culky" onPress={() => router.push({ pathname: '/connexion', params: { mode: 'inscription' } })} />
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/connexion', params: { mode: 'connexion' } })} style={styles.lien}>
          <Text style={styles.lienTexte}>J’ai déjà un compte</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24 },
  haut: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  formule: { fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.gris },
  promesse: { fontFamily: fonts.titre, fontSize: 26, lineHeight: 33, marginTop: 8, color: colors.culkoko, textAlign: 'center' },
  sousPromesse: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.gris, textAlign: 'center' },
  univers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 2 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18 },
  point: { width: 8, height: 8, borderRadius: 4 },
  pastilleTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
