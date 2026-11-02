// Onglet Pour toi : « Qu'est-ce qu'on m'a conseillé ? »
// Reçus : « Claire a pensé à toi ». Mes conseils : ce que j'ai conseillé, et ce qui a touché juste.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Carte, Titre } from '../../components/Base';
import { emotionParId } from '../../data/emotions';
import { quandActivite } from '../../lib/dates';
import { ajouterEnvie, mesEnviesIds } from '../../lib/envies';
import { nombreInspires, pensesEnvoyes, pensesRecus, type PenseEnvoye, type PenseRecu } from '../../lib/penses';
import { useSession } from '../../lib/session';
import { colors, fonts, univers, type UniversId } from '../../theme';

const vecu: Record<UniversId, string> = { livres: 'Je l’ai lu', cine: 'Je l’ai vu', concerts: 'J’y étais', expos: 'J’y étais' };
const verbeBoucle: Record<UniversId, string> = { livres: 'l’a lu', cine: 'l’a vu', concerts: 'y était', expos: 'y est allé·e' };

export default function PourToi() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [onglet, setOnglet] = useState<'recus' | 'envoyes'>('recus');
  const [recus, setRecus] = useState<PenseRecu[]>([]);
  const [envoyes, setEnvoyes] = useState<PenseEnvoye[]>([]);
  const [envies, setEnvies] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [probleme, setProbleme] = useState(false);

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      const [r, e, ids] = await Promise.all([pensesRecus(moi), pensesEnvoyes(moi), mesEnviesIds(moi)]);
      setRecus(r);
      setEnvoyes(e);
      setEnvies(ids);
      setProbleme(false);
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

  const inspires = nombreInspires(envoyes);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <View style={styles.entete}>
        <Titre>Pour toi</Titre>
        <Text style={styles.petit}>Ce que tes amis te conseillent, en pensant à toi</Text>
      </View>

      <View style={styles.onglets}>
        {(['recus', 'envoyes'] as const).map((o) => {
          const actif = onglet === o;
          return (
            <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => setOnglet(o)} style={[styles.onglet, actif ? styles.ongletActif : styles.ongletInactif]}>
              <Text style={[styles.ongletTexte, { color: actif ? '#FFFFFF' : colors.encre, fontFamily: actif ? fonts.texteGras : fonts.texteMoyen }]}>
                {o === 'recus' ? `Reçus${recus.length ? ` · ${recus.length}` : ''}` : `Mes conseils${envoyes.length ? ` · ${envoyes.length}` : ''}`}
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
        {probleme && <Text style={styles.message}>Impossible de charger tes conseils pour l’instant. Tire vers le bas pour réessayer.</Text>}

        {!chargement && onglet === 'recus' && recus.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videTitre}>Rien reçu pour l’instant</Text>
            <Text style={styles.message}>Quand un ami pensera à toi en lisant, en regardant ou en visitant quelque chose, ce sera ici.</Text>
          </View>
        )}
        {!chargement && onglet === 'envoyes' && envoyes.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videTitre}>À toi de jouer !</Text>
            <Text style={styles.message}>Touche le cadeau 🎁 sur une activité pour la conseiller à quelqu’un à qui elle te fait penser.</Text>
          </View>
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
                {p.mot ? <Text style={styles.mot}>« {p.mot} »</Text> : null}
                {p.activite_bouclee_id ? (
                  <Text style={styles.boucle}>Tu l’as vécu : {p.expediteur.pseudo} le sait 💌</Text>
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
                    🎉 {qui} {verbeBoucle[p.oeuvre.univers]}{emotion ? ` : ${emotion.label} ${emotion.emoji}` : ' !'}
                  </Text>
                ) : (
                  <Text style={styles.petit}>{p.destinataire ? 'Pas encore vécu… patience !' : 'Invitation envoyée par lien'}</Text>
                )}
              </Carte>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Oeuvre({ o }: { o: PenseRecu['oeuvre'] }) {
  const u = univers[o.univers];
  return (
    <View style={[styles.oeuvre, { backgroundColor: u.teinte }]}>
      {o.image_url ? <Image source={{ uri: o.image_url }} style={styles.vignette} /> : <View style={[styles.vignette, { backgroundColor: u.couleur }]} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.universTexte, { color: u.texteFonce }]}>{u.label}</Text>
        <Text style={styles.titreOeuvre} numberOfLines={2}>{o.titre}</Text>
        {o.createur ? <Text style={styles.petit} numberOfLines={1}>{o.createur}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, gap: 4 },
  onglets: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 14 },
  onglet: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.encre },
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
  boucle: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  boutons: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  boutonClair: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  bilan: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre, textAlign: 'center', marginVertical: 4 },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
});
