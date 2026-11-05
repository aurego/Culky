// « Mes chouchous » : je choisis, d'un toucher, jusqu'à 6 œuvres de mon journal à mettre en avant sur mon profil.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FiltreUnivers } from '../components/Base';
import { EnTetePage } from '../components/EnTete';
import { lireChouchous } from '../components/Vitrine';
import { lireJournal, type EntreeJournal } from '../lib/activites';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers, type UniversId, categorieDe, type CategorieId } from '../theme';

const MAX = 6;

export default function Chouchous() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [oeuvres, setOeuvres] = useState<EntreeJournal[] | null>(null);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [filtre, setFiltre] = useState<CategorieId | 'tout'>('tout');
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!moi) return;
      Promise.all([lireJournal(moi, 300), lireChouchous(moi)])
        .then(([j, c]) => {
          // Une seule fois par œuvre (on a pu relire un livre ou revoir un film).
          const vues = new Set<string>();
          setOeuvres(j.filter((e) => e.etat === 'fini' && !vues.has(e.oeuvre_id) && (vues.add(e.oeuvre_id), true)));
          setChoisis(new Set(c.map((x) => x.id)));
        })
        .catch(() => setOeuvres([]));
    }, [moi]),
  );

  async function basculer(e: EntreeJournal) {
    if (!supabase) return;
    setMessage(null);
    const oui = !choisis.has(e.id);
    if (oui && choisis.size >= MAX) return setMessage(`Tu as déjà ${MAX} chouchous : touche-en un pour le retirer, puis choisis le nouveau.`);
    const avant = choisis;
    const apres = new Set(choisis);
    if (oui) apres.add(e.id);
    else apres.delete(e.id);
    setChoisis(apres);
    const { error } = await supabase.from('activites').update({ chouchou: oui }).eq('id', e.id);
    if (error) {
      setChoisis(avant);
      setMessage('Oups, ça n’a pas marché. Réessaie dans un instant.');
    }
  }

  const visibles = (oeuvres ?? []).filter((e) => filtre === 'tout' || categorieDe(e.oeuvre) === filtre);

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre="Mes chouchous" />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.intro}>
          Touche les œuvres que tu adores pour les mettre en avant sur ton profil. <Text style={styles.compte}>{choisis.size}/{MAX}</Text>
        </Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <FiltreUnivers choix={filtre} onChange={setFiltre} />
        {oeuvres === null ? (
          <ActivityIndicator color={colors.culkoko} style={{ marginTop: 32 }} />
        ) : visibles.length === 0 ? (
          <Text style={styles.petit}>{oeuvres.length ? 'Rien dans cet univers pour l’instant.' : 'Enregistre d’abord ce que tu as lu, vu ou visité : tu pourras ensuite choisir tes chouchous ici.'}</Text>
        ) : (
          <View style={styles.grille}>
            {visibles.map((e) => {
              const u = univers[e.oeuvre.univers];
              const oui = choisis.has(e.id);
              return (
                <Pressable
                  key={e.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: oui }}
                  accessibilityLabel={e.oeuvre.titre}
                  onPress={() => basculer(e)}
                  style={styles.case}
                >
                  <View>
                    {e.oeuvre.image_url ? (
                      <Image source={{ uri: e.oeuvre.image_url }} style={[styles.couverture, oui && { borderColor: u.couleur }]} />
                    ) : (
                      <View style={[styles.couverture, { backgroundColor: u.teinte }, oui && { borderColor: u.couleur }]} />
                    )}
                    <View style={[styles.coche, oui ? { backgroundColor: u.couleur, borderColor: u.couleur } : null]}>
                      {oui ? <Text style={styles.cocheTexte}>✓</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.titre} numberOfLines={2}>{e.oeuvre.titre}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
  petit: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  case: { width: '30%', gap: 6 },
  couverture: { width: '100%', aspectRatio: 0.7, borderRadius: 10, borderWidth: 3, borderColor: 'transparent' },
  coche: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(31,27,36,0.25)', alignItems: 'center', justifyContent: 'center' },
  cocheTexte: { color: '#FFFFFF', fontFamily: fonts.texteGras, fontSize: 14 },
  titre: { fontFamily: fonts.texteMoyen, fontSize: 12, lineHeight: 16, color: colors.encre },
});
