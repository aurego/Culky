// « Rejoins-moi sur Kulky » : la page qu'ouvre un ami avec mon lien d'invitation.
// Le lien porte un code secret (64 caractères) ; les anciens liens portaient l'identifiant du profil.
// • Sans compte : on présente la personne, et on garde le lien pendant la création du compte.
// • Déjà inscrit·e : rien d'automatique, on propose « Suivre X ? » (un compte tout neuf est relié tout de suite).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BoutonPrincipal, Logo } from '../../components/Base';
import { MessageErreur } from '../../components/Formulaire';
import { etatSuivi, suivre, type EtatSuivi } from '../../lib/fil';
import { estCodeSecret, garderParrain, oublierParrain, profilDuLien, rejoindreParCode, type ProfilDuLien } from '../../lib/invitation';
import { traduireErreur, useSession } from '../../lib/session';
import { colors, fonts, univers, universIds } from '../../theme';

export default function Rejoindre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pret, session, profil: moi } = useSession();
  const [parrain, setParrain] = useState<ProfilDuLien | null>(null);
  const [chargement, setChargement] = useState(true);
  const [tropLong, setTropLong] = useState(false);
  const [etat, setEtat] = useState<EtatSuivi>('aucun');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const inscrit = !!session && !!moi?.inscription_terminee;
  const moiId = session?.user.id ?? '';

  useEffect(() => {
    if (!id) return;
    profilDuLien(id)
      .then(setParrain, () => setParrain(null))
      .finally(() => setChargement(false));
  }, [id]);

  // Déjà inscrit·e : où en sommes-nous avec cette personne ?
  useEffect(() => {
    if (!inscrit || !parrain || parrain.id === moiId) return;
    etatSuivi(moiId, parrain.id).then(setEtat, () => undefined);
  }, [inscrit, parrain, moiId]);

  // Compte créé mais inscription pas finie : on garde le lien et on file vers les étapes d'inscription.
  useEffect(() => {
    if (!id || !pret || !session || moi?.inscription_terminee) return;
    garderParrain(id).then(() => router.replace('/inscription'));
  }, [id, pret, session, moi?.inscription_terminee]);

  // Jamais de roue sans fin : au bout de 8 secondes, on propose de continuer.
  useEffect(() => {
    const t = setTimeout(() => setTropLong(true), 8000);
    return () => clearTimeout(t);
  }, []);

  async function commencer(mode: 'inscription' | 'connexion') {
    if (id) await garderParrain(id);
    router.push({ pathname: '/connexion', params: { mode } });
  }

  // « Suivre X » : avec le lien secret, un compte tout neuf est relié tout de suite ;
  // sinon, c'est une demande d'abonnement, que X acceptera.
  async function suivreParrain() {
    if (!parrain || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      await oublierParrain();
      const resultat = estCodeSecret(id) ? await rejoindreParCode(id) : 'compte_ancien';
      if (resultat === 'relies' || resultat === 'deja_relies') {
        router.replace({ pathname: '/profil/[id]', params: { id: parrain.id } });
        return;
      }
      await suivre(moiId, parrain.id, true);
      setEtat('en_attente');
    } catch (e) {
      setErreur(traduireErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const voirProfil = () => parrain && router.replace({ pathname: '/profil/[id]', params: { id: parrain.id } });

  const pastilles = (
    <View style={styles.univers}>
      {universIds.map((u) => (
        <View key={u} style={[styles.pastille, { backgroundColor: univers[u].teinte }]}>
          <Text style={[styles.pastilleTexte, { color: univers[u].texteFonce }]}>{{ livres: '📚 Livres', cine: '🎬 Ciné', concerts: '🎤 Concerts et spectacles', expos: '🖼️ Expos' }[u]}</Text>
        </View>
      ))}
    </View>
  );
  const avatar = parrain ? <Avatar initiale={parrain.pseudo.charAt(0).toUpperCase()} fond={univers[parrain.univers_choisis?.[0] ?? 'livres'].teinte} taille={76} photo={parrain.photo_url} /> : null;
  const attente = chargement || (!!session && !inscrit);

  return (
    <SafeAreaView style={styles.ecran}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.haut}>
        <Logo taille={34} />
        {attente ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} /> : null}
        {attente && tropLong ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.lien}>
            <Text style={styles.lienTexte}>Ça prend du temps… Continuer</Text>
          </Pressable>
        ) : null}
        {!chargement && !session ? (
          <View style={{ alignItems: 'center', gap: 14, marginTop: 22 }}>
            {avatar}
            <Text accessibilityRole="header" style={styles.titre}>
              {parrain ? `${parrain.pseudo} t’invite sur Kulky` : 'Bienvenue sur Kulky'}
            </Text>
            <Text style={styles.texte}>Ce qui t’a ému·e, fait rire ou fait vibrer, garde-le ici, et partage-le avec tes amis.</Text>
            {pastilles}
            <Text style={styles.sport}>Comme une appli de sport, mais pour ta culture : tes amis t’encouragent et te conseillent.</Text>
            {parrain ? <Text style={styles.texte}>Crée ton Kulky : vous serez relié·es tout de suite.</Text> : null}
          </View>
        ) : null}
        {!chargement && inscrit ? (
          <View style={{ alignItems: 'center', gap: 14, marginTop: 22 }}>
            {avatar}
            {!parrain ? (
              <>
                <Text accessibilityRole="header" style={styles.titre}>Ce lien ne marche plus</Text>
                <Text style={styles.texte}>Il a peut-être été changé. Demande à ton ami de te renvoyer son lien, ou cherche son pseudo dans Mes amis.</Text>
              </>
            ) : parrain.id === moiId ? (
              <>
                <Text accessibilityRole="header" style={styles.titre}>C’est ton lien !</Text>
                <Text style={styles.texte}>Envoie-le à tes amis : en créant leur compte, vous serez relié·es tout de suite.</Text>
              </>
            ) : etat === 'accepte' ? (
              <>
                <Text accessibilityRole="header" style={styles.titre}>Tu suis déjà {parrain.pseudo}</Text>
                <Text style={styles.texte}>Ses activités t’attendent dans ton fil.</Text>
              </>
            ) : etat === 'en_attente' ? (
              <>
                <Text accessibilityRole="header" style={styles.titre}>Demande envoyée !</Text>
                <Text style={styles.texte}>{parrain.pseudo} va recevoir ta demande. Dès qu’elle sera acceptée, tu verras ses activités réservées à ses abonnés.</Text>
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.titre}>Suivre {parrain.pseudo} ?</Text>
                <Text style={styles.texte}>{parrain.pseudo} t’a envoyé son lien Kulky. Abonne-toi pour voir passer ses livres, films, concerts, spectacles et expos.</Text>
                {pastilles}
              </>
            )}
            <MessageErreur texte={erreur} />
          </View>
        ) : null}
      </ScrollView>
      {!chargement && !session ? (
        <View style={styles.bas}>
          <BoutonPrincipal label="Créer mon Kulky" onPress={() => commencer('inscription')} />
          <Pressable accessibilityRole="button" onPress={() => commencer('connexion')} style={styles.lien}>
            <Text style={styles.lienTexte}>J’ai déjà un compte</Text>
          </Pressable>
        </View>
      ) : null}
      {!chargement && inscrit ? (
        <View style={styles.bas}>
          {parrain && parrain.id !== moiId && etat === 'aucun' ? (
            <>
              <BoutonPrincipal label={enCours ? 'Un instant…' : `Suivre ${parrain.pseudo}`} desactive={enCours} onPress={suivreParrain} />
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.lien}>
                <Text style={[styles.lienTexte, { color: colors.gris }]}>Pas maintenant</Text>
              </Pressable>
            </>
          ) : parrain && parrain.id !== moiId ? (
            <BoutonPrincipal label={`Voir le profil de ${parrain.pseudo}`} onPress={voirProfil} />
          ) : (
            <BoutonPrincipal label="Aller à mon fil" onPress={() => router.replace('/')} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond, paddingHorizontal: 24 },
  haut: { paddingTop: 24, paddingBottom: 12 },
  titre: { fontFamily: fonts.titreGras, fontSize: 26, lineHeight: 32, color: colors.culkoko, textAlign: 'center' },
  texte: { fontFamily: fonts.texte, fontSize: 16, lineHeight: 23, color: colors.gris, textAlign: 'center' },
  univers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pastille: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pastilleTexte: { fontFamily: fonts.texteGras, fontSize: 14 },
  sport: { fontFamily: fonts.texteMoyen, fontSize: 15, lineHeight: 21, color: colors.sousTitre, textAlign: 'center' },
  bas: { paddingBottom: 24, gap: 6 },
  lien: { height: 48, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.culkoko },
});
