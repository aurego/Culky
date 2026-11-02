// On arrive ici en cliquant sur le lien de l'e-mail « mot de passe oublié ».
// Le lien connecte temporairement la personne : il ne reste qu'à choisir un nouveau mot de passe.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { Champ, MessageErreur } from '../components/Formulaire';
import { traduireErreur, useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../theme';

export default function NouveauMotDePasse() {
  const { session } = useSession();
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    if (!supabase || motDePasse.length < 6 || enCours) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setEnCours(false);
    if (error) return setErreur(traduireErreur(error.message));
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.titre}>Choisis un nouveau mot de passe</Text>
        {session ? (
          <>
            <Champ
              label="Nouveau mot de passe"
              value={motDePasse}
              onChangeText={setMotDePasse}
              placeholder="Au moins 6 caractères"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={valider}
            />
            <MessageErreur texte={erreur} />
          </>
        ) : (
          <Text style={styles.texte}>Ce lien a expiré ou a déjà servi. Redemande un e-mail depuis l’écran de connexion.</Text>
        )}
      </ScrollView>
      <View style={styles.bas}>
        {session ? (
          <BoutonPrincipal label={enCours ? 'Un instant…' : 'Enregistrer'} desactive={motDePasse.length < 6 || enCours} onPress={valider} />
        ) : (
          <BoutonPrincipal label="Retour à la connexion" onPress={() => router.replace({ pathname: '/connexion', params: { mode: 'connexion' } })} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 24, paddingTop: 40, gap: 18 },
  titre: { fontFamily: fonts.titre, fontSize: 26, lineHeight: 32, color: colors.encre },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.gris },
  bas: { paddingHorizontal: 24, paddingBottom: 24 },
});
