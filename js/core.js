/* =====================================================================
   Flor de Lusa Studio · núcleo compartilhado (cliente + admin)
   - utilidades de data, moeda, WhatsApp
   - cálculo de horários livres
   - camada de dados: Supabase (produção) ou Demonstração (localStorage)
   ===================================================================== */
(function () {
  const FL = (window.FL = window.FL || {});
  const TZ = "America/Sao_Paulo";

  /* ---------------- utilidades ---------------- */
  const U = (FL.u = {});
  U.DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  U.DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  U.MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  U.STATUS = {
    pendente: "Aguardando confirmação",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    faltou: "Não compareceu",
  };
  U.FORMAS = { pix: "Pix", dinheiro: "Dinheiro", debito: "Cartão de débito", credito: "Cartão de crédito" };

  U.brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  U.num = (v) => {
    if (typeof v === "number") return v;
    const s = String(v || "").replace(/[^\d,.-]/g, "");
    if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
    return Number(s) || 0;
  };
  U.dur = (m) => {
    m = Math.round(m || 0);
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " min";
    return h + "h" + (r ? String(r).padStart(2, "0") : "");
  };
  U.toMin = (t) => {
    if (!t) return null;
    const [h, m] = String(t).split(":");
    return Number(h) * 60 + Number(m || 0);
  };
  U.fromMin = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  U.hm = (t) => (t ? String(t).slice(0, 5) : "");
  U.pad = (n) => String(n).padStart(2, "0");
  U.iso = (d) => d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate());
  U.parse = (s) => {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  };
  U.addDias = (s, n) => {
    const d = U.parse(s);
    d.setDate(d.getDate() + n);
    return U.iso(d);
  };
  /* data/hora "agora" no fuso de São Paulo, independente do aparelho */
  U.agora = () => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date())
        .map((x) => [x.type, x.value])
    );
    return { data: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
  };
  U.hoje = () => U.agora().data;
  U.dataLonga = (s) => {
    const d = U.parse(s);
    return `${U.DIAS[d.getDay()]}, ${d.getDate()} de ${U.MESES[d.getMonth()]}`;
  };
  U.dataCurta = (s) => {
    const d = U.parse(s);
    return `${U.pad(d.getDate())}/${U.pad(d.getMonth() + 1)}`;
  };
  U.soDigitos = (s) => String(s || "").replace(/\D/g, "");
  U.foneFmt = (s) => {
    let d = U.soDigitos(s);
    if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return s || "";
  };
  U.waLink = (fone, texto) => {
    let d = U.soDigitos(fone);
    if (!d) return "";
    if (!d.startsWith("55") || d.length <= 11) d = "55" + d;
    return "https://wa.me/" + d + (texto ? "?text=" + encodeURIComponent(texto) : "");
  };
  U.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
  U.sobrepoe = (a1, a2, b1, b2) => a1 < b2 && a2 > b1;

  /* ---------------- horários livres ----------------
     Retorna [{hora:"09:00", livre:true|false}] para um dia. */
  FL.gerarHorarios = function ({ data, duracao, horario, ocupados = [], bloqueios = [], config = {}, ignorarAntecedencia = false }) {
    if (!horario || !horario.aberto || !duracao) return [];
    const ini = U.toMin(horario.inicio), fim = U.toMin(horario.fim);
    const pI = U.toMin(horario.pausa_inicio), pF = U.toMin(horario.pausa_fim);
    const passo = Number(config.intervalo_min) || 30;
    const bl = bloqueios.filter((b) => b.data === data);
    if (bl.some((b) => !b.inicio)) return [];
    const agora = U.agora();
    let minimo = -1;
    if (!ignorarAntecedencia) {
      if (data < agora.data) return [];
      if (data === agora.data) minimo = agora.min + (Number(config.antecedencia_horas) || 0) * 60;
      else if (data === U.addDias(agora.data, 1)) {
        const resto = agora.min + (Number(config.antecedencia_horas) || 0) * 60 - 1440;
        if (resto > 0) minimo = resto;
      }
    }
    const out = [];
    for (let t = ini; t + duracao <= fim; t += passo) {
      const tf = t + duracao;
      let livre = t >= minimo;
      if (livre && pI != null && pF != null && U.sobrepoe(t, tf, pI, pF)) livre = false;
      if (livre && bl.some((b) => U.sobrepoe(t, tf, U.toMin(b.inicio), U.toMin(b.fim)))) livre = false;
      if (livre && ocupados.some((o) => U.sobrepoe(t, tf, U.toMin(o.inicio), U.toMin(o.fim)))) livre = false;
      // esconde horários que caem dentro da pausa (não só "ocupados")
      if (pI != null && pF != null && t >= pI && t < pF) continue;
      out.push({ hora: U.fromMin(t), livre });
    }
    return out;
  };

  /* ---------------- toast ---------------- */
  FL.toast = function (msg, tipo = "ok") {
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast toast-" + tipo;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add("sai"), 3200);
    setTimeout(() => el.remove(), 3700);
  };

  /* =====================================================================
     CAMADA DE DADOS
     ===================================================================== */
  const cfg = window.FL_CONFIG || {};
  const usarSupabase = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
  FL.modoDemo = !usarSupabase;

  const normHora = (r) => {
    if (!r) return r;
    for (const k of ["inicio", "fim", "pausa_inicio", "pausa_fim"]) if (k in r && r[k]) r[k] = U.hm(r[k]);
    return r;
  };
  const normNum = (r) => {
    if (!r) return r;
    for (const k of ["preco", "total", "desconto", "valor_pago", "valor", "sinal_valor"]) if (k in r && r[k] != null) r[k] = Number(r[k]);
    return r;
  };
  const norm = (r) => normNum(normHora(r));
  const ERROS = {
    AGENDA_FECHADA: "A agenda está fechada no momento.",
    HORARIO_OCUPADO: "Alguém acabou de reservar esse horário. Escolha outro.",
  };

  /* ---------- Supabase ---------- */
  function criarSupabase() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const ok = ({ data, error }) => {
      if (error) {
        const e = new Error(error.hint || ERROS[error.message] || error.message || "Erro ao falar com o servidor.");
        e.code = error.message;
        throw e;
      }
      return data;
    };
    return {
      async carregarPublico() {
        const hoje = U.hoje();
        const [c, s, h, b] = await Promise.all([
          sb.from("config").select("*").eq("id", 1).maybeSingle(),
          sb.from("servicos").select("*").eq("ativo", true).order("ordem"),
          sb.from("horarios").select("*").order("dia_semana"),
          sb.from("bloqueios").select("*").gte("data", hoje),
        ]);
        return { config: ok(c) || {}, servicos: ok(s).map(norm), horarios: ok(h).map(norm), bloqueios: ok(b).map(norm) };
      },
      async ocupados(data) {
        return ok(await sb.rpc("horarios_ocupados", { p_data: data })).map(norm);
      },
      async solicitar(p) {
        return ok(
          await sb.rpc("solicitar_agendamento", {
            p_nome: p.nome, p_whats: p.whats, p_data: p.data, p_inicio: p.inicio, p_servicos: p.servicos, p_obs: p.obs || "",
          })
        );
      },
      /* admin */
      async sessao() {
        const { data } = await sb.auth.getSession();
        return data.session ? { email: data.session.user.email } : null;
      },
      async entrar(email, senha) {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error("E-mail ou senha incorretos.");
      },
      async sair() { await sb.auth.signOut(); },
      async trocarSenha(nova) {
        const { error } = await sb.auth.updateUser({ password: nova });
        if (error) throw new Error(error.message);
      },
      async config() { return norm(ok(await sb.from("config").select("*").eq("id", 1).maybeSingle()) || {}); },
      async salvarConfig(patch) {
        return norm(ok(await sb.from("config").upsert({ id: 1, ...patch, atualizado_em: new Date().toISOString() }).select().single()));
      },
      async listar(tabela, f = {}) {
        let q = sb.from(tabela).select("*");
        if (f.de) q = q.gte(f.campo || "data", f.de);
        if (f.ate) q = q.lte(f.campo || "data", f.ate);
        if (f.ordem) for (const o of f.ordem) q = q.order(o, { ascending: true });
        return ok(await q).map(norm);
      },
      async salvar(tabela, row) {
        const r = { ...row };
        return norm(ok(await sb.from(tabela).upsert(r).select().single()));
      },
      async salvarVarios(tabela, rows) {
        return ok(await sb.from(tabela).upsert(rows).select()).map(norm);
      },
      async apagar(tabela, id) { ok(await sb.from(tabela).delete().eq("id", id)); },
    };
  }

  /* ---------- Demonstração (localStorage) ---------- */
  function criarDemo() {
    const KEY = "flordelusa_demo_v1";
    const ls = {
      get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
      set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
    };
    let mem = null;
    function semente() {
      const sv = (nome, categoria, tipo, preco, duracao_min, ordem, descricao) => ({ id: U.uid(), nome, categoria, tipo, preco, duracao_min, ordem, descricao, ativo: true });
      const servicos = [
        sv("Aplicação F1", "Alongamento", "principal", 80, 120, 1, "Alongamento com molde F1, formato e comprimento à sua escolha."),
        sv("Banho de Gel", "Gel", "principal", 60, 90, 2, "Camada de gel sobre a unha natural para mais resistência e brilho."),
        sv("Esmaltação em Gel", "Gel", "principal", 50, 90, 3, "Esmalte em gel com secagem em cabine e duração prolongada."),
        sv("Manutenção Molde F1", "Manutenção", "principal", 65, 120, 4, "Manutenção do alongamento F1."),
        sv("Manutenção Banho de Gel", "Manutenção", "principal", 55, 90, 5, "Manutenção do banho de gel."),
        sv("Remoção", "Extras", "extra", 35, 50, 6, "Remoção do material anterior."),
        sv("Reposição de Unha", "Extras", "extra", 10, 20, 7, "Reposição de unha quebrada (por unha)."),
        sv("Nail Art Livre", "Nail Art", "extra", 20, 70, 8, "Arte livre combinada na hora."),
        sv("Baby Boomer", "Nail Art", "extra", 25, 70, 9, "Degradê baby boomer."),
      ];
      const horarios = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        dia_semana: d, aberto: d !== 0, inicio: "08:00", fim: d === 6 ? "14:00" : "18:00",
        pausa_inicio: d === 6 || d === 0 ? null : "12:00", pausa_fim: d === 6 || d === 0 ? null : "13:00",
      }));
      const config = {
        id: 1, nome: "Flor de Lusa Studio", profissional: "", whatsapp: "", endereco: "", maps_url: "", instagram: "",
        sobre: "Nail designer com raízes portuguesas. Alongamentos, banho de gel e nail art feitos com calma e cuidado em cada detalhe.",
        politicas: "• A solicitação só vira agendamento depois da confirmação pelo WhatsApp.\n• Chegue com até 10 minutos de tolerância. Após isso o atendimento pode ser reduzido ou remarcado.\n• Remarcações e cancelamentos com pelo menos 24 horas de antecedência.\n• Faltas sem aviso podem exigir sinal para os próximos agendamentos.",
        agenda_aberta: true, msg_fechada: "A agenda está fechada no momento. Chame no WhatsApp para verificar disponibilidade.",
        intervalo_min: 30, antecedencia_horas: 2, janela_dias: 45, sinal_valor: 0, pix_chave: "", pix_nome: "",
      };
      // agendamentos de EXEMPLO para o painel não abrir vazio
      const nomes = ["Ana (exemplo)", "Bruna (exemplo)", "Carla (exemplo)", "Daniela (exemplo)", "Elisa (exemplo)", "Fernanda (exemplo)", "Gabi (exemplo)", "Helena (exemplo)"];
      const formas = ["pix", "pix", "dinheiro", "credito", "debito", "pix"];
      const hoje = U.hoje();
      const ag = [];
      let k = 0;
      for (let i = -24; i <= 6; i++) {
        const data = U.addDias(hoje, i);
        const dw = U.parse(data).getDay();
        if (dw === 0) continue;
        const qtd = i < 0 ? 1 + (Math.abs(i) % 3) : i === 0 ? 2 : i % 2 ? 1 : 0;
        let t = 8 * 60 + 30;
        for (let j = 0; j < qtd; j++) {
          const s1 = servicos[(k * 3 + j) % 5];
          const extras = k % 4 === 0 ? [servicos[5 + (k % 4)]] : [];
          const itens = [s1, ...extras].map(({ id, nome, preco, duracao_min, tipo }) => ({ id, nome, preco, duracao_min, tipo }));
          const dur = itens.reduce((a, b) => a + b.duracao_min, 0);
          if (t < 12 * 60 && t + dur > 12 * 60) t = 13 * 60;
          if (t + dur > (dw === 6 ? 14 : 18) * 60) break;
          const total = itens.reduce((a, b) => a + b.preco, 0);
          const passado = i < 0;
          const status = passado ? (k % 11 === 5 ? "faltou" : k % 13 === 7 ? "cancelado" : "concluido") : i === 0 && j === 0 ? "confirmado" : k % 2 ? "pendente" : "confirmado";
          ag.push({
            id: U.uid(), cliente_nome: nomes[k % nomes.length], cliente_whats: "3799999" + String(1000 + (k % nomes.length)),
            data, inicio: U.fromMin(t), fim: U.fromMin(t + dur), servicos: itens, total, desconto: 0, status,
            pago: status === "concluido", valor_pago: status === "concluido" ? total : null,
            forma_pagamento: status === "concluido" ? formas[k % formas.length] : null,
            obs: "", obs_interna: "", origem: k % 3 ? "site" : "admin", criado_em: new Date().toISOString(),
          });
          t += dur + 30;
          k++;
        }
      }
      const despesas = [
        { id: U.uid(), data: U.addDias(hoje, -20), descricao: "Gel construtor e top coat (exemplo)", categoria: "Material", valor: 186.9 },
        { id: U.uid(), data: U.addDias(hoje, -12), descricao: "Lixas e palitos (exemplo)", categoria: "Material", valor: 42.5 },
        { id: U.uid(), data: U.addDias(hoje, -5), descricao: "Impulsionamento Instagram (exemplo)", categoria: "Divulgação", valor: 50 },
      ];
      return { config, servicos, horarios, bloqueios: [], agendamentos: ag, despesas };
    }
    const db = () => {
      if (!mem) mem = ls.get() || semente();
      return mem;
    };
    const save = () => ls.set(mem);
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const espera = (v) => new Promise((r) => setTimeout(() => r(clone(v)), 120));
    const SKEY = "flordelusa_demo_sessao";
    return {
      async carregarPublico() {
        const d = db();
        const hoje = U.hoje();
        return espera({
          config: d.config, servicos: d.servicos.filter((s) => s.ativo).sort((a, b) => a.ordem - b.ordem),
          horarios: d.horarios, bloqueios: d.bloqueios.filter((b) => b.data >= hoje),
        });
      },
      async ocupados(data) {
        return espera(db().agendamentos.filter((a) => a.data === data && ["pendente", "confirmado", "concluido"].includes(a.status)).map((a) => ({ inicio: a.inicio, fim: a.fim })));
      },
      async solicitar(p) {
        const d = db();
        if (!d.config.agenda_aberta) throw new Error(ERROS.AGENDA_FECHADA);
        const itens = d.servicos.filter((s) => p.servicos.includes(s.id) && s.ativo).map(({ id, nome, preco, duracao_min, tipo }) => ({ id, nome, preco, duracao_min, tipo }));
        if (!itens.some((i) => i.tipo === "principal")) throw new Error("Escolha um serviço principal além dos extras.");
        const dur = itens.reduce((a, b) => a + b.duracao_min, 0);
        const total = itens.reduce((a, b) => a + b.preco, 0);
        const ini = U.toMin(p.inicio), fim = ini + dur;
        const conflito = d.agendamentos.some((a) => a.data === p.data && ["pendente", "confirmado", "concluido"].includes(a.status) && U.sobrepoe(ini, fim, U.toMin(a.inicio), U.toMin(a.fim)));
        if (conflito) throw new Error(ERROS.HORARIO_OCUPADO);
        const row = {
          id: U.uid(), cliente_nome: p.nome.trim(), cliente_whats: U.soDigitos(p.whats), data: p.data, inicio: p.inicio, fim: U.fromMin(fim),
          servicos: itens, total, desconto: 0, status: "pendente", pago: false, valor_pago: null, forma_pagamento: null,
          obs: p.obs || "", obs_interna: "", origem: "site", criado_em: new Date().toISOString(),
        };
        d.agendamentos.push(row);
        save();
        return espera({ id: row.id, total, fim: row.fim, duracao_min: dur, servicos: itens });
      },
      async sessao() {
        try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch (e) { return null; }
      },
      async entrar(email, senha) {
        if (senha !== "demo") throw new Error("No modo demonstração a senha é: demo");
        try { sessionStorage.setItem(SKEY, JSON.stringify({ email: email || "demo@flordelusa" })); } catch (e) {}
      },
      async sair() { try { sessionStorage.removeItem(SKEY); } catch (e) {} },
      async trocarSenha() { throw new Error("No modo demonstração não há senha para trocar."); },
      async config() { return espera(db().config); },
      async salvarConfig(patch) {
        Object.assign(db().config, patch);
        save();
        return espera(db().config);
      },
      async listar(tabela, f = {}) {
        let rows = db()[tabela] || [];
        const c = f.campo || "data";
        if (f.de) rows = rows.filter((r) => r[c] >= f.de);
        if (f.ate) rows = rows.filter((r) => r[c] <= f.ate);
        rows = [...rows];
        if (f.ordem) rows.sort((a, b) => { for (const o of f.ordem) { if (a[o] < b[o]) return -1; if (a[o] > b[o]) return 1; } return 0; });
        return espera(rows);
      },
      async salvar(tabela, row) {
        const arr = db()[tabela];
        const chave = tabela === "horarios" ? "dia_semana" : "id";
        if (chave === "id" && !row.id) row = { ...row, id: U.uid(), criado_em: new Date().toISOString() };
        const i = arr.findIndex((r) => r[chave] === row[chave]);
        if (i >= 0) arr[i] = { ...arr[i], ...row };
        else arr.push(row);
        save();
        return espera(i >= 0 ? arr[i] : row);
      },
      async salvarVarios(tabela, rows) {
        const out = [];
        for (const r of rows) out.push(await this.salvar(tabela, r));
        return out;
      },
      async apagar(tabela, id) {
        const d = db();
        d[tabela] = d[tabela].filter((r) => r.id !== id);
        save();
        return espera(true);
      },
      async resetarDemo() {
        mem = semente();
        save();
      },
    };
  }

  FL.api = usarSupabase ? criarSupabase() : criarDemo();
})();
