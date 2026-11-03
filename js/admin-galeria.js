/* Flor de Lusa · painel: aba Galeria (fotos dos trabalhos) */
(function () {
  var cfg = window.FL_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl) return;
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var url = function (c) { return cfg.supabaseUrl + "/storage/v1/object/public/galeria/" + encodeURI(c); };
  var toast = function (m, t) { if (window.FL && FL.toast) FL.toast(m, t); };
  var fotos = [], enviando = 0, ativo = false;
  var ICO_C = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg>';
  var ICO_D = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>';

  function naGaleria() { return location.hash === "#galeria"; }

  function marcarAba() {
    document.querySelectorAll(".abas a").forEach(function (a) {
      a.setAttribute("aria-selected", naGaleria() ? String(a.dataset.aba === "galeria") : a.getAttribute("aria-selected"));
    });
  }

  async function carregar() {
    var r = await sb.from("galeria").select("*").order("ordem", { ascending: true }).order("criado_em", { ascending: false });
    if (r.error) throw new Error(r.error.message);
    fotos = r.data || [];
  }

  function pintar() {
    var c = $("#corpo");
    if (!c) return;
    ativo = true;
    c.setAttribute("data-gal", "1");
    c.innerHTML =
      '<div class="secao-cab"><div><p class="rotulo">Galeria</p><h1>' + fotos.length + (fotos.length === 1 ? " foto" : " fotos") + ' no site</h1></div></div>' +
      '<p class="painel-dica" style="margin:0">As fotos aparecem na página de agendamento, logo depois da abertura. Fotos verticais ficam mais bonitas.</p>' +
      '<label class="gal-envio" id="galEnvio"><input type="file" id="galArquivo" accept="image/*" multiple>' +
      '<strong>Adicionar fotos</strong><span class="gal-progresso" id="galProg">Toque para escolher ou arraste as fotos aqui. Elas são otimizadas automaticamente.</span></label>' +
      (fotos.length ? '<div class="gal-adm">' + fotos.map(function (f, i) {
        return '<div class="gal-card" data-id="' + f.id + '"><img src="' + esc(url(f.caminho)) + '" alt="" loading="lazy">' +
          '<input class="entrada" data-legenda value="' + esc(f.legenda || "") + '" maxlength="60" placeholder="Legenda (opcional)" aria-label="Legenda">' +
          '<div class="linha-btns"><span class="linha-btns"><button class="ico-btn" data-mover="-1" ' + (i === 0 ? "disabled" : "") + ' aria-label="Mover para a esquerda">' + ICO_C + '</button>' +
          '<button class="ico-btn" data-mover="1" ' + (i === fotos.length - 1 ? "disabled" : "") + ' aria-label="Mover para a direita">' + ICO_D + '</button></span>' +
          '<button class="btn-texto perigo" data-excluir>Excluir</button></div></div>';
      }).join("") + "</div>" : '<div class="vazio">Nenhuma foto ainda. Enquanto a galeria estiver vazia, ela não aparece no site.</div>');
    marcarAba();
    var env = $("#galEnvio");
    $("#galArquivo").onchange = function (e) { enviar([].slice.call(e.target.files || [])); e.target.value = ""; };
    ["dragenter", "dragover"].forEach(function (t) { env.addEventListener(t, function (e) { e.preventDefault(); env.classList.add("arrastando"); }); });
    ["dragleave", "drop"].forEach(function (t) { env.addEventListener(t, function (e) { e.preventDefault(); env.classList.remove("arrastando"); }); });
    env.addEventListener("drop", function (e) { enviar([].slice.call(e.dataTransfer.files || [])); });
  }

  async function abrirGaleria() {
    var c = $("#corpo");
    if (!c) return;
    c.setAttribute("data-gal", "1");
    c.innerHTML = '<p class="carregando">Carregando fotos…</p>';
    marcarAba();
    try { await carregar(); } catch (e) { c.innerHTML = '<div class="vazio">Não foi possível carregar a galeria: ' + esc(e.message) + "</div>"; return; }
    if (naGaleria()) pintar();
  }

  function comprimir(arq) {
    return new Promise(function (ok, erro) {
      var img = new Image();
      var u = URL.createObjectURL(arq);
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u);
        cv.toBlob(function (b) {
          if (b && b.type === "image/webp") return ok({ blob: b, tipo: "image/webp", ext: "webp" });
          cv.toBlob(function (j) { j ? ok({ blob: j, tipo: "image/jpeg", ext: "jpg" }) : erro(new Error("Não foi possível processar a imagem.")); }, "image/jpeg", 0.85);
        }, "image/webp", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); erro(new Error("Formato de imagem não suportado.")); };
      img.src = u;
    });
  }

  async function enviar(lista) {
    lista = lista.filter(function (f) { return /^image\//.test(f.type); });
    if (!lista.length) return;
    var prog = $("#galProg");
    var base = fotos.reduce(function (m, f) { return Math.max(m, f.ordem || 0); }, 0);
    var feitos = 0;
    enviando++;
    for (var i = 0; i < lista.length; i++) {
      if (prog) prog.textContent = "Enviando " + (i + 1) + " de " + lista.length + "…";
      try {
        var c = await comprimir(lista[i]);
        var nome = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + i) + "." + c.ext;
        var up = await sb.storage.from("galeria").upload(nome, c.blob, { contentType: c.tipo, cacheControl: "31536000" });
        if (up.error) throw new Error(up.error.message);
        var ins = await sb.from("galeria").insert({ caminho: nome, ordem: base + i + 1, legenda: "" }).select().single();
        if (ins.error) throw new Error(ins.error.message);
        feitos++;
      } catch (e) {
        toast("Foto " + (i + 1) + ": " + e.message, "erro");
      }
    }
    enviando--;
    if (feitos) toast(feitos === 1 ? "Foto adicionada à galeria" : feitos + " fotos adicionadas à galeria");
    await carregar();
    if (naGaleria()) pintar();
  }

  document.addEventListener("change", async function (e) {
    if (!naGaleria()) return;
    var inp = e.target.closest("[data-legenda]");
    if (!inp) return;
    var id = inp.closest(".gal-card").dataset.id;
    var r = await sb.from("galeria").update({ legenda: inp.value.trim() }).eq("id", id);
    if (r.error) toast(r.error.message, "erro"); else toast("Legenda salva");
  });

  document.addEventListener("click", async function (e) {
    if (!naGaleria()) return;
    var card = e.target.closest(".gal-card");
    if (!card) return;
    var id = card.dataset.id;
    var mv = e.target.closest("[data-mover]");
    if (mv) {
      var i = fotos.findIndex(function (f) { return f.id === id; }), j = i + Number(mv.dataset.mover);
      if (j < 0 || j >= fotos.length) return;
      var t = fotos[i]; fotos[i] = fotos[j]; fotos[j] = t;
      fotos.forEach(function (f, k) { f.ordem = k + 1; });
      pintar();
      var r1 = await sb.from("galeria").update({ ordem: fotos[i].ordem }).eq("id", fotos[i].id);
      var r2 = await sb.from("galeria").update({ ordem: fotos[j].ordem }).eq("id", fotos[j].id);
      if (r1.error || r2.error) toast("Não foi possível reordenar.", "erro");
      return;
    }
    var ex = e.target.closest("[data-excluir]");
    if (ex) {
      if (!ex.dataset.conf) { ex.dataset.conf = "1"; ex.textContent = "Toque de novo para excluir"; setTimeout(function () { if (ex.isConnected) { delete ex.dataset.conf; ex.textContent = "Excluir"; } }, 4000); return; }
      var f = fotos.find(function (x) { return x.id === id; });
      var d = await sb.from("galeria").delete().eq("id", id);
      if (d.error) return toast(d.error.message, "erro");
      await sb.storage.from("galeria").remove([f.caminho]);
      fotos = fotos.filter(function (x) { return x.id !== id; });
      pintar();
      toast("Foto excluída");
    }
  });

  /* integra com o roteamento do painel */
  window.addEventListener("hashchange", function () {
    if (naGaleria()) abrirGaleria();
    else if (ativo) { ativo = false; var c = $("#corpo"); if (c) c.removeAttribute("data-gal"); }
  });
  /* integra com o roteamento do painel: quando ele redesenha, a galeria volta */
  var corpo = document.getElementById("corpo");
  if (corpo) new MutationObserver(function () {
    if (!naGaleria() || enviando) return;
    if (!corpo.hasAttribute("data-gal")) return abrirGaleria();
    if (!corpo.querySelector(".gal-envio, .carregando, .vazio")) { corpo.removeAttribute("data-gal"); abrirGaleria(); }
  }).observe(corpo, { childList: true });
})();
