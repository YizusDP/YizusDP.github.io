/* Portafolio — interacciones
   (Los shaders del inicio viven en shaderlab.js)
   2. Mini juego de reflejos con 18 botones
   3. Video del corto bajo demanda
   4. Navegación y revelado al hacer scroll */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 2. Mini juego de reflejos (18 botones) ---------- */
(function reflexGame() {
  const group = document.getElementById("btns");
  if (!group) return;
  const NS = "http://www.w3.org/2000/svg";
  const prompt = document.getElementById("game-prompt");
  const hitsEl = document.getElementById("game-hits");
  const rtEl = document.getElementById("game-rt");
  const bestEl = document.getElementById("game-best");

  const buttons = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const g = document.createElementNS(NS, "g");
      const cx = 40 + col * 56, cy = 40 + row * 60;
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("class", "ring"); ring.setAttribute("cx", cx); ring.setAttribute("cy", cy); ring.setAttribute("r", 22);
      const cap = document.createElementNS(NS, "circle");
      cap.setAttribute("class", "cap"); cap.setAttribute("cx", cx); cap.setAttribute("cy", cy); cap.setAttribute("r", 15);
      g.append(ring, cap);
      group.append(g);
      buttons.push(g);
    }
  }

  let current = null, litAt = 0, hits = 0, best = Infinity, playing = false, demoTimer = null;

  function light() {
    if (current) current.classList.remove("on");
    let pick;
    do { pick = buttons[Math.floor(Math.random() * buttons.length)]; } while (pick === current);
    current = pick;
    current.classList.add("on");
    litAt = performance.now();
  }

  // modo demostración hasta que alguien juega
  function demo() {
    clearInterval(demoTimer);
    demoTimer = setInterval(() => { if (!playing) light(); }, 1200);
  }

  function flash(el, cls) {
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 260);
  }

  function say(text, cls) {
    prompt.textContent = text;
    prompt.className = "game__prompt" + (cls ? " " + cls : "");
  }

  let idleTimer = null;
  buttons.forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      playing = true;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { playing = false; say("Toca el botón encendido"); }, 6000);

      if (b === current) {
        const ms = Math.round(performance.now() - litAt);
        hits += 1;
        best = Math.min(best, ms);
        hitsEl.textContent = hits;
        rtEl.textContent = ms + " ms";
        bestEl.textContent = best + " ms";
        b.classList.remove("on");
        flash(b, "hit");
        say(ms < 450 ? "¡Rapidísimo!" : "¡Bien! Sigue", "is-good");
        current = null;
        setTimeout(light, 220 + Math.random() * 500);
      } else {
        flash(b, "miss");
        say("Ese no, busca el ámbar", "is-bad");
      }
    });
  });

  light();
  if (!reduceMotion) demo();
})();

/* ---------- 3. Video bajo demanda ---------- */
document.querySelectorAll(".vfx__poster").forEach((poster) => {
  poster.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.src = poster.dataset.video;
    iframe.title = "Amistad — corto animado en tiempo real";
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;
    poster.replaceWith(iframe);
  });
});

/* ---------- 4. Navegación y revelado ---------- */
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-visible"));
}

/* ---------- 5. Barra de progreso y enlace activo ---------- */
(function readingProgress() {
  const bar = document.querySelector(".progress");
  const links = [...document.querySelectorAll(".nav__links a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);

  let ticking = false;
  function update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    const mid = window.scrollY + window.innerHeight * 0.35;
    let active = null;
    sections.forEach((sec) => { if (sec.offsetTop <= mid) active = sec; });
    links.forEach((a) => a.classList.toggle("is-active", active && a.getAttribute("href") === "#" + active.id));
    ticking = false;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

/* ---------- 6. Menú en celular ---------- */
(function mobileMenu() {
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu");
  if (!toggle || !menu) return;
  const set = (open) => {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Cerrar" : "Menú";
  };
  toggle.addEventListener("click", () => set(!menu.classList.contains("is-open")));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
})();

/* ---------- 7. Nombre letra por letra ---------- */
(function splitName() {
  const h1 = document.querySelector("[data-split]");
  if (!h1) return;
  if (!h1.hasAttribute("aria-label")) h1.setAttribute("aria-label", h1.textContent.trim());
  let i = 0;
  [...h1.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.append(" "); return; }
      const word = document.createElement("span");
      word.className = "word";
      word.setAttribute("aria-hidden", "true");
      for (const ch of part) {
        const span = document.createElement("span");
        span.className = "char";
        span.style.setProperty("--i", i++);
        span.textContent = ch;
        word.append(span);
      }
      frag.append(word);
    });
    node.replaceWith(frag);
  });
})();

/* ---------- 8. Botones magnéticos e inclinación 3D ---------- */
if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });

  document.querySelectorAll(".work__media:not(.work__media--panel)").forEach((media) => {
    media.addEventListener("pointermove", (e) => {
      const r = media.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      media.style.transform = `perspective(900px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg)`;
    });
    media.addEventListener("pointerleave", () => { media.style.transform = ""; });
  });
}

/* ---------- 9. Números que cuentan ---------- */
(function countUp() {
  const nums = document.querySelectorAll("[data-count]");
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target, target = +el.dataset.count, suffix = el.dataset.suffix || "";
      const t0 = performance.now(), dur = 1100;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  nums.forEach((n) => { n.textContent = "0" + (n.dataset.suffix || ""); io.observe(n); });
})();

/* ---------- 10. Galería con zoom ---------- */
(function lightbox() {
  const dialog = document.querySelector(".lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const big = dialog.querySelector("img");
  document.querySelectorAll(".stills img").forEach((img) => {
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    const open = () => { big.src = img.src; big.alt = img.alt; dialog.showModal(); };
    img.addEventListener("click", open);
    img.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  dialog.querySelector(".lightbox__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
})();

/* ---------- 11. Copiar correo ---------- */
const toast = document.querySelector(".toast");
function showToast(text) {
  toast.textContent = text;
  toast.classList.add("is-visible");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      showToast("Correo copiado");
    } catch {
      showToast(btn.dataset.copy);
    }
  });
});

/* ---------- 12. Código Konami: modo fiesta ---------- */
(function konami() {
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  window.addEventListener("keydown", (e) => {
    pos = e.key === code[pos] ? pos + 1 : (e.key === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      document.documentElement.classList.toggle("party");
      showToast(document.documentElement.classList.contains("party") ? "Modo fiesta activado" : "Modo fiesta desactivado");
    }
  });
})();
