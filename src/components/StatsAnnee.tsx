// Les stats de l'année, sans lourdeur : douze petites colonnes (une par mois, aux couleurs des univers)
// et, s'il y en a, deux ou trois repères en une ligne chacun.
import { StyleSheet, Text, View } from 'react-native';
import type { StatsAnnee as Stats } from '../lib/activites';
import { deNomTexte } from '../lib/scene';
import { colors, fonts, univers, universIds } from '../theme';

function phraseCreateur({ nom, fois, univers: u }: NonNullable<Stats['createurFavori']>) {
  if (u === 'concerts') return `${nom}, ${fois} fois sur scène cette année`;
  const quoi = { livres: 'livres', cine: 'films', expos: 'expos' }[u];
  return `${fois} ${quoi} ${deNomTexte(nom)} cette année`;
}

const initiales = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function StatsAnnee({ stats, cEstMoi }: { stats: Stats; cEstMoi: boolean }) {
  const totaux = stats.mois.map((m) => universIds.reduce((s, u) => s + m[u], 0));
  const max = Math.max(1, ...totaux);
  const moisActuel = new Date().getMonth();
  const reperes = [
    stats.moisFort ? `${cEstMoi ? 'Mon' : 'Son'} mois le plus culturel : ${stats.moisFort}` : null,
    stats.lieuFavori ? `${cEstMoi ? 'Mon' : 'Son'} lieu favori : ${stats.lieuFavori.nom} (${stats.lieuFavori.fois} fois)` : null,
    stats.createurFavori ? phraseCreateur(stats.createurFavori) : null,
  ].filter(Boolean) as string[];
  if (totaux.every((t) => t === 0)) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.graphe} accessible accessibilityLabel={`Activités par mois : ${totaux.map((t, i) => `${initiales[i]} ${t}`).join(', ')}`}>
        {stats.mois.map((m, i) => (
          <View key={i} style={styles.colonne}>
            <View style={styles.barre}>
              {universIds.map((u) =>
                m[u] ? <View key={u} style={{ height: `${(m[u] / max) * 100}%`, backgroundColor: univers[u].couleur, borderRadius: 3 }} /> : null,
              )}
            </View>
            <Text style={[styles.mois, i === moisActuel && { color: colors.culkoko, fontFamily: fonts.texteGras }]}>{initiales[i]}</Text>
          </View>
        ))}
      </View>
      {reperes.map((r) => (
        <Text key={r} style={styles.repere}>
          {r}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  graphe: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 72 },
  colonne: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barre: { flex: 1, width: '70%', justifyContent: 'flex-end', gap: 1 },
  mois: { fontFamily: fonts.texte, fontSize: 10, color: colors.gris },
  repere: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.encre },
});
