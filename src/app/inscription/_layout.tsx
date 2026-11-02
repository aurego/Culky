// Les étapes de l'inscription, l'une après l'autre : pseudo, puis univers.
import { Stack } from 'expo-router';
import { colors } from '../../theme';

export default function InscriptionLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.fond } }} />;
}
