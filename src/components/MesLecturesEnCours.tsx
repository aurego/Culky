// En haut du fil : mes livres en cours, avec un accès direct à « Où j'en suis · laisser un mot »,
// et le nombre de mots d'amis qui m'attendent plus loin dans le livre.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers } from '../theme';

type EnCours = { id: string; oeuvre_id: string; oeuvre: { titre: string }; attente?: number };

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
        .then(async ({ data }) => {
          const liste = ((data ?? []) as unknown as EnCours[]).filter((l) => l.oeuvre);
          setLivres(liste);
          // Les mots que mes amis ont glissés plus loin dans le livre : de quoi donner envie d'avancer.
          const comptes = await Promise.all(
            liste.map((l) =>
              supabase!
                .rpc('mots_du_livre', { o: l.oeuvre_id })
                .then(({ data: mots }) => ((mots ?? []) as { debloque: boolean }[]).filter((m) => !m.debloque).length, () => 0),
            ),
          );
          setLivres(liste.map((l, i) => ({ ...l, attente: comptes[i] })));
        }, () => undefined);
    }, [moi]),
  );
  if (!livres.length) return null;
  const u = univers.livres;
  return (
    <View style={[styles.carte, { backgroundColor: u.teinte }]}>
      <Text style={[styles.titre, { color: u.texteFonce }]}>{livres.length > 1 ? 'Mes lectures en cours' : 'Ma lecture en cours'}</Text>
      <Text style={styles.aide}>Note ta page et glisse-y un mot : tes amis qui lisent ce livre le découvriront en arrivant à cette page.</Text>
      {livres.map((l) => (
        <Pressable
          key={l.id}
          accessibilityRole="button"
          accessibilityLabel={`Où j’en suis dans ${l.oeuvre.titre}, laisser un mot${l.attente ? `, ${l.attente} mot${l.attente > 1 ? 's' : ''} d’amis plus loin` : ''}`}
          onPress={() => router.push({ pathname: '/marque-page', params: { activite: l.id, oeuvre: l.oeuvre_id, titre: l.oeuvre.titre } })}
          style={styles.ligne}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.livre} numberOfLines={1}>📖 {l.oeuvre.titre}</Text>
            {l.attente ? (
              <Text style={[styles.attente, { color: u.texteFonce }]}>
                💌 {l.attente} mot{l.attente > 1 ? 's' : ''} d’ami{l.attente > 1 ? 's' : ''} t’attend{l.attente > 1 ? 'ent' : ''} plus loin
              </Text>
            ) : null}
          </View>
          <View style={[styles.pastille, { borderColor: u.texteFonce }]}>
            <Text style={[styles.action, { color: u.texteFonce }]} numberOfLines={1}>Ma page ›</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  titre: { fontFamily: fonts.titre, fontSize: 15, marginTop: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  aide: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris, marginTop: 2 },
  attente: { fontFamily: fonts.texteMoyen, fontSize: 13, marginTop: 2 },
  livre: { fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.encre },
  action: { fontFamily: fonts.texteGras, fontSize: 13 },
  pastille: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0 },
});
