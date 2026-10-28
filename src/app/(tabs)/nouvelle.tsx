// Écran vide derrière le bouton « + » : le bouton ouvre directement /enregistrer.
import { Redirect } from 'expo-router';

export default function Nouvelle() {
  return <Redirect href="/enregistrer" />;
}
