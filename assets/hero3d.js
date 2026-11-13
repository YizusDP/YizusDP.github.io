/* Escena 3D del inicio: un "viewport" estilo editor de Unity hecho con Three.js.
   - Arrastrar orbita la cámara (con inercia); si nadie toca, gira sola.
   - Clic en los objetos los selecciona: contorno, gizmo de ejes e Inspector con datos.
   - La pantalla del kiosco cambia de mensaje al tocarla.
   - El tablero es el juego de reflejos en 3D.
   - El botón Play activa el "modo Play" y tiñe el editor, como en Unity. */

import * as THREE from "./vendor/three.module.min.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const editor = document.getElementById("editor");
const canvas = document.getElementById("scene");
const inspectorEl = document.getElementById("inspector");
const consoleLine = document.getElementById("console-line");
const fpsEl = document.getElementById("fps");
const playBtn = document.querySelector(".editor__play");
const tabs = document.querySelectorAll(".editor__tab");
const treeButtons = document.querySelectorAll("[data-select]");

const COLORS = {
  signal: new THREE.Color(0x5c76ff),
  led: new THREE.Color(0xffb347),
  good: new THREE.Color(0x7dffb0),
  bad: new THREE.Color(0xff5d6c),
  outline: 0xffa53a,
};

function log(text) { consoleLine.textContent = text; }

function fallback() {
  canvas.hidden = true;
  const img = document.querySelector(".editor__fallback");
  if (img) img.hidden = false;
  log("Vista previa estática (WebGL no disponible).");
}

if (canvas) {
  try { init(); } catch (err) { console.error(err); fallback(); }
}

function init() {
  /* ---------- Renderer, escena y cámara ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2c33);
  scene.fog = new THREE.Fog(0x2a2c33, 13, 26);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const orbit = { target: new THREE.Vector3(0, 1.2, 0.2), radius: 8.6, theta: 0.5, phi: 1.12, vTheta: 0, vPhi: 0 };
  const HOME = { theta: 0.5, phi: 1.12 };
  function placeCamera() {
    const { radius, theta, phi, target } = orbit;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
  }

  /* ---------- Piso, rejilla y luces ---------- */
  const grid = new THREE.GridHelper(30, 30, 0x4b4f5d, 0x373a45);
  grid.material.transparent = true;
  grid.material.opacity = 0.75;
  scene.add(grid);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2c33, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  sun.shadow.radius = 4;
  scene.add(sun);

  const matBody = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.45, metalness: 0.35 });
  const matLight = new THREE.MeshStandardMaterial({ color: 0xe6e8ef, roughness: 0.6, metalness: 0.05 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.3, metalness: 0.2 });

  const shadowed = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  /* ---------- Kiosco táctil con pantalla viva ---------- */
  const kiosk = new THREE.Group();
  kiosk.position.set(-1.25, 0, -0.1);
  kiosk.rotation.y = 0.42;
  kiosk.userData.key = "kiosco";

  const kBase = box(1.15, 0.08, 0.72, matLight); kBase.position.y = 0.04;
  const kPole = box(0.18, 0.95, 0.14, matLight); kPole.position.y = 0.55;
  const housing = new THREE.Group();
  housing.position.y = 1.9;
  housing.rotation.x = -0.07;
  const kShell = box(1.02, 1.8, 0.12, matBody);
  housing.add(kShell);

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 512; screenCanvas.height = 928;
  const sctx = screenCanvas.getContext("2d");
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.63), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = 0.062;
  screen.userData.key = "kiosco";
  screen.userData.isScreen = true;
  housing.add(screen);

  const screenGlow = new THREE.PointLight(0x5c76ff, 3, 3.2, 1.6);
  screenGlow.position.set(0, 0, 0.5);
  housing.add(screenGlow);

  kiosk.add(kBase, kPole, housing);
  scene.add(kiosk);

  const SLIDES = [
    ["Hola, soy Jesús", "Ingeniero en Computación"],
    ["Kioscos táctiles", "Unity · C# · JSON"],
    ["Microcontroladores", "Arduino · ESP32 · NeoPixel"],
    ["VFX en tiempo real", "Shader Graph · HLSL"],
    ["¿Hablamos?", "adp3993@gmail.com"],
  ];
  let slide = 0, slideChangedAt = 0;
  const display = "'Bricolage Grotesque', 'IBM Plex Sans', sans-serif";
  const body = "'IBM Plex Sans', sans-serif";

  function wrapLines(text, maxWidth) {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (sctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
    }
    lines.push(line);
    return lines;
  }

  function drawScreen(t, hue) {
    const W = 512, H = 928;
    const g = sctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hue == null ? "#0d1a52" : `hsl(${hue},70%,22%)`);
    g.addColorStop(1, "#05070f");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, W, H);

    // orbe con anillos que laten (como los interactivos)
    const cx = W / 2, cy = 300;
    for (let i = 0; i < 4; i++) {
      const p = ((t * 0.45 + i / 4) % 1);
      sctx.beginPath();
      sctx.arc(cx, cy, 60 + p * 150, 0, Math.PI * 2);
      sctx.strokeStyle = `rgba(120,145,255,${(1 - p) * 0.55})`;
      sctx.lineWidth = 3;
      sctx.stroke();
    }
    const orb = sctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
    orb.addColorStop(0, "#ffffff");
    orb.addColorStop(0.35, hue == null ? "#8ea0ff" : `hsl(${hue},90%,70%)`);
    orb.addColorStop(1, "rgba(60,80,255,0)");
    sctx.fillStyle = orb;
    sctx.beginPath(); sctx.arc(cx, cy, 70, 0, Math.PI * 2); sctx.fill();

    // texto de la diapositiva
    const [title, sub] = SLIDES[slide];
    sctx.textAlign = "center";
    sctx.fillStyle = "#ffffff";
    sctx.font = `800 62px ${display}`;
    const lines = wrapLines(title, 440);
    lines.forEach((ln, i) => sctx.fillText(ln, cx, 560 + i * 66));
    sctx.fillStyle = "#aab6ff";
    sctx.font = `500 30px ${body}`;
    sctx.fillText(sub, cx, 560 + lines.length * 66 + 16);

    // indicador de diapositivas y botón
    SLIDES.forEach((_, i) => {
      sctx.beginPath();
      sctx.arc(cx - (SLIDES.length - 1) * 14 + i * 28, 790, i === slide ? 7 : 5, 0, Math.PI * 2);
      sctx.fillStyle = i === slide ? "#ffffff" : "rgba(255,255,255,.3)";
      sctx.fill();
    });
    sctx.strokeStyle = `rgba(255,255,255,${0.45 + Math.sin(t * 3) * 0.25})`;
    sctx.lineWidth = 2.5;
    roundRect(sctx, cx - 120, 830, 240, 56, 28); sctx.stroke();
    sctx.fillStyle = "#ffffff";
    sctx.font = `600 24px ${body}`;
    sctx.fillText("Toca la pantalla", cx, 866);

    // destello al cambiar de diapositiva
    const flash = Math.max(0, 1 - (t - slideChangedAt) * 3);
    if (flash > 0) { sctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; sctx.fillRect(0, 0, W, H); }

    screenTex.needsUpdate = true;
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function nextSlide(t) {
    slide = (slide + 1) % SLIDES.length;
    slideChangedAt = t;
    log(`Kiosco: "${SLIDES[slide][0]}"`);
  }

  /* ---------- Tablero del juego de reflejos ---------- */
  const board = new THREE.Group();
  board.position.set(1.45, 0, 0.55);
  board.rotation.y = -0.45;
  board.userData.key = "tablero";
  const bPed = box(1.55, 0.72, 0.95, matLight); bPed.position.y = 0.36;
  const bTop = box(1.6, 0.05, 1.0, matDark); bTop.position.y = 0.745;
  board.add(bPed, bTop);

  const buttons = [];
  const capGeo = new THREE.CylinderGeometry(0.15, 0.16, 0.07, 32);
  const ringGeo = new THREE.TorusGeometry(0.19, 0.022, 10, 40);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.35, metalness: 0.1, emissive: 0x000000 });
      const cap = shadowed(new THREE.Mesh(capGeo, mat));
      cap.position.set(-0.48 + c * 0.48, 0.8, -0.22 + r * 0.44);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x3a3f4d, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cap.position.x, 0.775, cap.position.z);
      cap.userData = { key: "tablero", isButton: true, ring, flash: 0, flashColor: null };
      board.add(cap, ring);
      buttons.push(cap);
    }
  }
  scene.add(board);

  let litButton = null, litAt = 0, hits = 0, best = Infinity;
  function lightRandom(now) {
    let next;
    do { next = buttons[Math.floor(Math.random() * buttons.length)]; } while (next === litButton);
    litButton = next; litAt = now;
  }

  /* ---------- "Jugador": la cápsula clásica ---------- */
  const player = new THREE.Group();
  player.position.set(0.05, 0, 1.35);
  player.userData.key = "jesus";
  const capsule = shadowed(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.27, 0.62, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x2f4cf5, roughness: 0.35, metalness: 0.15 })
  ));
  capsule.position.y = 0.6;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.1, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.2, metalness: 0.6, emissive: 0x2a3cff, emissiveIntensity: 0.6 })
  );
  visor.position.set(0, 0.86, 0.23);
  player.add(capsule, visor);
  scene.add(player);

  /* ---------- Partículas ---------- */
  const PCOUNT = 260;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PCOUNT * 3);
  const pSpeed = new Float32Array(PCOUNT);
  for (let i = 0; i < PCOUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 9;
    pPos[i * 3 + 1] = Math.random() * 4.5;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 7;
    pSpeed[i] = 0.08 + Math.random() * 0.22;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x8fa2ff, size: 0.045, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------- Selección: contorno + gizmo de ejes ---------- */
  const objects = { jesus: player, kiosco: kiosk, tablero: board, luz: null, camara: null };
  const outline = new THREE.BoxHelper(player, COLORS.outline);
  outline.material.depthTest = false;
  outline.material.transparent = true;
  outline.renderOrder = 998;
  scene.add(outline);

  const gizmo = new THREE.Group();
  [[1, 0, 0, 0xff5b5b], [0, 1, 0, 0x5bdc7f], [0, 0, 1, 0x5b8cff]].forEach(([x, y, z, color]) => {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(x, y, z), new THREE.Vector3(), 0.6, color, 0.14, 0.08);
    [arrow.line.material, arrow.cone.material].forEach((m) => { m.depthTest = false; m.transparent = true; });
    arrow.renderOrder = 999;
    gizmo.add(arrow);
  });
  scene.add(gizmo);

  // icono de la luz direccional (solo visible cuando se selecciona)
  const sunIcon = new THREE.Group();
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd36b, toneMapped: false }));
  const sunRay = new THREE.ArrowHelper(new THREE.Vector3(-4, -7, -5).normalize(), new THREE.Vector3(), 1.2, 0xffd36b, 0.18, 0.1);
  sunIcon.add(sunCore, sunRay);
  sunIcon.position.set(2.6, 3.4, 1.2);
  sunIcon.visible = false;
  scene.add(sunIcon);

  let selected = "jesus";
  const tmpBox = new THREE.Box3(), tmpV = new THREE.Vector3();

  /* ---------- Inspector ---------- */
  const DATA = {
    jesus: { name: "Jesús Domínguez", tag: "Player", comp: "Ingeniero (Script)", rows: [
      ["Rol", "Ing. en Computación"], ["Base", "CDMX"], ["Disponible", true],
      ["Stack", "Unity, C#, C++, Python"], ["Hardware", "Arduino, ESP32"], ["Idiomas", "Español, Inglés"] ] },
    kiosco: { name: "Kiosco táctil", tag: "Interactivo", comp: "Kiosco Voices (Script)", rows: [
      ["Cliente", "Voices"], ["Evento", "WTC CDMX"], ["Fecha", "Octubre 2026"],
      ["Pantalla", "Vertical + IR touch"], ["Motor", "Unity, C#"], ["Diapositiva", () => `${slide + 1} / ${SLIDES.length}`] ] },
    tablero: { name: "Tablero de botones", tag: "Instalación", comp: "Juego de reflejos (Script)", rows: [
      ["Lugar", "Liverpool Perisur"], ["Botones", "18 + NeoPixel"], ["Mi rol", "Mantenimiento"],
      ["Parches", "Watchdog, timers"], ["Aciertos", () => String(hits)], ["Mejor", () => (best === Infinity ? "–" : best + " ms")] ] },
    camara: { name: "Main Camera", tag: "MainCamera", comp: "Camera", rows: [
      ["Proyección", "Perspectiva"], ["FOV", "35"], ["Orbitar", "Arrastrar"], ["Inercia", true] ] },
    luz: { name: "Directional Light", tag: "Untagged", comp: "Light", rows: [
      ["Tipo", "Directional"], ["Intensidad", "1.7"], ["Sombras", "Soft"], ["Color", "#FFFFFF"] ] },
  };

  function transformOf(key) {
    if (key === "camara") return { p: camera.position, ry: THREE.MathUtils.radToDeg(orbit.theta) };
    if (key === "luz") return { p: sun.position, ry: 0 };
    const o = objects[key];
    return { p: o.position, ry: THREE.MathUtils.radToDeg(o.rotation.y) };
  }

  function renderInspector() {
    const d = DATA[selected];
    const rows = d.rows.map(([k, v]) => {
      const val = typeof v === "function" ? v() : v;
      const cell = val === true ? '<dd style="background:none;border:0;padding:0"><span class="insp__bool" aria-label="sí"></span></dd>' : `<dd data-live="${typeof v === "function" ? k : ""}">${val}</dd>`;
      return `<div class="insp__row"><dt>${k}</dt>${cell}</div>`;
    }).join("");
    inspectorEl.innerHTML = `
      <div class="insp">
        <div class="insp__head"><span class="insp__check"></span><span class="insp__name">${d.name}</span></div>
        <div class="insp__comp">
          <p class="insp__comp-title">Transform</p>
          <div class="insp__row"><dt>Position</dt><dd style="background:none;border:0;padding:0"><div class="insp__vec" id="t-pos"></div></dd></div>
          <div class="insp__row"><dt>Rotation</dt><dd style="background:none;border:0;padding:0"><div class="insp__vec" id="t-rot"></div></dd></div>
        </div>
        <div class="insp__comp">
          <p class="insp__comp-title">${d.comp}</p>
          <dl style="margin:0">${rows}</dl>
        </div>
        <div class="insp__row"><dt>Tag</dt><dd>${d.tag}</dd></div>
      </div>`;
    updateInspectorLive();
  }

  function updateInspectorLive() {
    const { p, ry } = transformOf(selected);
    const pos = document.getElementById("t-pos"), rot = document.getElementById("t-rot");
    const f = (v) => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
    if (pos) pos.innerHTML = `<span><b>X</b>${f(p.x)}</span><span><b>Y</b>${f(p.y)}</span><span><b>Z</b>${f(p.z)}</span>`;
    if (rot) rot.innerHTML = `<span><b>X</b>0</span><span><b>Y</b>${Math.round(ry)}</span><span><b>Z</b>0</span>`;
    DATA[selected].rows.forEach(([k, v]) => {
      if (typeof v !== "function") return;
      const el = inspectorEl.querySelector(`[data-live="${k}"]`);
      if (el) el.textContent = v();
    });
  }

  function select(key, fromTree) {
    selected = key;
    treeButtons.forEach((b) => b.classList.toggle("is-selected", b.dataset.select === key));
    sunIcon.visible = key === "luz";
    if (key === "camara") { orbit.theta = HOME.theta; orbit.phi = HOME.phi; orbit.vTheta = orbit.vPhi = 0; log("Main Camera: vista restablecida."); }
    else if (!fromTree) log(`Seleccionado: ${DATA[key].name}`);
    else log(`Seleccionado: ${DATA[key].name}`);
    renderInspector();
  }
  treeButtons.forEach((b) => b.addEventListener("click", () => select(b.dataset.select, true)));
  renderInspector();

  /* ---------- Play mode ---------- */
  let playing = false;
  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.setAttribute("aria-pressed", String(playing));
    editor.classList.toggle("is-playing", playing);
    tabs.forEach((tab, i) => tab.classList.toggle("is-active", playing ? i === 1 : i === 0));
    log(playing ? "Modo Play: la escena cobra vida. Vuelve a presionar para detener." : "Modo Play detenido.");
  });

  /* ---------- Entrada: orbitar, seleccionar y tocar ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = [screen, kShell, kBase, kPole, bPed, bTop, ...buttons, capsule, visor];
  let drag = null, lastInteraction = -10;

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (!hit) return null;
    let o = hit.object, key = o.userData.key;
    while (!key && o.parent) { o = o.parent; key = o.userData.key; }
    return { object: hit.object, key };
  }

  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    editor.classList.add("is-touched");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) { drag.moved = true; canvas.classList.add("is-dragging"); }
      orbit.vTheta = -dx * 0.006;
      orbit.vPhi = -dy * 0.004;
      orbit.theta += orbit.vTheta;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi + orbit.vPhi, 0.55, 1.42);
      drag.x = e.clientX; drag.y = e.clientY;
      lastInteraction = clock.elapsedTime;
    } else {
      canvas.classList.toggle("is-pointing", !!pick(e));
    }
  });
  function endDrag(e) {
    if (!drag) return;
    canvas.classList.remove("is-dragging");
    if (!drag.moved && e.type === "pointerup") onClick(e);
    drag = null;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  function onClick(e) {
    const hit = pick(e);
    lastInteraction = clock.elapsedTime;
    if (!hit) return;
    const t = clock.elapsedTime;
    if (hit.object.userData.isScreen) { nextSlide(t); if (selected !== "kiosco") select("kiosco"); else updateInspectorLive(); return; }
    if (hit.object.userData.isButton) {
      const b = hit.object;
      if (b === litButton) {
        const ms = Math.round(performance.now() - litAt);
        hits += 1; best = Math.min(best, ms);
        b.userData.flash = 1; b.userData.flashColor = COLORS.good;
        litButton = null;
        setTimeout(() => lightRandom(performance.now()), 250 + Math.random() * 450);
        log(`¡Acierto! Reacción: ${ms} ms · Mejor: ${best} ms`);
      } else {
        b.userData.flash = 1; b.userData.flashColor = COLORS.bad;
        log("Ese no: toca el botón ámbar.");
      }
      if (selected !== "tablero") select("tablero"); else updateInspectorLive();
      return;
    }
    if (hit.key && hit.key !== selected) select(hit.key);
  }

  /* ---------- Tamaño y visibilidad ---------- */
  function resize() {
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // en pantallas angostas alejamos la cámara para que quepa todo
    orbit.radius = width < 520 ? 11 : 8.6;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(editor);

  /* ---------- Bucle principal ---------- */
  const clock = new THREE.Clock();
  let frames = 0, fpsTime = 0, liveTime = 0, screenTime = 0, buttonTime = 0, playSlideTime = 0;
  lightRandom(performance.now());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawScreen(clock.elapsedTime));

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!visible || document.hidden) return;
    const motion = reduceMotion ? 0 : 1;
    const party = document.documentElement.classList.contains("party");
    const speed = playing ? 3 : 1;

    // órbita: inercia y giro automático cuando nadie toca
    if (!drag) {
      orbit.theta += orbit.vTheta; orbit.phi = THREE.MathUtils.clamp(orbit.phi + orbit.vPhi, 0.55, 1.42);
      orbit.vTheta *= 0.92; orbit.vPhi *= 0.88;
      if (t - lastInteraction > 3) orbit.theta += dt * 0.12 * motion * speed;
    }
    placeCamera();

    // jugador: flota y en modo Play salta y gira
    player.position.y = Math.sin(t * 2) * 0.04 * motion + (playing ? Math.abs(Math.sin(t * 4)) * 0.35 * motion : 0);
    player.rotation.y += dt * (playing ? 2.5 : 0.25) * motion;

    // pantalla del kiosco
    screenTime += dt;
    if (screenTime > 1 / 30) {
      screenTime = 0;
      drawScreen(motion ? t : 0, party ? (t * 120) % 360 : null);
    }
    if (playing) { playSlideTime += dt; if (playSlideTime > 2.6) { playSlideTime = 0; nextSlide(t); } }
    screenGlow.color.copy(party ? new THREE.Color().setHSL(((t * 0.33) % 1), 0.8, 0.6) : COLORS.signal);
    screenGlow.intensity = 2.5 + Math.sin(t * 3) * 0.6 * motion;

    // botones: en modo Play el juego se acelera solo
    buttonTime += dt;
    if (!litButton && !reduceMotion && buttonTime > 1.4) { lightRandom(performance.now()); buttonTime = 0; }
    if (litButton && buttonTime > (playing ? 0.6 : 1.6) && t - lastInteraction > 2) { lightRandom(performance.now()); buttonTime = 0; }
    buttons.forEach((b, i) => {
      const m = b.material;
      b.userData.flash = Math.max(0, b.userData.flash - dt * 3);
      let target = null, intensity = 0;
      if (party) { target = new THREE.Color().setHSL(((t * 0.4 + i / 6) % 1), 0.85, 0.55); intensity = 1.8; }
      else if (b.userData.flash > 0) { target = b.userData.flashColor; intensity = 2.4 * b.userData.flash; }
      else if (b === litButton) { target = COLORS.led; intensity = 1.6 + Math.sin(t * 8) * 0.4 * motion; }
      if (target) { m.emissive.copy(target); m.emissiveIntensity = intensity; b.userData.ring.material.color.copy(target); }
      else { m.emissive.setHex(0x000000); b.userData.ring.material.color.setHex(0x3a3f4d); }
      b.position.y = 0.8 - (b.userData.flash > 0.5 ? 0.02 : 0);
    });

    // partículas que suben
    const pos = pGeo.attributes.position.array;
    for (let i = 0; i < PCOUNT; i++) {
      pos[i * 3 + 1] += pSpeed[i] * dt * speed * motion;
      if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] = 0;
    }
    pGeo.attributes.position.needsUpdate = true;
    if (party) pMat.color.setHSL((t * 0.2) % 1, 0.8, 0.65); else pMat.color.setHex(playing ? 0xffc979 : 0x8fa2ff);

    // contorno y gizmo sobre la selección
    const target = objects[selected];
    outline.visible = gizmo.visible = !!target;
    if (target) {
      outline.setFromObject(target);
      tmpBox.setFromObject(target);
      tmpBox.getCenter(tmpV);
      gizmo.position.set(tmpV.x, tmpBox.max.y + 0.12, tmpV.z);
    }

    renderer.render(scene, camera);

    // FPS e inspector en vivo
    frames++; fpsTime += dt; liveTime += dt;
    if (fpsTime >= 0.5) { fpsEl.textContent = Math.round(frames / fpsTime) + " fps"; frames = 0; fpsTime = 0; }
    if (liveTime > 0.15) { liveTime = 0; updateInspectorLive(); }
  });
}
