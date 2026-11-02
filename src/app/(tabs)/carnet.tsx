// Onglet Mon carnet : « Qui suis-je, et qu'ai-je vécu ? »
// Avec un compte, tout vient de la base : profil, lectures en cours, compteurs de l'année, journal.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Carte } from '../../components/Base';
import { IconeReglages } from '../../components/Icones';
import { LectureEnCours } from '../../components/Lecture';
import { emotionParId } from '../../data/emotions';
import { changerVisibilite, compterAnnee, lireJournal, nomPluriel, rangDeLAnnee, supprimerActivite, type EntreeJournal, type Visibilite } from '../../lib/activites';
import { quandJour as quand } from '../../lib/dates';
import { nombreInspires, pensesEnvoyes } from '../../lib/penses';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, fonts, univers, universIds, type UniversId } from '../../theme';

const zero = { livres: 0, cine: 0, concerts: 0, expos: 0 } as Record<UniversId, number>;

export default function Carnet() {
  const { session, profil, seDeconnecter } = useSession();
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [annee, setAnnee] = useState(zero);
  const [abonnes, setAbonnes] = useState(0);
  const [abonnements, setAbonnements] = useState(0);
  const [conseils, setConseils] = useState({ envoyes: 0, justes: 0 });
  const [chargement, setChargement] = useState(true);
  const [probleme, setProbleme] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null); // l'activité dont les options sont affichées
  const moi = session?.user.id;

  const charger = useCallback(async () => {
    if (!moi || !supabase) return;
    try {
      const [j, a, ab1, ab2, pe] = await Promise.all([
        lireJournal(moi),
        compterAnnee(moi),
        supabase.from('abonnements').select('abonne_id', { count: 'exact', head: true }).eq('suivi_id', moi),
        supabase.from('abonnements').select('suivi_id', { count: 'exact', head: true }).eq('abonne_id', moi),
        pensesEnvoyes(moi).catch(() => []),
      ]);
      setConseils({ envoyes: pe.length, justes: nombreInspires(pe) });
      setJournal(j);
      setAnnee(a);
      setAbonnes(ab1.count ?? 0);
      setAbonnements(ab2.count ?? 0);
      setProbleme(false);
    } catch (e) {
      console.warn('Carnet :', e);
      setProbleme(true);
    } finally {
      setChargement(false);
    }
  }, [moi]);

  // On recharge à chaque fois qu'on revient sur l'onglet (après une publication, par exemple).
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  // Un livre « commencé » passe à « fini » en un geste… et on fête ça.
  async function finirLivre(e: EntreeJournal) {
    if (!supabase || !moi) return;
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('activites').update({ etat: 'fini', date_activite: aujourdHui }).eq('id', e.id);
    if (error) return setProbleme(true);
    const compteurs = await compterAnnee(moi).catch(() => null);
    router.push({
      pathname: '/celebration',
      params: { univers: 'livres', titre: e.oeuvre.titre, createur: e.oeuvre.createur ?? '', image: e.oeuvre.image_url ?? '', commence: '0', rang: compteurs ? rangDeLAnnee('livres', compteurs.livres) : '', emotion: e.emotions[0] ?? '' },
    });
  }

  const pseudo = profil?.pseudo ?? '…';
  const enCours = journal.filter((e) => e.etat === 'commence');
  const termines = journal.filter((e) => e.etat === 'fini');
  const mesUnivers = profil?.univers_choisis?.length ? profil.univers_choisis : universIds;
  const total = universIds.reduce((s, u) => s + annee[u], 0);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.profil}>
          <View style={styles.avatar}>
            <Text style={styles.initiale}>{pseudo.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.pseudo}>{pseudo}</Text>
            <Text style={styles.petit}>
              <Text style={styles.chiffre}>{abonnes}</Text> abonné{abonnes > 1 ? 's' : ''} · <Text style={styles.chiffre}>{abonnements}</Text> abonnement{abonnements > 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Réglages (bientôt)" style={styles.reglages}>
            <IconeReglages />
          </Pressable>
        </View>
        {profil?.bio ? <Text style={styles.texte}>{profil.bio}</Text> : null}

        {chargement ? <ActivityIndicator color={colors.culkoko} style={{ marginVertical: 24 }} /> : null}
        {probleme ? <Text style={[styles.petit, { textAlign: 'center' }]}>Impossible de charger ton carnet pour l’instant. Vérifie ta connexion.</Text> : null}

        {enCours.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sousTitre}>En ce moment</Text>
            {enCours.map((e) => {
              const ligne = (
                <View style={styles.entreeSimple}>
                  <Vignette e={e} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.titreEntree} numberOfLines={2}>{e.oeuvre.titre}</Text>
                    {e.oeuvre.createur ? <Text style={styles.petit} numberOfLines={1}>{e.oeuvre.createur}</Text> : null}
                    <Text style={styles.petit}>Commencé {quand(e.date_activite).toLowerCase()}{e.visibilite !== 'public' ? ` · ${libelleVisibilite[e.visibilite]}` : ''}</Text>
                  </View>
                  <BoutonOptions e={e} ouvert={ouvert === e.id} onPress={() => setOuvert(ouvert === e.id ? null : e.id)} />
                </View>
              );
              const options = ouvert === e.id ? <OptionsActivite e={e} onFini={() => { setOuvert(null); charger(); }} /> : null;
              return moi ? (
                <LectureEnCours key={e.id} activiteId={e.id} oeuvreId={e.oeuvre_id} titre={e.oeuvre.titre} moi={moi} entete={ligne} options={options} onFini={() => finirLivre(e)} />
              ) : null;
            })}
          </View>
        )}

        <Carte style={{ padding: 16 }}>
          <Text style={[styles.sousTitre, { marginBottom: 12 }]}>Mon année {new Date().getFullYear()}</Text>
          <View style={styles.compteurs}>
            {universIds
              .filter((u) => mesUnivers.includes(u) || annee[u] > 0)
              .map((u) => (
                <View key={u} style={[styles.compteur, { backgroundColor: univers[u].teinte }]}>
                  <Text style={styles.compteurChiffre}>{annee[u]}</Text>
                  <Text style={styles.compteurNom}>{nomPluriel(u, annee[u])}</Text>
                </View>
              ))}
          </View>
          <Text style={[styles.petit, { marginTop: 12 }]}>
            {total === 0 ? 'Ta première activité de l’année t’attend !' : `${total} moment${total > 1 ? 's' : ''} de culture cette année. Bravo !`}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/enregistrer', params: { mode: 'passe' } })} style={styles.rattrapage}>
            <Text style={styles.rattrapageTitre}>Il manque des livres ou des sorties ?</Text>
            <Text style={styles.petit}>Ajoute ce que tu as vécu depuis janvier, pour un bilan {new Date().getFullYear()} complet.</Text>
          </Pressable>
          {conseils.justes > 0 ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/pour-toi')} style={styles.badge}>
              <Text style={styles.badgeTexte}>
                🎯 {conseils.justes} conseil{conseils.justes > 1 ? 's' : ''} qui {conseils.justes > 1 ? 'ont' : 'a'} touché juste
              </Text>
            </Pressable>
          ) : conseils.envoyes > 0 ? (
            <Text style={styles.petit}>
              {conseils.envoyes} conseil{conseils.envoyes > 1 ? 's' : ''} envoyé{conseils.envoyes > 1 ? 's' : ''} à tes amis
            </Text>
          ) : null}
        </Carte>

        <View style={{ gap: 10 }}>
          <Text style={styles.sousTitre}>Journal</Text>
          {!chargement && termines.length === 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/enregistrer')} style={styles.vide}>
              <Text style={styles.videTitre}>Ton journal t’attend</Text>
              <Text style={[styles.petit, { textAlign: 'center' }]}>Touche le + pour enregistrer ta première lecture ou sortie.</Text>
            </Pressable>
          ) : null}
          {termines.map((e) => {
            const emotionsTexte = e.emotions
              .map((id) => emotionParId(id))
              .filter(Boolean)
              .map((em) => `${em!.emoji} ${em!.label}`)
              .join(' · ');
            const details = [quand(e.date_activite), e.lieu?.nom, e.oeuvre.univers === 'cine' && e.au_cinema === false ? 'à la maison' : null].filter(Boolean).join(' · ');
            return (
              <View key={e.id} style={styles.bloc}>
                <View style={styles.entree}>
                  <Vignette e={e} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.titreEntree} numberOfLines={2}>{e.oeuvre.titre}</Text>
                    <Text style={styles.petit} numberOfLines={1}>{details}</Text>
                    {e.visibilite !== 'public' ? <Text style={styles.masque}>{libelleVisibilite[e.visibilite]}</Text> : null}
                    {emotionsTexte ? <Text style={styles.emotions}>{emotionsTexte}</Text> : null}
                    {e.mots ? <Text style={styles.mots} numberOfLines={3}>« {e.mots} »</Text> : null}
                  </View>
                  <BoutonOptions e={e} ouvert={ouvert === e.id} onPress={() => setOuvert(ouvert === e.id ? null : e.id)} />
                </View>
                {ouvert === e.id && <OptionsActivite e={e} onFini={() => { setOuvert(null); charger(); }} />}
              </View>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" onPress={seDeconnecter} style={styles.deconnexion}>
          <Text style={styles.deconnexionTexte}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const libelleVisibilite: Record<Visibilite, string> = {
  public: 'Visible par tout le monde',
  abonnes: 'Visible par mes abonnés',
  prive: 'Masquée · visible par moi seul·e',
};

function BoutonOptions({ e, ouvert, onPress }: { e: EntreeJournal; ouvert: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`Options pour ${e.oeuvre.titre}`} onPress={onPress} style={styles.options}>
      <Text style={styles.optionsTexte}>⋯</Text>
    </Pressable>
  );
}

// Qui voit cette activité ? Et la supprimer si besoin (avec une confirmation).
function OptionsActivite({ e, onFini }: { e: EntreeJournal; onFini: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState(false);
  async function choisir(v: Visibilite) {
    try {
      await changerVisibilite(e.id, v);
      onFini();
    } catch {
      setErreur(true);
    }
  }
  async function supprimer() {
    try {
      await supprimerActivite(e.id);
      onFini();
    } catch {
      setErreur(true);
    }
  }
  return (
    <View style={styles.panneau}>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/penser', params: { oeuvre: e.oeuvre_id } })} style={[styles.choix, { backgroundColor: colors.culkoko, borderColor: colors.culkoko }]}>
        <Text style={[styles.choixTexte, { color: '#FFFFFF', fontFamily: fonts.texteGras }]}>Conseiller à un ami</Text>
      </Pressable>
      <Text style={styles.label}>Qui peut voir cette activité ?</Text>
      {(['public', 'abonnes', 'prive'] as Visibilite[]).map((v) => {
        const actif = e.visibilite === v;
        return (
          <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: actif }} onPress={() => choisir(v)} style={[styles.choix, actif && styles.choixActif]}>
            <Text style={[styles.choixTexte, actif && { color: '#FFFFFF' }]}>{{ public: 'Tout le monde', abonnes: 'Mes abonnés', prive: 'Moi seul·e (masquée)' }[v]}</Text>
          </Pressable>
        );
      })}
      {confirmer ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={supprimer} style={[styles.choix, { flex: 1, backgroundColor: '#7A1B29', borderColor: '#7A1B29' }]}>
            <Text style={[styles.choixTexte, { color: '#FFFFFF' }]}>Oui, supprimer</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmer(false)} style={[styles.choix, { flex: 1 }]}>
            <Text style={styles.choixTexte}>Annuler</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setConfirmer(true)} style={styles.lienSupprimer}>
          <Text style={styles.lienSupprimerTexte}>Supprimer cette activité</Text>
        </Pressable>
      )}
      {erreur ? <Text style={styles.petit}>Oups, ça n’a pas marché. Réessaie dans un instant.</Text> : null}
    </View>
  );
}

function Vignette({ e }: { e: EntreeJournal }) {
  const style = { width: 44, height: 60, borderRadius: 8, backgroundColor: univers[e.oeuvre.univers].couleur };
  return e.oeuvre.image_url ? <Image source={{ uri: e.oeuvre.image_url }} style={style} /> : <View style={style} />;
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, gap: 18 },
  profil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: univers.cine.teinte, alignItems: 'center', justifyContent: 'center' },
  initiale: { fontFamily: fonts.titreGras, fontSize: 28, color: colors.culkoko },
  pseudo: { fontFamily: fonts.titre, fontSize: 22, color: colors.encre },
  reglages: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  chiffre: { fontFamily: fonts.texteGras, color: colors.encre },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre },
  compteurs: { flexDirection: 'row', gap: 8 },
  compteur: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  compteurChiffre: { fontFamily: fonts.titreGras, fontSize: 22, color: colors.encre },
  compteurNom: { fontFamily: fonts.texte, fontSize: 12, color: colors.encre },
  entreeSimple: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entree: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.carte, borderRadius: 14, padding: 10 },
  titreEntree: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  emotions: { fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  mots: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris, fontStyle: 'italic' },
  boutonFini: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonFiniTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
  vide: { backgroundColor: colors.carte, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.bordure },
  videTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre },
  bloc: { gap: 6 },
  rattrapage: { marginTop: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.bordure, padding: 12, gap: 2 },
  rattrapageTitre: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  badge: { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: univers.concerts.teinte },
  badgeTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: univers.concerts.texteFonce },
  options: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionsTexte: { fontFamily: fonts.texteGras, fontSize: 22, lineHeight: 24, color: colors.gris },
  masque: { fontFamily: fonts.texteMoyen, fontSize: 12, color: colors.culkoko },
  panneau: { backgroundColor: colors.carte, borderRadius: 14, padding: 12, gap: 8 },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  choix: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.bordure, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  choixActif: { backgroundColor: colors.encre, borderColor: colors.encre },
  choixTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  lienSupprimer: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lienSupprimerTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#7A1B29' },
  deconnexion: { height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.bordure, alignItems: 'center', justifyContent: 'center' },
  deconnexionTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.gris },
});
