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
import { useCallback, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AnimationArrivee } from '../components/AnimationArrivee';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { codeDansLAdresse, garderCode } from '../lib/invitation';
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
          <SessionProvider>
            {policesPretes ? <Navigation /> : null}
            {policesPretes ? <EcranArrivee /> : null}
          </SessionProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

// Anciens liens d'invitation (« /?invitation=code ») : on garde le code pour après l'inscription.
const ancienCode = codeDansLAdresse();
if (ancienCode) garderCode(ancienCode);

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
        <Stack.Screen name="sortie" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="marque-page" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bilan" options={{ animation: 'fade' }} />
        <Stack.Screen name="activite/[id]" />
        <Stack.Screen name="reglages" />
        <Stack.Screen name="a-propos" />
        <Stack.Screen name="amis" />
      </Stack.Protected>
      {/* Accessibles à tout moment : le lien d'un conseil reçu, l'e-mail « mot de passe oublié » et les pages légales. */}
      <Stack.Screen name="invitation/[code]" />
      <Stack.Screen name="rejoindre/[id]" />
      <Stack.Screen name="nouveau-mot-de-passe" />
      <Stack.Screen name="legal" />
    </Stack>
  );
}

// À l'ouverture de l'appli (une fois par visite), quand on est déjà connecté·e : l'animation d'arrivée,
// par-dessus l'accueil. Un toucher la passe. Sur l'écran de bienvenue, elle est déjà dans la page.
let dejaVue = false;
function EcranArrivee() {
  const { pret, session, profil } = useSession();
  const [visible, setVisible] = useState(!dejaVue);
  const opacite = useRef(new Animated.Value(1)).current;
  const fermer = useCallback(() => {
    dejaVue = true;
    Animated.timing(opacite, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => setVisible(false));
  }, [opacite]);
  if (!visible || !pret) return null;
  if (!session || !profil?.inscription_terminee) {
    dejaVue = true;
    return null;
  }
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.arrivee, { opacity: opacite }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Entrer dans Kulky" onPress={fermer} style={styles.arriveeZone}>
        <AnimationArrivee taille={64} onFini={fermer} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  arrivee: { backgroundColor: colors.fond, zIndex: 10 },
  arriveeZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fond: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#EFE7DC' : colors.fond },
  colonne: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.fond, overflow: 'hidden' },
});
