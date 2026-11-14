// « Mes chouchous » (6 au maximum) et « Mon plaisir coupable » (un seul) : des œuvres choisies pour mon profil.
// On peut les prendre dans son journal, ou chercher n'importe quelle œuvre (même lue il y a dix ans),
// sans l'enregistrer dans son journal ni dans le fil.
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../components/EnTete';
import { lireJournal, type EntreeJournal } from '../lib/activites';
import { ajouterFavori, lireFavoris, MAX_CHOUCHOUS, messageFavori, retirerFavori, type Favori } from '../lib/favoris';
import { enregistrerOeuvre, type OeuvreTrouvee } from '../lib/oeuvres';
import { useSession } from '../lib/session';
import { colors, fonts, univers, type UniversId } from '../theme';
import { RechercheOeuvre } from './enregistrer';

type Oeuvre = { oeuvre_id: string; titre: string; univers: UniversId; image_url: string | null };
const choixUnivers: { id: string; label: string; univers: UniversId; spectacle?: boolean }[] = [
  { id: 'livres', label: '📖 Un livre', univers: 'livres' },
  { id: 'cine', label: '🎬 Un film', univers: 'cine' },
  { id: 'concerts', label: '🎤 Un concert', univers: 'concerts' },
  { id: 'spectacles', label: '🎭 Un spectacle', univers: 'concerts', spectacle: true },
  { id: 'expos', label: '🖼️ Une expo', univers: 'expos' },
];

export default function Chouchous() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const plaisir = useLocalSearchParams<{ mode?: string }>().mode === 'plaisir';
  const type = plaisir ? 'plaisir' : 'chouchou';
  const [favoris, setFavoris] = useState<Favori[] | null>(null);
  const [journal, setJournal] = useState<Oeuvre[]>([]);
  const [recherche, setRecherche] = useState<(typeof choixUnivers)[number] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [indisponible, setIndisponible] = useState(false);

  const charger = useCallback(async () => {
    if (!moi) return;
    const [f, j] = await Promise.all([lireFavoris(moi), lireJournal(moi, 300).catch(() => [] as EntreeJournal[])]);
    if (f === null) setIndisponible(true);
    setFavoris(f ?? []);
    // Une seule fois par œuvre (on a pu relire un livre ou revoir un film).
    const vues = new Set<string>();
    setJournal(
      j.filter((e) => e.etat === 'fini' && !vues.has(e.oeuvre_id) && (vues.add(e.oeuvre_id), true)).map((e) => ({ oeuvre_id: e.oeuvre_id, titre: e.oeuvre.titre, univers: e.oeuvre.univers, image_url: e.oeuvre.image_url })),
    );
  }, [moi]);
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const choisis = (favoris ?? []).filter((f) => f.type === type);
  const estChoisi = (oeuvreId: string) => choisis.some((f) => f.oeuvre_id === oeuvreId);

  async function basculer(o: Oeuvre) {
    setMessage(null);
    try {
      if (estChoisi(o.oeuvre_id)) await retirerFavori(moi, o.oeuvre_id, type);
      else {
        if (!plaisir && choisis.length >= MAX_CHOUCHOUS) return setMessage(`Tu as déjà ${MAX_CHOUCHOUS} chouchous : retires-en un avant d’en ajouter un autre.`);
        await ajouterFavori(moi, o.oeuvre_id, type);
      }
      await charger();
    } catch (e) {
      setMessage(messageFavori(e));
    }
  }

  async function choisirTrouvee(o: OeuvreTrouvee) {
    setRecherche(null);
    try {
      const id = await enregistrerOeuvre(o, moi);
      await basculer({ oeuvre_id: id, titre: o.titre, univers: o.univers, image_url: o.image_url });
    } catch (e) {
      setMessage(messageFavori(e));
    }
  }

  // La recherche d'une œuvre (comme dans « + »), sans rien publier.
  if (recherche) {
    return (
      <SafeAreaView style={styles.ecran}>
        <EnTetePage titre={recherche.label.slice(recherche.label.indexOf(' ') + 1)} onRetour={() => setRecherche(null)} />
        <RechercheOeuvre univers={recherche.univers} spectacle={!!recherche.spectacle} onChoix={choisirTrouvee} />
      </SafeAreaView>
    );
  }

  const tuile = (o: Oeuvre, oui: boolean) => {
    const u = univers[o.univers];
    return (
      <Pressable key={o.oeuvre_id} accessibilityRole="checkbox" accessibilityState={{ checked: oui }} accessibilityLabel={o.titre} onPress={() => basculer(o)} style={styles.case}>
        <View>
          {o.image_url ? (
            <Image source={{ uri: o.image_url }} style={[styles.couverture, oui && { borderColor: u.couleur }]} />
          ) : (
            <View style={[styles.couverture, styles.sansImage, { backgroundColor: u.teinte }, oui && { borderColor: u.couleur }]}>
              <Text style={[styles.titreSansImage, { color: u.texteFonce }]} numberOfLines={4}>{o.titre}</Text>
            </View>
          )}
          <View style={[styles.coche, oui ? { backgroundColor: u.couleur, borderColor: u.couleur } : null]}>{oui ? <Text style={styles.cocheTexte}>{plaisir ? '😉' : '✓'}</Text> : null}</View>
        </View>
        <Text style={styles.titre} numberOfLines={2}>{o.titre}</Text>
      </Pressable>
    );
  };

  const dejaMontres = new Set(choisis.map((f) => f.oeuvre_id));
  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre={plaisir ? 'Mon plaisir coupable' : 'Mes chouchous'} />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          {plaisir
            ? 'Ce livre, ce film ou ce concert que tu adores… sans forcément le crier sur les toits 😉 Un seul, et ici, on ne juge pas.'
            : 'Les œuvres que tu adores, même découvertes il y a des années. Elles s’affichent sur ton profil, sans apparaître dans le fil.'}
          {!plaisir ? <Text style={styles.compte}> {choisis.length}/{MAX_CHOUCHOUS}</Text> : null}
        </Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {indisponible ? <Text style={styles.message}>Cette fonction arrive très bientôt.</Text> : null}

        <Text style={styles.sousTitre}>Ajouter une œuvre</Text>
        <View style={styles.puces}>
          {choixUnivers.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" disabled={indisponible} onPress={() => setRecherche(c)} style={[styles.puce, { backgroundColor: univers[c.univers].teinte }]}>
              <Text style={[styles.puceTexte, { color: univers[c.univers].texteFonce }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {favoris === null ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} /> : null}
        {choisis.length ? (
          <>
            <Text style={styles.sousTitre}>{plaisir ? 'Mon choix' : 'Mes chouchous'}</Text>
            <Text style={styles.petit}>Touche une œuvre pour la retirer.</Text>
            <View style={styles.grille}>{choisis.map((f) => tuile({ oeuvre_id: f.oeuvre_id, ...f.oeuvre }, true))}</View>
          </>
        ) : null}

        {journal.filter((o) => !dejaMontres.has(o.oeuvre_id)).length ? (
          <>
            <Text style={styles.sousTitre}>Depuis mon journal</Text>
            <View style={styles.grille}>{journal.filter((o) => !dejaMontres.has(o.oeuvre_id)).map((o) => tuile(o, false))}</View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  intro: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  compte: { fontFamily: fonts.texteGras, color: colors.sousTitre },
  message: { fontFamily: fonts.texteMoyen, fontSize: 13, color: colors.sousTitre },
  sousTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre, marginTop: 6 },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris, marginTop: -8 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  puceTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  case: { width: '30%', gap: 6 },
  couverture: { width: '100%', aspectRatio: 0.7, borderRadius: 10, borderWidth: 3, borderColor: 'transparent' },
  sansImage: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  titreSansImage: { fontFamily: fonts.titre, fontSize: 13, textAlign: 'center' },
  coche: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(31,27,36,0.25)', alignItems: 'center', justifyContent: 'center' },
  cocheTexte: { color: '#FFFFFF', fontFamily: fonts.texteGras, fontSize: 14 },
  titre: { fontFamily: fonts.texteMoyen, fontSize: 12, lineHeight: 16, color: colors.encre },
});
