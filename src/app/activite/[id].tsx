// Une activité et ses commentaires : on discute entre amis, avec la case anti-spoiler.
import type React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../../components/EnTete';
import { IconeCulkoko } from '../../components/Icones';
import { Avatar } from '../../components/Base';
import { CarteActivite } from '../../components/CarteActivite';
import { MessageErreur } from '../../components/Formulaire';
import { ErreurChargement } from '../../components/EtatVide';
import { basculerKulkokoCommentaire, commenter, lireCommentaires, raisonsSignalement, signaler, supprimerCommentaire, type Commentaire } from '../../lib/commentaires';
import { quandActivite } from '../../lib/dates';
import { lireActivite, lireKulkokos, type ActiviteFil, type Applaudisseur } from '../../lib/fil';
import { QuiAApplaudi } from '../../components/QuiAApplaudi';
import { traduireErreur, useSession } from '../../lib/session';
import { colors, fonts, univers } from '../../theme';

export default function PageActivite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [activite, setActivite] = useState<ActiviteFil | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [applaudisseurs, setApplaudisseurs] = useState<Applaudisseur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [texte, setTexte] = useState('');
  const [reponseA, setReponseA] = useState<string | null>(null); // à qui je réponds (pseudo)
  const [concentre, setConcentre] = useState(false);
  const champ = useRef<React.ElementRef<typeof TextInput>>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [probleme, setProbleme] = useState(false);
  const [signalement, setSignalement] = useState<'ferme' | 'raisons' | 'merci' | 'erreur'>('ferme');

  const charger = useCallback(async () => {
    if (!id || !moi) return;
    try {
      const [a, c] = await Promise.all([lireActivite(id, moi), lireCommentaires(id)]);
      setActivite(a);
      setCommentaires(c);
      lireKulkokos(id).then(setApplaudisseurs, () => undefined);
      setProbleme(false);
    } catch {
      setProbleme(true);
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
      setReponseA(null);
      setCommentaires(await lireCommentaires(id));
    } catch (e) {
      const m = (e as { message?: string })?.message ?? String(e);
      setErreur(m.includes('row-level security') ? `${activite?.auteur.pseudo ?? 'Cette personne'} réserve ses commentaires à ses abonnés : tu pourras commenter dès que ta demande d’abonnement sera acceptée.` : traduireErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  const cEstMonActivite = activite?.auteur_id === moi;

  // Répondre à un commentaire (en le touchant, en glissant vers la droite, ou avec « Répondre »).
  const repondre = useCallback((pseudo: string) => {
    setReponseA(pseudo);
    setTexte((t) => (t.trim() ? t : `@${pseudo} `));
    setTimeout(() => champ.current?.focus(), 50);
  }, []);

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1 }}>
        <EnTetePage titre="Activité" onRetour={retour} />
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          {chargement ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} /> : null}
          {!chargement && probleme ? <ErreurChargement texte="Impossible de charger cette activité pour l’instant." onReessayer={() => { setChargement(true); charger(); }} /> : null}
          {!chargement && !probleme && !activite ? <Text style={styles.message}>Cette activité n’est pas (ou plus) visible.</Text> : null}
          {activite ? <CarteActivite a={activite} moi={moi} detail onCulkoko={() => lireKulkokos(activite.id).then(setApplaudisseurs, () => undefined)} /> : null}
          {activite ? <QuiAApplaudi liste={applaudisseurs} moi={moi} aMoi={cEstMonActivite} /> : null}
          {activite && !cEstMonActivite ? (
            <View style={styles.menu}>
              {signalement === 'ferme' ? (
                <Pressable accessibilityRole="button" onPress={() => setSignalement('raisons')} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: colors.gris }]}>Signaler cette activité</Text>
                </Pressable>
              ) : null}
              {signalement === 'raisons' ? (
                <>
                  <Text style={styles.petit}>Pourquoi la signales-tu ?</Text>
                  {raisonsSignalement.map((r) => (
                    <Pressable
                      key={r}
                      accessibilityRole="button"
                      onPress={() => signaler(moi, { activite: activite.id, profil: activite.auteur_id }, r).then(() => setSignalement('merci'), () => setSignalement('erreur'))}
                      style={styles.menuLigne}
                    >
                      <Text style={styles.menuTexte}>{r}</Text>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" onPress={() => setSignalement('ferme')} style={styles.menuLigne}>
                    <Text style={[styles.menuTexte, { color: colors.gris }]}>Annuler</Text>
                  </Pressable>
                </>
              ) : null}
              {signalement === 'merci' ? <Text style={styles.petit}>Merci, on va regarder. Tu peux aussi bloquer cette personne depuis son profil.</Text> : null}
              {signalement === 'erreur' ? (
                <Pressable accessibilityRole="button" onPress={() => setSignalement('raisons')} style={styles.menuLigne}>
                  <Text style={styles.petit}>Oups, le signalement n’est pas parti. Touche ici pour réessayer.</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {activite && commentaires.length === 0 ? <Text style={styles.message}>Pas encore de commentaire. Lance la conversation !</Text> : null}
          {commentaires.map((c) => (
            <LigneCommentaire key={c.id} c={c} moi={moi} peutSupprimer={c.auteur_id === moi || cEstMonActivite} onChange={charger} onRepondre={repondre} />
          ))}
        </ScrollView>

        {activite ? (
          <View style={styles.saisie}>
            <MessageErreur texte={erreur} />
            {reponseA ? (
              <View style={styles.bandeauReponse}>
                <Text style={styles.bandeauTexte}>↩︎ Réponse à <Text style={{ fontFamily: fonts.texteGras }}>{reponseA}</Text></Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Annuler la réponse" hitSlop={10} onPress={() => { setReponseA(null); setTexte((t) => (t.trim() === `@${reponseA}` ? '' : t)); }}>
                  <Text style={styles.bandeauFermer}>✕</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.ligneSaisie}>
              <TextInput
                ref={champ}
                onFocus={() => setConcentre(true)}
                onBlur={() => setConcentre(false)}
                aria-label="Écrire un commentaire"
                value={texte}
                onChangeText={setTexte}
                placeholder={cEstMonActivite ? 'Écrire un commentaire…' : `Écrire à ${activite.auteur.pseudo}…`}
                placeholderTextColor={colors.gris}
                maxLength={1000}
                multiline
                style={styles.champ}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le commentaire" disabled={!texte.trim() || envoi} onPress={envoyer} style={[styles.envoyer, (!texte.trim() || envoi) && { opacity: 0.4 }]}>
                <Text style={styles.envoyerTexte}>Envoyer</Text>
              </Pressable>
            </View>
            {/* L'option « spoiler » n'apparaît que lorsqu'on écrit, pour ne pas encombrer. */}
            {concentre || texte.trim() ? (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: spoiler }} onPress={() => setSpoiler(!spoiler)} style={styles.caseLigne}>
                <View style={[styles.case, spoiler && styles.caseCochee]}>{spoiler ? <Text style={styles.coche}>✓</Text> : null}</View>
                <Text style={styles.petit}>🙈 Je dévoile la fin : cacher mon message</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LigneCommentaire({ c, moi, peutSupprimer, onChange, onRepondre }: { c: Commentaire; moi: string; peutSupprimer: boolean; onChange: () => void; onRepondre: (pseudo: string) => void }) {
  // Glisser le commentaire vers la droite pour y répondre (comme dans une messagerie).
  const decalage = useRef(new Animated.Value(0)).current;
  const pseudoRep = c.auteur?.pseudo ?? 'Quelqu’un';
  const glisser = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dx > 12 && Math.abs(g.dy) < 10,
        onPanResponderMove: (_e, g) => decalage.setValue(Math.max(0, Math.min(80, g.dx))),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 55) onRepondre(pseudoRep);
          Animated.spring(decalage, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
        },
        onPanResponderTerminate: () => Animated.spring(decalage, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start(),
      }),
    [decalage, onRepondre, pseudoRep],
  );
  const [devoile, setDevoile] = useState(!c.spoiler || c.auteur_id === moi);
  const [options, setOptions] = useState<'ferme' | 'menu' | 'supprimer' | 'signaler' | 'merci' | 'erreur'>('ferme');
  const pseudo = c.auteur?.pseudo ?? 'Quelqu’un';
  return (
    <Animated.View {...glisser.panHandlers} style={[styles.commentaire, { transform: [{ translateX: decalage }] }]}>
      <Avatar initiale={pseudo.charAt(0).toUpperCase()} fond={univers.cine.teinte} taille={32} photo={c.auteur?.photo_url} />
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
          <Text style={styles.texte} onPress={c.auteur_id !== moi ? () => onRepondre(pseudo) : undefined}>{c.texte}</Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setDevoile(true)} style={styles.spoiler}>
            <Text style={styles.spoilerTexte}>Spoiler caché · touche pour lire</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ApplaudirCommentaire c={c} moi={moi} />
          {c.auteur_id !== moi ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Répondre à ${pseudo}`} hitSlop={8} onPress={() => onRepondre(pseudo)} style={styles.repondre}>
              <Text style={styles.repondreTexte}>Répondre</Text>
            </Pressable>
          ) : null}
        </View>
        {options === 'menu' ? (
          <View style={styles.menu}>
            {peutSupprimer ? (
              <Pressable accessibilityRole="button" onPress={() => setOptions('supprimer')} style={styles.menuLigne}>
                <Text style={[styles.menuTexte, { color: '#9B2335' }]}>Supprimer ce commentaire</Text>
              </Pressable>
            ) : null}
            {c.auteur_id !== moi ? (
              <Pressable accessibilityRole="button" onPress={() => setOptions('signaler')} style={styles.menuLigne}>
                <Text style={styles.menuTexte}>Signaler ce commentaire</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {options === 'supprimer' ? (
          <View style={styles.menu}>
            <Text style={styles.petit}>Supprimer ce commentaire ? C’est définitif.</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable accessibilityRole="button" onPress={() => supprimerCommentaire(c.id).then(onChange, () => setOptions('erreur'))} style={styles.menuLigne}>
                <Text style={[styles.menuTexte, { color: '#9B2335' }]}>Oui, supprimer</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setOptions('ferme')} style={styles.menuLigne}>
                <Text style={[styles.menuTexte, { color: colors.gris }]}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {options === 'signaler' ? (
          <View style={styles.menu}>
            <Text style={styles.petit}>Pourquoi le signales-tu ?</Text>
            {raisonsSignalement.map((r) => (
              <Pressable key={r} accessibilityRole="button" onPress={() => signaler(moi, { commentaire: c.id, profil: c.auteur_id }, r).then(() => setOptions('merci'), () => setOptions('erreur'))} style={styles.menuLigne}>
                <Text style={styles.menuTexte}>{r}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {options === 'erreur' ? <Text style={styles.petit}>Oups, ça n’a pas marché. Réessaie dans un instant.</Text> : null}
        {options === 'merci' ? <Text style={styles.petit}>Merci, on va regarder. Tu peux aussi bloquer cette personne depuis son profil.</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bandeauReponse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.fond, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  bandeauTexte: { fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  bandeauFermer: { fontFamily: fonts.texteGras, fontSize: 16, color: colors.gris, paddingHorizontal: 4 },
  repondre: { minHeight: 28, justifyContent: 'center', marginTop: 2 },
  repondreTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.sousTitre },
  kkCommentaire: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, paddingHorizontal: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.bordure, marginTop: 2 },
  kkCommentaireEnvoye: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  kkTexte: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.culkoko },
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
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
  optionsBouton: { width: 44, height: 44, marginVertical: -8, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  optionsTexte: { fontFamily: fonts.texteGras, fontSize: 18, color: colors.gris },
  menu: { backgroundColor: colors.fond, borderRadius: 12, padding: 8, gap: 2 },
  menuLigne: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  menuTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  saisie: { borderTopWidth: 1, borderTopColor: colors.separateur, backgroundColor: colors.carte, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, gap: 6 },
  ligneSaisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  champ: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.fond, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  envoyer: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  envoyerTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
  caseLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  case: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  caseCochee: { backgroundColor: colors.culkoko },
  coche: { color: '#FFFFFF', fontFamily: fonts.texteGras, fontSize: 13 },
});

// Sous un commentaire : un petit Kulkoko pour l'applaudir (sans confettis), et combien l'ont fait.
function ApplaudirCommentaire({ c, moi }: { c: Commentaire; moi: string }) {
  const [envoye, setEnvoye] = useState(!!c.kk?.some((k) => k.profil_id === moi));
  const [total, setTotal] = useState(c.kk?.length ?? 0);
  if (!c.kk) return null; // complément SQL n° 19 pas encore installé
  const cEstMoi = c.auteur_id === moi;
  if (cEstMoi && total === 0) return null;
  async function basculer() {
    if (cEstMoi) return;
    const nouveau = !envoye;
    setEnvoye(nouveau);
    setTotal((t) => t + (nouveau ? 1 : -1));
    try {
      await basculerKulkokoCommentaire(c.id, moi, nouveau);
    } catch {
      setEnvoye(!nouveau);
      setTotal((t) => t + (nouveau ? -1 : 1));
    }
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: envoye, disabled: cEstMoi }}
      accessibilityLabel={cEstMoi ? `${total} Kulkoko${total > 1 ? 's' : ''} sur ton commentaire` : envoye ? 'Retirer mon Kulkoko de ce commentaire' : 'Applaudir ce commentaire'}
      disabled={cEstMoi}
      onPress={basculer}
      hitSlop={8}
      style={[styles.kkCommentaire, envoye && styles.kkCommentaireEnvoye]}
    >
      <IconeCulkoko taille={16} couleur={envoye ? '#FFFFFF' : colors.culkoko} plein={envoye} fond={colors.culkoko} />
      {total > 0 ? <Text style={[styles.kkTexte, envoye && { color: '#FFFFFF' }]}>{total}</Text> : null}
    </Pressable>
  );
}
