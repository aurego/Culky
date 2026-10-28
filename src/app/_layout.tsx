// Le cadre général de l'appli : polices, couleur de fond, et la pile d'écrans
// (les onglets, plus l'écran « Nouvelle activité » qui s'ouvre par-dessus).
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Poppins_600SemiBold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function RootLayout() {
  const [policesPretes] = useFonts({
    Poppins_600SemiBold,
    Poppins_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!policesPretes) return <View style={styles.fond} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Sur ordinateur, on affiche l'appli dans une colonne de la largeur d'un téléphone. */}
      <View style={styles.fond}>
        <View style={styles.colonne}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.fond } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="enregistrer" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#EFE7DC' : colors.fond },
  colonne: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.fond, overflow: 'hidden' },
});
