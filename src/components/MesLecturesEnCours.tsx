// En haut du fil : mes livres en cours, avec un accès direct à « Où j'en suis · laisser un mot ».
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers } from '../theme';

type EnCours = { id: string; oeuvre_id: string; oeuvre: { titre: string } };

export function MesLecturesEnCours({ moi }: { moi: string }) {
  const [livres, setLivres] = useState<EnCours[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!moi || !supabase) return;
      supabase
        .from('activites')
        .select('id, oeuvre_id, oeuvre:oeuvres(titre)')
        .eq('auteur_id', moi)
        .eq('etat', 'commence')
        .order('date_activite', { ascending: false })
        .limit(3)
        .then(({ data }) => setLivres(((data ?? []) as unknown as EnCours[]).filter((l) => l.oeuvre)), () => undefined);
    }, [moi]),
  );
  if (!livres.length) return null;
  const u = univers.livres;
  return (
    <View style={[styles.carte, { backgroundColor: u.teinte }]}>
      <Text style={[styles.titre, { color: u.texteFonce }]}>{livres.length > 1 ? 'Mes lectures en cours' : 'Ma lecture en cours'}</Text>
      {livres.map((l) => (
        <Pressable
          key={l.id}
          accessibilityRole="button"
          accessibilityLabel={`Où j’en suis dans ${l.oeuvre.titre}`}
          onPress={() => router.push({ pathname: '/marque-page', params: { activite: l.id, oeuvre: l.oeuvre_id, titre: l.oeuvre.titre } })}
          style={styles.ligne}
        >
          <Text style={styles.livre} numberOfLines={1}>📖 {l.oeuvre.titre}</Text>
          <Text style={[styles.action, { color: u.texteFonce }]}>Où j’en suis ›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  titre: { fontFamily: fonts.titre, fontSize: 15, marginTop: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  livre: { flex: 1, fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.encre },
  action: { fontFamily: fonts.texteGras, fontSize: 13 },
});
