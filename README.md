# culky

Le Strava de la culture : livres, ciné, concerts et expos.
Application Expo (React Native) pour iPhone et Android, avec une version web pour les tests, et Supabase pour les données.

## Où en est-on ?

| Étape | État |
|---|---|
| 1. Squelette de l'appli : 5 onglets et écran « Nouvelle activité », fidèles aux maquettes V1 | ✅ fait (données d'exemple) |
| 2. Base de données Supabase (schéma dans `supabase/schema.sql`) | à créer |
| 3. Version web en ligne sur Vercel | à brancher |
| 4. Inscription (Apple, Google, e-mail) et choix des univers | à faire |
| 5. Enregistrer une vraie activité (recherche d'œuvres, émotions, publication) | à faire |
| 6. Fil, Culkoko, commentaires, envies, pensés à toi, stats, notifications | à faire |

## Comment le projet est rangé

```
src/
  app/                 ← un fichier = un écran
    _layout.tsx        ← cadre général (polices, navigation)
    enregistrer.tsx    ← « Nouvelle activité »
    (tabs)/            ← les onglets du bas
      index.tsx        ← Accueil (fil)
      envies.tsx       ← Mes envies
      pour-toi.tsx     ← Pensés pour toi
      carnet.tsx       ← Mon carnet
  components/          ← briques réutilisables (logo, icônes, pastilles…)
  data/                ← palette d'émotions et données d'exemple
  lib/supabase.ts      ← connexion à la base
  theme.ts             ← couleurs, polices et univers
supabase/schema.sql    ← tables et règles de sécurité de la base
vercel.json            ← réglages de la mise en ligne web
```

## Variables d'environnement

Deux valeurs, à renseigner dans Vercel (et dans `.env.local` si un jour tu travailles en local) :

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Sans elles, l'appli tourne avec les données d'exemple.

## Commandes (pour plus tard, sur un ordinateur récent)

```bash
npm install
npm run web          # lancer la version web en local
npm run build:web    # fabriquer la version web dans dist/
npm run typecheck    # vérifier le code
```
