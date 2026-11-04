// « À propos de Kulky » : la version, d'où viennent les données (crédits obligatoires) et comment nous écrire.
import Constants from 'expo-constants';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Base';
import { EnTetePage } from '../components/EnTete';
import { colors, fonts } from '../theme';

const sources = [
  { nom: 'TMDB', role: 'Les films, leurs affiches et leurs réalisateurs.', mention: 'Ce produit utilise l’API TMDB sans être approuvé ni certifié par TMDB.', lien: 'https://www.themoviedb.org' },
  { nom: 'Google Books', role: 'Les livres, leurs couvertures et leur nombre de pages.', mention: 'Recherche fournie par Google Books.', lien: 'https://books.google.com' },
  { nom: 'MusicBrainz', role: 'Les artistes et les groupes, pour les concerts.', mention: 'Données MusicBrainz, sous licence libre CC0.', lien: 'https://musicbrainz.org' },
];

export default function APropos() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre="À propos de Kulky" />
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Logo taille={40} />
          <Text style={styles.devise}>Vis-le, enregistre-le, partage-le.</Text>
          <Text style={styles.petit}>Version {version} · Fait à Toulouse</Text>
        </View>

        <Text style={styles.sousTitre}>D’où viennent les données</Text>
        {sources.map((s) => (
          <Pressable key={s.nom} accessibilityRole="link" onPress={() => Linking.openURL(s.lien)} style={styles.carte}>
            <Text style={styles.nom}>{s.nom}</Text>
            <Text style={styles.texte}>{s.role}</Text>
            <Text style={styles.petit}>{s.mention}</Text>
          </Pressable>
        ))}
        <View style={styles.carte}>
          <Text style={styles.nom}>La communauté Kulky</Text>
          <Text style={styles.texte}>Les expos et les spectacles sont ceux que les utilisateurs ont enregistrés. Merci à vous !</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  devise: { fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.gris },
  sousTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre, marginTop: 12 },
  carte: { backgroundColor: colors.carte, borderRadius: 16, padding: 14, gap: 4 },
  nom: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 12, lineHeight: 17, color: colors.gris },
});
