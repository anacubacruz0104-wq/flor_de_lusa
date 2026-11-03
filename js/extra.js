/* Flor de Lusa · extras da página da cliente:
   abertura, animações, aviso do Instagram, galeria e QR Code do Pix */
(function () {
  var doc = document, html = doc.documentElement;
  var reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cfg = window.FL_CONFIG || {};

  /* ---------- aviso para quem abre pelo Instagram/Facebook ---------- */
  var ua = navigator.userAgent || "";
  if (/Instagram|FBAN|FBAV/i.test(ua)) {
    var av = doc.createElement("div");
    av.className = "aviso-insta";
    av.setAttribute("role", "status");
    av.innerHTML = '<p><strong>Você está no navegador do Instagram.</strong> Para agendar sem travar, toque em <b>⋯</b> no canto da tela e escolha <b>Abrir no navegador</b>.</p><button type="button" aria-label="Fechar aviso">×</button>';
    av.querySelector("button").onclick = function () { av.remove(); };
    doc.body.prepend(av);
  }

  /* ---------- animações ao rolar ---------- */
  var mostrarTudo = function () {
    doc.querySelectorAll(".revelar").forEach(function (el) { el.classList.add("visivel"); });
  };
  if (!reduz && "IntersectionObserver" in window) {
    html.classList.add("anima");
    var funcionou = false;
    var io = new IntersectionObserver(function (ents) {
      funcionou = true;
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    var marcar = function () {
      doc.querySelectorAll(".revelar:not(.visivel)").forEach(function (el) { io.observe(el); });
    };
    marcar();
    window.FL_revelar = marcar;
    /* segurança: se o navegador não avisar a rolagem, mostra tudo */
    setTimeout(function () { if (!funcionou) mostrarTudo(); }, 1800);
    window.addEventListener("scroll", function f() {
      setTimeout(function () { if (!funcionou) mostrarTudo(); }, 600);
      window.removeEventListener("scroll", f);
    }, { passive: true });
  } else {
    mostrarTudo();
  }

  /* ---------- barra de resumo some enquanto a abertura está na tela ---------- */
  var ab = doc.getElementById("inicio");
  if (ab && "IntersectionObserver" in window) {
    new IntersectionObserver(function (e) {
      doc.body.classList.toggle("na-abertura", e[0].intersectionRatio > 0.35);
    }, { threshold: [0, 0.35, 0.6, 1] }).observe(ab);
  }

  /* ---------- seta "arraste para baixo" ---------- */
  doc.addEventListener("click", function (ev) {
    var a = ev.target.closest("a[href^='#']");
    if (!a || a.getAttribute("href").length < 2) return;
    var alvo = doc.getElementById(a.getAttribute("href").slice(1));
    if (!alvo) return;
    ev.preventDefault();
    alvo.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
  });

  /* ---------- galeria de trabalhos ---------- */
  var urlPublica = function (caminho) {
    return cfg.supabaseUrl + "/storage/v1/object/public/galeria/" + encodeURI(caminho);
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var fotos = [];
  function pintarGaleria() {
    var sec = doc.getElementById("galeria");
    if (!sec) return;
    if (!fotos.length) { sec.hidden = true; return; }
    sec.hidden = false;
    var trilho = sec.querySelector(".galeria-trilho");
    trilho.innerHTML = fotos.map(function (f, i) {
      return '<button type="button" class="galeria-item" data-i="' + i + '" aria-label="Ampliar foto' + (f.legenda ? ": " + esc(f.legenda) : "") + '">' +
        '<img src="' + esc(urlPublica(f.caminho)) + '" alt="' + esc(f.legenda || "Trabalho do estúdio") + '" loading="lazy" decoding="async">' +
        (f.legenda ? '<span class="galeria-legenda">' + esc(f.legenda) + "</span>" : "") + "</button>";
    }).join("");
    var n = sec.querySelector(".galeria-contagem");
    if (n) n.textContent = fotos.length + (fotos.length === 1 ? " foto" : " fotos");
    if (window.FL_revelar) window.FL_revelar();
  }
  function carregarGaleria() {
    if (!(cfg.supabaseUrl && cfg.supabaseKey)) return;
    fetch(cfg.supabaseUrl + "/rest/v1/galeria?select=id,caminho,legenda,ordem&ativo=eq.true&order=ordem.asc,criado_em.desc", {
      headers: { apikey: cfg.supabaseKey, Authorization: "Bearer " + cfg.supabaseKey }
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (d) { fotos = Array.isArray(d) ? d : []; pintarGaleria(); })
      .catch(function () {});
  }
  carregarGaleria();

  /* setas do carrossel */
  doc.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-galeria-mover]");
    if (!b) return;
    var t = doc.querySelector(".galeria-trilho");
    if (!t) return;
    var passo = t.clientWidth * 0.8 * Number(b.dataset.galeriaMover);
    t.scrollBy({ left: passo, behavior: reduz ? "auto" : "smooth" });
  });

  /* ampliação (lightbox) */
  var atual = 0, caixa = null, toqueX = null;
  function abrir(i) {
    atual = i;
    if (!caixa) {
      caixa = doc.createElement("div");
      caixa.className = "luz";
      caixa.setAttribute("role", "dialog");
      caixa.setAttribute("aria-modal", "true");
      caixa.setAttribute("aria-label", "Foto ampliada");
      caixa.innerHTML = '<button type="button" class="luz-fechar" aria-label="Fechar">×</button>' +
        '<button type="button" class="luz-seta luz-ant" aria-label="Foto anterior">‹</button>' +
        '<figure class="luz-fig"><img alt=""><figcaption></figcaption></figure>' +
        '<button type="button" class="luz-seta luz-prox" aria-label="Próxima foto">›</button>' +
        '<p class="luz-conta num"></p>';
      doc.body.appendChild(caixa);
      caixa.addEventListener("click", function (e) {
        if (e.target.closest(".luz-fechar") || e.target === caixa) return fechar();
        if (e.target.closest(".luz-ant")) return mostrar(atual - 1);
        if (e.target.closest(".luz-prox")) return mostrar(atual + 1);
      });
      caixa.addEventListener("touchstart", function (e) { toqueX = e.touches[0].clientX; }, { passive: true });
      caixa.addEventListener("touchend", function (e) {
        if (toqueX == null) return;
        var dx = e.changedTouches[0].clientX - toqueX;
        if (Math.abs(dx) > 50) mostrar(atual + (dx < 0 ? 1 : -1));
        toqueX = null;
      });
    }
    mostrar(i);
    caixa.hidden = false;
    requestAnimationFrame(function () { caixa.classList.add("aberta"); });
    doc.body.style.overflow = "hidden";
    caixa.querySelector(".luz-fechar").focus();
  }
  function mostrar(i) {
    atual = (i + fotos.length) % fotos.length;
    var f = fotos[atual];
    var img = caixa.querySelector("img");
    img.src = urlPublica(f.caminho);
    img.alt = f.legenda || "Trabalho do estúdio";
    caixa.querySelector("figcaption").textContent = f.legenda || "";
    caixa.querySelector(".luz-conta").textContent = (atual + 1) + " / " + fotos.length;
    var umaSo = fotos.length < 2;
    caixa.querySelector(".luz-ant").hidden = umaSo;
    caixa.querySelector(".luz-prox").hidden = umaSo;
  }
  function fechar() {
    if (!caixa) return;
    caixa.classList.remove("aberta");
    doc.body.style.overflow = "";
    setTimeout(function () { caixa.hidden = true; }, reduz ? 0 : 220);
  }
  doc.addEventListener("click", function (ev) {
    var it = ev.target.closest(".galeria-item");
    if (it) abrir(Number(it.dataset.i));
  });
  doc.addEventListener("keydown", function (e) {
    if (!caixa || caixa.hidden) return;
    if (e.key === "Escape") fechar();
    if (e.key === "ArrowRight") mostrar(atual + 1);
    if (e.key === "ArrowLeft") mostrar(atual - 1);
  });

  /* ---------- Pix: QR Code e "copia e cola" ---------- */
  function semAcento(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim();
  }
  function campo(id, v) { return id + String(v.length).padStart(2, "0") + v; }
  function crc16(s) {
    var c = 0xffff;
    for (var i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
    }
    return c.toString(16).toUpperCase().padStart(4, "0");
  }
  function chaveLimpa(k) {
    k = String(k || "").trim();
    if (k.indexOf("@") > 0 || k[0] === "+") return k.replace(/\s/g, "");
    if (/^[\d.\-\/\s()]+$/.test(k)) return k.replace(/\D/g, "");
    return k;
  }
  function payloadPix(chave, nome, valor) {
    var conta = campo("00", "br.gov.bcb.pix") + campo("01", chaveLimpa(chave));
    var p = campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986");
    if (valor > 0) p += campo("54", Number(valor).toFixed(2));
    p += campo("58", "BR") + campo("59", (semAcento(nome) || "FLOR DE LUSA").slice(0, 25)) +
      campo("60", "BRASIL") + campo("62", campo("05", "FLORDELUSA"));
    p += "6304";
    return p + crc16(p);
  }
  window.FL_pix = payloadPix;
  new MutationObserver(function () {
    var box = doc.querySelector(".modal .pix:not([data-qr])");
    if (!box) return;
    box.setAttribute("data-qr", "1");
    var chave = (doc.getElementById("pixChave") || {}).textContent || "";
    var nomeEl = box.querySelector("small");
    var nome = nomeEl ? nomeEl.textContent.replace(/^Em nome de\s*/, "") : "";
    var valorTxt = (box.querySelector("strong") || {}).textContent || "";
    var m = valorTxt.replace(/\./g, "").match(/(\d+),(\d{2})/);
    var valor = m ? Number(m[1] + "." + m[2]) : 0;
    var cod = payloadPix(chave, nome, valor);
    var qr = "";
    try {
      if (window.qrcode) {
        var q = window.qrcode(0, "M");
        q.addData(cod);
        q.make();
        qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      }
    } catch (e) { qr = ""; }
    var extra = doc.createElement("div");
    extra.className = "pix-qr";
    extra.innerHTML = (qr ? '<div class="pix-qr-img" aria-label="QR Code do Pix">' + qr + "</div>" : "") +
      '<button type="button" class="btn btn-pequeno" id="copiaCodPix">Copiar código Pix (copia e cola)</button>';
    box.appendChild(extra);
    extra.querySelector("#copiaCodPix").onclick = function () {
      var ok = function () { window.FL && FL.toast && FL.toast("Código Pix copiado. Cole no app do banco."); };
      if (navigator.clipboard) navigator.clipboard.writeText(cod).then(ok, function () {});
    };
  }).observe(doc.getElementById("modais") || doc.body, { childList: true, subtree: true });
})();
