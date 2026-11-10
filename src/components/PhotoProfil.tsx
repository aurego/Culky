// La photo de profil : on la touche pour la voir en grand (comme sur Instagram), on touche à nouveau pour fermer.
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { colors, fonts } from '../theme';
import { Avatar } from './Base';

export function PhotoProfil({ pseudo, photo, fond, taille = 80 }: { pseudo: string; photo: string | null | undefined; fond: string; taille?: number }) {
  const [ouverte, setOuverte] = useState(false);
  const ecran = useWindowDimensions();
  const grande = Math.min(ecran.width - 48, ecran.height * 0.6, 420);
  const avatar = <Avatar initiale={pseudo.charAt(0).toUpperCase()} fond={fond} taille={taille} photo={photo} />;
  if (!photo) return avatar;
  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Agrandir la photo de ${pseudo}`} onPress={() => setOuverte(true)}>
        {avatar}
      </Pressable>
      <Modal visible={ouverte} transparent animationType="fade" onRequestClose={() => setOuverte(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer la photo" onPress={() => setOuverte(false)} style={styles.voile}>
          <Image source={{ uri: photo }} style={{ width: grande, height: grande, borderRadius: grande / 2 }} resizeMode="cover" accessibilityLabel={`Photo de ${pseudo}`} />
          <Text style={styles.nom}>{pseudo}</Text>
          <Text style={styles.aide}>Touche pour fermer</Text>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(31,27,36,0.88)', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  nom: { fontFamily: fonts.titre, fontSize: 22, color: '#FFFFFF', marginTop: 8 },
  aide: { fontFamily: fonts.texte, fontSize: 14, color: colors.beige, opacity: 0.8 },
});
