// Onglet Accueil : « Que vivent les autres ? »
// Abonnements = tes activités et celles des personnes que tu suis ; Découvrir = toute la communauté.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FiltreUnivers, Logo } from '../../components/Base';
import { CarteActivite } from '../../components/CarteActivite';
import { EnTeteOnglet } from '../../components/EnTete';
import { PremiersPas } from '../../components/PremiersPas';
import { lireFil, type ActiviteFil } from '../../lib/fil';
import { useSession } from '../../lib/session';
import { colors, fonts, type UniversId } from '../../theme';

export default function Accueil() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [onglet, setOnglet] = useState<'abonnements' | 'decouvrir'>('abonnements');
  const [filtre, setFiltre] = useState<UniversId | 'tout'>('tout');
  const [activites, setActivites] = useState<ActiviteFil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [probleme, setProbleme] = useState(false);

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      setActivites(await lireFil(onglet, moi));
      setProbleme(false);
    } catch (e) {
      console.warn('Fil :', e);
      setProbleme(true);
    } finally {
      setChargement(false);
      setRafraichit(false);
    }
  }, [moi, onglet]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  function changerOnglet(o: 'abonnements' | 'decouvrir') {
    if (o === onglet) return;
    setChargement(true);
    setActivites([]);
    setOnglet(o);
  }

  const visibles = activites.filter((a) => filtre === 'tout' || a.oeuvre.univers === filtre);
  const seulementMoi = visibles.every((a) => a.auteur_id === moi);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <EnTeteOnglet gauche={<Logo />} />
      <View style={styles.onglets}>
        {(['abonnements', 'decouvrir'] as const).map((o) => {
          const actif = onglet === o;
          return (
            <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => changerOnglet(o)} style={[styles.onglet, actif ? styles.ongletActif : styles.ongletInactif]}>
              <Text style={[styles.ongletTexte, { color: actif ? '#FFFFFF' : colors.encre, fontFamily: actif ? fonts.texteGras : fonts.texteMoyen }]}>
                {o === 'abonnements' ? 'Abonnements' : 'Découvrir'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FiltreUnivers choix={filtre} onChange={setFiltre} />

      <ScrollView
        contentContainerStyle={styles.fil}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); }} tintColor={colors.culkoko} />}
        keyboardShouldPersistTaps="handled"
      >
        {onglet === 'abonnements' && moi ? <PremiersPas moi={moi} /> : null}
        {onglet === 'decouvrir' && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/amis')} style={styles.recherche}>
            <Text style={styles.rechercheTexte}>Chercher un ami par son pseudo…</Text>
          </Pressable>
        )}

        {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} />}
        {probleme && <Text style={styles.message}>Impossible de charger le fil pour l’instant. Tire vers le bas pour réessayer.</Text>}

        {!chargement && visibles.map((a) => <CarteActivite key={a.id} a={a} moi={moi} />)}

        {!chargement && !probleme && onglet === 'abonnements' && seulementMoi && (
          <View style={styles.vide}>
            <Text style={styles.videTitre}>{visibles.length ? 'Ton fil t’attend' : 'Ton fil est encore calme'}</Text>
            <Text style={styles.message}>Suis des amis pour fêter leurs lectures et leurs sorties.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/amis')} style={styles.boutonSecondaire}>
              <Text style={styles.boutonSecondaireTexte}>Trouver des gens à suivre</Text>
            </Pressable>
          </View>
        )}
        {!chargement && !probleme && onglet === 'decouvrir' && visibles.length === 0 && (
          <Text style={styles.message}>Rien pour l’instant dans cet univers. Et si tu étais la première personne à y publier ?</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  cloche: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  badgeTexte: { fontFamily: fonts.texteGras, fontSize: 11, color: '#FFFFFF' },
  onglets: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  onglet: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.encre },
  ongletInactif: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  ongletTexte: { fontSize: 15 },
  fil: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
  boutonSecondaire: { marginTop: 6, height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonSecondaireTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
  recherche: { height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 18, justifyContent: 'center' },
  rechercheTexte: { fontFamily: fonts.texte, fontSize: 15, color: colors.gris },
  personne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.carte, borderRadius: 16, padding: 10 },
  voir: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
});
