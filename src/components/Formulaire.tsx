// Champs de saisie et messages réutilisés par les écrans d'inscription.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts } from '../theme';

export function Champ({ label, aide, ...props }: TextInputProps & { label: string; aide?: string }) {
  const [focus, setFocus] = useState(false);
  const id = `champ-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <View style={{ gap: 6 }}>
      <Text nativeID={id} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabelledBy={id}
        aria-label={label}
        placeholderTextColor={colors.gris}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.champ, focus && { borderColor: colors.culkoko }]}
        {...props}
      />
      {aide ? <Text style={styles.aide}>{aide}</Text> : null}
    </View>
  );
}

export function MessageErreur({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return (
    <View accessibilityRole="alert" style={styles.erreur}>
      <Text style={styles.erreurTexte}>{texte}</Text>
    </View>
  );
}

export function MessageInfo({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return (
    <View accessibilityRole="alert" style={styles.info}>
      <Text style={styles.infoTexte}>{texte}</Text>
    </View>
  );
}

// Quand la feuille de partage n'est pas disponible : le message à envoyer, et un bouton pour le copier.
export function MessageACopier({ texte }: { texte: string | null }) {
  const [copie, setCopie] = useState(false);
  if (!texte) return null;
  async function copier() {
    try {
      await navigator.clipboard?.writeText(texte!);
      setCopie(true);
    } catch {
      setCopie(false);
    }
  }
  return (
    <View style={styles.info}>
      <Text style={styles.infoTexte}>Copie ce message et envoie-le (WhatsApp, SMS, e-mail…) :</Text>
      <Text selectable style={[styles.infoTexte, { fontFamily: fonts.texte, marginTop: 6 }]}>{texte}</Text>
      {typeof navigator !== 'undefined' && navigator.clipboard ? (
        <Pressable accessibilityRole="button" onPress={copier} style={styles.copier}>
          <Text style={styles.copierTexte}>{copie ? 'Copié ✓' : 'Copier le message'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  copier: { alignSelf: 'flex-start', minHeight: 44, marginTop: 6, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: '#1D6E54', justifyContent: 'center' },
  copierTexte: { fontFamily: fonts.texteGras, fontSize: 14, color: '#1D6E54' },
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  champ: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 14, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  aide: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  erreur: { backgroundColor: '#FDE6E0', borderRadius: 12, padding: 12 },
  erreurTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: '#9B2335' },
  info: { backgroundColor: '#DAF0E6', borderRadius: 12, padding: 12 },
  infoTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: '#1D6E54' },
});
