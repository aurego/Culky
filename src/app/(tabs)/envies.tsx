// Onglet Envies : « Que veux-je vivre ? »
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BandeauDemo, Carte, FiltreUnivers, Titre } from '../../components/Base';
import { enviesDemo } from '../../data/demo';
import { colors, fonts, univers, type UniversId } from '../../theme';

export default function Envies() {
  const [filtre, setFiltre] = useState<UniversId | 'tout'>('tout');
  const envies = enviesDemo.filter((e) => filtre === 'tout' || e.univers === filtre);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <View style={styles.entete}>
        <Titre>Mes envies</Titre>
        <Text style={styles.petit}>{enviesDemo.length} choses à vivre</Text>
      </View>
      <FiltreUnivers choix={filtre} onChange={setFiltre} libelles={{ livres: 'À lire', cine: 'À voir', concerts: 'À écouter', expos: 'À visiter' }} />
      <ScrollView contentContainerStyle={styles.liste}>
        <BandeauDemo />
        {envies.map((e) => {
          const u = univers[e.univers];
          return (
            <Carte key={e.id} style={styles.carte}>
              <View style={styles.ligne}>
                <View style={[styles.vignette, { backgroundColor: u.couleur }]} />
                <View style={{ flex: 1 }}>
                  {e.alerte ? (
                    <Text style={[styles.alerte, { backgroundColor: e.univers === 'cine' ? u.teinte : univers.concerts.teinte, color: e.univers === 'cine' ? u.texteFonce : univers.concerts.texteFonce }]}>{e.alerte}</Text>
                  ) : null}
                  <Text style={styles.titreEnvie}>{e.titre}</Text>
                  <Text style={styles.petit}>{e.sousTitre}</Text>
                </View>
              </View>
              {e.amisAussi ? (
                <>
                  <View style={styles.amis}>
                    <View style={{ flexDirection: 'row' }}>
                      {e.amisAussi.map((i, n) => (
                        <View key={i} style={[styles.miniAvatar, { marginLeft: n ? -8 : 0, backgroundColor: [univers.cine.teinte, univers.expos.teinte, univers.livres.teinte][n % 3] }]}>
                          <Text style={styles.miniInitiale}>{i}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={[styles.petit, { flex: 1, color: colors.encre }]}>{e.amisAussi.length} personnes que tu suis ont aussi envie d’y aller</Text>
                  </View>
                  <View style={styles.boutons}>
                    <Pressable accessibilityRole="button" style={[styles.bouton, { backgroundColor: colors.culkoko }]}>
                      <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>On y va ensemble ?</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => router.push('/enregistrer')} style={[styles.bouton, { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure }]}>
                      <Text style={styles.boutonTexte}>J’y étais</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </Carte>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 4 },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  carte: { padding: 14, gap: 12 },
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  vignette: { width: 56, height: 72, borderRadius: 12 },
  alerte: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontFamily: fonts.texteGras, fontSize: 12, marginBottom: 4 },
  titreEnvie: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  amis: { backgroundColor: '#F7F2EA', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#F7F2EA', alignItems: 'center', justifyContent: 'center' },
  miniInitiale: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.encre },
  boutons: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
});
