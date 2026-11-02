// Le cadre général de l'appli : polices, couleur de fond, et la pile d'écrans.
// Il décide aussi quels écrans sont accessibles selon la situation :
//  - personne n'est connecté          → Bienvenue et Connexion
//  - connecté, inscription pas finie   → les étapes d'inscription (pseudo, univers)
//  - connecté et inscrit               → l'appli (onglets et « Nouvelle activité »)
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Poppins_600SemiBold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { supabaseEstConfigure } from '../lib/supabase';
import { colors } from '../theme';

export default function RootLayout() {
  const [policesPretes] = useFonts({
    Poppins_600SemiBold,
    Poppins_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Sur ordinateur, on affiche l'appli dans une colonne de la largeur d'un téléphone. */}
      <View style={styles.fond}>
        <View style={styles.colonne}>
          <SessionProvider>{policesPretes ? <Navigation /> : null}</SessionProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { pret, session, profil } = useSession();
  const dejaAffiche = useRef(false);

  // Au tout premier lancement, on attend de savoir qui est connecté avant d'afficher quoi que ce soit.
  if (!pret && !dejaAffiche.current) return null;
  dejaAffiche.current = true;

  // Sans base configurée, on montre l'appli avec les données d'exemple.
  const connecte = !supabaseEstConfigure || !!session;
  const inscrit = !supabaseEstConfigure || !!profil?.inscription_terminee;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.fond } }}>
      <Stack.Protected guard={!connecte}>
        <Stack.Screen name="bienvenue" />
        <Stack.Screen name="connexion" />
      </Stack.Protected>
      <Stack.Protected guard={connecte && !inscrit}>
        <Stack.Screen name="inscription" />
      </Stack.Protected>
      <Stack.Protected guard={connecte && inscrit}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="enregistrer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="celebration" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="profil/[id]" />
        <Stack.Screen name="penser" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      {/* Accessible à tout moment : on y arrive depuis l'e-mail « mot de passe oublié ». */}
      <Stack.Screen name="nouveau-mot-de-passe" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#EFE7DC' : colors.fond },
  colonne: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.fond, overflow: 'hidden' },
});
