// Petites briques réutilisées sur tous les écrans : logo, pastilles, avatars, titres.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';

// Le logo « culky » : une couleur par lettre (4 univers + le Culkoko).
export function Logo({ taille = 30 }: { taille?: number }) {
  const lettres: [string, string][] = [
    ['c', univers.livres.couleur],
    ['u', univers.cine.couleur],
    ['l', univers.concerts.couleur],
    ['k', univers.expos.couleur],
    ['y', colors.culkoko],
  ];
  return (
    <Text accessibilityRole="header" accessibilityLabel="Culky" style={{ fontFamily: fonts.titreGras, fontSize: taille, letterSpacing: -0.5 }}>
      {lettres.map(([l, c]) => (
        <Text key={l} style={{ color: c }}>
          {l}
        </Text>
      ))}
    </Text>
  );
}

export function Avatar({ initiale, fond, taille = 36 }: { initiale: string; fond: string; taille?: number }) {
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
  choix: UniversId | 'tout';
  onChange: (u: UniversId | 'tout') => void;
  libelles?: Partial<Record<UniversId, string>>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginBottom: 14 }} contentContainerStyle={styles.filtres}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: choix === 'tout' }} onPress={() => onChange('tout')} style={[styles.pastille, { backgroundColor: choix === 'tout' ? colors.encre : colors.carte }]}>
        <Text style={[styles.pastilleTexte, { color: choix === 'tout' ? '#FFFFFF' : colors.encre }]}>Tout</Text>
      </Pressable>
      {universIds.map((id) => {
        const u = univers[id];
        const actif = choix === id;
        return (
          <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => onChange(id)} style={[styles.pastille, { backgroundColor: actif ? colors.encre : u.teinte }]}>
            <View style={[styles.point, { backgroundColor: u.couleur }]} />
            <Text style={[styles.pastilleTexte, { color: actif ? '#FFFFFF' : colors.encre }]}>{libelles?.[id] ?? u.label}</Text>
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
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.titre, fontSize: taille, color: colors.encre }}>{children}</Text>;
}

export function BoutonPrincipal({ label, onPress, desactive }: { label: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={desactive} onPress={onPress} style={[styles.boutonPrincipal, { backgroundColor: desactive ? colors.bordure : colors.culkoko }]}>
      <Text style={{ fontFamily: fonts.titre, fontSize: 17, color: desactive ? colors.gris : '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}

// Le bandeau qui rappelle qu'on regarde des données d'exemple.
export function BandeauDemo() {
  return (
    <View style={styles.bandeau}>
      <Text style={styles.bandeauTexte}>Aperçu avec des données d’exemple</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filtres: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18 },
  pastilleTexte: { fontFamily: fonts.texteMoyen, fontSize: 14 },
  point: { width: 8, height: 8, borderRadius: 4 },
  carte: { backgroundColor: colors.carte, borderRadius: 20, overflow: 'hidden', shadowColor: colors.encre, shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  boutonPrincipal: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bandeau: { marginHorizontal: 16, marginBottom: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.beige, alignItems: 'center' },
  bandeauTexte: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
});
