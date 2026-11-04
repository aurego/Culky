// Une carte d'activité dans le fil : l'œuvre, qui, où, quand, les émotions, les mots, et le Kulkoko.
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { emotionParId } from '../data/emotions';
import { quandActivite } from '../lib/dates';
import { phraseToiAussi } from '../lib/croises';
import { estSpectacle } from '../lib/scene';
import { ajouterEnvie, retirerEnvie } from '../lib/envies';
import { basculerCulkoko, type ActiviteFil } from '../lib/fil';
import { colors, fonts, univers } from '../theme';
import { Avatar, Carte } from './Base';
import { IconeBulle, IconeCulkoko, IconeEnvies, IconePensee } from './Icones';

const verbes = {
  livres: { fini: 'a lu', commence: 'a commencé' },
  cine: { fini: 'a vu', commence: 'a vu' },
  concerts: { fini: 'était au concert de', commence: 'était au concert de' },
  expos: { fini: 'a visité', commence: 'a visité' },
};

export function CarteActivite({ a, moi, detail: surLaPage = false }: { a: ActiviteFil; moi: string; detail?: boolean }) {
  const u = univers[a.oeuvre.univers];
  const [envoye, setEnvoye] = useState(a.monCulkoko);
  const [total, setTotal] = useState(a.culkoko);
  const [anime, setAnime] = useState(false);
  const [envie, setEnvie] = useState(a.monEnvie);
  const cEstMoi = a.auteur_id === moi;
  const nom = cEstMoi ? 'Tu' : a.auteur.pseudo;
  const verbeAutre = estSpectacle(a.oeuvre) ? 'a vu le spectacle' : verbes[a.oeuvre.univers][a.etat];
  const verbe = cEstMoi
    ? { 'a lu': 'as lu', 'a commencé': 'as commencé', 'a vu': 'as vu', 'était au concert de': 'étais au concert de', 'a visité': 'as visité', 'a vu le spectacle': 'as vu le spectacle' }[verbeAutre]
    : verbeAutre;
  const detail = a.oeuvre.univers === 'cine' && a.au_cinema !== null ? (a.au_cinema ? 'au cinéma' : 'à la maison') : null;
  const sousTitre = [a.lieu?.nom, quandActivite(a.date_activite, a.cree_le)].filter(Boolean).join(' · ');

  async function culkoko() {
    if (cEstMoi) return; // on ne s'envoie pas de Kulkoko à soi-même
    const nouveau = !envoye;
    setEnvoye(nouveau);
    setTotal(total + (nouveau ? 1 : -1));
    if (nouveau) {
      setAnime(true);
      setTimeout(() => setAnime(false), 900);
    }
    try {
      await basculerCulkoko(a.id, moi, nouveau);
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

  const ouvrirProfil = () => (cEstMoi ? router.push('/carnet') : router.push({ pathname: '/profil/[id]', params: { id: a.auteur_id } }));

  return (
    <Carte>
      <View style={[styles.visuel, { backgroundColor: u.couleur }, a.photo_url ? styles.visuelPhoto : null]}>
        {a.photo_url ? (
          <Image source={{ uri: a.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Photo de ${a.auteur.pseudo}`} />
        ) : a.oeuvre.image_url ? (
          <Image source={{ uri: a.oeuvre.image_url }} style={styles.couverture} />
        ) : null}
        <Text style={styles.etiquette}>
          {u.label}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
      <View style={styles.corps}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Voir le profil de ${a.auteur.pseudo}`} onPress={ouvrirProfil} style={styles.ligneAuteur}>
          <Avatar initiale={a.auteur.pseudo.charAt(0).toUpperCase()} fond={u.teinte} photo={a.auteur.photo_url} />
          <View style={{ flex: 1 }}>
            <Text style={styles.texte}>
              <Text style={styles.gras}>{nom}</Text> {verbe} <Text style={styles.gras}>{a.oeuvre.titre}</Text>
            </Text>
            <Text style={styles.petit}>{sousTitre}</Text>
            {a.monEtat ? <Text style={[styles.toiAussi, { color: u.texteFonce }]}>{phraseToiAussi(a.oeuvre.univers, a.monEtat, estSpectacle(a.oeuvre))}</Text> : null}
          </View>
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
      {/* Une seule rangée de gestes, toujours dans le même ordre. */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: envoye, disabled: cEstMoi }}
          accessibilityLabel={cEstMoi ? `${total} Kulkoko reçus` : envoye ? 'Retirer mon Kulkoko' : `Envoyer un Kulkoko à ${a.auteur.pseudo}`}
          onPress={culkoko}
          style={[styles.action, envoye && styles.actionEnvoyee]}
        >
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
          <IconeBulle taille={22} couleur={colors.encre} />
          <Text style={styles.actionTexte}>{a.nbCommentaires > 0 ? `Commenter ${a.nbCommentaires}` : 'Commenter'}</Text>
        </Pressable>
        {!cEstMoi ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: envie }}
            accessibilityLabel={envie ? `Retirer ${a.oeuvre.titre} de mes envies` : `Ajouter ${a.oeuvre.titre} à mes envies`}
            onPress={caMeTente}
            style={[styles.action, envie && styles.actionEnvie]}
          >
            <IconeEnvies taille={22} couleur={colors.encre} epaisseur={envie ? 2.4 : 1.8} />
            <Text style={styles.actionTexte}>{envie ? 'Dans mes envies ✓' : 'Ça me tente'}</Text>
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
  visuel: { height: 120, padding: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  visuelPhoto: { height: 220 },
  couverture: { position: 'absolute', right: 16, top: 14, width: 66, height: 96, borderRadius: 6 },
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
  ligneAuteur: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  gras: { fontFamily: fonts.texteGras },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  emotion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.beige, fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  actions: { borderTopWidth: 1, borderTopColor: colors.separateur, padding: 6, flexDirection: 'row', gap: 4 },
  action: { flex: 1, minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 },
  actionEnvoyee: { backgroundColor: colors.culkoko },
  actionEnvie: { backgroundColor: colors.beige },
  actionTexte: { fontFamily: fonts.texteGras, fontSize: 12, color: colors.encre },
  pop: { transform: [{ scale: 1.35 }] },
});
