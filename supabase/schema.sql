-- =====================================================================
--  FLOR DE LUSA STUDIO · Banco de dados (Supabase / Postgres)
--  Cole este arquivo inteiro no Supabase > SQL Editor > New query > Run
--  Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- Configurações gerais (sempre 1 linha só, id = 1)
create table if not exists public.config (
  id                 int primary key default 1 check (id = 1),
  nome               text not null default 'Flor de Lusa Studio',
  profissional       text default '',
  whatsapp           text not null default '',          -- só números, com DDD. Ex: 37999998888
  endereco           text default '',
  maps_url           text default '',
  instagram          text default '',                    -- sem @
  sobre              text default '',
  politicas          text default '',
  agenda_aberta      boolean not null default true,
  msg_fechada        text default 'A agenda está fechada no momento. Chame no WhatsApp para verificar disponibilidade.',
  intervalo_min      int not null default 30 check (intervalo_min between 5 and 120),
  antecedencia_horas int not null default 2  check (antecedencia_horas between 0 and 168),
  janela_dias        int not null default 45 check (janela_dias between 1 and 365),
  sinal_valor        numeric(10,2) not null default 0,
  pix_chave          text default '',
  pix_nome           text default '',
  atualizado_em      timestamptz not null default now()
);

create table if not exists public.servicos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text default '',
  categoria    text not null default 'Manicure',
  tipo         text not null default 'principal' check (tipo in ('principal','extra')),
  preco        numeric(10,2) not null default 0 check (preco >= 0),
  duracao_min  int not null default 60 check (duracao_min between 5 and 600),
  ativo        boolean not null default true,
  ordem        int not null default 0,
  criado_em    timestamptz not null default now()
);

-- Horário de funcionamento por dia da semana (0 = domingo ... 6 = sábado)
create table if not exists public.horarios (
  dia_semana    int primary key check (dia_semana between 0 and 6),
  aberto        boolean not null default true,
  inicio        time not null default '08:00',
  fim           time not null default '18:00',
  pausa_inicio  time,
  pausa_fim     time
);

-- Folgas, feriados e horários bloqueados
-- inicio/fim nulos = dia inteiro bloqueado
create table if not exists public.bloqueios (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  inicio     time,
  fim        time,
  motivo     text default '',
  criado_em  timestamptz not null default now()
);
create index if not exists bloqueios_data_idx on public.bloqueios (data);

create table if not exists public.agendamentos (
  id               uuid primary key default gen_random_uuid(),
  cliente_nome     text not null,
  cliente_whats    text not null,
  data             date not null,
  inicio           time not null,
  fim              time not null,
  servicos         jsonb not null default '[]'::jsonb,   -- [{id,nome,preco,duracao_min,tipo}]
  total            numeric(10,2) not null default 0,
  desconto         numeric(10,2) not null default 0,
  status           text not null default 'pendente'
                   check (status in ('pendente','confirmado','concluido','cancelado','faltou')),
  pago             boolean not null default false,
  valor_pago       numeric(10,2),
  forma_pagamento  text,                                   -- pix, dinheiro, debito, credito
  obs              text default '',                        -- observação da cliente
  obs_interna      text default '',                        -- só a profissional vê
  origem           text not null default 'site' check (origem in ('site','admin')),
  criado_em        timestamptz not null default now()
);
create index if not exists agendamentos_data_idx on public.agendamentos (data);
create index if not exists agendamentos_whats_idx on public.agendamentos (cliente_whats);

create table if not exists public.despesas (
  id         uuid primary key default gen_random_uuid(),
  data       date not null default (now() at time zone 'America/Sao_Paulo')::date,
  descricao  text not null,
  categoria  text not null default 'Material',
  valor      numeric(10,2) not null check (valor >= 0),
  criado_em  timestamptz not null default now()
);
create index if not exists despesas_data_idx on public.despesas (data);

-- ---------------------------------------------------------------------
-- 2. SEGURANÇA (RLS)
--    Público (clientes, sem login): só LÊ config, serviços ativos,
--    horários e bloqueios. Não enxerga agendamentos de ninguém.
--    Logado (a profissional): acesso total.
-- ---------------------------------------------------------------------
alter table public.config       enable row level security;
alter table public.servicos     enable row level security;
alter table public.horarios     enable row level security;
alter table public.bloqueios    enable row level security;
alter table public.agendamentos enable row level security;
alter table public.despesas     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['config','servicos','horarios','bloqueios','agendamentos','despesas'] loop
    execute format('drop policy if exists "admin_total" on public.%I', t);
    execute format('create policy "admin_total" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists "publico_le_config"    on public.config;
drop policy if exists "publico_le_servicos"  on public.servicos;
drop policy if exists "publico_le_horarios"  on public.horarios;
drop policy if exists "publico_le_bloqueios" on public.bloqueios;
create policy "publico_le_config"    on public.config    for select to anon using (true);
create policy "publico_le_servicos"  on public.servicos  for select to anon using (ativo);
create policy "publico_le_horarios"  on public.horarios  for select to anon using (true);
create policy "publico_le_bloqueios" on public.bloqueios for select to anon
  using (data >= (now() at time zone 'America/Sao_Paulo')::date);

-- ---------------------------------------------------------------------
-- 3. FUNÇÕES PÚBLICAS (o site da cliente usa só estas)
-- ---------------------------------------------------------------------

-- Horários já ocupados num dia (sem nome nem telefone de ninguém)
create or replace function public.horarios_ocupados(p_data date)
returns table (inicio time, fim time)
language sql stable security definer set search_path = public as $$
  select a.inicio, a.fim
  from agendamentos a
  where a.data = p_data and a.status in ('pendente','confirmado','concluido')
  order by a.inicio;
$$;

-- Cria a solicitação de agendamento, validando tudo no servidor
create or replace function public.solicitar_agendamento(
  p_nome text, p_whats text, p_data date, p_inicio time,
  p_servicos uuid[], p_obs text default ''
) returns json
language plpgsql security definer set search_path = public as $$
declare
  c        config%rowtype;
  h        horarios%rowtype;
  v_agora  timestamp := now() at time zone 'America/Sao_Paulo';
  v_whats  text := regexp_replace(coalesce(p_whats,''), '\D', '', 'g');
  v_nome   text := btrim(coalesce(p_nome,''));
  v_dur    int;
  v_total  numeric(10,2);
  v_itens  jsonb;
  v_fim    time;
  v_n      int;
  v_id     uuid;
begin
  select * into c from config where id = 1;
  if c.id is null or not c.agenda_aberta then
    raise exception 'AGENDA_FECHADA' using hint = 'A agenda está fechada no momento.';
  end if;

  if length(v_nome) < 2 or length(v_nome) > 80 then
    raise exception 'NOME_INVALIDO' using hint = 'Informe seu nome.';
  end if;
  if v_whats like '55%' and length(v_whats) in (12,13) then v_whats := substr(v_whats, 3); end if;
  if length(v_whats) not in (10,11) then
    raise exception 'WHATS_INVALIDO' using hint = 'Informe um celular com DDD.';
  end if;
  if p_servicos is null or array_length(p_servicos,1) is null or array_length(p_servicos,1) > 8 then
    raise exception 'SERVICO_INVALIDO' using hint = 'Escolha pelo menos um serviço.';
  end if;

  select coalesce(sum(duracao_min),0), coalesce(sum(preco),0),
         coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'preco',preco,'duracao_min',duracao_min,'tipo',tipo) order by tipo desc, ordem), '[]'::jsonb),
         count(*)
    into v_dur, v_total, v_itens, v_n
  from servicos where id = any(p_servicos) and ativo;
  if v_n <> array_length(p_servicos,1) then
    raise exception 'SERVICO_INVALIDO' using hint = 'Um dos serviços não está mais disponível. Atualize a página.';
  end if;

  if p_data < v_agora::date or p_data > v_agora::date + c.janela_dias then
    raise exception 'DATA_INVALIDA' using hint = 'Data fora do período disponível.';
  end if;
  if (p_data + p_inicio) < v_agora + make_interval(hours => c.antecedencia_horas) then
    raise exception 'DATA_INVALIDA' using hint = 'Esse horário já passou ou está muito em cima da hora.';
  end if;

  select * into h from horarios where dia_semana = extract(dow from p_data)::int;
  if h.dia_semana is null or not h.aberto then
    raise exception 'DIA_FECHADO' using hint = 'Não há atendimento nesse dia.';
  end if;

  if (p_inicio + make_interval(mins => v_dur)) < p_inicio then
    raise exception 'HORARIO_INDISPONIVEL' using hint = 'Esse horário não comporta o atendimento.';
  end if;
  v_fim := p_inicio + make_interval(mins => v_dur);
  if p_inicio < h.inicio or v_fim > h.fim then
    raise exception 'HORARIO_INDISPONIVEL' using hint = 'Esse horário não comporta o atendimento.';
  end if;
  if h.pausa_inicio is not null and h.pausa_fim is not null
     and p_inicio < h.pausa_fim and v_fim > h.pausa_inicio then
    raise exception 'HORARIO_INDISPONIVEL' using hint = 'Esse horário cai no intervalo da profissional.';
  end if;

  if exists (select 1 from bloqueios b where b.data = p_data and
             (b.inicio is null or (p_inicio < b.fim and v_fim > b.inicio))) then
    raise exception 'HORARIO_INDISPONIVEL' using hint = 'Esse horário não está disponível.';
  end if;

  -- trava para evitar duas reservas simultâneas no mesmo dia
  perform pg_advisory_xact_lock(hashtext('agenda-' || p_data::text));
  if exists (select 1 from agendamentos a where a.data = p_data
             and a.status in ('pendente','confirmado','concluido')
             and p_inicio < a.fim and v_fim > a.inicio) then
    raise exception 'HORARIO_OCUPADO' using hint = 'Alguém acabou de reservar esse horário. Escolha outro.';
  end if;

  -- anti-spam: no máximo 3 solicitações pendentes futuras por telefone
  if (select count(*) from agendamentos a where a.cliente_whats = v_whats
      and a.status = 'pendente' and a.data >= v_agora::date) >= 3 then
    raise exception 'LIMITE' using hint = 'Você já tem solicitações em aberto. Fale com a profissional pelo WhatsApp.';
  end if;

  insert into agendamentos (cliente_nome, cliente_whats, data, inicio, fim, servicos, total, obs, origem)
  values (v_nome, v_whats, p_data, p_inicio, v_fim, v_itens, v_total, left(coalesce(p_obs,''), 500), 'site')
  returning id into v_id;

  return json_build_object('id', v_id, 'total', v_total, 'fim', to_char(v_fim,'HH24:MI'),
                           'duracao_min', v_dur, 'servicos', v_itens);
end $$;

revoke all on function public.horarios_ocupados(date) from public;
revoke all on function public.solicitar_agendamento(text,text,date,time,uuid[],text) from public;
grant execute on function public.horarios_ocupados(date) to anon, authenticated;
grant execute on function public.solicitar_agendamento(text,text,date,time,uuid[],text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. DADOS INICIAIS (serviços da agenda atual)
-- ---------------------------------------------------------------------
insert into public.config (id, nome, politicas, sobre)
values (1, 'Flor de Lusa Studio',
'• A solicitação só vira agendamento depois da confirmação pelo WhatsApp.
• Chegue com até 10 minutos de tolerância. Após isso o atendimento pode ser reduzido ou remarcado.
• Remarcações e cancelamentos com pelo menos 24 horas de antecedência.
• Faltas sem aviso podem exigir sinal para os próximos agendamentos.',
'Nail designer com raízes portuguesas. Alongamentos, banho de gel e nail art feitos com calma e cuidado em cada detalhe.')
on conflict (id) do nothing;

insert into public.horarios (dia_semana, aberto, inicio, fim, pausa_inicio, pausa_fim) values
  (0, false, '08:00', '18:00', null, null),
  (1, true,  '08:00', '18:00', '12:00', '13:00'),
  (2, true,  '08:00', '18:00', '12:00', '13:00'),
  (3, true,  '08:00', '18:00', '12:00', '13:00'),
  (4, true,  '08:00', '18:00', '12:00', '13:00'),
  (5, true,  '08:00', '18:00', '12:00', '13:00'),
  (6, true,  '08:00', '14:00', null, null)
on conflict (dia_semana) do nothing;

insert into public.servicos (nome, categoria, tipo, preco, duracao_min, ordem, descricao)
select * from (values
  ('Aplicação F1',             'Alongamento', 'principal', 80.00, 120, 1, 'Alongamento com molde F1, formato e comprimento à sua escolha.'),
  ('Banho de Gel',             'Gel',         'principal', 60.00,  90, 2, 'Camada de gel sobre a unha natural para mais resistência e brilho.'),
  ('Esmaltação em Gel',        'Gel',         'principal', 50.00,  90, 3, 'Esmalte em gel com secagem em cabine e duração prolongada.'),
  ('Manutenção Molde F1',      'Manutenção',  'principal', 65.00, 120, 4, 'Manutenção do alongamento F1.'),
  ('Manutenção Banho de Gel',  'Manutenção',  'principal', 55.00,  90, 5, 'Manutenção do banho de gel.'),
  ('Remoção',                  'Extras',      'extra',     35.00,  50, 6, 'Remoção do material anterior.'),
  ('Reposição de Unha',        'Extras',      'extra',     10.00,  20, 7, 'Reposição de unha quebrada (por unha).'),
  ('Nail Art Livre',           'Nail Art',    'extra',     20.00,  70, 8, 'Arte livre combinada na hora.'),
  ('Baby Boomer',              'Nail Art',    'extra',     25.00,  70, 9, 'Degradê baby boomer.')
) as v(nome, categoria, tipo, preco, duracao_min, ordem, descricao)
where not exists (select 1 from public.servicos);

-- ---------------------------------------------------------------------
-- 5. SÓ ADMINISTRADORAS CADASTRADAS ACESSAM OS DADOS
--    (mesmo que alguém crie uma conta pela API, não enxerga nada)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admin_le_proprio" on public.admins;
create policy "admin_le_proprio" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.e_admin() from public, anon;
grant execute on function public.e_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['config','servicos','horarios','bloqueios','agendamentos','despesas'] loop
    execute format('drop policy if exists "admin_total" on public.%I', t);
    execute format('create policy "admin_total" on public.%I for all to authenticated using (public.e_admin()) with check (public.e_admin())', t);
  end loop;
end $$;

drop policy if exists "publico_le_config"    on public.config;
drop policy if exists "publico_le_servicos"  on public.servicos;
drop policy if exists "publico_le_horarios"  on public.horarios;
drop policy if exists "publico_le_bloqueios" on public.bloqueios;
create policy "publico_le_config"    on public.config    for select to anon, authenticated using (true);
create policy "publico_le_servicos"  on public.servicos  for select to anon, authenticated using (ativo);
create policy "publico_le_horarios"  on public.horarios  for select to anon, authenticated using (true);
create policy "publico_le_bloqueios" on public.bloqueios for select to anon, authenticated
  using (data >= (now() at time zone 'America/Sao_Paulo')::date);

-- Para tornar um usuário administrador (troque o e-mail):
-- insert into public.admins (user_id) select id from auth.users where email = 'email@exemplo.com';

-- ---------------------------------------------------------------------
-- 6. GALERIA DE TRABALHOS (fotos no Storage, bucket público "galeria")
-- ---------------------------------------------------------------------
create table if not exists public.galeria (
  id uuid primary key default gen_random_uuid(),
  caminho text not null,
  legenda text default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.galeria enable row level security;
drop policy if exists "publico_le_galeria" on public.galeria;
create policy "publico_le_galeria" on public.galeria for select to anon, authenticated using (ativo);
drop policy if exists "admin_total" on public.galeria;
create policy "admin_total" on public.galeria for all to authenticated using (public.e_admin()) with check (public.e_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('galeria', 'galeria', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists "galeria_admin_envia"  on storage.objects;
drop policy if exists "galeria_admin_altera" on storage.objects;
drop policy if exists "galeria_admin_apaga"  on storage.objects;
create policy "galeria_admin_envia"  on storage.objects for insert to authenticated with check (bucket_id = 'galeria' and public.e_admin());
create policy "galeria_admin_altera" on storage.objects for update to authenticated using (bucket_id = 'galeria' and public.e_admin());
create policy "galeria_admin_apaga"  on storage.objects for delete to authenticated using (bucket_id = 'galeria' and public.e_admin());
