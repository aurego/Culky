// La vitrine d'un profil : exactement ce que les autres voient.
// Elle sert à la fois pour « Mon carnet › Profil » et pour la page d'un ami : même présentation partout.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { compterAnnee, nomPluriel } from '../lib/activites';
import { compterAbonnes, lireFil, lireProfil, type ActiviteFil, type ProfilPublic } from '../lib/fil';
import { supabase } from '../lib/supabase';
import { colors, fonts, univers, universIds, type UniversId } from '../theme';
import { Avatar } from './Base';
import { CarteActivite } from './CarteActivite';
import { EtatVide } from './EtatVide';

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
  const [annee, setAnnee] = useState<Record<UniversId, number> | null>(null);
  const [chouchous, setChouchous] = useState<Chouchou[]>([]);
  const [activites, setActivites] = useState<ActiviteFil[]>([]);
  const [chargement, setChargement] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id || !moi) return;
      Promise.all([lireProfil(id), compterAbonnes(id), compterAnnee(id), lireChouchous(id), lireFil('decouvrir', moi, id)])
        .then(([p, c, a, ch, act]) => {
          setProfil(p);
          setCompteurs(c);
          setAnnee(a);
          setChouchous(ch);
          setActivites(act.filter((x) => x.etat === 'fini').slice(0, 5));
        })
        .catch((e) => console.warn('Vitrine :', e))
        .finally(() => setChargement(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, moi, recharger]),
  );

  if (chargement) return <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />;
  if (!profil) return <Text style={styles.message}>Ce carnet n’existe pas, ou n’est plus disponible.</Text>;

  const premier = profil.univers_choisis?.[0] ?? 'livres';
  const total = annee ? universIds.reduce((s, u) => s + annee[u], 0) : 0;
  const amis = compteurs.abonnes + compteurs.abonnements;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.identite}>
        <Avatar initiale={profil.pseudo.charAt(0).toUpperCase()} fond={univers[premier].teinte} taille={80} photo={profil.photo_url} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={styles.pseudo}>{profil.pseudo}</Text>
          <Pressable accessibilityRole={cEstMoi ? 'link' : 'text'} disabled={!cEstMoi} onPress={() => router.push('/amis')}>
            <Text style={styles.petit}>
              <Text style={styles.chiffre}>{compteurs.abonnes}</Text> abonné{compteurs.abonnes > 1 ? 's' : ''} · <Text style={styles.chiffre}>{compteurs.abonnements}</Text> abonnement{compteurs.abonnements > 1 ? 's' : ''}
              {cEstMoi && amis === 0 ? <Text style={styles.lienPetit}>  · Trouver des amis</Text> : null}
            </Text>
          </Pressable>
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
        <Text style={styles.sousTitre}>{cEstMoi ? 'Mes chouchous' : 'Ses chouchous'}</Text>
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
          <Text style={styles.petit}>
            {cEstMoi ? 'Mets en avant jusqu’à 6 œuvres que tu adores : dans ton journal, touche ⋯ sur une activité.' : 'Ses chouchous arrivent bientôt.'}
          </Text>
        )}
      </View>

      {/* L'année */}
      {annee ? (
        <View style={styles.carte}>
          <Text style={styles.sousTitre}>{cEstMoi ? 'Mon année' : 'Son année'} {new Date().getFullYear()}</Text>
          <View style={styles.compteurs}>
            {universIds
              .filter((u) => profil.univers_choisis?.includes(u) || annee[u] > 0)
              .map((u) => (
                <View key={u} style={[styles.compteur, { backgroundColor: univers[u].teinte }]}>
                  <Text style={styles.compteurChiffre}>{annee[u]}</Text>
                  <Text style={styles.compteurNom}>{nomPluriel(u, annee[u])}</Text>
                </View>
              ))}
          </View>
          {cEstMoi && total > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/bilan')} style={styles.boutonBilan}>
              <Text style={styles.boutonBilanTexte}>Voir mon année en résumé</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Les dernières activités, comme dans le fil */}
      <Text style={styles.sousTitre}>Dernières activités</Text>
      {activites.length === 0 ? (
        cEstMoi ? (
          <EtatVide
            compact
            titre="Ta vitrine attend ta première activité"
            texte="Ce que tu enregistres apparaît ici, selon qui tu as choisi pour le voir."
            principal={{ texte: 'Enregistrer une activité', onPress: () => router.push('/enregistrer') }}
          />
        ) : (
          <Text style={styles.petit}>Ses prochaines activités apparaîtront ici.</Text>
        )
      ) : null}
      {activites.map((a) => (
        <CarteActivite key={a.id} a={a} moi={moi} />
      ))}
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
  lienPetit: { fontFamily: fonts.texteGras, color: colors.culkoko },
  bio: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  boutonClair: { height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonClairTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  sousTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko },
  chouchous: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chouchou: { width: '30%', gap: 6 },
  couverture: { width: '100%', aspectRatio: 0.7, borderRadius: 10 },
  titreChouchou: { fontFamily: fonts.texteMoyen, fontSize: 12, lineHeight: 16, color: colors.encre },
  carte: { backgroundColor: colors.carte, borderRadius: 20, padding: 16, gap: 12 },
  compteurs: { flexDirection: 'row', gap: 8 },
  compteur: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  compteurChiffre: { fontFamily: fonts.titreGras, fontSize: 22, color: colors.encre },
  compteurNom: { fontFamily: fonts.texte, fontSize: 12, color: colors.encre },
  boutonBilan: { height: 44, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonBilanTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
});
