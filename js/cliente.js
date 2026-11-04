/* Flor de Lusa Studio · página de agendamento da cliente */
(function () {
  const { u: U, api } = FL;
  const $ = (s) => document.querySelector(s);
  const st = {
    config: {}, servicos: [], horarios: [], bloqueios: [],
    sel: new Set(), data: null, hora: null, mes: null, ocupados: {}, enviando: false,
  };
  const LS = "flordelusa_cliente";
  const ICON = {
    local: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
    insta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7.3A4.7 4.7 0 1 0 16.7 12 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 3-3 3 3 0 0 1-3 3Zm6-7.9a1.1 1.1 0 1 1-1.1-1.1A1.1 1.1 0 0 1 18 7.1ZM21 7a5.5 5.5 0 0 0-1.5-3.9A5.5 5.5 0 0 0 15.6 1.6C14 1.5 10 1.5 8.4 1.6A5.5 5.5 0 0 0 4.5 3.1 5.5 5.5 0 0 0 3 7c-.1 1.6-.1 6.4 0 8a5.5 5.5 0 0 0 1.5 3.9 5.5 5.5 0 0 0 3.9 1.5c1.6.1 5.6.1 7.2 0a5.5 5.5 0 0 0 3.9-1.5A5.5 5.5 0 0 0 21 15c.1-1.6.1-6.4 0-8Zm-2.1 9.8a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.2.4s-4 .1-5.2-.4a3 3 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.2s-.1-4 .4-5.2a3 3 0 0 1 1.7-1.7c1.2-.5 4-.4 5.2-.4s4-.1 5.2.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.2s.1 4-.4 5.2Z"/></svg>',
    hora: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7Z"/></svg>',
    whats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  /* ---------------- carregamento ---------------- */
  async function iniciar() {
    $("#avisoDemo").hidden = !FL.modoDemo;
    if (FL.modoDemo && window.FL_CONFIG && window.FL_CONFIG.supabaseUrl) {
      $("#avisoDemo").innerHTML = "<strong>Não foi possível conectar ao servidor.</strong> Verifique sua internet e recarregue a página.";
    }
    try {
      const d = await api.carregarPublico();
      Object.assign(st, d);
    } catch (e) {
      $("#listaPrincipais").innerHTML = `<div class="vazio">Não foi possível carregar a agenda agora. Recarregue a página em instantes.</div>`;
      return;
    }
    const hoje = U.parse(U.hoje());
    st.mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
    try {
      const salvo = JSON.parse(localStorage.getItem(LS) || "{}");
      if (salvo.nome) $("#fNome").value = salvo.nome;
      if (salvo.whats) $("#fWhats").value = salvo.whats;
    } catch (e) {}
    pintarInfo();
    pintarServicos();
    pintarCalendario();
    pintarHoras();
    atualizarBarra();
  }

  /* ---------------- topo / sobre / rodapé ---------------- */
  function pintarInfo() {
    const c = st.config;
    document.title = c.nome || "Flor de Lusa Studio";
    $("#rodapeNome").textContent = c.nome || "Flor de Lusa Studio";
    const itens = [];
    if (c.endereco) {
      const link = c.maps_url || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.endereco);
      itens.push(`<li>${ICON.local}<a href="${U.esc(link)}" target="_blank" rel="noopener">${U.esc(c.endereco)}</a></li>`);
    }
    const abertos = st.horarios.filter((h) => h.aberto);
    if (abertos.length) {
      const dias = abertos.map((h) => U.DIAS_CURTO[h.dia_semana]);
      const txt = dias.length > 2 && sequencia(abertos.map((h) => h.dia_semana)) ? `${dias[0]} a ${dias[dias.length - 1]}` : dias.join(", ");
      itens.push(`<li>${ICON.hora}<span>${txt}</span></li>`);
    }
    if (c.instagram) {
      const ig = c.instagram.replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/.*$/, "");
      itens.push(`<li>${ICON.insta}<a href="https://instagram.com/${U.esc(ig)}" target="_blank" rel="noopener">@${U.esc(ig)}</a></li>`);
    }
    if (c.whatsapp) {
      itens.push(`<li>${ICON.whats}<span>${U.esc(U.foneFmt(c.whatsapp))}</span></li>`);
      const a = $("#topoWhats");
      a.href = U.waLink(c.whatsapp, "Olá! Vim pelo site de agendamento e gostaria de tirar uma dúvida.");
      a.hidden = false;
    }
    $("#info").innerHTML = itens.join("");
    $("#sobreTxt").textContent = c.sobre || "";
    $("#polTxt").textContent = c.politicas || "";
    $("#polBloco").hidden = !c.politicas;
    $("#rodapeInfo").textContent = [c.endereco, c.whatsapp ? U.foneFmt(c.whatsapp) : ""].filter(Boolean).join(" · ");

    const fechada = !c.agenda_aberta;
    const av = $("#avisoFechada");
    av.hidden = !fechada;
    if (fechada) {
      av.innerHTML = `<strong>Agenda fechada no momento</strong><p>${U.esc(c.msg_fechada || "")}</p>` +
        (c.whatsapp ? `<div><a class="btn btn-whats" target="_blank" rel="noopener" href="${U.esc(U.waLink(c.whatsapp, "Olá! Vi que a agenda está fechada. Tem alguma vaga disponível?"))}">${ICON.whats} Chamar no WhatsApp</a></div>` : "");
      document.querySelectorAll(".etapa").forEach((e) => e.classList.add("travada"));
    }
  }
  function sequencia(arr) {
    for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1] + 1) return false;
    return true;
  }

  /* ---------------- serviços ---------------- */
  function cartao(s) {
    return `<button type="button" class="servico" data-id="${s.id}" aria-pressed="${st.sel.has(s.id)}">
      <span class="servico-marca" aria-hidden="true"></span>
      <span class="servico-txt">
        <span class="servico-nome">${U.esc(s.nome)}</span>
        ${s.descricao ? `<span class="servico-desc">${U.esc(s.descricao)}</span>` : ""}
        <span class="servico-meta">${U.dur(s.duracao_min)}</span>
      </span>
      <span class="servico-preco num">${U.brl(s.preco)}</span>
    </button>`;
  }
  function pintarServicos() {
    const pr = st.servicos.filter((s) => s.tipo !== "extra");
    const ex = st.servicos.filter((s) => s.tipo === "extra");
    $("#listaPrincipais").innerHTML = pr.length ? pr.map(cartao).join("") : `<div class="vazio">Nenhum serviço disponível no momento.</div>`;
    $("#listaExtras").innerHTML = ex.map(cartao).join("");
    $("#blocoExtras").hidden = !ex.length;
  }
  function alternarServico(id) {
    if (!st.config.agenda_aberta) return;
    const s = st.servicos.find((x) => x.id === id);
    if (!s) return;
    if (st.sel.has(id)) st.sel.delete(id);
    else {
      // apenas um serviço principal por vez; extras somam
      if (s.tipo !== "extra") st.servicos.filter((x) => x.tipo !== "extra").forEach((x) => st.sel.delete(x.id));
      st.sel.add(id);
    }
    document.querySelectorAll(".servico").forEach((b) => b.setAttribute("aria-pressed", st.sel.has(b.dataset.id)));
    st.hora = null;
    pintarHoras();
    atualizarBarra();
  }
  const escolhidos = () => st.servicos.filter((s) => st.sel.has(s.id));
  const duracao = () => escolhidos().reduce((a, s) => a + s.duracao_min, 0);
  const total = () => escolhidos().reduce((a, s) => a + s.preco, 0);
  /* qualquer serviço vale, inclusive só complementos (ex.: remoção avulsa) */
  const temPrincipal = () => escolhidos().length > 0;

  /* ---------------- calendário ---------------- */
  function diaDisponivel(iso) {
    const hoje = U.hoje();
    if (iso < hoje || iso > U.addDias(hoje, Number(st.config.janela_dias) || 45)) return false;
    const h = st.horarios.find((x) => x.dia_semana === U.parse(iso).getDay());
    if (!h || !h.aberto) return false;
    if (st.bloqueios.some((b) => b.data === iso && !b.inicio)) return false;
    return true;
  }
  function pintarCalendario() {
    const m = st.mes, ano = m.getFullYear(), mes = m.getMonth();
    $("#calMes").textContent = `${U.MESES[mes]} ${ano}`;
    const hoje = U.parse(U.hoje());
    const limite = U.parse(U.addDias(U.hoje(), Number(st.config.janela_dias) || 45));
    $("#calAnt").disabled = ano === hoje.getFullYear() && mes === hoje.getMonth();
    $("#calProx").disabled = ano > limite.getFullYear() || (ano === limite.getFullYear() && mes >= limite.getMonth());
    const primeiro = new Date(ano, mes, 1, 12).getDay();
    const nDias = new Date(ano, mes + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < primeiro; i++) html += `<span class="dia-vazio"></span>`;
    for (let d = 1; d <= nDias; d++) {
      const iso = `${ano}-${U.pad(mes + 1)}-${U.pad(d)}`;
      const ok = diaDisponivel(iso) && st.config.agenda_aberta;
      html += `<button type="button" class="dia${iso === U.hoje() ? " hoje" : ""}" data-iso="${iso}" ${ok ? "" : "disabled"} aria-pressed="${st.data === iso}" aria-label="${U.dataLonga(iso)}${ok ? "" : ", sem atendimento"}">${d}</button>`;
    }
    $("#calGrade").innerHTML = html;
  }
  async function escolherData(iso) {
    st.data = iso;
    st.hora = null;
    document.querySelectorAll(".dia").forEach((b) => b.setAttribute("aria-pressed", b.dataset.iso === iso));
    atualizarBarra();
    await pintarHoras(true);
    if (st.sel.size) rolarPara("#etapaHora");
  }

  /* ---------------- horários ---------------- */
  async function pintarHoras(buscar) {
    const box = $("#horas"), dica = $("#dicaHora");
    if (!st.config.agenda_aberta) { box.innerHTML = ""; return; }
    if (!temPrincipal()) {
      dica.textContent = "Escolha o serviço e o dia para ver os horários.";
      box.innerHTML = "";
      return;
    }
    if (!st.data) {
      dica.textContent = "Agora escolha o dia no calendário.";
      box.innerHTML = "";
      return;
    }
    dica.textContent = `${U.dataLonga(st.data)} · atendimento de ${U.dur(duracao())}`;
    if (buscar || !st.ocupados[st.data]) {
      box.innerHTML = `<p class="carregando">Buscando horários livres…</p>`;
      try {
        st.ocupados[st.data] = await api.ocupados(st.data);
      } catch (e) {
        box.innerHTML = `<div class="vazio">Não foi possível carregar os horários. Tente de novo.</div>`;
        return;
      }
    }
    const lista = FL.gerarHorarios({
      data: st.data, duracao: duracao(),
      horario: st.horarios.find((h) => h.dia_semana === U.parse(st.data).getDay()),
      ocupados: st.ocupados[st.data] || [], bloqueios: st.bloqueios, config: st.config,
    });
    const livres = lista.filter((h) => h.livre);
    if (!livres.length) {
      box.innerHTML = `<div class="vazio">Sem horários livres para ${U.dur(duracao())} neste dia. Tente outra data${st.config.whatsapp ? " ou chame no WhatsApp" : ""}.</div>`;
      return;
    }
    if (st.hora && !livres.some((h) => h.hora === st.hora)) st.hora = null;
    box.innerHTML = lista
      .map((h) => `<button type="button" class="hora" data-hora="${h.hora}" ${h.livre ? "" : "disabled"} aria-pressed="${st.hora === h.hora}" aria-label="${h.hora}${h.livre ? "" : ", indisponível"}">${h.hora}</button>`)
      .join("");
  }
  function escolherHora(h) {
    st.hora = h;
    document.querySelectorAll(".hora").forEach((b) => b.setAttribute("aria-pressed", b.dataset.hora === h));
    atualizarBarra();
    rolarPara("#etapaDados");
  }

  /* ---------------- barra de resumo ---------------- */
  function atualizarBarra() {
    const t = $("#barraResumo"), b = $("#barraBtn");
    const c = st.config;
    ["#etapaServicos", "#etapaData", "#etapaHora"].forEach((s, i) => $(s).classList.toggle("feita", [temPrincipal(), !!st.data, !!st.hora][i]));
    if (!c.agenda_aberta) {
      t.innerHTML = `<span class="barra-titulo">Agenda fechada</span><span class="barra-sub">Fale direto com a profissional</span>`;
      b.textContent = "WhatsApp";
      b.disabled = !c.whatsapp;
      b.dataset.acao = "whats";
      return;
    }
    const sel = escolhidos();
    if (!sel.length) {
      t.innerHTML = `<span class="barra-titulo">Nenhum serviço escolhido</span><span class="barra-sub">Comece pelo passo 1</span>`;
      b.textContent = "Continuar";
      b.disabled = true;
      return;
    }
    const quando = st.data ? ` · ${U.dataCurta(st.data)}${st.hora ? " às " + st.hora : ""}` : "";
    t.innerHTML = `<span class="barra-titulo">${U.esc(sel.map((s) => s.nome).join(" + "))}</span><span class="barra-sub">${U.brl(total())} · ${U.dur(duracao())}${quando}</span>`;
    b.disabled = false;
    if (!temPrincipal()) { b.textContent = "Escolher serviço"; b.dataset.acao = "servico"; }
    else if (!st.data) { b.textContent = "Escolher dia"; b.dataset.acao = "data"; }
    else if (!st.hora) { b.textContent = "Escolher horário"; b.dataset.acao = "hora"; }
    else { b.textContent = "Solicitar"; b.dataset.acao = "enviar"; }
  }
  function rolarPara(sel) {
    const el = $(sel);
    if (!el) return;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
  }

  /* ---------------- envio ---------------- */
  function erroForm(msg) {
    const e = $("#erroForm");
    e.textContent = msg;
    e.hidden = !msg;
    if (msg) rolarPara("#etapaDados");
  }
  async function enviar() {
    if (st.enviando) return;
    const nome = $("#fNome").value.trim();
    const whats = U.soDigitos($("#fWhats").value);
    if (nome.length < 2) return erroForm("Informe seu nome."), $("#fNome").focus();
    if (whats.length < 10 || whats.length > 11) return erroForm("Informe um WhatsApp com DDD, por exemplo (37) 99999-9999."), $("#fWhats").focus();
    if (!$("#fPol").checked) return erroForm("Para continuar, confirme que leu as políticas do atendimento.");
    erroForm("");
    st.enviando = true;
    const b = $("#barraBtn");
    b.disabled = true;
    b.textContent = "Enviando…";
    try {
      localStorage.setItem(LS, JSON.stringify({ nome, whats: $("#fWhats").value }));
    } catch (e) {}
    try {
      const r = await api.solicitar({ nome, whats, data: st.data, inicio: st.hora, servicos: [...st.sel], obs: $("#fObs").value.trim() });
      sucesso({ nome, whats, data: st.data, inicio: st.hora, fim: r.fim, total: r.total, servicos: r.servicos || escolhidos() });
      delete st.ocupados[st.data];
      st.sel.clear(); st.data = null; st.hora = null;
      $("#fObs").value = "";
      $("#fPol").checked = false;
      pintarServicos(); pintarCalendario(); pintarHoras();
    } catch (e) {
      FL.toast(e.message || "Não foi possível enviar. Tente de novo.", "erro");
      if (/reserv|ocupad|dispon|passou/i.test(e.message || "")) {
        st.hora = null;
        await pintarHoras(true);
        rolarPara("#etapaHora");
      }
    } finally {
      st.enviando = false;
      atualizarBarra();
    }
  }

  function mensagemWhats(a) {
    const nomes = a.servicos.map((s) => s.nome).join(" + ");
    return [
      `Olá! Acabei de solicitar um horário pelo site 🌺`,
      ``,
      `*Nome:* ${a.nome}`,
      `*Serviço:* ${nomes}`,
      `*Dia:* ${U.dataLonga(a.data)}`,
      `*Horário:* ${a.inicio} às ${a.fim}`,
      `*Valor:* ${U.brl(a.total)}`,
      ``,
      `Pode confirmar, por favor?`,
    ].join("\n");
  }

  function sucesso(a) {
    const c = st.config;
    const link = c.whatsapp ? U.waLink(c.whatsapp, mensagemWhats(a)) : "";
    const sinal = Number(c.sinal_valor) > 0 && c.pix_chave;
    abrirModal(`
      <div class="selo-ok">${ICON.ok}</div>
      <h2 id="mTit">Solicitação enviada!</h2>
      <p>${link ? "Agora é só confirmar com a profissional pelo WhatsApp." : "Em breve a profissional entra em contato para confirmar."}</p>
      <div class="resumo">
        <div class="resumo-linha"><span>Serviço</span><strong>${U.esc(a.servicos.map((s) => s.nome).join(" + "))}</strong></div>
        <div class="resumo-linha"><span>Dia</span><strong>${U.dataLonga(a.data)}</strong></div>
        <div class="resumo-linha"><span>Horário</span><strong class="num">${a.inicio} às ${a.fim}</strong></div>
        <div class="resumo-linha resumo-total"><span>Valor</span><strong class="num">${U.brl(a.total)}</strong></div>
      </div>
      ${sinal ? `<div class="pix"><strong>Sinal de ${U.brl(c.sinal_valor)} via Pix</strong><span>Garante seu horário. Envie o comprovante no WhatsApp.</span><code id="pixChave">${U.esc(c.pix_chave)}</code>${c.pix_nome ? `<small>Em nome de ${U.esc(c.pix_nome)}</small>` : ""}<button type="button" class="btn btn-contorno btn-pequeno" id="copiaPix">Copiar chave Pix</button></div>` : ""}
      <div class="modal-acoes">
        ${link ? `<a class="btn btn-whats btn-bloco" id="irWhats" href="${U.esc(link)}" target="_blank" rel="noopener">${ICON.whats} Confirmar no WhatsApp</a>` : `<button type="button" class="btn btn-bloco" data-fechar>Fechar</button>`}
      </div>
      ${link && !sinal ? `<p class="contagem" id="contagem">Abrindo o WhatsApp em <span class="num">5</span>s · <button type="button" class="btn-texto" id="pararContagem">ficar aqui</button></p>` : ""}
    `);
    const cp = $("#copiaPix");
    if (cp) cp.onclick = () => copiar(c.pix_chave);
    if (link && !sinal) {
      let n = 5;
      const tm = setInterval(() => {
        n--;
        const el = $("#contagem span");
        if (el) el.textContent = n;
        if (n <= 0) {
          clearInterval(tm);
          const ct = $("#contagem");
          if (ct) ct.textContent = "Se o WhatsApp não abriu, toque no botão acima.";
          window.location.href = link;
        }
      }, 1000);
      const parar = () => {
        clearInterval(tm);
        const ct = $("#contagem");
        if (ct) ct.remove();
      };
      $("#pararContagem").onclick = parar;
      $("#irWhats").addEventListener("click", parar);
      modalAoFechar = parar;
    }
  }

  async function copiar(txt) {
    try {
      await navigator.clipboard.writeText(txt);
      FL.toast("Chave Pix copiada");
    } catch (e) {
      const el = $("#pixChave");
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
      FL.toast("Selecione e copie a chave");
    }
  }

  /* ---------------- modal ---------------- */
  let modalAoFechar = null;
  function abrirModal(html) {
    $("#modais").innerHTML = `<div class="modal-fundo" data-fechar-fundo><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTit">${html}</div></div>`;
    const m = $(".modal");
    const foco = m.querySelector("a, button");
    if (foco) foco.focus();
  }
  function fecharModal() {
    if (modalAoFechar) { modalAoFechar(); modalAoFechar = null; }
    $("#modais").innerHTML = "";
  }

  /* ---------------- eventos ---------------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    const sv = t.closest(".servico");
    if (sv) return alternarServico(sv.dataset.id);
    const dia = t.closest(".dia");
    if (dia && !dia.disabled) return escolherData(dia.dataset.iso);
    const hr = t.closest(".hora");
    if (hr && !hr.disabled) return escolherHora(hr.dataset.hora);
    if (t.closest("[data-fechar]") || t.matches("[data-fechar-fundo]")) return fecharModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#modais").innerHTML) fecharModal(); });
  $("#calAnt").onclick = () => { st.mes.setMonth(st.mes.getMonth() - 1); pintarCalendario(); };
  $("#calProx").onclick = () => { st.mes.setMonth(st.mes.getMonth() + 1); pintarCalendario(); };
  $("#abrirPol").onclick = () => {
    abrirModal(`<h2 id="mTit">Políticas do atendimento</h2><p class="politicas-modal">${U.esc(st.config.politicas || "Sem políticas cadastradas.")}</p><div class="modal-acoes"><button type="button" class="btn" id="aceitoPol">Li e concordo</button></div>`);
    $("#aceitoPol").onclick = () => { $("#fPol").checked = true; fecharModal(); };
  };
  $("#barraBtn").onclick = () => {
    const a = $("#barraBtn").dataset.acao;
    if (a === "whats") return (window.location.href = U.waLink(st.config.whatsapp, "Olá! Gostaria de agendar um horário."));
    if (a === "servico") return rolarPara("#etapaServicos");
    if (a === "data") return rolarPara("#etapaData");
    if (a === "hora") return rolarPara("#etapaHora");
    if (a === "enviar") return enviar();
  };
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); if (st.hora) enviar(); });
  $("#fWhats").addEventListener("input", (e) => {
    const d = U.soDigitos(e.target.value).slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length === 11 ? 7 : 6)}-${d.slice(d.length === 11 ? 7 : 6)}`;
    e.target.value = v;
  });

  iniciar();
})();
