// L'écran de recadrage : on fait glisser la photo pour la placer, on zoome avec − / + (ou en pinçant),
// et on voit exactement ce qui sera gardé : un rond pour la photo de profil, un bandeau pour la photo souvenir.
import { useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ImageBrute, Zone } from '../lib/profil';
import { colors, fonts } from '../theme';
import { BoutonPrincipal } from './Base';

const ZOOM_MAX = 4;

type Props = {
  image: ImageBrute | null; // null : l'écran est fermé
  ratio: number; // largeur / hauteur du cadre
  rond?: boolean;
  titre: string;
  onValider: (zone: Zone) => void;
  onAnnuler: () => void;
};

export function Recadreur(props: Props) {
  if (!props.image) return null;
  // Une clé par image : chaque nouvelle photo repart centrée, sans zoom.
  return <RecadreurOuvert key={props.image.uri} {...props} image={props.image} />;
}

function RecadreurOuvert({ image, ratio, rond, titre, onValider, onAnnuler }: Props & { image: ImageBrute }) {
  const ecran = useWindowDimensions();
  // Le cadre : toute la largeur disponible (dans la limite de 460 px), et pas plus de la moitié de la hauteur.
  const L = Math.min(ecran.width - 48, 460, (ecran.height * 0.5) * ratio);
  const H = L / ratio;
  // À zoom 1, la photo couvre juste le cadre.
  const base = Math.max(L / image.largeur, H / image.hauteur);

  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState(() => ({ x: (L - image.largeur * base) / 2, y: (H - image.hauteur * base) / 2 }));
  const etat = useRef({ zoom, pos });
  etat.current = { zoom, pos };

  // On garde toujours le cadre rempli : la photo ne peut pas laisser de bord vide.
  const borner = (p: { x: number; y: number }, z: number) => {
    const l = image.largeur * base * z;
    const h = image.hauteur * base * z;
    return { x: Math.min(0, Math.max(L - l, p.x)), y: Math.min(0, Math.max(H - h, p.y)) };
  };

  // Zoomer en gardant fixe un point du cadre (le centre, ou le milieu des deux doigts).
  const zoomerAutour = (nouveau: number, cx = L / 2, cy = H / 2) => {
    const { zoom: z, pos: p } = etat.current;
    const z2 = Math.min(ZOOM_MAX, Math.max(1, nouveau));
    const ix = (cx - p.x) / (base * z);
    const iy = (cy - p.y) / (base * z);
    const p2 = borner({ x: cx - ix * base * z2, y: cy - iy * base * z2 }, z2);
    setZoom(z2);
    setPos(p2);
  };

  const geste = useRef({ depart: { x: 0, y: 0 }, ecart: 0, zoomDepart: 1 });
  const panneau = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          geste.current.depart = { ...etat.current.pos };
          geste.current.ecart = 0;
          geste.current.zoomDepart = etat.current.zoom;
          const t = e.nativeEvent.touches;
          if (t && t.length >= 2) geste.current.ecart = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t && t.length >= 2) {
            // Deux doigts : on pince pour zoomer.
            const ecart = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            if (!geste.current.ecart) {
              geste.current.ecart = ecart;
              geste.current.zoomDepart = etat.current.zoom;
              return;
            }
            zoomerAutour(geste.current.zoomDepart * (ecart / geste.current.ecart));
            return;
          }
          if (geste.current.ecart) return; // on vient de lâcher un doigt après un pincement
          setPos(borner({ x: geste.current.depart.x + g.dx, y: geste.current.depart.y + g.dy }, etat.current.zoom));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [L, H, base],
  );

  function valider() {
    const echelle = base * zoom;
    const largeur = Math.min(image.largeur, L / echelle);
    const hauteur = Math.min(image.hauteur, H / echelle);
    onValider({
      x: Math.max(0, Math.min(image.largeur - largeur, -pos.x / echelle)),
      y: Math.max(0, Math.min(image.hauteur - hauteur, -pos.y / echelle)),
      largeur,
      hauteur,
    });
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onAnnuler}>
      <SafeAreaView style={styles.ecran}>
        <Text accessibilityRole="header" style={styles.titre}>{titre}</Text>
        <Text style={styles.aide}>Fais glisser la photo pour la placer, et zoome avec − et +.</Text>

        <View style={styles.zone}>
          <View
            {...panneau.panHandlers}
            accessibilityLabel="Zone de recadrage"
            style={[styles.cadre, { width: L, height: H, borderRadius: rond ? L / 2 : 18 }]}
          >
            <Image
              source={{ uri: image.uri }}
              style={{ position: 'absolute', left: pos.x, top: pos.y, width: image.largeur * base * zoom, height: image.hauteur * base * zoom }}
              resizeMode="stretch"
              accessibilityIgnoresInvertColors
            />
          </View>
        </View>

        <View style={styles.zoom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dézoomer" disabled={zoom <= 1} onPress={() => zoomerAutour(zoom / 1.25)} style={[styles.rondBouton, zoom <= 1 && { opacity: 0.4 }]}>
            <Text style={styles.rondTexte}>−</Text>
          </Pressable>
          <View style={styles.jauge}>
            <View style={[styles.jaugePleine, { width: `${((zoom - 1) / (ZOOM_MAX - 1)) * 100}%` }]} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoomer" disabled={zoom >= ZOOM_MAX} onPress={() => zoomerAutour(zoom * 1.25)} style={[styles.rondBouton, zoom >= ZOOM_MAX && { opacity: 0.4 }]}>
            <Text style={styles.rondTexte}>+</Text>
          </Pressable>
        </View>

        <View style={styles.bas}>
          <BoutonPrincipal label="Valider" onPress={valider} />
          <Pressable accessibilityRole="button" onPress={onAnnuler} style={styles.annuler}>
            <Text style={styles.annulerTexte}>Annuler</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24, paddingTop: 12 },
  titre: { fontFamily: fonts.titre, fontSize: 22, color: colors.culkoko, textAlign: 'center', marginTop: 8 },
  aide: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center', marginTop: 6 },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cadre: { overflow: 'hidden', backgroundColor: colors.beige, borderWidth: 3, borderColor: '#FFFFFF', shadowColor: colors.encre, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, cursor: 'grab' } as object,
  zoom: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'center', width: '100%', maxWidth: 360, marginBottom: 18 },
  rondBouton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.carte },
  rondTexte: { fontFamily: fonts.titre, fontSize: 24, lineHeight: 28, color: colors.culkoko },
  jauge: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.bordure, overflow: 'hidden' },
  jaugePleine: { height: 6, backgroundColor: colors.culkoko },
  bas: { gap: 6, paddingBottom: 20 },
  annuler: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  annulerTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.gris },
});
