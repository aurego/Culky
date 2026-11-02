// Écran de bienvenue : la promesse de Culky en une phrase, et « Commencer ».
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal, Logo } from '../components/Base';
import { colors, fonts, univers, universIds } from '../theme';

export default function Bienvenue() {
  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.haut}>
        <View style={{ gap: 6 }}>
          <Logo taille={56} />
          <Text style={styles.formule}>Vis-le, garde-le, partage-le.</Text>
        </View>
        <Text style={styles.promesse}>Chaque sortie culturelle mérite d’être partagée.</Text>
        <Text style={styles.sousPromesse}>Inspire tes amis, et laisse-toi inspirer par les leurs.</Text>
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
  haut: { flex: 1, justifyContent: 'center', gap: 18 },
  formule: { fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.gris },
  promesse: { fontFamily: fonts.titre, fontSize: 30, lineHeight: 37, marginTop: 18, color: colors.encre },
  sousPromesse: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.gris },
  univers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18 },
  point: { width: 8, height: 8, borderRadius: 4 },
  pastilleTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
