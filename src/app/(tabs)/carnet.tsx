// Onglet Mon carnet : « Qui suis-je, et qu'ai-je vécu ? »
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BandeauDemo, Carte } from '../../components/Base';
import { IconeReglages } from '../../components/Icones';
import { carnetDemo } from '../../data/demo';
import { emotionParId } from '../../data/emotions';
import { colors, fonts, univers, universIds } from '../../theme';

const nomsCompteurs = { livres: 'livres', cine: 'films', concerts: 'concerts', expos: 'expos' };

export default function Carnet() {
  const c = carnetDemo;
  const fait = c.annee[c.objectif.univers];
  const reste = Math.max(c.objectif.cible - fait, 0);
  const progression = Math.min(fait / c.objectif.cible, 1);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.page}>
        <BandeauDemo />
        <View style={styles.profil}>
          <View style={styles.avatar}>
            <Text style={styles.initiale}>{c.initiale}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.pseudo}>{c.pseudo}</Text>
            <Text style={styles.petit}>
              <Text style={styles.chiffre}>{c.abonnes}</Text> abonnés · <Text style={styles.chiffre}>{c.abonnements}</Text> abonnements
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Réglages" style={styles.reglages}>
            <IconeReglages />
          </Pressable>
        </View>
        <Text style={styles.texte}>{c.bio}</Text>

        <View>
          <Text style={styles.sousTitre}>Mes 3 livres préférés</Text>
          <View style={styles.preferes}>
            {c.preferes.map((p, i) => (
              <View key={p} style={[styles.livre, { backgroundColor: ['#3FB6B0', '#2E8F8A', '#1F6E6A'][i] }]}>
                <Text style={styles.livreTexte}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        <Carte style={{ padding: 16 }}>
          <Text style={[styles.sousTitre, { marginBottom: 12 }]}>Mon année {new Date().getFullYear()}</Text>
          <View style={styles.compteurs}>
            {universIds.map((id) => (
              <View key={id} style={[styles.compteur, { backgroundColor: univers[id].teinte }]}>
                <Text style={styles.compteurChiffre}>{c.annee[id]}</Text>
                <Text style={styles.compteurNom}>{nomsCompteurs[id]}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.petit, { color: colors.encre, marginBottom: 6 }]}>
            Objectif : <Text style={styles.chiffre}>{c.objectif.cible} livres</Text> · encore {reste}
          </Text>
          <View style={styles.jauge} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: c.objectif.cible, now: fait }}>
            <View style={[styles.jaugeRemplie, { width: `${progression * 100}%` }]} />
          </View>
        </Carte>

        <View style={{ gap: 10 }}>
          <Text style={styles.sousTitre}>Journal</Text>
          {c.journal.map((j) => {
            const e = emotionParId(j.emotion);
            return (
              <View key={j.id} style={styles.entree}>
                <View style={[styles.vignette, { backgroundColor: univers[j.univers].couleur }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.titreEntree}>{j.titre}</Text>
                  <Text style={styles.petit}>
                    {j.quand} · {e?.emoji} {e?.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, gap: 18 },
  profil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: univers.cine.teinte, alignItems: 'center', justifyContent: 'center' },
  initiale: { fontFamily: fonts.titreGras, fontSize: 28, color: colors.culkoko },
  pseudo: { fontFamily: fonts.titre, fontSize: 22, color: colors.encre },
  reglages: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  chiffre: { fontFamily: fonts.texteGras, color: colors.encre },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre, marginBottom: 10 },
  preferes: { flexDirection: 'row', gap: 10 },
  livre: { flex: 1, height: 120, borderRadius: 10, padding: 8, justifyContent: 'flex-end' },
  livreTexte: { fontFamily: fonts.texteGras, fontSize: 12, color: '#FFFFFF' },
  compteurs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  compteur: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  compteurChiffre: { fontFamily: fonts.titreGras, fontSize: 22, color: colors.encre },
  compteurNom: { fontFamily: fonts.texte, fontSize: 12, color: colors.encre },
  jauge: { height: 10, borderRadius: 5, backgroundColor: colors.separateur, overflow: 'hidden' },
  jaugeRemplie: { height: 10, borderRadius: 5, backgroundColor: univers.livres.couleur },
  entree: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.carte, borderRadius: 14, padding: 10 },
  vignette: { width: 40, height: 54, borderRadius: 8 },
  titreEntree: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
});
