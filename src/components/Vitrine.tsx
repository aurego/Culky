// La vitrine d'un profil : exactement ce que les autres voient.
// Elle sert à la fois pour « Mon carnet › Profil » et pour la page d'un ami : même présentation partout.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { anneeDuBilan } from '../lib/bilan';
import { compterAnnee, lireStatsAnnee, nomPluriel, type StatsAnnee as Stats } from '../lib/activites';
import { compterAbonnes, lireFil, lireProfil, type ActiviteFil, type ProfilPublic } from '../lib/fil';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers, universIds, type UniversId, categorieIds, categories, type CategorieId } from '../theme';
import { PhotoProfil } from './PhotoProfil';
import { CarteActivite } from './CarteActivite';
import { ErreurChargement, EtatVide } from './EtatVide';
import { StatsAnnee } from './StatsAnnee';

type Chouchou = { id: string; oeuvre: { titre: string; univers: UniversId; image_url: string | null } };

export async function lireChouchous(id: string): Promise<Chouchou[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('activites')
    .select('id, oeuvre:oeuvres(titre, univers, image_url)')
    .eq('auteur_id', id)
    .eq('chouchou', true)
    .order('date_activite', { ascending: false })
    .limit(6);
  if (error) return []; // complément SQL n° 11 pas encore passé
  return (data ?? []) as unknown as Chouchou[];
}

export function Vitrine({ id, moi, actions, recharger = 0 }: { id: string; moi: string; actions?: ReactNode; recharger?: number }) {
  const cEstMoi = id === moi;
  const [profil, setProfil] = useState<ProfilPublic | null>(null);
  const [compteurs, setCompteurs] = useState({ abonnes: 0, abonnements: 0 });
  const [annee, setAnnee] = useState<Record<CategorieId, number> | null>(null);
  const [chouchous, setChouchous] = useState<Chouchou[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activites, setActivites] = useState<ActiviteFil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [probleme, setProbleme] = useState(false);
  const [essai, setEssai] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!id || !moi) return;
      Promise.all([lireProfil(id), compterAbonnes(id), compterAnnee(id), lireChouchous(id), lireFil('decouvrir', moi, id), lireStatsAnnee(id)])
        .then(([p, c, a, ch, act, st]) => {
          setStats(st);
          setProfil(p);
          setCompteurs(c);
          setAnnee(a);
          setChouchous(ch);
          setActivites(act.filter((x) => x.etat === 'fini').slice(0, 5));
          setProbleme(false);
        })
        .catch((e) => {
          // Un souci de réseau n'est pas un profil disparu : on le dit, et on propose de réessayer.
          console.warn('Vitrine :', e);
          setProbleme(true);
        })
        .finally(() => setChargement(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, moi, recharger, essai]),
  );

  if (chargement) return <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />;
  if (probleme && !profil)
    return (
      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <ErreurChargement texte="Impossible de charger ce profil pour l’instant. Vérifie ta connexion." onReessayer={() => { setChargement(true); setEssai((n) => n + 1); }} />
      </View>
    );
  if (!profil) return <Text style={styles.message}>Ce profil n’existe pas, ou n’est plus disponible.</Text>;

  const premier = profil.univers_choisis?.[0] ?? 'livres';
  const total = annee ? categorieIds.reduce((s, c) => s + annee[c], 0) : 0;
  const amis = compteurs.abonnes + compteurs.abonnements;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.identite}>
        <PhotoProfil pseudo={profil.pseudo} fond={univers[premier].teinte} taille={80} photo={profil.photo_url} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={styles.pseudo}>{profil.pseudo}</Text>
          <Text style={styles.petit}>
            <Text accessibilityRole={cEstMoi ? 'link' : 'text'} disabled={!cEstMoi} onPress={() => router.push({ pathname: '/amis', params: { liste: 'abonnes' } })}>
              <Text style={styles.chiffre}>{compteurs.abonnes}</Text> abonné{compteurs.abonnes > 1 ? 's' : ''}
            </Text>
            {' · '}
            <Text accessibilityRole={cEstMoi ? 'link' : 'text'} disabled={!cEstMoi} onPress={() => router.push({ pathname: '/amis', params: { liste: 'abonnements' } })}>
              <Text style={styles.chiffre}>{compteurs.abonnements}</Text> abonnement{compteurs.abonnements > 1 ? 's' : ''}
            </Text>
          </Text>
          {cEstMoi && amis === 0 ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/amis')} style={styles.lienZone}>
              <Text style={styles.lienPetit}>Trouver mes amis ›</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {profil.bio ? <Text style={styles.bio}>{profil.bio}</Text> : null}

      {cEstMoi ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/reglages')} style={styles.boutonClair}>
          <Text style={styles.boutonClairTexte}>Modifier mon profil</Text>
        </Pressable>
      ) : (
        actions
      )}

      {/* Les chouchous */}
      <View style={{ gap: 10 }}>
        <View style={styles.ligneTitre}>
          <Text style={styles.sousTitre}>{cEstMoi ? 'Mes chouchous' : 'Ses chouchous'}</Text>
          {cEstMoi && chouchous.length ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/chouchous')} style={[styles.lienZone, { marginVertical: -12 }]}>
              <Text style={[styles.lienPetit, { color: colors.sousTitre }]}>Modifier ›</Text>
            </Pressable>
          ) : null}
        </View>
        {chouchous.length ? (
          <View style={styles.chouchous}>
            {chouchous.map((c) => {
              const u = univers[c.oeuvre.univers];
              return (
                <View key={c.id} style={styles.chouchou}>
                  {c.oeuvre.image_url ? (
                    <Image source={{ uri: c.oeuvre.image_url }} style={styles.couverture} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.couverture, { backgroundColor: u.couleur }]} />
                  )}
                  <Text style={styles.titreChouchou} numberOfLines={2}>{c.oeuvre.titre}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          cEstMoi ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/chouchous')} style={styles.boutonClair}>
              <Text style={styles.boutonClairTexte}>Choisir mes chouchous</Text>
            </Pressable>
          ) : (
            <Text style={styles.petit}>Ses chouchous arrivent bientôt.</Text>
          )
        )}
      </View>

      {/* L'année */}
      {annee ? (
        <View style={styles.carte}>
          <Text style={styles.sousTitre}>{cEstMoi ? 'Mon année' : 'Son année'} {new Date().getFullYear()}</Text>
          <View style={styles.compteurs}>
            {categorieIds
              .filter((c) => profil.univers_choisis?.includes(categories[c].univers) || annee[c] > 0)
              .map((c) => {
                const u = univers[categories[c].univers];
                return (
                  <View key={c} style={[styles.compteur, { backgroundColor: u.teinte }]}>
                    <Text style={[styles.compteurChiffre, { color: u.texteFonce }]}>{annee[c]}</Text>
                    <Text style={[styles.compteurNom, { color: u.texteFonce }]} numberOfLines={1} adjustsFontSizeToFit>{nomPluriel(c, annee[c])}</Text>
                  </View>
                );
              })}
          </View>
          {stats ? <StatsAnnee stats={stats} cEstMoi={cEstMoi} /> : null}
          {cEstMoi && (total > 0 || anneeDuBilan() !== new Date().getFullYear()) ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/bilan')} style={styles.boutonBilan}>
              <Text style={styles.boutonBilanTexte}>
                {anneeDuBilan() !== new Date().getFullYear() ? `Revoir mon année culturelle ${anneeDuBilan()}` : 'Voir mon année culturelle'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Sur mon profil, mes activités sont dans « Mon journal » ; sur celui d'un ami, ses dernières activités. */}
      {cEstMoi ? (
        activites.length === 0 ? (
          <EtatVide
            compact
            titre="Ton profil attend ta première activité"
            texte="Ce que tu enregistres rejoint ton journal. Ici, tu retrouveras tes chouchous et ton année."
            principal={{ texte: 'Enregistrer une activité', onPress: () => router.push('/enregistrer') }}
          />
        ) : null
      ) : (
        <>
          <Text style={styles.sousTitre}>Ses dernières activités</Text>
          {activites.length === 0 ? <Text style={styles.petit}>Ses prochaines activités apparaîtront ici.</Text> : null}
          {activites.map((a) => (
            <CarteActivite key={a.id} a={a} moi={moi} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
  message: { fontFamily: fonts.texte, fontSize: 14, color: colors.gris, textAlign: 'center', marginTop: 40 },
  identite: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pseudo: { fontFamily: fonts.titre, fontSize: 24, color: colors.culkoko },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 19, color: colors.gris },
  chiffre: { fontFamily: fonts.texteGras, color: colors.encre },
  lienZone: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  lienPetit: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
  bio: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  boutonClair: { height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonClairTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko },
  sousTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre },
  ligneTitre: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chouchous: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chouchou: { width: '30%', gap: 6 },
  couverture: { width: '100%', aspectRatio: 0.7, borderRadius: 10 },
  titreChouchou: { fontFamily: fonts.texteMoyen, fontSize: 12, lineHeight: 16, color: colors.encre },
  carte: { backgroundColor: colors.carte, borderRadius: 20, padding: 16, gap: 12 },
  compteurs: { flexDirection: 'row', gap: 6 },
  compteur: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center' },
  compteurChiffre: { fontFamily: fonts.titreGras, fontSize: 22, color: colors.encre },
  compteurNom: { fontFamily: fonts.texte, fontSize: 12, color: colors.encre },
  boutonBilan: { height: 44, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonBilanTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
});
