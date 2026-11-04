// Mon profil et mes réglages : photo, pseudo, bio, qui voit mes activités, commentaires,
// personnes bloquées, déconnexion et suppression du compte.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../components/EnTete';
import { Avatar, BoutonPrincipal } from '../components/Base';
import { MessageErreur, MessageInfo } from '../components/Formulaire';
import type { Visibilite } from '../lib/activites';
import { choisirPhoto, debloquer, envoyerPhoto, mesBlocages, mettreAJourProfil, photoPossible, supprimerMonCompte, type PersonneBloquee } from '../lib/profil';
import { traduireErreur, useSession } from '../lib/session';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';

const visibilites: { id: Visibilite; texte: string; aide: string }[] = [
  { id: 'public', texte: 'Tout le monde', aide: 'Tes activités apparaissent aussi dans Découvrir.' },
  { id: 'abonnes', texte: 'Mes abonnés', aide: 'Seules les personnes qui te suivent les voient.' },
  { id: 'prive', texte: 'Moi seul·e', aide: 'Ton carnet reste privé.' },
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
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [supprimer, setSupprimer] = useState<'non' | 'confirmer' | 'en-cours'>('non');

  useFocusEffect(
    useCallback(() => {
      if (moi) mesBlocages(moi).then(setBloques, () => setBloques([]));
    }, [moi]),
  );

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/carnet');
  }

  const pseudoPropre = avecMajuscule(pseudo.trim());
  const pseudoValide = /^[\p{L}\p{N}._-]{2,30}$/u.test(pseudoPropre);
  const modifie =
    pseudoPropre !== profil?.pseudo ||
    (bio.trim() || null) !== (profil?.bio ?? null) ||
    visibilite !== (profil?.visibilite_defaut ?? 'public') ||
    reserves !== !!profil?.commentaires_reserves_abonnes ||
    mesUnivers.join() !== (profil?.univers_choisis ?? []).join();

  async function enregistrer() {
    if (!moi || !pseudoValide || enCours) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await mettreAJourProfil(moi, {
        pseudo: pseudoPropre,
        bio: bio.trim() || null,
        visibilite_defaut: visibilite,
        commentaires_reserves_abonnes: reserves,
        univers_choisis: mesUnivers,
      });
      await rechargerProfil();
      setInfo('C’est enregistré !');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setErreur(err.code === '23505' ? 'Ce pseudo est déjà pris. Essaie une variante !' : traduireErreur(err.message ?? String(e)));
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
      setErreur(`La photo n’a pas pu être enregistrée. ${traduireErreur((e as { message?: string })?.message ?? String(e))}`);
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
      setErreur(traduireErreur((e as { message?: string })?.message ?? String(e)));
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
            {!pseudoValide && pseudo.trim() ? <Text style={styles.alerte}>Lettres, chiffres, point, tiret ou tiret bas, sans espace (2 à 30 caractères).</Text> : null}
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
          </View>

          {/* Mes univers */}
          <View style={styles.bloc}>
            <Text style={styles.label}>Mes univers</Text>
            <Text style={styles.petit}>Ils passent en premier quand tu enregistres, et dans tes compteurs.</Text>
            <View style={styles.univers}>
              {universIds.map((u) => {
                const actif = mesUnivers.includes(u);
                return (
                  <Pressable
                    key={u}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: actif }}
                    onPress={() => setMesUnivers(actif ? (mesUnivers.length > 1 ? mesUnivers.filter((x) => x !== u) : mesUnivers) : universIds.filter((x) => x === u || mesUnivers.includes(x)))}
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
            <Text style={styles.label}>Qui voit mes nouvelles activités ?</Text>
            <Text style={styles.petit}>Le réglage par défaut. Tu peux toujours le changer activité par activité.</Text>
            {visibilites.map((v) => {
              const actif = visibilite === v.id;
              return (
                <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ checked: actif }} onPress={() => setVisibilite(v.id)} style={[styles.choix, actif && styles.choixActif]}>
                  <View style={[styles.rond, actif && styles.rondActif]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choixTexte}>{v.texte}</Text>
                    <Text style={styles.petit}>{v.aide}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: reserves }} onPress={() => setReserves(!reserves)} style={[styles.choix, { marginTop: 6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.choixTexte}>Seuls mes abonnés peuvent commenter</Text>
                <Text style={styles.petit}>Sinon, toute personne qui voit ton activité peut commenter.</Text>
              </View>
              <View style={[styles.interrupteur, reserves && styles.interrupteurActif]}>
                <View style={[styles.bouton, reserves && { alignSelf: 'flex-end' }]} />
              </View>
            </Pressable>
          </View>

          <MessageErreur texte={erreur} />
          <MessageInfo texte={info} />
          <BoutonPrincipal label={enCours ? 'Un instant…' : 'Enregistrer'} onPress={enregistrer} desactive={!modifie || !pseudoValide || enCours} />

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

          {/* Compte */}
          <Pressable accessibilityRole="link" onPress={() => router.push('/a-propos')} style={styles.bloc}>
            <Text style={styles.label}>À propos de Kulky ›</Text>
            <Text style={styles.petit}>Version, crédits des données</Text>
          </Pressable>
          <View style={styles.bloc}>
            <Text style={styles.label}>Mon compte</Text>
            <Text style={styles.petit}>{session?.user.email}</Text>
            <Pressable accessibilityRole="button" onPress={seDeconnecter} style={styles.secondaire}>
              <Text style={styles.secondaireTexte}>Se déconnecter</Text>
            </Pressable>
            {supprimer === 'non' ? (
              <Pressable accessibilityRole="button" onPress={() => setSupprimer('confirmer')} style={styles.lien}>
                <Text style={[styles.lienTexte, { color: '#9B2335' }]}>Supprimer mon compte</Text>
              </Pressable>
            ) : (
              <View style={styles.danger}>
                <Text style={styles.choixTexte}>Supprimer mon compte pour de bon ?</Text>
                <Text style={styles.petit}>Ton carnet, tes envies, tes conseils et tes commentaires seront effacés. C’est définitif.</Text>
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
