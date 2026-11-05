// Une petite pluie de confettis aux couleurs de Kulky, quand on envoie un Kulkoko.
// Les confettis jaillissent du bouton, s'envolent en éventail, tournent et retombent en s'effaçant.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors, univers, universIds } from '../theme';

const couleurs = [colors.culkoko, ...universIds.map((u) => univers[u].couleur)];
const NOMBRE = 22;

// Chaque confetti a sa direction, sa distance, sa forme et sa rotation (tirées une fois pour toutes).
const pieces = Array.from({ length: NOMBRE }, (_, i) => {
  const angle = -Math.PI / 2 + ((i / (NOMBRE - 1)) - 0.5) * Math.PI * 1.25 + (Math.random() - 0.5) * 0.25;
  const distance = 60 + Math.random() * 55;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    chute: 18 + Math.random() * 22,
    rond: i % 3 === 0,
    couleur: couleurs[i % couleurs.length],
    tour: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
  };
});

// `declencheur` : un nombre qui augmente à chaque Kulkoko envoyé, pour relancer l'animation.
export function EclatConfettis({ declencheur }: { declencheur: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!declencheur) return;
    let annule = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduit) => {
        if (annule || reduit) return;
        setVisible(true);
        t.setValue(0);
        Animated.timing(t, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(() => {
          if (!annule) setVisible(false);
        });
      });
    return () => {
      annule = true;
    };
  }, [declencheur, t]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.zone}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            p.rond ? styles.rond : styles.ruban,
            {
              backgroundColor: p.couleur,
              opacity: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                // On monte vite, puis on retombe un peu : comme un vrai lancer de confettis.
                { translateY: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, p.dy, p.dy + p.chute] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.tour}deg`] }) },
                { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 0.8] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: '50%', top: '40%', width: 0, height: 0, overflow: 'visible', zIndex: 2 },
  ruban: { position: 'absolute', left: -3, top: -5, width: 7, height: 12, borderRadius: 2 },
  rond: { position: 'absolute', left: -3.5, top: -3.5, width: 7, height: 7, borderRadius: 3.5 },
});
