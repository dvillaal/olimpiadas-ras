-- Agrega Escocia a la lista de países que un grupo puede escoger.
--
-- Escocia no tiene código ISO 3166-1 propio (es parte de Reino Unido, que ya
-- está en la lista como 'GB'), así que se agrega como entrada aparte con un
-- código de 2 letras propio del sistema ('XS', no asignado a ningún país
-- ISO real) para no chocar con 'GB'. La bandera correspondiente ya está en
-- public/flags/xs.svg (el saltire azul y blanco de Escocia).
insert into public.countries (code, name)
values ('XS', 'Escocia')
on conflict (code) do nothing;
