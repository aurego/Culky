// Petites briques réutilisées sur tous les écrans : logo, pastilles, avatars, titres.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle, Image } from 'react-native';
import { useConnexionBase, type EtatBase } from '../lib/useConnexionBase';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';
import { IconeCulkoko } from './Icones';

// Le logo « kulky » : le K kawaii en première lettre, puis « ulky », une couleur par lettre (les 4 univers).
export const lettresLogo: [string, string][] = [
  ['u', univers.livres.couleur],
  ['l', univers.cine.couleur],
  ['k', univers.concerts.couleur],
  ['y', univers.expos.couleur],
];

export function Logo({ taille = 30, interieur = colors.fond }: { taille?: number; interieur?: string }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Kulky" style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ marginBottom: taille * 0.2, marginRight: -taille * 0.08 }}>
        <IconeCulkoko taille={taille * 1.05} interieur={interieur} />
      </View>
      <Text style={{ fontFamily: fonts.titreGras, fontSize: taille, letterSpacing: -0.5 }}>
        {lettresLogo.map(([l, c]) => (
          <Text key={l} style={{ color: c }}>
            {l}
          </Text>
        ))}
      </Text>
    </View>
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
  choix: UniversId | 'tout';
  onChange: (u: UniversId | 'tout') => void;
  libelles?: Partial<Record<UniversId, string>>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginBottom: 14 }} contentContainerStyle={styles.filtres}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: choix === 'tout' }} onPress={() => onChange('tout')} style={[styles.pastille, { backgroundColor: choix === 'tout' ? colors.culkoko : colors.carte }]}>
        <Text style={[styles.pastilleTexte, { color: choix === 'tout' ? '#FFFFFF' : colors.encre }]}>Tout</Text>
      </Pressable>
      {universIds.map((id) => {
        const u = univers[id];
        const actif = choix === id;
        return (
          <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => onChange(id)} style={[styles.pastille, { backgroundColor: actif ? u.texteFonce : u.teinte }]}>
            <View style={[styles.point, { backgroundColor: actif ? '#FFFFFF' : u.couleur }]} />
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
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.titre, fontSize: taille, color: colors.culkoko }}>{children}</Text>;
}

export function BoutonPrincipal({ label, onPress, desactive }: { label: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={desactive} onPress={onPress} style={[styles.boutonPrincipal, { backgroundColor: desactive ? colors.bordure : colors.culkoko }]}>
      <Text style={{ fontFamily: fonts.titre, fontSize: 17, color: desactive ? colors.gris : '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}

// Le bandeau qui rappelle qu'on regarde des données d'exemple,
// avec un voyant qui indique si la base Supabase répond.
const voyants: Record<EtatBase, { couleur: string; texte: string }> = {
  verification: { couleur: '#B9AFA3', texte: 'connexion à la base…' },
  connectee: { couleur: '#2BA77F', texte: 'base connectée' },
  erreur: { couleur: '#9B2335', texte: 'base injoignable' },
  'non-configuree': { couleur: '#B9AFA3', texte: 'base non configurée' },
};

export function BandeauDemo() {
  const { etat, detail } = useConnexionBase();
  const v = voyants[etat];
  return (
    <View style={styles.bandeau}>
      <View style={styles.bandeauLigne}>
        <View style={[styles.voyant, { backgroundColor: v.couleur }]} />
        <Text style={styles.bandeauTexte}>
          Données d’exemple · <Text style={{ fontFamily: fonts.texteGras, color: colors.encre }}>{v.texte}</Text>
        </Text>
      </View>
      {etat === 'erreur' && detail ? <Text style={styles.bandeauDetail}>{detail}</Text> : null}
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
  bandeau: { marginHorizontal: 16, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.beige, alignItems: 'center', gap: 2 },
  bandeauLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voyant: { width: 12, height: 12, borderRadius: 6 },
  bandeauDetail: { fontFamily: fonts.texte, fontSize: 11, color: colors.gris, textAlign: 'center' },
  bandeauTexte: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
});
