// Mon profil et mes réglages : photo, pseudo, bio, qui voit mes activités, commentaires,
// personnes bloquées, déconnexion et suppression du compte.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../components/EnTete';
import { Avatar, BoutonPrincipal } from '../components/Base';
import { BoutonOeil, MessageErreur, MessageInfo } from '../components/Formulaire';
import type { Visibilite } from '../lib/activites';
import { estModerateur } from '../lib/moderation';
import { choisirPhoto, debloquer, envoyerPhoto, mesBlocages, mettreAJourProfil, photoPossible, problemePseudo, REGLE_PSEUDO, supprimerMonCompte, type PersonneBloquee } from '../lib/profil';
import { traduireErreur, useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';

const visibilites: { id: Visibilite; texte: string; aide: string }[] = [
  { id: 'public', texte: 'Tout le monde', aide: 'Tes activités apparaissent aussi dans Découvrir.' },
  { id: 'abonnes', texte: 'Mes abonnés', aide: 'Seules les personnes qui te suivent les voient.' },
  { id: 'prive', texte: 'Moi seul·e', aide: 'Ton journal reste privé.' },
];

const avecMajuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function Reglages() {
  const { session, profil, rechargerProfil, seDeconnecter } = useSession();
  const moi = session?.user.id ?? '';
  const [pseudo, setPseudo] = useState(profil?.pseudo ?? '');
  const [bio, setBio] = useState(profil?.bio ?? '');
  const [visibilite, setVisibilite] = useState<Visibilite>(profil?.visibilite_defaut ?? 'public');
  const [reserves, setReserves] = useState(!!profil?.commentaires_reserves_abonnes);
  const [mesUnivers, setMesUnivers] = useState<UniversId[]>(profil?.univers_choisis?.length ? profil.univers_choisis : [...universIds]);
  const [bloques, setBloques] = useState<PersonneBloquee[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [mdpVisible, setMdpVisible] = useState(false);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [supprimer, setSupprimer] = useState<'non' | 'confirmer' | 'en-cours'>('non');
  // Les choix (univers, visibilité, commentaires) s'enregistrent d'un toucher, avec un petit « Enregistré ✓ ».
  const [enregistre, setEnregistre] = useState<'univers' | 'visibilite' | 'reserves' | null>(null);
  const [erreurReglage, setErreurReglage] = useState<string | null>(null);
  const minuteurEnregistre = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Changer mon mot de passe
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmationMdp, setConfirmationMdp] = useState('');
  const [mdpEnCours, setMdpEnCours] = useState(false);
  const [mdpErreur, setMdpErreur] = useState<string | null>(null);
  const [mdpInfo, setMdpInfo] = useState<string | null>(null);

  // L'équipe de modération voit une entrée de plus (la base vérifie de son côté).
  const [moderatrice, setModeratrice] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (moi) mesBlocages(moi).then(setBloques, () => setBloques([]));
      estModerateur().then(setModeratrice, () => setModeratrice(false));
    }, [moi]),
  );

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/carnet');
  }

  const pseudoPropre = avecMajuscule(pseudo.trim());
  // Un pseudo d'avant les règles actuelles reste permis tant qu'on n'y touche pas.
  const problemeDuPseudo = pseudoPropre === profil?.pseudo ? null : problemePseudo(pseudoPropre);
  const pseudoValide = !problemeDuPseudo;
  const modifie = pseudoPropre !== profil?.pseudo || (bio.trim() || null) !== (profil?.bio ?? null);

  // Enregistrement immédiat d'un réglage ; en cas d'échec, on remet comme avant et on le dit.
  async function sauverReglage(quoi: 'univers' | 'visibilite' | 'reserves', champs: Record<string, unknown>, annuler: () => void) {
    if (!moi) return;
    setErreurReglage(null);
    try {
      await mettreAJourProfil(moi, champs);
      await rechargerProfil();
      setEnregistre(quoi);
      if (minuteurEnregistre.current) clearTimeout(minuteurEnregistre.current);
      minuteurEnregistre.current = setTimeout(() => setEnregistre(null), 2000);
    } catch {
      annuler();
      setErreurReglage('Oups, ce réglage n’a pas été enregistré. Réessaie dans un instant.');
    }
  }

  function choisirUnivers(u: UniversId) {
    const actif = mesUnivers.includes(u);
    if (actif && mesUnivers.length === 1) return; // au moins un univers
    const avant = mesUnivers;
    const apres = actif ? mesUnivers.filter((x) => x !== u) : universIds.filter((x) => x === u || mesUnivers.includes(x));
    setMesUnivers(apres);
    sauverReglage('univers', { univers_choisis: apres }, () => setMesUnivers(avant));
  }

  function choisirVisibilite(v: Visibilite) {
    if (v === visibilite) return;
    const avant = visibilite;
    setVisibilite(v);
    sauverReglage('visibilite', { visibilite_defaut: v }, () => setVisibilite(avant));
  }

  function basculerReserves() {
    const avant = reserves;
    setReserves(!avant);
    sauverReglage('reserves', { commentaires_reserves_abonnes: !avant }, () => setReserves(avant));
  }

  const mdpValide = nouveauMdp.length >= 8 && nouveauMdp === confirmationMdp;
  async function changerMotDePasse() {
    if (!supabase || !mdpValide || mdpEnCours) return;
    setMdpEnCours(true);
    setMdpErreur(null);
    setMdpInfo(null);
    const { error } = await supabase.auth.updateUser({ password: nouveauMdp });
    setMdpEnCours(false);
    if (error) return setMdpErreur(traduireErreur(error.message));
    setNouveauMdp('');
    setConfirmationMdp('');
    setMdpInfo('C’est fait : ton nouveau mot de passe est enregistré.');
  }

  async function enregistrer() {
    if (!moi || !pseudoValide || enCours) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await mettreAJourProfil(moi, {
        pseudo: pseudoPropre,
        bio: bio.trim() || null,
      });
      await rechargerProfil();
      setInfo('C’est enregistré !');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setErreur(err.code === '23505' ? 'Ce pseudo est déjà pris. Essaie une variante !' : traduireErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function changerPhoto() {
    setErreur(null);
    const photo = await choisirPhoto();
    if (!photo) return;
    setPhotoEnCours(true);
    try {
      await envoyerPhoto(moi, photo);
      await rechargerProfil();
    } catch (e) {
      setErreur('La photo n’a pas pu être enregistrée. Réessaie dans un instant.');
    } finally {
      setPhotoEnCours(false);
    }
  }

  async function retirerPhoto() {
    try {
      await mettreAJourProfil(moi, { photo_url: null });
      await rechargerProfil();
    } catch {
      setErreur('La photo n’a pas pu être retirée.');
    }
  }

  async function confirmerSuppression() {
    setSupprimer('en-cours');
    try {
      await supprimerMonCompte();
    } catch (e) {
      setSupprimer('confirmer');
      setErreur(traduireErreur(e));
    }
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <EnTetePage titre="Mon profil et mes réglages" onRetour={retour} />

        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          {/* La photo */}
          <View style={styles.photoBloc}>
            <Avatar initiale={(profil?.pseudo ?? '?').charAt(0).toUpperCase()} fond={univers.cine.teinte} taille={96} photo={profil?.photo_url} />
            {photoPossible ? (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable accessibilityRole="button" onPress={changerPhoto} disabled={photoEnCours} style={styles.lien}>
                  <Text style={styles.lienTexte}>{photoEnCours ? 'Envoi…' : profil?.photo_url ? 'Changer la photo' : 'Ajouter une photo'}</Text>
                </Pressable>
                {profil?.photo_url ? (
                  <Pressable accessibilityRole="button" onPress={retirerPhoto} style={styles.lien}>
                    <Text style={[styles.lienTexte, { color: colors.gris }]}>Retirer</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.petit}>La photo s’ajoute pour l’instant depuis la version web.</Text>
            )}
          </View>

          {/* Pseudo et bio */}
          <View style={styles.bloc}>
            <Text nativeID="label-pseudo" style={styles.label}>Mon pseudo</Text>
            <TextInput aria-label="Mon pseudo" accessibilityLabelledBy="label-pseudo" value={pseudo} onChangeText={(t) => setPseudo(avecMajuscule(t))} maxLength={30} autoCorrect={false} style={styles.champ} />
            {problemeDuPseudo && pseudo.trim() ? <Text style={styles.alerte}>{problemeDuPseudo === REGLE_PSEUDO ? REGLE_PSEUDO : problemeDuPseudo}</Text> : null}
            <Text nativeID="label-bio" style={[styles.label, { marginTop: 8 }]}>Ma bio <Text style={styles.petit}>(facultatif)</Text></Text>
            <TextInput
              aria-label="Ma bio"
              accessibilityLabelledBy="label-bio"
              value={bio}
              onChangeText={setBio}
              maxLength={200}
              multiline
              placeholder="Romans russes, ciné coréen et concerts au Bikini."
              placeholderTextColor={colors.gris}
              style={[styles.champ, { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }]}
            />
            <Text style={styles.petit}>{bio.length}/200</Text>
            <MessageErreur texte={erreur} />
            <MessageInfo texte={info} />
            <BoutonPrincipal label={enCours ? 'Un instant…' : 'Enregistrer mon pseudo et ma bio'} onPress={enregistrer} desactive={!modifie || !pseudoValide || enCours} />
          </View>

          {/* Mes univers */}
          <View style={styles.bloc}>
            <View style={styles.ligneLabel}>
              <Text style={styles.label}>Mes univers</Text>
              {enregistre === 'univers' ? <Text style={styles.enregistre}>Enregistré ✓</Text> : null}
            </View>
            <Text style={styles.petit}>Ils passent en premier quand tu enregistres, et dans tes compteurs.</Text>
            <View style={styles.univers}>
              {universIds.map((u) => {
                const actif = mesUnivers.includes(u);
                return (
                  <Pressable
                    key={u}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: actif }}
                    onPress={() => choisirUnivers(u)}
                    style={[styles.pastille, { backgroundColor: actif ? univers[u].teinte : colors.fond, borderColor: actif ? colors.culkoko : colors.bordure }]}
                  >
                    <Text style={styles.choixTexte}>{actif ? '✓ ' : ''}{univers[u].label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Confidentialité */}
          <View style={styles.bloc}>
            <View style={styles.ligneLabel}>
              <Text style={[styles.label, { flex: 1 }]}>Qui voit mes nouvelles activités ?</Text>
              {enregistre === 'visibilite' || enregistre === 'reserves' ? <Text style={styles.enregistre}>Enregistré ✓</Text> : null}
            </View>
            <Text style={styles.petit}>Le réglage par défaut. Tu peux toujours le changer activité par activité.</Text>
            {visibilites.map((v) => {
              const actif = visibilite === v.id;
              return (
                <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ checked: actif }} onPress={() => choisirVisibilite(v.id)} style={[styles.choix, actif && styles.choixActif]}>
                  <View style={[styles.rond, actif && styles.rondActif]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choixTexte}>{v.texte}</Text>
                    <Text style={styles.petit}>{v.aide}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: reserves }} onPress={basculerReserves} style={[styles.choix, { marginTop: 6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.choixTexte}>Seuls mes abonnés peuvent commenter</Text>
                <Text style={styles.petit}>Sinon, toute personne qui voit ton activité peut commenter.</Text>
              </View>
              <View style={[styles.interrupteur, reserves && styles.interrupteurActif]}>
                <View style={[styles.bouton, reserves && { alignSelf: 'flex-end' }]} />
              </View>
            </Pressable>
          </View>

          <MessageErreur texte={erreurReglage} />

          {/* Personnes bloquées */}
          <View style={styles.bloc}>
            <Text style={styles.label}>Personnes bloquées</Text>
            {bloques.length === 0 ? (
              <Text style={styles.petit}>Aucune personne bloquée. Pour bloquer quelqu’un, ouvre son profil et touche ⋯.</Text>
            ) : (
              bloques.map((b) => (
                <View key={b.id} style={styles.ligneBloquee}>
                  <Text style={[styles.choixTexte, { flex: 1 }]}>{b.pseudo}</Text>
                  <Pressable accessibilityRole="button" onPress={() => debloquer(moi, b.id).then(() => setBloques((l) => l.filter((x) => x.id !== b.id)))} style={styles.lien}>
                    <Text style={styles.lienTexte}>Débloquer</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* Modération : seulement pour l'équipe */}
          {moderatrice ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/moderation')} style={styles.bloc}>
              <Text style={styles.label}>Modération ›</Text>
              <Text style={styles.petit}>Les signalements à regarder</Text>
            </Pressable>
          ) : null}

          {/* Compte */}
          <Pressable accessibilityRole="link" onPress={() => router.push('/a-propos')} style={styles.bloc}>
            <Text style={styles.label}>À propos de Kulky ›</Text>
            <Text style={styles.petit}>Version, crédits, vie privée, nous écrire</Text>
          </Pressable>
          <View style={styles.bloc}>
            <Text style={styles.label}>Mon compte</Text>
            <Text style={styles.petit}>{session?.user.email}</Text>
            <Text style={[styles.label, { marginTop: 8, fontSize: 14 }]}>Changer mon mot de passe</Text>
            <View>
              <TextInput
                aria-label="Nouveau mot de passe"
                value={nouveauMdp}
                onChangeText={setNouveauMdp}
                placeholder="Nouveau mot de passe (8 caractères minimum)"
                placeholderTextColor={colors.gris}
                secureTextEntry={!mdpVisible}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                style={[styles.champ, { paddingRight: 52 }]}
              />
              <BoutonOeil visible={mdpVisible} onPress={() => setMdpVisible((v) => !v)} />
            </View>
            <View>
              <TextInput
                aria-label="Confirme le nouveau mot de passe"
                value={confirmationMdp}
                onChangeText={setConfirmationMdp}
                placeholder="Le même, une seconde fois"
                placeholderTextColor={colors.gris}
                secureTextEntry={!mdpVisible}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={changerMotDePasse}
                style={[styles.champ, { paddingRight: 52 }]}
              />
              <BoutonOeil visible={mdpVisible} onPress={() => setMdpVisible((v) => !v)} />
            </View>
            {nouveauMdp.length > 0 && nouveauMdp.length < 8 ? <Text style={styles.alerte}>Au moins 8 caractères.</Text> : null}
            {confirmationMdp.length > 0 && nouveauMdp !== confirmationMdp ? <Text style={styles.alerte}>Les deux mots de passe ne sont pas identiques.</Text> : null}
            <MessageErreur texte={mdpErreur} />
            <MessageInfo texte={mdpInfo} />
            <Pressable accessibilityRole="button" disabled={!mdpValide || mdpEnCours} onPress={changerMotDePasse} style={[styles.secondaire, (!mdpValide || mdpEnCours) && { opacity: 0.5 }]}>
              <Text style={styles.secondaireTexte}>{mdpEnCours ? 'Un instant…' : 'Changer mon mot de passe'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={seDeconnecter} style={styles.secondaire}>
              <Text style={styles.secondaireTexte}>Me déconnecter</Text>
            </Pressable>
            {supprimer === 'non' ? (
              <Pressable accessibilityRole="button" onPress={() => setSupprimer('confirmer')} style={styles.lien}>
                <Text style={[styles.lienTexte, { color: '#9B2335' }]}>Supprimer mon compte</Text>
              </Pressable>
            ) : (
              <View style={styles.danger}>
                <Text style={styles.choixTexte}>Supprimer mon compte pour de bon ?</Text>
                <Text style={styles.petit}>Ton journal, tes envies, tes conseils et tes commentaires seront effacés. C’est définitif.</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Pressable accessibilityRole="button" onPress={confirmerSuppression} disabled={supprimer === 'en-cours'} style={styles.lien}>
                    <Text style={[styles.lienTexte, { color: '#9B2335' }]}>{supprimer === 'en-cours' ? 'Suppression…' : 'Oui, tout supprimer'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setSupprimer('non')} style={styles.lien}>
                    <Text style={[styles.lienTexte, { color: colors.gris }]}>Annuler</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ligneLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  enregistre: { fontFamily: fonts.texteGras, fontSize: 13, color: '#1D6E54' },
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
  contenu: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  photoBloc: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  bloc: { backgroundColor: colors.carte, borderRadius: 18, padding: 16, gap: 8 },
  label: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris },
  alerte: { fontFamily: fonts.texte, fontSize: 13, color: '#9B2335' },
  champ: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.fond, paddingHorizontal: 14, fontFamily: fonts.texte, fontSize: 15, color: colors.encre },
  choix: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: colors.bordure, paddingHorizontal: 12, paddingVertical: 8 },
  choixActif: { borderColor: colors.culkoko, borderWidth: 1.5 },
  rond: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.bordure },
  rondActif: { borderColor: colors.culkoko, borderWidth: 6 },
  choixTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  interrupteur: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.bordure, padding: 3, justifyContent: 'center' },
  interrupteurActif: { backgroundColor: colors.culkoko },
  bouton: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  univers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pastille: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  ligneBloquee: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  lien: { minHeight: 44, justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  secondaire: { height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaireTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  danger: { backgroundColor: '#FDE6E0', borderRadius: 14, padding: 12, gap: 4 },
});
