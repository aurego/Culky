// Mes amis : trouver quelqu'un par son pseudo, inviter un ami sur Kulky, et voir qui je suis / qui me suit.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Base';
import { EnTetePage } from '../components/EnTete';
import { EtatVide } from '../components/EtatVide';
import { chercherProfils, listerAmis, suivre, type Ami, type ProfilPublic } from '../lib/fil';
import { lienRejoindre } from '../lib/invitation';
import { suggererAmis, type Suggestion } from '../lib/suggestions';
import { useSession } from '../lib/session';
import { colors, fonts, univers } from '../theme';

export default function Amis() {
  const { session, profil } = useSession();
  const moi = session?.user.id ?? '';
  const [amis, setAmis] = useState<Ami[]>([]);
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ProfilPublic[]>([]);
  const [copie, setCopie] = useState(false);
  const params = useLocalSearchParams<{ liste?: string }>();
  const [liste, setListe] = useState<'abonnements' | 'abonnes'>(params.liste === 'abonnes' ? 'abonnes' : 'abonnements');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suivisIci, setSuivisIci] = useState<Set<string>>(new Set()); // suivis depuis cet écran (recherche, suggestions)

  useFocusEffect(
    useCallback(() => {
      if (!moi) return;
      listerAmis(moi, moi).then(setAmis, () => setAmis([]));
      suggererAmis(moi).then(setSuggestions, () => setSuggestions([]));
    }, [moi]),
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

  async function inviter() {
    const lien = lienRejoindre(moi);
    const message = `Rejoins-moi sur Kulky ! C’est comme une appli de sport, mais pour la culture : on y garde nos livres, films, concerts et expos, et on se les partage. ${lien}`;
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard?.writeText(message);
        setCopie(true);
      } catch {
        setCopie(false);
      }
    }
  }

  async function basculer(a: Ami) {
    const oui = !a.jeLeSuis;
    setAmis((l) => l.map((x) => (x.id === a.id ? { ...x, jeLeSuis: oui } : x)));
    await suivre(moi, a.id, oui).catch(() => setAmis((l) => l.map((x) => (x.id === a.id ? { ...x, jeLeSuis: !oui } : x))));
  }

  // Suivre (ou ne plus suivre) quelqu'un directement depuis la recherche ou les suggestions.
  async function suivreIci(p: ProfilPublic) {
    const oui = !estSuivi(p.id);
    setSuivisIci((s) => {
      const n = new Set(s);
      if (oui) n.add(p.id);
      else n.delete(p.id);
      return n;
    });
    setAmis((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? { ...x, jeLeSuis: oui } : x)) : oui ? [...l, { ...p, jeLeSuis: true, ilMeSuit: false }] : l));
    await suivre(moi, p.id, oui).catch(() => undefined);
  }
  const estSuivi = (id: string) => suivisIci.has(id) || amis.some((a) => a.id === id && a.jeLeSuis);
  const boutonSuivre = (p: ProfilPublic) => ({ texte: estSuivi(p.id) ? 'Abonné·e ✓' : 'Suivre', onPress: () => suivreIci(p), discret: estSuivi(p.id) });

  // Pas de doublon : quelqu'un qui me suit déjà apparaît dans « Mes abonnés », pas dans les suggestions.
  const suggestionsVisibles = suggestions.filter((p) => !amis.some((a) => a.id === p.id && a.ilMeSuit));
  const suivis = amis.filter((a) => a.jeLeSuis).length;
  const abonnes = amis.filter((a) => a.ilMeSuit).length;
  const aSuivreEnRetour = amis.filter((a) => a.ilMeSuit && !a.jeLeSuis);

  return (
    <SafeAreaView style={styles.ecran}>
      <EnTetePage titre="Mes amis" />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
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
          <LignePersonne key={p.id} p={p} onPress={() => router.push({ pathname: '/profil/[id]', params: { id: p.id } })} action={boutonSuivre(p)} />
        ))}

        {texte.trim().length < 2 && suggestionsVisibles.length > 0 ? (
          <View style={styles.bloc}>
            <Text style={styles.sousTitre}>Tu les connais peut-être</Text>
            {suggestionsVisibles.map((p) => (
              <LignePersonne key={p.id} p={p} detail={p.raison} onPress={() => router.push({ pathname: '/profil/[id]', params: { id: p.id } })} action={boutonSuivre(p)} />
            ))}
          </View>
        ) : null}
        {texte.trim().length >= 2 && resultats.length === 0 ? <Text style={styles.message}>Pas encore de Kulky à ce pseudo. Et si tu l’invitais ?</Text> : null}

        <Pressable accessibilityRole="button" onPress={inviter} style={styles.inviter}>
          <Text style={styles.inviterTitre}>Inviter un ami sur Kulky</Text>
          <Text style={styles.inviterTexte}>Envoie-lui ton lien : quand il crée son compte, vous êtes reliés tout de suite.</Text>
        </Pressable>
        {copie ? <Text style={styles.message}>Le message est copié : colle-le dans WhatsApp, un SMS ou un e-mail.</Text> : null}

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
          {amis.length === 0 ? (
            <EtatVide compact titre="Ta bande t’attend" texte={`${profil?.pseudo ?? 'Toi'}, cherche un pseudo ci-dessus ou envoie ton lien d’invitation : Kulky est bien plus joyeux à plusieurs.`} />
          ) : null}
          {liste === 'abonnements' && amis.length > 0 && suivis === 0 ? <Text style={styles.message}>Tu ne suis personne pour l’instant : regarde les suggestions ci-dessus.</Text> : null}
          {liste === 'abonnes' && amis.length > 0 && abonnes === 0 ? <Text style={styles.message}>Personne ne te suit encore : envoie ton lien à tes amis !</Text> : null}
          {amis
            .filter((a) => (liste === 'abonnements' ? a.jeLeSuis : a.ilMeSuit))
            // Dans mes abonnés, ceux que je ne suis pas encore d'abord.
            .sort((x, y) => (liste === 'abonnes' ? Number(x.jeLeSuis) - Number(y.jeLeSuis) : 0))
            .map((a) => (
              <LignePersonne
                key={a.id}
                p={a}
                detail={a.ilMeSuit && a.jeLeSuis ? 'Vous vous suivez' : a.ilMeSuit ? 'Te suit' : undefined}
                onPress={() => router.push({ pathname: '/profil/[id]', params: { id: a.id } })}
                action={a.jeLeSuis ? { texte: 'Abonné·e ✓', onPress: () => basculer(a), discret: true } : { texte: 'Suivre en retour', onPress: () => basculer(a) }}
              />
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LignePersonne({ p, onPress, action, detail }: { p: ProfilPublic; onPress: () => void; action?: { texte: string; onPress: () => void; discret?: boolean }; detail?: string }) {
  return (
    <View style={styles.personne}>
      <Pressable accessibilityRole="link" onPress={onPress} style={styles.personneLien}>
        <Avatar initiale={p.pseudo.charAt(0).toUpperCase()} fond={univers[p.univers_choisis?.[0] ?? 'livres'].teinte} photo={p.photo_url} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pseudo} numberOfLines={1}>{p.pseudo}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
      </Pressable>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={[styles.action, action.discret ? styles.actionDiscrete : null]}>
          <Text style={[styles.actionTexte, action.discret ? { color: colors.gris } : null]}>{action.texte}</Text>
        </Pressable>
      ) : (
        <Text style={styles.voir}>Voir ›</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  contenu: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  recherche: { height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 18, fontFamily: fonts.texte, fontSize: 15, color: colors.encre },
  onglets: { flexDirection: 'row', gap: 8 },
  onglet: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.carte, borderColor: colors.culkoko },
  ongletTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.encre },
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  inviter: { backgroundColor: univers.livres.teinte, borderRadius: 18, padding: 16, gap: 4, marginTop: 6 },
  inviterTitre: { fontFamily: fonts.titre, fontSize: 17, color: univers.livres.texteFonce },
  inviterTexte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: univers.livres.texteFonce },
  bloc: { gap: 8, marginTop: 10 },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.sousTitre },
  personne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.carte, borderRadius: 16, paddingVertical: 8, paddingLeft: 10, paddingRight: 8 },
  personneLien: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  pseudo: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  detail: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  voir: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko, paddingHorizontal: 8 },
  action: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.culkoko, backgroundColor: colors.carte, justifyContent: 'center' },
  actionDiscrete: { backgroundColor: colors.beige, borderColor: colors.beige },
  actionTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: colors.culkoko },
});
