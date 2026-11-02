// Champs de saisie et messages réutilisés par les écrans d'inscription.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
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
        style={[styles.champ, focus && { borderColor: colors.encre }]}
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

const styles = StyleSheet.create({
  label: { fontFamily: fonts.texteGras, fontSize: 14, color: colors.encre },
  champ: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.bordure, backgroundColor: colors.carte, paddingHorizontal: 14, fontFamily: fonts.texte, fontSize: 16, color: colors.encre },
  aide: { fontFamily: fonts.texte, fontSize: 13, color: colors.gris },
  erreur: { backgroundColor: '#FBE4E6', borderRadius: 12, padding: 12 },
  erreurTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: '#7A1B29' },
  info: { backgroundColor: '#DAF0E6', borderRadius: 12, padding: 12 },
  infoTexte: { fontFamily: fonts.texteMoyen, fontSize: 14, color: '#1D5E48' },
});
