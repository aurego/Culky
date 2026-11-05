// Inscription, étape 3 : « Qu'est-ce qui te fait vibrer ? » — le choix des univers (maquette « Inscription »).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BoutonPrincipal } from '../../components/Base';
import { Etapes } from '../../components/Etapes';
import { MessageErreur } from '../../components/Formulaire';
import { proposerInstallationPlusTard } from '../../lib/installation';
import { traduireErreur, useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, fonts, univers, universIds, type UniversId } from '../../theme';

const indices: Record<UniversId, string> = {
  livres: 'Romans, BD, essais, poésie',
  cine: 'En salle ou à la maison',
  concerts: 'Musique live, théâtre, danse, cirque, humour',
  expos: 'Musées, galeries, street art',
};

export default function Univers() {
  const { session, profil, rechargerProfil } = useSession();
  const [choisis, setChoisis] = useState<UniversId[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function basculer(id: UniversId) {
    setChoisis(choisis.includes(id) ? choisis.filter((u) => u !== id) : [...choisis, id]);
  }

  async function terminer() {
    if (!supabase || !session || !choisis.length || enCours) return;
    setEnCours(true);
    setErreur(null);
    const ordonnes = universIds.filter((u) => choisis.includes(u));
    const { error } = await supabase
      .from('profils')
      .update({ univers_choisis: ordonnes, inscription_terminee: true })
      .eq('id', session.user.id);
    if (error) {
      setEnCours(false);
      return setErreur(traduireErreur(error.message));
    }
    await proposerInstallationPlusTard(); // sur le web : « Installe Kulky sur ton écran d'accueil », une fois
    await rechargerProfil(); // l'appli s'ouvre alors toute seule sur l'accueil
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Etapes actuelle={3} total={3} />
        <Text accessibilityRole="header" style={styles.titre}>
          {profil?.pseudo ? `${profil.pseudo}, qu’est-ce qui te fait vibrer ?` : 'Qu’est-ce qui te fait vibrer ?'}
        </Text>
        <Text style={styles.sousTitre}>Choisis tes univers. Tu pourras en ajouter à tout moment.</Text>
        <View style={styles.grille}>
          {universIds.map((id) => {
            const u = univers[id];
            const actif = choisis.includes(id);
            return (
              <Pressable
                key={id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: actif }}
                onPress={() => basculer(id)}
                style={[styles.carte, { backgroundColor: actif ? u.teinte : colors.carte, borderColor: actif ? colors.culkoko : '#EFE7DC' }]}
              >
                <View style={[styles.rond, { backgroundColor: actif ? colors.culkoko : u.couleur }]}>
                  {actif ? (
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M5 12l5 5 9-10" />
                    </Svg>
                  ) : null}
                </View>
                <View>
                  <Text style={styles.nom}>{u.label}</Text>
                  <Text style={styles.indice}>{indices[id]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <MessageErreur texte={erreur} />
      </ScrollView>
      <View style={styles.bas}>
        <BoutonPrincipal
          label={enCours ? 'Un instant…' : choisis.length ? 'C’est parti !' : 'Choisis au moins un univers'}
          desactive={!choisis.length || enCours}
          onPress={terminer}
        />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.lien}>
          <Text style={styles.lienTexte}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 24, paddingTop: 24, gap: 18 },
  titre: { fontFamily: fonts.titre, fontSize: 28, lineHeight: 34, color: colors.culkoko, marginTop: 10 },
  sousTitre: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.gris, marginTop: -8 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  carte: { width: '47%', flexGrow: 1, height: 170, borderRadius: 22, borderWidth: 2, padding: 16, justifyContent: 'space-between' },
  rond: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nom: { fontFamily: fonts.titre, fontSize: 19, color: colors.encre },
  indice: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris, marginTop: 2 },
  bas: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.gris },
});
