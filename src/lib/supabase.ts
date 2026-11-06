// Connexion à la base de données Supabase.
// Les deux clés viennent des variables d'environnement (fichier .env en local, réglages Vercel en ligne).
// Tant qu'elles ne sont pas renseignées, `supabase` vaut null et l'appli tourne avec les données d'exemple.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && cle
    ? createClient(url, cle, {
        auth: {
          // Sur le web, le navigateur garde la session tout seul.
          storage: Platform.OS === 'web' ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

export const supabaseEstConfigure = supabase !== null;

// Sur téléphone : on rafraîchit la connexion seulement quand l'appli est à l'écran
// (sinon, après une longue pause en arrière-plan, la session pourrait avoir expiré).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (etat) => {
    if (etat === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
