// Onglet Envies : « Que veux-je vivre ? »
// Tes envies, avec les rappels (« l'expo ferme dans 10 jours »), les amis qui ont la même envie,
// « On y va ensemble ? » et « J'y étais », qui transforme l'envie en activité… et en fête.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Carte, FiltreUnivers, Titre } from '../../components/Base';
import { IconePlus } from '../../components/Icones';
import { amisAvecLaMemeEnvie, lireEnvies, rappel, retirerEnvie, type AmiAussi, type Envie } from '../../lib/envies';
import { mesAbonnements } from '../../lib/fil';
import { useSession } from '../../lib/session';
import { colors, fonts, univers, universIds, type UniversId } from '../../theme';

const actionVecue: Record<UniversId, string> = { livres: 'Je l’ai lu', cine: 'Je l’ai vu', concerts: 'J’y étais', expos: 'J’y étais' };
const emojiUnivers: Record<UniversId, string> = { livres: '📚', cine: '🎬', concerts: '🎶', expos: '🎨' };

export default function Envies() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [filtre, setFiltre] = useState<UniversId | 'tout'>('tout');
  const [envies, setEnvies] = useState<Envie[]>([]);
  const [amis, setAmis] = useState<AmiAussi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [probleme, setProbleme] = useState(false);
  const [message, setMessage] = useState<{ oeuvre: string; texte: string } | null>(null);

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      const liste = await lireEnvies(moi);
      setEnvies(liste);
      const suivis = await mesAbonnements(moi);
      setAmis(await amisAvecLaMemeEnvie(suivis, liste.map((e) => e.oeuvre_id)));
      setProbleme(false);
    } catch (e) {
      console.warn('Envies :', e);
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

  async function retirer(e: Envie) {
    setEnvies((l) => l.filter((x) => x.oeuvre_id !== e.oeuvre_id));
    try {
      await retirerEnvie(moi, e.oeuvre_id);
    } catch {
      charger();
    }
  }

  // « On y va ensemble ? » : un message prêt à envoyer par WhatsApp, SMS…
  async function proposer(e: Envie, avec: string[]) {
    const lien = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
    const verbe = e.oeuvre.univers === 'cine' ? 'voir' : e.oeuvre.univers === 'concerts' ? 'aller voir' : 'visiter';
    const qui = avec.length ? `${avec.join(', ')} ! ` : '';
    const texte = `${qui}On y va ensemble ? J’ai très envie de ${verbe} « ${e.oeuvre.titre} » ${emojiUnivers[e.oeuvre.univers]}${lien ? `\n— envoyé depuis Culky : ${lien}` : ''}`;
    try {
      const r = await Share.share({ message: texte });
      if (r.action === Share.dismissedAction) return;
    } catch {
      // Le partage n'est pas disponible (certains navigateurs d'ordinateur) : on affiche le message à copier.
      setMessage({ oeuvre: e.oeuvre_id, texte });
    }
  }

  const visibles = envies
    .filter((e) => filtre === 'tout' || e.oeuvre.univers === filtre)
    .sort((a, b) => Number(!!rappel(b.oeuvre.univers, b.oeuvre.date_fin)?.urgent) - Number(!!rappel(a.oeuvre.univers, a.oeuvre.date_fin)?.urgent));
  const compte = (u: UniversId) => envies.filter((e) => e.oeuvre.univers === u).length;
  const libelles = { livres: 'À lire', cine: 'À voir', concerts: 'À écouter', expos: 'À visiter' } as Record<UniversId, string>;
  universIds.forEach((u) => {
    if (compte(u)) libelles[u] += ` · ${compte(u)}`;
  });

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <View style={styles.entete}>
        <View style={{ flex: 1, gap: 4 }}>
          <Titre>Mes envies</Titre>
          <Text style={styles.petit}>{envies.length === 0 ? 'Rien en vue pour l’instant' : `${envies.length} chose${envies.length > 1 ? 's' : ''} à vivre`}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Ajouter une envie" onPress={() => router.push({ pathname: '/enregistrer', params: { mode: 'envie' } })} style={styles.ajouter}>
          <IconePlus taille={20} couleur="#FFFFFF" epaisseur={2.4} />
        </Pressable>
      </View>
      <FiltreUnivers choix={filtre} onChange={setFiltre} libelles={libelles} />

      <ScrollView
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); }} tintColor={colors.culkoko} />}
      >
        {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} />}
        {probleme && <Text style={styles.message}>Impossible de charger tes envies pour l’instant. Tire vers le bas pour réessayer.</Text>}

        {!chargement && !probleme && visibles.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videTitre}>Rien en vue ?</Text>
            <Text style={styles.message}>Touche « Ça me tente » sur une activité de tes amis, ou ajoute une envie avec le bouton +.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/')} style={styles.boutonVide}>
              <Text style={styles.boutonVideTexte}>Voir ce que vivent mes amis</Text>
            </Pressable>
          </View>
        )}

        {visibles.map((e) => {
          const u = univers[e.oeuvre.univers];
          const r = rappel(e.oeuvre.univers, e.oeuvre.date_fin);
          const avec = amis.filter((a) => a.oeuvre_id === e.oeuvre_id).map((a) => a.pseudo);
          const sortie = e.oeuvre.univers !== 'livres';
          return (
            <Carte key={e.oeuvre_id} style={styles.carte}>
              <View style={styles.ligne}>
                {e.oeuvre.image_url ? (
                  <Image source={{ uri: e.oeuvre.image_url }} style={styles.vignette} />
                ) : (
                  <View style={[styles.vignette, { backgroundColor: u.couleur }]} />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  {r ? (
                    <Text style={[styles.alerte, r.urgent ? styles.alerteUrgente : styles.alerteDouce]}>{r.texte}</Text>
                  ) : null}
                  <Text style={styles.titreEnvie} numberOfLines={2}>{e.oeuvre.titre}</Text>
                  {e.oeuvre.createur ? <Text style={styles.petit} numberOfLines={1}>{e.oeuvre.createur}</Text> : null}
                  {e.pense ? <Text style={styles.petit}>{e.pense.pseudo} a pensé à toi 💌</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${e.oeuvre.titre} de mes envies`} onPress={() => retirer(e)} style={styles.retirer}>
                  <Text style={styles.retirerTexte}>×</Text>
                </Pressable>
              </View>

              {avec.length > 0 && (
                <View style={styles.amis}>
                  <View style={{ flexDirection: 'row' }}>
                    {avec.slice(0, 3).map((p, n) => (
                      <View key={p} style={[styles.miniAvatar, { marginLeft: n ? -8 : 0, backgroundColor: [univers.cine.teinte, univers.expos.teinte, univers.livres.teinte][n % 3] }]}>
                        <Text style={styles.miniInitiale}>{p.charAt(0).toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.petit, { flex: 1, color: colors.encre }]}>
                    {avec.length === 1 ? `${avec[0]} a aussi envie d’y aller` : `${avec.length} personnes que tu suis en ont aussi envie`}
                  </Text>
                </View>
              )}

              <View style={styles.boutons}>
                {sortie && (
                  <Pressable accessibilityRole="button" onPress={() => proposer(e, avec)} style={[styles.bouton, { backgroundColor: colors.culkoko }]}>
                    <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>On y va ensemble ?</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/enregistrer', params: { oeuvre: e.oeuvre_id } })}
                  style={[styles.bouton, sortie ? styles.boutonClair : { backgroundColor: colors.culkoko }]}
                >
                  <Text style={[styles.boutonTexte, { color: sortie ? colors.encre : '#FFFFFF' }]}>{actionVecue[e.oeuvre.univers]}</Text>
                </Pressable>
              </View>

              {message?.oeuvre === e.oeuvre_id && (
                <View style={styles.messagePret}>
                  <Text style={styles.petit}>Copie ce message et envoie-le à tes amis :</Text>
                  <Text selectable style={styles.messageTexte}>{message.texte}</Text>
                </View>
              )}
            </Carte>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 12 },
  ajouter: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  carte: { padding: 14, gap: 12 },
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  vignette: { width: 56, height: 76, borderRadius: 10 },
  alerte: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontFamily: fonts.texteGras, fontSize: 12, marginBottom: 2 },
  alerteUrgente: { backgroundColor: univers.concerts.teinte, color: univers.concerts.texteFonce },
  alerteDouce: { backgroundColor: colors.beige, color: colors.gris },
  titreEnvie: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  retirer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  retirerTexte: { fontFamily: fonts.texte, fontSize: 24, lineHeight: 26, color: colors.gris },
  amis: { backgroundColor: '#F7F2EA', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#F7F2EA', alignItems: 'center', justifyContent: 'center' },
  miniInitiale: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.encre },
  boutons: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  boutonClair: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
  messagePret: { backgroundColor: colors.beige, borderRadius: 12, padding: 12, gap: 6 },
  messageTexte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
  boutonVide: { marginTop: 6, height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonVideTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
});
