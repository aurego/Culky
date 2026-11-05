// L'univers « Scène » réunit les concerts et les spectacles (théâtre, danse, cirque, humour…).
// Le genre est rangé sur l'œuvre ; sans genre, c'est un concert (comme avant).
export const estSpectacle = (o?: { genre?: string | null } | null) => o?.genre === 'spectacle';

// « de » devant un nom, à la française : « d’Angèle », « d’Yves » (mais « de Yanis »),
// « des Nuits Jaunes », « du Rouge », « de Céline Dion ».
export function deNom(nom: string): { de: string; nom: string } {
  const m = nom.match(/^(Les|Le) (.+)$/);
  if (m) return { de: m[1] === 'Les' ? 'des ' : 'du ', nom: m[2] };
  if (/^[aeiouhàâäéèêëîïôöùûüœæ]/i.test(nom) || /^y[^aeiouyàâäéèêëîïôöùûü]/i.test(nom)) return { de: 'd’', nom };
  return { de: 'de ', nom };
}
export const deNomTexte = (nom: string) => {
  const d = deNom(nom);
  return d.de + d.nom;
};
