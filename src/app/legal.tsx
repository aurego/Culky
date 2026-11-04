// Les pages légales (mentions, confidentialité, conditions). Ouvertes à tous, même sans compte :
// les stores demandent un lien public, par ex. kulky.fr/legal?page=confidentialite.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../components/EnTete';
import { miseAJourLegale, pagesLegales } from '../data/legal';
import { useSession } from '../lib/session';
import { colors, fonts } from '../theme';

type Cle = keyof typeof pagesLegales;
const ordre: Cle[] = ['confidentialite', 'conditions', 'mentions'];

export default function Legal() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const { session, profil } = useSession();
  // Sans « ?page= », on n'a pas demandé cette page : le routeur nous y a envoyé faute de mieux
  // (par ex. en ouvrant l'appli sans être connecté·e). On repart vers le bon écran.
  if (!page) return <Redirect href={!session ? '/bienvenue' : !profil?.inscription_terminee ? '/inscription' : '/'} />;
  const cle: Cle = page && page in pagesLegales ? (page as Cle) : 'confidentialite';
  const p = pagesLegales[cle];

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre={p.titre} />
      <ScrollView contentContainerStyle={styles.contenu}>
        {p.intro ? <Text style={styles.intro}>{p.intro}</Text> : null}
        {p.sections.map((s) => (
          <View key={s.titre} style={{ gap: 4 }}>
            <Text style={styles.sousTitre}>{s.titre}</Text>
            <Text style={styles.texte}>{s.texte}</Text>
          </View>
        ))}
        <Text style={styles.petit}>Mise à jour le {miseAJourLegale}.</Text>
        <View style={styles.autres}>
          {ordre
            .filter((c) => c !== cle)
            .map((c) => (
              <Pressable key={c} accessibilityRole="link" onPress={() => router.setParams({ page: c })} style={styles.lien}>
                <Text style={styles.lienTexte}>{pagesLegales[c].titre} ›</Text>
              </Pressable>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 20, paddingBottom: 32, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  intro: { fontFamily: fonts.texteMoyen, fontSize: 15, lineHeight: 22, color: colors.encre },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.sousTitre },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 21, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  autres: { borderTopWidth: 1, borderTopColor: colors.bordure, paddingTop: 8 },
  lien: { minHeight: 44, justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.sousTitre },
});
