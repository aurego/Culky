// « Installe Kulky sur ton écran d'accueil » : proposé une fois, juste après l'inscription, sur le web.
// Kulky s'ouvre alors comme une vraie appli (plein écran, son icône), et on le retrouve facilement.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { IconeFermer } from '../components/Icones';
import { systeme } from '../lib/installation';
import { colors, fonts, univers } from '../theme';

const etapesIphone = [
  'Ouvre Kulky dans Safari. (Dans WhatsApp ou Instagram, touche d’abord ⋯ puis « Ouvrir dans Safari ».)',
  'Touche le bouton Partager, le carré avec une flèche vers le haut, en bas de l’écran.',
  'Fais défiler et choisis « Sur l’écran d’accueil », puis « Ajouter ».',
];
const etapesAndroid = [
  'Ouvre Kulky dans Chrome.',
  'Touche le menu ⋮ en haut à droite.',
  'Choisis « Ajouter à l’écran d’accueil » ou « Installer l’application », puis confirme.',
];

export default function Installer() {
  const os = systeme();
  const blocs = os === 'android' ? (['android', 'iphone'] as const) : (['iphone', 'android'] as const);

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.entete}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={styles.rond44}>
          <IconeFermer />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text accessibilityRole="header" style={styles.titre}>Installe Kulky sur ton écran d’accueil</Text>
        <Text style={styles.texte}>Kulky s’ouvrira comme une vraie appli, en un toucher, sans chercher le lien. Ça prend dix secondes :</Text>
        {blocs.map((b) => (
          <View key={b} style={[styles.bloc, { backgroundColor: b === 'iphone' ? univers.livres.teinte : univers.expos.teinte }]}>
            <Text style={styles.blocTitre}>{b === 'iphone' ? 'Sur iPhone (Safari)' : 'Sur Android (Chrome)'}</Text>
            {(b === 'iphone' ? etapesIphone : etapesAndroid).map((e, i) => (
              <View key={e} style={styles.etape}>
                <Text style={styles.numero}>{i + 1}</Text>
                <Text style={[styles.texte, { flex: 1, color: colors.encre }]}>{e}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.petit}>Ensuite, ouvre Kulky depuis sa nouvelle icône. La première fois, il faudra peut-être te reconnecter.</Text>
      </ScrollView>
      <View style={styles.pied}>
        <BoutonPrincipal label="C’est fait" onPress={fermer} />
        <Pressable accessibilityRole="button" onPress={fermer} style={styles.lien}>
          <Text style={styles.lienTexte}>Plus tard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 12, paddingTop: 10 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  contenu: { paddingHorizontal: 24, paddingBottom: 16, gap: 16 },
  titre: { fontFamily: fonts.titre, fontSize: 26, lineHeight: 32, color: colors.culkoko },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 22, color: colors.gris },
  bloc: { borderRadius: 18, padding: 16, gap: 10 },
  blocTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
  etape: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.carte, textAlign: 'center', lineHeight: 26, fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre, overflow: 'hidden' },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 19, color: colors.gris },
  pied: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.gris },
});
