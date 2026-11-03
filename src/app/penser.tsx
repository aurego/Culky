// Écran « Conseiller » : choisir à qui conseiller une œuvre, ajouter un mot, et l'envoyer.
// La personne qui reçoit voit « Claire a pensé à toi ».
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BoutonPrincipal } from '../components/Base';
import { MessageErreur, MessageInfo } from '../components/Formulaire';
import { IconeFermer } from '../components/Icones';
import { lireOeuvre, type OeuvreTrouvee } from '../lib/oeuvres';
import { lienInvitation } from '../lib/invitation';
import { amisPourOeuvre, creerInvitation, envoyerPenses, type Ami } from '../lib/penses';
import { traduireErreur, useSession } from '../lib/session';
import { colors, fonts, univers } from '../theme';

export default function Penser() {
  const { oeuvre: oeuvreId } = useLocalSearchParams<{ oeuvre: string }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [oeuvre, setOeuvre] = useState<OeuvreTrouvee | null>(null);
  const [amis, setAmis] = useState<Ami[]>([]);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [mot, setMot] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!oeuvreId || !moi) return;
    lireOeuvre(oeuvreId)
      .then(async (o) => {
        setOeuvre(o);
        if (o) setAmis(await amisPourOeuvre(moi, oeuvreId, o.univers));
      })
      .catch(() => setErreur('Impossible de charger tes amis pour l’instant.'))
      .finally(() => setChargement(false));
  }, [oeuvreId, moi]);


  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function basculer(id: string) {
    setChoisis(choisis.includes(id) ? choisis.filter((x) => x !== id) : [...choisis, id]);
  }

  async function envoyer() {
    if (!oeuvre?.id || choisis.length === 0 || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      await envoyerPenses(moi, oeuvre.id, choisis, mot, false);
      const noms = amis.filter((a) => choisis.includes(a.id)).map((a) => a.pseudo);
      setInfo(`C’est envoyé à ${noms.join(', ')}. Tu sauras s’il a touché juste.`);
      setChoisis([]);
      setTimeout(fermer, 1800);
    } catch (e) {
      setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
    } finally {
      setEnCours(false);
    }
  }

  // Pour quelqu'un qui n'a pas encore Kulky : un message à envoyer par WhatsApp, SMS…
  async function inviter() {
    if (!oeuvre?.id) return;
    setErreur(null);
    try {
      const code = await creerInvitation(moi, oeuvre.id, mot, false);
      const lien = lienInvitation(code);
      const texte = `« ${oeuvre.titre} » m’a fait penser à toi${mot.trim() ? `\n${mot.trim()}` : ''}${lien ? `\nRetrouve-le sur Kulky : ${lien}` : ''}`;
      try {
        await Share.share({ message: texte });
      } catch {
        setInfo(`Copie ce message et envoie-le :\n\n${texte}`);
      }
    } catch (e) {
      setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
    }
  }

  const u = oeuvre ? univers[oeuvre.univers] : null;

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={styles.rond44}>
            <IconeFermer />
          </Pressable>
          <Text accessibilityRole="header" style={styles.titre}>Conseiller</Text>
          <View style={{ width: 44 }} />
        </View>

        {chargement ? (
          <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              {oeuvre && u && (
                <View style={[styles.oeuvre, { backgroundColor: u.teinte }]}>
                  {oeuvre.image_url ? <Image source={{ uri: oeuvre.image_url }} style={styles.vignette} /> : <View style={[styles.vignette, { backgroundColor: u.couleur }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.universTexte, { color: u.texteFonce }]}>{u.label}</Text>
                    <Text style={styles.titreOeuvre} numberOfLines={2}>{oeuvre.titre}</Text>
                    {oeuvre.createur ? <Text style={styles.petit}>{oeuvre.createur}</Text> : null}
                  </View>
                </View>
              )}

              <Text style={styles.section}>À qui le conseilles-tu ?</Text>
              {amis.length === 0 ? (
                <Text style={styles.petit}>Tu ne suis encore personne. Invite un proche avec le lien ci-dessous, ou trouve des amis dans Découvrir.</Text>
              ) : (
                <View style={styles.amis}>
                  {amis.map((a) => {
                    const actif = choisis.includes(a.id);
                    return (
                      <Pressable
                        key={a.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: actif, disabled: a.dejaVecu }}
                        disabled={a.dejaVecu}
                        onPress={() => basculer(a.id)}
                        style={[styles.ami, actif && styles.amiActif, a.dejaVecu && styles.amiGrise]}
                      >
                        <Avatar initiale={a.pseudo.charAt(0).toUpperCase()} fond={univers[a.univers_choisis?.[0] ?? 'livres'].teinte} taille={32} />
                        <Text style={[styles.amiTexte, actif && { color: '#FFFFFF' }]}>
                          {a.pseudo}
                          {a.dejaVecu ? <Text style={styles.petit}> · l’a déjà vécu</Text> : null}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Un petit mot (facultatif)</Text>
                <View style={styles.motsPrets}>
                  {['Tu vas adorer !', 'Ça te ressemble.', 'Pour ton prochain week-end.', 'J’ai pensé à toi tout du long.'].map((m) => (
                    <Pressable key={m} accessibilityRole="button" onPress={() => setMot(m)} style={[styles.motPret, mot === m && styles.motPretActif]}>
                      <Text style={[styles.motPretTexte, mot === m && { color: '#FFFFFF' }]}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  aria-label="Un petit mot"
                  value={mot}
                  onChangeText={setMot}
                  placeholder="Ça m’a fait penser à toi parce que…"
                  placeholderTextColor={colors.gris}
                  multiline
                  maxLength={300}
                  style={styles.champ}
                />
              </View>


              <MessageErreur texte={erreur} />
              <MessageInfo texte={info} />

              <Pressable accessibilityRole="button" onPress={inviter} style={styles.lien}>
                <Text style={styles.lienTexte}>Conseiller à quelqu’un qui n’a pas encore Kulky</Text>
              </Pressable>
            </ScrollView>
            <View style={styles.pied}>
              <BoutonPrincipal
                label={enCours ? 'Un instant…' : choisis.length ? `Conseiller à ${choisis.length} ami${choisis.length > 1 ? 's' : ''}` : 'Choisis au moins un ami'}
                desactive={!choisis.length || enCours}
                onPress={envoyer}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
  contenu: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 16 },
  oeuvre: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12 },
  vignette: { width: 52, height: 72, borderRadius: 8 },
  universTexte: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
  section: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris },
  texte: { fontFamily: fonts.texte, fontSize: 15, color: colors.encre },
  amis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ami: { height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  amiActif: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  amiGrise: { opacity: 0.55 },
  motsPrets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  motPret: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.bordure, backgroundColor: colors.carte, justifyContent: 'center' },
  motPretActif: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  motPretTexte: { fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  amiTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  champ: { minHeight: 88, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, padding: 12, fontFamily: fonts.texte, fontSize: 15, color: colors.encre, textAlignVertical: 'top' },
  interrupteur: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  case: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  caseActive: { backgroundColor: colors.culkoko },
  coche: { color: '#FFFFFF', fontFamily: fonts.texteGras, fontSize: 15 },
  lien: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko, textAlign: 'center' },
  pied: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26 },
});
