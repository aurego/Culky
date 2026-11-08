// En haut du fil, dans l'appli téléphone : on propose (gentiment, une fois) d'être prévenu·e.
// « Plus tard » la fait disparaître une semaine.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activerPush, etatPush } from '../lib/push';
import { colors, fonts } from '../theme';
import { IconeCulkoko } from './Icones';

const CLE_PLUS_TARD = 'kulky-notifs-plus-tard';
const UNE_SEMAINE = 7 * 24 * 3600 * 1000;

export function ProposerNotifications() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    Promise.all([etatPush(), AsyncStorage.getItem(CLE_PLUS_TARD).catch(() => null)])
      .then(([etat, plusTard]) => setVisible(etat === 'a-demander' && (!plusTard || Date.now() - Number(plusTard) > UNE_SEMAINE)))
      .catch(() => undefined);
  }, []);
  if (!visible) return null;
  return (
    <View style={styles.carte}>
      <View style={styles.haut}>
        <IconeCulkoko taille={30} applaudit />
        <Text style={styles.titre}>Ne rate aucun Kulkoko</Text>
      </View>
      <Text style={styles.texte}>Sois prévenu·e quand tes amis t’applaudissent, te commentent ou t’invitent à une sortie.</Text>
      <View style={styles.boutons}>
        <Pressable accessibilityRole="button" onPress={() => activerPush().finally(() => setVisible(false))} style={styles.activer}>
          <Text style={styles.activerTexte}>Activer</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setVisible(false);
            AsyncStorage.setItem(CLE_PLUS_TARD, String(Date.now())).catch(() => undefined);
          }}
          style={styles.plusTard}
        >
          <Text style={styles.plusTardTexte}>Plus tard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: colors.carte, borderRadius: 20, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.bordure },
  haut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titre: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris },
  boutons: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  activer: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  activerTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: '#FFFFFF' },
  plusTard: { minHeight: 44, justifyContent: 'center' },
  plusTardTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.gris },
});
