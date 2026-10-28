// Onglet Pour toi : « Qu'est-ce qu'on m'a envoyé ? » (les « pensés à toi »)
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BandeauDemo, Carte, Titre } from '../../components/Base';
import { pensesDemo } from '../../data/demo';
import { colors, fonts, univers } from '../../theme';

export default function PourToi() {
  const [ajoutes, setAjoutes] = useState<string[]>([]);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <View style={styles.entete}>
        <Titre>Pensés pour toi</Titre>
        <Text style={styles.petit}>Ce que tes amis ont vécu en pensant à toi</Text>
      </View>
      <ScrollView contentContainerStyle={styles.liste}>
        <BandeauDemo />
        {pensesDemo.map((p) => {
          const u = univers[p.univers];
          const ajoute = ajoutes.includes(p.id);
          return (
            <Carte key={p.id} style={styles.carte}>
              <View style={styles.ligne}>
                <Avatar initiale={p.initiale} fond={u.teinte} />
                <Text style={[styles.texte, { flex: 1 }]}>
                  <Text style={styles.gras}>{p.de}</Text> a pensé à toi · <Text style={styles.petit}>{p.quand}</Text>
                </Text>
              </View>
              <View style={[styles.oeuvre, { backgroundColor: u.teinte }]}>
                <View style={[styles.vignette, { backgroundColor: u.couleur }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.univers, { color: u.texteFonce }]}>{u.label}</Text>
                  <Text style={styles.titreOeuvre}>{p.oeuvre}</Text>
                </View>
              </View>
              <Text style={styles.mot}>« {p.mot} »</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: ajoute }}
                onPress={() => setAjoutes(ajoute ? ajoutes.filter((x) => x !== p.id) : [...ajoutes, p.id])}
                style={[styles.bouton, ajoute ? styles.boutonFait : styles.boutonAFaire]}
              >
                <Text style={[styles.boutonTexte, { color: ajoute ? colors.encre : '#FFFFFF' }]}>{ajoute ? 'Ajouté à tes envies ✓' : 'Ça me tente'}</Text>
              </Pressable>
            </Carte>
          );
        })}
        <Text style={styles.bilan}>Tes pensés ont inspiré 12 sorties cette année.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 4 },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  carte: { padding: 14, gap: 12 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  texte: { fontFamily: fonts.texte, fontSize: 15, color: colors.encre },
  gras: { fontFamily: fonts.texteGras },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  oeuvre: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 10 },
  vignette: { width: 44, height: 62, borderRadius: 8 },
  univers: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre },
  mot: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre, fontStyle: 'italic' },
  bouton: { height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  boutonAFaire: { backgroundColor: colors.culkoko },
  boutonFait: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
  bilan: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.gris, textAlign: 'center', marginTop: 8 },
});
