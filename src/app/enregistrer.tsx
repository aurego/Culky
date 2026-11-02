// Écran « Nouvelle activité » : le cœur de l'appli, une activité publiée en 30 secondes.
// Trois temps : l'univers → l'œuvre → ce que tu as vécu (émotions, lieu, quelques mots), puis on fête ça.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { MessageErreur } from '../components/Formulaire';
import { IconeFermer, IconeMonde } from '../components/Icones';
import { emotions, emotionsFavorites } from '../data/emotions';
import { compterAnnee, publierActivite, rangDeLAnnee, type Visibilite } from '../lib/activites';
import { ajouterEnvie, retirerEnvie } from '../lib/envies';
import { enregistrerOeuvre, lireOeuvre, rechercherLivres, trouverOuCreerLieu, type OeuvreTrouvee } from '../lib/oeuvres';
import { traduireErreur, useSession } from '../lib/session';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';

const MAX_EMOTIONS = 3;

const libelles: Record<UniversId, { question: string; createur: string; lieu: string; exempleTitre: string; exempleCreateur: string; exempleLieu: string }> = {
  livres: { question: 'Quel livre ?', createur: 'Auteur ou autrice', lieu: '', exempleTitre: 'Le Comte de Monte-Cristo', exempleCreateur: 'Alexandre Dumas', exempleLieu: '' },
  cine: { question: 'Quel film ?', createur: 'Réalisateur ou réalisatrice (facultatif)', lieu: 'Quel cinéma ? (facultatif)', exempleTitre: 'Le titre du film', exempleCreateur: '', exempleLieu: 'Cinéma ABC' },
  concerts: { question: 'Quel concert ?', createur: 'Artiste ou groupe', lieu: 'Quelle salle ? (facultatif)', exempleTitre: 'Le nom de la tournée ou de l’artiste', exempleCreateur: '', exempleLieu: 'Le Bikini' },
  expos: { question: 'Quelle expo ?', createur: 'Artiste (facultatif)', lieu: 'Quel lieu ? (facultatif)', exempleTitre: 'Le titre de l’expo', exempleCreateur: '', exempleLieu: 'Les Abattoirs' },
};

const visibilites: { id: Visibilite; texte: string }[] = [
  { id: 'public', texte: 'Visible par tout le monde' },
  { id: 'abonnes', texte: 'Visible par mes abonnés' },
  { id: 'prive', texte: 'Visible par moi seul·e' },
];

// « jj/mm/aaaa » → « aaaa-mm-jj » (ou null si la date n'est pas valide).
function lireDate(texte: string): string | null {
  const m = texte.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
  const d = new Date(`${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export default function Enregistrer() {
  const { session, profil } = useSession();
  // mode « envie » : on ajoute à ses envies au lieu d'enregistrer une activité.
  // oeuvre : on vient d'une envie (« J'y étais ») et l'œuvre est déjà connue.
  const params = useLocalSearchParams<{ mode?: string; oeuvre?: string }>();
  const modeEnvie = params.mode === 'envie';
  const [etape, setEtape] = useState<'univers' | 'oeuvre' | 'details'>('univers');
  const [dateEnvie, setDateEnvie] = useState('');
  const [choix, setChoix] = useState<UniversId>('livres');
  const [oeuvre, setOeuvre] = useState<OeuvreTrouvee | null>(null);

  // Détails de l'activité
  const [etat, setEtat] = useState<'commence' | 'fini'>('fini');
  const [auCinema, setAuCinema] = useState(true);
  const [lieu, setLieu] = useState('');
  const [choisies, setChoisies] = useState<string[]>([]);
  const [toutes, setToutes] = useState(false);
  const [mots, setMots] = useState('');
  const [visibilite, setVisibilite] = useState<Visibilite>('public');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les univers choisis à l'inscription passent en premier.
  const mesUnivers = profil?.univers_choisis?.length ? profil.univers_choisis : universIds;
  const ordre = [...mesUnivers, ...universIds.filter((u) => !mesUnivers.includes(u))];

  // Depuis une envie : on saute directement à « Ce que tu as vécu ».
  useEffect(() => {
    if (!params.oeuvre) return;
    lireOeuvre(params.oeuvre).then((o) => {
      if (!o) return;
      setChoix(o.univers);
      setOeuvre(o);
      setEtape('details');
    });
  }, [params.oeuvre]);

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function retour() {
    setErreur(null);
    if (etape === 'details') setEtape('oeuvre');
    else if (etape === 'oeuvre') setEtape('univers');
    else fermer();
  }

  function choisirUnivers(u: UniversId) {
    setChoix(u);
    setOeuvre(null);
    setEtape('oeuvre');
  }

  function choisirOeuvre(o: OeuvreTrouvee) {
    setOeuvre(o);
    setEtape('details');
  }

  function basculer(id: string) {
    if (choisies.includes(id)) setChoisies(choisies.filter((x) => x !== id));
    else if (choisies.length < MAX_EMOTIONS) setChoisies([...choisies, id]);
  }

  // Un livre qu'on commence n'a pas encore besoin d'émotion.
  const emotionsObligatoires = !(choix === 'livres' && etat === 'commence');
  const pretAPublier = !!oeuvre && (!emotionsObligatoires || choisies.length > 0);

  async function publier() {
    if (!session || !oeuvre || !pretAPublier || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const oeuvreId = await enregistrerOeuvre(oeuvre, session.user.id);
      const avecLieu = choix !== 'livres' && !(choix === 'cine' && !auCinema);
      const lieuId = avecLieu ? await trouverOuCreerLieu(lieu) : null;
      await publierActivite({
        auteurId: session.user.id,
        oeuvreId,
        lieuId,
        etat: choix === 'livres' ? etat : 'fini',
        auCinema: choix === 'cine' ? auCinema : null,
        emotions: choisies,
        mots,
        visibilite,
      });
      // Une envie vécue quitte la liste des envies : c'est fait, bravo !
      await retirerEnvie(session.user.id, oeuvreId).catch(() => undefined);
      const compteurs = await compterAnnee(session.user.id).catch(() => null);
      const commence = choix === 'livres' && etat === 'commence';
      router.replace({
        pathname: '/celebration',
        params: {
          univers: choix,
          titre: oeuvre.titre,
          commence: commence ? '1' : '0',
          rang: !commence && compteurs ? rangDeLAnnee(choix, compteurs[choix]) : '',
          emotion: choisies[0] ?? '',
        },
      });
    } catch (e) {
      setEnCours(false);
      setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
    }
  }

  const dateTexteValide = dateEnvie.trim() === '' || lireDate(dateEnvie) !== null;

  async function ajouterAuxEnvies() {
    if (!session || !oeuvre || enCours || !dateTexteValide) return;
    setEnCours(true);
    setErreur(null);
    try {
      const avecDate = choix === 'expos' || choix === 'concerts';
      const oeuvreId = await enregistrerOeuvre({ ...oeuvre, date_fin: avecDate ? lireDate(dateEnvie) : null }, session.user.id);
      await ajouterEnvie(session.user.id, oeuvreId);
      router.replace('/envies');
    } catch (e) {
      setEnCours(false);
      setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
    }
  }

  const titres = modeEnvie
    ? { univers: 'Nouvelle envie', oeuvre: libelles[choix].question, details: 'Ton envie' }
    : { univers: 'Nouvelle activité', oeuvre: libelles[choix].question, details: 'Ce que tu as vécu' };

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel={etape === 'univers' ? 'Fermer' : 'Retour'} onPress={retour} style={styles.rond44}>
            {etape === 'univers' ? <IconeFermer /> : <Text style={styles.fleche}>‹</Text>}
          </Pressable>
          <Text accessibilityRole="header" style={styles.titre}>{titres[etape]}</Text>
          <View style={{ width: 44 }} />
        </View>

        {etape === 'univers' && (
          <ScrollView contentContainerStyle={styles.contenu}>
            <Text style={styles.question}>{modeEnvie ? 'Qu’est-ce qui te tente ?' : 'Qu’est-ce que tu viens de vivre ?'}</Text>
            <View style={styles.grille}>
              {ordre.map((u) => (
                <Pressable key={u} accessibilityRole="button" onPress={() => choisirUnivers(u)} style={[styles.carteUnivers, { backgroundColor: univers[u].teinte }]}>
                  <View style={[styles.pointUnivers, { backgroundColor: univers[u].couleur }]} />
                  <Text style={styles.nomUnivers}>{{ livres: 'Un livre', cine: 'Un film', concerts: 'Un concert', expos: 'Une expo' }[u]}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {etape === 'oeuvre' && (choix === 'livres' ? <RechercheLivre onChoix={choisirOeuvre} /> : <SaisieOeuvre univers={choix} onChoix={choisirOeuvre} />)}

        {etape === 'details' && oeuvre && modeEnvie && (
          <>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              <CarteOeuvre oeuvre={oeuvre} onChanger={() => setEtape('oeuvre')} />
              {(choix === 'expos' || choix === 'concerts') && (
                <>
                  <ChampSimple
                    label={choix === 'expos' ? 'Jusqu’à quand ? (facultatif)' : 'Quand ? (facultatif)'}
                    valeur={dateEnvie}
                    onChange={setDateEnvie}
                    exemple="jj/mm/aaaa"
                  />
                  <Text style={styles.petit}>
                    {dateTexteValide ? 'Culky te le rappellera avant qu’il ne soit trop tard.' : 'Écris la date sous la forme jj/mm/aaaa, par exemple 15/12/2026.'}
                  </Text>
                </>
              )}
              <MessageErreur texte={erreur} />
            </ScrollView>
            <View style={styles.pied}>
              <BoutonPrincipal label={enCours ? 'Un instant…' : 'Ajouter à mes envies'} desactive={enCours || !dateTexteValide} onPress={ajouterAuxEnvies} />
            </View>
          </>
        )}

        {etape === 'details' && oeuvre && !modeEnvie && (
          <>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              <CarteOeuvre oeuvre={oeuvre} onChanger={() => setEtape('oeuvre')} />

              {choix === 'livres' && (
                <Segment
                  label="Où en es-tu ?"
                  options={[{ id: 'fini', texte: 'Je l’ai fini' }, { id: 'commence', texte: 'Je le commence' }]}
                  valeur={etat}
                  onChange={(v) => setEtat(v as 'commence' | 'fini')}
                />
              )}
              {choix === 'cine' && (
                <Segment
                  label="Où l’as-tu vu ?"
                  options={[{ id: 'cinema', texte: 'Au cinéma' }, { id: 'maison', texte: 'À la maison' }]}
                  valeur={auCinema ? 'cinema' : 'maison'}
                  onChange={(v) => setAuCinema(v === 'cinema')}
                />
              )}

              <View>
                <Text style={styles.section}>{emotionsObligatoires ? 'Qu’as-tu ressenti ?' : 'Une première impression ? (facultatif)'}</Text>
                <Text style={[styles.petit, { marginBottom: 10 }]}>
                  Jusqu’à {MAX_EMOTIONS} émotions · {choisies.length}/{MAX_EMOTIONS}
                </Text>
                <View style={styles.emotions}>
                  {(toutes ? emotions : emotions.filter((e) => emotionsFavorites.includes(e.id) || choisies.includes(e.id))).map((e) => {
                    const actif = choisies.includes(e.id);
                    return (
                      <Pressable key={e.id} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => basculer(e.id)} style={[styles.emotion, actif ? styles.emotionActive : styles.emotionInactive]}>
                        <Text style={[styles.emotionTexte, { color: actif ? '#FFFFFF' : colors.encre }]}>
                          {e.emoji} {e.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable accessibilityRole="button" onPress={() => setToutes(!toutes)} style={styles.lien}>
                  <Text style={styles.lienTexte}>{toutes ? 'Moins d’émotions' : 'Toutes les émotions'}</Text>
                </Pressable>
              </View>

              {choix !== 'livres' && !(choix === 'cine' && !auCinema) && (
                <ChampSimple label={libelles[choix].lieu} valeur={lieu} onChange={setLieu} exemple={libelles[choix].exempleLieu} />
              )}
              <ChampSimple label="Quelques mots (facultatif)" valeur={mots} onChange={setMots} exemple="Ce que tu en retiens…" multiligne />

              <MessageErreur texte={erreur} />
            </ScrollView>

            <View style={styles.pied}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Changer la visibilité"
                onPress={() => setVisibilite(visibilites[(visibilites.findIndex((v) => v.id === visibilite) + 1) % visibilites.length].id)}
                style={styles.visibilite}
              >
                <IconeMonde />
                <Text style={styles.petit}>
                  {visibilites.find((v) => v.id === visibilite)!.texte} · <Text style={{ fontFamily: fonts.texteGras, color: colors.encre }}>Modifier</Text>
                </Text>
              </Pressable>
              <BoutonPrincipal
                label={enCours ? 'Un instant…' : pretAPublier ? 'Publier' : 'Choisis au moins une émotion'}
                desactive={!pretAPublier || enCours}
                onPress={publier}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ——— Recherche d'un livre dans Google Books ———
function RechercheLivre({ onChoix }: { onChoix: (o: OeuvreTrouvee) => void }) {
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<OeuvreTrouvee[]>([]);
  const [chargement, setChargement] = useState(false);
  const [probleme, setProbleme] = useState(false);
  const [manuel, setManuel] = useState(false);

  useEffect(() => {
    if (texte.trim().length < 2) {
      setResultats([]);
      return;
    }
    let annule = false;
    setChargement(true);
    // On attend que la personne arrête de taper avant de chercher.
    const minuteur = setTimeout(async () => {
      try {
        const r = await rechercherLivres(texte);
        if (!annule) {
          setResultats(r);
          setProbleme(false);
        }
      } catch {
        if (!annule) setProbleme(true);
      } finally {
        if (!annule) setChargement(false);
      }
    }, 450);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [texte]);

  if (manuel) return <SaisieOeuvre univers="livres" onChoix={onChoix} titreInitial={texte} />;

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <TextInput
        aria-label="Titre ou auteur"
        value={texte}
        onChangeText={setTexte}
        placeholder="Titre ou auteur…"
        placeholderTextColor={colors.gris}
        autoFocus
        returnKeyType="search"
        style={styles.champ}
      />
      {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 8 }} />}
      {probleme && <MessageErreur texte="La recherche ne répond pas. Tu peux saisir le livre à la main." />}
      {resultats.map((r) => (
        <Pressable key={r.source_id ?? r.titre} accessibilityRole="button" onPress={() => onChoix(r)} style={styles.resultat}>
          <Couverture oeuvre={r} largeur={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.titreResultat} numberOfLines={2}>{r.titre}</Text>
            <Text style={styles.petit} numberOfLines={1}>
              {[r.createur, r.annee].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
      ))}
      {texte.trim().length >= 2 && !chargement && (
        <Pressable accessibilityRole="button" onPress={() => setManuel(true)} style={styles.lien}>
          <Text style={styles.lienTexte}>Je ne le trouve pas : je le saisis</Text>
        </Pressable>
      )}
      {resultats.length > 0 && <Text style={styles.mention}>Recherche fournie par Google Books</Text>}
    </ScrollView>
  );
}

// ——— Saisie à la main (ciné, concerts, expos, ou livre introuvable) ———
function SaisieOeuvre({ univers: u, onChoix, titreInitial = '' }: { univers: UniversId; onChoix: (o: OeuvreTrouvee) => void; titreInitial?: string }) {
  const [titre, setTitre] = useState(titreInitial);
  const [createur, setCreateur] = useState('');
  const l = libelles[u];
  const createurObligatoire = u === 'livres' || u === 'concerts';
  const valide = titre.trim().length >= 1 && (!createurObligatoire || createur.trim().length >= 1);
  return (
    <>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {u === 'concerts' ? (
          <>
            <ChampSimple label={l.createur} valeur={createur} onChange={setCreateur} exemple="Le nom de l’artiste" autoFocus />
            <ChampSimple label="Le nom du concert ou de la tournée" valeur={titre} onChange={setTitre} exemple="Par exemple : la tournée 2026" />
          </>
        ) : (
          <>
            <ChampSimple label="Le titre" valeur={titre} onChange={setTitre} exemple={l.exempleTitre} autoFocus />
            <ChampSimple label={l.createur} valeur={createur} onChange={setCreateur} exemple={l.exempleCreateur} />
          </>
        )}
        {u !== 'livres' && <Text style={styles.petit}>Bientôt, tu pourras rechercher {u === 'cine' ? 'les films à l’affiche' : u === 'concerts' ? 'les artistes' : 'les expos de Toulouse'} directement.</Text>}
      </ScrollView>
      <View style={styles.pied}>
        <BoutonPrincipal
          label="Continuer"
          desactive={!valide}
          onPress={() =>
            onChoix({
              univers: u,
              // Pour un concert sans nom de tournée, on reprend le nom de l'artiste.
              titre: titre.trim() || createur.trim(),
              createur: createur.trim() || null,
              image_url: null,
              source: 'manuel',
              source_id: null,
            })
          }
        />
      </View>
    </>
  );
}

// ——— Petites briques ———
function Couverture({ oeuvre, largeur }: { oeuvre: OeuvreTrouvee; largeur: number }) {
  const style = { width: largeur, height: largeur * 1.4, borderRadius: 8, backgroundColor: univers[oeuvre.univers].couleur };
  return oeuvre.image_url ? <Image source={{ uri: oeuvre.image_url }} style={style} accessibilityIgnoresInvertColors /> : <View style={style} />;
}

function CarteOeuvre({ oeuvre, onChanger }: { oeuvre: OeuvreTrouvee; onChanger: () => void }) {
  const u = univers[oeuvre.univers];
  return (
    <View style={styles.oeuvre}>
      <Couverture oeuvre={oeuvre} largeur={60} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.universTexte, { color: u.texteFonce }]}>{u.label}</Text>
        <Text style={styles.titreOeuvre} numberOfLines={2}>{oeuvre.titre}</Text>
        <Text style={styles.petit} numberOfLines={1}>{['Aujourd’hui', oeuvre.createur].filter(Boolean).join(' · ')}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onChanger} style={styles.lien}>
        <Text style={styles.lienTexte}>Changer</Text>
      </Pressable>
    </View>
  );
}

function Segment({ label, options, valeur, onChange }: { label: string; options: { id: string; texte: string }[]; valeur: string; onChange: (v: string) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segment}>
      {options.map((o) => (
        <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: valeur === o.id }} onPress={() => onChange(o.id)} style={[styles.segmentBouton, valeur === o.id && { backgroundColor: colors.carte }]}>
          <Text style={styles.segmentTexte}>{o.texte}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChampSimple({ label, valeur, onChange, exemple, multiligne, autoFocus }: { label: string; valeur: string; onChange: (t: string) => void; exemple?: string; multiligne?: boolean; autoFocus?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        aria-label={label}
        value={valeur}
        onChangeText={onChange}
        placeholder={exemple}
        placeholderTextColor={colors.gris}
        multiline={multiligne}
        autoFocus={autoFocus}
        maxLength={multiligne ? 500 : 120}
        style={[styles.champ, multiligne && { height: 88, paddingTop: 12, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.encre },
  contenu: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 16 },
  question: { fontFamily: fonts.titre, fontSize: 24, lineHeight: 30, color: colors.encre, marginBottom: 4 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  carteUnivers: { width: '47%', flexGrow: 1, height: 130, borderRadius: 22, padding: 16, justifyContent: 'space-between' },
  pointUnivers: { width: 36, height: 36, borderRadius: 18 },
  nomUnivers: { fontFamily: fonts.titre, fontSize: 19, color: colors.encre },
  champ: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 14, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  resultat: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.carte, borderRadius: 14, padding: 10 },
  titreResultat: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  mention: { fontFamily: fonts.texte, fontSize: 11, color: colors.gris, textAlign: 'center' },
  oeuvre: { backgroundColor: colors.carte, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  universTexte: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre, marginVertical: 2 },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  lien: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.separateur, padding: 4, borderRadius: 24 },
  segmentBouton: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  segmentTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  section: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre, marginBottom: 4 },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emotion: { height: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', borderWidth: 1 },
  emotionActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  emotionInactive: { backgroundColor: colors.carte, borderColor: colors.bordure },
  emotionTexte: { fontFamily: fonts.texteMoyen, fontSize: 14 },
  pied: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, gap: 10 },
  visibilite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
});
