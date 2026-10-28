// Onglet Accueil : « Que vivent les autres ? »
// Le fil des personnes suivies (Abonnements) ou de toute la communauté (Découvrir).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BandeauDemo, Carte, FiltreUnivers, Logo } from '../../components/Base';
import { IconeBulle, IconeCloche, IconeCulkoko, IconePlus } from '../../components/Icones';
import { etapeDemo, filDemo, type ActiviteDemo } from '../../data/demo';
import { emotionParId } from '../../data/emotions';
import { colors, fonts, univers, type UniversId } from '../../theme';

export default function Accueil() {
  const [onglet, setOnglet] = useState<'abonnements' | 'decouvrir'>('abonnements');
  const [filtre, setFiltre] = useState<UniversId | 'tout'>('tout');
  const activites = filDemo.filter((a) => filtre === 'tout' || a.univers === filtre);

  return (
    <SafeAreaView edges={['top']} style={styles.ecran}>
      <View style={styles.entete}>
        <Logo />
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={styles.cloche}>
          <IconeCloche />
          <View style={styles.pastilleNotif} />
        </Pressable>
      </View>

      <View style={styles.onglets}>
        {(['abonnements', 'decouvrir'] as const).map((o) => {
          const actif = onglet === o;
          return (
            <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => setOnglet(o)} style={[styles.onglet, actif ? styles.ongletActif : styles.ongletInactif]}>
              <Text style={[styles.ongletTexte, { color: actif ? '#FFFFFF' : colors.encre, fontFamily: actif ? fonts.texteGras : fonts.texteMoyen }]}>
                {o === 'abonnements' ? 'Abonnements' : 'Découvrir'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FiltreUnivers choix={filtre} onChange={setFiltre} />

      <ScrollView contentContainerStyle={styles.fil}>
        <BandeauDemo />
        {activites[0] && <CarteActivite a={activites[0]} />}
        {(filtre === 'tout' || filtre === 'livres') && (
          <View style={styles.etape}>
            <View style={styles.etapeRond}>
              <Text style={styles.etapeNombre}>{etapeDemo.nombre}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.texte}>
                <Text style={styles.gras}>{etapeDemo.auteur}</Text> {etapeDemo.texte}
              </Text>
              <Text style={[styles.petit, { color: '#3D5E5C' }]}>{etapeDemo.objectif}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Envoyer un Culkoko à ${etapeDemo.auteur}`} style={styles.etapeBouton}>
              <IconeCulkoko taille={20} couleur="#FFFFFF" />
            </Pressable>
          </View>
        )}
        {activites.slice(1).map((a) => (
          <CarteActivite key={a.id} a={a} />
        ))}
        {activites.length === 0 && <Text style={[styles.texte, styles.vide]}>Rien pour l’instant dans cet univers. Jette un œil à Découvrir !</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function CarteActivite({ a }: { a: ActiviteDemo }) {
  const u = univers[a.univers];
  const [culkoko, setCulkoko] = useState(false);
  return (
    <Carte>
      <View style={[styles.visuel, { backgroundColor: u.couleur }]}>
        <Text style={styles.etiquette}>
          {u.label}
          {a.detail ? ` · ${a.detail}` : ''}
        </Text>
        <Text style={styles.placeholder}>[Photo, affiche ou couverture]</Text>
      </View>
      <View style={styles.corps}>
        <View style={styles.ligneAuteur}>
          <Avatar initiale={a.initiale} fond={u.teinte} />
          <View style={{ flex: 1 }}>
            <Text style={styles.texte}>
              <Text style={styles.gras}>{a.auteur}</Text> {a.verbe} <Text style={styles.gras}>{a.oeuvre}</Text>
            </Text>
            <Text style={styles.petit}>
              {a.lieu} · {a.quand}
              {a.avec ? ` · avec ${a.avec}` : ''}
            </Text>
          </View>
        </View>
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
        {a.mots ? <Text style={[styles.texte, { marginBottom: 12 }]}>{a.mots}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: culkoko }} onPress={() => setCulkoko(!culkoko)} style={styles.action}>
          <IconeCulkoko couleur={colors.culkoko} />
          <Text style={[styles.actionTexte, { color: colors.culkoko, fontFamily: fonts.texteGras }]}>
            {a.culkoko + (culkoko ? 1 : 0)} Culkoko
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${a.commentaires} commentaires`} style={styles.action}>
          <IconeBulle />
          <Text style={styles.actionTexte}>{a.commentaires}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={[styles.action, { flex: 1.4 }]}>
          <IconePlus taille={18} epaisseur={1.8} />
          <Text style={styles.actionTexte}>Ça me tente</Text>
        </Pressable>
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.fond },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  cloche: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.carte, alignItems: 'center', justifyContent: 'center' },
  pastilleNotif: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.culkoko },
  onglets: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  onglet: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ongletActif: { backgroundColor: colors.encre },
  ongletInactif: { backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure },
  ongletTexte: { fontSize: 15 },
  fil: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  visuel: { height: 150, padding: 14, justifyContent: 'flex-end' },
  etiquette: { position: 'absolute', top: 12, left: 14, backgroundColor: colors.carte, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', fontFamily: fonts.texteGras, fontSize: 12, color: colors.encre },
  placeholder: { alignSelf: 'flex-start', fontFamily: fonts.titre, fontSize: 13, color: colors.encre, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  corps: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  ligneAuteur: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  texte: { fontFamily: fonts.texte, fontSize: 15, lineHeight: 21, color: colors.encre },
  gras: { fontFamily: fonts.texteGras },
  petit: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  emotions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  emotion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.beige, fontFamily: fonts.texte, fontSize: 13, color: colors.encre },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.separateur },
  action: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionTexte: { fontFamily: fonts.texte, fontSize: 14, color: colors.encre },
  etape: { backgroundColor: univers.livres.teinte, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  etapeRond: { width: 52, height: 52, borderRadius: 26, backgroundColor: univers.livres.couleur, alignItems: 'center', justifyContent: 'center' },
  etapeNombre: { fontFamily: fonts.titreGras, fontSize: 20, color: '#FFFFFF' },
  etapeBouton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.culkoko, alignItems: 'center', justifyContent: 'center' },
  vide: { textAlign: 'center', color: colors.gris, marginTop: 24 },
});
