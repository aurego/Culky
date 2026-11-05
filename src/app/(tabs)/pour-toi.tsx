// Onglet Pour toi : « Qu'est-ce qu'on m'a conseillé ? »
// Reçus : « Claire a pensé à toi ». Mes conseils : ce que j'ai conseillé, et ce qui a touché juste.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Carte } from '../../components/Base';
import { EnTeteOnglet } from '../../components/EnTete';
import { ErreurChargement, EtatVide } from '../../components/EtatVide';
import { emotionParId } from '../../data/emotions';
import { quandActivite } from '../../lib/dates';
import { ajouterEnvie, mesEnviesIds } from '../../lib/envies';
import { direMerci, supprimerPenseRecu, nombreInspires, pensesEnvoyes, pensesRecus, raconterVoyage, voyagesDeMesConseils, type PenseEnvoye, type PenseRecu, type Voyage } from '../../lib/penses';
import { useSession } from '../../lib/session';
import { colors, fonts, univers, type UniversId, categories, categorieDe } from '../../theme';

const vecu: Record<UniversId, string> = { livres: 'Je l’ai lu', cine: 'Je l’ai vu', concerts: 'J’y étais', expos: 'J’y étais' };
const verbeBoucle: Record<UniversId, string> = { livres: 'l’a lu', cine: 'l’a vu', concerts: 'y était', expos: 'y est allé·e' };

export default function PourToi() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const { vue } = useLocalSearchParams<{ vue?: string }>();
  const [onglet, setOnglet] = useState<'recus' | 'envoyes'>(vue === 'conseils' ? 'envoyes' : 'recus');
  useEffect(() => {
    if (vue === 'conseils') setOnglet('envoyes');
  }, [vue]);
  const [recus, setRecus] = useState<PenseRecu[]>([]);
  const [envoyes, setEnvoyes] = useState<PenseEnvoye[]>([]);
  const [envies, setEnvies] = useState<Set<string>>(new Set());
  const [voyages, setVoyages] = useState<Map<string, Voyage>>(new Map());
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [probleme, setProbleme] = useState(false);
  const [aRetirer, setARetirer] = useState<string | null>(null); // le conseil reçu qu'on s'apprête à retirer

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      const [r, e, ids] = await Promise.all([pensesRecus(moi), pensesEnvoyes(moi), mesEnviesIds(moi)]);
      setRecus(r);
      setEnvoyes(e);
      setEnvies(ids);
      setProbleme(false);
      // Le voyage des conseils (complément SQL n° 8) : en plus, sans bloquer l'écran s'il manque.
      voyagesDeMesConseils().then(setVoyages, () => setVoyages(new Map()));
    } catch (err) {
      console.warn('Pour toi :', err);
      setProbleme(true);
    } finally {
      setChargement(false);
      setRafraichit(false);
    }
  }, [moi]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  async function caMeTente(p: PenseRecu) {
    setEnvies(new Set([...envies, p.oeuvre.id]));
    try {
      await ajouterEnvie(moi, p.oeuvre.id, p.expediteur.id);
    } catch {
      charger();
    }
  }

  async function merci(p: PenseRecu) {
    setRecus((l) => l.map((x) => (x.id === p.id ? { ...x, merci_le: new Date().toISOString() } : x)));
    try {
      await direMerci(p.id);
    } catch {
      charger();
    }
  }

  // Retirer un conseil reçu (avec confirmation) : la personne qui l'a envoyé n'est pas prévenue.
  async function retirerConseil(p: PenseRecu) {
    setARetirer(null);
    setRecus((l) => l.filter((x) => x.id !== p.id));
    try {
      await supprimerPenseRecu(p.id);
    } catch {
      charger();
    }
  }

  const inspires = nombreInspires(envoyes);
  const dejaRaconte = new Set<string>(); // une seule fois par œuvre, sur le conseil le plus récent

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <EnTeteOnglet titre="Pour moi" sousTitre="Les conseils de mes amis, et les miens." />

      <View style={styles.onglets}>
        {(['recus', 'envoyes'] as const).map((o) => {
          const actif = onglet === o;
          return (
            <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => setOnglet(o)} style={[styles.onglet, actif ? styles.ongletActif : styles.ongletInactif]}>
              <Text style={[styles.ongletTexte, { color: actif ? colors.culkoko : colors.gris, fontFamily: actif ? fonts.texteGras : fonts.texteMoyen }]}>
                {o === 'recus' ? `Reçus${recus.length ? ` · ${recus.length}` : ''}` : `Envoyés${envoyes.length ? ` · ${envoyes.length}` : ''}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); }} tintColor={colors.culkoko} />}
      >
        {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} />}
        {probleme && <ErreurChargement texte="Impossible de charger tes conseils pour l’instant." onReessayer={() => { setChargement(true); charger(); }} />}

        {!chargement && !probleme && onglet === 'recus' && recus.length === 0 && (
          <EtatVide
            couleur="livres"
            titre="Bientôt, on pensera à toi !"
            texte="Quand un ami lira, verra ou visitera quelque chose qui lui fait penser à toi, son conseil arrivera ici. Invite tes amis : les premiers conseils ne tarderont pas."
            principal={{ texte: 'Inviter un ami', onPress: () => router.push('/amis') }}
          />
        )}
        {!chargement && !probleme && onglet === 'envoyes' && envoyes.length === 0 && (
          <EtatVide
            couleur="livres"
            titre="À toi de jouer !"
            texte="Un livre, un film, une expo t’a fait penser à quelqu’un ? Conseille-le : il verra que tu as pensé à lui, et tu sauras si ça a touché juste."
            principal={{ texte: 'Conseiller quelque chose', onPress: () => router.push({ pathname: '/enregistrer', params: { mode: 'conseil' } }) }}
          />
        )}

        {!chargement && onglet === 'envoyes' && inspires > 0 && (
          <Text style={styles.bilan}>
            Tes conseils ont inspiré {inspires} activité{inspires > 1 ? 's' : ''} 🎉
          </Text>
        )}

        {!chargement &&
          onglet === 'recus' &&
          recus.map((p) => {
            const u = univers[p.oeuvre.univers];
            const dejaEnvie = envies.has(p.oeuvre.id);
            return (
              <Carte key={p.id} style={styles.carte}>
                <View style={styles.ligne}>
                  <Avatar initiale={p.expediteur.pseudo.charAt(0).toUpperCase()} fond={u.teinte} />
                  <Text style={[styles.texte, { flex: 1 }]}>
                    <Text style={styles.gras}>{p.expediteur.pseudo}</Text> a pensé à toi · <Text style={styles.petit}>{quandActivite(p.cree_le.slice(0, 10), p.cree_le)}</Text>
                  </Text>
                </View>
                <Oeuvre o={p.oeuvre} />
                {p.mot ? <Text style={styles.mot}>« {p.mot} »</Text> : null}
                {p.merci_le ? (
                  <Text style={styles.petit}>Tu as dit merci à {p.expediteur.pseudo} 🙏</Text>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => merci(p)} style={styles.merci}>
                    <Text style={styles.merciTexte}>Merci {p.expediteur.pseudo} ! 🙏</Text>
                  </Pressable>
                )}
                {p.activite_bouclee_id ? (
                  <Text style={styles.boucle}>Tu l’as vécu : {p.expediteur.pseudo} le sait</Text>
                ) : (
                  <View style={styles.boutons}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: dejaEnvie }}
                      onPress={() => !dejaEnvie && caMeTente(p)}
                      style={[styles.bouton, dejaEnvie ? styles.boutonClair : { backgroundColor: colors.culkoko }]}
                    >
                      <Text style={[styles.boutonTexte, { color: dejaEnvie ? colors.encre : '#FFFFFF' }]}>{dejaEnvie ? 'Dans mes envies ✓' : 'Ça me tente'}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/enregistrer', params: { oeuvre: p.oeuvre.id } })} style={[styles.bouton, styles.boutonClair]}>
                      <Text style={styles.boutonTexte}>{vecu[p.oeuvre.univers]}</Text>
                    </Pressable>
                  </View>
                )}
                {aRetirer === p.id ? (
                  <View style={styles.retrait}>
                    <Text style={styles.petit}>Retirer ce conseil de « Pour toi » ? {p.expediteur.pseudo} ne sera pas prévenu·e.</Text>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Pressable accessibilityRole="button" onPress={() => retirerConseil(p)} style={styles.retraitBouton}>
                        <Text style={[styles.retraitTexte, { color: '#9B2335' }]}>Oui, retirer</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => setARetirer(null)} style={styles.retraitBouton}>
                        <Text style={styles.retraitTexte}>Annuler</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Retirer le conseil de ${p.expediteur.pseudo}`} onPress={() => setARetirer(p.id)} style={styles.retraitBouton}>
                    <Text style={styles.retraitTexte}>Retirer ce conseil</Text>
                  </Pressable>
                )}
              </Carte>
            );
          })}

        {!chargement &&
          onglet === 'envoyes' &&
          envoyes.map((p) => {
            const qui = p.destinataire?.pseudo ?? 'Un ami invité';
            const emotion = p.activite?.emotions?.[0] ? emotionParId(p.activite.emotions[0]) : undefined;
            return (
              <Carte key={p.id} style={styles.carte}>
                <Text style={styles.texte}>
                  Pour <Text style={styles.gras}>{qui}</Text> · <Text style={styles.petit}>{quandActivite(p.cree_le.slice(0, 10), p.cree_le)}</Text>
                </Text>
                <Oeuvre o={p.oeuvre} />
                {p.activite ? (
                  <Text style={styles.boucle}>
                    🎯 Ton conseil a touché juste : {qui} {verbeBoucle[p.oeuvre.univers]} !{emotion && emotion.famille !== 'Le négatif sympa' ? ` ${emotion.emoji} ${emotion.label}` : ''}
                  </Text>
                ) : (
                  (voyages.get(p.oeuvre.id)?.plus_loin ?? 0) > 0 && !dejaRaconte.has(p.oeuvre.id) ? null : (
                    <Text style={styles.petit}>{p.destinataire ? `Envoyé à ${qui}.` : 'Invitation envoyée par lien.'}</Text>
                  )
                )}
                {p.merci_le ? <Text style={styles.petit}>{qui} t’a dit merci 🙏</Text> : null}
                <VoyageDuConseil qui={qui} v={voyages.get(p.oeuvre.id)} premiere={!dejaRaconte.has(p.oeuvre.id) && !!dejaRaconte.add(p.oeuvre.id)} />
              </Carte>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

// « Ce conseil a voyagé : Claire, Hugo et 3 autres personnes l'ont reçu à leur tour. »
// Le voyage d'un conseil, dessiné comme un trajet : Toi → Sofia → Claire → Hugo → +3.
function VoyageDuConseil({ v, premiere, qui }: { v?: Voyage; premiere: boolean; qui: string }) {
  if (!v || !premiere || v.plus_loin === 0) return null;
  const noms = v.noms.slice(0, 2);
  const autres = v.plus_loin - noms.length;
  const etapes: { cle: string; texte: string; nom: string; toi?: boolean }[] = [
    { cle: 'toi', texte: 'Toi', nom: '', toi: true },
    { cle: 'qui', texte: qui.charAt(0).toUpperCase(), nom: qui },
    ...noms.map((n, k) => ({ cle: `n${k}`, texte: n.charAt(0).toUpperCase(), nom: n })),
    ...(autres > 0 ? [{ cle: 'plus', texte: `+${autres}`, nom: autres > 1 ? 'autres' : 'autre' }] : []),
  ];
  return (
    <View accessible accessibilityLabel={`Le voyage de ce conseil : toi, puis ${[qui, ...noms].join(', ')}${autres > 0 ? ` et ${autres} autre${autres > 1 ? 's' : ''}` : ''}`} style={styles.trajet}>
      {etapes.map((e, k) => (
        <View key={e.cle} style={styles.etapeLigne}>
          {k > 0 ? <View style={styles.pointilles} /> : null}
          <View style={styles.etape}>
            <View style={[styles.bulle, e.toi && styles.bulleToi, e.cle === 'plus' && styles.bullePlus]}>
              <Text style={[styles.bulleTexte, e.toi && { color: '#FFFFFF', fontSize: 12 }]}>{e.texte}</Text>
            </View>
            <Text style={styles.etapeNom} numberOfLines={1}>{e.nom}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Oeuvre({ o }: { o: PenseRecu['oeuvre'] }) {
  const u = univers[o.univers];
  return (
    <View style={[styles.oeuvre, { backgroundColor: u.teinte }]}>
      {o.image_url ? <Image source={{ uri: o.image_url }} style={styles.vignette} /> : <View style={[styles.vignette, { backgroundColor: u.couleur }]} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.universTexte, { color: u.texteFonce }]}>{categories[categorieDe(o)].label}</Text>
        <Text style={styles.titreOeuvre} numberOfLines={2}>{o.titre}</Text>
        {o.createur ? <Text style={styles.petit} numberOfLines={1}>{o.createur}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trajet: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4 },
  etapeLigne: { flexDirection: 'row', alignItems: 'flex-start' },
  pointilles: { width: 16, marginTop: 18, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.culkoko },
  etape: { width: 48, alignItems: 'center', gap: 4 },
  bulle: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.beige, alignItems: 'center', justifyContent: 'center' },
  bulleToi: { backgroundColor: colors.culkoko },
  bullePlus: { backgroundColor: colors.carte, borderWidth: 1.5, borderColor: colors.bordure },
  bulleTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  etapeNom: { fontFamily: fonts.texte, fontSize: 11, color: colors.gris, maxWidth: 52 },
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, gap: 4 },
  onglets: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 14 },
  onglet: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.carte, borderWidth: 1.5, borderColor: colors.culkoko },
  ongletInactif: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  ongletTexte: { fontSize: 15 },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  carte: { padding: 14, gap: 12 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  texte: { fontFamily: fonts.texte, fontSize: 15, color: colors.encre },
  gras: { fontFamily: fonts.texteGras },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  oeuvre: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 10 },
  vignette: { width: 44, height: 62, borderRadius: 8 },
  universTexte: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre },
  mot: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre, fontStyle: 'italic' },
  accompagne: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  retrait: { gap: 2 },
  retraitBouton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  retraitTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.gris },
  merci: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.beige, justifyContent: 'center' },
  merciTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  boucle: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  boutons: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  boutonClair: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  bilan: { fontFamily: fonts.titre, fontSize: 16, color: colors.sousTitre, textAlign: 'center', marginVertical: 4 },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko },
});
