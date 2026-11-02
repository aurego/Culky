// L'écran derrière la cloche : les notifications, regroupées, de la plus récente à la plus ancienne.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconeCulkoko, IconePensee } from '../components/Icones';
import { quandActivite } from '../lib/dates';
import { lireNotifications, marquerToutLu, preparerRappels, regrouper, type LigneNotif } from '../lib/notifications';
import { useSession } from '../lib/session';
import { colors, fonts } from '../theme';

const pictos: Record<string, string> = {
  abonne: '👋',
  merci: '🙏',
  invitation_acceptee: '🎉',
  boucle: '🎯',
  sortie_invitation: '📅',
  sortie_reponse: '📅',
  sortie_veille: '⏰',
  sortie_jour: '⏰',
};

export default function Notifications() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [lignes, setLignes] = useState<LigneNotif[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [probleme, setProbleme] = useState(false);

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      await preparerRappels().catch(() => undefined);
      setLignes(regrouper(await lireNotifications(moi)));
      setProbleme(false);
      // On les affiche d'abord comme « nouvelles », puis on les marque lues pour la prochaine fois.
      marquerToutLu(moi).catch(() => undefined);
    } catch (e) {
      console.warn('Notifications :', e);
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

  function ouvrir(l: LigneNotif) {
    const n = l.notifs[0];
    if ((n.type === 'abonne' || n.type === 'invitation_acceptee') && n.acteur_id) return router.push({ pathname: '/profil/[id]', params: { id: n.acteur_id } });
    if (n.type === 'merci' || n.type === 'boucle' || n.type === 'voyage') return router.push({ pathname: '/pour-toi', params: { vue: 'conseils' } });
    if (n.type === 'conseil') return router.push('/pour-toi');
    if (n.type.startsWith('sortie')) return router.push({ pathname: '/envies', params: { vue: 'sorties' } });
    if (n.type === 'culkoko') return router.push('/carnet');
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.entete}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={retour} style={styles.rond44}>
          <Text style={styles.fleche}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.titre}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); }} tintColor={colors.culkoko} />}
      >
        {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} />}
        {probleme && <Text style={styles.message}>Impossible de charger tes notifications pour l’instant.</Text>}
        {!chargement && !probleme && lignes.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videTitre}>Tout est calme</Text>
            <Text style={styles.message}>Les Culkoko, les conseils et les rappels de tes sorties arriveront ici.</Text>
          </View>
        )}
        {lignes.map((l) => {
          const n = l.notifs[0];
          return (
            <Pressable key={l.cle} accessibilityRole="button" onPress={() => ouvrir(l)} style={[styles.ligne, !l.lue && styles.nonLue]}>
              <View style={[styles.picto, !l.lue && { backgroundColor: colors.carte }]}>
                {n.type === 'culkoko' ? (
                  <IconeCulkoko taille={24} />
                ) : n.type === 'conseil' || n.type === 'voyage' ? (
                  <IconePensee taille={24} couleur={colors.encre} />
                ) : (
                  <Text style={styles.pictoTexte}>{pictos[n.type] ?? '✨'}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.texte, !l.lue && { fontFamily: fonts.texteGras }]}>{l.texte}</Text>
                <Text style={styles.petit}>{quandActivite(l.date.slice(0, 10), l.date)}</Text>
              </View>
              {!l.lue && <View style={styles.point} accessibilityLabel="Nouvelle" />}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.encre },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.carte },
  nonLue: { backgroundColor: '#FBE9EC' },
  picto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.beige, alignItems: 'center', justifyContent: 'center' },
  pictoTexte: { fontSize: 20 },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.culkoko },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, marginTop: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
});
