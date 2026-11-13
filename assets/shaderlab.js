/* Laboratorio de shaders del inicio.
   Son versiones en GLSL (WebGL 1, sin librerías) de shaders que escribí en HLSL para Unity:
   - Aura de energía  → AuraKi.shader   (fresnel + ruido que sube, tres bandas toon, línea de orilla)
   - Fuego toon       → FuegoVFX.shader (llama en forma de lágrima, distorsión creciente, bandas toon)
   - Disolver         → Disolve.shadergraph (corte por ruido con borde emisivo)
   - Holograma        → HologramEffectURP.shader (líneas de escaneo + fresnel + parpadeo)
   Para que sea ligero: se dibuja a media resolución, se pausa fuera de pantalla
   y respeta "reducir movimiento". */

(function shaderLab() {
  const canvas = document.getElementById("lab");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  const hero = canvas.parentElement;
  if (!gl) { hero.classList.add("no-webgl"); return; }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Código GLSL compartido ---------- */
  const HEADER = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;     // -1..1
uniform vec2 u_center;    // centro del efecto en coordenadas de pantalla
uniform float u_param;    // control deslizable
uniform float u_click;    // segundos desde el último clic
uniform float u_variant;  // 0,1,2: cambia con cada clic
uniform float u_zoom;     // más alto = efecto más pequeño (celular)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), u.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), u.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), u.x), u.y), u.z);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 tonemap(vec3 c) { return 1.0 - exp(-c); }
vec3 background(vec2 uv) {
  float v = 1.0 - 0.45 * length(uv - u_center * 0.6);
  return vec3(0.051, 0.059, 0.082) * v;
}
float sdCapsule(vec3 p, float h, float r) { p.y -= clamp(p.y, -h, h); return length(p) - r; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
`;

  const SHADERS = {
    /* ---------- AuraKi: aura toon alrededor de la cápsula ---------- */
    aura: `
float body(vec3 p) {
  p.xz = rot(u_mouse.x * 0.7 + u_time * 0.25) * p.xz;
  return sdCapsule(p, 0.55, 0.42);
}
vec3 bodyNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(body(p + e.xyy) - body(p - e.xyy), body(p + e.yxy) - body(p - e.yxy), body(p + e.yyx) - body(p - e.yyx)));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 q = (uv - u_center) * 3.3 * u_zoom;
  vec3 ro = vec3(0.0, 0.0, 4.2), rd = normalize(vec3(q, -2.6));
  rd.yz = rot(u_mouse.y * 0.15) * rd.yz;

  float t = 0.0, dmin = 10.0; bool hit = false;
  for (int i = 0; i < 56; i++) {
    float d = body(ro + rd * t);
    dmin = min(dmin, d);
    if (d < 0.002) { hit = true; break; }
    t += d;
    if (t > 8.0) break;
  }

  vec3 col = background(uv);
  if (hit) {
    vec3 p = ro + rd * t, n = bodyNormal(p);
    float dif = max(dot(n, normalize(vec3(0.5, 0.8, 0.6))), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col = vec3(0.10, 0.13, 0.30) * (0.35 + dif) + rim * vec3(0.4, 0.5, 1.0);
  }

  // Carga y transformación (clic): la carga sube y hay un destello blanco
  float carga = 1.0;
  float destello = exp(-u_click * 4.0) * step(0.0, u_click);
  float mezcla = clamp(u_param, 0.0, 1.0);

  // 1 junto al cuerpo, 0 en la orilla del cascarón; el cascarón es más alto arriba (las lenguas suben)
  float grosor = 0.3 + 0.42 * smoothstep(-0.6, 1.4, q.y);
  float v = 1.0 - clamp(dmin / grosor, 0.0, 1.0);
  float tt = u_time * 1.4;
  float n1 = fbm(vec2(q.x * 2.2, q.y * 1.3 - tt));
  float n2 = fbm(vec2(q.x * 5.0, q.y * 3.0 - tt * 1.7) + 0.37);
  float subida = clamp(q.y * 0.5 + 0.5, 0.0, 1.0) * smoothstep(0.0, 0.25, v);
  float lengua = (v * (0.55 + n1 * 0.9) + subida * 0.25) * (0.35 + 0.65 * carga);
  float lenguaColor = lengua + (n2 - 0.5) * 0.15;

  float U = 0.28, B = 0.06;
  float dentro = smoothstep(U, U + 0.02, lengua);
  float orilla = dentro * (1.0 - smoothstep(U + B, U + B + 0.02, lengua));

  vec3 cOrilla = mix(vec3(0.25, 0.55, 2.2), vec3(2.4, 0.8, 0.05), mezcla);
  vec3 cMedio  = mix(vec3(0.8, 1.3, 3.2),  vec3(3.6, 2.3, 0.3),  mezcla);
  vec3 cCentro = mix(vec3(2.4, 2.8, 3.4),  vec3(4.0, 3.7, 1.8),  mezcla);
  vec3 cBorde  = mix(vec3(0.15, 0.35, 1.6), vec3(1.6, 0.45, 0.02), mezcla);
  vec3 aura = mix(cOrilla, cMedio, step(0.5, lenguaColor));
  aura = mix(aura, cCentro, step(0.78, lenguaColor));
  aura = mix(aura, cBorde, orilla);

  float sobreCuerpo = hit ? 1.0 : 0.0;
  float a = dentro * mix(1.0, 0.2, sobreCuerpo);
  aura = mix(aura, vec3(6.0, 6.0, 5.5), destello);
  a = clamp(a + destello * dentro * sobreCuerpo * 0.8, 0.0, 1.0);

  col = col * (1.0 - a * mix(0.25, 0.85, orilla)) + tonemap(aura * 1.1) * a;
  gl_FragColor = vec4(col, 1.0);
}`,

    /* ---------- FuegoVFX en modo toon: tres flamas ---------- */
    fuego: `
vec4 flama(vec2 uv, float azar, float edad) {
  float t = u_time * 1.2;
  vec2 p = uv;
  if (p.x < -0.2 || p.x > 1.2 || p.y < 0.0 || p.y > 1.05) return vec4(0.0);
  float n1 = fbm(vec2(p.x * 1.1, p.y * 0.8) * 3.0 + vec2(azar * 5.3, -t));
  // la distorsión crece hacia la punta; el cursor funciona como viento
  p.x += (n1 - 0.5) * 0.55 * (0.25 + p.y * 1.2) - u_mouse.x * 0.35 * p.y * p.y;
  float ancho = 0.75 * 0.5 * pow(clamp(1.0 - p.y, 0.0, 1.0), 0.7) + 0.015;
  float dx = abs(p.x - 0.5);
  float forma = 1.0 - smoothstep(ancho * 0.45, ancho, dx);
  forma *= smoothstep(0.0, 0.1, p.y) * (1.0 - smoothstep(0.7, 1.0, p.y));
  float f = clamp((forma * (0.45 + n1) - edad * 0.6) * 1.7, 0.0, 1.0);
  float U = 0.3, B = 0.05;
  float dentro = smoothstep(U, U + 0.025, f);
  float orilla = dentro * (1.0 - smoothstep(U + B, U + B + 0.025, f));
  // el color se enfría hacia la orilla y hacia la punta: núcleo claro, cuerpo naranja, orilla roja
  float calor = clamp((forma * (0.3 + n1 * 0.8) - p.y * 0.35) * 1.6, 0.0, 1.0);
  vec3 c = mix(vec3(0.85, 0.12, 0.05), vec3(1.0, 0.5, 0.08), step(0.35, calor));
  c = mix(c, vec3(1.0, 0.93, 0.6), step(0.7, calor));
  c = mix(c, vec3(0.22, 0.04, 0.04), orilla);
  return vec4(c, dentro);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 q = (uv - u_center) * 1.35 * u_zoom;
  vec3 col = background(uv);
  col += vec3(0.5, 0.15, 0.03) * 0.3 * exp(-length(q - vec2(0.0, -0.3)) * 3.5);

  float boost = 1.0 + 0.5 * exp(-u_click * 2.5) * step(0.0, u_click);
  // tres flamas a distinta escala; se dibujan de atrás hacia adelante
  vec4 f1 = flama((q - vec2(-0.2, -0.38)) / vec2(0.3, 0.46 * boost) + vec2(0.5, 0.0), 0.31, 0.15);
  vec4 f2 = flama((q - vec2(0.2, -0.38)) / vec2(0.28, 0.42 * boost) + vec2(0.5, 0.0), 0.77, 0.2);
  vec4 f3 = flama((q - vec2(0.0, -0.4)) / vec2(0.42, 0.7 * boost) + vec2(0.5, 0.0), 0.05, 0.05);
  col = mix(col, f1.rgb, f1.a);
  col = mix(col, f2.rgb, f2.a);
  col = mix(col, f3.rgb, f3.a);

  // brasas que suben
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float s = hash(vec2(fi, 3.1));
    float life = fract(u_time * (0.18 + s * 0.2) + s);
    vec2 pos = vec2((hash(vec2(fi, 7.7)) - 0.5) * 0.5 + sin(u_time * 2.0 + fi) * 0.03 - u_mouse.x * 0.2 * life, -0.4 + life * 0.95);
    float d = length(q - pos);
    col += vec3(1.0, 0.55, 0.15) * (1.0 - life) * smoothstep(0.012, 0.0, d) * 1.5;
  }
  gl_FragColor = vec4(col, 1.0);
}`,

    /* ---------- Disolver: corte por ruido con borde emisivo ---------- */
    disolver: `
float shape(vec3 p) {
  p.yz = rot(0.5 + u_mouse.y * 0.6) * p.yz;
  p.xz = rot(u_time * 0.4 + u_mouse.x * 1.2) * p.xz;
  return sdTorus(p, vec2(0.85, 0.34));
}
vec3 local(vec3 p) {
  p.yz = rot(0.5 + u_mouse.y * 0.6) * p.yz;
  p.xz = rot(u_time * 0.4 + u_mouse.x * 1.2) * p.xz;
  return p;
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(shape(p + e.xyy) - shape(p - e.xyy), shape(p + e.yxy) - shape(p - e.yxy), shape(p + e.yyx) - shape(p - e.yyx)));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 q = (uv - u_center) * 3.1 * u_zoom;
  vec3 ro = vec3(0.0, 0.0, 4.0), rd = normalize(vec3(q, -2.5));
  vec3 col = background(uv);

  float umbral = 0.36 + 0.26 * sin(u_time * 0.7);
  vec3 borde = u_variant < 0.5 ? vec3(1.0, 0.8, 0.15) : (u_variant < 1.5 ? vec3(0.15, 0.95, 1.0) : vec3(1.0, 0.25, 0.85));

  float t = 0.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = shape(p);
    if (abs(d) < 0.002) {
      float n = noise3(local(p) * 3.2) * 0.65 + noise3(local(p) * 7.0) * 0.35;
      if (n > umbral) {
        vec3 nrm = normalAt(p);
        if (dot(nrm, rd) > 0.0) nrm = -nrm; // cara interior
        float dif = max(dot(nrm, normalize(vec3(0.5, 0.8, 0.6))), 0.0);
        float rim = pow(1.0 - max(dot(nrm, -rd), 0.0), 2.0);
        col = vec3(0.16, 0.18, 0.24) * (0.3 + dif) + rim * 0.15;
        float edge = 1.0 - smoothstep(0.0, 0.06, n - umbral);
        col += borde * edge * 2.2;
        break;
      }
      t += 0.01; // la superficie está disuelta aquí: seguimos hacia dentro
    }
    t += abs(d);
    if (t > 8.0) break;
  }
  gl_FragColor = vec4(col, 1.0);
}`,

    /* ---------- Holograma: líneas de escaneo + fresnel ---------- */
    holo: `
float shape(vec3 p) {
  p.xz = rot(u_time * 0.5 + u_mouse.x * 1.2) * p.xz;
  p.yz = rot(u_mouse.y * 0.4) * p.yz;
  return sdRoundBox(p, vec3(0.5, 0.85, 0.06), 0.06);
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(shape(p + e.xyy) - shape(p - e.xyy), shape(p + e.yxy) - shape(p - e.yxy), shape(p + e.yyx) - shape(p - e.yyx)));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 q = (uv - u_center) * 3.1 * u_zoom;
  // fallo de señal al hacer clic: franjas desplazadas
  float glitch = exp(-u_click * 3.0) * step(0.0, u_click);
  q.x += glitch * (hash(vec2(floor(q.y * 18.0), floor(u_time * 20.0))) - 0.5) * 0.4;
  vec3 ro = vec3(0.0, 0.0, 4.0), rd = normalize(vec3(q, -2.5));
  vec3 col = background(uv);
  vec3 tint = vec3(0.3, 0.85, 1.0);

  float t = 0.0;
  for (int i = 0; i < 56; i++) {
    vec3 p = ro + rd * t;
    float d = shape(p);
    if (d < 0.002) {
      vec3 n = normalAt(p);
      float fres = pow(1.0 - abs(dot(n, rd)), 2.0);
      float scan = 0.5 + 0.5 * sin((p.y * 14.0 - u_time * 3.0) * 6.2831);
      float fine = 0.75 + 0.25 * sin(gl_FragCoord.y * 1.6);
      float flicker = 0.85 + 0.15 * sin(u_time * 37.0) * sin(u_time * 7.0);
      float alpha = (0.18 + fres * 0.9) * (0.45 + scan * 0.55) * fine * flicker;
      col = mix(col, tint * (0.6 + fres * 1.8), clamp(alpha, 0.0, 1.0));
      break;
    }
    t += d;
    if (t > 8.0) break;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  };

  const NOTES = {
    aura: "Fresnel y ruido que sube, en tres bandas toon. Haz clic para transformar.",
    fuego: "Flamas procedurales con distorsión que crece hacia la punta. Mueve el cursor como viento; clic para avivarlas.",
    disolver: "La figura se corta con ruido 3D y deja un borde brillante. Clic para cambiar el color del borde.",
    holo: "Líneas de escaneo, fresnel y parpadeo sobre una pantalla. Clic para provocar una falla de señal.",
  };

  /* ---------- Compilación ---------- */
  const VERT = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const programs = {};
  function program(name) {
    if (programs[name]) return programs[name];
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEADER + SHADERS[name]));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    ["u_res", "u_time", "u_mouse", "u_center", "u_param", "u_click", "u_variant", "u_zoom"].forEach((k) => { u[k] = gl.getUniformLocation(p, k); });
    return (programs[name] = { p, u });
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ---------- Estado ---------- */
  let current = "aura";
  try { program(current); } catch (e) { console.error(e); hero.classList.add("no-webgl"); return; }

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let clickAt = -100, variant = 0, mix = 0, mixTarget = 0, visible = true;
  const start = performance.now();
  const slider = document.getElementById("lab-mix");
  const sliderWrap = document.getElementById("lab-slider");
  const note = document.getElementById("lab-note");

  /* tamaño: media resolución basta para un efecto suave y ahorra mucha GPU */
  let center = [0.45, 0], zoom = 1;
  function resize() {
    const r = hero.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2) * (r.width > 900 ? 0.55 : 0.7);
    canvas.width = Math.max(1, Math.round(r.width * scale));
    canvas.height = Math.max(1, Math.round(r.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = r.width / r.height;
    // en escritorio el efecto va a la derecha; en celular, arriba
    center = r.width > 760 ? [aspect * 0.25, 0.1] : [0, 0.3];
    zoom = r.width > 760 ? 1 : 1.5;
    if (reduceMotion) draw(performance.now());
  }
  new ResizeObserver(resize).observe(hero);

  /* ---------- Interacción ---------- */
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
  });
  hero.addEventListener("pointerleave", () => { mouse.tx = 0; mouse.ty = 0; });
  hero.addEventListener("click", (e) => {
    if (e.target.closest("a, button, input, label")) return;
    clickAt = performance.now();
    variant = (variant + 1) % 3;
    if (current === "aura") { mixTarget = mixTarget > 0.5 ? 0 : 1; }
  });
  slider.addEventListener("input", () => { mixTarget = mix = +slider.value; });

  document.querySelectorAll("[data-shader]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.shader;
      try { program(name); } catch (e) { console.error(e); return; }
      current = name;
      document.querySelectorAll("[data-shader]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      note.textContent = NOTES[name];
      sliderWrap.hidden = name !== "aura";
      clickAt = -100;
      if (reduceMotion) draw(performance.now());
    });
  });

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(hero);

  /* ---------- Dibujo ---------- */
  function draw(now) {
    const { p, u } = program(current);
    gl.useProgram(p);
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    mix += (mixTarget - mix) * 0.05;
    if (Math.abs(mix - +slider.value) > 0.01) slider.value = mix.toFixed(2);
    const t = reduceMotion ? 2.0 : (now - start) / 1000;
    gl.uniform2f(u.u_res, canvas.width, canvas.height);
    gl.uniform1f(u.u_time, t);
    gl.uniform2f(u.u_mouse, mouse.x, mouse.y);
    gl.uniform2f(u.u_center, center[0], center[1]);
    gl.uniform1f(u.u_param, mix);
    gl.uniform1f(u.u_click, clickAt < 0 ? -1 : (now - clickAt) / 1000);
    gl.uniform1f(u.u_variant, variant);
    gl.uniform1f(u.u_zoom, zoom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    if (visible && !document.hidden) draw(now);
    requestAnimationFrame(loop);
  }

  resize();
  canvas.classList.add("is-ready");
  if (reduceMotion) {
    draw(performance.now());
    hero.addEventListener("pointermove", () => draw(performance.now()));
  } else {
    requestAnimationFrame(loop);
  }
})();
