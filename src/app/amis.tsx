// Mes amis : trouver quelqu'un par son pseudo, inviter un ami sur Kulky, répondre aux demandes,
// et voir qui je suis / qui me suit. Suivre quelqu'un se demande : la personne accepte (ou refuse).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Base';
import { EnTetePage } from '../components/EnTete';
import { ErreurChargement, EtatVide } from '../components/EtatVide';
import { CLE_INVITE } from '../components/PremiersPas';
import { accepterDemande, chercherProfils, demandesRecues, listerAmis, retirerAbonne, suivre, type Ami, type EtatSuivi, type ProfilPublic } from '../lib/fil';
import { changerMonLien, monLienRejoindre } from '../lib/invitation';
import { suggererAmis, type Suggestion } from '../lib/suggestions';
import { useSession } from '../lib/session';
import { colors, fonts, univers } from '../theme';

type Action = {
  texte: string;
  onPress: () => void;
  discret?: boolean;
  // Une confirmation légère avant d'agir (annuler une demande, ne plus suivre, retirer un abonné).
  confirmer?: { question: string; oui: string; non?: string };
};

export default function Amis() {
  const { session, profil } = useSession();
  const moi = session?.user.id ?? '';
  const [amis, setAmis] = useState<Ami[]>([]);
  const [demandes, setDemandes] = useState<ProfilPublic[]>([]);
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ProfilPublic[]>([]);
  const [copie, setCopie] = useState(false);
  const [lienErreur, setLienErreur] = useState(false);
  const [changerLien, setChangerLien] = useState<'non' | 'confirmer' | 'fait'>('non');
  const params = useLocalSearchParams<{ liste?: string }>();
  const [liste, setListe] = useState<'abonnements' | 'abonnes'>(params.liste === 'abonnes' ? 'abonnes' : 'abonnements');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [etatsIci, setEtatsIci] = useState<Map<string, EtatSuivi>>(new Map()); // changés depuis cet écran (recherche, suggestions)
  const [probleme, setProbleme] = useState(false);
  const [essai, setEssai] = useState(0);

  const recharger = useCallback(() => {
    if (!moi) return;
    // Un souci de réseau n'est pas une liste d'amis vide : on le dit, avec « Réessayer ».
    listerAmis(moi, moi).then(
      (a) => {
        setAmis(a);
        setEtatsIci(new Map());
        setProbleme(false);
      },
      () => setProbleme(true),
    );
    demandesRecues(moi).then(setDemandes, () => setDemandes([]));
  }, [moi]);

  useFocusEffect(
    useCallback(() => {
      recharger();
      if (moi) suggererAmis(moi).then(setSuggestions, () => setSuggestions([]));
    }, [recharger, moi, essai]),
  );

  useEffect(() => {
    let annule = false;
    const minuteur = setTimeout(() => {
      chercherProfils(texte, moi).then((r) => !annule && setResultats(r), () => !annule && setResultats([]));
    }, 350);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [texte, moi]);

  async function partager(lien: string) {
    const message = `Rejoins-moi sur Kulky ! C’est comme une appli de sport, mais pour ta culture : on y garde nos livres, films, concerts, spectacles et expos, et on se les conseille. ${lien}`;
    // Les premiers pas : « Retrouve ou invite tes amis » se coche dès qu'on a partagé son lien.
    const marquerInvite = () => AsyncStorage.setItem(CLE_INVITE, '1').catch(() => undefined);
    try {
      const r = await Share.share({ message });
      // Sur iPhone, fermer la feuille de partage sans rien envoyer ne compte pas comme une invitation.
      if (r.action !== Share.dismissedAction) marquerInvite();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // partage annulé : on ne fait rien
      try {
        await navigator.clipboard?.writeText(message);
        setCopie(true);
        marquerInvite();
      } catch {
        setCopie(false);
      }
    }
  }

  async function inviter() {
    setLienErreur(false);
    const lien = await monLienRejoindre().catch(() => '');
    if (!lien) return setLienErreur(true);
    await partager(lien);
  }

  async function nouveauLien() {
    setLienErreur(false);
    const lien = await changerMonLien().catch(() => '');
    if (!lien) return setLienErreur(true);
    setChangerLien('fait');
  }

  // L'état de mon abonnement à quelqu'un : ce que je viens de faire ici, sinon ce que dit la liste.
  const etatDe = (id: string): EtatSuivi => {
    const ici = etatsIci.get(id);
    if (ici) return ici;
    const a = amis.find((x) => x.id === id);
    return a?.jeLeSuis ? 'accepte' : a?.demandeEnvoyee ? 'en_attente' : 'aucun';
  };

  async function changerSuivi(p: ProfilPublic, oui: boolean) {
    const avant = etatDe(p.id);
    setEtatsIci((m) => new Map(m).set(p.id, oui ? 'en_attente' : 'aucun'));
    try {
      const etat = await suivre(moi, p.id, oui);
      setEtatsIci((m) => new Map(m).set(p.id, etat));
    } catch {
      setEtatsIci((m) => new Map(m).set(p.id, avant));
    }
  }

  // Le bouton à trois états : « Suivre » / « Demande envoyée » (annuler) / « Abonné·e ✓ » (ne plus suivre).
  const boutonSuivre = (p: ProfilPublic, texteSuivre = 'Suivre'): Action => {
    const etat = etatDe(p.id);
    if (etat === 'accepte')
      return { texte: 'Abonné·e ✓', discret: true, onPress: () => changerSuivi(p, false), confirmer: { question: `Ne plus suivre ${p.pseudo} ?`, oui: 'Oui, ne plus suivre', non: 'Rester abonné·e' } };
    if (etat === 'en_attente')
      return { texte: 'Demande envoyée', discret: true, onPress: () => changerSuivi(p, false), confirmer: { question: 'Annuler ta demande ?', oui: 'Oui, annuler', non: 'Garder ma demande' } };
    return { texte: texteSuivre, onPress: () => changerSuivi(p, true) };
  };

  async function repondre(p: ProfilPublic, accepter: boolean) {
    setDemandes((l) => l.filter((x) => x.id !== p.id));
    try {
      if (accepter) await accepterDemande(moi, p.id);
      else await retirerAbonne(moi, p.id);
      recharger();
    } catch {
      recharger();
    }
  }

  async function retirer(a: Ami) {
    setAmis((l) => l.map((x) => (x.id === a.id ? { ...x, ilMeSuit: false } : x)));
    await retirerAbonne(moi, a.id).catch(() => recharger());
  }

  // Pas de doublon : quelqu'un qui me suit déjà apparaît dans « Mes abonnés », pas dans les suggestions.
  const suggestionsVisibles = suggestions.filter((p) => !amis.some((a) => a.id === p.id && a.ilMeSuit));
  const suivis = amis.filter((a) => etatDe(a.id) === 'accepte').length;
  const abonnes = amis.filter((a) => a.ilMeSuit).length;
  const aSuivreEnRetour = amis.filter((a) => a.ilMeSuit && etatDe(a.id) === 'aucun');
  const ouvrirProfil = (id: string) => router.push({ pathname: '/profil/[id]', params: { id } });

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre="Mes amis" />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {demandes.length > 0 ? (
          <View style={[styles.bloc, { marginTop: 0 }]}>
            <Text style={styles.sousTitre}>Demandes reçues · {demandes.length}</Text>
            <Text style={styles.message}>En acceptant, tu leur montres aussi tes activités réservées à tes abonnés.</Text>
            {demandes.map((p) => (
              <View key={p.id} style={styles.personne}>
                <Pressable accessibilityRole="link" onPress={() => ouvrirProfil(p.id)} style={styles.personneLien}>
                  <Avatar initiale={p.pseudo.charAt(0).toUpperCase()} fond={univers[p.univers_choisis?.[0] ?? 'livres'].teinte} photo={p.photo_url} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pseudo} numberOfLines={1}>{p.pseudo}</Text>
                    <Text style={styles.detail}>aimerait te suivre</Text>
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Accepter la demande de ${p.pseudo}`} onPress={() => repondre(p, true)} style={[styles.action, styles.actionOui]}>
                  <Text style={[styles.actionTexte, { color: '#FFFFFF' }]}>Accepter</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Refuser la demande de ${p.pseudo}`} onPress={() => repondre(p, false)} style={[styles.action, styles.actionDiscrete]}>
                  <Text style={[styles.actionTexte, { color: colors.gris }]}>Refuser</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <TextInput
          aria-label="Chercher une personne par son pseudo"
          value={texte}
          onChangeText={setTexte}
          placeholder="Chercher un ami par son pseudo…"
          clearButtonMode="while-editing"
          placeholderTextColor={colors.gris}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.recherche}
        />
        {resultats.map((p) => (
          <LignePersonne key={p.id} p={p} onPress={() => ouvrirProfil(p.id)} action={boutonSuivre(p)} />
        ))}

        {texte.trim().length < 2 && suggestionsVisibles.length > 0 ? (
          <View style={styles.bloc}>
            <Text style={styles.sousTitre}>Tu les connais peut-être</Text>
            {suggestionsVisibles.map((p) => (
              <LignePersonne key={p.id} p={p} detail={p.raison} onPress={() => ouvrirProfil(p.id)} action={boutonSuivre(p)} />
            ))}
          </View>
        ) : null}
        {texte.trim().length >= 2 && resultats.length === 0 ? <Text style={styles.message}>Pas encore de Kulky à ce pseudo. Et si tu l’invitais ?</Text> : null}

        <Pressable accessibilityRole="button" onPress={inviter} style={styles.inviter}>
          <Text style={styles.inviterTitre}>Inviter un ami sur Kulky</Text>
          <Text style={styles.inviterTexte}>Envoie-lui ton lien : quand il crée son compte, vous serez relié·es tout de suite.</Text>
        </Pressable>
        {copie ? <Text style={styles.message}>Le message est copié : colle-le dans WhatsApp, un SMS ou un e-mail.</Text> : null}
        {lienErreur ? <Text style={styles.message}>Oups, ton lien n’a pas pu être préparé. Réessaie dans un instant.</Text> : null}
        {/* Changer mon lien : l'ancien ne marche plus (si on l'a trop partagé). */}
        {changerLien === 'non' ? (
          <Pressable accessibilityRole="button" onPress={() => setChangerLien('confirmer')} style={styles.lienDiscret}>
            <Text style={styles.lienDiscretTexte}>Changer mon lien</Text>
          </Pressable>
        ) : changerLien === 'confirmer' ? (
          <View style={styles.confirmation}>
            <Text style={styles.message}>Ton ancien lien ne marchera plus. Pratique si tu l’as trop partagé.</Text>
            <View style={styles.confirmationGestes}>
              <Pressable accessibilityRole="button" onPress={nouveauLien} style={styles.petitBouton}>
                <Text style={[styles.actionTexte, { color: '#9B2335' }]}>Oui, changer mon lien</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setChangerLien('non')} style={styles.petitBouton}>
                <Text style={[styles.actionTexte, { color: colors.gris }]}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.message}>C’est fait : ton nouveau lien est prêt. Touche « Inviter un ami » pour l’envoyer.</Text>
        )}

        <View style={styles.bloc}>
          {/* Deux listes : ceux que je suis, et ceux qui me suivent. */}
          <View style={styles.onglets}>
            {(['abonnements', 'abonnes'] as const).map((o) => {
              const actif = liste === o;
              return (
                <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => setListe(o)} style={[styles.onglet, actif && styles.ongletActif]}>
                  <Text style={[styles.ongletTexte, { color: actif ? colors.culkoko : colors.gris }]}>
                    {o === 'abonnements' ? `Mes abonnements · ${suivis}` : `Mes abonnés · ${abonnes}`}
                    {o === 'abonnes' && aSuivreEnRetour.length ? ' •' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {probleme ? <ErreurChargement texte="Impossible de charger tes amis pour l’instant." onReessayer={() => setEssai((n) => n + 1)} /> : null}
          {!probleme && amis.length === 0 ? (
            <EtatVide compact titre="Ta bande t’attend" texte={`${profil?.pseudo ?? 'Toi'}, cherche un pseudo ci-dessus ou envoie ton lien d’invitation : Kulky est bien plus joyeux à plusieurs.`} />
          ) : null}
          {liste === 'abonnements' && amis.length > 0 && !amis.some((a) => etatDe(a.id) !== 'aucun') ? <Text style={styles.message}>Tu ne suis personne pour l’instant : regarde les suggestions ci-dessus.</Text> : null}
          {liste === 'abonnes' && amis.length > 0 && abonnes === 0 ? <Text style={styles.message}>Personne ne te suit encore : envoie ton lien à tes amis !</Text> : null}
          {amis
            // Mes abonnements : ceux que je suis, et mes demandes en attente.
            .filter((a) => (liste === 'abonnements' ? etatDe(a.id) !== 'aucun' : a.ilMeSuit))
            // Dans mes abonnés, ceux que je ne suis pas encore d'abord.
            .sort((x, y) => (liste === 'abonnes' ? Number(etatDe(x.id) !== 'aucun') - Number(etatDe(y.id) !== 'aucun') : 0))
            .map((a) => {
              const etat = etatDe(a.id);
              const detail =
                liste === 'abonnements' && etat === 'en_attente' ? 'Demande envoyée, en attente de réponse' : a.ilMeSuit && etat === 'accepte' ? 'Vous vous suivez' : a.ilMeSuit ? 'Te suit' : undefined;
              return (
                <LignePersonne
                  key={a.id}
                  p={a}
                  detail={detail}
                  onPress={() => ouvrirProfil(a.id)}
                  action={boutonSuivre(a, 'Suivre en retour')}
                  secondaire={
                    liste === 'abonnes'
                      ? { texte: 'Retirer', discret: true, onPress: () => retirer(a), confirmer: { question: `Retirer ${a.pseudo} de tes abonnés ? ${a.pseudo} ne sera pas prévenu·e.`, oui: 'Oui, retirer', non: 'Annuler' } }
                      : undefined
                  }
                />
              );
            })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LignePersonne({ p, onPress, action, secondaire, detail }: { p: ProfilPublic; onPress: () => void; action?: Action; secondaire?: Action; detail?: string }) {
  const [aConfirmer, setAConfirmer] = useState<Action | null>(null);
  const toucher = (a: Action) => (a.confirmer ? setAConfirmer(a) : a.onPress());
  return (
    <View style={styles.personneBloc}>
      <View style={styles.personneRangee}>
        <Pressable accessibilityRole="link" onPress={onPress} style={styles.personneLien}>
          <Avatar initiale={p.pseudo.charAt(0).toUpperCase()} fond={univers[p.univers_choisis?.[0] ?? 'livres'].teinte} photo={p.photo_url} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pseudo} numberOfLines={1}>{p.pseudo}</Text>
            {detail ? <Text style={styles.detail}>{detail}</Text> : null}
          </View>
        </Pressable>
        {secondaire && !aConfirmer ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${secondaire.texte} ${p.pseudo}`} onPress={() => toucher(secondaire)} style={styles.petitBouton}>
            <Text style={[styles.actionTexte, { color: colors.gris }]}>{secondaire.texte}</Text>
          </Pressable>
        ) : null}
        {action && !aConfirmer ? (
          <Pressable accessibilityRole="button" onPress={() => toucher(action)} style={[styles.action, action.discret ? styles.actionDiscrete : null]}>
            <Text style={[styles.actionTexte, action.discret ? { color: colors.gris } : null]}>{action.texte}</Text>
          </Pressable>
        ) : null}
        {!action && !secondaire ? <Text style={styles.voir}>Voir ›</Text> : null}
      </View>
      {aConfirmer?.confirmer ? (
        <View style={styles.confirmationLigne}>
          <Text style={styles.detail}>{aConfirmer.confirmer.question}</Text>
          <View style={styles.confirmationGestes}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                aConfirmer.onPress();
                setAConfirmer(null);
              }}
              style={styles.petitBouton}
            >
              <Text style={[styles.actionTexte, { color: '#9B2335' }]}>{aConfirmer.confirmer.oui}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setAConfirmer(null)} style={styles.petitBouton}>
              <Text style={[styles.actionTexte, { color: colors.gris }]}>{aConfirmer.confirmer.non ?? 'Annuler'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  recherche: { height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 18, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  onglets: { flexDirection: 'row', gap: 8 },
  onglet: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.carte, borderColor: colors.culkoko },
  ongletTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.encre },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  inviter: { backgroundColor: univers.livres.teinte, borderRadius: 18, padding: 16, gap: 4, marginTop: 6 },
  inviterTitre: { fontFamily: fonts.titre, fontSize: 17, color: univers.livres.texteFonce },
  inviterTexte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: univers.livres.texteFonce },
  lienDiscret: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  lienDiscretTexte: { fontFamily: fonts.texteMoyen, fontSize: 13, color: colors.gris, textDecorationLine: 'underline' },
  confirmation: { backgroundColor: colors.carte, borderRadius: 16, padding: 12, gap: 6, alignItems: 'center' },
  confirmationLigne: { gap: 2, paddingTop: 6, paddingLeft: 4 },
  confirmationGestes: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  petitBouton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  bloc: { gap: 8, marginTop: 10 },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.sousTitre },
  personne: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.carte, borderRadius: 16, paddingVertical: 8, paddingLeft: 10, paddingRight: 8 },
  personneBloc: { backgroundColor: colors.carte, borderRadius: 16, paddingVertical: 8, paddingLeft: 10, paddingRight: 8 },
  personneRangee: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personneLien: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  pseudo: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  detail: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  voir: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko, paddingHorizontal: 8 },
  action: { height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.culkoko, backgroundColor: colors.carte, justifyContent: 'center' },
  actionOui: { backgroundColor: colors.sousTitre, borderColor: colors.sousTitre },
  actionDiscrete: { backgroundColor: colors.beige, borderColor: colors.beige },
  actionTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
});
