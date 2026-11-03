/* Flor de Lusa Studio · painel da profissional */
(function () {
  const { u: U, api } = FL;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ATIVOS = ["pendente", "confirmado", "concluido"];
  const CAT_DESP = ["Material", "Aluguel", "Contas", "Divulgação", "Equipamento", "Curso", "Taxas", "Outros"];
  const ABAS = ["agenda", "financeiro", "clientes", "servicos", "horarios", "ajustes"];
  const S = {
    config: {}, servicos: [], horarios: [], bloqueios: [], ag: [],
    aba: "agenda", dia: U.hoje(), finMes: U.hoje().slice(0, 7), busca: "", carregado: false,
  };
  const IC = {
    whats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    cima: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>',
    baixo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>',
  };

  /* =================== helpers =================== */
  const valorDe = (a) => Math.max(0, (Number(a.total) || 0) - (Number(a.desconto) || 0));
  const recebidoDe = (a) => (a.pago ? (a.valor_pago != null ? Number(a.valor_pago) : valorDe(a)) : 0);
  const nomesServ = (a) => (a.servicos || []).map((s) => s.nome).join(" + ");
  const durServ = (ids) => S.servicos.filter((s) => ids.includes(s.id)).reduce((t, s) => t + s.duracao_min, 0);
  const horarioDo = (iso) => S.horarios.find((h) => h.dia_semana === U.parse(iso).getDay());
  const chip = (st) => `<span class="chip st-${st}">${U.STATUS[st] || st}</span>`;
  const err = (e) => FL.toast(e && e.message ? e.message : "Algo deu errado. Tente de novo.", "erro");
  const ordenarAg = () => S.ag.sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));

  function msgConfirmacao(a) {
    const c = S.config;
    return [
      `Olá, ${a.cliente_nome.split(" ")[0]}! Seu horário no ${c.nome || "Flor de Lusa Studio"} está confirmado ✨`,
      ``,
      `📅 ${U.dataLonga(a.data)}`,
      `🕐 ${a.inicio}`,
      `💅 ${nomesServ(a)}`,
      `💰 ${U.brl(valorDe(a))}`,
      c.endereco ? `📍 ${c.endereco}` : "",
      ``,
      `Qualquer imprevisto, me avise com antecedência. Te espero!`,
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
  }
  const msgLembrete = (a) =>
    `Oi, ${a.cliente_nome.split(" ")[0]}! Passando para lembrar do seu horário ${a.data === U.addDias(U.hoje(), 1) ? "amanhã" : U.dataLonga(a.data).toLowerCase()} às ${a.inicio} (${nomesServ(a)}). Posso confirmar sua presença? 🌺`;
  const msgRecusa = (a) =>
    `Olá, ${a.cliente_nome.split(" ")[0]}! Recebi sua solicitação para ${U.dataLonga(a.data).toLowerCase()} às ${a.inicio}, mas infelizmente não vou conseguir atender nesse horário. Posso te oferecer outro dia ou horário?`;

  /* =================== modais =================== */
  let aoFechar = null;
  function abrir(html, montar) {
    $("#modais").innerHTML = `<div class="modal-fundo" data-fundo><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTit">${html}</div></div>`;
    const m = $(".modal");
    if (montar) montar(m);
    const f = m.querySelector("input:not([type=hidden]), select, textarea, button");
    if (f && f.type !== "checkbox") f.focus({ preventScroll: true });
    return m;
  }
  function fechar() {
    $("#modais").innerHTML = "";
    if (aoFechar) { const f = aoFechar; aoFechar = null; f(); }
  }
  function confirmar(titulo, texto, ok = "Confirmar", perigo = false) {
    return new Promise((res) => {
      abrir(`<h2 id="mTit">${U.esc(titulo)}</h2><p>${U.esc(texto)}</p>
        <div class="modal-acoes"><button type="button" class="btn btn-contorno" data-r="0">Voltar</button><button type="button" class="btn ${perigo ? "btn-perigo" : ""}" data-r="1">${U.esc(ok)}</button></div>`,
      (m) => {
        aoFechar = () => res(false);
        m.addEventListener("click", (e) => {
          const b = e.target.closest("[data-r]");
          if (!b) return;
          aoFechar = null;
          fechar();
          res(b.dataset.r === "1");
        });
      });
    });
  }

  /* =================== sessão =================== */
  async function iniciar() {
    $("#avisoDemo").hidden = !FL.modoDemo;
    $("#loginDemo").hidden = !FL.modoDemo;
    const s = await api.sessao().catch(() => null);
    if (s) return entrarApp();
    $("#telaLogin").hidden = false;
    $("#app").hidden = true;
  }
  $("#formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("#btnEntrar"), er = $("#erroLogin");
    er.hidden = true;
    b.disabled = true;
    b.textContent = "Entrando…";
    try {
      await api.entrar($("#lEmail").value.trim(), $("#lSenha").value);
      $("#lSenha").value = "";
      await entrarApp();
    } catch (x) {
      er.textContent = x.message || "Não foi possível entrar.";
      er.hidden = false;
    } finally {
      b.disabled = false;
      b.textContent = "Entrar";
    }
  });
  $("#btnSair").onclick = async () => {
    await api.sair();
    location.hash = "";
    location.reload();
  };

  async function entrarApp() {
    $("#telaLogin").hidden = true;
    $("#app").hidden = false;
    try {
      await carregarTudo();
    } catch (e) {
      $("#corpo").innerHTML = `<div class="vazio">Não foi possível carregar os dados: ${U.esc(e.message)}. <button class="btn-texto" onclick="location.reload()">Tentar de novo</button></div>`;
      return;
    }
    rota();
  }

  async function carregarTudo() {
    const hoje = U.hoje();
    const [config, servicos, horarios, bloqueios, ag] = await Promise.all([
      api.config(),
      api.listar("servicos", { ordem: ["ordem"] }),
      api.listar("horarios", { campo: "dia_semana", ordem: ["dia_semana"] }),
      api.listar("bloqueios", { de: U.addDias(hoje, -60), ordem: ["data"] }),
      api.listar("agendamentos", { de: U.addDias(hoje, -400), ordem: ["data", "inicio"] }),
    ]);
    Object.assign(S, { config, servicos, horarios, bloqueios, ag, carregado: true });
    pintarCab();
  }
  async function recarregarAg() {
    S.ag = await api.listar("agendamentos", { de: U.addDias(U.hoje(), -400), ordem: ["data", "inicio"] });
    pintarCab();
  }

  function pintarCab() {
    $("#cabNome").textContent = S.config.nome || "Flor de Lusa Studio";
    const t = $("#togAgenda");
    const ab = !!S.config.agenda_aberta;
    t.setAttribute("aria-checked", ab);
    $(".interruptor-txt", t).textContent = ab ? "Agenda aberta" : "Agenda fechada";
    const n = S.ag.filter((a) => a.status === "pendente" && a.data >= U.hoje()).length;
    const b = $("#badgePend");
    b.hidden = !n;
    b.textContent = n;
  }
  $("#togAgenda").onclick = async () => {
    const novo = !S.config.agenda_aberta;
    if (!novo && !(await confirmar("Fechar a agenda?", "As clientes vão ver a mensagem de agenda fechada e não conseguirão solicitar horários até você reabrir.", "Fechar agenda"))) return;
    try {
      S.config = await api.salvarConfig({ agenda_aberta: novo });
      pintarCab();
      FL.toast(novo ? "Agenda aberta. As clientes já podem agendar." : "Agenda fechada.");
      if (S.aba === "ajustes") pintar();
    } catch (e) { err(e); }
  };

  /* =================== rotas =================== */
  function rota() {
    const h = location.hash.replace("#", "");
    S.aba = ABAS.includes(h) ? h : "agenda";
    $$(".abas a").forEach((a) => a.setAttribute("aria-selected", a.dataset.aba === S.aba));
    pintar();
    const ativa = $(`.abas a[data-aba="${S.aba}"]`);
    if (ativa) ativa.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  window.addEventListener("hashchange", () => { if (S.carregado) { rota(); window.scrollTo(0, 0); } });
  function pintar() {
    const f = { agenda: vAgenda, financeiro: vFinanceiro, clientes: vClientes, servicos: vServicos, horarios: vHorarios, ajustes: vAjustes }[S.aba];
    f();
  }
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && S.carregado && !$("#modais").innerHTML) {
      try { await recarregarAg(); if (S.aba === "agenda" || S.aba === "clientes") pintar(); } catch (e) {}
    }
  });

  /* =================== AGENDA =================== */
  function vAgenda() {
    const hoje = U.hoje();
    const pend = S.ag.filter((a) => a.status === "pendente" && a.data >= hoje);
    const doDia = S.ag.filter((a) => a.data === S.dia);
    const ativosDia = doDia.filter((a) => ATIVOS.includes(a.status));
    const prev = ativosDia.reduce((t, a) => t + valorDe(a), 0);
    const rec = doDia.reduce((t, a) => t + recebidoDe(a), 0);
    const h = horarioDo(S.dia);
    const bl = S.bloqueios.filter((b) => b.data === S.dia);

    // semana (domingo a sábado) do dia escolhido
    const d0 = U.addDias(S.dia, -U.parse(S.dia).getDay());
    const semana = [...Array(7)].map((_, i) => {
      const iso = U.addDias(d0, i);
      const n = S.ag.filter((a) => a.data === iso && ATIVOS.includes(a.status)).length;
      const hh = horarioDo(iso);
      const fech = !hh || !hh.aberto || S.bloqueios.some((b) => b.data === iso && !b.inicio);
      return `<button type="button" class="sem-dia${iso === hoje ? " hoje" : ""}${fech ? " fechado" : ""}" data-dia="${iso}" aria-pressed="${iso === S.dia}">
        <small>${U.DIAS_CURTO[i]}</small><b>${U.parse(iso).getDate()}</b><i>${n ? n + (n > 1 ? " atend." : " atend.") : fech ? "folga" : ""}</i></button>`;
    }).join("");

    $("#corpo").innerHTML = `
      <div class="secao-cab">
        <div><p class="rotulo">Agenda</p><h1>${U.dataLonga(S.dia)}</h1></div>
        <div class="acoes">
          <button class="btn btn-laranja" data-acao="novo">+ Novo agendamento</button>
          <button class="btn btn-contorno" data-acao="bloquear">Bloquear horário</button>
        </div>
      </div>
      ${pend.length ? `<section class="painel"><div class="secao-cab"><h2>Aguardando sua confirmação · ${pend.length}</h2></div>
        <div class="lista">${pend.map(cartaoPend).join("")}</div></section>` : ""}
      <div class="duas-col">
        <section class="painel">
          <div class="dias-nav">
            <button class="seta" data-acao="dia-ant" aria-label="Dia anterior">‹</button>
            <button class="seta" data-acao="dia-prox" aria-label="Próximo dia">›</button>
            <button class="btn btn-contorno btn-pequeno" data-acao="dia-hoje">Hoje</button>
            <input type="date" class="entrada" id="irData" value="${S.dia}" style="max-width:170px;min-height:38px" aria-label="Ir para data">
            <button class="btn btn-contorno btn-pequeno" data-acao="atualizar">Atualizar</button>
          </div>
          <div class="semana">${semana}</div>
          <div class="lista" id="listaDia">${listaDia(doDia, h, bl)}</div>
        </section>
        <aside class="painel">
          <h2>Resumo do dia</h2>
          <div class="kpis" style="grid-template-columns:1fr 1fr">
            <div class="kpi"><span class="rotulo">Atendimentos</span><strong>${ativosDia.length}</strong></div>
            <div class="kpi"><span class="rotulo">Previsto</span><strong>${U.brl(prev)}</strong></div>
            <div class="kpi"><span class="rotulo">Recebido</span><strong>${U.brl(rec)}</strong></div>
            <div class="kpi"><span class="rotulo">Expediente</span><strong style="font-size:1.25rem">${h && h.aberto ? `${h.inicio}–${h.fim}` : "Folga"}</strong>${h && h.aberto && h.pausa_inicio ? `<small>Pausa ${h.pausa_inicio}–${h.pausa_fim}</small>` : ""}</div>
          </div>
          ${bl.length ? `<div class="det-bloco"><p class="rotulo">Bloqueios neste dia</p>${bl.map(cartaoBloq).join("")}</div>` : ""}
          ${proximosLembretes()}
        </aside>
      </div>`;
    $("#irData").onchange = (e) => { if (e.target.value) { S.dia = e.target.value; vAgenda(); } };
  }

  function cartaoPend(a) {
    return `<div class="pend">
      <div class="pend-topo"><strong>${U.esc(a.cliente_nome)}</strong><span class="pend-meta num">${U.dataLonga(a.data)} · ${a.inicio}–${a.fim}</span></div>
      <div class="pend-meta">${U.esc(nomesServ(a))} · <b>${U.brl(valorDe(a))}</b>${a.obs ? ` · “${U.esc(a.obs)}”` : ""}</div>
      <div class="linha-btns">
        <a class="btn btn-whats btn-pequeno" href="${U.esc(U.waLink(a.cliente_whats, msgConfirmacao(a)))}" target="_blank" rel="noopener" data-acao="confirmar" data-id="${a.id}">${IC.whats} Confirmar e avisar</a>
        <button class="btn btn-contorno btn-pequeno" data-acao="confirmar-so" data-id="${a.id}">Só confirmar</button>
        <a class="btn btn-contorno btn-pequeno" href="${U.esc(U.waLink(a.cliente_whats, msgRecusa(a)))}" target="_blank" rel="noopener" data-acao="recusar" data-id="${a.id}">Recusar</a>
        <button class="btn-texto" data-acao="abrir" data-id="${a.id}">Detalhes</button>
      </div></div>`;
  }

  function cartaoAtend(a) {
    return `<button type="button" class="atend s-${a.status}" data-acao="abrir" data-id="${a.id}">
      <span class="atend-hora"><b>${a.inicio}</b><small>${a.fim}</small></span>
      <span class="atend-txt"><span class="atend-nome">${U.esc(a.cliente_nome)}</span><span class="atend-serv">${U.esc(nomesServ(a))}</span></span>
      <span class="atend-lado">${chip(a.status)}<span class="atend-valor">${U.brl(valorDe(a))}</span>${a.pago ? '<span class="pago">PAGO</span>' : ""}</span>
    </button>`;
  }
  function cartaoBloq(b) {
    return `<div class="bloq"><div><strong>${b.inicio ? `${b.inicio}–${b.fim}` : "Dia inteiro"}</strong><small>${U.esc(b.motivo || "Bloqueado")} · ${U.dataCurta(b.data)}</small></div>
      <button class="ico-btn" data-acao="del-bloq" data-id="${b.id}" aria-label="Remover bloqueio">${IC.lixo}</button></div>`;
  }

  function listaDia(doDia, h, bl) {
    const ativos = doDia.filter((a) => ATIVOS.includes(a.status));
    const outros = doDia.filter((a) => !ATIVOS.includes(a.status));
    if (!doDia.length) {
      const fech = !h || !h.aberto || bl.some((b) => !b.inicio);
      return `<div class="vazio">${fech ? "Dia de folga, sem atendimentos." : "Nenhum atendimento neste dia ainda."}<br><button class="btn-texto" data-acao="novo">Adicionar agendamento</button></div>`;
    }
    let html = "";
    let cursor = h && h.aberto ? U.toMin(h.inicio) : null;
    if (cursor != null && S.dia === U.hoje()) cursor = Math.max(cursor, Math.ceil(U.agora().min / 30) * 30);
    const fimDia = h && h.aberto ? U.toMin(h.fim) : null;
    const lacuna = (de, ate) => {
      if (de == null || ate - de < 30) return "";
      const pI = U.toMin(h.pausa_inicio), pF = U.toMin(h.pausa_fim);
      if (pI != null && de >= pI && ate <= pF) return "";
      return `<div class="livre">Livre ${U.fromMin(de)}–${U.fromMin(ate)}</div>`;
    };
    ativos.forEach((a) => {
      if (cursor != null) html += lacuna(cursor, U.toMin(a.inicio));
      html += cartaoAtend(a);
      cursor = Math.max(cursor ?? 0, U.toMin(a.fim));
    });
    if (cursor != null && fimDia != null && S.dia >= U.hoje()) html += lacuna(cursor, fimDia);
    if (outros.length) html += `<p class="rotulo" style="margin-top:8px">Cancelados e faltas</p>` + outros.map(cartaoAtend).join("");
    return html;
  }

  function proximosLembretes() {
    const amanha = U.addDias(U.hoje(), 1);
    const lista = S.ag.filter((a) => a.data === amanha && a.status === "confirmado");
    if (!lista.length) return "";
    return `<div class="det-bloco"><p class="rotulo">Lembretes para amanhã</p>${lista
      .map((a) => `<div class="bloq"><div><strong>${a.inicio} · ${U.esc(a.cliente_nome)}</strong><small>${U.esc(nomesServ(a))}</small></div>
        <a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener" href="${U.esc(U.waLink(a.cliente_whats, msgLembrete(a)))}">${IC.whats} Lembrar</a></div>`)
      .join("")}</div>`;
  }

  async function mudarStatus(id, status, extra = {}) {
    const a = S.ag.find((x) => x.id === id);
    if (!a) return;
    try {
      const r = await api.salvar("agendamentos", { ...a, status, ...extra });
      Object.assign(a, r);
      pintarCab();
      pintar();
      FL.toast(`${a.cliente_nome}: ${U.STATUS[status].toLowerCase()}`);
    } catch (e) { err(e); }
  }

  /* ----- detalhe do atendimento ----- */
  function abrirAtend(id) {
    const a = S.ag.find((x) => x.id === id);
    if (!a) return;
    const formas = Object.entries(U.FORMAS).map(([k, v]) => `<option value="${k}" ${a.forma_pagamento === k ? "selected" : ""}>${v}</option>`).join("");
    abrir(`
      <div class="det-topo"><div><h2 id="mTit">${U.esc(a.cliente_nome)}</h2><p class="num" style="color:var(--tinta-2)">${U.esc(U.foneFmt(a.cliente_whats))}</p></div>${chip(a.status)}</div>
      <div class="det-info">
        <div class="det-linha"><span>Dia</span><strong>${U.dataLonga(a.data)}</strong></div>
        <div class="det-linha"><span>Horário</span><strong class="num">${a.inicio} às ${a.fim}</strong></div>
        <div class="det-linha"><span>Serviços</span><strong>${U.esc(nomesServ(a))}</strong></div>
        <div class="det-linha"><span>Valor</span><strong class="num">${U.brl(a.total)}${Number(a.desconto) ? ` − ${U.brl(a.desconto)} = ${U.brl(valorDe(a))}` : ""}</strong></div>
        <div class="det-linha"><span>Origem</span><strong>${a.origem === "site" ? "Pelo site" : "Lançado no painel"}</strong></div>
        ${a.obs ? `<div class="det-linha"><span>Recado da cliente</span><strong>${U.esc(a.obs)}</strong></div>` : ""}
      </div>
      <div class="linha-btns">
        <a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener" href="${U.esc(U.waLink(a.cliente_whats, msgConfirmacao(a)))}">${IC.whats} Enviar confirmação</a>
        <a class="btn btn-contorno btn-pequeno" target="_blank" rel="noopener" href="${U.esc(U.waLink(a.cliente_whats, msgLembrete(a)))}">Lembrete</a>
        <a class="btn btn-contorno btn-pequeno" target="_blank" rel="noopener" href="${U.esc(U.waLink(a.cliente_whats, ""))}">Abrir conversa</a>
      </div>
      <div class="det-bloco"><p class="rotulo">Situação</p>
        <div class="status-btns" id="dStatus">${Object.keys(U.STATUS).map((s) => `<button type="button" data-st="${s}" aria-pressed="${a.status === s}">${U.STATUS[s]}</button>`).join("")}</div>
      </div>
      <div class="det-bloco"><p class="rotulo">Pagamento</p>
        <label class="check"><input type="checkbox" id="dPago" ${a.pago ? "checked" : ""}><span>Pagamento recebido</span></label>
        <div class="grade-form">
          <label class="campo"><span>Valor recebido</span><span class="entrada-pref"><em>R$</em><input class="entrada" id="dValor" inputmode="decimal" value="${String(a.valor_pago != null ? a.valor_pago : valorDe(a)).replace(".", ",")}"></span></label>
          <label class="campo"><span>Forma</span><select class="entrada" id="dForma"><option value="">—</option>${formas}</select></label>
          <label class="campo"><span>Desconto</span><span class="entrada-pref"><em>R$</em><input class="entrada" id="dDesc" inputmode="decimal" value="${String(a.desconto || 0).replace(".", ",")}"></span></label>
        </div>
      </div>
      <div class="det-bloco"><label class="campo"><span>Anotação interna (só você vê)</span><textarea class="entrada" id="dObsI" maxlength="1000">${U.esc(a.obs_interna || "")}</textarea></label></div>
      <div class="modal-acoes">
        <button type="button" class="btn-texto perigo" id="dExcluir" style="margin-right:auto">Excluir</button>
        <button type="button" class="btn btn-contorno" id="dEditar">Editar / remarcar</button>
        <button type="button" class="btn btn-laranja" id="dSalvar">Salvar</button>
      </div>`,
    (m) => {
      let status = a.status;
      $("#dStatus", m).onclick = (e) => {
        const b = e.target.closest("[data-st]");
        if (!b) return;
        status = b.dataset.st;
        $$("#dStatus button", m).forEach((x) => x.setAttribute("aria-pressed", x === b));
        if (status === "concluido" && !$("#dPago", m).checked) $("#dPago", m).checked = true;
      };
      $("#dDesc", m).oninput = () => {
        if (!a.pago) $("#dValor", m).value = String(Math.max(0, a.total - U.num($("#dDesc", m).value))).replace(".", ",");
      };
      $("#dSalvar", m).onclick = async () => {
        const pago = $("#dPago", m).checked;
        const forma = $("#dForma", m).value;
        if (pago && !forma) return FL.toast("Escolha a forma de pagamento.", "erro");
        try {
          const r = await api.salvar("agendamentos", {
            ...a, status, pago, valor_pago: pago ? U.num($("#dValor", m).value) : null, forma_pagamento: pago ? forma : null,
            desconto: U.num($("#dDesc", m).value), obs_interna: $("#dObsI", m).value.trim(),
          });
          Object.assign(a, r);
          fechar();
          pintarCab();
          pintar();
          FL.toast("Atendimento salvo");
        } catch (e) { err(e); }
      };
      $("#dEditar", m).onclick = () => formAgendamento(a);
      $("#dExcluir", m).onclick = async () => {
        if (!(await confirmar("Excluir atendimento?", `O registro de ${a.cliente_nome} em ${U.dataCurta(a.data)} será apagado de vez, inclusive do financeiro. Para manter o histórico, prefira marcar como cancelado.`, "Excluir", true))) return;
        try {
          await api.apagar("agendamentos", a.id);
          S.ag = S.ag.filter((x) => x.id !== a.id);
          pintarCab();
          pintar();
          FL.toast("Atendimento excluído");
        } catch (e) { err(e); }
      };
    });
  }

  /* ----- novo / editar agendamento ----- */
  function formAgendamento(a) {
    const novo = !a;
    a = a || { cliente_nome: "", cliente_whats: "", data: S.dia >= U.hoje() ? S.dia : U.hoje(), inicio: "", servicos: [], status: "confirmado", obs_interna: "", desconto: 0 };
    const selIds = new Set((a.servicos || []).map((s) => s.id));
    const clientes = mapaClientes();
    const ativosServ = S.servicos.filter((s) => s.ativo || selIds.has(s.id));
    abrir(`
      <h2 id="mTit">${novo ? "Novo agendamento" : "Editar agendamento"}</h2>
      <form id="fAg" class="det-bloco" novalidate>
        <div class="grade-form">
          <label class="campo"><span>Cliente</span><input class="entrada" id="aNome" list="dlClientes" required maxlength="80" value="${U.esc(a.cliente_nome)}" autocomplete="off"></label>
          <label class="campo"><span>WhatsApp</span><input class="entrada" id="aWhats" inputmode="tel" maxlength="16" value="${U.esc(U.foneFmt(a.cliente_whats))}" placeholder="(37) 99999-9999"></label>
        </div>
        <datalist id="dlClientes">${clientes.map((c) => `<option value="${U.esc(c.nome)}">${U.esc(U.foneFmt(c.whats))}</option>`).join("")}</datalist>
        <div class="campo"><span>Serviços</span>
          <div class="checks-serv">${ativosServ.map((s) => `<label><input type="checkbox" value="${s.id}" ${selIds.has(s.id) ? "checked" : ""}><span>${U.esc(s.nome)}${s.tipo === "extra" ? ' <small class="tag extra">extra</small>' : ""}</span><em>${U.brl(s.preco)} · ${U.dur(s.duracao_min)}</em></label>`).join("")}</div>
        </div>
        <div class="grade-form">
          <label class="campo"><span>Dia</span><input class="entrada" type="date" id="aData" value="${a.data}" required></label>
          <label class="campo"><span>Horário</span><select class="entrada" id="aHora"></select></label>
          <label class="campo" id="aHoraLivreBox" hidden><span>Horário de início</span><input class="entrada" type="time" id="aHoraLivre" step="300" value="${a.inicio}"></label>
          <label class="campo"><span>Situação</span><select class="entrada" id="aStatus">${Object.keys(U.STATUS).map((s) => `<option value="${s}" ${a.status === s ? "selected" : ""}>${U.STATUS[s]}</option>`).join("")}</select></label>
        </div>
        <p id="aResumo" class="painel-dica" style="margin:0"></p>
        <label class="campo"><span>Anotação interna</span><textarea class="entrada" id="aObs" maxlength="1000">${U.esc(a.obs_interna || "")}</textarea></label>
      </form>
      <div class="modal-acoes"><button type="button" class="btn btn-contorno" data-fechar>Cancelar</button><button type="button" class="btn btn-laranja" id="aSalvar">${novo ? "Agendar" : "Salvar alterações"}</button></div>`,
    (m) => {
      const ids = () => $$(".checks-serv input:checked", m).map((i) => i.value);
      const atualizarHoras = () => {
        const data = $("#aData", m).value;
        const dur = durServ(ids()) || 30;
        const ocup = S.ag.filter((x) => x.data === data && x.id !== a.id && ATIVOS.includes(x.status));
        const lista = data ? FL.gerarHorarios({ data, duracao: dur, horario: horarioDo(data), ocupados: ocup, bloqueios: S.bloqueios, config: S.config, ignorarAntecedencia: true }) : [];
        const livres = lista.filter((h) => h.livre).map((h) => h.hora);
        const atual = $("#aHora", m).value || a.inicio;
        let ops = livres.map((h) => `<option value="${h}">${h}</option>`).join("");
        if (a.inicio && data === a.data && !livres.includes(a.inicio)) ops = `<option value="${a.inicio}">${a.inicio} (atual)</option>` + ops;
        ops += `<option value="__outro">Outro horário (encaixe)…</option>`;
        $("#aHora", m).innerHTML = (livres.length || a.inicio ? "" : `<option value="">Sem horário livre</option>`) + ops;
        if ([...$("#aHora", m).options].some((o) => o.value === atual)) $("#aHora", m).value = atual;
        $("#aHoraLivreBox", m).hidden = $("#aHora", m).value !== "__outro";
        const sel = S.servicos.filter((s) => ids().includes(s.id));
        const tot = sel.reduce((t, s) => t + s.preco, 0);
        $("#aResumo", m).textContent = sel.length ? `Total ${U.brl(tot)} · duração ${U.dur(dur)}` : "Marque pelo menos um serviço.";
      };
      $(".checks-serv", m).onchange = atualizarHoras;
      $("#aData", m).onchange = atualizarHoras;
      $("#aHora", m).onchange = () => { $("#aHoraLivreBox", m).hidden = $("#aHora", m).value !== "__outro"; };
      $("#aNome", m).onchange = () => {
        const c = clientes.find((x) => x.nome === $("#aNome", m).value);
        if (c && !$("#aWhats", m).value) $("#aWhats", m).value = U.foneFmt(c.whats);
      };
      atualizarHoras();
      $("#aSalvar", m).onclick = async () => {
        const nome = $("#aNome", m).value.trim();
        const whats = U.soDigitos($("#aWhats", m).value);
        const sIds = ids();
        const data = $("#aData", m).value;
        let ini = $("#aHora", m).value;
        if (ini === "__outro") ini = $("#aHoraLivre", m).value;
        if (nome.length < 2) return FL.toast("Informe o nome da cliente.", "erro");
        if (!sIds.length) return FL.toast("Marque pelo menos um serviço.", "erro");
        if (!data || !ini) return FL.toast("Escolha o dia e o horário.", "erro");
        const itens = S.servicos.filter((s) => sIds.includes(s.id)).map(({ id, nome, preco, duracao_min, tipo }) => ({ id, nome, preco, duracao_min, tipo }));
        const dur = itens.reduce((t, s) => t + s.duracao_min, 0);
        const fim = U.toMin(ini) + dur;
        if (fim > 24 * 60) return FL.toast("O atendimento passa da meia-noite. Ajuste o horário.", "erro");
        const conflito = S.ag.find((x) => x.data === data && x.id !== a.id && ATIVOS.includes(x.status) && U.sobrepoe(U.toMin(ini), fim, U.toMin(x.inicio), U.toMin(x.fim)));
        if (conflito) {
          const ok = await confirmar("Horário já ocupado", `Esse horário coincide com ${conflito.cliente_nome} (${conflito.inicio}–${conflito.fim}). Quer agendar como encaixe mesmo assim?`, "Agendar mesmo assim");
          if (!ok) return formAgendamento(novo ? null : a);
        }
        const mudouServ = novo || JSON.stringify((a.servicos || []).map((s) => s.id).sort()) !== JSON.stringify([...sIds].sort());
        const row = {
          ...(novo ? { origem: "admin", pago: false, desconto: 0 } : a),
          cliente_nome: nome, cliente_whats: whats, data, inicio: ini, fim: U.fromMin(fim),
          servicos: mudouServ ? itens : a.servicos,
          total: mudouServ ? itens.reduce((t, s) => t + s.preco, 0) : a.total,
          status: $("#aStatus", m) ? $("#aStatus", m).value : a.status,
          obs_interna: $("#aObs", m) ? $("#aObs", m).value.trim() : a.obs_interna,
        };
        try {
          const r = await api.salvar("agendamentos", row);
          if (novo) S.ag.push(r);
          else Object.assign(S.ag.find((x) => x.id === a.id), r);
          ordenarAg();
          fechar();
          S.dia = data;
          if (S.aba !== "agenda") location.hash = "agenda";
          pintarCab();
          pintar();
          FL.toast(novo ? "Agendamento criado" : "Agendamento atualizado");
        } catch (e) { err(e); }
      };
    });
  }

  /* ----- bloqueios ----- */
  function formBloqueio() {
    abrir(`
      <h2 id="mTit">Bloquear horário</h2>
      <p class="painel-dica" style="margin:4px 0 0">Para folgas, feriados, cursos ou férias. As clientes não verão esses horários.</p>
      <div class="det-bloco">
        <div class="grade-form">
          <label class="campo"><span>A partir de</span><input class="entrada" type="date" id="bData" value="${S.dia >= U.hoje() ? S.dia : U.hoje()}"></label>
          <label class="campo"><span>Até <small>(opcional, para vários dias)</small></span><input class="entrada" type="date" id="bAte"></label>
        </div>
        <div class="seg" id="bTipo"><button type="button" data-t="dia" aria-pressed="true">Dia inteiro</button><button type="button" data-t="hora" aria-pressed="false">Só um período</button></div>
        <div class="grade-form" id="bHoras" hidden>
          <label class="campo"><span>Das</span><input class="entrada" type="time" id="bIni" value="12:00" step="300"></label>
          <label class="campo"><span>Até</span><input class="entrada" type="time" id="bFim" value="14:00" step="300"></label>
        </div>
        <label class="campo"><span>Motivo <small>(só você vê)</small></span><input class="entrada" id="bMotivo" maxlength="80" placeholder="Ex.: feriado, curso, médico"></label>
      </div>
      <div class="modal-acoes"><button type="button" class="btn btn-contorno" data-fechar>Cancelar</button><button type="button" class="btn btn-laranja" id="bSalvar">Bloquear</button></div>`,
    (m) => {
      let tipo = "dia";
      $("#bTipo", m).onclick = (e) => {
        const b = e.target.closest("[data-t]");
        if (!b) return;
        tipo = b.dataset.t;
        $$("#bTipo button", m).forEach((x) => x.setAttribute("aria-pressed", x === b));
        $("#bHoras", m).hidden = tipo === "dia";
      };
      $("#bSalvar", m).onclick = async () => {
        const de = $("#bData", m).value, ate = $("#bAte", m).value || de;
        if (!de || ate < de) return FL.toast("Confira as datas.", "erro");
        const ini = tipo === "hora" ? $("#bIni", m).value : null, fim = tipo === "hora" ? $("#bFim", m).value : null;
        if (tipo === "hora" && (!ini || !fim || fim <= ini)) return FL.toast("O fim precisa ser depois do início.", "erro");
        const dias = [];
        for (let d = de; d <= ate && dias.length < 120; d = U.addDias(d, 1)) dias.push(d);
        const conflitos = S.ag.filter((x) => dias.includes(x.data) && ["pendente", "confirmado"].includes(x.status) && (!ini || U.sobrepoe(U.toMin(ini), U.toMin(fim), U.toMin(x.inicio), U.toMin(x.fim))));
        try {
          for (const d of dias) {
            const r = await api.salvar("bloqueios", { data: d, inicio: ini, fim, motivo: $("#bMotivo", m).value.trim() });
            S.bloqueios.push(r);
          }
          fechar();
          pintar();
          FL.toast(dias.length > 1 ? `${dias.length} dias bloqueados` : "Horário bloqueado");
          if (conflitos.length) setTimeout(() => FL.toast(`Atenção: ${conflitos.length} atendimento(s) já marcado(s) nesse período. Avise as clientes.`, "erro"), 600);
        } catch (e) { err(e); }
      };
    });
  }
  async function apagarBloqueio(id) {
    if (!(await confirmar("Remover bloqueio?", "O horário volta a ficar disponível para as clientes.", "Remover"))) return;
    try {
      await api.apagar("bloqueios", id);
      S.bloqueios = S.bloqueios.filter((b) => b.id !== id);
      pintar();
      FL.toast("Bloqueio removido");
    } catch (e) { err(e); }
  }

  /* =================== FINANCEIRO =================== */
  async function vFinanceiro() {
    const [y, mo] = S.finMes.split("-").map(Number);
    const de = `${S.finMes}-01`, ate = `${S.finMes}-${U.pad(new Date(y, mo, 0).getDate())}`;
    $("#corpo").innerHTML = `<div class="secao-cab"><div><p class="rotulo">Financeiro</p><h1>${U.MESES[mo - 1]} de ${y}</h1></div></div><p class="carregando">Calculando…</p>`;
    let ag, desp;
    try {
      [ag, desp] = await Promise.all([api.listar("agendamentos", { de, ate, ordem: ["data", "inicio"] }), api.listar("despesas", { de, ate, ordem: ["data"] })]);
    } catch (e) { return err(e); }
    if (S.aba !== "financeiro") return;
    const pagos = ag.filter((a) => a.pago && a.status !== "cancelado");
    const recebido = pagos.reduce((t, a) => t + recebidoDe(a), 0);
    const aReceber = ag.filter((a) => a.status === "concluido" && !a.pago).reduce((t, a) => t + valorDe(a), 0);
    const previsto = ag.filter((a) => ["pendente", "confirmado"].includes(a.status)).reduce((t, a) => t + valorDe(a), 0);
    const despTot = desp.reduce((t, d) => t + Number(d.valor), 0);
    const lucro = recebido - despTot;
    const concl = ag.filter((a) => a.status === "concluido").length;
    const faltas = ag.filter((a) => a.status === "faltou").length;
    const ticket = pagos.length ? recebido / pagos.length : 0;

    // por dia
    const nDias = new Date(y, mo, 0).getDate();
    const porDia = [...Array(nDias)].map((_, i) => {
      const iso = `${S.finMes}-${U.pad(i + 1)}`;
      return {
        d: i + 1,
        rec: pagos.filter((a) => a.data === iso).reduce((t, a) => t + recebidoDe(a), 0),
        prev: ag.filter((a) => a.data === iso && ["pendente", "confirmado"].includes(a.status)).reduce((t, a) => t + valorDe(a), 0),
      };
    });
    // por forma
    const porForma = {};
    pagos.forEach((a) => { const k = a.forma_pagamento || "outro"; porForma[k] = (porForma[k] || 0) + recebidoDe(a); });
    // por serviço
    const porServ = {};
    ag.filter((a) => a.status === "concluido").forEach((a) => (a.servicos || []).forEach((s) => {
      porServ[s.nome] = porServ[s.nome] || { q: 0, v: 0 };
      porServ[s.nome].q++;
      porServ[s.nome].v += Number(s.preco) || 0;
    }));
    const servOrd = Object.entries(porServ).sort((a, b) => b[1].v - a[1].v);
    const maxForma = Math.max(1, ...Object.values(porForma));
    const maxServ = Math.max(1, ...servOrd.map((x) => x[1].v));
    const porCat = {};
    desp.forEach((d) => { porCat[d.categoria] = (porCat[d.categoria] || 0) + Number(d.valor); });

    $("#corpo").innerHTML = `
      <div class="secao-cab">
        <div><p class="rotulo">Financeiro</p><h1>${U.MESES[mo - 1]} de ${y}</h1></div>
        <div class="acoes">
          <button class="seta" data-acao="mes-ant" aria-label="Mês anterior">‹</button>
          <button class="seta" data-acao="mes-prox" aria-label="Próximo mês">›</button>
          <button class="btn btn-contorno btn-pequeno" data-acao="exportar">Exportar planilha</button>
        </div>
      </div>
      <div class="kpis">
        <div class="kpi destaque"><span class="rotulo">Recebido</span><strong>${U.brl(recebido)}</strong><small>${pagos.length} pagamento(s)</small></div>
        <div class="kpi"><span class="rotulo">Despesas</span><strong>${U.brl(despTot)}</strong><small>${desp.length} lançamento(s)</small></div>
        <div class="kpi${lucro < 0 ? " neg" : ""}"><span class="rotulo">Lucro</span><strong>${U.brl(lucro)}</strong><small>recebido − despesas</small></div>
        <div class="kpi"><span class="rotulo">Ticket médio</span><strong>${U.brl(ticket)}</strong><small>por atendimento pago</small></div>
        <div class="kpi"><span class="rotulo">Ainda vai entrar</span><strong>${U.brl(previsto)}</strong><small>agendados e pendentes</small></div>
        <div class="kpi"><span class="rotulo">A receber</span><strong>${U.brl(aReceber)}</strong><small>atendidos sem pagamento</small></div>
        <div class="kpi"><span class="rotulo">Atendimentos</span><strong>${concl}</strong><small>concluídos no mês</small></div>
        <div class="kpi"><span class="rotulo">Faltas</span><strong>${faltas}</strong><small>não compareceram</small></div>
      </div>
      <section class="painel">
        <h2>Entradas por dia</h2>
        <div class="grafico">${graficoDias(porDia)}</div>
      </section>
      <div class="duas-col">
        <section class="painel"><h2>Por serviço</h2>
          ${servOrd.length ? `<div class="barras-h">${servOrd.map(([n, o]) => `<div class="barra-h"><div class="barra-h-top"><span>${U.esc(n)} <small style="color:var(--tinta-2)">× ${o.q}</small></span><span>${U.brl(o.v)}</span></div><div class="barra-h-trilho"><i style="width:${(o.v / maxServ) * 100}%"></i></div></div>`).join("")}</div>` : `<div class="vazio">Nenhum atendimento concluído neste mês.</div>`}
        </section>
        <section class="painel"><h2>Por forma de pagamento</h2>
          ${Object.keys(porForma).length ? `<div class="barras-h">${Object.entries(porForma).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="barra-h azul"><div class="barra-h-top"><span>${U.FORMAS[k] || "Outro"}</span><span>${U.brl(v)}</span></div><div class="barra-h-trilho"><i style="width:${(v / maxForma) * 100}%"></i></div></div>`).join("")}</div>` : `<div class="vazio">Sem pagamentos registrados.</div>`}
        </section>
      </div>
      <div class="duas-col">
        <section class="painel">
          <h2>Recebimentos</h2>
          ${pagos.length ? `<div class="tabela-box"><table><thead><tr><th>Dia</th><th>Cliente</th><th>Serviço</th><th>Forma</th><th class="n">Valor</th></tr></thead><tbody>
            ${pagos.map((a) => `<tr class="clicavel" data-acao="abrir" data-id="${a.id}"><td class="num">${U.dataCurta(a.data)}</td><td>${U.esc(a.cliente_nome)}</td><td>${U.esc(nomesServ(a))}</td><td>${U.FORMAS[a.forma_pagamento] || "—"}</td><td class="n">${U.brl(recebidoDe(a))}</td></tr>`).join("")}
          </tbody></table></div>` : `<div class="vazio">Os pagamentos aparecem aqui quando você marca um atendimento como pago.</div>`}
        </section>
        <section class="painel">
          <h2>Despesas</h2>
          <form id="fDesp" class="grade-form" novalidate>
            <label class="campo inteiro"><span>Descrição</span><input class="entrada" id="eDesc" maxlength="80" placeholder="Ex.: gel construtor, aluguel"></label>
            <label class="campo"><span>Valor</span><span class="entrada-pref"><em>R$</em><input class="entrada" id="eValor" inputmode="decimal" placeholder="0,00"></span></label>
            <label class="campo"><span>Dia</span><input class="entrada" type="date" id="eData" value="${U.hoje().startsWith(S.finMes) ? U.hoje() : de}" min="${de}" max="${ate}"></label>
            <label class="campo inteiro"><span>Categoria</span><select class="entrada" id="eCat">${CAT_DESP.map((c) => `<option>${c}</option>`).join("")}</select></label>
            <button class="btn btn-laranja inteiro" type="submit">Lançar despesa</button>
          </form>
          ${desp.length ? `<div class="lista">${desp.map((d) => `<div class="bloq"><div><strong>${U.esc(d.descricao)}</strong><small>${U.dataCurta(d.data)} · ${U.esc(d.categoria)}</small></div><div class="linha-btns"><b class="num">${U.brl(d.valor)}</b><button class="ico-btn" data-acao="del-desp" data-id="${d.id}" aria-label="Excluir despesa">${IC.lixo}</button></div></div>`).join("")}</div>
            <div class="barras-h">${Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="barra-h azul"><div class="barra-h-top"><span>${U.esc(c)}</span><span>${U.brl(v)}</span></div><div class="barra-h-trilho"><i style="width:${(v / despTot) * 100}%"></i></div></div>`).join("")}</div>` : `<div class="vazio">Nenhuma despesa lançada neste mês.</div>`}
        </section>
      </div>`;
    S._fin = { ag, desp, de, ate };
    $("#fDesp").onsubmit = async (e) => {
      e.preventDefault();
      const descricao = $("#eDesc").value.trim(), valor = U.num($("#eValor").value);
      if (!descricao || !(valor > 0)) return FL.toast("Preencha a descrição e o valor.", "erro");
      try {
        await api.salvar("despesas", { descricao, valor, data: $("#eData").value || de, categoria: $("#eCat").value });
        FL.toast("Despesa lançada");
        vFinanceiro();
      } catch (x) { err(x); }
    };
  }

  function graficoDias(dias) {
    const W = 720, H = 220, pl = 52, pr = 10, pt = 14, pb = 28;
    const max = Math.max(50, ...dias.map((d) => Math.max(d.rec, d.prev)));
    const passo = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((p) => max / p <= 4) || 10000;
    const topo = Math.ceil(max / passo) * passo;
    const y = (v) => pt + (H - pt - pb) * (1 - v / topo);
    const bw = (W - pl - pr) / dias.length;
    let g = "";
    for (let v = 0; v <= topo; v += passo) {
      g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linha)" stroke-width="1"/>`;
      g += `<text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--tinta-2)">${v >= 1000 ? (v / 1000).toLocaleString("pt-BR") + " mil" : v}</text>`;
    }
    dias.forEach((d, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
      if (d.prev) g += `<rect x="${x}" y="${y(d.prev)}" width="${w}" height="${y(0) - y(d.prev)}" rx="2" fill="none" stroke="var(--azulejo)" stroke-width="1.2" stroke-dasharray="3 2"><title>Dia ${d.d}: previsto ${U.brl(d.prev)}</title></rect>`;
      if (d.rec) g += `<rect x="${x}" y="${y(d.rec)}" width="${w}" height="${y(0) - y(d.rec)}" rx="2" fill="var(--laranja)"><title>Dia ${d.d}: recebido ${U.brl(d.rec)}</title></rect>`;
      if (d.d === 1 || d.d % 5 === 0) g += `<text x="${pl + i * bw + bw / 2}" y="${H - 9}" text-anchor="middle" font-size="11" fill="var(--tinta-2)">${d.d}</text>`;
    });
    const leg = `<g font-size="11" fill="var(--tinta-2)"><rect x="${W - 210}" y="2" width="10" height="10" rx="2" fill="var(--laranja)"/><text x="${W - 195}" y="11">Recebido</text><rect x="${W - 125}" y="2" width="10" height="10" rx="2" fill="none" stroke="var(--azulejo)" stroke-dasharray="3 2"/><text x="${W - 110}" y="11">Agendado</text></g>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Valores recebidos por dia do mês">${g}${leg}</svg>`;
  }

  function exportarCSV() {
    const f = S._fin;
    if (!f) return;
    const linhas = [["Tipo", "Data", "Cliente/Descrição", "Serviços/Categoria", "Situação", "Forma", "Valor"]];
    f.ag.forEach((a) => linhas.push(["Atendimento", a.data, a.cliente_nome, nomesServ(a), U.STATUS[a.status], U.FORMAS[a.forma_pagamento] || "", (a.pago ? recebidoDe(a) : valorDe(a)).toFixed(2).replace(".", ",")]));
    f.desp.forEach((d) => linhas.push(["Despesa", d.data, d.descricao, d.categoria, "", "", (-Number(d.valor)).toFixed(2).replace(".", ",")]));
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `flordelusa-${S.finMes}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* =================== CLIENTES =================== */
  function mapaClientes() {
    const m = new Map();
    const hoje = U.hoje();
    S.ag.forEach((a) => {
      const k = a.cliente_whats || "sem-" + a.cliente_nome.toLowerCase();
      const c = m.get(k) || { whats: a.cliente_whats, nome: a.cliente_nome, visitas: 0, gasto: 0, ultima: null, proxima: null, faltas: 0, lista: [] };
      c.nome = a.cliente_nome;
      c.lista.push(a);
      if (a.status === "concluido") { c.visitas++; if (!c.ultima || a.data > c.ultima) c.ultima = a.data; }
      if (a.status === "faltou") c.faltas++;
      c.gasto += recebidoDe(a);
      if (["pendente", "confirmado"].includes(a.status) && a.data >= hoje && (!c.proxima || a.data < c.proxima)) c.proxima = a.data;
      m.set(k, c);
    });
    return [...m.values()].sort((a, b) => (b.ultima || b.proxima || "").localeCompare(a.ultima || a.proxima || ""));
  }
  function vClientes() {
    const todas = mapaClientes();
    const q = S.busca.toLowerCase();
    const lista = q ? todas.filter((c) => c.nome.toLowerCase().includes(q) || (c.whats || "").includes(U.soDigitos(q) || "@@")) : todas;
    const sumidas = todas.filter((c) => c.ultima && !c.proxima && c.ultima <= U.addDias(U.hoje(), -30));
    $("#corpo").innerHTML = `
      <div class="secao-cab"><div><p class="rotulo">Clientes</p><h1>${todas.length} cliente${todas.length === 1 ? "" : "s"}</h1></div>
        <input class="entrada busca" id="busca" type="search" placeholder="Buscar por nome ou telefone" value="${U.esc(S.busca)}"></div>
      ${sumidas.length ? `<section class="painel"><h2>Sem voltar há mais de 30 dias · ${sumidas.length}</h2><p class="painel-dica">Boa hora para mandar uma mensagem de manutenção.</p>
        <div class="lista">${sumidas.slice(0, 8).map((c) => `<div class="bloq"><div><strong>${U.esc(c.nome)}</strong><small>Última visita ${U.dataCurta(c.ultima)} · ${c.visitas} visita(s)</small></div>
        ${c.whats ? `<a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener" href="${U.esc(U.waLink(c.whats, `Oi, ${c.nome.split(" ")[0]}! Já está na hora da manutenção 💅 Quer que eu reserve um horário pra você esta semana?`))}">${IC.whats} Chamar</a>` : ""}</div>`).join("")}</div></section>` : ""}
      <section class="painel">
        ${lista.length ? `<div class="tabela-box"><table><thead><tr><th>Cliente</th><th>WhatsApp</th><th class="n">Visitas</th><th class="n">Total gasto</th><th>Última</th><th>Próxima</th></tr></thead><tbody>
          ${lista.map((c, i) => `<tr class="clicavel" data-acao="cliente" data-i="${todas.indexOf(c)}"><td><strong>${U.esc(c.nome)}</strong>${c.faltas ? ` <span class="chip st-faltou">${c.faltas} falta(s)</span>` : ""}</td><td class="num">${U.esc(U.foneFmt(c.whats))}</td><td class="n">${c.visitas}</td><td class="n">${U.brl(c.gasto)}</td><td class="num">${c.ultima ? U.dataCurta(c.ultima) : "—"}</td><td class="num">${c.proxima ? U.dataCurta(c.proxima) : "—"}</td></tr>`).join("")}
        </tbody></table></div>` : `<div class="vazio">${q ? "Nenhuma cliente encontrada." : "As clientes aparecem aqui assim que fizerem o primeiro agendamento."}</div>`}
      </section>`;
    S._clientes = todas;
    const b = $("#busca");
    b.oninput = () => { S.busca = b.value; const pos = b.selectionStart; vClientes(); const nb = $("#busca"); nb.focus(); nb.setSelectionRange(pos, pos); };
  }
  function abrirCliente(i) {
    const c = S._clientes[i];
    if (!c) return;
    const hist = [...c.lista].sort((a, b) => (b.data + b.inicio).localeCompare(a.data + a.inicio));
    abrir(`<div class="det-topo"><div><h2 id="mTit">${U.esc(c.nome)}</h2><p class="num" style="color:var(--tinta-2)">${U.esc(U.foneFmt(c.whats))}</p></div>
      ${c.whats ? `<a class="btn btn-whats btn-pequeno" target="_blank" rel="noopener" href="${U.esc(U.waLink(c.whats, ""))}">${IC.whats} WhatsApp</a>` : ""}</div>
      <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin:14px 0">
        <div class="kpi"><span class="rotulo">Visitas</span><strong>${c.visitas}</strong></div>
        <div class="kpi"><span class="rotulo">Gasto</span><strong>${U.brl(c.gasto)}</strong></div>
        <div class="kpi"><span class="rotulo">Faltas</span><strong>${c.faltas}</strong></div>
      </div>
      <p class="rotulo">Histórico</p>
      <div class="lista" style="margin-top:8px">${hist.map((a) => `<div class="bloq"><div><strong class="num">${U.dataCurta(a.data)} · ${a.inicio}</strong><small>${U.esc(nomesServ(a))}</small></div><div class="linha-btns">${chip(a.status)}<b class="num">${U.brl(valorDe(a))}</b></div></div>`).join("")}</div>
      <div class="modal-acoes"><button class="btn btn-contorno" data-fechar>Fechar</button><button class="btn btn-laranja" id="cNovo">Agendar para ela</button></div>`,
    (m) => {
      $("#cNovo", m).onclick = () => {
        formAgendamento(null);
        $("#aNome").value = c.nome;
        $("#aWhats").value = U.foneFmt(c.whats);
      };
    });
  }

  /* =================== SERVIÇOS =================== */
  function vServicos() {
    const lista = [...S.servicos].sort((a, b) => a.ordem - b.ordem);
    $("#corpo").innerHTML = `
      <div class="secao-cab"><div><p class="rotulo">Serviços e valores</p><h1>${lista.filter((s) => s.ativo).length} serviços no site</h1></div>
        <div class="acoes"><button class="btn btn-laranja" data-acao="novo-serv">+ Novo serviço</button></div></div>
      <p class="painel-dica" style="margin:0">As mudanças salvam sozinhas e aparecem no site na hora. Agendamentos já feitos mantêm o valor da época.</p>
      <div class="duas-col">
        <section class="serv-lista" id="servLista">
          ${lista.map((s, i) => `
          <div class="serv-item${s.ativo ? "" : " inativo"}" data-id="${s.id}">
            <div class="serv-nome">
              <input class="entrada" data-f="nome" value="${U.esc(s.nome)}" maxlength="60" aria-label="Nome do serviço">
              <div class="serv-tags">
                <select class="entrada" data-f="tipo" style="min-height:32px;padding:4px 8px;width:auto" aria-label="Tipo"><option value="principal" ${s.tipo !== "extra" ? "selected" : ""}>Principal</option><option value="extra" ${s.tipo === "extra" ? "selected" : ""}>Complemento</option></select>
                <input class="entrada" data-f="categoria" value="${U.esc(s.categoria)}" maxlength="30" style="min-height:32px;padding:4px 8px;width:140px" aria-label="Categoria">
                <label class="check" style="align-items:center"><input type="checkbox" data-f="ativo" ${s.ativo ? "checked" : ""}><span>No site</span></label>
              </div>
              <input class="entrada" data-f="descricao" value="${U.esc(s.descricao || "")}" maxlength="140" placeholder="Descrição curta (opcional)" aria-label="Descrição" style="min-height:38px;font-size:.9rem">
            </div>
            <label class="campo"><span>Valor</span><span class="entrada-pref"><em>R$</em><input class="entrada" data-f="preco" inputmode="decimal" value="${Number(s.preco).toFixed(2).replace(".", ",")}"></span></label>
            <label class="campo"><span>Duração</span><span class="entrada-suf"><input class="entrada" data-f="duracao_min" inputmode="numeric" value="${s.duracao_min}"><em>min</em></span></label>
            <div class="linha-btns serv-btns">
              <button class="ico-btn" data-acao="serv-sobe" data-id="${s.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir">${IC.cima}</button>
              <button class="ico-btn" data-acao="serv-desce" data-id="${s.id}" ${i === lista.length - 1 ? "disabled" : ""} aria-label="Descer">${IC.baixo}</button>
              <button class="ico-btn" data-acao="serv-del" data-id="${s.id}" aria-label="Excluir serviço">${IC.lixo}</button>
            </div>
          </div>`).join("") || `<div class="vazio">Nenhum serviço cadastrado.</div>`}
        </section>
        <aside class="painel">
          <h2>Reajustar valores</h2>
          <p class="painel-dica">Aplica um aumento ou desconto em vários serviços de uma vez.</p>
          <div class="grade-form">
            <label class="campo"><span>Percentual</span><span class="entrada-suf"><input class="entrada" id="rPct" inputmode="decimal" value="10"><em>%</em></span></label>
            <label class="campo"><span>Aplicar em</span><select class="entrada" id="rAlvo"><option value="todos">Todos</option><option value="principal">Só principais</option><option value="extra">Só complementos</option></select></label>
            <label class="campo inteiro"><span>Arredondar para</span><select class="entrada" id="rArr"><option value="1">R$ 1,00 mais próximo</option><option value="5">R$ 5,00 mais próximo</option><option value="0.5">R$ 0,50 mais próximo</option><option value="0">Não arredondar</option></select></label>
          </div>
          <p class="painel-dica" style="margin:0">Use número negativo para baixar os preços (ex.: −10).</p>
          <button class="btn btn-contorno" data-acao="reajustar">Ver prévia do reajuste</button>
        </aside>
      </div>`;
    $("#servLista").addEventListener("change", salvarCampoServ);
  }
  async function salvarCampoServ(e) {
    const el = e.target.closest("[data-f]");
    if (!el) return;
    const item = el.closest(".serv-item");
    const s = S.servicos.find((x) => x.id === item.dataset.id);
    const f = el.dataset.f;
    let v = el.type === "checkbox" ? el.checked : el.value.trim();
    if (f === "preco") { v = U.num(v); if (!(v >= 0)) return FL.toast("Valor inválido.", "erro"); el.value = v.toFixed(2).replace(".", ","); }
    if (f === "duracao_min") { v = Math.round(U.num(v)); if (!(v >= 5 && v <= 600)) { el.value = s.duracao_min; return FL.toast("A duração precisa ficar entre 5 e 600 minutos.", "erro"); } }
    if (f === "nome" && !v) { el.value = s.nome; return FL.toast("O nome não pode ficar vazio.", "erro"); }
    try {
      const r = await api.salvar("servicos", { ...s, [f]: v });
      Object.assign(s, r);
      if (f === "ativo") item.classList.toggle("inativo", !v);
      FL.toast(f === "preco" ? `${s.nome}: ${U.brl(v)}` : "Salvo");
    } catch (x) { err(x); }
  }
  async function novoServico() {
    try {
      const ordem = Math.max(0, ...S.servicos.map((s) => s.ordem)) + 1;
      const r = await api.salvar("servicos", { nome: "Novo serviço", categoria: "Manicure", tipo: "principal", preco: 0, duracao_min: 60, ativo: false, ordem, descricao: "" });
      S.servicos.push(r);
      vServicos();
      const ult = $$("#servLista .serv-item").pop();
      if (ult) { ult.scrollIntoView({ block: "center" }); $("[data-f=nome]", ult).select(); }
      FL.toast("Serviço criado. Defina nome e valor e marque “No site”.");
    } catch (e) { err(e); }
  }
  async function moverServ(id, dir) {
    const lista = [...S.servicos].sort((a, b) => a.ordem - b.ordem);
    const i = lista.findIndex((s) => s.id === id), j = i + dir;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    lista.forEach((s, k) => (s.ordem = k + 1));
    try {
      await api.salvarVarios("servicos", [lista[i], lista[j]]);
      vServicos();
    } catch (e) { err(e); }
  }
  async function apagarServ(id) {
    const s = S.servicos.find((x) => x.id === id);
    if (!(await confirmar(`Excluir “${s.nome}”?`, "Ele sai do site e do painel. Agendamentos antigos continuam com o registro. Se for só pausar, desmarque “No site”.", "Excluir", true))) return;
    try {
      await api.apagar("servicos", id);
      S.servicos = S.servicos.filter((x) => x.id !== id);
      vServicos();
      FL.toast("Serviço excluído");
    } catch (e) { err(e); }
  }
  async function reajustar() {
    const pct = U.num($("#rPct").value), alvo = $("#rAlvo").value, arr = Number($("#rArr").value);
    if (!pct || pct < -90 || pct > 300) return FL.toast("Informe um percentual entre −90 e 300.", "erro");
    const lista = S.servicos.filter((s) => alvo === "todos" || (alvo === "extra" ? s.tipo === "extra" : s.tipo !== "extra"));
    const novos = lista.map((s) => {
      let p = s.preco * (1 + pct / 100);
      if (arr) p = Math.round(p / arr) * arr;
      return { s, p: Math.max(0, Math.round(p * 100) / 100) };
    });
    abrir(`<h2 id="mTit">Reajuste de ${pct > 0 ? "+" : ""}${String(pct).replace(".", ",")}%</h2>
      <div class="tabela-box" style="margin-top:12px"><table><thead><tr><th>Serviço</th><th class="n">Hoje</th><th class="n">Novo</th></tr></thead><tbody>
      ${novos.map((n) => `<tr><td>${U.esc(n.s.nome)}</td><td class="n">${U.brl(n.s.preco)}</td><td class="n"><b>${U.brl(n.p)}</b></td></tr>`).join("")}</tbody></table></div>
      <div class="modal-acoes"><button class="btn btn-contorno" data-fechar>Cancelar</button><button class="btn btn-laranja" id="rOk">Aplicar novos valores</button></div>`,
    (m) => {
      $("#rOk", m).onclick = async () => {
        try {
          const r = await api.salvarVarios("servicos", novos.map((n) => ({ ...n.s, preco: n.p })));
          r.forEach((x) => Object.assign(S.servicos.find((s) => s.id === x.id), x));
          fechar();
          vServicos();
          FL.toast(`${r.length} valores atualizados`);
        } catch (e) { err(e); }
      };
    });
  }

  /* =================== HORÁRIOS =================== */
  function vHorarios() {
    const c = S.config;
    const futuros = S.bloqueios.filter((b) => b.data >= U.hoje()).sort((a, b) => (a.data + (a.inicio || "")).localeCompare(b.data + (b.inicio || "")));
    const opt = (lista, v, fmt) => lista.map((x) => `<option value="${x}" ${Number(v) === x ? "selected" : ""}>${fmt(x)}</option>`).join("");
    $("#corpo").innerHTML = `
      <div class="secao-cab"><div><p class="rotulo">Horários</p><h1>Expediente e folgas</h1></div>
        <div class="acoes"><button class="btn btn-laranja" data-acao="bloquear">Bloquear dia ou horário</button></div></div>
      <div class="duas-col">
        <section class="painel">
          <h2>Dias de atendimento</h2>
          <p class="painel-dica">Salva sozinho. Deixe a pausa em branco se não houver intervalo.</p>
          <div class="hor-lista" id="horLista">
            ${[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = S.horarios.find((x) => x.dia_semana === d) || { dia_semana: d, aberto: false, inicio: "08:00", fim: "18:00" };
              return `<div class="hor-item${h.aberto ? "" : " fechado"}" data-d="${d}">
                <label class="check" style="align-items:center"><input type="checkbox" data-h="aberto" ${h.aberto ? "checked" : ""}><strong>${U.DIAS[d]}</strong></label>
                <div class="hor-campos">
                  <label class="mini">Abre<input class="entrada" type="time" step="300" data-h="inicio" value="${h.inicio || ""}"></label>
                  <label class="mini">Fecha<input class="entrada" type="time" step="300" data-h="fim" value="${h.fim || ""}"></label>
                  <label class="mini">Pausa de<input class="entrada" type="time" step="300" data-h="pausa_inicio" value="${h.pausa_inicio || ""}"></label>
                  <label class="mini">até<input class="entrada" type="time" step="300" data-h="pausa_fim" value="${h.pausa_fim || ""}"></label>
                </div>
              </div>`;
            }).join("")}
          </div>
        </section>
        <aside class="painel">
          <h2>Regras da agenda</h2>
          <label class="campo"><span>Mostrar horários a cada</span><select class="entrada" data-c="intervalo_min">${opt([15, 20, 30, 45, 60], c.intervalo_min, (x) => x + " minutos")}</select></label>
          <label class="campo"><span>Antecedência mínima para agendar</span><select class="entrada" data-c="antecedencia_horas">${opt([0, 1, 2, 3, 4, 6, 12, 24, 48], c.antecedencia_horas, (x) => (x ? x + (x === 1 ? " hora" : " horas") : "Sem antecedência"))}</select></label>
          <label class="campo"><span>Liberar agenda para os próximos</span><select class="entrada" data-c="janela_dias">${opt([7, 14, 21, 30, 45, 60, 90], c.janela_dias, (x) => x + " dias")}</select></label>
          <h2 style="margin-top:8px">Bloqueios marcados</h2>
          ${futuros.length ? `<div class="lista">${futuros.map(cartaoBloq).join("")}</div>` : `<div class="vazio">Nenhuma folga ou bloqueio programado.</div>`}
        </aside>
      </div>`;
    $("#horLista").addEventListener("change", salvarHorario);
    $$("[data-c]").forEach((el) => (el.onchange = async () => {
      try {
        S.config = await api.salvarConfig({ [el.dataset.c]: Number(el.value) });
        FL.toast("Regra salva");
      } catch (e) { err(e); }
    }));
  }
  async function salvarHorario(e) {
    const item = e.target.closest(".hor-item");
    const d = Number(item.dataset.d);
    const v = (k) => $(`[data-h=${k}]`, item).value || null;
    const row = { dia_semana: d, aberto: $("[data-h=aberto]", item).checked, inicio: v("inicio") || "08:00", fim: v("fim") || "18:00", pausa_inicio: v("pausa_inicio"), pausa_fim: v("pausa_fim") };
    item.classList.toggle("fechado", !row.aberto);
    if (row.fim <= row.inicio) return FL.toast("O horário de fechar precisa ser depois do de abrir.", "erro");
    if (!!row.pausa_inicio !== !!row.pausa_fim) return; // espera preencher os dois
    if (row.pausa_inicio && (row.pausa_fim <= row.pausa_inicio || row.pausa_inicio < row.inicio || row.pausa_fim > row.fim)) return FL.toast("A pausa precisa ficar dentro do expediente.", "erro");
    try {
      const r = await api.salvar("horarios", row);
      const i = S.horarios.findIndex((h) => h.dia_semana === d);
      if (i >= 0) S.horarios[i] = r; else S.horarios.push(r);
      FL.toast(`${U.DIAS[d]} salvo`);
    } catch (x) { err(x); }
  }

  /* =================== AJUSTES =================== */
  function vAjustes() {
    const c = S.config;
    const base = location.href.replace(/admin\/?(index\.html)?(#.*)?$/, "").replace(/#.*$/, "");
    const campo = (k, rot, attrs = "", dica = "") => `<label class="campo"><span>${rot}</span><input class="entrada" data-k="${k}" value="${U.esc(c[k] ?? "")}" ${attrs}>${dica ? `<small>${dica}</small>` : ""}</label>`;
    $("#corpo").innerHTML = `
      <div class="secao-cab"><div><p class="rotulo">Ajustes</p><h1>Estúdio e agenda</h1></div></div>
      <div class="duas-col">
        <div style="display:grid;gap:20px;min-width:0">
          <section class="painel">
            <h2>Abrir ou fechar a agenda</h2>
            <p class="painel-dica">Com a agenda fechada, as clientes veem a mensagem abaixo e um botão para o WhatsApp.</p>
            <div class="linha-btns"><span class="chip ${c.agenda_aberta ? "st-concluido" : "st-faltou"}">${c.agenda_aberta ? "Aberta" : "Fechada"}</span>
              <button class="btn ${c.agenda_aberta ? "btn-contorno" : "btn-laranja"} btn-pequeno" data-acao="tog-agenda">${c.agenda_aberta ? "Fechar agenda" : "Abrir agenda"}</button></div>
            <label class="campo"><span>Mensagem de agenda fechada</span><textarea class="entrada" data-k="msg_fechada" maxlength="300">${U.esc(c.msg_fechada || "")}</textarea></label>
          </section>
          <section class="painel">
            <h2>Dados do estúdio</h2>
            <div class="grade-form">
              ${campo("nome", "Nome do estúdio", 'maxlength="60"')}
              ${campo("profissional", "Nome da profissional", 'maxlength="60"')}
              ${campo("whatsapp", "WhatsApp que recebe os agendamentos", 'inputmode="tel" maxlength="20" placeholder="(37) 99999-9999"', "Com DDD. É para onde a cliente é levada.")}
              ${campo("instagram", "Instagram", 'maxlength="60" placeholder="flordelusastudio"', "Sem o @")}
              <div class="inteiro">${campo("endereco", "Endereço", 'maxlength="140" placeholder="Rua, número, bairro, cidade"')}</div>
              <div class="inteiro">${campo("maps_url", "Link do Google Maps (opcional)", 'maxlength="300" placeholder="https://maps.app.goo.gl/…"')}</div>
              <label class="campo inteiro"><span>Sobre o estúdio</span><textarea class="entrada" data-k="sobre" maxlength="600">${U.esc(c.sobre || "")}</textarea></label>
              <label class="campo inteiro"><span>Políticas do atendimento</span><textarea class="entrada" data-k="politicas" maxlength="2000" style="min-height:150px">${U.esc(c.politicas || "")}</textarea><small>Uma regra por linha. A cliente precisa aceitar antes de enviar.</small></label>
            </div>
          </section>
          <section class="painel">
            <h2>Sinal via Pix</h2>
            <p class="painel-dica">Se preencher, a cliente vê a chave Pix e o valor do sinal logo depois de solicitar. Deixe o valor em 0 para não cobrar sinal.</p>
            <div class="grade-form">
              <label class="campo"><span>Valor do sinal</span><span class="entrada-pref"><em>R$</em><input class="entrada" data-k="sinal_valor" inputmode="decimal" value="${String(c.sinal_valor || 0).replace(".", ",")}"></span></label>
              ${campo("pix_chave", "Chave Pix", 'maxlength="120"')}
              <div class="inteiro">${campo("pix_nome", "Nome que aparece no Pix", 'maxlength="80"')}</div>
            </div>
          </section>
          <button class="btn btn-laranja" data-acao="salvar-ajustes">Salvar alterações</button>
        </div>
        <aside style="display:grid;gap:20px;min-width:0">
          <section class="painel">
            <h2>Seus links</h2>
            <label class="campo"><span>Link para as clientes</span><div class="link-copia"><code id="linkCli">${U.esc(base)}</code><button class="btn btn-contorno btn-pequeno" data-acao="copiar" data-alvo="linkCli">Copiar</button></div><small>Coloque na bio do Instagram e no status do WhatsApp.</small></label>
            <label class="campo"><span>Link do painel (só seu)</span><div class="link-copia"><code id="linkAdm">${U.esc(base + "admin")}</code><button class="btn btn-contorno btn-pequeno" data-acao="copiar" data-alvo="linkAdm">Copiar</button></div></label>
          </section>
          <section class="painel">
            <h2>Trocar senha</h2>
            <label class="campo"><span>Nova senha</span><input class="entrada" type="password" id="s1" autocomplete="new-password" minlength="8"></label>
            <label class="campo"><span>Repita a nova senha</span><input class="entrada" type="password" id="s2" autocomplete="new-password"></label>
            <button class="btn btn-contorno" data-acao="trocar-senha">Trocar senha</button>
          </section>
          ${FL.modoDemo ? `<section class="painel"><h2>Demonstração</h2><p class="painel-dica">Volta os dados de exemplo ao estado inicial.</p><button class="btn btn-contorno" data-acao="reset-demo">Restaurar exemplos</button></section>` : ""}
        </aside>
      </div>`;
  }
  async function salvarAjustes() {
    const patch = {};
    $$("[data-k]").forEach((el) => {
      const k = el.dataset.k;
      let v = el.value.trim();
      if (k === "sinal_valor") v = U.num(v);
      if (k === "whatsapp") v = U.soDigitos(v);
      if (k === "instagram") v = v.replace(/^@/, "");
      patch[k] = v;
    });
    if (patch.whatsapp && (patch.whatsapp.replace(/^55/, "").length < 10)) return FL.toast("O WhatsApp precisa ter DDD + número.", "erro");
    if (patch.sinal_valor > 0 && !patch.pix_chave) return FL.toast("Para cobrar sinal, informe a chave Pix.", "erro");
    try {
      S.config = await api.salvarConfig(patch);
      pintarCab();
      FL.toast("Ajustes salvos. O site já está atualizado.");
    } catch (e) { err(e); }
  }

  /* =================== eventos =================== */
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.matches("[data-fundo]") || t.closest("[data-fechar]")) return fechar();
    const el = t.closest("[data-acao]");
    if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.acao) {
      case "novo": return formAgendamento(null);
      case "bloquear": return formBloqueio();
      case "del-bloq": return apagarBloqueio(id);
      case "abrir": return abrirAtend(id);
      case "confirmar": return mudarStatus(id, "confirmado"); // o link do WhatsApp abre junto
      case "confirmar-so": return mudarStatus(id, "confirmado");
      case "recusar": return mudarStatus(id, "cancelado");
      case "dia-ant": S.dia = U.addDias(S.dia, -1); return vAgenda();
      case "dia-prox": S.dia = U.addDias(S.dia, 1); return vAgenda();
      case "dia-hoje": S.dia = U.hoje(); return vAgenda();
      case "atualizar":
        try { await recarregarAg(); vAgenda(); FL.toast("Agenda atualizada"); } catch (x) { err(x); }
        return;
      case "mes-ant": case "mes-prox": {
        const [y, m] = S.finMes.split("-").map(Number);
        const d = new Date(y, m - 1 + (el.dataset.acao === "mes-ant" ? -1 : 1), 1);
        S.finMes = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
        return vFinanceiro();
      }
      case "exportar": return exportarCSV();
      case "del-desp":
        if (!(await confirmar("Excluir despesa?", "Ela sai do cálculo do mês.", "Excluir", true))) return;
        try { await api.apagar("despesas", id); vFinanceiro(); FL.toast("Despesa excluída"); } catch (x) { err(x); }
        return;
      case "cliente": return abrirCliente(Number(el.dataset.i));
      case "novo-serv": return novoServico();
      case "serv-sobe": return moverServ(id, -1);
      case "serv-desce": return moverServ(id, 1);
      case "serv-del": return apagarServ(id);
      case "reajustar": return reajustar();
      case "tog-agenda": return $("#togAgenda").click();
      case "salvar-ajustes": return salvarAjustes();
      case "copiar": {
        const txt = $("#" + el.dataset.alvo).textContent;
        try { await navigator.clipboard.writeText(txt); FL.toast("Link copiado"); }
        catch (x) { const r = document.createRange(); r.selectNodeContents($("#" + el.dataset.alvo)); getSelection().removeAllRanges(); getSelection().addRange(r); FL.toast("Selecione e copie o link"); }
        return;
      }
      case "trocar-senha": {
        const a = $("#s1").value, b = $("#s2").value;
        if (a.length < 8) return FL.toast("Use pelo menos 8 caracteres.", "erro");
        if (a !== b) return FL.toast("As senhas não são iguais.", "erro");
        try { await api.trocarSenha(a); $("#s1").value = $("#s2").value = ""; FL.toast("Senha trocada"); } catch (x) { err(x); }
        return;
      }
      case "reset-demo":
        if (!(await confirmar("Restaurar exemplos?", "Tudo o que você testou no modo demonstração será apagado.", "Restaurar", true))) return;
        await api.resetarDemo();
        await carregarTudo();
        pintar();
        return FL.toast("Exemplos restaurados");
    }
  });
  document.addEventListener("click", (e) => {
    const d = e.target.closest(".sem-dia");
    if (d) { S.dia = d.dataset.dia; vAgenda(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#modais").innerHTML) fechar(); });

  iniciar();
})();
