// « Ton année culturelle » : le bilan de l'année en quelques écrans, comme des stories,
// puis une image à partager. Touche à droite pour avancer, à gauche pour revenir.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconeCulkoko, IconeFermer } from '../components/Icones';
import { calculerBilan, nomUnivers, partagerBilan, type Bilan } from '../lib/bilan';
import { partageCartePossible } from '../lib/carteStory';
import { useSession } from '../lib/session';
import { colors, fonts, univers, universIds } from '../theme';

type Diapo = { fond: string; encre: string; contenu: ReactNode };

export default function EcranBilan() {
  const { session, profil } = useSession();
  const moi = session?.user.id ?? '';
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [probleme, setProbleme] = useState(false);
  const [i, setI] = useState(0);
  const [partage, setPartage] = useState<'attente' | 'en-cours' | 'fait' | 'telechargee'>('attente');

  useEffect(() => {
    if (!moi) return;
    calculerBilan(moi)
      .then(setBilan)
      .catch(() => setProbleme(true));
  }, [moi]);

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/carnet');
  }

  async function partager() {
    if (!bilan) return;
    setPartage('en-cours');
    const r = await partagerBilan(bilan, profil?.pseudo ?? 'moi').catch(() => 'annule' as const);
    setPartage(r === 'telechargee' ? 'telechargee' : r === 'partage' ? 'fait' : 'attente');
  }

  if (!bilan) {
    return (
      <SafeAreaView style={[styles.ecran, { backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' }]}>
        {probleme ? <Text style={[styles.texte, { color: '#FFFFFF' }]}>Impossible de préparer ton année pour l’instant.</Text> : <ActivityIndicator color="#FFFFFF" />}
      </SafeAreaView>
    );
  }

  const a = bilan.annee;
  const diapos: Diapo[] = [];
  diapos.push({
    fond: colors.culkoko,
    encre: '#FFFFFF',
    contenu: (
      <>
        <IconeCulkoko taille={120} couleur="#FFFFFF" plein fond={colors.culkoko} />
        <Text style={[styles.grand, { color: '#FFFFFF' }]}>Ton année culturelle {a}</Text>
        <Text style={[styles.texte, { color: '#FFFFFF' }]}>{bilan.total ? 'Prête pour la rétrospective ? Touche l’écran.' : 'Elle commence ici.'}</Text>
      </>
    ),
  });

  if (bilan.total === 0) {
    diapos.push({
      fond: colors.fond,
      encre: colors.encre,
      contenu: (
        <>
          <Text style={styles.grand}>Rien encore cette année</Text>
          <Text style={styles.texte}>Ajoute les livres, films, concerts et expos que tu as vécus depuis janvier : ton bilan se remplira tout seul.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/enregistrer', params: { mode: 'passe' } })} style={styles.bouton}>
            <Text style={styles.boutonTexte}>Rattraper mon année</Text>
          </Pressable>
        </>
      ),
    });
  } else {
    diapos.push({
      fond: colors.fond,
      encre: colors.encre,
      contenu: (
        <>
          <Text style={styles.chapeau}>En {a}, tu as vécu</Text>
          <Text style={styles.chiffre}>{bilan.total}</Text>
          <Text style={styles.moyen}>{bilan.total > 1 ? 'moments de culture' : 'moment de culture'}</Text>
          <View style={styles.tuiles}>
            {universIds
              .filter((u) => bilan.parUnivers[u] > 0)
              .map((u) => (
                <View key={u} style={[styles.tuile, { backgroundColor: univers[u].teinte }]}>
                  <Text style={styles.tuileChiffre}>{bilan.parUnivers[u]}</Text>
                  <Text style={styles.tuileNom}>{nomUnivers(u, bilan.parUnivers[u])}</Text>
                </View>
              ))}
          </View>
        </>
      ),
    });
    if (bilan.emotions.length)
      diapos.push({
        fond: univers.cine.teinte,
        encre: colors.encre,
        contenu: (
          <>
            <Text style={styles.chapeau}>Ce que la culture t’a fait vivre</Text>
            <Text style={styles.emoji}>{bilan.emotions[0].emoji}</Text>
            <Text style={styles.grand}>{bilan.emotions[0].phrase}</Text>
            {bilan.emotions.slice(1).map((e) => (
              <Text key={e.phrase} style={styles.moyen}>
                {e.emoji} {e.phrase}
              </Text>
            ))}
          </>
        ),
      });
    if (bilan.mois)
      diapos.push({
        fond: univers.concerts.teinte,
        encre: colors.encre,
        contenu: (
          <>
            <Text style={styles.chapeau}>Ton mois le plus culturel</Text>
            <Text style={styles.grand}>{bilan.mois.nom.charAt(0).toUpperCase() + bilan.mois.nom.slice(1)}</Text>
            <Text style={styles.texte}>
              {bilan.mois.n} moment{bilan.mois.n > 1 ? 's' : ''} de culture en un mois. Bravo !
            </Text>
          </>
        ),
      });
    if (bilan.coupsDeCoeur.length)
      diapos.push({
        fond: univers.livres.teinte,
        encre: colors.encre,
        contenu: (
          <>
            <Text style={styles.chapeau}>Tes coups de cœur</Text>
            {bilan.coupsDeCoeur.slice(0, 5).map((t, k) => (
              <Text key={`${t}-${k}`} style={styles.coeur} numberOfLines={2}>
                ❤️ {t}
              </Text>
            ))}
          </>
        ),
      });
    if (bilan.graceAuxAmis || bilan.conseilsJustes || bilan.voyage)
      diapos.push({
        fond: univers.expos.teinte,
        encre: colors.encre,
        contenu: (
          <>
            <Text style={styles.chapeau}>La culture, ça se partage</Text>
            {bilan.graceAuxAmis ? (
              <Text style={styles.moyen}>
                {bilan.graceAuxAmis} découverte{bilan.graceAuxAmis > 1 ? 's' : ''} grâce à tes amis
              </Text>
            ) : null}
            {bilan.conseilsJustes ? (
              <Text style={styles.moyen}>
                🎯 {bilan.conseilsJustes} conseil{bilan.conseilsJustes > 1 ? 's' : ''} qui {bilan.conseilsJustes > 1 ? 'ont' : 'a'} touché juste
              </Text>
            ) : null}
            {bilan.voyage ? (
              <Text style={styles.moyen}>
                Tes conseils ont voyagé jusqu’à {bilan.voyage} personne{bilan.voyage > 1 ? 's' : ''} de plus
              </Text>
            ) : null}
          </>
        ),
      });
    diapos.push({
      fond: colors.culkoko,
      encre: '#FFFFFF',
      contenu: (
        <>
          <Text style={[styles.grand, { color: '#FFFFFF' }]}>Quelle année !</Text>
          <Text style={[styles.texte, { color: '#FFFFFF' }]}>Partage-la avec tes amis, et donne-leur envie de vivre la leur.</Text>
          {partageCartePossible ? (
            <Pressable accessibilityRole="button" onPress={partager} disabled={partage === 'en-cours'} style={[styles.bouton, { backgroundColor: '#FFFFFF' }]}>
              <Text style={[styles.boutonTexte, { color: colors.culkoko }]}>{partage === 'en-cours' ? 'Un instant…' : 'Partager mon année'}</Text>
            </Pressable>
          ) : null}
          {partage === 'telechargee' ? <Text style={[styles.texte, { color: '#FFFFFF' }]}>L’image est dans tes téléchargements : ajoute-la à ta story !</Text> : null}
          {partage === 'fait' ? <Text style={[styles.texte, { color: '#FFFFFF' }]}>Merci de faire connaître Culky !</Text> : null}
        </>
      ),
    });
  }

  const d = diapos[Math.min(i, diapos.length - 1)];
  const derniere = i >= diapos.length - 1;

  return (
    <SafeAreaView style={[styles.ecran, { backgroundColor: d.fond }]}>
      <View style={styles.barres}>
        {diapos.map((_, k) => (
          <View key={k} style={[styles.barre, { backgroundColor: d.encre === '#FFFFFF' ? 'rgba(255,255,255,0.35)' : 'rgba(31,27,36,0.15)' }]}>
            {k <= i ? <View style={[styles.barrePleine, { backgroundColor: d.encre }]} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.entete}>
        <Text style={[styles.petit, { color: d.encre }]}>{profil?.pseudo ?? ''} · {a}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={styles.rond44}>
          <IconeFermer couleur={d.encre} />
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.contenu}>{d.contenu}</View>
        {/* Zones de toucher : à gauche pour revenir, à droite pour avancer (sauf sur la dernière). */}
        <Pressable accessibilityRole="button" accessibilityLabel="Écran précédent" onPress={() => setI(Math.max(0, i - 1))} style={[styles.zone, { left: 0, width: '30%' }]} />
        {!derniere ? <Pressable accessibilityRole="button" accessibilityLabel="Écran suivant" onPress={() => setI(i + 1)} style={[styles.zone, { right: 0, width: '70%' }]} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  barres: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 10 },
  barre: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  barrePleine: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8, zIndex: 2 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  contenu: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  petit: { fontFamily: fonts.texteMoyen, fontSize: 13 },
  chapeau: { fontFamily: fonts.titre, fontSize: 20, color: colors.culkoko, textAlign: 'center' },
  grand: { fontFamily: fonts.titreGras, fontSize: 38, lineHeight: 46, color: colors.culkoko, textAlign: 'center' },
  chiffre: { fontFamily: fonts.titreGras, fontSize: 120, lineHeight: 130, color: colors.culkoko },
  moyen: { fontFamily: fonts.titre, fontSize: 22, lineHeight: 30, color: colors.culkoko, textAlign: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 17, lineHeight: 25, color: colors.gris, textAlign: 'center' },
  emoji: { fontSize: 110 },
  coeur: { fontFamily: fonts.titre, fontSize: 20, lineHeight: 28, color: colors.culkoko, textAlign: 'center' },
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  tuile: { width: 74, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  tuileChiffre: { fontFamily: fonts.titreGras, fontSize: 30, color: colors.encre },
  tuileNom: { fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  bouton: { marginTop: 18, height: 56, paddingHorizontal: 28, borderRadius: 28, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  boutonTexte: { fontFamily: fonts.titre, fontSize: 17, color: '#FFFFFF' },
});
