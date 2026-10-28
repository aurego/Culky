// Connexion à la base de données Supabase.
// Les deux clés viennent des variables d'environnement (fichier .env en local, réglages Vercel en ligne).
// Tant qu'elles ne sont pas renseignées, `supabase` vaut null et l'appli tourne avec les données d'exemple.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

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
