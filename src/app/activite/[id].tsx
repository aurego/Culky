// Une activité et ses commentaires : on discute entre amis, avec la case anti-spoiler.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Base';
import { CarteActivite } from '../../components/CarteActivite';
import { MessageErreur } from '../../components/Formulaire';
import { commenter, lireCommentaires, raisonsSignalement, signaler, supprimerCommentaire, type Commentaire } from '../../lib/commentaires';
import { quandActivite } from '../../lib/dates';
import { lireActivite, type ActiviteFil } from '../../lib/fil';
import { traduireErreur, useSession } from '../../lib/session';
import { colors, fonts, univers } from '../../theme';

export default function PageActivite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [activite, setActivite] = useState<ActiviteFil | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [texte, setTexte] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!id || !moi) return;
    try {
      const [a, c] = await Promise.all([lireActivite(id, moi), lireCommentaires(id)]);
      setActivite(a);
      setCommentaires(c);
    } catch {
      setErreur('Impossible de charger cette activité pour l’instant.');
    } finally {
      setChargement(false);
    }
  }, [id, moi]);

  useEffect(() => {
    charger();
  }, [charger]);

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function envoyer() {
    if (!id || !texte.trim() || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await commenter(id, moi, texte, spoiler);
      setTexte('');
      setSpoiler(false);
      setCommentaires(await lireCommentaires(id));
    } catch (e) {
      const m = (e as { message?: string })?.message ?? String(e);
      setErreur(m.includes('row-level security') ? `Seuls les abonnés de ${activite?.auteur.pseudo ?? 'cette personne'} peuvent commenter.` : traduireErreur(m));
    } finally {
      setEnvoi(false);
    }
  }

  const cEstMonActivite = activite?.auteur_id === moi;

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={retour} style={styles.rond44}>
            <Text style={styles.fleche}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.titre}>Commentaires</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          {chargement ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} /> : null}
          {!chargement && !activite ? <Text style={styles.message}>Cette activité n’est pas (ou plus) visible.</Text> : null}
          {activite ? <CarteActivite a={activite} moi={moi} detail /> : null}
          {activite && commentaires.length === 0 ? <Text style={styles.message}>Pas encore de commentaire. Lance la conversation !</Text> : null}
          {commentaires.map((c) => (
            <LigneCommentaire key={c.id} c={c} moi={moi} peutSupprimer={c.auteur_id === moi || cEstMonActivite} onChange={charger} />
          ))}
        </ScrollView>

        {activite ? (
          <View style={styles.saisie}>
            <MessageErreur texte={erreur} />
            <View style={styles.ligneSaisie}>
              <TextInput
                aria-label="Écrire un commentaire"
                value={texte}
                onChangeText={setTexte}
                placeholder={cEstMonActivite ? 'Répondre à tes amis…' : `Écrire à ${activite.auteur.pseudo}…`}
                placeholderTextColor={colors.gris}
                maxLength={1000}
                multiline
                style={styles.champ}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le commentaire" disabled={!texte.trim() || envoi} onPress={envoyer} style={[styles.envoyer, (!texte.trim() || envoi) && { opacity: 0.4 }]}>
                <Text style={styles.envoyerTexte}>Envoyer</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: spoiler }} onPress={() => setSpoiler(!spoiler)} style={styles.caseLigne}>
              <View style={[styles.case, spoiler && styles.caseCochee]}>{spoiler ? <Text style={styles.coche}>✓</Text> : null}</View>
              <Text style={styles.petit}>Ça dévoile la fin (spoiler) : le cacher jusqu’au toucher</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LigneCommentaire({ c, moi, peutSupprimer, onChange }: { c: Commentaire; moi: string; peutSupprimer: boolean; onChange: () => void }) {
  const [devoile, setDevoile] = useState(!c.spoiler || c.auteur_id === moi);
  const [options, setOptions] = useState<'ferme' | 'menu' | 'signaler' | 'merci'>('ferme');
  const pseudo = c.auteur?.pseudo ?? 'Quelqu’un';
  return (
    <View style={styles.commentaire}>
      <Avatar initiale={pseudo.charAt(0).toUpperCase()} fond={univers.cine.teinte} taille={32} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.ligneHaut}>
          <Text style={styles.qui}>
            {pseudo} <Text style={styles.quand}>· {quandActivite(c.cree_le.slice(0, 10), c.cree_le)}</Text>
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Options du commentaire" onPress={() => setOptions(options === 'ferme' ? 'menu' : 'ferme')} style={styles.optionsBouton}>
            <Text style={styles.optionsTexte}>⋯</Text>
          </Pressable>
        </View>
        {devoile ? (
          <Text style={styles.texte}>{c.texte}</Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setDevoile(true)} style={styles.spoiler}>
            <Text style={styles.spoilerTexte}>Spoiler caché · touche pour lire</Text>
          </Pressable>
        )}
        {options === 'menu' ? (
          <View style={styles.menu}>
            {peutSupprimer ? (
              <Pressable accessibilityRole="button" onPress={() => supprimerCommentaire(c.id).then(onChange, onChange)} style={styles.menuLigne}>
                <Text style={[styles.menuTexte, { color: '#7A1B29' }]}>Supprimer ce commentaire</Text>
              </Pressable>
            ) : null}
            {c.auteur_id !== moi ? (
              <Pressable accessibilityRole="button" onPress={() => setOptions('signaler')} style={styles.menuLigne}>
                <Text style={styles.menuTexte}>Signaler ce commentaire</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {options === 'signaler' ? (
          <View style={styles.menu}>
            <Text style={styles.petit}>Pourquoi le signales-tu ?</Text>
            {raisonsSignalement.map((r) => (
              <Pressable key={r} accessibilityRole="button" onPress={() => signaler(moi, { commentaire: c.id, profil: c.auteur_id }, r).then(() => setOptions('merci'), () => setOptions('merci'))} style={styles.menuLigne}>
                <Text style={styles.menuTexte}>{r}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {options === 'merci' ? <Text style={styles.petit}>Merci, on va regarder. Tu peux aussi bloquer cette personne depuis son profil.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.encre },
  contenu: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center', marginTop: 8 },
  commentaire: { flexDirection: 'row', gap: 10, backgroundColor: colors.carte, borderRadius: 16, padding: 12 },
  ligneHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qui: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre, flex: 1 },
  quand: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris, flex: 1 },
  spoiler: { backgroundColor: colors.beige, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  spoilerTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  optionsBouton: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  optionsTexte: { fontFamily: fonts.texteGras, fontSize: 18, color: colors.gris },
  menu: { backgroundColor: colors.fond, borderRadius: 12, padding: 8, gap: 2 },
  menuLigne: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 },
  menuTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  saisie: { borderTopWidth: 1, borderTopColor: colors.separateur, backgroundColor: colors.carte, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, gap: 6 },
  ligneSaisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  champ: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.fond, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.texte, fontSize: 15, color: colors.encre },
  envoyer: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  envoyerTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
  caseLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  case: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.encre, alignItems: 'center', justifyContent: 'center' },
  caseCochee: { backgroundColor: colors.encre },
  coche: { color: '#FFFFFF', fontFamily: fonts.texteGras, fontSize: 13 },
});
