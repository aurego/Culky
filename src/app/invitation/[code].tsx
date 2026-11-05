// La page qu'ouvre un ami à qui on a envoyé un conseil par lien (WhatsApp, SMS…).
// Sans compte : « Claire a pensé à toi », le livre ou le film, son petit mot, et « Créer mon Kulky ».
// Déjà connecté : on accepte tout de suite et on file dans « Pour toi ».
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal, Logo } from '../../components/Base';
import { IconePensee } from '../../components/Icones';
import { accepterInvitation, garderCode, lireInvitation, oublierCode, type Invitation } from '../../lib/invitation';
import { useSession } from '../../lib/session';
import { colors, fonts, univers } from '../../theme';

const verbe: Record<string, string> = { livres: 'ce livre', cine: 'ce film', concerts: 'cette sortie', expos: 'cette expo' };

export default function PageInvitation() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { pret, session, profil } = useSession();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [chargement, setChargement] = useState(true);
  const [probleme, setProbleme] = useState(false);
  const [tropLong, setTropLong] = useState(false);

  // Compte créé mais inscription pas finie : on garde le code et on file vers les étapes d'inscription.
  useEffect(() => {
    if (!code || !pret || !session || profil?.inscription_terminee) return;
    garderCode(code).then(() => router.replace('/inscription'));
  }, [code, pret, session, profil?.inscription_terminee]);

  // Jamais de roue sans fin : au bout de 8 secondes, on propose de continuer.
  useEffect(() => {
    const t = setTimeout(() => setTropLong(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!code) return;
    lireInvitation(code)
      .then(setInvitation)
      .catch(() => setProbleme(true))
      .finally(() => setChargement(false));
  }, [code]);

  // Déjà inscrit : on rattache le conseil et on l'affiche.
  useEffect(() => {
    if (!code || !session || !profil?.inscription_terminee) return;
    accepterInvitation(code)
      .catch(() => false)
      .then(() => oublierCode())
      .then(() => router.replace('/pour-toi'));
  }, [code, session, profil?.inscription_terminee]);

  async function commencer(mode: 'inscription' | 'connexion') {
    if (code) await garderCode(code);
    router.push({ pathname: '/connexion', params: { mode } });
  }

  const u = invitation ? univers[invitation.univers] : null;
  const valide = invitation && !invitation.deja_acceptee;

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.haut}>
        <Logo taille={40} />
        {chargement || session ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} /> : null}
        {(chargement || session) && tropLong ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.lien}>
            <Text style={styles.lienTexte}>Ça prend du temps… Continuer</Text>
          </Pressable>
        ) : null}

        {!chargement && !session && valide && u ? (
          <View style={{ gap: 18 }}>
            <View style={styles.titreLigne}>
              <IconePensee taille={34} couleur={colors.culkoko} />
              <Text accessibilityRole="header" style={styles.titre}>
                {invitation.expediteur_pseudo} a pensé à toi
              </Text>
            </View>
            <Text style={styles.sousTitre}>{invitation.expediteur_pseudo} te conseille {verbe[invitation.univers] ?? 'ceci'} :</Text>
            <View style={[styles.oeuvre, { backgroundColor: u.teinte }]}>
              {invitation.image_url ? (
                <Image source={{ uri: invitation.image_url }} style={styles.vignette} />
              ) : (
                <View style={[styles.vignette, { backgroundColor: u.couleur }]} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.universTexte, { color: u.texteFonce }]}>{u.label}</Text>
                <Text style={styles.titreOeuvre} numberOfLines={3}>{invitation.titre}</Text>
                {invitation.createur ? <Text style={styles.createur}>{invitation.createur}</Text> : null}
              </View>
            </View>
            {invitation.mot ? <Text style={styles.mot}>« {invitation.mot} »</Text> : null}
            <Text style={styles.explication}>
              Kulky, c’est le carnet où l’on célèbre ses lectures, ses films et ses sorties avec ses amis. Crée ton Kulky : ce conseil t’y attendra, et tu seras relié·e à {invitation.expediteur_pseudo}.
            </Text>
          </View>
        ) : null}

        {!chargement && !session && !valide ? (
          <View style={{ gap: 10, marginTop: 24 }}>
            <Text style={styles.titre}>{invitation?.deja_acceptee ? 'Ce conseil a déjà trouvé son destinataire' : probleme ? 'Impossible d’ouvrir ce lien pour l’instant' : 'Ce lien s’est un peu perdu en route'}</Text>
            <Text style={styles.sousTitre}>Tu peux quand même créer ton Kulky et retrouver tes amis.</Text>
          </View>
        ) : null}
      </View>

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
  haut: { flex: 1, paddingTop: 28, gap: 28 },
  titreLigne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titre: { flex: 1, fontFamily: fonts.titreGras, fontSize: 28, lineHeight: 34, color: colors.culkoko },
  sousTitre: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.gris },
  oeuvre: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 14 },
  vignette: { width: 64, height: 92, borderRadius: 10 },
  universTexte: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 19, lineHeight: 24, color: colors.encre },
  createur: { fontFamily: fonts.texte, fontSize: 14, color: colors.gris },
  mot: { fontFamily: fonts.texte, fontSize: 17, lineHeight: 25, color: colors.encre, fontStyle: 'italic' },
  explication: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
