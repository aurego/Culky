// L'écran qui fête chaque activité, juste après « Publier ».
// C'est le cœur de l'axe de Kulky : « Chaque lecture et chaque sortie culturelle mérite d'être célébrée. »
import { router, useLocalSearchParams } from 'expo-router';
import { photoPossible } from '../lib/profil';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { emotionParId } from '../data/emotions';
import { partageCartePossible, partagerCarte } from '../lib/carteStory';
import { phraseCroises } from '../lib/croises';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';

const bravos: Record<UniversId, string[]> = {
  livres: ['Bravo, un livre de plus !', 'Belle lecture !', 'Une page de plus à ton histoire !'],
  cine: ['Belle séance !', 'Clap de fin, et bravo !', 'Un film de plus dans ta collection !'],
  concerts: ['Quel concert !', 'Les oreilles encore pleines de musique ?', 'Un concert de plus, bravo !'],
  expos: ['Belle visite !', 'Une expo de plus dans ta collection !', 'Bravo pour cette sortie !'],
};

const nombreConfettis = 18;
const couleurs = [...universIds.map((u) => univers[u].couleur), colors.culkoko];

export default function Celebration() {
  const p = useLocalSearchParams<{ univers?: string; titre?: string; createur?: string; image?: string; commence?: string; rang?: string; emotion?: string; grace?: string; passe?: string; croises?: string; spectacle?: string; oeuvre?: string; activite?: string; photo?: string }>();
  const u: UniversId = universIds.includes(p.univers as UniversId) ? (p.univers as UniversId) : 'livres';
  const commence = p.commence === '1';
  const passe = p.passe === '1'; // ajouté après coup (« Rattrape ton année »)
  const emotion = p.emotion ? emotionParId(p.emotion) : undefined;
  const spectacle = p.spectacle === '1';
  const croises = phraseCroises(u, p.croises ? p.croises.split('\n').filter(Boolean) : [], spectacle);
  const liste = spectacle ? ['Quel spectacle !', 'Une belle soirée sur scène !', 'Bravo pour cette sortie !'] : bravos[u];
  const titre = useRef(passe && !commence ? 'Ajouté à ton année !' : commence ? 'Bonne lecture !' : liste[Math.floor(Math.random() * liste.length)]).current;

  const echelle = useRef(new Animated.Value(0.3)).current;
  const eclat = useRef(new Animated.Value(0)).current;
  const natif = Platform.OS !== 'web';
  const [partage, setPartage] = useState<'attente' | 'en-cours' | 'telechargee' | 'partage' | 'erreur'>('attente');

  // La carte story : chaque partage fait connaître Kulky.
  async function partager() {
    setPartage('en-cours');
    try {
      const r = await partagerCarte({
        univers: u,
        titre: p.titre ?? '',
        createur: p.createur || null,
        imageUrl: p.image || null,
        emotion: emotion ? { emoji: emotion.emoji, label: emotion.label } : null,
        rang: p.rang || null,
        commence,
        passe,
        spectacle,
      });
      setPartage(r === 'annule' ? 'attente' : r);
    } catch {
      setPartage('erreur');
    }
  }

  useEffect(() => {
    Animated.parallel([
      Animated.spring(echelle, { toValue: 1, friction: 4, tension: 80, useNativeDriver: natif }),
      Animated.timing(eclat, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: natif }),
    ]).start();
  }, [echelle, eclat, natif]);

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.centre}>
        <View style={styles.scene} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: nombreConfettis }, (_, i) => {
            const angle = (i / nombreConfettis) * Math.PI * 2;
            const distance = 92 + (i % 3) * 18;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: couleurs[i % couleurs.length],
                    opacity: eclat.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0.85] }),
                    transform: [
                      { translateX: eclat.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] }) },
                      { translateY: eclat.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] }) },
                      { rotate: eclat.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 220}deg`] }) },
                    ],
                  },
                ]}
              />
            );
          })}
          <Animated.View style={[styles.medaille, { backgroundColor: univers[u].couleur, transform: [{ scale: echelle }] }]}>
            <Text style={styles.medailleEmoji}>{commence ? '📖' : emotion?.emoji ?? '🎉'}</Text>
          </Animated.View>
        </View>

        <Text accessibilityRole="header" style={styles.titre}>{titre}</Text>
        {p.titre ? <Text style={styles.oeuvre}>{p.titre}</Text> : null}
        {commence ? (
          <Text style={styles.texte}>Il rejoint tes lectures en cours. Note où tu en es et glisse des mots entre les pages depuis ton fil ou ton journal. On fêtera ça quand tu l’auras fini !</Text>
        ) : (
          <>
            {p.rang ? (
              <Text style={styles.rang}>
                C’est <Text style={{ color: univers[u].texteFonce }}>{p.rang}</Text>.
              </Text>
            ) : null}
            {p.grace ? <Text style={styles.grace}>Grâce à {p.grace}, qui avait pensé à toi</Text> : null}
          </>
        )}
        {croises ? <Text style={[styles.croises, { color: univers[u].texteFonce }]}>{croises}</Text> : null}
      </View>

      <View style={styles.bas}>
        {partage === 'telechargee' ? <Text style={styles.info}>L’image est dans tes téléchargements : ajoute-la à ta story !</Text> : null}
        {partage === 'partage' ? <Text style={styles.info}>Merci de faire connaître Kulky !</Text> : null}
        {partage === 'erreur' ? <Text style={styles.info}>L’image n’a pas pu être créée. Réessaie dans un instant.</Text> : null}
        {partageCartePossible && p.titre ? (
          <BoutonPrincipal label={partage === 'en-cours' ? 'Un instant…' : 'Partager en story'} onPress={partager} desactive={partage === 'en-cours'} />
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/carnet', params: { vue: 'journal' } })} style={partageCartePossible && p.titre ? styles.secondaire : styles.secondairePlein}>
          <Text style={partageCartePossible && p.titre ? styles.secondaireTexte : styles.secondairePleinTexte}>Voir mon journal</Text>
        </Pressable>
        {/* Pas de photo ? On propose, en douceur, d'en ajouter une : le fil de tes amis sera plus vivant. */}
        {p.photo === '0' && p.activite && photoPossible ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/enregistrer', params: { modifier: p.activite } })} style={styles.lien}>
            <Text style={styles.lienTexte}>📸 Ajouter ta photo souvenir</Text>
          </Pressable>
        ) : null}
        {/* L'élan d'après : on vient d'aimer quelque chose, on pense à quelqu'un. */}
        {p.oeuvre && !commence ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/penser', params: { oeuvre: p.oeuvre } })} style={styles.lien}>
            <Text style={styles.lienTexte}>Conseiller à un ami</Text>
          </Pressable>
        ) : null}
        {p.oeuvre && p.activite && commence ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace({ pathname: '/marque-page', params: { activite: p.activite, oeuvre: p.oeuvre, titre: p.titre ?? '' } })}
            style={styles.lien}
          >
            <Text style={styles.lienTexte}>Glisser un mot entre les pages</Text>
          </Pressable>
        ) : null}
        {passe ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/enregistrer', params: { mode: 'passe' } })} style={styles.lien}>
            <Text style={styles.lienTexte}>Ajouter une autre lecture, un film ou une sortie</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.lien}>
            <Text style={styles.lienTexte}>Retour au fil</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  scene: { width: 280, height: 290, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  confetti: { position: 'absolute', width: 12, height: 18, borderRadius: 4 },
  medaille: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', shadowColor: colors.encre, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  medailleEmoji: { fontSize: 60 },
  titre: { fontFamily: fonts.titreGras, fontSize: 30, lineHeight: 36, color: colors.culkoko, textAlign: 'center' },
  oeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.gris, textAlign: 'center' },
  rang: { fontFamily: fonts.titre, fontSize: 20, lineHeight: 27, color: colors.culkoko, textAlign: 'center', marginTop: 6 },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.gris, textAlign: 'center', marginTop: 4 },
  grace: { fontFamily: fonts.texteMoyen, fontSize: 15, lineHeight: 21, color: colors.culkoko, textAlign: 'center', marginTop: 6 },
  croises: { fontFamily: fonts.texteMoyen, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  bas: { paddingBottom: 24, gap: 8 },
  info: { fontFamily: fonts.texteMoyen, fontSize: 14, lineHeight: 20, color: '#1D6E54', backgroundColor: '#DAF0E6', borderRadius: 12, padding: 12, textAlign: 'center' },
  secondaire: { height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  secondaireTexte: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko },
  secondairePlein: { height: 56, borderRadius: 28, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  secondairePleinTexte: { fontFamily: fonts.titre, fontSize: 17, color: '#FFFFFF' },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
