-- Complément n° 14 : l'univers « Scène » réunit les concerts et les spectacles (théâtre, danse, cirque, humour…).
-- On range le genre sur l'œuvre ; sans genre, c'est un concert, comme avant.
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.
alter table oeuvres add column if not exists genre text check (genre in ('concert', 'spectacle'));
