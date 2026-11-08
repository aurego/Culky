// Sous une activité : qui a envoyé un Kulkoko (Jeff, Fanny…). Chaque nom ouvre le profil.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Applaudisseur } from '../lib/fil';
import { colors, fonts } from '../theme';
import { Avatar } from './Base';
import { IconeCulkoko } from './Icones';

function resume(liste: Applaudisseur[], aMoi: boolean): string {
  const noms = liste.map((p) => p.pseudo);
  const qui =
    noms.length === 1 ? noms[0] : noms.length === 2 ? `${noms[0]} et ${noms[1]}` : `${noms[0]}, ${noms[1]} et ${noms.length - 2} autre${noms.length > 3 ? 's' : ''}`;
  if (aMoi) return `${qui} ${noms.length > 1 ? 't’ont' : 't’a'} envoyé un Kulkoko`;
  return `${qui} ${noms.length > 1 ? 'ont' : 'a'} envoyé un Kulkoko`;
}

export function QuiAApplaudi({ liste, moi, aMoi }: { liste: Applaudisseur[]; moi: string; aMoi: boolean }) {
  if (!liste.length) return null;
  return (
    <View style={styles.boite}>
      <View style={styles.tete}>
        <IconeCulkoko taille={22} />
        <Text accessibilityRole="header" style={styles.titre}>{resume(liste, aMoi)}</Text>
      </View>
      {liste.map((p) => {
        const cEstMoi = p.id === moi;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="link"
            accessibilityLabel={cEstMoi ? 'Toi' : `Voir le profil de ${p.pseudo}`}
            onPress={() => (cEstMoi ? router.push('/carnet') : router.push({ pathname: '/profil/[id]', params: { id: p.id } }))}
            style={styles.ligne}
          >
            <Avatar initiale={p.pseudo.charAt(0).toUpperCase()} fond={colors.beige} photo={p.photo_url} taille={40} />
            <Text style={styles.nom}>{cEstMoi ? 'Toi' : p.pseudo}</Text>
            <Text style={styles.fleche}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  boite: { backgroundColor: colors.carte, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginTop: 12 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  titre: { flex: 1, fontFamily: fonts.texteGras, fontSize: 15, lineHeight: 21, color: colors.sousTitre },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  nom: { flex: 1, fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  fleche: { fontFamily: fonts.texteGras, fontSize: 20, color: colors.gris },
});
