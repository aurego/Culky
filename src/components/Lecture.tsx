// Une lecture en cours dans Mon carnet, présentée dans une seule carte :
//   1. le livre et où j'en suis (barre de progression)
//   2. les mots de mes amis déjà débloqués, et ceux qui m'attendent plus loin
//   3. deux actions : « Où j'en suis ? » et « Fini ! »
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { emotionParId } from '../data/emotions';
import { libellePosition, lireEtatLecture, motsDebloques, motsVerrouilles, type EtatLecture, type MotAmi } from '../lib/marquePages';
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
        {m.mot ? <Text style={styles.mot}>« {m.mot} »</Text> : null}
      </View>
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

  useFocusEffect(
    useCallback(() => {
      let annule = false;
      lireEtatLecture(oeuvreId, moi)
        .then((e) => !annule && setEtat(e))
        .catch(() => !annule && setEtat(null)); // complément SQL n° 5 pas encore installé : la carte reste simple
      return () => {
        annule = true;
      };
    }, [oeuvreId, moi]),
  );

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
              `${Math.round(p)} % lus`
            )}
          </Text>
        </View>
      ) : null}

      {debloques.length > 0 || verrouilles > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Les mots de tes amis</Text>
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

      {options}

      <View style={styles.actions}>
        {etat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Où j’en suis dans ${titre} ?`}
            onPress={() => router.push({ pathname: '/marque-page', params: { activite: activiteId, oeuvre: oeuvreId, titre } })}
            style={[styles.bouton, styles.boutonContour]}
          >
            <Text style={[styles.boutonTexte, { color: colors.encre }]}>Où j’en suis ?</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`J’ai fini ${titre}`} onPress={onFini} style={[styles.bouton, styles.boutonPlein]}>
          <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>Fini !</Text>
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
  lien: { minHeight: 36, justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
  actions: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  boutonContour: { borderWidth: 1.5, borderColor: colors.encre },
  boutonPlein: { backgroundColor: colors.culkoko },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
});
