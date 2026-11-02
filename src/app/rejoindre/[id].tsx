// « Rejoins-moi sur Culky » : la page qu'ouvre un ami avec mon lien d'invitation.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BoutonPrincipal, Logo } from '../../components/Base';
import { lireProfil, type ProfilPublic } from '../../lib/fil';
import { garderParrain, oublierParrain, rejoindre } from '../../lib/invitation';
import { useSession } from '../../lib/session';
import { colors, fonts, univers } from '../../theme';

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
      <View style={styles.haut}>
        <Logo taille={40} />
        {chargement || session ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} /> : null}
        {!chargement && !session ? (
          <View style={{ alignItems: 'center', gap: 16, marginTop: 30 }}>
            {parrain ? <Avatar initiale={parrain.pseudo.charAt(0).toUpperCase()} fond={univers[parrain.univers_choisis?.[0] ?? 'livres'].teinte} taille={96} photo={parrain.photo_url} /> : null}
            <Text accessibilityRole="header" style={styles.titre}>
              {parrain ? `${parrain.pseudo} t’invite sur Culky` : 'Bienvenue sur Culky'}
            </Text>
            <Text style={styles.texte}>Le carnet où l’on célèbre ses lectures, ses films, ses concerts et ses expos, et où l’on se donne envie entre amis.</Text>
            {parrain ? <Text style={styles.texte}>Crée ton Culky : vous serez reliés tout de suite.</Text> : null}
          </View>
        ) : null}
      </View>
      {!chargement && !session ? (
        <View style={styles.bas}>
          <BoutonPrincipal label="Créer mon Culky" onPress={() => commencer('inscription')} />
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
  haut: { flex: 1, paddingTop: 28 },
  titre: { fontFamily: fonts.titreGras, fontSize: 28, lineHeight: 34, color: colors.encre, textAlign: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.gris, textAlign: 'center' },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
