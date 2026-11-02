// Le carnet d'une autre personne : son année, ses activités visibles, et le bouton Suivre.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Carte } from '../../components/Base';
import { CarteActivite } from '../../components/CarteActivite';
import { compterAnnee, nomPluriel } from '../../lib/activites';
import { compterAbonnes, jeSuis, lireFil, lireProfil, suivre, type ActiviteFil, type ProfilPublic } from '../../lib/fil';
import { useSession } from '../../lib/session';
import { colors, fonts, univers, universIds, type UniversId } from '../../theme';

export default function Profil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [profil, setProfil] = useState<ProfilPublic | null>(null);
  const [activites, setActivites] = useState<ActiviteFil[]>([]);
  const [annee, setAnnee] = useState<Record<UniversId, number> | null>(null);
  const [compteurs, setCompteurs] = useState({ abonnes: 0, abonnements: 0 });
  const [suivi, setSuivi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    if (!id || !moi) return;
    try {
      const [p, a, an, c, s] = await Promise.all([lireProfil(id), lireFil('decouvrir', moi, id), compterAnnee(id), compterAbonnes(id), jeSuis(moi, id)]);
      setProfil(p);
      setActivites(a);
      setAnnee(an);
      setCompteurs(c);
      setSuivi(s);
    } catch (e) {
      console.warn('Profil :', e);
    } finally {
      setChargement(false);
    }
  }, [id, moi]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  async function basculerSuivi() {
    if (!id || enCours) return;
    setEnCours(true);
    const nouveau = !suivi;
    setSuivi(nouveau);
    setCompteurs((c) => ({ ...c, abonnes: c.abonnes + (nouveau ? 1 : -1) }));
    try {
      await suivre(moi, id, nouveau);
    } catch {
      setSuivi(!nouveau);
      setCompteurs((c) => ({ ...c, abonnes: c.abonnes + (nouveau ? -1 : 1) }));
    } finally {
      setEnCours(false);
    }
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const premierUnivers = profil?.univers_choisis?.[0] ?? 'livres';

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.entete}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={retour} style={styles.rond44}>
          <Text style={styles.fleche}>‹</Text>
        </Pressable>
      </View>
      {chargement ? (
        <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />
      ) : !profil ? (
        <Text style={styles.message}>Ce carnet n’existe pas, ou n’est plus disponible.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.profil}>
            <View style={[styles.avatar, { backgroundColor: univers[premierUnivers].teinte }]}>
              <Text style={styles.initiale}>{profil.pseudo.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={styles.pseudo}>{profil.pseudo}</Text>
              <Text style={styles.petit}>
                <Text style={styles.chiffre}>{compteurs.abonnes}</Text> abonné{compteurs.abonnes > 1 ? 's' : ''} · <Text style={styles.chiffre}>{compteurs.abonnements}</Text> abonnement{compteurs.abonnements > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          {profil.bio ? <Text style={styles.texte}>{profil.bio}</Text> : null}

          {id !== moi && (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: suivi }} onPress={basculerSuivi} style={[styles.suivre, suivi ? styles.suivreActif : styles.suivreInactif]}>
              <Text style={[styles.suivreTexte, { color: suivi ? colors.encre : '#FFFFFF' }]}>{suivi ? 'Abonné·e ✓' : `Suivre ${profil.pseudo}`}</Text>
            </Pressable>
          )}

          {annee && (
            <Carte style={{ padding: 16 }}>
              <Text style={[styles.sousTitre, { marginBottom: 12 }]}>Son année {new Date().getFullYear()}</Text>
              <View style={styles.compteurs}>
                {universIds
                  .filter((u) => profil.univers_choisis?.includes(u) || annee[u] > 0)
                  .map((u) => (
                    <View key={u} style={[styles.compteur, { backgroundColor: univers[u].teinte }]}>
                      <Text style={styles.compteurChiffre}>{annee[u]}</Text>
                      <Text style={styles.compteurNom}>{nomPluriel(u, annee[u])}</Text>
                    </View>
                  ))}
              </View>
            </Carte>
          )}

          <Text style={styles.sousTitre}>Ses dernières activités</Text>
          {activites.length === 0 && <Text style={styles.message}>Rien de public pour l’instant.</Text>}
          {activites.map((a) => (
            <CarteActivite key={a.id} a={a} moi={moi} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 12, paddingTop: 10 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 30, lineHeight: 32, color: colors.encre },
  page: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  profil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  initiale: { fontFamily: fonts.titreGras, fontSize: 28, color: colors.encre },
  pseudo: { fontFamily: fonts.titre, fontSize: 22, color: colors.encre },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  chiffre: { fontFamily: fonts.texteGras, color: colors.encre },
  message: { fontFamily: fonts.texte, fontSize: 14, color: colors.gris, textAlign: 'center', marginTop: 8 },
  suivre: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  suivreActif: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  suivreInactif: { backgroundColor: colors.culkoko },
  suivreTexte: { fontFamily: fonts.texteGras, fontSize: 15 },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre },
  compteurs: { flexDirection: 'row', gap: 8 },
  compteur: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  compteurChiffre: { fontFamily: fonts.titreGras, fontSize: 22, color: colors.encre },
  compteurNom: { fontFamily: fonts.texte, fontSize: 12, color: colors.encre },
});
