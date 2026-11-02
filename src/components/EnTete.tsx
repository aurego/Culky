// Les en-têtes, identiques partout :
//  - EnTeteOnglet : en haut des onglets (titre, puis Mes amis et la cloche à droite) ;
//  - EnTetePage   : en haut des autres écrans (flèche de retour, titre centré, action à droite).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { compterNonLues, preparerRappels } from '../lib/notifications';
import { useSession } from '../lib/session';
import { colors, fonts } from '../theme';
import { IconeAmis, IconeCloche, IconeFermer, IconeRetour } from './Icones';

export function BoutonCloche() {
  const { session } = useSession();
  const moi = session?.user.id;
  const [nonLues, setNonLues] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!moi) return;
      preparerRappels()
        .catch(() => undefined)
        .then(() => compterNonLues(moi))
        .then(setNonLues)
        .catch(() => undefined);
    }, [moi]),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nonLues ? `Notifications, ${nonLues} nouvelle${nonLues > 1 ? 's' : ''}` : 'Notifications'}
      onPress={() => router.push('/notifications')}
      style={styles.rond}
    >
      <IconeCloche />
      {nonLues > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTexte}>{nonLues > 9 ? '9+' : nonLues}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function BoutonAmis() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Mes amis" onPress={() => router.push('/amis')} style={styles.rond}>
      <IconeAmis />
    </Pressable>
  );
}

export function EnTeteOnglet({ titre, gauche, sousTitre }: { titre?: string; gauche?: ReactNode; sousTitre?: string }) {
  return (
    <View style={styles.onglet}>
      <View style={styles.ligne}>
        <View style={{ flex: 1 }}>{gauche ?? <Text accessibilityRole="header" style={styles.titreOnglet}>{titre}</Text>}</View>
        <View style={styles.droite}>
          <BoutonAmis />
          <BoutonCloche />
        </View>
      </View>
      {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
    </View>
  );
}

export function retourOu(chemin: '/' | '/carnet' | '/pour-toi' | '/envies' = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(chemin);
}

export function EnTetePage({ titre, droite, fermer, onRetour }: { titre?: string; droite?: ReactNode; fermer?: boolean; onRetour?: () => void }) {
  return (
    <View style={styles.page}>
      <Pressable accessibilityRole="button" accessibilityLabel={fermer ? 'Fermer' : 'Retour'} onPress={onRetour ?? (() => retourOu())} style={styles.rond44}>
        {fermer ? <IconeFermer /> : <IconeRetour />}
      </Pressable>
      {titre ? (
        <Text accessibilityRole="header" style={styles.titrePage} numberOfLines={1}>
          {titre}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={styles.rond44}>{droite}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  onglet: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10, gap: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  droite: { flexDirection: 'row', gap: 8 },
  titreOnglet: { fontFamily: fonts.titreGras, fontSize: 28, color: colors.culkoko },
  sousTitre: { fontFamily: fonts.texte, fontSize: 14, color: colors.gris },
  rond: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  badgeTexte: { fontFamily: fonts.texteGras, fontSize: 11, color: '#FFFFFF' },
  page: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titrePage: { flex: 1, textAlign: 'center', fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
});
