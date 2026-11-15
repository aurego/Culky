// Les photos souvenirs d'une activité : un carrousel qu'on fait glisser dans la carte,
// et la visionneuse en plein écran quand on touche une photo.
import { useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts } from '../theme';

export function CarrouselPhotos({ photos, ratio, alt }: { photos: string[]; ratio: number; alt: string }) {
  const [largeur, setLargeur] = useState(0);
  const [page, setPage] = useState(0);
  const [plein, setPlein] = useState<number | null>(null);
  const defiler = (e: NativeSyntheticEvent<NativeScrollEvent>) => largeur && setPage(Math.round(e.nativeEvent.contentOffset.x / largeur));
  return (
    <View onLayout={(e) => setLargeur(e.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: ratio }}>
      {largeur ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={defiler} scrollEventThrottle={32} style={StyleSheet.absoluteFill}>
          {photos.map((url, k) => (
            <Pressable key={url} accessibilityRole="imagebutton" accessibilityLabel={`${alt}, photo ${k + 1} sur ${photos.length} : voir en grand`} onPress={() => setPlein(k)}>
              <Image source={{ uri: url }} style={{ width: largeur, height: largeur / ratio }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {photos.length > 1 ? (
        <>
          <View style={styles.compteur} pointerEvents="none">
            <Text style={styles.compteurTexte}>{page + 1}/{photos.length}</Text>
          </View>
          <View style={styles.points} pointerEvents="none">
            {photos.map((u, k) => (
              <View key={u} style={[styles.point, k === page && styles.pointActif]} />
            ))}
          </View>
        </>
      ) : null}
      <PhotosPleinEcran photos={photos} depart={plein} onFermer={() => setPlein(null)} />
    </View>
  );
}

export function PhotosPleinEcran({ photos, depart, onFermer }: { photos: string[]; depart: number | null; onFermer: () => void }) {
  const ecran = useWindowDimensions();
  const [page, setPage] = useState(0);
  const defile = useRef<ScrollViewInstance>(null);
  return (
    <Modal visible={depart !== null} transparent animationType="fade" onRequestClose={onFermer} onShow={() => { setPage(depart ?? 0); defile.current?.scrollTo({ x: (depart ?? 0) * ecran.width, animated: false }); }}>
      <View style={styles.voile}>
        <ScrollView
          ref={defile}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (depart ?? 0) * ecran.width, y: 0 }}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / ecran.width))}
          scrollEventThrottle={32}
        >
          {photos.map((url, k) => (
            <Pressable key={url} onPress={onFermer} accessibilityLabel={`Photo ${k + 1} sur ${photos.length}`} style={{ width: ecran.width, height: ecran.height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: url }} style={{ width: ecran.width, height: ecran.height }} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>
        <SafeAreaView style={styles.haut} pointerEvents="box-none">
          {photos.length > 1 ? <Text style={styles.position}>{page + 1} / {photos.length}</Text> : <View />}
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={10} style={styles.fermer}>
            <Text style={styles.fermerTexte}>✕</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  compteur: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(31,27,36,0.6)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  compteurTexte: { fontFamily: fonts.texteGras, fontSize: 12, color: '#FFFFFF' },
  points: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  point: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  pointActif: { backgroundColor: '#FFFFFF' },
  voile: { flex: 1, backgroundColor: '#000000' },
  haut: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  position: { fontFamily: fonts.texteGras, fontSize: 15, color: '#FFFFFF', marginTop: 12 },
  fermer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  fermerTexte: { fontFamily: fonts.texteGras, fontSize: 18, color: '#FFFFFF' },
});
