// Inscription, étape 2 : choisir son pseudo (la photo viendra plus tard).
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../../components/Base';
import { Etapes } from '../../components/Etapes';
import { Champ, MessageErreur } from '../../components/Formulaire';
import { traduireErreur, useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../theme';

// Le pseudo provisoire donné automatiquement à l'inscription commence par « kulky » (ou « culky » pour les comptes créés avant le changement de nom) suivi de chiffres et lettres.
const estProvisoire = (p?: string) => !p || /^[ck]ulky[0-9a-f]{8}$/.test(p);

export default function Pseudo() {
  const { session, profil, rechargerProfil, seDeconnecter } = useSession();
  const [pseudo, setPseudo] = useState(estProvisoire(profil?.pseudo) ? '' : profil!.pseudo);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Toujours une majuscule au début : « claire » devient « Claire ».
  const propre = pseudo.trim().charAt(0).toUpperCase() + pseudo.trim().slice(1);
  const valide = /^[\p{L}\p{N}._-]{2,30}$/u.test(propre);

  async function valider() {
    if (!supabase || !session || !valide || enCours) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.from('profils').update({ pseudo: propre }).eq('id', session.user.id);
    setEnCours(false);
    if (error) {
      if (error.code === '23505') return setErreur('Ce pseudo est déjà pris. Essaie une variante !');
      return setErreur(traduireErreur(error.message));
    }
    await rechargerProfil();
    router.push('/inscription/univers');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Etapes actuelle={2} total={3} />
          <Text accessibilityRole="header" style={styles.titre}>Comment veux-tu qu’on t’appelle ?</Text>
          <Text style={styles.sousTitre}>Ton pseudo est visible par tes amis. Tu pourras le changer plus tard.</Text>
          <Champ
            label="Mon pseudo"
            value={pseudo}
            onChangeText={(t) => setPseudo(t.charAt(0).toUpperCase() + t.slice(1))}
            placeholder="Claire.lit"
            autoCapitalize="sentences"
            autoCorrect={false}
            maxLength={30}
            aide="Lettres, chiffres, point, tiret ou tiret bas, sans espace. La majuscule du début se met toute seule."
            onSubmitEditing={valider}
          />
          <MessageErreur texte={erreur} />
        </ScrollView>
        <View style={styles.bas}>
          <BoutonPrincipal label={enCours ? 'Un instant…' : 'Continuer'} desactive={!valide || enCours} onPress={valider} />
          <Pressable accessibilityRole="button" onPress={seDeconnecter} style={styles.lien}>
            <Text style={styles.lienTexte}>Ce n’est pas mon compte</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 24, paddingTop: 24, gap: 18 },
  titre: { fontFamily: fonts.titre, fontSize: 28, lineHeight: 34, color: colors.culkoko, marginTop: 10 },
  sousTitre: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.gris, marginTop: -8 },
  bas: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.gris },
});
