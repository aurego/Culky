// Modération : les signalements envoyés par la communauté, pour l'équipe Kulky seulement.
// Chaque signalement montre ce qui est signalé, avec les gestes possibles : corriger l'œuvre,
// supprimer l'activité ou le commentaire, retirer la photo, ou simplement classer le signalement.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnTetePage } from '../components/EnTete';
import { ErreurChargement, EtatVide } from '../components/EtatVide';
import { MessageErreur } from '../components/Formulaire';
import { quandJour } from '../lib/dates';
import {
  classerSignalement,
  corrigerOeuvre,
  effacerBio,
  estModerateur,
  listerSignalements,
  retirerPhotoActivite,
  retirerPhotoProfil,
  supprimerActiviteSignalee,
  supprimerCommentaireSignale,
  type Signalement,
} from '../lib/moderation';
import { traduireErreur } from '../lib/session';
import { colors, fonts } from '../theme';

export default function Moderation() {
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [probleme, setProbleme] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const ok = await estModerateur();
      setAutorise(ok);
      setSignalements(ok ? await listerSignalements() : []);
      setProbleme(false);
    } catch {
      setProbleme(true);
    } finally {
      setChargement(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const retirer = (id: string) => setSignalements((l) => l.filter((s) => s.id !== id));

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre="Modération" />
      <ScrollView contentContainerStyle={styles.contenu}>
        {chargement && !signalements.length ? <ActivityIndicator color={colors.culkoko} style={{ marginTop: 30 }} /> : null}
        {!chargement && probleme ? <ErreurChargement texte="Impossible de charger les signalements pour l’instant." onReessayer={charger} /> : null}
        {!chargement && !probleme && autorise === false ? (
          <EtatVide compact titre="Réservé à l’équipe" texte="Cet écran sert à l’équipe de modération de Kulky." principal={{ texte: 'Retour', onPress: () => router.back() }} />
        ) : null}
        {!chargement && !probleme && autorise && signalements.length === 0 ? (
          <EtatVide compact titre="Rien à regarder" texte="Aucun signalement en attente. La communauté est sage aujourd’hui." />
        ) : null}
        {signalements.length ? <Text style={styles.compte}>{signalements.length} signalement{signalements.length > 1 ? 's' : ''} à regarder</Text> : null}
        {signalements.map((s) => (
          <CarteSignalement key={s.id} s={s} onTraite={() => retirer(s.id)} onRecharger={charger} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function typeDe(s: Signalement): string {
  if (s.commentaire_id) return 'Commentaire';
  if (s.activite_id) return 'Activité';
  if (s.profil_signale_id) return 'Profil';
  return 'Contenu déjà supprimé';
}

function CarteSignalement({ s, onTraite, onRecharger }: { s: Signalement; onTraite: () => void; onRecharger: () => void }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<'activite' | 'commentaire' | null>(null);
  const [edition, setEdition] = useState(false);
  const oeuvre = s.activite?.oeuvre ?? null;
  const [titre, setTitre] = useState(oeuvre?.titre ?? '');
  const [createur, setCreateur] = useState(oeuvre?.createur ?? '');
  const [image, setImage] = useState(oeuvre?.image_url ?? '');
  const [fait, setFait] = useState<string | null>(null);

  async function agir(geste: () => Promise<void>, message: string, traite = false) {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      await geste();
      if (traite) onTraite();
      else {
        setFait(message);
        onRecharger();
      }
    } catch (e) {
      setErreur(traduireErreur(e));
    } finally {
      setEnCours(false);
      setConfirmer(null);
    }
  }

  return (
    <View style={styles.carte}>
      <View style={styles.ligneHaut}>
        <Text style={styles.type}>{typeDe(s)}</Text>
        <Text style={styles.petit}>{quandJour(s.cree_le.slice(0, 10))}</Text>
      </View>
      <Text style={styles.raison}>{s.raison ?? 'Sans raison précisée'}</Text>
      <Text style={styles.petit}>Signalé par {s.auteur?.pseudo ?? 'une personne qui a quitté Kulky'}</Text>

      {/* Ce qui est signalé */}
      {s.commentaire ? (
        <View style={styles.apercu}>
          <Text style={styles.petit}>Commentaire de {s.commentaire.auteur?.pseudo ?? '?'}</Text>
          <Text style={styles.texte}>« {s.commentaire.texte} »</Text>
        </View>
      ) : null}
      {s.activite ? (
        <View style={styles.apercu}>
          <Text style={styles.petit}>Activité de {s.activite.auteur?.pseudo ?? '?'}{oeuvre ? ` · ${oeuvre.titre}${oeuvre.createur ? ` (${oeuvre.createur})` : ''}` : ''}</Text>
          {s.activite.mots ? <Text style={styles.texte}>« {s.activite.mots} »</Text> : null}
          {s.activite.photo_url ? <Image source={{ uri: s.activite.photo_url }} style={styles.photo} accessibilityLabel="Photo souvenir signalée" /> : null}
        </View>
      ) : null}
      {s.profil ? (
        <View style={styles.apercu}>
          <Text style={styles.petit}>Profil de {s.profil.pseudo}</Text>
          {s.profil.bio ? <Text style={styles.texte}>« {s.profil.bio} »</Text> : null}
          {s.profil.photo_url ? <Image source={{ uri: s.profil.photo_url }} style={styles.avatar} accessibilityLabel={`Photo de ${s.profil.pseudo}`} /> : null}
        </View>
      ) : null}
      {(s.activite_id && !s.activite) || (s.commentaire_id && !s.commentaire) ? <Text style={styles.petit}>Le contenu a déjà disparu (supprimé par son autrice ou son auteur).</Text> : null}

      {/* Corriger l'œuvre */}
      {edition && oeuvre ? (
        <View style={styles.edition}>
          <TextInput aria-label="Titre de l’œuvre" value={titre} onChangeText={setTitre} maxLength={300} style={styles.champ} placeholder="Titre" placeholderTextColor={colors.gris} />
          <TextInput aria-label="Auteur ou artiste" value={createur} onChangeText={setCreateur} maxLength={300} style={styles.champ} placeholder="Auteur, réalisateur, artiste" placeholderTextColor={colors.gris} />
          <TextInput aria-label="Adresse de l’image" value={image} onChangeText={setImage} autoCapitalize="none" autoCorrect={false} style={styles.champ} placeholder="Adresse de l’image (vide = sans image)" placeholderTextColor={colors.gris} />
          <View style={styles.gestes}>
            <Geste
              texte="Enregistrer la correction"
              desactive={enCours || !titre.trim()}
              onPress={() => agir(() => corrigerOeuvre(oeuvre.id, { titre: titre.trim(), createur: createur.trim() || null, image_url: image.trim() || null }), 'Œuvre corrigée ✓').then(() => setEdition(false))}
            />
            <Geste texte="Annuler" discret onPress={() => setEdition(false)} />
          </View>
        </View>
      ) : null}

      {confirmer ? (
        <View style={styles.gestes}>
          <Geste
            texte={confirmer === 'activite' ? 'Oui, supprimer l’activité' : 'Oui, supprimer le commentaire'}
            danger
            desactive={enCours}
            onPress={() =>
              confirmer === 'activite'
                ? agir(() => supprimerActiviteSignalee(s.activite!.id), '', true)
                : agir(() => supprimerCommentaireSignale(s.commentaire!.id), '', true)
            }
          />
          <Geste texte="Annuler" discret onPress={() => setConfirmer(null)} />
        </View>
      ) : !edition ? (
        <View style={styles.gestes}>
          {oeuvre ? <Geste texte="Corriger l’œuvre" onPress={() => setEdition(true)} /> : null}
          {s.activite?.photo_url ? <Geste texte="Retirer la photo" desactive={enCours} onPress={() => agir(() => retirerPhotoActivite(s.activite!.photo_url!), 'Photo retirée ✓')} /> : null}
          {s.profil?.photo_url ? <Geste texte="Retirer la photo du profil" desactive={enCours} onPress={() => agir(() => retirerPhotoProfil(s.profil!.id, s.profil!.photo_url!), 'Photo retirée ✓')} /> : null}
          {s.profil?.bio ? <Geste texte="Effacer la bio" desactive={enCours} onPress={() => agir(() => effacerBio(s.profil!.id), 'Bio effacée ✓')} /> : null}
          {s.activite ? <Geste texte="Supprimer l’activité" danger onPress={() => setConfirmer('activite')} /> : null}
          {s.commentaire ? <Geste texte="Supprimer le commentaire" danger onPress={() => setConfirmer('commentaire')} /> : null}
          <Geste texte="Classer" discret desactive={enCours} onPress={() => agir(() => classerSignalement(s.id), '', true)} />
        </View>
      ) : null}
      {fait ? <Text style={styles.fait}>{fait}</Text> : null}
      <MessageErreur texte={erreur} />
    </View>
  );
}

function Geste({ texte, onPress, danger, discret, desactive }: { texte: string; onPress: () => void; danger?: boolean; discret?: boolean; desactive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!desactive }} disabled={desactive} onPress={onPress} style={[styles.geste, discret && styles.gesteDiscret, desactive && { opacity: 0.5 }]}>
      <Text style={[styles.gesteTexte, { color: danger ? '#9B2335' : discret ? colors.gris : colors.sousTitre }]}>{texte}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  compte: { fontFamily: fonts.titre, fontSize: 16, color: colors.sousTitre },
  carte: { backgroundColor: colors.carte, borderRadius: 16, padding: 14, gap: 6 },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.sousTitre },
  raison: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  texte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 12, lineHeight: 17, color: colors.gris },
  apercu: { backgroundColor: colors.beige, borderRadius: 12, padding: 10, gap: 4, marginTop: 4 },
  photo: { width: '100%', height: 180, borderRadius: 10, marginTop: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginTop: 4 },
  edition: { gap: 8, marginTop: 6 },
  champ: { minHeight: 44, borderRadius: 12, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 12, fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  gestes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  geste: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colors.bordure, justifyContent: 'center' },
  gesteDiscret: { borderColor: colors.beige, backgroundColor: colors.beige },
  gesteTexte: { fontFamily: fonts.texteGras, fontSize: 13 },
  fait: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.sousTitre },
});
