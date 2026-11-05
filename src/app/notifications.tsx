// L'écran derrière la cloche : les notifications, regroupées, de la plus récente à la plus ancienne.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../components/EnTete';
import { ErreurChargement, EtatVide } from '../components/EtatVide';
import { IconeCulkoko, IconePensee } from '../components/Icones';
import { quandActivite } from '../lib/dates';
import { accepterDemande, demandesRecues, retirerAbonne } from '../lib/fil';
import { lireNotifications, marquerToutLu, preparerRappels, regrouper, type LigneNotif } from '../lib/notifications';
import { useSession } from '../lib/session';
import { colors, fonts } from '../theme';

const pictos: Record<string, string> = {
  abonne: '👋',
  demande_abonnement: '👋',
  demande_acceptee: '🤝',
  merci: '🙏',
  commentaire: '💬',
  commentaire_suite: '💬',
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
  // Les demandes d'abonnement encore en attente (on peut y répondre directement dans la ligne).
  const [enAttente, setEnAttente] = useState<Set<string>>(new Set());
  const [reponses, setReponses] = useState<Record<string, 'acceptee' | 'refusee' | 'erreur'>>({});

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      await preparerRappels().catch(() => undefined);
      const [notifs, demandes] = await Promise.all([lireNotifications(moi), demandesRecues(moi).catch(() => [])]);
      setLignes(regrouper(notifs));
      setEnAttente(new Set(demandes.map((p) => p.id)));
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

  async function repondre(qui: string, accepter: boolean) {
    try {
      if (accepter) await accepterDemande(moi, qui);
      else await retirerAbonne(moi, qui);
      setReponses((r) => ({ ...r, [qui]: accepter ? 'acceptee' : 'refusee' }));
      setEnAttente((e) => {
        const n = new Set(e);
        n.delete(qui);
        return n;
      });
    } catch {
      setReponses((r) => ({ ...r, [qui]: 'erreur' }));
    }
  }

  function ouvrir(l: LigneNotif) {
    const n = l.notifs[0];
    if ((n.type === 'abonne' || n.type === 'invitation_acceptee' || n.type === 'demande_abonnement' || n.type === 'demande_acceptee') && n.acteur_id) return router.push({ pathname: '/profil/[id]', params: { id: n.acteur_id } });
    if (n.type === 'merci' || n.type === 'boucle' || n.type === 'voyage') return router.push({ pathname: '/pour-toi', params: { vue: 'conseils' } });
    if (n.type === 'conseil') return router.push('/pour-toi');
    if (n.type.startsWith('sortie')) return router.push({ pathname: '/envies', params: { vue: 'sorties' } });
    if (n.type.startsWith('commentaire') && n.activite_id) return router.push({ pathname: '/activite/[id]', params: { id: n.activite_id } });
    if (n.type === 'culkoko' && n.activite_id) return router.push({ pathname: '/activite/[id]', params: { id: n.activite_id } });
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre="Notifications" onRetour={retour} />
      <ScrollView
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); }} tintColor={colors.culkoko} />}
      >
        {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} />}
        {probleme && <ErreurChargement texte="Impossible de charger tes notifications pour l’instant." onReessayer={() => { setChargement(true); charger(); }} />}
        {!chargement && !probleme && lignes.length === 0 && (
          <EtatVide
            couleur="expos"
            titre="Tout est calme"
            texte="Les Kulkokos, les commentaires, les conseils et les rappels de tes sorties arriveront ici."
            principal={{ texte: 'Trouver mes amis', onPress: () => router.push('/amis') }}
          />
        )}
        {lignes.map((l) => {
          const n = l.notifs[0];
          return (
            <Pressable key={l.cle} accessibilityRole="button" onPress={() => ouvrir(l)} style={[styles.ligne, !l.lue && styles.nonLue]}>
              <View style={[styles.picto, !l.lue && { backgroundColor: colors.carte }]}>
                {n.type === 'culkoko' ? (
                  <IconeCulkoko taille={24} interieur={l.lue ? colors.beige : colors.carte} />
                ) : n.type === 'conseil' || n.type === 'voyage' ? (
                  <IconePensee taille={24} couleur={colors.encre} />
                ) : (
                  <Text style={styles.pictoTexte}>{pictos[n.type] ?? '✨'}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.texte, !l.lue && { fontFamily: fonts.texteGras }]}>{l.texte}</Text>
                <Text style={styles.petit}>{quandActivite(l.date.slice(0, 10), l.date)}</Text>
                {n.type === 'demande_abonnement' && n.acteur_id ? (
                  enAttente.has(n.acteur_id) ? (
                    <View style={styles.reponses}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Accepter la demande de ${n.acteur?.pseudo ?? 'cette personne'}`} onPress={() => repondre(n.acteur_id!, true)} style={[styles.reponse, styles.reponseOui]}>
                        <Text style={[styles.reponseTexte, { color: '#FFFFFF' }]}>Accepter</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Refuser la demande de ${n.acteur?.pseudo ?? 'cette personne'}`} onPress={() => repondre(n.acteur_id!, false)} style={styles.reponse}>
                        <Text style={[styles.reponseTexte, { color: colors.gris }]}>Refuser</Text>
                      </Pressable>
                    </View>
                  ) : reponses[n.acteur_id] === 'acceptee' ? (
                    <Text style={styles.repondu}>Demande acceptée ✓</Text>
                  ) : reponses[n.acteur_id] === 'refusee' ? (
                    <Text style={styles.petit}>Demande refusée</Text>
                  ) : reponses[n.acteur_id] === 'erreur' ? (
                    <Text style={styles.petit}>Oups, ça n’a pas marché. Réessaie dans un instant.</Text>
                  ) : null
                ) : null}
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
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.carte },
  nonLue: { backgroundColor: '#FDE6E0' },
  picto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.beige, alignItems: 'center', justifyContent: 'center' },
  pictoTexte: { fontSize: 20 },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  reponses: { flexDirection: 'row', gap: 8, marginTop: 6 },
  reponse: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, justifyContent: 'center' },
  reponseOui: { backgroundColor: colors.sousTitre, borderColor: colors.sousTitre },
  reponseTexte: { fontFamily: fonts.texteGras, fontSize: 13 },
  repondu: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.sousTitre, marginTop: 4 },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.culkoko },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, marginTop: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko },
});
