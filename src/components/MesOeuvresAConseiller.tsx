// « Conseiller » depuis le + : on ne conseille que ce qu'on a vécu soi-même.
// La liste montre donc les œuvres de mon journal, dans l'univers choisi.
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers, type UniversId } from '../theme';
import { BoutonPrincipal } from './Base';

type Oeuvre = { id: string; titre: string; createur: string | null; image_url: string | null };
const noms: Record<UniversId, { un: string; phrase: string }> = {
  livres: { un: 'un livre', phrase: 'Ton journal n’a pas encore de livre. Enregistre un livre que tu as aimé, puis tu pourras le conseiller.' },
  cine: { un: 'un film', phrase: 'Ton journal n’a pas encore de film. Enregistre un film que tu as aimé, puis tu pourras le conseiller.' },
  concerts: { un: 'une sortie', phrase: 'Ton journal n’a pas encore de concert ni de spectacle. Enregistre une sortie que tu as aimée, puis tu pourras la conseiller.' },
  expos: { un: 'une expo', phrase: 'Ton journal n’a pas encore d’expo. Enregistre une expo que tu as aimée, puis tu pourras la conseiller.' },
};

export function MesOeuvresAConseiller({ moi, u }: { moi: string; u: UniversId }) {
  const [oeuvres, setOeuvres] = useState<Oeuvre[] | null>(null);
  const [filtre, setFiltre] = useState('');

  useEffect(() => {
    if (!supabase) return setOeuvres([]);
    supabase
      .from('activites')
      .select('oeuvre_id, oeuvre:oeuvres(titre, createur, univers, image_url)')
      .eq('auteur_id', moi)
      .order('date_activite', { ascending: false })
      .then(({ data }) => {
        const vues = new Map<string, Oeuvre>();
        for (const l of (data ?? []) as unknown as { oeuvre_id: string; oeuvre: (Omit<Oeuvre, 'id'> & { univers: UniversId }) | null }[]) {
          if (l.oeuvre && l.oeuvre.univers === u && !vues.has(l.oeuvre_id)) vues.set(l.oeuvre_id, { id: l.oeuvre_id, titre: l.oeuvre.titre, createur: l.oeuvre.createur, image_url: l.oeuvre.image_url });
        }
        setOeuvres([...vues.values()]);
      }, () => setOeuvres([]));
  }, [moi, u]);

  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return (oeuvres ?? []).filter((o) => !f || o.titre.toLowerCase().includes(f) || (o.createur ?? '').toLowerCase().includes(f));
  }, [oeuvres, filtre]);

  if (!oeuvres) return <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />;

  if (oeuvres.length === 0)
    return (
      <View style={styles.vide}>
        <Text style={styles.videTitre}>On conseille ce qu’on a vécu</Text>
        <Text style={styles.videTexte}>{noms[u].phrase}</Text>
        <BoutonPrincipal label={`Enregistrer ${noms[u].un}`} onPress={() => router.replace('/enregistrer')} />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.liste} keyboardShouldPersistTaps="handled">
      <Text style={styles.aide}>Choisis dans ton journal : on conseille ce qu’on a vécu.</Text>
      {oeuvres.length > 6 ? <TextInput value={filtre} onChangeText={setFiltre} placeholder="Chercher dans mon journal…" placeholderTextColor={colors.gris} style={styles.champ} accessibilityLabel="Chercher dans mon journal" /> : null}
      {visibles.map((o) => (
        <Pressable key={o.id} accessibilityRole="button" onPress={() => router.replace({ pathname: '/penser', params: { oeuvre: o.id } })} style={styles.ligne}>
          {o.image_url ? <Image source={{ uri: o.image_url }} style={styles.vignette} accessibilityIgnoresInvertColors /> : <View style={[styles.vignette, { backgroundColor: univers[u].couleur }]} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.titre} numberOfLines={2}>{o.titre}</Text>
            {o.createur ? <Text style={styles.createur} numberOfLines={1}>{o.createur}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  liste: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  aide: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, marginBottom: 4 },
  champ: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 14, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.carte, borderRadius: 16, padding: 10, minHeight: 64 },
  vignette: { width: 40, height: 56, borderRadius: 8 },
  titre: { fontFamily: fonts.texteGras, fontSize: 15, lineHeight: 20, color: colors.encre },
  createur: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  chevron: { fontFamily: fonts.texteGras, fontSize: 22, color: colors.gris, paddingHorizontal: 4 },
  vide: { paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  videTitre: { fontFamily: fonts.titre, fontSize: 20, color: colors.culkoko },
  videTexte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 22, color: colors.gris },
});
