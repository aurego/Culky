// Les marque-pages dans Mon carnet : la progression d'une lecture en cours,
// les mots des amis déjà débloqués, et ceux qui attendent plus loin.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { emotionParId } from '../data/emotions';
import { libellePosition, lireEtatLecture, motsDebloques, motsVerrouilles, type EtatLecture, type MotAmi } from '../lib/marquePages';
import { colors, fonts, univers } from '../theme';

export function CarteMot({ m }: { m: MotAmi }) {
  const e = m.emotion ? emotionParId(m.emotion) : null;
  return (
    <View style={styles.carteMot}>
      <Text style={styles.qui}>
        {m.pseudo} · {libellePosition(m)}
      </Text>
      {e ? <Text style={styles.texte}>{e.emoji} {e.label}</Text> : null}
      {m.mot ? <Text style={styles.mot}>« {m.mot} »</Text> : null}
    </View>
  );
}

export function LectureEnCours({ activiteId, oeuvreId, titre, moi }: { activiteId: string; oeuvreId: string; titre: string; moi: string }) {
  const [etat, setEtat] = useState<EtatLecture | null>(null);
  const [indisponible, setIndisponible] = useState(false);
  const [tout, setTout] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let annule = false;
      lireEtatLecture(oeuvreId, moi)
        .then((e) => !annule && (setEtat(e), setIndisponible(false)))
        .catch(() => !annule && setIndisponible(true)); // complément SQL n° 5 pas encore installé
      return () => {
        annule = true;
      };
    }, [oeuvreId, moi]),
  );

  if (indisponible || !etat) return null;
  const debloques = motsDebloques(etat.mots);
  const verrouilles = motsVerrouilles(etat.mots).length;
  const p = etat.moi?.progression ?? 0;
  const visibles = tout ? debloques : debloques.slice(-2);

  return (
    <View style={styles.bloc}>
      {etat.moi ? (
        <View style={{ gap: 6 }}>
          <View style={styles.barre} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}>
            <View style={[styles.rempli, { width: `${Math.max(3, p)}%` }]} />
          </View>
          <Text style={styles.petit}>
            {etat.moi.page ? `Page ${etat.moi.page}${etat.nbPages ? ` sur ${etat.nbPages}` : ''} · ` : ''}
            {Math.round(p)} %
          </Text>
        </View>
      ) : null}

      {visibles.map((m) => (
        <CarteMot key={m.id} m={m} />
      ))}
      {debloques.length > 2 && !tout ? (
        <Pressable accessibilityRole="button" onPress={() => setTout(true)} style={styles.lien}>
          <Text style={styles.lienTexte}>Voir les {debloques.length} mots débloqués</Text>
        </Pressable>
      ) : null}
      {verrouilles > 0 ? (
        <Text style={styles.attente}>
          {verrouilles} mot{verrouilles > 1 ? 's' : ''} de tes amis t’attend{verrouilles > 1 ? 'ent' : ''} plus loin
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Où j’en suis dans ${titre} ?`}
        onPress={() => router.push({ pathname: '/marque-page', params: { activite: activiteId, oeuvre: oeuvreId, titre } })}
        style={styles.bouton}
      >
        <Text style={styles.boutonTexte}>Où j’en suis ?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { backgroundColor: colors.carte, borderRadius: 14, padding: 12, gap: 10 },
  barre: { height: 8, borderRadius: 4, backgroundColor: colors.beige, overflow: 'hidden' },
  rempli: { height: 8, borderRadius: 4, backgroundColor: univers.livres.couleur },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  texte: { fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  carteMot: { backgroundColor: colors.fond, borderRadius: 14, padding: 12, gap: 4 },
  qui: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
  mot: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre, fontStyle: 'italic' },
  attente: { fontFamily: fonts.texteMoyen, fontSize: 13, color: colors.gris },
  lien: { minHeight: 36, justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
  bouton: { height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.encre, alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
});
