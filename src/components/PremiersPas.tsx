// « Mes premiers pas » : 3 gestes pour bien démarrer, cochés au fur et à mesure.
// La carte disparaît quand tout est fait, ou si on la masque.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers, universIds } from '../theme';

const CLE_MASQUE = 'culky-premiers-pas-masques';
export const CLE_INVITE = 'culky-premiers-pas-invitation'; // écrite quand on partage son lien depuis Mes amis

type Etat = { activites: number; suivis: number; abonnes: number; invite: boolean; masque: boolean };

export function PremiersPas({ moi }: { moi: string }) {
  const [etat, setEtat] = useState<Etat | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!moi || !supabase) return;
      (async () => {
        const [a, s, b, masque, invite] = await Promise.all([
          supabase!.from('activites').select('id', { count: 'exact', head: true }).eq('auteur_id', moi),
          supabase!.from('abonnements').select('suivi_id', { count: 'exact', head: true }).eq('abonne_id', moi),
          supabase!.from('abonnements').select('abonne_id', { count: 'exact', head: true }).eq('suivi_id', moi).eq('statut', 'accepte'),
          AsyncStorage.getItem(CLE_MASQUE).catch(() => null),
          AsyncStorage.getItem(CLE_INVITE).catch(() => null),
        ]);
        setEtat({ activites: a.count ?? 0, suivis: s.count ?? 0, abonnes: b.count ?? 0, invite: !!invite, masque: !!masque });
      })().catch(() => undefined);
    }, [moi]),
  );

  if (!etat || etat.masque) return null;

  const pas = [
    { fait: etat.activites >= 1, texte: 'Enregistre un livre, un film ou une sortie', onPress: () => router.push('/enregistrer'), encore: true },
    { fait: etat.activites >= 3, texte: 'Ajoute ce que tu as vécu depuis janvier', onPress: () => router.push({ pathname: '/enregistrer', params: { mode: 'passe' } }), encore: true },
    { fait: etat.suivis >= 1 || etat.invite || etat.abonnes >= 1, texte: 'Retrouve ou invite tes amis', onPress: () => router.push('/amis') },
  ];
  const faits = pas.filter((p) => p.fait).length;
  if (faits === pas.length) return null;

  return (
    <View style={styles.carte}>
      <View style={styles.haut}>
        <Text style={styles.titre}>Mes premiers pas</Text>
        <Text style={styles.compte}>{faits}/{pas.length}</Text>
      </View>
      {pas.map((p, i) => {
        // Chaque pas prend une des couleurs du logo : turquoise, corail, jaune, vert.
        const u = univers[universIds[i % universIds.length]];
        return (
        // Les pas d'enregistrement restent ouverts même cochés : on peut continuer à compléter son carnet et son année.
        <Pressable key={p.texte} accessibilityRole="button" accessibilityState={{ checked: p.fait }} disabled={p.fait && !p.encore} onPress={p.onPress} style={styles.ligne}>
          <View style={[styles.rond, { borderColor: u.couleur, backgroundColor: p.fait ? u.couleur : u.teinte }]}>{p.fait ? <Text style={styles.coche}>✓</Text> : null}</View>
          <Text style={[styles.texte, p.fait && !p.encore && styles.texteFait]}>{p.texte}</Text>
          {p.fait && p.encore ? <Text style={[styles.continuer, { color: u.texteFonce }]}>Continuer ›</Text> : !p.fait ? <Text style={styles.fleche}>›</Text> : null}
        </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          await AsyncStorage.setItem(CLE_MASQUE, '1').catch(() => undefined);
          setEtat((e) => (e ? { ...e, masque: true } : e));
        }}
        style={styles.masquer}
      >
        <Text style={styles.masquerTexte}>Masquer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  continuer: { fontFamily: fonts.texteGras, fontSize: 13 },
  carte: { backgroundColor: colors.carte, borderRadius: 20, padding: 16, gap: 4 },
  haut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titre: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre },
  compte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rond: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.bordure, alignItems: 'center', justifyContent: 'center' },
  coche: { color: '#FFFFFF', fontFamily: fonts.texteGras, fontSize: 14 },
  texte: { flex: 1, fontFamily: fonts.texteMoyen, fontSize: 15, color: colors.encre },
  texteFait: { color: colors.gris, textDecorationLine: 'line-through' },
  fleche: { fontFamily: fonts.texteGras, fontSize: 22, color: colors.gris },
  masquer: { alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  masquerTexte: { fontFamily: fonts.texteMoyen, fontSize: 13, color: colors.gris },
});
