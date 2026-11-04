// L'univers « Scène » réunit les concerts et les spectacles (théâtre, danse, cirque, humour…).
// Le genre est rangé sur l'œuvre ; sans genre, c'est un concert (comme avant).
export const estSpectacle = (o?: { genre?: string | null } | null) => o?.genre === 'spectacle';
