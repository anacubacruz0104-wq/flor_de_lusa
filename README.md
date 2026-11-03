# Flor de Lusa Studio · Agendamento online

Site de agendamento do Flor de Lusa Studio (Nail Designer), com dois endereços:

| Link | Quem usa | O que tem |
|---|---|---|
| `/` | Clientes | Abertura em tela cheia, galeria de trabalhos, serviços e valores, calendário, horários livres, solicitação com redirecionamento para o WhatsApp, Pix com QR Code |
| `/admin` | Só a profissional (com senha) | Agenda, pendentes para confirmar, financeiro, clientes, serviços e valores, galeria, horários e folgas, abrir/fechar agenda, ajustes |

No ar em: https://flordelusa.vercel.app (painel em https://flordelusa.vercel.app/admin)

## Como funciona

- **Hospedagem:** Vercel (site estático, sem build).
- **Banco e login:** Supabase. A conexão fica em `js/config.js`. A chave ali é a pública ("anon"); quem protege os dados são as regras do banco em `supabase/schema.sql`.
- **Segurança:** clientes só leem serviços, horários e a galeria, e só criam agendamentos pela função `solicitar_agendamento`, que valida tudo no servidor. Apenas usuários cadastrados na tabela `admins` acessam agendamentos, financeiro e clientes.
- **Galeria:** as fotos ficam no Storage do Supabase (bucket `galeria`) e são enviadas pelo painel, já otimizadas.

## Atualizar o site

Com a Vercel ligada a este repositório, cada alteração enviada para a branch `main` é publicada sozinha.

## Recriar do zero em outro projeto

1. Supabase: novo projeto (região São Paulo) → SQL Editor → cole e rode `supabase/schema.sql`.
2. Authentication → Users → Add user (marque *Auto Confirm*) e depois rode, trocando o e-mail:
   `insert into public.admins (user_id) select id from auth.users where email = 'email@exemplo.com';`
3. Coloque a Project URL e a chave anon em `js/config.js`.
4. Vercel: Add New → Project → importe este repositório (Framework: Other, sem build).

## Estrutura

```
index.html            página da cliente
admin/index.html      painel
css/base.css          cores, tipografia e componentes
css/cliente.css       página da cliente
css/admin.css         painel
css/extra.css         abertura, animações, galeria, Pix
js/config.js          conexão com o Supabase
js/core.js            dados, datas, cálculo de horários livres
js/cliente.js         fluxo de agendamento
js/extra.js           abertura, animações, galeria, aviso do Instagram, QR do Pix
js/admin.js           painel
js/admin-galeria.js   aba Galeria do painel
supabase/schema.sql   tabelas, segurança, galeria e serviços iniciais
assets/               logo e imagens
```
