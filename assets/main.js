/* Portafolio — interacciones
   1. Matriz de LEDs del hero: onda de entrada, letrero que corre,
      luz bajo el cursor y ondas al hacer clic
   2. Mini juego de reflejos con 18 botones
   3. Video del corto bajo demanda
   4. Navegación y revelado al hacer scroll */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Matriz de LEDs: letrero que se puede tocar ---------- */
(function ledMatrix() {
  const canvas = document.getElementById("leds");
  if (!canvas) return;
  const box = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const OFF = [44, 49, 64], SIGNAL = [92, 118, 255], LED = [255, 179, 71], RIPPLE = [190, 205, 255];

  // fuente de 3×5 para el letrero
  const FONT = {
    H: ["101", "101", "111", "101", "101"], O: ["111", "101", "101", "101", "111"],
    L: ["100", "100", "100", "100", "111"], A: ["010", "101", "111", "101", "101"],
    S: ["111", "100", "111", "001", "111"], Y: ["101", "101", "010", "010", "010"],
    J: ["001", "001", "001", "101", "111"], E: ["111", "100", "110", "100", "111"],
    U: ["101", "101", "101", "101", "111"], " ": ["0", "0", "0", "0", "0"],
  };
  const MESSAGE = "HOLA  SOY JESUS    ";
  // convierte el mensaje en columnas de bits
  const textCols = [];
  for (const ch of MESSAGE) {
    const g = FONT[ch];
    for (let c = 0; c < g[0].length; c++) textCols.push(g.map((row) => row[c] === "1"));
    textCols.push([false, false, false, false, false]);
  }

  let cols, rows, gap, leds = [], pointer = null, ripples = [], running = true;
  const start = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = box.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gap = Math.max(22, Math.min(34, width / 13));
    cols = Math.floor(width / gap);
    rows = Math.floor(height / gap);
    const offX = (width - (cols - 1) * gap) / 2;
    const offY = (height - (rows - 1) * gap) / 2;
    leds = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        leds.push({ col: x, row: y, x: offX + x * gap, y: offY + y * gap, heat: 0 });
      }
    }
  }

  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, t)));

  function textAt(col, row, t) {
    const top = Math.floor((rows - 5) / 2);
    const r = row - top;
    if (r < 0 || r > 4) return false;
    const shift = Math.floor(t * 7); // columnas por segundo
    const i = (col + shift) % textCols.length;
    return textCols[i][r];
  }

  function frame(now) {
    if (!running) return;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    const t = (now - start) / 1000;
    const r = gap * 0.17;
    ripples = ripples.filter((rp) => now - rp.t0 < 1600);

    for (const led of leds) {
      // 1) onda diagonal de entrada
      const d = (led.x + led.y) / (width + height);
      const wave = Math.max(0, 1 - Math.abs(t * 0.75 - d) * 7);

      // 2) letrero que corre después de la onda
      const textOn = t > 1.6 && textAt(led.col, led.row, t - 1.6) ? Math.min(1, (t - 1.6) * 2) * 0.85 : 0;

      // 3) luz ámbar bajo el cursor, con estela
      if (pointer) {
        const dist = Math.hypot(led.x - pointer.x, led.y - pointer.y);
        led.heat = Math.max(led.heat, Math.max(0, 1 - dist / (gap * 2.6)));
      }
      led.heat *= 0.955;

      // 4) ondas expansivas al hacer clic
      let ring = 0;
      for (const rp of ripples) {
        const age = (now - rp.t0) / 1000;
        const radius = age * gap * 11;
        const dist = Math.hypot(led.x - rp.x, led.y - rp.y);
        ring = Math.max(ring, Math.max(0, 1 - Math.abs(dist - radius) / (gap * 0.9)) * (1 - age / 1.6));
      }

      let color = mix(OFF, SIGNAL, Math.max(wave, textOn));
      color = mix(color, RIPPLE, ring);
      color = mix(color, LED, led.heat);
      const glow = Math.max(wave, textOn * 0.7, led.heat, ring);

      ctx.beginPath();
      ctx.arc(led.x, led.y, r * (1 + glow * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color})`;
      ctx.shadowBlur = glow > 0.05 ? 14 * glow : 0;
      ctx.shadowColor = `rgba(${color},.9)`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  function drawStatic() {
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    for (const led of leds) {
      ctx.beginPath();
      ctx.arc(led.x, led.y, gap * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = textAt(led.col, led.row, 0) ? "rgb(92,118,255)" : "rgb(44,49,64)";
      ctx.fill();
    }
  }

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  resize();
  window.addEventListener("resize", () => { resize(); if (reduceMotion) drawStatic(); });
  if (reduceMotion) { drawStatic(); return; }

  canvas.addEventListener("pointermove", (e) => { pointer = local(e); box.classList.add("is-touched"); });
  canvas.addEventListener("pointerdown", (e) => {
    pointer = local(e);
    ripples.push({ ...pointer, t0: performance.now() });
    box.classList.add("is-touched");
  });
  canvas.addEventListener("pointerleave", () => { pointer = null; });

  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting;
    if (visible && !running) { running = true; requestAnimationFrame(frame); }
    running = visible;
  }).observe(canvas);

  requestAnimationFrame(frame);
})();

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
