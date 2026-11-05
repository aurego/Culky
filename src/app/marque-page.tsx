// « Où j'en suis ? » : noter sa page en deux secondes, avec un petit mot ou une émotion si on veut.
// Après l'enregistrement, on montre les mots d'amis qu'on vient de débloquer en avançant.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BoutonPrincipal } from '../components/Base';
import { CarteMot, MotsEnAttente } from '../components/Lecture';
import { MessageErreur } from '../components/Formulaire';
import { IconeFermer } from '../components/Icones';
import { emotionParId, emotions } from '../data/emotions';
import { completerNbPages, PAGES_MAX, PAGES_MIN, libellePosition, lireEtatLecture, motsDebloques, motsVerrouilles, poserMarquePage, progressionDe, type EtatLecture, type MotAmi } from '../lib/marquePages';
import { traduireErreur, useSession } from '../lib/session';
import { colors, fonts, univers } from '../theme';

// Les émotions qu'on propose en cours de lecture (les mêmes que pour une activité, en version courte).
const emotionsLecture = ['coup-de-coeur', 'captive', 'surpris', 'mort-de-rire', 'emu', 'frissons', 'questionne', 'habite']
  .map((id) => emotionParId(id))
  .filter((e): e is (typeof emotions)[number] => !!e);

export default function MarquePage() {
  const { activite, oeuvre, titre } = useLocalSearchParams<{
    activite: string;
    oeuvre: string;
    titre?: string;
  }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [etat, setEtat] = useState<EtatLecture | null>(null);
  const [mode, setMode] = useState<'page' | 'pourcent'>('page');
  const [page, setPage] = useState('');
  const [total, setTotal] = useState('');
  const [pourcent, setPourcent] = useState('');
  const [emotion, setEmotion] = useState<string | null>(null);
  const [mot, setMot] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{
    position: string;
    nouveaux: MotAmi[];
    restants: number;
    fin: boolean; // dernière page ou 100 % : on propose « Fini ! »
  } | null>(null);

  useEffect(() => {
    if (!oeuvre || !moi) return;
    lireEtatLecture(oeuvre, moi)
      .then((e) => {
        setEtat(e);
        // On repart de là où j'en étais : pour écrire un mot sans avancer, il suffit de l'écrire.
        if (e.moi?.page) setPage(String(e.moi.page));
        else if (e.moi) {
          setMode('pourcent');
          setPourcent(String(Math.round(e.moi.progression)));
        }
      })
      .catch(() => setErreur('Impossible de charger ta lecture pour l’instant.'))
      .finally(() => setChargement(false));
  }, [oeuvre, moi]);

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/carnet');
  }

  const nbPages = etat?.nbPages ?? (Number(total) > 0 ? Number(total) : null);

  async function enregistrer() {
    if (!activite || !oeuvre || !moi || !etat) return;
    setErreur(null);
    let progression: number;
    let numeroPage: number | null = null;
    if (mode === 'page') {
      numeroPage = Math.round(Number(page));
      if (!numeroPage || numeroPage < 1) return setErreur('Indique la page où tu en es.');
      if (!nbPages) return setErreur('Indique aussi le nombre de pages du livre, pour que les mots de tes amis s’ouvrent au bon moment.');
      if (!etat.nbPages && (nbPages < PAGES_MIN || nbPages > PAGES_MAX)) return setErreur(`Un livre compte entre ${PAGES_MIN} et ${PAGES_MAX} pages : vérifie le nombre de pages.`);
      if (numeroPage > nbPages) return setErreur(`Le livre fait ${nbPages} pages : vérifie ta page.`);
      progression = progressionDe(numeroPage, nbPages);
    } else {
      progression = Number(pourcent.replace(',', '.'));
      if (!(progression > 0 && progression <= 100)) return setErreur('Indique un pourcentage entre 1 et 100.');
    }
    setEnCours(true);
    try {
      if (!etat.nbPages && mode === 'page' && nbPages) await completerNbPages(oeuvre, nbPages);
      const avant = new Set(motsDebloques(etat.mots).map((m) => m.id));
      await poserMarquePage({
        activiteId: activite,
        oeuvreId: oeuvre,
        auteurId: moi,
        page: numeroPage,
        progression,
        mot,
        emotion,
      });
      const apres = await lireEtatLecture(oeuvre, moi);
      setResultat({
        position: numeroPage ? `Page ${numeroPage}` : `${Math.round(progression)} %`,
        nouveaux: motsDebloques(apres.mots).filter((m) => !avant.has(m.id)),
        restants: motsVerrouilles(apres.mots).length,
        fin: progression >= 100,
      });
    } catch (e) {
      setErreur(traduireErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (resultat)
    return (
      <Resultat
        titre={titre ?? ''}
        {...resultat}
        onFermer={fermer}
        onFini={() => router.replace({ pathname: '/enregistrer', params: { modifier: activite, finir: '1' } })}
      />
    );

  const dernier = etat?.moi;
  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={styles.rond44}>
            <IconeFermer />
          </Pressable>
          <Text accessibilityRole="header" style={styles.titre}>
            Où j’en suis
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <View style={[styles.oeuvre, { backgroundColor: univers.livres.teinte }]}>
            <Text style={styles.titreOeuvre} numberOfLines={2}>
              {titre}
            </Text>
            {dernier ? <Text style={styles.petit}>Ton dernier marque-page : {libellePosition(dernier)}</Text> : null}
          </View>

          {chargement ? <ActivityIndicator color={colors.culkoko} /> : null}

          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>Où en es-tu ?</Text>
            <View style={styles.modes} accessibilityRole="radiogroup">
              {(['page', 'pourcent'] as const).map((m) => (
                <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mode === m }} onPress={() => setMode(m)} style={[styles.modeBouton, mode === m && styles.modeActif]}>
                  <Text style={[styles.modeTexte, mode === m && { color: '#FFFFFF' }]}>{m === 'page' ? 'Une page' : 'Un pourcentage'}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'page' ? (
              <View style={styles.ligne}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text nativeID="label-page" style={styles.label}>
                    Page
                  </Text>
                  <TextInput
                    aria-label="Page"
                    accessibilityLabelledBy="label-page"
                    value={page}
                    onChangeText={(t) => setPage(t.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder="150"
                    placeholderTextColor={colors.gris}
                    style={styles.champNombre}
                  />
                </View>
                {etat?.nbPages ? (
                  <Text style={[styles.texte, { paddingBottom: 14 }]}>sur {etat.nbPages}</Text>
                ) : (
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text nativeID="label-total" style={styles.label}>
                      Sur combien ?
                    </Text>
                    <TextInput
                      aria-label="Nombre de pages du livre"
                      accessibilityLabelledBy="label-total"
                      value={total}
                      onChangeText={(t) => setTotal(t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      placeholder="320"
                      placeholderTextColor={colors.gris}
                      style={styles.champNombre}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                <Text nativeID="label-pourcent" style={styles.label}>
                  Pourcentage lu (liseuse, livre audio…)
                </Text>
                <TextInput
                  aria-label="Pourcentage lu"
                  accessibilityLabelledBy="label-pourcent"
                  value={pourcent}
                  onChangeText={(t) => setPourcent(t.replace(/[^\d.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="45"
                  placeholderTextColor={colors.gris}
                  style={styles.champNombre}
                />
              </View>
            )}
          </View>

          <View style={styles.bloc}>
            <View style={styles.blocEntete}>
              <Text style={styles.blocTitre}>Un mot pour tes amis ?</Text>
              <Text style={styles.facultatif}>Facultatif</Text>
            </View>
            <Text style={styles.petit}>Ils ne le découvriront qu’en arrivant à cette page. Zéro spoiler.</Text>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Mon émotion du moment</Text>
              <View style={styles.emotions}>
                {emotionsLecture.map((e) => {
                  const actif = emotion === e.id;
                  return (
                    <Pressable
                      key={e.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actif }}
                      onPress={() => setEmotion(actif ? null : e.id)}
                      style={[styles.emotion, actif && styles.emotionActive]}
                    >
                      <Text style={[styles.emotionTexte, actif && { color: '#FFFFFF' }]}>
                        {e.emoji} {e.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text nativeID="label-mot" style={styles.label}>
                Mon petit mot
              </Text>
              <TextInput
                aria-label="Un petit mot pour tes amis"
                accessibilityLabelledBy="label-mot"
                value={mot}
                onChangeText={setMot}
                maxLength={280}
                multiline
                placeholder="« Je n’ai pas vu venir ce passage ! »"
                placeholderTextColor={colors.gris}
                style={styles.champ}
              />
            </View>
          </View>

          <MessageErreur texte={erreur} />
        </ScrollView>
        <View style={styles.pied}>
          <BoutonPrincipal label={enCours ? 'Un instant…' : 'C’est noté'} onPress={enregistrer} desactive={enCours || chargement || !etat} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Resultat({ titre, position, nouveaux, restants, fin, onFermer, onFini }: { titre: string; position: string; nouveaux: MotAmi[]; restants: number; fin: boolean; onFermer: () => void; onFini: () => void }) {
  const noms = [...new Set(nouveaux.map((m) => m.pseudo))];
  const titreSurprise =
    noms.length === 0
      ? `${position.charAt(0).toUpperCase()}${position.slice(1)}, c’est noté !`
      : noms.length === 1
        ? `Tu viens de débloquer ${nouveaux.length > 1 ? 'les mots' : 'le mot'} de ${noms[0]} !`
        : `Tu viens de débloquer les mots de ${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]} !`;
  return (
    <SafeAreaView style={styles.ecran}>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: 40 }]}>
        <Text accessibilityRole="header" style={styles.grandTitre}>
          {titreSurprise}
        </Text>
        <Text style={styles.texte}>{noms.length ? `Tu en es ${position.startsWith('Page') ? position.toLowerCase() : `à ${position}`} dans « ${titre} ».` : `Bonne suite de lecture de « ${titre} » !`}</Text>
        {nouveaux.map((m) => (
          <CarteMot key={m.id} m={m} fond={colors.carte} />
        ))}
        <MotsEnAttente n={restants} />
      </ScrollView>
      <View style={styles.pied}>
        {fin ? (
          <>
            <BoutonPrincipal label={'Je l’ai fini !'} onPress={onFini} />
            <Pressable accessibilityRole="button" onPress={onFermer} style={styles.lienFin}>
              <Text style={styles.lienFinTexte}>Pas encore, continuer</Text>
            </Pressable>
          </>
        ) : (
          <BoutonPrincipal label="Continuer" onPress={onFermer} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lienFin: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  lienFinTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
  },
  rond44: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
  grandTitre: {
    fontFamily: fonts.titreGras,
    fontSize: 24,
    lineHeight: 30,
    color: colors.encre,
  },
  contenu: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 16 },
  oeuvre: { borderRadius: 18, padding: 14, gap: 4 },
  bloc: {
    backgroundColor: colors.carte,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  blocEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  blocTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre },
  facultatif: {
    fontFamily: fonts.texteMoyen,
    fontSize: 12,
    color: colors.gris,
    backgroundColor: colors.beige,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
  petit: {
    fontFamily: fonts.texte,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gris,
  },
  texte: {
    fontFamily: fonts.texte,
    fontSize: 15,
    lineHeight: 21,
    color: colors.encre,
  },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  modes: { flexDirection: 'row', gap: 8 },
  modeBouton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.bordure,
    backgroundColor: colors.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeActif: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  modeTexte: {
    fontFamily: fonts.texteMoyen,
    fontSize: 14,
    color: colors.encre,
  },
  ligne: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  champNombre: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.bordure,
    backgroundColor: colors.fond,
    paddingHorizontal: 14,
    fontFamily: fonts.titre,
    fontSize: 20,
    color: colors.encre,
  },
  champ: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.bordure,
    backgroundColor: colors.fond,
    padding: 12,
    fontFamily: fonts.texte,
    fontSize: 15,
    color: colors.encre,
    textAlignVertical: 'top',
  },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emotion: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.bordure,
    backgroundColor: colors.carte,
    justifyContent: 'center',
  },
  emotionActive: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  emotionTexte: { fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  attente: {
    fontFamily: fonts.texteMoyen,
    fontSize: 14,
    color: colors.gris,
    textAlign: 'center',
    marginTop: 4,
  },
  pied: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26 },
});
