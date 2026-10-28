// Écran « Nouvelle activité » : le cœur de l'appli, une sortie publiée en 30 secondes.
// Pour l'instant, il fonctionne avec un film d'exemple ; la recherche d'œuvres arrivera ensuite.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BoutonPrincipal } from '../components/Base';
import { IconeFermer, IconeMonde, IconePhoto, IconePlus } from '../components/Icones';
import { emotions, emotionsFavorites } from '../data/emotions';
import { colors, fonts, univers } from '../theme';

const MAX_EMOTIONS = 3;

export default function Enregistrer() {
  const [lieu, setLieu] = useState<'cinema' | 'maison'>('cinema');
  const [choisies, setChoisies] = useState<string[]>([]);
  const [toutes, setToutes] = useState(false);
  const [mots, setMots] = useState('');

  const visibles = toutes ? emotions : emotions.filter((e) => emotionsFavorites.includes(e.id));

  function basculer(id: string) {
    if (choisies.includes(id)) setChoisies(choisies.filter((x) => x !== id));
    else if (choisies.length < MAX_EMOTIONS) setChoisies([...choisies, id]);
  }

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.entete}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={styles.fermer}>
          <IconeFermer />
        </Pressable>
        <Text accessibilityRole="header" style={styles.titre}>Nouvelle activité</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.oeuvre}>
          <View style={[styles.affiche, { backgroundColor: univers.cine.couleur }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.universTexte, { color: univers.cine.texteFonce }]}>Ciné</Text>
            <Text style={styles.titreOeuvre}>[Titre du film]</Text>
            <Text style={styles.petit}>Aujourd’hui · Cinéma Utopia</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.lien}>
            <Text style={styles.lienTexte}>Changer</Text>
          </Pressable>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Où l’as-tu vu ?" style={styles.segment}>
          {(['cinema', 'maison'] as const).map((l) => (
            <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: lieu === l }} onPress={() => setLieu(l)} style={[styles.segmentBouton, lieu === l && { backgroundColor: colors.carte }]}>
              <Text style={styles.segmentTexte}>{l === 'cinema' ? 'Au cinéma' : 'À la maison'}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          <Text style={styles.section}>Qu’as-tu ressenti ?</Text>
          <Text style={[styles.petit, { marginBottom: 10 }]}>
            Jusqu’à {MAX_EMOTIONS} émotions · {choisies.length}/{MAX_EMOTIONS}
          </Text>
          <View style={styles.emotions}>
            {visibles.map((e) => {
              const actif = choisies.includes(e.id);
              return (
                <Pressable key={e.id} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => basculer(e.id)} style={[styles.emotion, actif ? styles.emotionActive : styles.emotionInactive]}>
                  <Text style={[styles.emotionTexte, { color: actif ? '#FFFFFF' : colors.encre }]}>
                    {e.emoji} {e.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setToutes(!toutes)} style={styles.lien}>
            <Text style={styles.lienTexte}>{toutes ? 'Moins d’émotions' : 'Toutes les émotions'}</Text>
          </Pressable>
        </View>

        <View>
          <Text style={[styles.section, { marginBottom: 10 }]}>Avec qui ?</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={styles.ami}>
              <Avatar initiale="P" fond={univers.expos.teinte} taille={32} />
              <Text style={styles.texte}>Paul</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajouter un ami" style={styles.ajouterAmi}>
              <IconePlus taille={18} couleur={colors.gris} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable accessibilityRole="button" style={styles.photo}>
            <IconePhoto />
            <Text style={styles.texte}>Photo</Text>
          </Pressable>
          <View style={{ flex: 2, gap: 4 }}>
            <Text nativeID="label-mots" style={styles.petit}>Quelques mots (facultatif)</Text>
            <TextInput
              accessibilityLabelledBy="label-mots"
              value={mots}
              onChangeText={setMots}
              placeholder="Ce que tu en retiens…"
              placeholderTextColor={colors.gris}
              style={styles.champ}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.pied}>
        <View style={styles.visibilite}>
          <IconeMonde />
          <Text style={styles.petit}>
            Visible par tout le monde · <Text style={{ fontFamily: fonts.texteGras, color: colors.encre }}>Modifier</Text>
          </Text>
        </View>
        <BoutonPrincipal label={choisies.length ? 'Publier' : 'Choisis au moins une émotion'} desactive={!choisies.length} onPress={fermer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.encre },
  contenu: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 18 },
  oeuvre: { backgroundColor: colors.carte, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  affiche: { width: 60, height: 84, borderRadius: 10 },
  universTexte: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre, marginVertical: 2 },
  texte: { fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  lien: { height: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.separateur, padding: 4, borderRadius: 24 },
  segmentBouton: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  segmentTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  section: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre, marginBottom: 4 },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emotion: { height: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', borderWidth: 1 },
  emotionActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  emotionInactive: { backgroundColor: colors.carte, borderColor: colors.bordure },
  emotionTexte: { fontFamily: fonts.texteMoyen, fontSize: 14 },
  ami: { height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 22, backgroundColor: colors.carte, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ajouterAmi: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9AFA3', alignItems: 'center', justifyContent: 'center' },
  photo: { flex: 1, height: 72, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9AFA3', backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center', gap: 4 },
  champ: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 12, fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  pied: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, gap: 10 },
  visibilite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
