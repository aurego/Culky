// Le profil d'une autre personne : la même vitrine que « Mon carnet › Profil »,
// avec le bouton Suivre et, dans ⋯, Signaler et Bloquer.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../../components/EnTete';
import { Vitrine } from '../../components/Vitrine';
import { raisonsSignalement, signaler } from '../../lib/commentaires';
import { etatSuivi, lireProfil, suivre, type EtatSuivi } from '../../lib/fil';
import { bloquer, debloquer, jAiBloque } from '../../lib/profil';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../theme';

export default function Profil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [pseudo, setPseudo] = useState('');
  // Suivre se demande : « Suivre » → « Demande envoyée » → « Abonné·e ✓ » quand la personne accepte.
  const [suivi, setSuivi] = useState<EtatSuivi>('aucun');
  const [confirmer, setConfirmer] = useState(false); // annuler ma demande, ou ne plus suivre
  const [bloque, setBloque] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [menu, setMenu] = useState<'ferme' | 'ouvert' | 'bloquer' | 'signaler' | 'merci' | 'erreur'>('ferme');
  const [version, setVersion] = useState(0); // pour recharger la vitrine (abonnés) après un changement

  useEffect(() => {
    if (!id || !moi) return;
    lireProfil(id).then((p) => setPseudo(p?.pseudo ?? ''), () => undefined);
    etatSuivi(moi, id).then(setSuivi, () => undefined);
    jAiBloque(moi, id).then(setBloque, () => undefined);
  }, [id, moi]);

  async function changerSuivi(oui: boolean) {
    if (!id || enCours) return;
    setEnCours(true);
    setConfirmer(false);
    const avant = suivi;
    setSuivi(oui ? 'en_attente' : 'aucun');
    try {
      setSuivi(await suivre(moi, id, oui));
      setVersion((v) => v + 1);
    } catch {
      setSuivi(avant);
    } finally {
      setEnCours(false);
    }
  }

  // Un toucher sur « Demande envoyée » ou « Abonné·e ✓ » demande d'abord confirmation.
  function toucherSuivi() {
    if (suivi === 'aucun') changerSuivi(true);
    else setConfirmer(true);
  }

  const autre = id && id !== moi;

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage
        droite={
          autre ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Options pour ${pseudo}`} accessibilityState={{ expanded: menu !== 'ferme' }} onPress={() => setMenu(menu === 'ferme' ? 'ouvert' : 'ferme')} style={styles.rond44}>
              <Text style={styles.points}>⋯</Text>
            </Pressable>
          ) : null
        }
      />
      {autre && menu !== 'ferme' ? (
        <View style={styles.menu}>
          {menu === 'ouvert' ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => setMenu('signaler')} style={styles.menuLigne}>
                <Text style={styles.menuTexte}>Signaler {pseudo}</Text>
              </Pressable>
              {bloque ? (
                <Pressable accessibilityRole="button" onPress={async () => { try { await debloquer(moi, id!); } catch { return setMenu('erreur'); } setBloque(false); setMenu('ferme'); setVersion((v) => v + 1); }} style={styles.menuLigne}>
                  <Text style={styles.menuTexte}>Débloquer {pseudo}</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setMenu('bloquer')} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: '#9B2335' }]}>Bloquer {pseudo}</Text>
                </Pressable>
              )}
            </>
          ) : null}
          {menu === 'bloquer' ? (
            <>
              <Text style={styles.texte}>Bloquer {pseudo} ?</Text>
              <Text style={styles.petit}>Vous ne vous suivrez plus, et vous ne verrez plus les activités ni les commentaires l’un de l’autre. {pseudo} ne sera pas prévenu·e.</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable accessibilityRole="button" onPress={async () => { try { await bloquer(moi, id!); } catch { return setMenu('erreur'); } setBloque(true); setSuivi('aucun'); setMenu('ferme'); setVersion((v) => v + 1); }} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: '#9B2335' }]}>Oui, bloquer</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setMenu('ferme')} style={styles.menuLigne}>
                  <Text style={[styles.menuTexte, { color: colors.gris }]}>Annuler</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {menu === 'signaler' ? (
            <>
              <Text style={styles.petit}>Pourquoi signales-tu {pseudo} ?</Text>
              {raisonsSignalement.map((r) => (
                <Pressable key={r} accessibilityRole="button" onPress={() => signaler(moi, { profil: id }, r).then(() => setMenu('merci'), () => setMenu('erreur'))} style={styles.menuLigne}>
                  <Text style={styles.menuTexte}>{r}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {menu === 'erreur' ? <Text style={styles.petit}>Oups, ça n’a pas marché. Réessaie dans un instant.</Text> : null}
          {menu === 'merci' ? <Text style={styles.petit}>Merci, on va regarder. Tu peux aussi bloquer cette personne.</Text> : null}
        </View>
      ) : null}
      {id ? (
        <Vitrine
          id={id}
          moi={moi}
          recharger={version}
          actions={
            bloque ? (
              <Text style={styles.petit}>Tu as bloqué {pseudo}.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: suivi !== 'aucun' }} onPress={toucherSuivi} style={[styles.suivre, suivi !== 'aucun' ? styles.suivreActif : styles.suivreInactif]}>
                  <Text style={[styles.suivreTexte, { color: suivi !== 'aucun' ? colors.encre : '#FFFFFF' }]}>
                    {suivi === 'accepte' ? 'Abonné·e ✓' : suivi === 'en_attente' ? 'Demande envoyée' : `Suivre ${pseudo}`}
                  </Text>
                </Pressable>
                {suivi === 'en_attente' && !confirmer ? <Text style={styles.petit}>{pseudo} va recevoir ta demande. Dès qu’elle sera acceptée, tu verras ses activités réservées à ses abonnés.</Text> : null}
                {confirmer ? (
                  <View style={styles.confirmation}>
                    <Text style={styles.texte}>{suivi === 'en_attente' ? 'Annuler ta demande\u202f?' : `Ne plus suivre ${pseudo}\u202f?`}</Text>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Pressable accessibilityRole="button" onPress={() => changerSuivi(false)} style={styles.menuLigne}>
                        <Text style={[styles.menuTexte, { color: '#9B2335' }]}>{suivi === 'en_attente' ? 'Oui, annuler' : 'Oui, ne plus suivre'}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => setConfirmer(false)} style={styles.menuLigne}>
                        <Text style={[styles.menuTexte, { color: colors.gris }]}>{suivi === 'en_attente' ? 'Garder ma demande' : 'Rester abonné·e'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            )
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  points: { fontFamily: fonts.texteGras, fontSize: 24, color: colors.encre },
  menu: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.carte, borderRadius: 16, padding: 12, gap: 4 },
  menuLigne: { minHeight: 44, justifyContent: 'center' },
  menuTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris },
  suivre: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  suivreActif: { backgroundColor: colors.carte, borderWidth: 1.5, borderColor: colors.bordure },
  suivreInactif: { backgroundColor: colors.culkoko },
  suivreTexte: { fontFamily: fonts.texteGras, fontSize: 15 },
  confirmation: { backgroundColor: colors.carte, borderRadius: 16, padding: 12, gap: 2 },
});
