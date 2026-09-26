-- ============================================================================
-- Olimpiadas Scouts · Datos de prueba para el playground
-- ============================================================================
-- ⚠️  SOLO para el proyecto de Supabase de pruebas. NUNCA pegar esto en el
--     Editor SQL del proyecto real: crea grupos y participantes de mentira.
--     No hace parte de `supabase db push` a propósito — se corre a mano, una
--     vez, en el Editor SQL del proyecto de pruebas, después de aplicar las
--     migraciones y `seed.sql` (países/ramas/deportes).
--
-- Qué deja listo para probar programación y resultados:
--   · 4 grupos aprobados, cada uno con:
--       - 5 participantes de rama "scouts" → equipo de fútbol (confirmado)
--       - 6 participantes de rama "adultos" → equipo de vóleibol (confirmado)
--       - 3 participantes de rama "nomadas" → inscripción individual a
--         ajedrez (confirmada)
--   · 3 canchas, cada una habilitada para los deportes que le corresponden.
--
-- Con eso ya hay 4 equipos de fútbol y 4 de vóleibol en la misma rama (para
-- que "Generar competencias" arme el todos-contra-todos) y 12 personas
-- inscritas a ajedrez individual (para las tandas). No crea cuentas de acceso
-- para estos grupos — no hace falta para programar ni para registrar
-- resultados. Si además quieres entrar como uno de ellos, créalo de verdad
-- desde el panel de administración ("Grupos" → "Crear grupo"): ese sí manda
-- las credenciales.
--
-- Se puede correr varias veces sin duplicar (usa ON CONFLICT DO NOTHING en lo
-- que tiene restricción única). Para borrar todo y empezar de cero, usa
-- `supabase/reset_testing.sql` en este mismo proyecto de pruebas.
-- ============================================================================

do $$
declare
  -- Un grupo por país, para variar. Cambia estos códigos si en tu proyecto de
  -- pruebas ya usaste alguno (country_code es único por grupo).
  v_countries text[] := array['CO', 'MX', 'AR', 'ES'];
  v_group_id   uuid;
  v_futbol_id  uuid;
  v_voleibol_id uuid;
  v_ajedrez_id uuid;
  v_team_id    uuid;
  v_reg_id     uuid;
  v_starters   uuid[];
  v_is_new     boolean;
  i integer;
  n integer;
  v_pid uuid;
begin
  select id into v_futbol_id   from public.sports where slug = 'futbol';
  select id into v_voleibol_id from public.sports where slug = 'voleibol';
  select id into v_ajedrez_id  from public.sports where slug = 'ajedrez';

  if v_futbol_id is null or v_voleibol_id is null or v_ajedrez_id is null then
    raise exception 'Corre primero supabase/seed.sql en este proyecto (países, ramas y deportes).';
  end if;

  for i in 1 .. array_length(v_countries, 1) loop
    -- ─── Grupo ────────────────────────────────────────────────────────────
    insert into public.groups (name, city, department, leader_name, leader_email, leader_phone, country_code, status)
    values (
      'Grupo Playground ' || i, 'Ciudad ' || i, 'Depto ' || i,
      'Líder Playground ' || i, 'lider' || i || '@playground.test', '3000000000',
      v_countries[i], 'approved'
    )
    on conflict (leader_email) do update set leader_email = excluded.leader_email
    returning id into v_group_id;

    -- ─── Participantes rama "scouts" → equipo de fútbol ─────────────────────
    v_starters := array[]::uuid[];
    for n in 1 .. 5 loop
      insert into public.participants (group_id, doc_type, document, first_names, last_names, birthdate, branch_id)
      values (
        v_group_id, 'TI', 'PG' || i || 'S' || n,
        'Scout' || n, 'Grupo' || i,
        current_date - interval '13 years', 'scouts'
      )
      on conflict (doc_type, document) do update set document = excluded.document
      returning id into v_pid;
      v_starters := array_append(v_starters, v_pid);
    end loop;

    -- Se busca primero y solo se inserta si no existía: los disparadores que
    -- validan equipos (cupo por grupo, alineación completa) corren ANTES de
    -- que Postgres evalúe el `ON CONFLICT`, así que un intento de insertar un
    -- duplicado los dispara igual aunque el insert termine sin hacer nada —
    -- por eso no basta con `on conflict do nothing` para que esto sea
    -- realmente repetible.
    select id into v_team_id from public.teams where sport_id = v_futbol_id and name = 'PG Fútbol Scouts ' || i;
    v_is_new := v_team_id is null;

    if v_is_new then
      insert into public.teams (owner_group_id, sport_id, name)
      values (v_group_id, v_futbol_id, 'PG Fútbol Scouts ' || i)
      returning id into v_team_id;

      insert into public.team_members (team_id, participant_id, role)
      select v_team_id, unnest(v_starters), 'starter';

      update public.teams set status = 'confirmed' where id = v_team_id;
    end if;

    -- ─── Participantes rama "adultos" → equipo de vóleibol ──────────────────
    v_starters := array[]::uuid[];
    for n in 1 .. 6 loop
      insert into public.participants (group_id, doc_type, document, first_names, last_names, birthdate, branch_id)
      values (
        v_group_id, 'CC', 'PG' || i || 'A' || n,
        'Adulto' || n, 'Grupo' || i,
        current_date - interval '28 years', 'adultos'
      )
      on conflict (doc_type, document) do update set document = excluded.document
      returning id into v_pid;
      v_starters := array_append(v_starters, v_pid);
    end loop;

    select id into v_team_id from public.teams where sport_id = v_voleibol_id and name = 'PG Vóleibol Adultos ' || i;
    v_is_new := v_team_id is null;

    if v_is_new then
      insert into public.teams (owner_group_id, sport_id, name)
      values (v_group_id, v_voleibol_id, 'PG Vóleibol Adultos ' || i)
      returning id into v_team_id;

      insert into public.team_members (team_id, participant_id, role)
      select v_team_id, unnest(v_starters), 'starter';

      update public.teams set status = 'confirmed' where id = v_team_id;
    end if;

    -- ─── Participantes rama "nomadas" → ajedrez individual ──────────────────
    v_starters := array[]::uuid[];
    for n in 1 .. 3 loop
      insert into public.participants (group_id, doc_type, document, first_names, last_names, birthdate, branch_id)
      values (
        v_group_id, 'TI', 'PG' || i || 'N' || n,
        'Nomada' || n, 'Grupo' || i,
        current_date - interval '16 years', 'nomadas'
      )
      on conflict (doc_type, document) do update set document = excluded.document
      returning id into v_pid;
      v_starters := array_append(v_starters, v_pid);
    end loop;

    select id into v_reg_id from public.individual_registrations where group_id = v_group_id and sport_id = v_ajedrez_id;
    v_is_new := v_reg_id is null;

    if v_is_new then
      insert into public.individual_registrations (group_id, sport_id)
      values (v_group_id, v_ajedrez_id)
      returning id into v_reg_id;

      insert into public.individual_registration_participants (registration_id, participant_id)
      select v_reg_id, unnest(v_starters);

      update public.individual_registrations set status = 'confirmed' where id = v_reg_id;
    end if;
  end loop;

  -- ─── Canchas ────────────────────────────────────────────────────────────
  insert into public.courts (name, notes) values
    ('Cancha 1', 'Fútbol y vóleibol'),
    ('Cancha 2', 'Solo fútbol'),
    ('Aula Ajedrez', 'Techada, con mesas')
  on conflict (lower(btrim(name))) do nothing;

  insert into public.court_sports (court_id, sport_id)
  select c.id, s.id
  from public.courts c
  join (values
    ('Cancha 1', 'futbol'), ('Cancha 1', 'voleibol'),
    ('Cancha 2', 'futbol'),
    ('Aula Ajedrez', 'ajedrez')
  ) as m(court_name, sport_slug) on m.court_name = c.name
  join public.sports s on s.slug = m.sport_slug
  on conflict do nothing;
end;
$$;

-- ─── Verificación ────────────────────────────────────────────────────────────
select
  (select count(*) from public.groups where leader_email like '%@playground.test') as grupos_playground,
  (select count(*) from public.participants p join public.groups g on g.id = p.group_id
     where g.leader_email like '%@playground.test') as participantes_playground,
  (select count(*) from public.teams where status = 'confirmed' and name like 'PG %') as equipos_confirmados,
  (select count(*) from public.individual_registrations ir join public.groups g on g.id = ir.group_id
     where g.leader_email like '%@playground.test' and ir.status = 'confirmed') as inscripciones_confirmadas,
  (select count(*) from public.courts) as canchas;
