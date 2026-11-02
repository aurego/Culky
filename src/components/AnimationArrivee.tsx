// L'animation d'arrivée : la maille de Kulky.
// Au centre, le K kawaii (en contour). Des fils partent de lui vers six amis (des pastilles vides aux couleurs
// des univers), puis vers les amis de leurs amis : Kulky relie les gens par la culture.
// En même temps, les lettres de « kulky » tombent l'une après l'autre ; à la fin, le K fait deux petits sauts.
// Elle respecte le réglage « réduire les animations » du téléphone.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, fonts, univers } from '../theme';
import { couleurKLogo, lettresLogo, placementK } from './Base';
import { IconeCulkoko } from './Icones';

// Le mot « kulky » : le K kawaii, puis « ulky » aux couleurs des univers (comme le logo).
const lettres: [string, string][] = [['K', couleurKLogo], ...lettresLogo];
// Cinq amis, comme les cinq lettres, dans les mêmes couleurs et le même ordre : la maille répond au mot.
const couleursAmis = lettres.map(([, c]) => c);
const FIL_CLAIR = '#E4DCD1';

const L = 320; // la maille est dessinée dans un cadre de 320 × 220
const H = 220;

type Noeud = { x: number; y: number; r: number; c: string; vague: number; w: number };
type Fil = { x1: number; y1: number; x2: number; y2: number; c: string; w: number; vague: number; l: number };

// Une maille régulière : un pentagone d'amis autour du K, et deux amis d'amis par ami, en miroir.
function tisser(): { noeuds: Noeud[]; fils: Fil[] } {
  const cx = L / 2;
  const cy = H / 2 + 4;
  const noeuds: Noeud[] = [];
  const fils: Fil[] = [];
  const fil = (a: { x: number; y: number }, b: { x: number; y: number }, c: string, w: number, vague: number) =>
    fils.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, c, w, vague, l: Math.hypot(a.x - b.x, a.y - b.y) });
  const amis: (Noeud & { a: number })[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const n = { x: cx + Math.cos(a) * 82, y: cy + Math.sin(a) * 66, r: 9, c: couleursAmis[i], vague: 1, w: 2.4, a };
    noeuds.push(n);
    amis.push(n);
    fil({ x: cx + Math.cos(a) * 34, y: cy + Math.sin(a) * 32 }, n, n.c, 2.4, 0.9);
  }
  for (let i = 0; i < 5; i++) fil(amis[i], amis[(i + 1) % 5], FIL_CLAIR, 1.6, 1.3);
  for (const p of amis) {
    const enfants: Noeud[] = [];
    for (const d of [-0.42, 0.42]) {
      const a = p.a + d;
      const n = { x: p.x + Math.cos(a) * 52, y: p.y + Math.sin(a) * 40, r: 5.5, c: p.c, vague: 2, w: 2.4 };
      noeuds.push(n);
      enfants.push(n);
      fil(p, n, p.c, 1.6, 1.8);
    }
    fil(enfants[0], enfants[1], FIL_CLAIR, 1.2, 2.3);
  }
  return { noeuds, fils };
}

const LigneAnimee = Animated.createAnimatedComponent(Line);
const RondAnime = Animated.createAnimatedComponent(Circle);
const PAS = 450; // ms entre deux vagues de la maille

export function AnimationArrivee({ taille = 56, avecPromesse = true, onFini }: { taille?: number; avecPromesse?: boolean; onFini?: () => void }) {
  const { noeuds, fils } = useMemo(tisser, []);
  const tissage = useRef(new Animated.Value(0)).current; // 0 → 3 : les vagues de la maille
  const k = useRef(new Animated.Value(0)).current;
  const saut = useRef(new Animated.Value(0)).current;
  const chutes = useRef(lettres.map(() => new Animated.Value(0))).current;
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
      tissage.setValue(3);
      k.setValue(1);
      chutes.forEach((c) => c.setValue(1));
      promesse.setValue(1);
      const t = setTimeout(() => onFini?.(), 600);
      return () => clearTimeout(t);
    }
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.spring(k, { toValue: 1, friction: 5, tension: 80, useNativeDriver: natif }),
        Animated.timing(tissage, { toValue: 3, duration: PAS * 3 + 300, easing: Easing.linear, useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(300),
          Animated.stagger(
            120,
            chutes.map((c) => Animated.spring(c, { toValue: 1, friction: 5, tension: 70, useNativeDriver: natif })),
          ),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(promesse, { toValue: 1, duration: 450, useNativeDriver: natif }),
        // Deux petits sauts de joie.
        Animated.sequence([0, 1].flatMap(() => [
          Animated.timing(saut, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: natif }),
          Animated.timing(saut, { toValue: 0, duration: 220, easing: Easing.bounce, useNativeDriver: natif }),
        ])),
      ]),
      Animated.delay(300),
    ]);
    animation.start(({ finished }) => finished && onFini?.());
    return () => animation.stop();
  }, [reduit, tissage, k, saut, chutes, promesse, natif, onFini]);

  // Chaque élément apparaît quand le tissage atteint sa vague.
  const apparition = (vague: number) => tissage.interpolate({ inputRange: [vague * 0.9, vague * 0.9 + 0.55], outputRange: [0, 1], extrapolate: 'clamp' });
  const largeur = Math.min(320, taille * 6.4);
  const echelle = largeur / L;

  return (
    <View style={styles.bloc} accessible accessibilityRole="header" accessibilityLabel="Kulky">
      <View style={{ width: largeur, height: H * echelle }}>
        <Svg width={largeur} height={H * echelle} viewBox={`0 0 ${L} ${H}`}>
          {fils.map((f, i) => {
            const t = apparition(f.vague);
            return (
              <LigneAnimee
                key={`f${i}`}
                x1={f.x1}
                y1={f.y1}
                x2={f.x2}
                y2={f.y2}
                stroke={f.c}
                strokeWidth={f.w}
                strokeLinecap="round"
                strokeDasharray={`${f.l} ${f.l}`}
                strokeDashoffset={t.interpolate({ inputRange: [0, 1], outputRange: [f.l, 0] })}
                opacity={t}
              />
            );
          })}
          {noeuds.map((n, i) => (
            <RondAnime
              key={`n${i}`}
              cx={n.x}
              cy={n.y}
              r={apparition(n.vague + 0.3).interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, n.r * 1.25, n.r] })}
              fill={colors.fond}
              stroke={n.c}
              strokeWidth={n.w}
            />
          ))}
        </Svg>
        {/* Le K au centre, en contour, qui saute de joie à la fin. */}
        <Animated.View
          style={[
            styles.k,
            {
              left: (largeur - 76 * echelle) / 2,
              top: ((H / 2 + 4) * echelle) - (76 * echelle) / 2,
              transform: [{ scale: k }, { translateY: saut.interpolate({ inputRange: [0, 1], outputRange: [0, -8 * echelle] }) }],
            },
          ]}
        >
          <IconeCulkoko taille={76 * echelle} interieur={colors.fond} />
        </Animated.View>
      </View>
      <View style={styles.mot}>
        {lettres.map(([l, c], i) => {
          const style = {
            opacity: chutes[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: chutes[i].interpolate({ inputRange: [0, 1], outputRange: [-taille * 1.4, 0] }) },
              { rotate: chutes[i].interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? '16deg' : '-16deg', '0deg'] }) },
            ],
          };
          if (i === 0)
            return (
              <Animated.View key="K" style={[style, placementK(taille).marge]}>
                <IconeCulkoko taille={placementK(taille).taille} couleur={c} plein applaudit={false} fond={colors.fond} />
              </Animated.View>
            );
          return (
            <Animated.Text key={l} style={[styles.lettre, { fontSize: taille, color: c }, style]}>
              {l}
            </Animated.Text>
          );
        })}
      </View>
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
  k: { position: 'absolute' },
  mot: { flexDirection: 'row', alignItems: 'flex-end', marginTop: -2 },
  lettre: { fontFamily: fonts.titreGras, letterSpacing: -1 },
  promesse: { fontFamily: fonts.texteMoyen, fontSize: 16, color: colors.gris, marginTop: 4 },
});
