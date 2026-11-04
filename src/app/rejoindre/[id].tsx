// « Rejoins-moi sur Kulky » : la page qu'ouvre un ami avec mon lien d'invitation.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BoutonPrincipal, Logo } from '../../components/Base';
import { lireProfil, type ProfilPublic } from '../../lib/fil';
import { garderParrain, oublierParrain, rejoindre } from '../../lib/invitation';
import { useSession } from '../../lib/session';
import { colors, fonts, univers, universIds } from '../../theme';

export default function Rejoindre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profil: moi } = useSession();
  const [parrain, setParrain] = useState<ProfilPublic | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!id) return;
    lireProfil(id)
      .then(setParrain, () => setParrain(null))
      .finally(() => setChargement(false));
  }, [id]);

  // Déjà inscrit·e : on se suit tout de suite, et on ouvre son carnet.
  useEffect(() => {
    if (!id || !session || !moi?.inscription_terminee) return;
    rejoindre(id)
      .catch(() => false)
      .then(() => oublierParrain())
      .then(() => router.replace({ pathname: '/profil/[id]', params: { id } }));
  }, [id, session, moi?.inscription_terminee]);

  async function commencer(mode: 'inscription' | 'connexion') {
    if (id) await garderParrain(id);
    router.push({ pathname: '/connexion', params: { mode } });
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.haut}>
        <Logo taille={34} />
        {chargement || session ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} /> : null}
        {!chargement && !session ? (
          <View style={{ alignItems: 'center', gap: 14, marginTop: 22 }}>
            {parrain ? <Avatar initiale={parrain.pseudo.charAt(0).toUpperCase()} fond={univers[parrain.univers_choisis?.[0] ?? 'livres'].teinte} taille={76} photo={parrain.photo_url} /> : null}
            <Text accessibilityRole="header" style={styles.titre}>
              {parrain ? `${parrain.pseudo} t’invite sur Kulky` : 'Bienvenue sur Kulky'}
            </Text>
            <Text style={styles.texte}>Ce qui t’a ému, fait rire ou fait vibrer, garde-le ici, et partage-le avec tes amis.</Text>
            <View style={styles.univers}>
              {universIds.map((u) => (
                <View key={u} style={[styles.pastille, { backgroundColor: univers[u].teinte }]}>
                  <Text style={[styles.pastilleTexte, { color: univers[u].texteFonce }]}>{{ livres: '📚 Livres', cine: '🎬 Ciné', concerts: '🎤 Concerts et spectacles', expos: '🖼️ Expos' }[u]}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sport}>Comme une appli de sport, mais pour ta culture : tes amis t’encouragent et te conseillent.</Text>
            {parrain ? <Text style={styles.texte}>Crée ton Kulky : vous serez relié·es tout de suite.</Text> : null}
          </View>
        ) : null}
      </ScrollView>
      {!chargement && !session ? (
        <View style={styles.bas}>
          <BoutonPrincipal label="Créer mon Kulky" onPress={() => commencer('inscription')} />
          <Pressable accessibilityRole="button" onPress={() => commencer('connexion')} style={styles.lien}>
            <Text style={styles.lienTexte}>J’ai déjà un compte</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24 },
  haut: { paddingTop: 24, paddingBottom: 12 },
  titre: { fontFamily: fonts.titreGras, fontSize: 26, lineHeight: 32, color: colors.culkoko, textAlign: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.gris, textAlign: 'center' },
  univers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pastille: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pastilleTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
  sport: { fontFamily: fonts.texteMoyen, fontSize: 15, lineHeight: 21, color: colors.sousTitre, textAlign: 'center' },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
