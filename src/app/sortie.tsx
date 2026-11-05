// « On y va ensemble ? » : proposer une sortie à des amis, avec une date.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BoutonPrincipal } from '../components/Base';
import { MessageACopier, MessageErreur } from '../components/Formulaire';
import { IconeFermer } from '../components/Icones';
import { aujourdhuiIso, isoVersFr, jourLong, lireDateFr, prochainJour } from '../lib/dates';
import { lireOeuvre, type OeuvreTrouvee } from '../lib/oeuvres';
import { mesAmis, type Ami } from '../lib/penses';
import { traduireErreur, useSession } from '../lib/session';
import { creerSortie } from '../lib/sorties';
import { colors, fonts, univers } from '../theme';

const MAX_INVITES = 30; // la base n'en accepte pas plus

export default function NouvelleSortie() {
  const params = useLocalSearchParams<{ oeuvre: string; avec?: string }>();
  const { session } = useSession();
  const moi = session?.user.id ?? '';
  const [oeuvre, setOeuvre] = useState<OeuvreTrouvee | null>(null);
  const [amis, setAmis] = useState<Ami[]>([]);
  const [invites, setInvites] = useState<string[]>(params.avec ? params.avec.split(',').filter(Boolean) : []);
  const [dateTexte, setDateTexte] = useState('');
  const [heure, setHeure] = useState('');
  const [lieu, setLieu] = useState('');
  const [mot, setMot] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aCopier, setACopier] = useState<string | null>(null);

  useEffect(() => {
    if (!params.oeuvre || !moi) return;
    Promise.all([lireOeuvre(params.oeuvre), mesAmis(moi)])
      .then(([o, a]) => {
        setOeuvre(o);
        setAmis(a);
        // Seulement des amis (demande acceptée), jamais moi, et 30 invités au plus.
        setInvites((l) => l.filter((x) => x !== moi && a.some((ami) => ami.id === x)).slice(0, MAX_INVITES));
      })
      .catch(() => setErreur('Impossible de charger tes amis pour l’instant.'))
      .finally(() => setChargement(false));
  }, [params.oeuvre, moi]);

  const date = lireDateFr(dateTexte);
  const datePassee = !!date && date < aujourdhuiIso();
  const apresFermeture = !!date && !!oeuvre?.date_fin && date > oeuvre.date_fin;
  const valide = !!date && !datePassee && invites.length > 0;

  const raccourcis = [
    { texte: 'Ce samedi', iso: prochainJour(6) },
    { texte: 'Ce dimanche', iso: prochainJour(0) },
    { texte: 'Dans une semaine', iso: aujourdhuiIso(7) },
  ];

  function fermer() {
    if (router.canGoBack()) router.back();
    else router.replace('/envies');
  }

  async function proposer() {
    if (!oeuvre?.id || !date || !valide || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      await creerSortie(moi, { oeuvreId: oeuvre.id, date, heure, lieu, mot, invites });
      router.replace({ pathname: '/envies', params: { vue: 'sorties' } });
    } catch (e) {
      setEnCours(false);
      setErreur(traduireErreur(e));
    }
  }

  // Pour quelqu'un qui n'a pas Kulky : un message à envoyer par WhatsApp, SMS…
  async function proposerParMessage() {
    if (!oeuvre) return;
    const quand = date ? ` ${jourLong(date).toLowerCase()}${heure.trim() ? ` à ${heure.trim()}` : ''}` : '';
    const lien = Platform.OS === 'web' && typeof window !== 'undefined' ? `\n— envoyé depuis Kulky : ${window.location.origin}` : '';
    const texte = `On y va ensemble${quand} ? « ${oeuvre.titre} »${lieu.trim() ? `, ${lieu.trim()}` : ''}.${mot.trim() ? `\n${mot.trim()}` : ''}${lien}`;
    setACopier(null);
    try {
      await Share.share({ message: texte });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // partage annulé
      setACopier(texte);
    }
  }

  const u = oeuvre ? univers[oeuvre.univers] : null;

  return (
    <SafeAreaView style={styles.ecran}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.entete}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} style={styles.rond44}>
            <IconeFermer />
          </Pressable>
          <Text accessibilityRole="header" style={styles.titre}>On y va ensemble ?</Text>
          <View style={{ width: 44 }} />
        </View>

        {chargement ? (
          <ActivityIndicator color={colors.culkoko} style={{ marginTop: 40 }} />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              {oeuvre && u && (
                <View style={[styles.oeuvre, { backgroundColor: u.teinte }]}>
                  {oeuvre.image_url ? <Image source={{ uri: oeuvre.image_url }} style={styles.vignette} /> : <View style={[styles.vignette, { backgroundColor: u.couleur }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.universTexte, { color: u.texteFonce }]}>{u.label}</Text>
                    <Text style={styles.titreOeuvre} numberOfLines={2}>{oeuvre.titre}</Text>
                    {oeuvre.date_fin ? <Text style={styles.petit}>Jusqu’au {jourLong(oeuvre.date_fin).toLowerCase()}</Text> : null}
                  </View>
                </View>
              )}

              <Text style={styles.section}>Quand ?</Text>
              <View style={styles.puces}>
                {raccourcis.map((r) => {
                  const actif = date === r.iso;
                  return (
                    <Pressable key={r.texte} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => setDateTexte(isoVersFr(r.iso))} style={[styles.puce, actif && styles.puceActive]}>
                      <Text style={[styles.puceTexte, actif && { color: '#FFFFFF' }]}>{r.texte}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 3, gap: 6 }}>
                  <Text style={styles.label}>La date</Text>
                  <TextInput aria-label="La date" value={dateTexte} onChangeText={setDateTexte} placeholder="jj/mm/aaaa" placeholderTextColor={colors.gris} style={styles.champ} />
                </View>
                <View style={{ flex: 2, gap: 6 }}>
                  <Text style={styles.label}>L’heure</Text>
                  <TextInput aria-label="L’heure (facultatif)" value={heure} onChangeText={setHeure} placeholder="20 h 30" placeholderTextColor={colors.gris} maxLength={20} style={styles.champ} />
                </View>
              </View>
              {date && !datePassee ? <Text style={styles.petit}>{jourLong(date)}</Text> : null}
              {datePassee ? <Text style={styles.alerte}>Cette date est déjà passée.</Text> : null}
              {apresFermeture ? <Text style={styles.alerte}>Attention : c’est après la fermeture ({jourLong(oeuvre!.date_fin!).toLowerCase()}).</Text> : null}

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Où ? (facultatif)</Text>
                <TextInput aria-label="Où ? (facultatif)" value={lieu} onChangeText={setLieu} placeholder="Le lieu, ou un point de rendez-vous" placeholderTextColor={colors.gris} maxLength={120} style={styles.champ} />
              </View>

              <Text style={styles.section}>Avec qui ?</Text>
              {amis.length === 0 ? (
                <Text style={styles.petit}>Tu n’as pas encore d’amis sur Kulky (ou ils n’ont pas encore accepté ta demande). Propose la sortie par message avec le lien ci-dessous.</Text>
              ) : (
                <View style={styles.puces}>
                  {amis.map((a) => {
                    const actif = invites.includes(a.id);
                    return (
                      <Pressable
                        key={a.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: actif }}
                        onPress={() => setInvites(actif ? invites.filter((x) => x !== a.id) : invites.length >= MAX_INVITES ? invites : [...invites, a.id])}
                        style={[styles.ami, actif && styles.puceActive]}
                      >
                        <Avatar initiale={a.pseudo.charAt(0).toUpperCase()} fond={univers[a.univers_choisis?.[0] ?? 'livres'].teinte} taille={32} />
                        <Text style={[styles.puceTexte, actif && { color: '#FFFFFF' }]}>{a.pseudo}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>Un petit mot (facultatif)</Text>
                <TextInput aria-label="Un petit mot" value={mot} onChangeText={setMot} placeholder="On prend un verre après ?" placeholderTextColor={colors.gris} multiline maxLength={300} style={[styles.champ, { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' }]} />
              </View>

              <MessageErreur texte={erreur} />
              <MessageACopier texte={aCopier} />

              <Pressable accessibilityRole="button" onPress={proposerParMessage} style={styles.lien}>
                <Text style={styles.lienTexte}>Proposer par message à quelqu’un qui n’a pas encore Kulky</Text>
              </Pressable>
            </ScrollView>
            <View style={styles.pied}>
              <BoutonPrincipal
                label={enCours ? 'Un instant…' : !date ? 'Choisis une date' : invites.length === 0 ? 'Choisis au moins un ami' : 'Proposer la sortie'}
                desactive={!valide || enCours}
                onPress={proposer}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  rond44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: fonts.titre, fontSize: 18, color: colors.culkoko },
  contenu: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  oeuvre: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12 },
  vignette: { width: 52, height: 72, borderRadius: 8 },
  universTexte: { fontFamily: fonts.texteGras, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  titreOeuvre: { fontFamily: fonts.titre, fontSize: 17, color: colors.encre },
  section: { fontFamily: fonts.titre, fontSize: 17, color: colors.sousTitre, marginTop: 4 },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  petit: { fontFamily: fonts.texte, fontSize: 13, lineHeight: 18, color: colors.gris },
  alerte: { fontFamily: fonts.texteMoyen, fontSize: 13, color: '#9B2335' },
  champ: { minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 14, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.bordure, backgroundColor: colors.carte, justifyContent: 'center' },
  puceActive: { backgroundColor: colors.culkoko, borderColor: colors.culkoko },
  puceTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: colors.encre },
  ami: { height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  lien: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  lienTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.culkoko, textAlign: 'center' },
  pied: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26 },
});
