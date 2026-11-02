// Créer un compte ou se connecter, par e-mail et mot de passe.
// (Apple et Google viendront plus tard : ils demandent des comptes développeur.)
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { Champ, MessageErreur, MessageInfo } from '../components/Formulaire';
import { IconeFermer } from '../components/Icones';
import { traduireErreur } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../theme';

export default function Connexion() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'inscription' | 'connexion'>(params.mode === 'connexion' ? 'connexion' : 'inscription');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const inscription = mode === 'inscription';
  const valide = /\S+@\S+\.\S+/.test(email.trim()) && motDePasse.length >= 6;

  async function valider() {
    if (!supabase || !valide || enCours) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    const identifiants = { email: email.trim().toLowerCase(), password: motDePasse };
    // Le lien de confirmation (si Supabase en envoie un) ramène sur la version en ligne de l'appli.
    const site = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SITE_URL;
    const { data, error } = inscription
      ? await supabase.auth.signUp({ ...identifiants, options: site ? { emailRedirectTo: `${site}/` } : undefined })
      : await supabase.auth.signInWithPassword(identifiants);
    setEnCours(false);
    if (error) return setErreur(traduireErreur(error.message));
    // Si la confirmation par e-mail est activée dans Supabase, il n'y a pas encore de session.
    if (inscription && !data.session) {
      setInfo('C’est presque fini : clique sur le lien reçu par e-mail pour confirmer ton adresse, puis reviens te connecter.');
      setMode('connexion');
    }
    // Sinon, l'appli bascule toute seule vers l'étape suivante.
  }

  async function motDePasseOublie() {
    setErreur(null);
    setInfo(null);
    if (!supabase) return;
    if (!/\S+@\S+\.\S+/.test(email.trim())) return setErreur('Écris d’abord ton adresse e-mail ci-dessus.');
    // Le lien de l'e-mail ramène sur l'écran « Nouveau mot de passe » de la version web.
    const site = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SITE_URL;
    const redirectTo = site ? `${site}/nouveau-mot-de-passe` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) return setErreur(traduireErreur(error.message));
    setInfo('Si un compte existe avec cette adresse, tu vas recevoir un e-mail pour choisir un nouveau mot de passe.');
  }

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/bienvenue');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={fermer} style={styles.fermer}>
            <IconeFermer />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.titre}>
            {inscription ? 'Crée ton Culky' : 'Content de te revoir !'}
          </Text>
          <Text style={styles.sousTitre}>
            {inscription ? 'Ça prend moins d’une minute.' : 'Connecte-toi pour retrouver ton Culky.'}
          </Text>

          <Champ
            label="Ton adresse e-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="prenom@exemple.fr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Champ
            label="Ton mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder={inscription ? 'Au moins 6 caractères' : ''}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={inscription ? 'new-password' : 'current-password'}
            textContentType={inscription ? 'newPassword' : 'password'}
            onSubmitEditing={valider}
          />

          <MessageErreur texte={erreur} />
          <MessageInfo texte={info} />

          {!inscription ? (
            <Pressable accessibilityRole="button" onPress={motDePasseOublie} style={styles.lienDiscret}>
              <Text style={styles.lienDiscretTexte}>Mot de passe oublié ?</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.bas}>
          <BoutonPrincipal
            label={enCours ? 'Un instant…' : inscription ? 'Créer mon Culky' : 'Me connecter'}
            desactive={!valide || enCours}
            onPress={valider}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(inscription ? 'connexion' : 'inscription');
              setErreur(null);
              setInfo(null);
            }}
            style={styles.lien}
          >
            <Text style={styles.lienTexte}>{inscription ? 'J’ai déjà un compte' : 'Je n’ai pas encore de compte'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 12, paddingTop: 10 },
  fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  contenu: { paddingHorizontal: 24, paddingTop: 12, gap: 18 },
  titre: { fontFamily: fonts.titre, fontSize: 28, lineHeight: 34, color: colors.culkoko },
  sousTitre: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.gris, marginTop: -8 },
  lienDiscret: { height: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  lienDiscretTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre, textDecorationLine: 'underline' },
  bas: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
