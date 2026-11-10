// Une carte d'activité dans le fil : l'œuvre, qui, où, quand, les émotions, les mots, et le Kulkoko.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { emotionParId } from '../data/emotions';
import { quandActivite } from '../lib/dates';
import { phraseToiAussi } from '../lib/croises';
import { deNom, estSpectacle } from '../lib/scene';
import { ajouterEnvie, retirerEnvie } from '../lib/envies';
import { basculerCulkoko, type ActiviteFil } from '../lib/fil';
import { colors, fonts, univers, categories, categorieDe } from '../theme';
import { Avatar, Carte } from './Base';
import { EclatConfettis } from './Confettis';
import { IconeBulle, IconeCulkoko, IconeEnvies, IconePensee, IconeVecu } from './Icones';

const emojiCategorie: Record<ReturnType<typeof categorieDe>, string> = { livres: '📖', cine: '🎬', concerts: '🎤', spectacles: '🎭', expos: '🖼️' };

const verbes = {
  livres: { fini: 'a lu', commence: 'a commencé' },
  cine: { fini: 'a vu', commence: 'a vu' },
  concerts: { fini: 'était au concert de', commence: 'était au concert de' },
  expos: { fini: 'a visité', commence: 'a visité' },
};

export function CarteActivite({ a, moi, detail: surLaPage = false, onCulkoko }: { a: ActiviteFil; moi: string; detail?: boolean; onCulkoko?: () => void }) {
  const u = univers[a.oeuvre.univers];
  const [envoye, setEnvoye] = useState(a.monCulkoko);
  const [total, setTotal] = useState(a.culkoko);
  const [anime, setAnime] = useState(false);
  const [salves, setSalves] = useState(0); // une salve de confettis à chaque Kulkoko envoyé
  const [envie, setEnvie] = useState(a.monEnvie);
  const cEstMoi = a.auteur_id === moi;
  const nom = cEstMoi ? 'Tu' : a.auteur.pseudo;
  const verbeAutre = estSpectacle(a.oeuvre) ? 'a vu le spectacle' : verbes[a.oeuvre.univers][a.etat];
  const verbe = cEstMoi
    ? { 'a lu': 'as lu', 'a commencé': 'as commencé', 'a vu': 'as vu', 'était au concert de': 'étais au concert de', 'a visité': 'as visité', 'a vu le spectacle': 'as vu le spectacle' }[verbeAutre]
    : verbeAutre;
  // « au concert des Nuits Jaunes », « au concert d’Angèle »
  const titreDe = a.oeuvre.univers === 'concerts' && !estSpectacle(a.oeuvre) ? deNom(a.oeuvre.titre) : null;
  const detail = a.oeuvre.univers === 'cine' && a.au_cinema !== null ? (a.au_cinema ? 'au cinéma' : 'à la maison') : null;
  const sousTitre = [a.lieu?.nom, quandActivite(a.date_activite, a.cree_le)].filter(Boolean).join(' · ');

  async function culkoko() {
    if (cEstMoi) {
      // On ne s'envoie pas de Kulkoko à soi-même : toucher son compteur montre qui a applaudi.
      if (!surLaPage && total > 0) router.push({ pathname: '/activite/[id]', params: { id: a.id } });
      return;
    }
    const nouveau = !envoye;
    setEnvoye(nouveau);
    setTotal(total + (nouveau ? 1 : -1));
    if (nouveau) {
      // Une petite vibration sur le téléphone, comme un applaudissement.
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setAnime(true);
      setSalves((n) => n + 1);
      setTimeout(() => setAnime(false), 900);
    }
    try {
      await basculerCulkoko(a.id, moi, nouveau);
      onCulkoko?.();
    } catch {
      // En cas de souci réseau, on remet le bouton comme avant.
      setEnvoye(!nouveau);
      setTotal((t) => t + (nouveau ? -1 : 1));
    }
  }

  // « Ça me tente » : l'œuvre rejoint (ou quitte) mes envies.
  async function caMeTente() {
    const nouveau = !envie;
    setEnvie(nouveau);
    try {
      if (nouveau) await ajouterEnvie(moi, a.oeuvre_id);
      else await retirerEnvie(moi, a.oeuvre_id);
    } catch {
      setEnvie(!nouveau);
    }
  }

  // Mes propres Kulkokos apparaissent aussitôt dans la liste (« Toi »), sans attendre de recharger.
  const autres = (a.applaudisseurs ?? []).filter((p) => p.id !== moi);
  const applaudisseurs = envoye ? [{ id: moi, pseudo: 'Toi', photo_url: null }, ...autres] : autres;
  const nomsApplaudi = applaudisseurs.map((p) => p.pseudo);
  const texteApplaudi =
    nomsApplaudi.length === 1
      ? `Applaudi par ${nomsApplaudi[0]}`
      : nomsApplaudi.length === 2
        ? `Applaudi par ${nomsApplaudi[0]} et ${nomsApplaudi[1]}`
        : `Applaudi par ${nomsApplaudi[0]}, ${nomsApplaudi[1]} et ${nomsApplaudi.length - 2} autre${nomsApplaudi.length > 3 ? 's' : ''}`;

  const libelleVecu = a.oeuvre.univers === 'livres' ? 'Je l’ai lu' : a.oeuvre.univers === 'cine' || estSpectacle(a.oeuvre) ? 'Je l’ai vu' : 'J’y étais';

  const ouvrirProfil = () => (cEstMoi ? router.push('/carnet') : router.push({ pathname: '/profil/[id]', params: { id: a.auteur_id } }));

  return (
    <Carte>
      {/* L'image (couverture, affiche ou photo) ouvre l'activité, ses Kulkokos et ses commentaires. */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Ouvrir l’activité : ${a.oeuvre.titre}`}
        disabled={surLaPage}
        onPress={() => router.push({ pathname: '/activite/[id]', params: { id: a.id } })}
        style={[
          styles.visuel,
          a.photo_url ? [styles.visuelPhoto, { backgroundColor: u.couleur }] : a.oeuvre.image_url ? [styles.visuelVedette, { backgroundColor: u.texteFonce }] : [styles.visuelAffiche, { backgroundColor: u.teinte }],
        ]}
      >
        {a.photo_url ? (
          // La photo souvenir de l'ami, en grand.
          <Image source={{ uri: a.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Photo de ${a.auteur.pseudo}`} />
        ) : a.oeuvre.image_url ? (
          // L'œuvre en vedette : la couverture (ou l'affiche) en grand, sur un fond flouté tiré d'elle-même.
          <>
            <Image source={{ uri: a.oeuvre.image_url }} style={styles.flou} blurRadius={24} resizeMode="cover" />
            <View style={styles.voileFlou} />
            {a.oeuvre.univers === 'livres' || a.oeuvre.univers === 'cine' ? (
              <Image source={{ uri: a.oeuvre.image_url }} style={styles.couverture} resizeMode="cover" accessibilityLabel={`Couverture de ${a.oeuvre.titre}`} />
            ) : (
              <Image source={{ uri: a.oeuvre.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={a.oeuvre.titre} />
            )}
          </>
        ) : (
          // Sans aucune image : une petite affiche, avec le nom de l'œuvre en grand.
          <>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 210" preserveAspectRatio="xMidYMid slice">
              {[30, 58, 86, 114, 142, 170, 198, 226, 254, 282, 310, 338].map((rayon) => (
                <Circle key={rayon} cx={340} cy={180} r={rayon} fill="none" stroke={u.couleur} strokeWidth={2} opacity={0.35} />
              ))}
            </Svg>
            <View style={styles.affiche}>
              <Text style={styles.afficheEmoji}>{emojiCategorie[categorieDe(a.oeuvre)]}</Text>
              <Text style={[styles.afficheTitre, { color: u.texteFonce }]} numberOfLines={3}>{a.oeuvre.titre}</Text>
              {a.lieu?.nom || a.oeuvre.createur ? (
                <Text style={[styles.afficheLieu, { color: u.texteFonce }]} numberOfLines={1}>{a.lieu?.nom ?? a.oeuvre.createur}</Text>
              ) : null}
            </View>
          </>
        )}
        <Text style={styles.etiquette}>
          {categories[categorieDe(a.oeuvre)].label}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </Pressable>
      <View style={styles.corps}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Voir le profil de ${a.auteur.pseudo}`} onPress={ouvrirProfil} style={styles.ligneAuteur}>
          <Avatar initiale={a.auteur.pseudo.charAt(0).toUpperCase()} fond={u.teinte} photo={a.auteur.photo_url} />
          <View style={{ flex: 1 }}>
            <Text style={styles.texte}>
              <Text style={styles.gras}>{nom}</Text> {titreDe ? `${(verbe ?? '').replace(/ de$/, '')} ${titreDe.de}` : `${verbe} `}<Text style={styles.gras}>{titreDe ? titreDe.nom : a.oeuvre.titre}</Text>
            </Text>
            <Text style={styles.petit}>{sousTitre}</Text>
            {a.monEtat ? <Text style={[styles.toiAussi, { color: u.texteFonce }]}>{phraseToiAussi(a.oeuvre.univers, a.monEtat, estSpectacle(a.oeuvre))}</Text> : null}
          </View>
          {/* Mon activité : je peux la corriger (émotions, texte, date, lieu, ciné ou maison, photo). */}
          {cEstMoi ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Modifier mon activité ${a.oeuvre.titre}`}
              onPress={() => router.push({ pathname: '/enregistrer', params: { modifier: a.id } })}
              hitSlop={8}
              style={styles.modifier}
            >
              <Text style={styles.modifierTexte}>⋯</Text>
            </Pressable>
          ) : null}
        </Pressable>
        {a.emotions.length > 0 && (
          <View style={styles.emotions}>
            {a.emotions.map((id) => {
              const e = emotionParId(id);
              return e ? (
                <Text key={id} style={styles.emotion}>
                  {e.emoji} {e.label}
                </Text>
              ) : null;
            })}
          </View>
        )}
        {a.mots ? <Text style={[styles.texte, { marginBottom: 12 }]}>{a.mots}</Text> : null}
      </View>
      {/* Qui a applaudi : les petites photos et les prénoms (on touche pour voir toute la liste). */}
      {applaudisseurs.length > 0 && !surLaPage ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${texteApplaudi}. Voir qui a applaudi`}
          disabled={surLaPage}
          onPress={() => router.push({ pathname: '/activite/[id]', params: { id: a.id } })}
          style={styles.applaudi}
        >
          <View style={styles.pilePhotos}>
            {applaudisseurs.slice(0, 3).map((p, k) => (
              <View key={p.id} style={[styles.unePhoto, { marginLeft: k ? -8 : 0, zIndex: 3 - k }]}>
                <Avatar initiale={p.pseudo.charAt(0).toUpperCase()} fond={u.teinte} photo={p.photo_url} taille={24} />
              </View>
            ))}
          </View>
          <Text style={styles.applaudiTexte} numberOfLines={1}>{texteApplaudi}</Text>
        </Pressable>
      ) : null}
      {/* Une seule rangée de gestes, toujours dans le même ordre. */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: envoye, disabled: cEstMoi }}
          accessibilityLabel={cEstMoi ? `${total} Kulkoko${total > 1 ? 's' : ''} reçu${total > 1 ? 's' : ''}${total > 0 && !surLaPage ? ' : voir qui t’a applaudi' : ''}` : envoye ? 'Retirer mon Kulkoko' : `Envoyer un Kulkoko à ${a.auteur.pseudo}`}
          onPress={culkoko}
          style={[styles.action, envoye && styles.actionEnvoyee]}
        >
          <EclatConfettis declencheur={salves} />
          <View style={anime ? styles.pop : undefined}>
            <IconeCulkoko taille={22} couleur={envoye ? '#FFFFFF' : colors.culkoko} plein={envoye} fond={colors.culkoko} />
          </View>
          <Text style={[styles.actionTexte, { color: envoye ? '#FFFFFF' : colors.culkoko }]}>{total > 0 ? `Kulkoko ${total}` : 'Kulkoko'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.nbCommentaires ? `${a.nbCommentaires} commentaire${a.nbCommentaires > 1 ? 's' : ''}` : `Commenter l’activité de ${a.auteur.pseudo}`}
          disabled={surLaPage}
          onPress={() => router.push({ pathname: '/activite/[id]', params: { id: a.id } })}
          style={styles.action}
        >
          <View>
            <IconeBulle taille={22} couleur={colors.encre} />
            {a.nbCommentaires > 0 ? (
              <View style={styles.pastilleNombre}>
                <Text style={styles.pastilleTexte}>{a.nbCommentaires > 99 ? '99+' : a.nbCommentaires}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.actionTexte} numberOfLines={1}>Commenter</Text>
        </Pressable>
        {!cEstMoi ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: envie }}
            accessibilityLabel={envie ? `Retirer ${a.oeuvre.titre} de mes envies` : `Ajouter ${a.oeuvre.titre} à mes envies`}
            onPress={caMeTente}
            style={[styles.action, envie && styles.actionEnvie]}
          >
            <IconeEnvies taille={22} couleur={envie ? colors.sousTitre : colors.encre} coche={envie} />
            <Text style={[styles.actionTexte, envie && { color: colors.sousTitre }]} numberOfLines={1}>{envie ? 'Ajouté' : 'Ça me tente'}</Text>
          </Pressable>
        ) : null}
        {/* Moi aussi, je l'ai vécu (sans l'avoir encore noté) : on ouvre l'enregistrement avec l'œuvre déjà choisie. */}
        {!cEstMoi && !a.monEtat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${libelleVecu} : ajouter ${a.oeuvre.titre} à mon journal`}
            onPress={() => router.push({ pathname: '/enregistrer', params: { oeuvre: a.oeuvre_id } })}
            style={styles.action}
          >
            <IconeVecu taille={22} couleur={colors.encre} />
            <Text style={styles.actionTexte} numberOfLines={1}>{libelleVecu}</Text>
          </Pressable>
        ) : null}
        {/* On ne conseille que ce qu'on a vécu soi-même : le bouton n'apparaît que si l'œuvre est aussi dans mon journal. */}
        {cEstMoi || a.monEtat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Conseiller ${a.oeuvre.titre} à un ami`}
            onPress={() => router.push({ pathname: '/penser', params: { oeuvre: a.oeuvre_id } })}
            style={styles.action}
          >
            <IconePensee taille={22} couleur={colors.encre} />
            <Text style={styles.actionTexte}>Conseiller</Text>
          </Pressable>
        ) : null}
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  toiAussi: { fontFamily: fonts.texteMoyen, fontSize: 13, marginTop: 2 },
  visuel: { padding: 14, justifyContent: 'center', overflow: 'hidden' },
  visuelVedette: { height: 230 },
  visuelAffiche: { height: 210 },
  flou: { position: 'absolute', top: -40, left: -40, right: -40, bottom: -40 },
  voileFlou: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,27,36,0.18)' },
  affiche: { position: 'absolute', left: 20, right: 20, bottom: 16 },
  afficheEmoji: { fontSize: 30, marginBottom: 4 },
  afficheTitre: { fontFamily: fonts.titreGras, fontSize: 30, lineHeight: 33, letterSpacing: -0.5 },
  afficheLieu: { fontFamily: fonts.texteMoyen, fontSize: 14, marginTop: 6 },
  // Le même format que l'écran de recadrage : ce qu'on a cadré est exactement ce que les amis voient.
  visuelPhoto: { aspectRatio: 4 / 3 },
  couverture: { alignSelf: 'center', width: 134, height: 198, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
  etiquette: {
    position: 'absolute',
    top: 12,
    left: 14,
    backgroundColor: colors.carte,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontFamily: fonts.texteGras,
    fontSize: 12,
    color: colors.encre,
  },
  corps: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  modifier: { alignSelf: 'flex-start', width: 36, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  modifierTexte: { fontFamily: fonts.texteGras, fontSize: 20, lineHeight: 22, color: colors.gris },
  ligneAuteur: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  gras: { fontFamily: fonts.texteGras },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  emotion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.beige, fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  pastilleNombre: { position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.sousTitre, alignItems: 'center', justifyContent: 'center' },
  pastilleTexte: { fontFamily: fonts.texteGras, fontSize: 11, color: '#FFFFFF' },
  applaudi: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12, minHeight: 36 },
  pilePhotos: { flexDirection: 'row' },
  unePhoto: { borderRadius: 14, borderWidth: 2, borderColor: colors.carte },
  applaudiTexte: { flex: 1, fontFamily: fonts.texteMoyen, fontSize: 13, color: colors.gris },
  actions: { borderTopWidth: 1, borderTopColor: colors.separateur, padding: 6, flexDirection: 'row', gap: 4 },
  action: { flex: 1, minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 },
  actionEnvoyee: { backgroundColor: colors.culkoko },
  actionEnvie: { backgroundColor: colors.beige },
  actionTexte: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.encre },
  pop: { transform: [{ scale: 1.35 }] },
});
