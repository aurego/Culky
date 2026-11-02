// L'animation d'arrivée : les cinq lettres de « culky » tombent l'une après l'autre, chacune dans sa couleur,
// puis un fil bordeaux se tisse dessous, maille après maille, pour les relier : Culky, c'est le lien.
// Enfin la promesse apparaît. Elle respecte le réglage « réduire les animations » du téléphone.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, univers } from '../theme';

const lettres: [string, string][] = [
  ['c', univers.livres.couleur],
  ['u', univers.cine.couleur],
  ['l', univers.concerts.couleur],
  ['k', univers.expos.couleur],
  ['y', colors.culkoko],
];

// Le fil : une suite de mailles (des boucles) qui passent sous chaque lettre.
const FIL =
  'M6 34 C 22 34, 26 8, 40 8 C 54 8, 50 40, 40 40 C 30 40, 30 18, 52 18 ' +
  'C 74 18, 72 8, 88 8 C 104 8, 100 40, 90 40 C 80 40, 80 18, 102 18 ' +
  'C 124 18, 122 8, 138 8 C 154 8, 150 40, 140 40 C 130 40, 130 18, 152 18 ' +
  'C 174 18, 172 8, 188 8 C 204 8, 200 40, 190 40 C 180 40, 180 18, 202 18 ' +
  'C 224 18, 228 34, 254 34';
const LONGUEUR_FIL = 620;

const CheminAnime = Animated.createAnimatedComponent(Path);

export function AnimationArrivee({ taille = 64, avecPromesse = true, onFini }: { taille?: number; avecPromesse?: boolean; onFini?: () => void }) {
  const chutes = useRef(lettres.map(() => new Animated.Value(0))).current;
  const fil = useRef(new Animated.Value(0)).current;
  const promesse = useRef(new Animated.Value(0)).current;
  const [reduit, setReduit] = useState<boolean | null>(null);
  const natif = Platform.OS !== 'web';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => setReduit(!!r))
      .catch(() => setReduit(false));
  }, []);

  useEffect(() => {
    if (reduit === null) return;
    if (reduit) {
      chutes.forEach((c) => c.setValue(1));
      fil.setValue(1);
      promesse.setValue(1);
      const t = setTimeout(() => onFini?.(), 600);
      return () => clearTimeout(t);
    }
    const animation = Animated.sequence([
      Animated.stagger(
        130,
        chutes.map((c) => Animated.spring(c, { toValue: 1, friction: 5, tension: 70, useNativeDriver: natif })),
      ),
      Animated.timing(fil, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(promesse, { toValue: 1, duration: 450, useNativeDriver: natif }),
      Animated.delay(350),
    ]);
    animation.start(({ finished }) => finished && onFini?.());
    return () => animation.stop();
  }, [reduit, chutes, fil, promesse, natif, onFini]);

  const largeurFil = taille * 3.2;
  return (
    <View style={styles.bloc} accessible accessibilityRole="header" accessibilityLabel="Culky">
      <View style={styles.mot}>
        {lettres.map(([l, c], i) => (
          <Animated.Text
            key={l}
            style={[
              styles.lettre,
              {
                fontSize: taille,
                color: c,
                opacity: chutes[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: chutes[i].interpolate({ inputRange: [0, 1], outputRange: [-taille * 2, 0] }) },
                  { rotate: chutes[i].interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? '18deg' : '-18deg', '0deg'] }) },
                ],
              },
            ]}
          >
            {l}
          </Animated.Text>
        ))}
      </View>
      <Svg width={largeurFil} height={taille * 0.7} viewBox="0 0 260 48" style={{ marginTop: -taille * 0.18 }}>
        <CheminAnime
          d={FIL}
          fill="none"
          stroke={colors.culkoko}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${LONGUEUR_FIL} ${LONGUEUR_FIL}`}
          strokeDashoffset={fil.interpolate({ inputRange: [0, 1], outputRange: [LONGUEUR_FIL, 0] })}
        />
      </Svg>
      {avecPromesse ? (
        <Animated.View style={{ opacity: promesse, transform: [{ translateY: promesse.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          <Text style={styles.promesse}>Vis-le, garde-le, partage-le.</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { alignItems: 'center' },
  mot: { flexDirection: 'row', alignItems: 'flex-end' },
  lettre: { fontFamily: fonts.titreGras, letterSpacing: -1 },
  promesse: { fontFamily: fonts.texteMoyen, fontSize: 16, color: colors.gris, marginTop: 6 },
});
