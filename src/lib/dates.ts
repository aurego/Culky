// Dire « quand » à la manière de Kulky : aujourd'hui, hier, il y a 3 jours, 12 oct.

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

// « jj/mm/aaaa » → « aaaa-mm-jj » (ou null si la date n'est pas valide).
export function lireDateFr(texte: string): string | null {
  const m = texte.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function isoVersFr(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

export function aujourdhuiIso(decalageJours = 0): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + decalageJours);
  return d.toISOString().slice(0, 10);
}

// Le prochain samedi (ou aujourd'hui si on est samedi).
export function prochainJour(jourSemaine: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((jourSemaine - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

// « Samedi 15 novembre », et combien de jours d'ici là.
export function jourLong(iso: string): string {
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function joursAvant(iso: string): number {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${aujourdhuiIso()}T12:00:00`).getTime()) / 86400000);
}
