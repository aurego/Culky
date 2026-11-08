// Les trois pages légales : mentions légales, confidentialité (RGPD), conditions d'utilisation.
// Écrites simplement, au tutoiement comme le reste de Kulky. Mise à jour : à changer à chaque modification.
export type PageLegale = { titre: string; intro?: string; sections: { titre: string; texte: string }[] };

export const miseAJourLegale = '4 novembre 2026';
export const contactKulky = 'hello@kulky.fr';

export const pagesLegales: Record<'mentions' | 'confidentialite' | 'conditions', PageLegale> = {
  mentions: {
    titre: 'Mentions légales',
    sections: [
      {
        titre: 'Qui édite Kulky ?',
        texte: `Kulky est édité par Aurélie Gosselin, à titre personnel, à Toulouse (France).\nContact : ${contactKulky}`,
      },
      { titre: 'Directrice de la publication', texte: 'Aurélie Gosselin.' },
      {
        titre: 'Hébergement',
        texte:
          'Le site et la version web de l’appli sont hébergés par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).\n' +
          'Les comptes et les données sont hébergés par Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 (supabase.com).',
      },
      {
        titre: 'Les œuvres',
        texte:
          'Les titres, couvertures et affiches viennent de TMDB, Google Books et MusicBrainz. Ils restent la propriété de leurs auteurs et éditeurs. Le nom, le logo et les dessins de Kulky ne peuvent pas être réutilisés sans accord.',
      },
    ],
  },

  confidentialite: {
    titre: 'Ma vie privée',
    intro:
      'Kulky sert à garder et partager ta culture avec tes amis. Pas de publicité, pas de revente de données, pas de pistage. Voici, simplement, ce que nous gardons et pourquoi.',
    sections: [
      {
        titre: 'Ce que Kulky garde',
        texte:
          '• Ton adresse e-mail, pour te connecter.\n' +
          '• Ton pseudo, ta photo et tes univers préférés, si tu les ajoutes.\n' +
          '• Ton journal : ce que tu as lu, vu, écouté ou visité, avec tes émotions, tes mots et tes photos souvenirs.\n' +
          '• Tes envies, tes conseils, tes commentaires, tes marque-pages.\n' +
          '• Les personnes que tu suis, qui te suivent, ou que tu as bloquées.\n' +
          '• Les signalements que tu envoies.',
      },
      {
        titre: 'Pourquoi',
        texte:
          'Uniquement pour faire marcher Kulky : afficher ton journal, le montrer à tes amis selon tes réglages, t’envoyer les notifications de l’appli. C’est le service que tu demandes en créant ton compte (base légale : l’exécution du contrat).',
      },
      {
        titre: 'Qui voit quoi',
        texte:
          'Tu choisis qui voit chaque activité : tout le monde, tes abonnés, ou toi seul·e. Ton adresse e-mail n’est jamais montrée aux autres. Personne chez Kulky ne lit tes contenus, sauf pour traiter un signalement.',
      },
      {
        titre: 'Les services utilisés',
        texte:
          '• Supabase et Vercel hébergent Kulky (voir les mentions légales).\n' +
          '• Quand tu cherches une œuvre, ta recherche (le texte tapé, rien d’autre) est envoyée à Google Books, TMDB ou MusicBrainz pour trouver le titre.\n' +
          'Certains de ces services sont situés hors de l’Union européenne ; ils s’engagent à protéger les données selon les règles européennes (clauses contractuelles types).',
      },
      {
        titre: 'Combien de temps',
        texte:
          'Tant que ton compte existe. Si tu le supprimes (Mon profil et mes réglages › Supprimer mon compte), tout est effacé aussitôt : profil, journal, photos, commentaires.',
      },
      {
        titre: 'Tes droits',
        texte:
          `Tu peux consulter, corriger, récupérer ou effacer tes données, et t’opposer à leur utilisation. Presque tout se fait dans l’appli ; pour le reste, écris à ${contactKulky}. Tu peux aussi saisir la CNIL (cnil.fr).`,
      },
      {
        titre: 'Âge minimum',
        texte: 'Kulky est réservé aux personnes de 15 ans et plus. Une version pour les plus jeunes viendra plus tard.',
      },
      { titre: 'Cookies', texte: 'Kulky n’utilise aucun cookie publicitaire ni de mesure d’audience. Seul ce qui sert à rester connecté·e est gardé sur ton appareil.' },
    ],
  },

  conditions: {
    titre: 'Conditions d’utilisation',
    intro: 'En créant ton Kulky, tu acceptes ces quelques règles. Elles sont là pour que Kulky reste un endroit doux et bienveillant.',
    sections: [
      { titre: 'Kulky, c’est quoi ?', texte: 'Une appli gratuite pour garder ce que tu lis, vois, écoutes et visites, et le partager avec tes amis.' },
      {
        titre: 'Ton compte',
        texte:
          'Il faut avoir 15 ans ou plus. Ton compte est personnel : garde ton mot de passe pour toi. Tu peux le supprimer à tout moment depuis les réglages.',
      },
      {
        titre: 'La bienveillance',
        texte:
          'Sur Kulky, on partage ce qui nous fait vibrer. Pas d’insulte, de harcèlement, de haine, de contenu violent ou sexuel, de spam ni de publicité. Respecte la vie privée des autres et pense à cocher « spoiler » quand tu dévoiles une fin.',
      },
      {
        titre: 'Tes contenus',
        texte:
          'Tes mots et tes photos restent à toi. Tu autorises seulement Kulky à les afficher aux personnes que tu as choisies, le temps que ton compte existe. Ne publie que des photos que tu as prises ou que tu as le droit de partager, et ne montre personne de reconnaissable sans son accord. Si un contenu porte atteinte aux droits de quelqu’un, signale-le ou écris-nous : il sera retiré rapidement.',
      },
      {
        titre: 'Signaler et bloquer',
        texte:
          'Si un contenu ou une personne te gêne, touche ⋯ pour le signaler ou bloquer la personne. Chaque signalement est lu. Un contenu qui ne respecte pas ces règles peut être retiré, et un compte suspendu ou supprimé.',
      },
      {
        titre: 'Ce que Kulky promet',
        texte:
          'Nous faisons de notre mieux pour que Kulky marche bien et garde tes données en sécurité, mais l’appli peut parfois être interrompue ou changer. Les informations sur les œuvres viennent de sources extérieures et peuvent contenir des erreurs.',
      },
      {
        titre: 'Si ces règles changent',
        texte: 'Nous te prévenons dans l’appli avant tout changement important.',
      },
      {
        titre: 'Le droit applicable',
        texte: `Ces conditions sont soumises au droit français. En cas de souci, écris d’abord à ${contactKulky} : on trouvera une solution ensemble.`,
      },
    ],
  },
};
