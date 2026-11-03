// Onglet Mon carnet, en deux vues :
//  - Profil  : ma vitrine, exactement ce que les autres voient (la même que la page d'un ami) ;
//  - Journal : mon carnet de bord (lectures en cours, rattrapage, tout mon journal avec ses options).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FiltreUnivers } from '../../components/Base';
import { EnTeteOnglet } from '../../components/EnTete';
import { EtatVide } from '../../components/EtatVide';
import { LectureEnCours } from '../../components/Lecture';
import { lireChouchous, Vitrine } from '../../components/Vitrine';
import { emotionParId } from '../../data/emotions';
import { changerVisibilite, compterAnnee, lireJournal, rangDeLAnnee, supprimerActivite, type EntreeJournal, type Visibilite } from '../../lib/activites';
import { quandJour as quand } from '../../lib/dates';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, fonts, univers, type UniversId } from '../../theme';

export default function Carnet() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const { vue: vueDemandee } = useLocalSearchParams<{ vue?: string }>();
  const [vue, setVue] = useState<'profil' | 'journal'>(vueDemandee === 'journal' ? 'journal' : 'profil');
  useEffect(() => {
    if (vueDemandee === 'journal' || vueDemandee === 'profil') setVue(vueDemandee);
  }, [vueDemandee]);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <EnTeteOnglet titre="Mon carnet" />
      <View style={styles.onglets} accessibilityRole="tablist">
        {(['profil', 'journal'] as const).map((v) => {
          const actif = vue === v;
          return (
            <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => setVue(v)} style={[styles.onglet, actif ? styles.ongletActif : styles.ongletInactif]}>
              <Text style={[styles.ongletTexte, { color: actif ? '#FFFFFF' : colors.encre, fontFamily: actif ? fonts.texteGras : fonts.texteMoyen }]}>
                {v === 'profil' ? 'Mon profil' : 'Mon journal'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {vue === 'profil' ? (
        <>
          <Text style={styles.aide}>C’est ce que voient les autres quand ils ouvrent ta page.</Text>
          {moi ? <Vitrine id={moi} moi={moi} /> : null}
        </>
      ) : (
        <Journal moi={moi} />
      )}
    </SafeAreaView>
  );
}

// ——— Mon journal ———
function Journal({ moi }: { moi: string }) {
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [chouchous, setChouchous] = useState<Set<string>>(new Set());
  const [filtre, setFiltre] = useState<UniversId | 'tout'>('tout');
  const [chargement, setChargement] = useState(true);
  const [probleme, setProbleme] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      const [j, c] = await Promise.all([lireJournal(moi, 300), lireChouchous(moi)]);
      setJournal(j);
      setChouchous(new Set(c.map((x) => x.id)));
      setProbleme(false);
    } catch (e) {
      console.warn('Journal :', e);
      setProbleme(true);
    } finally {
      setChargement(false);
    }
  }, [moi]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  // Un livre « commencé » passe à « fini » en un geste… et on fête ça.
  async function finirLivre(e: EntreeJournal) {
    if (!supabase || !moi) return;
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('activites').update({ etat: 'fini', date_activite: aujourdHui }).eq('id', e.id);
    if (error) return setProbleme(true);
    const compteurs = await compterAnnee(moi).catch(() => null);
    router.push({
      pathname: '/celebration',
      params: { univers: 'livres', titre: e.oeuvre.titre, createur: e.oeuvre.createur ?? '', image: e.oeuvre.image_url ?? '', commence: '0', rang: compteurs ? rangDeLAnnee('livres', compteurs.livres) : '', emotion: e.emotions[0] ?? '' },
    });
  }

  const enCours = journal.filter((e) => e.etat === 'commence');
  const termines = journal.filter((e) => e.etat === 'fini' && (filtre === 'tout' || e.oeuvre.univers === filtre));

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {chargement ? <ActivityIndicator color={colors.culkoko} style={{ marginVertical: 24 }} /> : null}
      {probleme ? <Text style={styles.message}>Impossible de charger ton journal pour l’instant. Vérifie ta connexion.</Text> : null}

      {enCours.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={styles.sousTitre}>En ce moment</Text>
          {enCours.map((e) => (
            <LectureEnCours
              key={e.id}
              activiteId={e.id}
              oeuvreId={e.oeuvre_id}
              titre={e.oeuvre.titre}
              moi={moi}
              entete={
                <View style={styles.entreeSimple}>
                  <Vignette e={e} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.titreEntree} numberOfLines={2}>{e.oeuvre.titre}</Text>
                    {e.oeuvre.createur ? <Text style={styles.petit} numberOfLines={1}>{e.oeuvre.createur}</Text> : null}
                    <Text style={styles.petit}>Commencé {/^\d/.test(quand(e.date_activite)) ? 'le ' : ''}{quand(e.date_activite).toLowerCase()}{e.visibilite !== 'public' ? ` · ${libelleVisibilite[e.visibilite]}` : ''}</Text>
                  </View>
                  <BoutonOptions e={e} ouvert={ouvert === e.id} onPress={() => setOuvert(ouvert === e.id ? null : e.id)} />
                </View>
              }
              options={ouvert === e.id ? <OptionsActivite e={e} chouchou={chouchous.has(e.id)} onFini={() => { setOuvert(null); charger(); }} /> : null}
              onFini={() => finirLivre(e)}
            />
          ))}
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/enregistrer', params: { mode: 'passe' } })} style={styles.rattrapage}>
        <Text style={styles.rattrapageTitre}>Il manque des livres ou des sorties ?</Text>
        <Text style={styles.petit}>Ajoute ce que tu as vécu depuis janvier, pour un bilan {new Date().getFullYear()} complet.</Text>
      </Pressable>

      <View style={{ gap: 10 }}>
        <Text style={styles.sousTitre}>Tout mon journal</Text>
        <View style={{ marginHorizontal: -20 }}>
          <FiltreUnivers choix={filtre} onChange={setFiltre} />
        </View>
        {!chargement && termines.length === 0 ? (
          <EtatVide
            compact
            titre={filtre === 'tout' ? 'Mon journal t’attend' : 'Cet univers t’attend'}
            texte="Chaque lecture, film, concert ou expo que tu enregistres vient s’ajouter ici."
            principal={{ texte: 'Enregistrer une activité', onPress: () => router.push('/enregistrer') }}
          />
        ) : null}
        {termines.map((e) => {
          const emotionsTexte = e.emotions
            .map((id) => emotionParId(id))
            .filter(Boolean)
            .map((em) => `${em!.emoji} ${em!.label}`)
            .join(' · ');
          const details = [quand(e.date_activite), e.lieu?.nom, e.oeuvre.univers === 'cine' && e.au_cinema === false ? 'à la maison' : null].filter(Boolean).join(' · ');
          return (
            <View key={e.id} style={styles.bloc}>
              <View style={styles.entree}>
                <Vignette e={e} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.titreEntree} numberOfLines={2}>{e.oeuvre.titre}</Text>
                  <Text style={styles.petit} numberOfLines={1}>{details}</Text>
                  {chouchous.has(e.id) ? <Text style={styles.chouchou}>Dans mes chouchous</Text> : null}
                  {e.visibilite !== 'public' ? <Text style={styles.masque}>{libelleVisibilite[e.visibilite]}</Text> : null}
                  {emotionsTexte ? <Text style={styles.emotions}>{emotionsTexte}</Text> : null}
                  {e.mots ? <Text style={styles.mots} numberOfLines={3}>« {e.mots} »</Text> : null}
                </View>
                <BoutonOptions e={e} ouvert={ouvert === e.id} onPress={() => setOuvert(ouvert === e.id ? null : e.id)} />
              </View>
              {ouvert === e.id && <OptionsActivite e={e} chouchou={chouchous.has(e.id)} onFini={() => { setOuvert(null); charger(); }} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const libelleVisibilite: Record<Visibilite, string> = {
  public: 'Visible par tout le monde',
  abonnes: 'Visible par mes abonnés',
  prive: 'Masquée · visible par moi seul·e',
};

function BoutonOptions({ e, ouvert, onPress }: { e: EntreeJournal; ouvert: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`Options pour ${e.oeuvre.titre}`} onPress={onPress} style={styles.options}>
      <Text style={styles.optionsTexte}>⋯</Text>
    </Pressable>
  );
}

// Les options d'une entrée : chouchou, conseiller, qui la voit, la supprimer (avec confirmation).
function OptionsActivite({ e, chouchou, onFini }: { e: EntreeJournal; chouchou: boolean; onFini: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function choisir(v: Visibilite) {
    try {
      await changerVisibilite(e.id, v);
      onFini();
    } catch {
      setErreur('Oups, ça n’a pas marché. Réessaie dans un instant.');
    }
  }
  async function basculerChouchou() {
    if (!supabase) return;
    const { error } = await supabase.from('activites').update({ chouchou: !chouchou }).eq('id', e.id);
    if (error) return setErreur(error.message.includes('Six chouchous') ? 'Tu as déjà 6 chouchous : retire-en un avant d’en ajouter un autre.' : 'Oups, ça n’a pas marché. Réessaie dans un instant.');
    onFini();
  }
  async function supprimer() {
    try {
      await supprimerActivite(e.id);
      onFini();
    } catch {
      setErreur('Oups, ça n’a pas marché. Réessaie dans un instant.');
    }
  }
  return (
    <View style={styles.panneau}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={chouchou ? 'Retirer de mes chouchous' : 'Mettre dans mes chouchous'} accessibilityState={{ selected: chouchou }} onPress={basculerChouchou} style={[styles.choix, { flex: 1 }, chouchou && styles.choixActif]}>
          <Text style={[styles.choixTexte, chouchou && { color: '#FFFFFF' }]}>{chouchou ? 'Chouchou ✓' : 'Mettre en chouchou'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/penser', params: { oeuvre: e.oeuvre_id } })} style={[styles.choix, { flex: 1, backgroundColor: colors.culkoko, borderColor: colors.culkoko }]}>
          <Text style={[styles.choixTexte, { color: '#FFFFFF' }]}>Conseiller</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>Qui peut la voir ?</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['public', 'abonnes', 'prive'] as Visibilite[]).map((v) => {
          const actif = e.visibilite === v;
          return (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: actif }} onPress={() => choisir(v)} style={[styles.choix, { flex: 1, paddingHorizontal: 6 }, actif && styles.choixActif]}>
              <Text style={[styles.choixTexte, { fontSize: 13, textAlign: 'center' }, actif && { color: '#FFFFFF' }]}>{{ public: 'Tout le monde', abonnes: 'Mes abonnés', prive: 'Moi seul·e' }[v]}</Text>
            </Pressable>
          );
        })}
      </View>
      {confirmer ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={supprimer} style={[styles.choix, { flex: 1, backgroundColor: '#9B2335', borderColor: '#9B2335' }]}>
            <Text style={[styles.choixTexte, { color: '#FFFFFF' }]}>Oui, supprimer</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmer(false)} style={[styles.choix, { flex: 1 }]}>
            <Text style={styles.choixTexte}>Annuler</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setConfirmer(true)} style={styles.lienSupprimer}>
          <Text style={styles.lienSupprimerTexte}>Supprimer</Text>
        </Pressable>
      )}
      {erreur ? <Text style={styles.petit}>{erreur}</Text> : null}
    </View>
  );
}

function Vignette({ e }: { e: EntreeJournal }) {
  const style = { width: 44, height: 60, borderRadius: 8, backgroundColor: univers[e.oeuvre.univers].couleur };
  return e.oeuvre.image_url ? <Image source={{ uri: e.oeuvre.image_url }} style={style} /> : <View style={style} />;
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  onglets: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
  onglet: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.culkoko },
  ongletInactif: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  ongletTexte: { fontSize: 15 },
  aide: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris, textAlign: 'center', paddingBottom: 10 },
  page: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32, gap: 18 },
  message: { fontFamily: fonts.texte, fontSize: 14, color: colors.gris, textAlign: 'center' },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  sousTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko },
  entreeSimple: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entree: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.carte, borderRadius: 14, padding: 10 },
  titreEntree: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  emotions: { fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  mots: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris, fontStyle: 'italic' },
  chouchou: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.culkoko },
  masque: { fontFamily: fonts.texteMoyen, fontSize: 12, color: colors.gris },
  rattrapage: { borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.bordure, padding: 14, gap: 2 },
  rattrapageTitre: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  vide: { backgroundColor: colors.carte, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.bordure },
  videTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.culkoko },
  bloc: { gap: 6 },
  options: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionsTexte: { fontFamily: fonts.texteGras, fontSize: 22, lineHeight: 24, color: colors.gris },
  panneau: { backgroundColor: colors.carte, borderRadius: 14, padding: 12, gap: 8 },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  choix: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.bordure, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  choixActif: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  choixTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  lienSupprimer: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lienSupprimerTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#9B2335' },
});
