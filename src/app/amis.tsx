// Mes amis : trouver quelqu'un par son pseudo, inviter un ami sur Culky, et voir qui je suis / qui me suit.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Base';
import { EnTetePage } from '../components/EnTete';
import { EtatVide } from '../components/EtatVide';
import { chercherProfils, listerAmis, suivre, type Ami, type ProfilPublic } from '../lib/fil';
import { lienRejoindre } from '../lib/invitation';
import { useSession } from '../lib/session';
import { colors, fonts, univers } from '../theme';

export default function Amis() {
  const { session, profil } = useSession();
  const moi = session?.user.id ?? '';
  const [amis, setAmis] = useState<Ami[]>([]);
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ProfilPublic[]>([]);
  const [copie, setCopie] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (moi) listerAmis(moi, moi).then(setAmis, () => setAmis([]));
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
    const message = `Rejoins-moi sur Culky pour partager nos lectures, nos films et nos sorties ! ${lien}`;
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
          placeholderTextColor={colors.gris}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.recherche}
        />
        {resultats.map((p) => (
          <LignePersonne key={p.id} p={p} onPress={() => router.push({ pathname: '/profil/[id]', params: { id: p.id } })} />
        ))}
        {texte.trim().length >= 2 && resultats.length === 0 ? <Text style={styles.message}>Personne avec ce pseudo. Et si tu l’invitais ?</Text> : null}

        <Pressable accessibilityRole="button" onPress={inviter} style={styles.inviter}>
          <Text style={styles.inviterTitre}>Inviter un ami sur Culky</Text>
          <Text style={styles.inviterTexte}>Envoie-lui ton lien : quand il crée son compte, vous êtes reliés tout de suite.</Text>
        </Pressable>
        {copie ? <Text style={styles.message}>Le message est copié : colle-le dans WhatsApp, un SMS ou un e-mail.</Text> : null}

        {aSuivreEnRetour.length > 0 ? (
          <View style={styles.bloc}>
            <Text style={styles.sousTitre}>Ils te suivent, suis-les en retour</Text>
            {aSuivreEnRetour.map((a) => (
              <LignePersonne key={a.id} p={a} onPress={() => router.push({ pathname: '/profil/[id]', params: { id: a.id } })} action={{ texte: 'Suivre', onPress: () => basculer(a) }} />
            ))}
          </View>
        ) : null}

        <View style={styles.bloc}>
          <Text style={styles.sousTitre}>
            {suivis} abonnement{suivis > 1 ? 's' : ''} · {abonnes} abonné{abonnes > 1 ? 's' : ''}
          </Text>
          {amis.length === 0 ? (
            <EtatVide compact titre="Ta bande t’attend" texte={`${profil?.pseudo ?? 'Toi'}, cherche un pseudo ci-dessus ou envoie ton lien d’invitation : Culky est bien plus joyeux à plusieurs.`} />
          ) : null}
          {amis
            .filter((a) => a.jeLeSuis)
            .map((a) => (
              <LignePersonne
                key={a.id}
                p={a}
                detail={a.ilMeSuit ? 'Vous vous suivez' : undefined}
                onPress={() => router.push({ pathname: '/profil/[id]', params: { id: a.id } })}
                action={{ texte: 'Abonné·e ✓', onPress: () => basculer(a), discret: true }}
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
          <Text style={[styles.actionTexte, action.discret ? { color: colors.encre } : null]}>{action.texte}</Text>
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
  message: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: colors.gris, textAlign: 'center' },
  inviter: { backgroundColor: colors.culkoko, borderRadius: 18, padding: 16, gap: 4, marginTop: 6 },
  inviterTitre: { fontFamily: fonts.titre, fontSize: 17, color: '#FFFFFF' },
  inviterTexte: { fontFamily: fonts.texte, fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  bloc: { gap: 8, marginTop: 10 },
  sousTitre: { fontFamily: fonts.titre, fontSize: 16, color: colors.encre },
  personne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.carte, borderRadius: 16, paddingVertical: 8, paddingLeft: 10, paddingRight: 8 },
  personneLien: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  pseudo: { fontFamily: fonts.texteGras, fontSize: 15, color: colors.encre },
  detail: { fontFamily: fonts.texte, fontSize: 12, color: colors.gris },
  voir: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko, paddingHorizontal: 8 },
  action: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.culkoko, justifyContent: 'center' },
  actionDiscrete: { backgroundColor: colors.beige },
  actionTexte: { fontFamily: fonts.texteGras, fontSize: 13, color: '#FFFFFF' },
});
