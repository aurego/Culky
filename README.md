# culky

Le Strava de la culture : livres, ciné, concerts et expos.
Application Expo (React Native) pour iPhone et Android, avec une version web pour les tests, et Supabase pour les données.

## Où en est-on ?

| Étape | État |
|---|---|
| 1. Squelette de l'appli : 5 onglets et écran « Nouvelle activité », fidèles aux maquettes V1 | ✅ fait (données d'exemple) |
| 2. Base de données Supabase (schéma dans `supabase/schema.sql`) | ✅ créée et branchée |
| 3. Version web en ligne sur Vercel | ✅ en ligne |
| 4. Inscription par e-mail, pseudo et choix des univers | ✅ fait (Apple et Google plus tard) |
| 5. Enregistrer une vraie activité, célébration, journal et compteurs dans Mon carnet | ✅ fait (recherche de livres ; films, concerts et expos saisis à la main) |
| 6. Fil des abonnements, Découvrir, Culkoko, recherche et abonnement | ✅ fait |
| 7. Envies : « Ça me tente », rappels de date, amis qui ont la même envie, « On y va ensemble ? », « J'y étais » | ✅ fait |
| 8. Conseiller (« Claire a pensé à toi ») : envoi à des amis, Pour toi (reçus et mes conseils), boucle bouclée, « grâce à » | ✅ fait |
| 9. Conseil amélioré (amis triés, depuis le +, mots tout prêts, Merci, conseils qui ont touché juste) et « Nos sorties » (date, invités, réponses) | ✅ fait (complément SQL n° 3) |
| 10. Notifications dans l'appli : cloche, regroupement, rappels de sorties la veille et le jour J | ✅ fait (complément SQL n° 4) |
| 11. Marque-pages partagés : « Où j'en suis ? », mots des amis débloqués à la page, zéro spoiler | ✅ fait (complément SQL n° 5) |
| 12. Invitation par lien : la page « Claire a pensé à toi », le conseil rattaché au nouveau compte, abonnement mutuel | ✅ fait (complément SQL n° 6) |
| 13. Carte à partager en story, « Rattrape ton année » (sorties passées), « Ton année culturelle » (bilan et image à partager) | ✅ fait |
| Pseudos toujours avec une majuscule au début | ✅ fait (complément SQL n° 7) |
| 14. Le voyage d'un conseil : le chemin parcouru, les heureux en chemin, la notification « ton conseil voyage » | ✅ fait (complément SQL n° 8) |
| 15. les croisés, commentaires, notifications sur le téléphone, stats détaillées | à faire |

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
supabase/schema.sql    ← tables et règles de sécurité de la base (base neuve)
supabase/migrations/   ← compléments à coller, dans l'ordre, sur une base déjà installée
vercel.json            ← réglages de la mise en ligne web
```

## Variables d'environnement

Deux valeurs publiques, rangées dans le fichier `.env` :

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
