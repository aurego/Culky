// Onglet Envies : « Que veux-je vivre ? »
// Tes envies, avec les rappels (« l'expo ferme dans 10 jours »), les amis qui ont la même envie,
// « On y va ensemble ? » et « J'y étais », qui transforme l'envie en activité… et en fête.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Carte, FiltreUnivers } from '../../components/Base';
import { EnTeteOnglet } from '../../components/EnTete';
import { ErreurChargement, EtatVide } from '../../components/EtatVide';
import { IconePlus } from '../../components/Icones';
import { amisAvecLaMemeEnvie, lireEnvies, rappel, retirerEnvie, type AmiAussi, type Envie } from '../../lib/envies';
import { mesAbonnements } from '../../lib/fil';
import { useSession } from '../../lib/session';
import { annulerSortie, lireSorties, repondre, type Reponse, type Sortie } from '../../lib/sorties';
import { joursAvant, jourLong } from '../../lib/dates';
import { colors, fonts, univers, universIds, type UniversId } from '../../theme';

const actionVecue: Record<UniversId, string> = { livres: 'Je l’ai lu', cine: 'Je l’ai vu', concerts: 'J’y étais', expos: 'J’y étais' };

export default function Envies() {
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const params = useLocalSearchParams<{ vue?: string }>();
  const [vue, setVue] = useState<'envies' | 'sorties'>(params.vue === 'sorties' ? 'sorties' : 'envies');
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [filtre, setFiltre] = useState<UniversId | 'tout'>('tout');
  const [envies, setEnvies] = useState<Envie[]>([]);
  const [amis, setAmis] = useState<AmiAussi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [probleme, setProbleme] = useState(false);

  const charger = useCallback(async () => {
    if (!moi) return;
    try {
      const [liste, s] = await Promise.all([lireEnvies(moi), lireSorties().catch(() => [] as Sortie[])]);
      setEnvies(liste);
      setSorties(s);
      const suivis = await mesAbonnements(moi);
      setAmis(await amisAvecLaMemeEnvie(suivis, liste.map((e) => e.oeuvre_id)));
      setProbleme(false);
    } catch (e) {
      console.warn('Envies :', e);
      setProbleme(true);
    } finally {
      setChargement(false);
      setRafraichit(false);
    }
  }, [moi]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  // Retirer une envie : elle disparaît tout de suite, mais on a 5 secondes pour « Annuler »
  // (on garde ainsi le « … a pensé à toi » d'un conseil retiré par erreur).
  const [retiree, setRetiree] = useState<Envie | null>(null);
  const minuteurRetrait = useRef<ReturnType<typeof setTimeout> | null>(null);

  function confirmerRetrait(e: Envie) {
    retirerEnvie(moi, e.oeuvre_id).catch(() => charger());
  }

  function retirer(e: Envie) {
    if (minuteurRetrait.current && retiree) {
      clearTimeout(minuteurRetrait.current);
      confirmerRetrait(retiree); // la précédente part pour de bon
    }
    setEnvies((l) => l.filter((x) => x.oeuvre_id !== e.oeuvre_id));
    setRetiree(e);
    minuteurRetrait.current = setTimeout(() => {
      confirmerRetrait(e);
      setRetiree(null);
      minuteurRetrait.current = null;
    }, 5000);
  }

  function annulerRetrait() {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    minuteurRetrait.current = null;
    if (retiree) setEnvies((l) => [retiree, ...l]);
    setRetiree(null);
  }

  // Arriver sur l'onglet depuis la création d'une sortie : on montre « Nos sorties ».
  useFocusEffect(
    useCallback(() => {
      if (params.vue === 'sorties') setVue('sorties');
    }, [params.vue]),
  );

  const visibles = envies
    .filter((e) => filtre === 'tout' || e.oeuvre.univers === filtre)
    .sort((a, b) => Number(!!rappel(b.oeuvre.univers, b.oeuvre.date_fin)?.urgent) - Number(!!rappel(a.oeuvre.univers, a.oeuvre.date_fin)?.urgent));
  const compte = (u: UniversId) => envies.filter((e) => e.oeuvre.univers === u).length;
  const libelles = { livres: 'À lire', cine: 'À voir', concerts: 'À vivre', expos: 'À visiter' } as Record<UniversId, string>;
  universIds.forEach((u) => {
    if (compte(u)) libelles[u] += ` · ${compte(u)}`;
  });

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <EnTeteOnglet titre="Mes envies" sousTitre={envies.length === 0 ? 'De belles choses à vivre bientôt' : `${envies.length} chose${envies.length > 1 ? 's' : ''} à vivre`} />
      <View style={styles.onglets}>
        {(['envies', 'sorties'] as const).map((o) => {
          const actif = vue === o;
          const aVenir = sorties.filter((x) => joursAvant(x.date_prevue) >= 0).length;
          return (
            <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => setVue(o)} style={[styles.onglet, actif ? styles.ongletActif : styles.ongletInactif]}>
              <Text style={[styles.ongletTexte, { color: actif ? colors.culkoko : colors.gris, fontFamily: actif ? fonts.texteGras : fonts.texteMoyen }]}>
                {o === 'envies' ? 'Mes envies' : `Mes sorties${aVenir ? ` · ${aVenir}` : ''}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {vue === 'envies' && <FiltreUnivers choix={filtre} onChange={setFiltre} libelles={libelles} />}

      <ScrollView
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger(); }} tintColor={colors.culkoko} />}
      >
        {chargement && <ActivityIndicator color={colors.culkoko} style={{ marginTop: 24 }} />}
        {probleme && <ErreurChargement texte={vue === 'sorties' ? 'Impossible de charger tes sorties pour l’instant.' : 'Impossible de charger tes envies pour l’instant.'} onReessayer={() => { setChargement(true); charger(); }} />}

        {vue === 'envies' && visibles.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/enregistrer', params: { mode: 'envie' } })} style={styles.ajouterLigne}>
            <IconePlus taille={18} couleur={colors.culkoko} epaisseur={2.4} />
            <Text style={styles.ajouterTexte}>Ajouter une envie</Text>
          </Pressable>
        ) : null}
        {vue === 'sorties' && !chargement && <ListeSorties sorties={sorties} moi={moi} onChange={charger} onVoirEnvies={() => setVue('envies')} />}

        {vue === 'envies' && !chargement && !probleme && visibles.length === 0 && (
          <EtatVide
            couleur="concerts"
            titre={filtre === 'tout' ? 'Qu’est-ce qui te tente ?' : 'Cet univers t’attend'}
            texte="Garde ici les livres, films, concerts, spectacles et expos qui te font envie. Le plus simple : touche « Ça me tente » sous une activité de tes amis."
            principal={{ texte: 'Voir ce que vivent les autres', onPress: () => router.push('/') }}
            secondaire={{ texte: 'Ajouter une envie', onPress: () => router.push({ pathname: '/enregistrer', params: { mode: 'envie' } }) }}
          />
        )}

        {vue === 'envies' && visibles.map((e) => {
          const u = univers[e.oeuvre.univers];
          const r = rappel(e.oeuvre.univers, e.oeuvre.date_fin);
          const avec = amis.filter((a) => a.oeuvre_id === e.oeuvre_id).map((a) => a.pseudo);
          const sortie = e.oeuvre.univers !== 'livres';
          return (
            <Carte key={e.oeuvre_id} style={styles.carte}>
              <View style={styles.ligne}>
                {e.oeuvre.image_url ? (
                  <Image source={{ uri: e.oeuvre.image_url }} style={styles.vignette} />
                ) : (
                  <View style={[styles.vignette, { backgroundColor: u.couleur }]} />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  {r ? (
                    <Text style={[styles.alerte, r.urgent ? styles.alerteUrgente : styles.alerteDouce]}>{r.texte}</Text>
                  ) : null}
                  <Text style={styles.titreEnvie} numberOfLines={2}>{e.oeuvre.titre}</Text>
                  {e.oeuvre.createur ? <Text style={styles.petit} numberOfLines={1}>{e.oeuvre.createur}</Text> : null}
                  {e.pense ? <Text style={styles.petit}>{e.pense.pseudo} a pensé à toi</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${e.oeuvre.titre} de mes envies`} onPress={() => retirer(e)} style={styles.retirer}>
                  <Text style={styles.retirerTexte}>×</Text>
                </Pressable>
              </View>

              {avec.length > 0 && (
                <View style={styles.amis}>
                  <View style={{ flexDirection: 'row' }}>
                    {avec.slice(0, 3).map((p, n) => (
                      <View key={p} style={[styles.miniAvatar, { marginLeft: n ? -8 : 0, backgroundColor: [univers.cine.teinte, univers.expos.teinte, univers.livres.teinte][n % 3] }]}>
                        <Text style={styles.miniInitiale}>{p.charAt(0).toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.petit, { flex: 1, color: colors.encre }]}>
                    {avec.length === 1 ? `${avec[0]} ${e.oeuvre.univers === 'livres' ? 'a aussi envie de le lire' : 'a aussi envie d’y aller'}` : `${avec.length} personnes que tu suis en ont aussi envie`}
                  </Text>
                </View>
              )}

              <View style={styles.boutons}>
                {sortie && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/sortie', params: { oeuvre: e.oeuvre_id, avec: amis.filter((a) => a.oeuvre_id === e.oeuvre_id).map((a) => a.profil_id).join(',') } })}
                    style={[styles.bouton, { backgroundColor: colors.culkoko }]}
                  >
                    <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>On y va ensemble ?</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/enregistrer', params: { oeuvre: e.oeuvre_id } })}
                  style={[styles.bouton, sortie ? styles.boutonClair : { backgroundColor: colors.culkoko }]}
                >
                  <Text style={[styles.boutonTexte, { color: sortie ? colors.encre : '#FFFFFF' }]}>{actionVecue[e.oeuvre.univers]}</Text>
                </Pressable>
              </View>

            </Carte>
          );
        })}
      </ScrollView>
      {retiree ? (
        <View accessibilityRole="alert" style={styles.toast}>
          <Text style={styles.toastTexte} numberOfLines={2}>
            « {retiree.oeuvre.titre} » a quitté tes envies.
          </Text>
          <Pressable accessibilityRole="button" onPress={annulerRetrait} style={styles.toastBouton}>
            <Text style={styles.toastAction}>Annuler</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ——— Nos sorties ———
const libelleReponse: Record<Reponse, string> = { invite: 'n’a pas encore répondu', partant: 'partant·e', pas_cette_fois: 'pas cette fois' };
const marqueReponse: Record<Reponse, string> = { invite: '…', partant: '✓', pas_cette_fois: '✕' };

function quandSortie(iso: string): { texte: string; urgent: boolean } {
  const n = joursAvant(iso);
  if (n === 0) return { texte: 'C’est aujourd’hui !', urgent: true };
  if (n === 1) return { texte: 'C’est demain !', urgent: true };
  if (n > 1 && n <= 7) return { texte: `Dans ${n} jours`, urgent: false };
  return { texte: '', urgent: false };
}

function ListeSorties({ sorties, moi, onChange, onVoirEnvies }: { sorties: Sortie[]; moi: string; onChange: () => void; onVoirEnvies: () => void }) {
  const [annulation, setAnnulation] = useState<string | null>(null);
  const aVenir = sorties.filter((s) => joursAvant(s.date_prevue) >= 0);
  const passees = sorties.filter((s) => joursAvant(s.date_prevue) < 0).reverse();

  async function choisir(s: Sortie, r: Reponse) {
    try {
      await repondre(s.id, moi, r);
    } finally {
      onChange();
    }
  }

  async function annuler(s: Sortie) {
    try {
      await annulerSortie(s.id);
    } finally {
      setAnnulation(null);
      onChange();
    }
  }

  if (sorties.length === 0) {
    return (
      <EtatVide
        couleur="expos"
        titre="Ta prochaine sortie t’attend"
        texte="Une envie partagée avec un ami ? Ouvre-la dans l’onglet « Mes envies » et touche « On y va ensemble ? » pour proposer une date."
        principal={{ texte: 'Voir mes envies', onPress: onVoirEnvies }}
      />
    );
  }

  const carte = (s: Sortie, passee: boolean) => {
    const u = univers[s.oeuvre.univers];
    const jOrganise = s.organisateur_id === moi;
    const moiInvite = s.participants.find((p) => p.profil_id === moi);
    const partants = s.participants.filter((p) => p.reponse === 'partant').length + 1; // + l'organisatrice ou l'organisateur
    const q = quandSortie(s.date_prevue);
    return (
      <Carte key={s.id} style={[styles.carte, passee && { opacity: 0.85 }]}>
        <View style={styles.ligne}>
          {s.oeuvre.image_url ? <Image source={{ uri: s.oeuvre.image_url }} style={styles.vignette} /> : <View style={[styles.vignette, { backgroundColor: u.couleur }]} />}
          <View style={{ flex: 1, gap: 2 }}>
            {q.texte && !passee ? <Text style={[styles.alerte, q.urgent ? styles.alerteUrgente : styles.alerteDouce]}>{q.texte}</Text> : null}
            <Text style={styles.titreEnvie} numberOfLines={2}>{s.oeuvre.titre}</Text>
            <Text style={styles.texteSortie}>
              {jourLong(s.date_prevue)}
              {s.heure ? ` · ${s.heure}` : ''}
            </Text>
            {s.lieu ? <Text style={styles.petit}>{s.lieu}</Text> : null}
          </View>
        </View>
        {s.mot ? <Text style={styles.motSortie}>« {s.mot} »</Text> : null}
        <View style={{ gap: 4 }}>
          <Text style={styles.petit}>
            {jOrganise ? 'Tu organises' : `Proposée par ${s.organisateur.pseudo}`} · {partants} partant{partants > 1 ? '·es' : '·e'}
          </Text>
          {s.participants.map((p) => (
            <Text key={p.profil_id} style={styles.participant}>
              {marqueReponse[p.reponse]} {p.profil_id === moi ? 'Toi' : p.profil?.pseudo ?? 'Un ami'} · {libelleReponse[p.reponse]}
            </Text>
          ))}
        </View>

        {!passee && moiInvite && (
          <View style={styles.boutons}>
            {(['partant', 'pas_cette_fois'] as Reponse[]).map((r) => {
              const actif = moiInvite.reponse === r;
              return (
                <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: actif }} onPress={() => choisir(s, r)} style={[styles.bouton, actif ? { backgroundColor: r === 'partant' ? colors.culkoko : colors.gris } : styles.boutonClair]}>
                  <Text style={[styles.boutonTexte, { color: actif ? '#FFFFFF' : colors.encre }]}>{r === 'partant' ? 'Partant·e !' : 'Pas cette fois'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {passee && (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/enregistrer', params: { oeuvre: s.oeuvre.id } })} style={[styles.bouton, { backgroundColor: colors.culkoko, flex: 0 }]}>
            <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>{actionVecue[s.oeuvre.univers]}</Text>
          </Pressable>
        )}
        {!passee && jOrganise && (
          annulation === s.id ? (
            <View style={styles.boutons}>
              <Pressable accessibilityRole="button" onPress={() => annuler(s)} style={[styles.bouton, { backgroundColor: '#9B2335' }]}>
                <Text style={[styles.boutonTexte, { color: '#FFFFFF' }]}>Oui, annuler</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setAnnulation(null)} style={[styles.bouton, styles.boutonClair]}>
                <Text style={styles.boutonTexte}>Garder</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setAnnulation(s.id)} style={styles.lienAnnuler}>
              <Text style={styles.lienAnnulerTexte}>Annuler la sortie</Text>
            </Pressable>
          )
        )}
      </Carte>
    );
  };

  return (
    <>
      {aVenir.map((s) => carte(s, false))}
      {passees.length > 0 && <Text style={styles.sousTitre}>Sorties passées</Text>}
      {passees.map((s) => carte(s, true))}
    </>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.encre, borderRadius: 16, paddingLeft: 16, paddingRight: 6, paddingVertical: 4 },
  toastTexte: { flex: 1, fontFamily: fonts.texteMoyen, fontSize: 14, color: '#FFFFFF' },
  toastBouton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  toastAction: { fontFamily: fonts.texteGras, fontSize: 14, color: '#F7B3C0' },
  onglets: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 12 },
  onglet: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.carte, borderWidth: 1.5, borderColor: colors.culkoko },
  ongletInactif: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  ongletTexte: { fontSize: 15 },
  texteSortie: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  motSortie: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre, fontStyle: 'italic' },
  participant: { fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.sousTitre, marginTop: 8 },
  lienAnnuler: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  lienAnnulerTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#9B2335' },
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 12 },
  ajouterLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.culkoko },
  ajouterTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
  ajouter: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  carte: { padding: 14, gap: 12 },
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  vignette: { width: 56, height: 76, borderRadius: 10 },
  alerte: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontFamily: fonts.texteGras, fontSize: 12, marginBottom: 2 },
  alerteUrgente: { backgroundColor: univers.concerts.teinte, color: univers.concerts.texteFonce },
  alerteDouce: { backgroundColor: colors.beige, color: colors.gris },
  titreEnvie: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  retirer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  retirerTexte: { fontFamily: fonts.texte, fontSize: 24, lineHeight: 26, color: colors.gris },
  amis: { backgroundColor: '#F7F2EA', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#F7F2EA', alignItems: 'center', justifyContent: 'center' },
  miniInitiale: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.encre },
  boutons: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  boutonClair: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  boutonTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
  messagePret: { backgroundColor: colors.beige, borderRadius: 12, padding: 12, gap: 6 },
  messageTexte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  vide: { backgroundColor: colors.carte, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  videTitre: { fontFamily: fonts.titre, fontSize: 17, color: colors.culkoko },
  boutonVide: { marginTop: 6, height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  boutonVideTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#FFFFFF' },
});
