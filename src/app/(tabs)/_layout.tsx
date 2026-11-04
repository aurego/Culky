// La barre d'onglets en bas de l'écran : Accueil, Envies, +, Pour toi, Mon carnet.
// Le bouton central « + » ouvre l'écran « Nouvelle activité ».
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconeAccueil, IconeCarnet, IconeEnvies, IconePensee, IconePlus } from '../../components/Icones';
import { accepterInvitation, codeEnAttente, oublierCode, oublierParrain, parrainEnAttente, rejoindre } from '../../lib/invitation';
import { colors, fonts } from '../../theme';

export default function TabsLayout() {
  // Arrivé·e par un lien d'invitation ? Maintenant que le compte existe, on rattache le conseil.
  useEffect(() => {
    let annule = false;
    (async () => {
      // Invité·e par un ami (« Rejoins-moi sur Kulky ») : on se suit l'un l'autre.
      const parrain = await parrainEnAttente();
      if (parrain) {
        const fait = await rejoindre(parrain).catch(() => false);
        await oublierParrain();
        if (fait && !annule) router.push({ pathname: '/profil/[id]', params: { id: parrain } });
      }
      const code = await codeEnAttente();
      if (!code) return;
      const arrive = await accepterInvitation(code).catch(() => false);
      await oublierCode();
      if (arrive && !annule) router.push('/pour-toi');
    })();
    return () => {
      annule = true;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.culkoko,
        tabBarInactiveTintColor: colors.gris,
        tabBarStyle: { backgroundColor: colors.carte, borderTopColor: '#EFE7DC', height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontFamily: fonts.texteMoyen, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.fond },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Fil d’actu',
          tabBarIcon: ({ focused }) => <IconeAccueil couleur={focused ? colors.culkoko : colors.gris} epaisseur={focused ? 2 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="envies"
        options={{
          title: 'Mes envies',
          tabBarIcon: ({ focused }) => <IconeEnvies couleur={focused ? colors.culkoko : colors.gris} epaisseur={focused ? 2 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="nouvelle"
        options={{
          title: 'Enregistrer',
          tabBarLabel: () => null,
          tabBarButton: () => (
            <View style={styles.zonePlus}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enregistrer une activité"
                onPress={() => router.push('/enregistrer')}
                style={styles.boutonPlus}
              >
                <IconePlus taille={28} couleur="#FFFFFF" epaisseur={2.4} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="pour-toi"
        options={{
          title: 'Pour moi',
          tabBarIcon: ({ focused }) => <IconePensee couleur={focused ? colors.culkoko : colors.gris} epaisseur={focused ? 2 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="carnet"
        options={{
          title: 'Mon carnet',
          tabBarIcon: ({ focused }) => <IconeCarnet couleur={focused ? colors.culkoko : colors.gris} epaisseur={focused ? 2 : 1.8} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  zonePlus: { flex: 1, alignItems: 'center' },
  boutonPlus: {
    width: 58,
    height: 58,
    marginTop: -18,
    borderRadius: 29,
    backgroundColor: colors.culkoko,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.culkoko,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
