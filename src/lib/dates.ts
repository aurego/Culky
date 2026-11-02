// Dire « quand » à la manière de Culky : aujourd'hui, hier, il y a 3 jours, 12 oct.

function aMidi(d: Date) {
  const c = new Date(d);
  c.setHours(12, 0, 0, 0);
  return c;
}

// Pour une date de jour (« 2026-10-28 »).
export function quandJour(dateIso: string): string {
  const jour = aMidi(new Date(`${dateIso}T12:00:00`));
  const aujourdHui = aMidi(new Date());
  const ecart = Math.round((aujourdHui.getTime() - jour.getTime()) / 86400000);
  if (ecart === 0) return 'Aujourd’hui';
  if (ecart === 1) return 'Hier';
  if (ecart > 1 && ecart < 7) return `Il y a ${ecart} jours`;
  return jour.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: jour.getFullYear() === aujourdHui.getFullYear() ? undefined : 'numeric',
  });
}

// Pour une activité : « il y a 2 h » si elle a été publiée aujourd'hui pour aujourd'hui.
export function quandActivite(dateIso: string, publieeLe?: string | null): string {
  if (publieeLe && dateIso === new Date().toISOString().slice(0, 10)) {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(publieeLe).getTime()) / 60000));
    if (minutes < 1) return 'à l’instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  }
  return quandJour(dateIso).toLowerCase();
}
