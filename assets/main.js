/* Portafolio — interacciones
   1. Matriz de LEDs del hero (onda de entrada + luz bajo el cursor)
   2. Tablero de 18 botones (juego de reflejos)
   3. Video del corto bajo demanda
   4. Navegación y revelado al hacer scroll */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Matriz de LEDs ---------- */
(function ledMatrix() {
  const canvas = document.getElementById("leds");
  if (!canvas) return;
  const box = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const COLORS = { off: [44, 49, 64], signal: [92, 118, 255], led: [255, 179, 71] };

  let cols, rows, gap, leds = [], pointer = null, start = performance.now(), running = true;

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
        leds.push({ x: offX + x * gap, y: offY + y * gap, heat: 0, twinkle: 0 });
      }
    }
  }

  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function frame(now) {
    if (!running) return;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    const t = (now - start) / 1000;
    const r = gap * 0.17;

    for (const led of leds) {
      // onda diagonal de entrada (una sola vez, ~2.2 s)
      const d = (led.x + led.y) / (width + height);
      const wave = Math.max(0, 1 - Math.abs(t * 0.75 - d) * 7);

      // luz bajo el cursor
      if (pointer) {
        const dist = Math.hypot(led.x - pointer.x, led.y - pointer.y);
        const heat = Math.max(0, 1 - dist / (gap * 3.2));
        led.heat = Math.max(led.heat, heat);
      }
      led.heat *= 0.94;

      // destellos sueltos cuando nadie interactúa
      if (!pointer && t > 2.4 && Math.random() < 0.0009) led.twinkle = 1;
      led.twinkle *= 0.96;

      const signal = Math.max(wave, led.twinkle * 0.8);
      let color = mix(COLORS.off, COLORS.signal, signal);
      color = mix(color, COLORS.led, led.heat);
      const glow = Math.max(signal, led.heat);

      ctx.beginPath();
      ctx.arc(led.x, led.y, r * (1 + glow * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color})`;
      if (glow > 0.05) {
        ctx.shadowBlur = 14 * glow;
        ctx.shadowColor = `rgba(${color},.9)`;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  function drawStatic() {
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    leds.forEach((led, i) => {
      ctx.beginPath();
      ctx.arc(led.x, led.y, gap * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = i % 7 === 0 ? "rgb(92,118,255)" : "rgb(44,49,64)";
      ctx.fill();
    });
  }

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    box.classList.add("is-touched");
  }

  resize();
  window.addEventListener("resize", () => { resize(); if (reduceMotion) drawStatic(); });

  if (reduceMotion) { drawStatic(); return; }

  canvas.addEventListener("pointermove", setPointer);
  canvas.addEventListener("pointerdown", setPointer);
  canvas.addEventListener("pointerleave", () => { pointer = null; });

  // pausar cuando no se ve
  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting;
    if (visible && !running) { running = true; requestAnimationFrame(frame); }
    running = visible;
  }).observe(canvas);

  requestAnimationFrame(frame);
})();

/* ---------- 2. Tablero de 18 botones ---------- */
(function buttonPanel() {
  const group = document.getElementById("btns");
  if (!group) return;
  const NS = "http://www.w3.org/2000/svg";
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

  if (reduceMotion) { [2, 9, 13].forEach((i) => buttons[i].classList.add("on")); return; }

  // como en el juego: se enciende un botón al azar; al pasar el cursor encima se "presiona"
  let current = null;
  function next() {
    if (current) current.classList.remove("on");
    let pick;
    do { pick = buttons[Math.floor(Math.random() * buttons.length)]; } while (pick === current);
    current = pick;
    current.classList.add("on");
  }
  buttons.forEach((b) => b.addEventListener("pointerenter", () => { if (b === current) next(); }));
  next();
  setInterval(next, 1100);
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
