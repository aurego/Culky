// Une lecture en cours dans Mon carnet, présentée dans une seule carte :
//   1. le livre et où j'en suis (barre de progression)
//   2. les mots de mes amis déjà débloqués, et ceux qui m'attendent plus loin
//   3. deux actions : « Où j'en suis ? » et « Fini ! »
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { emotionParId } from '../data/emotions';
import { libellePosition, lireEtatLecture, motsDebloques, motsVerrouilles, supprimerMarquePage, type EtatLecture, type MonMarquePage, type MotAmi } from '../lib/marquePages';
import { colors, fonts, univers } from '../theme';
import { Avatar } from './Base';

// Un mot d'ami : qui, à quelle page, son émotion et son petit mot.
export function CarteMot({ m, fond = colors.fond }: { m: MotAmi; fond?: string }) {
  const e = m.emotion ? emotionParId(m.emotion) : null;
  return (
    <View style={[styles.carteMot, { backgroundColor: fond }]}>
      <Avatar initiale={m.pseudo.charAt(0).toUpperCase()} fond={univers.livres.teinte} taille={32} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.qui}>
          {m.pseudo} <Text style={styles.ou}>· {libellePosition(m)}</Text>
        </Text>
        {e ? <Text style={styles.emotion}>{e.emoji} {e.label}</Text> : null}
        {m.mot ? <Text style={styles.mot}>« {m.mot} »</Text> : null}
      </View>
    </View>
  );
}

// Un de mes mots : je peux le retirer (avec une confirmation).
function MonMot({ m, onRetire }: { m: MonMarquePage; onRetire: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const e = m.emotion ? emotionParId(m.emotion) : null;
  return (
    <View style={[styles.carteMot, styles.monMot]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.qui}>
          Toi <Text style={styles.ou}>· {libellePosition(m)}</Text>
        </Text>
        {e ? <Text style={styles.emotion}>{e.emoji} {e.label}</Text> : null}
        {m.mot ? <Text style={styles.mot}>« {m.mot} »</Text> : null}
        {confirmer ? (
          <View style={styles.confirmation}>
            <Pressable accessibilityRole="button" onPress={onRetire} style={styles.petitBouton}>
              <Text style={[styles.lienTexte, { color: '#9B2335' }]}>Oui, retirer ce mot</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirmer(false)} style={styles.petitBouton}>
              <Text style={[styles.lienTexte, { color: colors.gris }]}>Annuler</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {!confirmer ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer mon mot (${libellePosition(m)})`} onPress={() => setConfirmer(true)} style={styles.retirer}>
          <Text style={styles.retirerTexte}>Retirer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// La première fois : un petit encart qui explique les mots entre les pages. On le ferme une fois pour toutes.
const CLE_TUTO = 'kulky-tuto-petits-mots';
export function TutoPetitsMots() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CLE_TUTO).then((v) => setVisible(!v), () => setVisible(true));
  }, []);
  if (!visible) return null;
  function fermer() {
    setVisible(false);
    AsyncStorage.setItem(CLE_TUTO, '1').catch(() => undefined);
  }
  const etapes = [
    ['📍', 'Note la page où tu en es.'],
    ['💌', 'Si tu veux, glisse un mot ou une émotion à cette page.'],
    ['🔒', 'Tes amis qui lisent le même livre le découvriront en arrivant à cette page, jamais avant : zéro spoiler.'],
  ];
  return (
    <View style={styles.tuto} accessibilityRole="summary">
      <Text style={styles.tutoTitre}>Des petits mots entre les pages</Text>
      {etapes.map(([emoji, texte]) => (
        <View key={emoji} style={styles.tutoLigne}>
          <Text style={styles.tutoEmoji}>{emoji}</Text>
          <Text style={styles.tutoTexte}>{texte}</Text>
        </View>
      ))}
      <Text style={styles.tutoTexte}>Et quand une amie t’a laissé un mot plus loin, Kulky te le dit : de quoi avoir envie de tourner les pages.</Text>
      <Pressable accessibilityRole="button" onPress={fermer} style={styles.tutoBouton}>
        <Text style={styles.tutoBoutonTexte}>J’ai compris</Text>
      </Pressable>
    </View>
  );
}

export function MotsEnAttente({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <View style={styles.attente}>
      <Text style={styles.attenteTitre}>
        {n} mot{n > 1 ? 's' : ''} t’attend{n > 1 ? 'ent' : ''} plus loin
      </Text>
      <Text style={styles.attenteTexte}>Continue ta lecture pour {n > 1 ? 'les' : 'le'} découvrir.</Text>
    </View>
  );
}

export function LectureEnCours({
  activiteId,
  oeuvreId,
  titre,
  moi,
  entete,
  options,
  onFini,
}: {
  activiteId: string;
  oeuvreId: string;
  titre: string;
  moi: string;
  entete: ReactNode; // la ligne du livre (vignette, titre, bouton ⋯)
  options?: ReactNode; // le panneau d'options quand il est ouvert
  onFini: () => void;
}) {
  const [etat, setEtat] = useState<EtatLecture | null>(null);
  const [tout, setTout] = useState(false);

  const charger = useCallback(
    () =>
      lireEtatLecture(oeuvreId, moi)
        .then(setEtat)
        .catch(() => setEtat(null)), // complément SQL n° 5 pas encore installé : la carte reste simple
    [oeuvreId, moi],
  );
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );
  const [voirMiens, setVoirMiens] = useState(false);

  const debloques = etat ? motsDebloques(etat.mots) : [];
  const verrouilles = etat ? motsVerrouilles(etat.mots).length : 0;
  const p = etat?.moi?.progression ?? 0;
  const visibles = tout ? debloques : debloques.slice(-2);

  return (
    <View style={styles.carte}>
      {entete}

      {etat?.moi ? (
        <View style={{ gap: 6 }}>
          <View style={styles.barre} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}>
            <View style={[styles.rempli, { width: `${Math.max(3, p)}%` }]} />
          </View>
          <Text style={styles.position}>
            {etat.moi.page ? (
              <>
                Page {etat.moi.page}
                {etat.nbPages ? ` sur ${etat.nbPages}` : ''} <Text style={styles.pourcent}>· {Math.round(p)} %</Text>
              </>
            ) : (
              `Lu à ${Math.round(p)} %`
            )}
          </Text>
        </View>
      ) : null}

      {debloques.length > 0 || verrouilles > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Les mots de mes amis</Text>
          {visibles.map((m) => (
            <CarteMot key={m.id} m={m} />
          ))}
          {debloques.length > 2 && !tout ? (
            <Pressable accessibilityRole="button" onPress={() => setTout(true)} style={styles.lien}>
              <Text style={styles.lienTexte}>Voir les {debloques.length} mots débloqués</Text>
            </Pressable>
          ) : null}
          <MotsEnAttente n={verrouilles} />
        </View>
      ) : null}

      {etat && etat.mesMots.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Mes mots</Text>
          {(voirMiens ? etat.mesMots : etat.mesMots.slice(-1)).map((m) => (
            <MonMot key={m.id} m={m} onRetire={() => supprimerMarquePage(m.id).then(charger, charger)} />
          ))}
          {etat.mesMots.length > 1 && !voirMiens ? (
            <Pressable accessibilityRole="button" onPress={() => setVoirMiens(true)} style={styles.lien}>
              <Text style={styles.lienTexte}>Voir mes {etat.mesMots.length} mots</Text>
            </Pressable>
          ) : null}
          <Text style={styles.aide}>Tes amis les découvriront en arrivant à ces pages.</Text>
        </View>
      ) : null}

      {options}

      {etat && !etat.moi && etat.mesMots.length === 0 ? (
        <Text style={styles.aide}>💌 En notant ta page, tu peux y glisser un mot : tes amis qui lisent ce livre le découvriront en arrivant à cette page.</Text>
      ) : null}

      <View style={styles.actions}>
        {etat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Noter ma page dans ${titre}, et laisser un mot si je veux`}
            onPress={() => router.push({ pathname: '/marque-page', params: { activite: activiteId, oeuvre: oeuvreId, titre } })}
            style={[styles.bouton, styles.boutonContour]}
          >
            <Text style={[styles.boutonTexte, { color: colors.culkoko }]} numberOfLines={1}>{etat.moi ? 'J’avance' : 'Noter ma page'}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`J’ai fini ${titre}`} onPress={onFini} style={[styles.bouton, styles.boutonPlein]}>
          <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>Fini !</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: colors.carte, borderRadius: 18, padding: 14, gap: 14 },
  barre: { height: 8, borderRadius: 4, backgroundColor: colors.beige, overflow: 'hidden' },
  rempli: { height: 8, borderRadius: 4, backgroundColor: univers.livres.couleur },
  position: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.encre },
  pourcent: { fontFamily: fonts.texte, color: colors.gris },
  section: { gap: 8, borderTopWidth: 1, borderTopColor: colors.separateur, paddingTop: 12 },
  sectionTitre: { fontFamily: fonts.texteGras, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.gris },
  carteMot: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 12 },
  qui: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  ou: { fontFamily: fonts.texte, color: colors.gris },
  emotion: { fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  mot: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre, fontStyle: 'italic' },
  attente: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.bordure, padding: 12, gap: 2, alignItems: 'center' },
  attenteTitre: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  attenteTexte: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  monMot: { backgroundColor: univers.livres.teinte },
  retirer: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  retirerTexte: { fontFamily: fonts.texteMoyen, fontSize: 13, color: colors.gris },
  confirmation: { flexDirection: 'row', gap: 16, marginTop: 4 },
  petitBouton: { minHeight: 44, justifyContent: 'center' },
  aide: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris },
  tuto: { backgroundColor: univers.livres.teinte, borderRadius: 18, padding: 16, gap: 8 },
  tutoTitre: { fontFamily: fonts.titre, fontSize: 16, color: univers.livres.texteFonce },
  tutoLigne: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tutoEmoji: { fontSize: 16, lineHeight: 21, width: 22 },
  tutoTexte: { flex: 1, fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  tutoBouton: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: univers.livres.texteFonce, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  tutoBoutonTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
  lien: { minHeight: 44, justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
  actions: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  boutonContour: { borderWidth: 1.5, borderColor: colors.culkoko },
  boutonPlein: { backgroundColor: colors.culkoko },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
});
