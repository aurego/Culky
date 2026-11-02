// Écran « Nouvelle activité » : le cœur de l'appli, une activité publiée en 30 secondes.
// Trois temps : l'univers → l'œuvre → ce que tu as vécu (émotions, lieu, quelques mots), puis on fête ça.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { MessageErreur } from '../components/Formulaire';
import { IconeFermer, IconeMonde, IconeRetour } from '../components/Icones';
import { emotions, emotionsFavorites } from '../data/emotions';
import { compterAnnee, publierActivite, rangDeLAnnee, type Visibilite } from '../lib/activites';
import { ajouterEnvie, retirerEnvie } from '../lib/envies';
import { bouclerLaBoucle } from '../lib/penses';
import { rechercherArtistes } from '../lib/concerts';
import { completerFilm, rechercheFilmsPossible, rechercherFilms } from '../lib/films';
import { enregistrerOeuvre, lireOeuvre, rechercherLivres, trouverOuCreerLieu, type OeuvreTrouvee } from '../lib/oeuvres';
import { aujourdhuiIso, isoVersFr, jourLong, lireDateFr } from '../lib/dates';
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

export default function Enregistrer() {
  const { session, profil } = useSession();
  // mode « envie » : on ajoute à ses envies au lieu d'enregistrer une activité.
  // oeuvre : on vient d'une envie (« J'y étais ») et l'œuvre est déjà connue.
  const params = useLocalSearchParams<{ mode?: string; oeuvre?: string }>();
  const modeEnvie = params.mode === 'envie';
  const modeConseil = params.mode === 'conseil';
  const modePasse = params.mode === 'passe'; // « Rattrape ton année » : on ajoute ce qu'on a vécu plus tôt
  const [etape, setEtape] = useState<'univers' | 'oeuvre' | 'details'>('univers');
  const [choix, setChoix] = useState<UniversId>('livres');
  const [oeuvre, setOeuvre] = useState<OeuvreTrouvee | null>(null);

  // Détails de l'activité
  const [etat, setEtat] = useState<'commence' | 'fini'>('fini');
  const [auCinema, setAuCinema] = useState(true);
  const [lieu, setLieu] = useState('');
  const [choisies, setChoisies] = useState<string[]>([]);
  const [toutes, setToutes] = useState(false);
  const [mots, setMots] = useState('');
  const [visibilite, setVisibilite] = useState<Visibilite>(profil?.visibilite_defaut ?? 'public');
  // Quand ? Aujourd'hui par défaut ; « Plus tôt » pour une lecture ou une sortie passée.
  const [quand, setQuand] = useState<'aujourdhui' | 'hier' | 'plus-tot'>(modePasse ? 'plus-tot' : 'aujourdhui');
  const [dateTexte, setDateTexte] = useState('');
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

  async function choisirOeuvre(o: OeuvreTrouvee) {
    if (modeConseil && session) {
      // Conseiller une œuvre : on la range dans la base, puis on choisit les amis.
      try {
        const id = await enregistrerOeuvre(o, session.user.id);
        router.replace({ pathname: '/penser', params: { oeuvre: id } });
      } catch (e) {
        setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
      }
      return;
    }
    setOeuvre(o);
    setEtape('details');
  }

  function basculer(id: string) {
    if (choisies.includes(id)) setChoisies(choisies.filter((x) => x !== id));
    else if (choisies.length < MAX_EMOTIONS) setChoisies([...choisies, id]);
  }

  // Un livre qu'on commence n'a pas encore besoin d'émotion.
  const emotionsObligatoires = !(choix === 'livres' && etat === 'commence');
  const dateIso = quand === 'aujourdhui' ? aujourdhuiIso() : quand === 'hier' ? aujourdhuiIso(-1) : lireDateFr(dateTexte);
  const dateOk = !!dateIso && dateIso <= aujourdhuiIso();
  const pretAPublier = !!oeuvre && (!emotionsObligatoires || choisies.length > 0) && dateOk;

  async function publier() {
    if (!session || !oeuvre || !pretAPublier || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const oeuvreId = await enregistrerOeuvre(oeuvre, session.user.id);
      const avecLieu = choix !== 'livres' && !(choix === 'cine' && !auCinema);
      const lieuId = avecLieu ? await trouverOuCreerLieu(lieu) : null;
      const activiteId = await publierActivite({
        auteurId: session.user.id,
        oeuvreId,
        lieuId,
        etat: choix === 'livres' ? etat : 'fini',
        auCinema: choix === 'cine' ? auCinema : null,
        emotions: choisies,
        mots,
        visibilite,
        dateActivite: dateIso ?? undefined,
      });
      // Si quelqu'un m'avait « pensé » cette œuvre, la boucle se boucle.
      const grace = await bouclerLaBoucle(session.user.id, oeuvreId, activiteId).catch(() => null);
      // Une envie vécue quitte la liste des envies : c'est fait, bravo !
      await retirerEnvie(session.user.id, oeuvreId).catch(() => undefined);
      const compteurs = await compterAnnee(session.user.id).catch(() => null);
      const commence = choix === 'livres' && etat === 'commence';
      router.replace({
        pathname: '/celebration',
        params: {
          univers: choix,
          titre: oeuvre.titre,
          createur: oeuvre.createur ?? '',
          image: oeuvre.image_url ?? '',
          commence: commence ? '1' : '0',
          rang: !commence && compteurs && dateIso?.slice(0, 4) === aujourdhuiIso().slice(0, 4) ? rangDeLAnnee(choix, compteurs[choix]) : '',
          passe: quand === 'plus-tot' ? '1' : '0',
          emotion: choisies[0] ?? '',
          grace: grace ?? '',
        },
      });
    } catch (e) {
      setEnCours(false);
      setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
    }
  }

  async function ajouterAuxEnvies() {
    if (!session || !oeuvre || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const oeuvreId = await enregistrerOeuvre(oeuvre, session.user.id);
      await ajouterEnvie(session.user.id, oeuvreId);
      router.replace('/envies');
    } catch (e) {
      setEnCours(false);
      setErreur(traduireErreur(e instanceof Error ? e.message : String(e)));
    }
  }

  const titres = modeConseil
    ? { univers: 'Conseiller', oeuvre: libelles[choix].question, details: '' }
    : modeEnvie
    ? { univers: 'Nouvelle envie', oeuvre: libelles[choix].question, details: 'Ton envie' }
    : modePasse
    ? { univers: 'Rattraper mon année', oeuvre: libelles[choix].question, details: 'Ce que tu as vécu' }
    : { univers: 'Nouvelle activité', oeuvre: libelles[choix].question, details: 'Ce que tu as vécu' };

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel={etape === 'univers' ? 'Fermer' : 'Retour'} onPress={retour} style={styles.rond44}>
            {etape === 'univers' ? <IconeFermer /> : <IconeRetour />}
          </Pressable>
          <Text accessibilityRole="header" style={styles.titre}>{titres[etape]}</Text>
          <View style={{ width: 44 }} />
        </View>

        {etape === 'univers' && (
          <ScrollView contentContainerStyle={styles.contenu}>
            <Text style={styles.question}>
              {modeConseil ? 'Qu’est-ce que tu veux conseiller ?' : modeEnvie ? 'Qu’est-ce qui te tente ?' : modePasse ? 'Qu’as-tu vécu plus tôt cette année ?' : 'Qu’est-ce que tu viens de vivre ?'}
            </Text>
            <View style={styles.grille}>
              {ordre.map((u) => (
                <Pressable key={u} accessibilityRole="button" onPress={() => choisirUnivers(u)} style={[styles.carteUnivers, { backgroundColor: univers[u].teinte }]}>
                  <View style={[styles.pointUnivers, { backgroundColor: univers[u].couleur }]} />
                  <Text style={styles.nomUnivers}>{{ livres: 'Un livre', cine: 'Un film', concerts: 'Un concert', expos: 'Une expo' }[u]}</Text>
                </Pressable>
              ))}
            </View>
            {!modeEnvie && !modeConseil && (
              <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/enregistrer', params: { mode: 'conseil' } })} style={[styles.lien, { alignSelf: 'center' }]}>
                <Text style={styles.lienTexte}>Ou conseiller une œuvre à un ami</Text>
              </Pressable>
            )}
            <MessageErreur texte={erreur} />
          </ScrollView>
        )}

        {etape === 'oeuvre' &&
          (choix === 'livres' || choix === 'concerts' || (choix === 'cine' && rechercheFilmsPossible) ? (
            <RechercheOeuvre key={choix} univers={choix} onChoix={choisirOeuvre} />
          ) : (
            <SaisieOeuvre univers={choix} onChoix={choisirOeuvre} />
          ))}

        {etape === 'details' && oeuvre && modeEnvie && (
          <>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              <CarteOeuvre oeuvre={oeuvre} onChanger={() => setEtape('oeuvre')} />
              <MessageErreur texte={erreur} />
            </ScrollView>
            <View style={styles.pied}>
              <BoutonPrincipal label={enCours ? 'Un instant…' : 'Ajouter à mes envies'} desactive={enCours} onPress={ajouterAuxEnvies} />
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

              <ChoixQuand quand={quand} onQuand={setQuand} dateTexte={dateTexte} onDate={setDateTexte} dateIso={dateIso} dateOk={dateOk} commence={choix === 'livres' && etat === 'commence'} />

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
                label={enCours ? 'Un instant…' : pretAPublier ? 'Publier' : !dateOk ? 'Indique la date' : 'Choisis au moins une émotion'}
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

// ——— Quand ? Aujourd'hui, hier, ou plus tôt (pour rattraper son année) ———
const moisCourts = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

function ChoixQuand({
  quand,
  onQuand,
  dateTexte,
  onDate,
  dateIso,
  dateOk,
  commence,
}: {
  quand: 'aujourdhui' | 'hier' | 'plus-tot';
  onQuand: (q: 'aujourdhui' | 'hier' | 'plus-tot') => void;
  dateTexte: string;
  onDate: (t: string) => void;
  dateIso: string | null;
  dateOk: boolean;
  commence: boolean;
}) {
  const annee = Number(aujourdhuiIso().slice(0, 4));
  const moisActuel = Number(aujourdhuiIso().slice(5, 7));
  // Un mois choisi d'un geste : le 15 (ou aujourd'hui pour le mois en cours). Seul le mois compte pour le bilan.
  function choisirMois(m: number) {
    const iso = m === moisActuel ? aujourdhuiIso() : `${annee}-${String(m).padStart(2, '0')}-15`;
    onDate(isoVersFr(iso));
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.section}>{commence ? 'Commencé quand ?' : 'Quand ?'}</Text>
      <Segment
        label={commence ? 'Commencé quand ?' : 'Quand ?'}
        options={[
          { id: 'aujourdhui', texte: 'Aujourd’hui' },
          { id: 'hier', texte: 'Hier' },
          { id: 'plus-tot', texte: 'Plus tôt' },
        ]}
        valeur={quand}
        onChange={(v) => onQuand(v as 'aujourdhui' | 'hier' | 'plus-tot')}
      />
      {quand === 'plus-tot' && (
        <View style={styles.blocQuand}>
          <Text style={styles.petit}>Tu ne te souviens plus du jour ? Choisis juste le mois.</Text>
          <View style={styles.mois}>
            {moisCourts.slice(0, moisActuel).map((m, i) => {
              const actif = dateIso?.slice(0, 7) === `${annee}-${String(i + 1).padStart(2, '0')}`;
              return (
                <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => choisirMois(i + 1)} style={[styles.moisBouton, actif && styles.moisActif]}>
                  <Text style={[styles.moisTexte, actif && { color: '#FFFFFF' }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
          <ChampSimple label="Ou la date exacte" valeur={dateTexte} onChange={onDate} exemple="jj/mm/aaaa" />
          {dateTexte.trim() ? (
            <Text style={[styles.petit, !dateOk && { color: '#9B2335' }]}>
              {!dateIso ? 'Écris la date comme ceci : 14/03/2026' : !dateOk ? 'Cette date n’est pas encore passée.' : jourLong(dateIso)}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ——— Recherche d'un livre dans Google Books ———
function RechercheOeuvre({ univers: u, onChoix }: { univers: 'livres' | 'cine' | 'concerts'; onChoix: (o: OeuvreTrouvee) => void }) {
  const film = u === 'cine';
  const concert = u === 'concerts';
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
        const r = film ? await rechercherFilms(texte) : concert ? await rechercherArtistes(texte) : await rechercherLivres(texte);
        if (!annule) {
          setResultats(r);
          setProbleme(false);
        }
      } catch {
        if (!annule) setProbleme(true);
      } finally {
        if (!annule) setChargement(false);
      }
    }, concert ? 800 : 450);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [texte]);

  if (manuel) return <SaisieOeuvre univers={u} onChoix={onChoix} titreInitial={texte} />;

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <TextInput
        aria-label={film ? 'Titre du film' : concert ? 'Nom de l’artiste ou du groupe' : 'Titre ou auteur'}
        value={texte}
        onChangeText={setTexte}
        placeholder={film ? 'Titre du film…' : concert ? 'Artiste ou groupe…' : 'Titre ou auteur…'}
        placeholderTextColor={colors.gris}
        autoFocus
        returnKeyType="search"
        style={styles.champ}
      />
      {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 8 }} />}
      {probleme && <MessageErreur texte={`La recherche ne répond pas. Tu peux saisir ${film ? 'le film' : concert ? 'l’artiste' : 'le livre'} à la main.`} />}
      {resultats.map((r) => (
        <Pressable key={r.source_id ?? r.titre} accessibilityRole="button" onPress={async () => onChoix(film ? await completerFilm(r) : r)} style={styles.resultat}>
          {concert ? <PastilleArtiste nom={r.titre} /> : <Couverture oeuvre={r} largeur={44} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.titreResultat} numberOfLines={2}>{r.titre}</Text>
            <Text style={styles.petit} numberOfLines={1}>
              {[r.createur !== r.titre ? r.createur : null, r.annee].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
      ))}
      {texte.trim().length >= 2 && !chargement && (
        <Pressable accessibilityRole="button" onPress={() => setManuel(true)} style={styles.lien}>
          <Text style={styles.lienTexte}>Je ne le trouve pas : je le saisis</Text>
        </Pressable>
      )}
      {resultats.length > 0 && (
        <Text style={styles.mention}>{film ? 'Données et affiches : TMDB. Ce produit utilise l’API TMDB sans être approuvé ni certifié par TMDB.' : concert ? 'Artistes : MusicBrainz' : 'Recherche fournie par Google Books'}</Text>
      )}
    </ScrollView>
  );
}

// ——— Saisie à la main (ciné, concerts, expos, ou livre introuvable) ———
function SaisieOeuvre({ univers: u, onChoix, titreInitial = '' }: { univers: UniversId; onChoix: (o: OeuvreTrouvee) => void; titreInitial?: string }) {
  // Pour un concert, ce qu'on a tapé dans la recherche, c'est le nom de l'artiste.
  const [titre, setTitre] = useState(u === 'concerts' ? '' : titreInitial);
  const [createur, setCreateur] = useState(u === 'concerts' ? titreInitial : '');
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
        {u === 'expos' || (u === 'cine' && !rechercheFilmsPossible) ? (
          <Text style={styles.petit}>Bientôt, tu pourras rechercher {u === 'cine' ? 'les films' : 'les expos de Toulouse'} directement.</Text>
        ) : null}
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
function PastilleArtiste({ nom }: { nom: string }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: univers.concerts.teinte, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.titreGras, fontSize: 18, color: univers.concerts.texteFonce }}>{nom.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

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
        {oeuvre.createur && oeuvre.createur !== oeuvre.titre ? <Text style={styles.petit} numberOfLines={1}>{oeuvre.createur}</Text> : null}
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
  blocQuand: { gap: 10, backgroundColor: colors.carte, borderRadius: 16, padding: 14 },
  mois: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moisBouton: { minWidth: 64, height: 40, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.bordure, backgroundColor: colors.fond, alignItems: 'center', justifyContent: 'center' },
  moisActif: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  moisTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
  contenu: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 16 },
  question: { fontFamily: fonts.titre, fontSize: 24, lineHeight: 30, color: colors.culkoko, marginBottom: 4 },
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
  section: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko, marginBottom: 4 },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emotion: { height: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', borderWidth: 1 },
  emotionActive: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  emotionInactive: { backgroundColor: colors.carte, borderColor: colors.bordure },
  emotionTexte: { fontFamily: fonts.texteMoyen, fontSize: 14 },
  pied: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, gap: 10 },
  visibilite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
});
