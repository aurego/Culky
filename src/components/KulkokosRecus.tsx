// En arrivant dans l'appli : si des amis m'ont envoyé des Kulkokos depuis ma dernière visite,
// une petite fête s'ouvre (le Kulkoko danse, qui m'applaudit, pour quoi). On ne la montre qu'une fois par nouveauté.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { lireNotifications, marquerLues, type Notification } from '../lib/notifications';
import { colors, fonts } from '../theme';
import { BoutonPrincipal } from './Base';
import { IconeCulkoko } from './Icones';

const CLE_VUS = 'kulky-kulkokos-vus'; // date du dernier Kulkoko déjà fêté

function quiApplaudit(notifs: Notification[]): string {
  const noms = [...new Set(notifs.map((n) => n.acteur?.pseudo ?? 'Quelqu’un'))];
  if (noms.length === 1) return `${noms[0]} t’applaudit`;
  if (noms.length === 2) return `${noms[0]} et ${noms[1]} t’applaudissent`;
  return `${noms[0]}, ${noms[1]} et ${noms.length - 2} autre${noms.length > 3 ? 's' : ''} t’applaudissent`;
}

export function KulkokosRecus({ moi }: { moi: string }) {
  const [nouveaux, setNouveaux] = useState<Notification[]>([]);
  const danse = useRef(new Animated.Value(0)).current;
  const apparition = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (!moi) return;
      let annule = false;
      (async () => {
        const [notifs, vus] = await Promise.all([lireNotifications(moi), AsyncStorage.getItem(CLE_VUS).catch(() => null)]);
        const frais = notifs.filter((n) => n.type === 'culkoko' && !n.lue && (!vus || n.cree_le > vus));
        if (!annule && frais.length) setNouveaux(frais);
      })().catch(() => undefined);
      return () => {
        annule = true;
      };
    }, [moi]),
  );

  useEffect(() => {
    if (!nouveaux.length) return;
    const natif = Platform.OS !== 'web';
    Animated.spring(apparition, { toValue: 1, useNativeDriver: natif, friction: 6 }).start();
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(danse, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: natif }),
        Animated.timing(danse, { toValue: -1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: natif }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [nouveaux.length, apparition, danse]);

  if (!nouveaux.length) return null;

  async function fermer(voir: boolean) {
    const plusRecent = nouveaux.reduce((m, n) => (n.cree_le > m ? n.cree_le : m), '');
    await AsyncStorage.setItem(CLE_VUS, plusRecent).catch(() => undefined);
    // Fêtés ici : ils ne restent pas « nouveaux » sous la cloche.
    marquerLues(nouveaux.map((n) => n.id)).catch(() => undefined);
    // « Voir » ouvre l'activité annoncée dans le message (la plus applaudie).
    const activite = principal[0].activite_id;
    setNouveaux([]);
    if (voir && activite) router.push({ pathname: '/activite/[id]', params: { id: activite } });
  }

  // Le titre de l'œuvre la plus applaudie, et combien d'autres.
  const parOeuvre = new Map<string, Notification[]>();
  nouveaux.forEach((n) => parOeuvre.set(n.activite_id ?? n.id, [...(parOeuvre.get(n.activite_id ?? n.id) ?? []), n]));
  const groupes = [...parOeuvre.values()].sort((a, b) => b.length - a.length);
  const principal = groupes[0];
  const titre = principal[0].oeuvre?.titre;
  const total = nouveaux.length;

  return (
    <View style={styles.voile} accessibilityViewIsModal>
      <Animated.View style={[styles.carte, { opacity: apparition, transform: [{ scale: apparition.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <Animated.View style={{ transform: [{ rotate: danse.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) }, { translateY: danse.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, -8, 0] }) }] }}>
          <View style={styles.rond}>
            <IconeCulkoko taille={84} plein />
          </View>
        </Animated.View>
        <Text accessibilityRole="header" style={styles.titre}>
          {total > 1 ? `${total} Kulkokos pour toi !` : 'Un Kulkoko pour toi !'}
        </Text>
        <Text style={styles.texte}>
          {quiApplaudit(principal)}
          {titre ? ` pour «\u00a0${titre}\u00a0»` : ''}
          {groupes.length > 1 ? ` et ${groupes.length - 1} autre${groupes.length > 2 ? 's' : ''} de tes activités` : ''}.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 4, marginTop: 6 }}>
          <BoutonPrincipal label="Voir" onPress={() => fermer(true)} />
          <Pressable accessibilityRole="button" onPress={() => fermer(false)} style={styles.lien}>
            <Text style={styles.lienTexte}>Fermer</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  voile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(31,27,36,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  carte: { width: '100%', maxWidth: 360, backgroundColor: colors.carte, borderRadius: 28, padding: 24, alignItems: 'center', gap: 10 },
  rond: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#F4E3E6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  titre: { fontFamily: fonts.titreGras, fontSize: 24, color: colors.culkoko, textAlign: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.encre, textAlign: 'center' },
  lien: { height: 44, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.sousTitre },
});
