// Le carnet d'une autre personne : son année, ses activités visibles, et le bouton Suivre.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Carte } from '../../components/Base';
import { raisonsSignalement, signaler } from '../../lib/commentaires';
import { bloquer, debloquer, jAiBloque } from '../../lib/profil';
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
  const [menu, setMenu] = useState<'ferme' | 'ouvert' | 'bloquer' | 'signaler' | 'merci'>('ferme');
  const [bloque, setBloque] = useState(false);

  const charger = useCallback(async () => {
    if (!id || !moi) return;
    try {
      const [p, a, an, c, s] = await Promise.all([lireProfil(id), lireFil('decouvrir', moi, id), compterAnnee(id), compterAbonnes(id), jeSuis(moi, id)]);
      setProfil(p);
      setActivites(a);
      setAnnee(an);
      setCompteurs(c);
      setSuivi(s);
      jAiBloque(moi, id).then(setBloque, () => setBloque(false));
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
      <View style={[styles.entete, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={retour} style={styles.rond44}>
          <Text style={styles.fleche}>‹</Text>
        </Pressable>
        {profil && id !== moi ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Options pour ${profil.pseudo}`} accessibilityState={{ expanded: menu !== 'ferme' }} onPress={() => setMenu(menu === 'ferme' ? 'ouvert' : 'ferme')} style={styles.rond44}>
            <Text style={styles.fleche}>⋯</Text>
          </Pressable>
        ) : null}
      </View>
      {profil && menu !== 'ferme' ? (
        <View style={styles.menu}>
          {menu === 'ouvert' ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => setMenu('signaler')} style={styles.menuLigne}>
                <Text style={styles.menuTexte}>Signaler {profil.pseudo}</Text>
              </Pressable>
              {bloque ? (
                <Pressable accessibilityRole="button" onPress={async () => { await debloquer(moi, id!); setBloque(false); setMenu('ferme'); charger(); }} style={styles.menuLigne}>
                  <Text style={styles.menuTexte}>Débloquer {profil.pseudo}</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setMenu('bloquer')} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: '#7A1B29' }]}>Bloquer {profil.pseudo}</Text>
                </Pressable>
              )}
            </>
          ) : null}
          {menu === 'bloquer' ? (
            <>
              <Text style={styles.texte}>Bloquer {profil.pseudo} ?</Text>
              <Text style={styles.petit}>Vous ne vous suivrez plus, et vous ne verrez plus les activités ni les commentaires l’un de l’autre. {profil.pseudo} ne sera pas prévenu·e.</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable accessibilityRole="button" onPress={async () => { await bloquer(moi, id!); setBloque(true); setSuivi(false); setMenu('ferme'); }} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: '#7A1B29' }]}>Oui, bloquer</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setMenu('ferme')} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: colors.gris }]}>Annuler</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {menu === 'signaler' ? (
            <>
              <Text style={styles.petit}>Pourquoi signales-tu {profil.pseudo} ?</Text>
              {raisonsSignalement.map((r) => (
                <Pressable key={r} accessibilityRole="button" onPress={() => signaler(moi, { profil: id }, r).finally(() => setMenu('merci'))} style={styles.menuLigne}>
                  <Text style={styles.menuTexte}>{r}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {menu === 'merci' ? <Text style={styles.petit}>Merci, on va regarder. Tu peux aussi bloquer cette personne.</Text> : null}
        </View>
      ) : null}
      {chargement ? (
        <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />
      ) : !profil ? (
        <Text style={styles.message}>Ce carnet n’existe pas, ou n’est plus disponible.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.profil}>
            {profil.photo_url ? (
              <Avatar initiale={profil.pseudo.charAt(0).toUpperCase()} fond={univers[premierUnivers].teinte} taille={72} photo={profil.photo_url} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: univers[premierUnivers].teinte }]}>
                <Text style={styles.initiale}>{profil.pseudo.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={styles.pseudo}>{profil.pseudo}</Text>
              <Text style={styles.petit}>
                <Text style={styles.chiffre}>{compteurs.abonnes}</Text> abonné{compteurs.abonnes > 1 ? 's' : ''} · <Text style={styles.chiffre}>{compteurs.abonnements}</Text> abonnement{compteurs.abonnements > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          {profil.bio ? <Text style={styles.texte}>{profil.bio}</Text> : null}

          {id !== moi && bloque ? <Text style={styles.petit}>Tu as bloqué {profil.pseudo}.</Text> : null}
          {id !== moi && !bloque && (
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
  menu: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.carte, borderRadius: 16, padding: 12, gap: 4 },
  menuLigne: { minHeight: 44, justifyContent: 'center' },
  menuTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
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
