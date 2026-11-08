// Petites briques réutilisées sur tous les écrans : logo, pastilles, avatars, titres.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle, Image } from 'react-native';
import { categorieIds, categories, colors, fonts, univers, type CategorieId } from '../theme';

// Le logo « kulky » : le mot seul, une couleur par lettre, les 5 couleurs de Kulky chacune une fois.
// (Le K kawaii reste l'icône de l'appli et la mascotte, à côté du mot.)
export const lettresLogo: [string, string][] = [
  ['k', colors.culkoko],
  ['u', univers.livres.couleur],
  ['l', univers.concerts.couleur],
  ['k', univers.cine.couleur],
  ['y', univers.expos.couleur],
];

export function Logo({ taille = 30 }: { taille?: number }) {
  return (
    <Text accessibilityRole="header" accessibilityLabel="Kulky" style={{ fontFamily: fonts.titreGras, fontSize: taille, letterSpacing: -0.5 }}>
      {lettresLogo.map(([l, c], i) => (
        <Text key={i} style={{ color: c }}>
          {l}
        </Text>
      ))}
    </Text>
  );
}

export function Avatar({ initiale, fond, taille = 36, photo }: { initiale: string; fond: string; taille?: number; photo?: string | null }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: fond }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: fond, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.texteGras, fontSize: taille * 0.4, color: colors.encre }}>{initiale}</Text>
    </View>
  );
}

// Le sélecteur d'univers en haut du fil et des envies : Tout, Livres, Ciné…
export function FiltreUnivers({
  choix,
  onChange,
  libelles,
}: {
  choix: CategorieId | 'tout';
  onChange: (u: CategorieId | 'tout') => void;
  libelles?: Partial<Record<CategorieId, string>>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginBottom: 14 }} contentContainerStyle={styles.filtres}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: choix === 'tout' }} onPress={() => onChange('tout')} style={[styles.pastille, choix === 'tout' ? { backgroundColor: colors.beige, borderWidth: 1.5, borderColor: colors.gris } : { backgroundColor: colors.carte }]}>
        <Text style={[styles.pastilleTexte, { color: colors.encre, fontFamily: choix === 'tout' ? fonts.texteGras : fonts.texteMoyen }]}>Tout</Text>
      </Pressable>
      {categorieIds.map((id) => {
        const u = univers[categories[id].univers];
        const actif = choix === id;
        return (
          <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => onChange(id)} style={[styles.pastille, { backgroundColor: actif ? u.texteFonce : u.teinte }]}>
            <View style={[styles.point, { backgroundColor: actif ? '#FFFFFF' : u.couleur }]} />
            <Text style={[styles.pastilleTexte, { color: actif ? '#FFFFFF' : colors.encre }]}>{libelles?.[id] ?? categories[id].label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

export function Titre({ children, taille = 26 }: { children: ReactNode; taille?: number }) {
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.titre, fontSize: taille, color: colors.culkoko }}>{children}</Text>;
}

export function BoutonPrincipal({ label, onPress, desactive }: { label: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={desactive} onPress={onPress} style={[styles.boutonPrincipal, { backgroundColor: desactive ? colors.bordure : colors.culkoko }]}>
      <Text style={{ fontFamily: fonts.titre, fontSize: 17, color: desactive ? colors.gris : '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filtres: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 44, borderRadius: 22 },
  pastilleTexte: { fontFamily: fonts.texteMoyen, fontSize: 14 },
  point: { width: 8, height: 8, borderRadius: 4 },
  carte: { backgroundColor: colors.carte, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.bordure, shadowColor: colors.encre, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  boutonPrincipal: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
