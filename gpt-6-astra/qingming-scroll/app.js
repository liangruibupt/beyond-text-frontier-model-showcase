/* The painting stays in image coordinates; only hand-masked subjects are displaced. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const assets = window.SCROLL_ASSETS;
  const canvas = $("painting");
  const stage = document.querySelector(".stage");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = {
    country: { x: 20140, title: "郊野春风", index: "第一景" },
    river: { x: 16640, title: "汴河行舟", index: "第二景" },
    bridge: { x: 13350, title: "虹桥人家", index: "第三景" },
    gate: { x: 4890, title: "城门往来", index: "第四景" },
    market: { x: 2020, title: "街市烟火", index: "第五景" },
  };
  const state = {
    x: scenes.bridge.x, y: 600, zoom: 1, time: 0, speed: 1,
    playing: !reducedMotion.matches, people: true, water: true, wind: 0.55,
    original: false, tour: false, scene: "bridge", ready: false,
    reveal: 1, tourElapsed: 0,
  };
  let width = 1;
  let height = 1;
  let ratio = 1;
  let lastFrame = 0;
  let lastUI = 0;
  let transition = null;
  const tourDuration = 120;
  let noticeTimeout;
  let lost = false;
  let characters = null;
  let ripple = [-10000, -10000, -100];
  const pointers = new Map();
  let pinch = null;
  let pointerDistance = 0;
  let pointerStart = null;
  const tiles = assets.tiles.map((tile) => ({ ...tile, status: "idle" }));

  function icon(button, name) {
    button.replaceChildren();
    const placeholder = document.createElement("i");
    placeholder.dataset.lucide = name;
    button.appendChild(placeholder);
    window.lucide?.createIcons();
  }

  function notify(message) {
    clearTimeout(noticeTimeout);
    $("notice").textContent = message;
    $("notice").hidden = false;
    noticeTimeout = setTimeout(() => { $("notice").hidden = true; }, 3500);
  }

  const gl = canvas.getContext("webgl", {
    alpha: false, antialias: false, preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  if (!gl) {
    $("loading-text").textContent = "未能启用图形加速，请使用支持 WebGL 的浏览器打开画卷。";
    document.querySelector(".loading-line").hidden = true;
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    uniform vec4 u_bounds;
    uniform vec2 u_camera;
    uniform vec2 u_view;
    varying vec2 v_world;
    void main() {
      v_world = u_bounds.xy + a_position * u_bounds.zw;
      vec2 screen = (v_world - u_camera) / u_view;
      gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    uniform sampler2D u_image;
    uniform sampler2D u_mask;
    uniform vec3 u_tile;
    uniform float u_time;
    uniform float u_people;
    uniform float u_water;
    uniform float u_wind;
    uniform float u_original;
    uniform vec3 u_ripple;
    varying vec2 v_world;

    void main() {
      vec2 uv = vec2((v_world.x - u_tile.x) / u_tile.y, v_world.y / u_tile.z);
      vec4 m = texture2D(u_mask, uv);
      float person = step(0.06, m.b) * (1.0 - step(0.25, m.b));
      float tree = step(0.30, m.b) * (1.0 - step(0.53, m.b));
      float water = step(0.60, m.b) * (1.0 - step(0.72, m.b));
      float boat = step(0.78, m.b);
      float phase = m.b * 163.0;
      float t = u_time;
      vec2 d = vec2(0.0);

      float stride = sin(t * 3.6 + phase);
      float lower = smoothstep(0.48, 0.86, m.g);
      float side = smoothstep(0.30, 0.70, m.r) * 2.0 - 1.0;
      float arm = sin(m.g * 3.14159) * smoothstep(0.13, 0.38, abs(m.r - 0.5));
      vec2 gesture = vec2(
        sin(t * 1.8 + phase) * (1.0 - m.g) * 2.5
          + stride * side * lower * 3.4
          + sin(t * 2.2 + phase) * arm * 3.1,
        (cos(t * 3.6 + phase) * 1.3 - 0.7) * (1.0 - m.g)
          + sin(t * 2.2 + phase) * arm * 1.4
      );
      d += gesture * person * u_people;

      // Roots are pinned. Higher, thinner branches respond more strongly to a gust.
      float branch = pow(1.0 - m.g, 1.65);
      float gust = sin(t * 0.87 + phase) * 0.64
        + sin(t * 1.57 + phase * 1.3) * 0.25
        + sin(t * 2.6 + m.r * 7.0 + phase) * 0.11;
      d.x += tree * u_wind * branch * (gust * 37.0 + sin(t * 2.7 + m.g * 10.0) * 3.8);
      d.y += tree * u_wind * branch * sin(t * 1.26 + phase + m.r * 3.0) * 4.5;

      float flow = sin(v_world.y * 0.12 + sin(v_world.x * 0.012 - t * 0.6) * 2.0 - t * 1.8);
      float swell = sin(v_world.x * 0.023 + v_world.y * 0.077 - t * 1.3);
      d += water * u_water * vec2(swell * 2.2, flow * 1.6) * (0.45 + u_wind);
      d += boat * u_water * vec2(sin(t * 0.55 + phase) * 3.8, sin(t * 1.3 + phase) * 2.7);

      vec2 warped = uv - d * m.a * (1.0 - u_original) / u_tile.yz;
      vec3 color = texture2D(u_image, warped).rgb;
      float dash = smoothstep(0.40, 0.88, sin(v_world.x * 0.038 + v_world.y * 0.014 + t * 0.28));
      float crest = smoothstep(0.88, 0.99, flow);
      float trough = smoothstep(0.89, 1.0, -flow);
      float pattern = (crest * 0.053 - trough * 0.037) * dash;
      float age = t - u_ripple.z;
      float radius = length((v_world - u_ripple.xy) * vec2(0.32, 1.0));
      float ring = exp(-pow((radius - age * 26.0) * 0.07, 2.0))
        * sin(radius * 0.55 - age * 15.0) * max(0.0, 1.0 - age / 4.0);
      pattern += ring * 0.05 * step(0.0, age);
      color += vec3(pattern * water * m.a * u_water * (1.0 - u_original));
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  let program;
  let paintingBuffer;
  const uniforms = {};
  function initializeGL() {
    program = gl.createProgram();
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "a_position");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    paintingBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, paintingBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    for (const name of [
      "bounds", "camera", "view", "image", "mask", "tile",
      "time", "people", "water", "wind", "original", "ripple",
    ]) {
      uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
    }
    gl.uniform1i(uniforms.image, 0);
    gl.uniform1i(uniforms.mask, 1);
  }

  function fatal(message, error) {
    console.error(error);
    $("loading").hidden = false;
    $("loading-text").textContent = message;
    $("retry").hidden = false;
    $("retry").onclick = () => location.reload();
  }

  try { initializeGL(); } catch (error) {
    fatal("画卷渲染初始化失败，请重新加载。", error);
    return;
  }
  characters = new window.QingmingCharacters(gl, () => render());

  function texture(image) {
    const item = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, item);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return item;
  }

  function decode(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image decoding failed"));
      image.src = source;
    });
  }

  // Script-loaded data URIs keep WebGL origin-clean when opened directly from disk.
  window.qingmingTile = async (index, payload) => {
    const tile = tiles[index];
    try {
      const [image, mask] = await Promise.all([decode(payload.image), decode(payload.mask)]);
      if (lost) { tile.status = "idle"; return; }
      gl.activeTexture(gl.TEXTURE0);
      tile.imageTexture = texture(image);
      tile.maskTexture = texture(mask);
      tile.status = "ready";
      tile.resolve?.();
      tile.resolve = null;
      tile.script?.remove();
      tile.script = null;
      render();
    } catch (error) {
      tile.status = "error";
      tile.reject?.(error);
    }
  };

  function loadTile(tile) {
    if (tile.status === "ready") return Promise.resolve();
    if (tile.status === "loading") return tile.promise;
    tile.status = "loading";
    tile.promise = new Promise((resolve, reject) => {
      tile.resolve = resolve;
      tile.reject = reject;
      const script = document.createElement("script");
      tile.script = script;
      script.src = tile.src;
      script.async = true;
      script.onerror = () => {
        tile.status = "error";
        script.remove();
        reject(new Error(`Could not load ${tile.src}`));
      };
      document.head.appendChild(script);
    });
    return tile.promise;
  }

  function view() {
    const scale = height / assets.height * state.zoom;
    const w = width / scale;
    const h = height / scale;
    return { scale, w, h, left: state.x - w / 2, top: state.y - h / 2 };
  }

  function clampCamera() {
    const camera = view();
    state.x = Math.max(540 + camera.w / 2, Math.min(25020 - camera.w / 2, state.x));
    state.y = Math.max(camera.h / 2, Math.min(assets.height - camera.h / 2, state.y));
  }

  function visibleTiles() {
    const camera = view();
    return tiles.filter((tile) => tile.end > camera.left && tile.start < camera.left + camera.w);
  }

  function requestVisible() {
    const visible = visibleTiles();
    const failed = characters.error || visible.some((tile) => tile.status === "error");
    $("loading").hidden = !failed && characters.ready && visible.every((tile) => tile.status === "ready");
    $("loading-text").textContent = failed ? "这一段画卷未能加载" : "正在展卷";
    $("retry").hidden = !failed;
    for (const tile of visible) {
      if (tile.status === "idle") loadTile(tile).catch(() => requestVisible());
    }
    state.ready = characters.ready && visible.every((tile) => tile.status === "ready");
    if (state.ready) {
      const first = tiles.indexOf(visible[0]);
      const last = tiles.indexOf(visible[visible.length - 1]);
      for (const index of [first - 1, last + 1]) {
        if (tiles[index]?.status === "idle") loadTile(tiles[index]).catch(() => {});
      }
      // Keep at most the current neighborhood in GPU memory.
      for (let index = 0; index < tiles.length; index++) {
        if (index < first - 1 || index > last + 1) {
          const tile = tiles[index];
          if (tile.status === "ready") {
            gl.deleteTexture(tile.imageTexture);
            gl.deleteTexture(tile.maskTexture);
            tile.status = "idle";
          }
        }
      }
    }
  }

  function render() {
    if (lost) return;
    const camera = view();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.125, 0.141, 0.129, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const edge = Math.round(canvas.width * (1 - state.reveal));
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(edge, 0, canvas.width - edge, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, paintingBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.camera, camera.left, camera.top);
    gl.uniform2f(uniforms.view, camera.w, camera.h);
    gl.uniform1f(uniforms.time, state.time);
    gl.uniform1f(uniforms.people, state.people ? 1 : 0);
    gl.uniform1f(uniforms.water, state.water ? 1 : 0);
    gl.uniform1f(uniforms.wind, state.wind);
    gl.uniform1f(uniforms.original, state.original ? 1 : 0);
    gl.uniform3f(uniforms.ripple, ...ripple);
    for (const tile of visibleTiles()) {
      if (tile.status !== "ready") continue;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tile.imageTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tile.maskTexture);
      gl.uniform3f(uniforms.tile, tile.x, tile.width, assets.height);
      gl.uniform4f(uniforms.bounds, tile.start, 0, tile.end - tile.start, assets.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (state.people && !state.original) characters.draw(camera, state.time);
    gl.disable(gl.SCISSOR_TEST);
    stage.style.setProperty("--scroll-edge", `${(1 - state.reveal) * 100}%`);
    stage.classList.toggle("unrolling", state.reveal < 1);
    requestVisible();
  }

  function updateUI() {
    const camera = view();
    $("view-window").style.left = `${camera.left / assets.width * 100}%`;
    $("view-window").style.width = `${camera.w / assets.width * 100}%`;
    $("position").value = Math.round(state.x);
    $("zoom-label").value = `${state.zoom.toFixed(1)}×`;
    $("zoom-out").disabled = state.zoom <= 1;
    $("zoom-in").disabled = state.zoom >= 3.5;
    let nearest = "bridge";
    for (const key of Object.keys(scenes)) {
      if (Math.abs(scenes[key].x - state.x) < Math.abs(scenes[nearest].x - state.x)) nearest = key;
    }
    if (!transition) state.scene = nearest;
    const scene = scenes[state.scene];
    $("scene-title").textContent = scene.title;
    $("scene-index").textContent = scene.index;
    document.querySelectorAll("[data-scene]").forEach((button) => {
      if (button.dataset.scene === state.scene) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  function playbackUI() {
    const paused = !state.playing || state.original;
    icon($("play"), paused ? "play" : "pause");
    $("play").setAttribute("aria-label", paused ? "播放动画" : "暂停动画");
    $("play").dataset.tip = paused ? "播放" : "暂停";
    $("play-state").textContent = state.original ? "原画静览" : paused ? "画卷已静止" : "画卷正生息";
    $("live-dot").classList.toggle("paused", paused);
    $("original").setAttribute("aria-pressed", String(state.original));
    $("tour").setAttribute("aria-pressed", String(state.tour));
  }

  function stopTour() {
    state.tour = false;
    state.reveal = 1;
    $("tour").setAttribute("aria-pressed", "false");
    transition = null;
  }

  function tourFrame(elapsed, duration = tourDuration) {
    state.zoom = 1;
    state.y = 600;
    const camera = view();
    const start = 25020 - camera.w / 2;
    const end = 540 + camera.w / 2;
    const opening = Math.max(0, Math.min(1, elapsed / 2.4));
    state.reveal = opening * opening * (3 - 2 * opening);
    const progress = Math.max(0, Math.min(1, (elapsed - 2.4) / (duration - 4.8)));
    // Slow at each end without stopping or reversing through the painted street.
    const ramp = .06;
    const ease = progress < ramp ? progress ** 2 / (2 * ramp)
      : progress > 1 - ramp ? 1 - ramp - (1 - progress) ** 2 / (2 * ramp)
      : progress - ramp / 2;
    state.x = start + (end - start) * ease / (1 - ramp);
    clampCamera();
  }

  function setZoom(value, anchor = { x: width / 2, y: height / 2 }) {
    stopTour();
    const before = view();
    const worldX = before.left + anchor.x / before.scale;
    const worldY = before.top + anchor.y / before.scale;
    state.zoom = Math.max(1, Math.min(3.5, value));
    const after = view();
    state.x = worldX - (anchor.x - width / 2) / after.scale;
    state.y = worldY - (anchor.y - height / 2) / after.scale;
    clampCamera();
    render();
    updateUI();
  }

  function chooseScene(key) {
    stopTour();
    state.scene = key;
    const target = scenes[key];
    if (reducedMotion.matches) {
      state.x = target.x;
      state.y = 600;
      state.zoom = 1;
      clampCamera();
    } else {
      transition = {
        start: performance.now(), fromX: state.x, fromY: state.y, fromZoom: state.zoom,
        toX: target.x, duration: Math.min(1600, 650 + Math.abs(target.x - state.x) * 0.065),
      };
      const index = Math.floor(target.x / 3000);
      [index - 1, index, index + 1].forEach((i) => {
        if (tiles[i]) loadTile(tiles[i]).catch(() => {});
      });
    }
    render();
    updateUI();
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    clampCamera();
    render();
    updateUI();
  }

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.06) : 0;
    lastFrame = now;
    if (!document.hidden && !lost) {
      let changed = false;
      if (state.playing && !state.original && state.ready) {
        state.time += dt * state.speed;
        changed = true;
      }
      if (transition) {
        const p = Math.min(1, (now - transition.start) / transition.duration);
        const ease = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
        state.x = transition.fromX + (transition.toX - transition.fromX) * ease;
        state.y = transition.fromY + (600 - transition.fromY) * ease;
        state.zoom = transition.fromZoom + (1 - transition.fromZoom) * ease;
        if (p === 1) transition = null;
        changed = true;
      } else if (state.tour && state.playing && !state.original && state.ready) {
        state.tourElapsed = Math.min(tourDuration, state.tourElapsed + dt * state.speed);
        tourFrame(state.tourElapsed);
        if (state.tourElapsed === tourDuration) {
          state.tour = false;
          playbackUI();
        }
        changed = true;
      }
      if (changed) { clampCamera(); render(); }
      if (now - lastUI > 90) { updateUI(); lastUI = now; }
    }
    requestAnimationFrame(frame);
  }

  $("play").addEventListener("click", () => {
    if (state.original) { state.original = false; state.playing = true; }
    else state.playing = !state.playing;
    playbackUI();
    render();
  });
  $("tour").addEventListener("click", () => {
    if (state.tour) stopTour();
    else {
      transition = null;
      state.tour = true;
      state.tourElapsed = 0;
      state.playing = true;
      state.original = false;
      tourFrame(0);
    }
    playbackUI();
    render();
    updateUI();
  });
  $("original").addEventListener("click", () => {
    stopTour();
    state.original = !state.original;
    playbackUI();
    render();
  });
  $("people").addEventListener("change", (event) => { state.people = event.target.checked; render(); });
  $("water").addEventListener("change", (event) => { state.water = event.target.checked; render(); });
  $("wind").addEventListener("input", (event) => {
    state.wind = Number(event.target.value) / 100;
    $("wind-value").value = event.target.value;
    render();
  });
  $("pace").addEventListener("change", (event) => { state.speed = Number(event.target.value); });
  $("zoom-in").addEventListener("click", () => setZoom(state.zoom + 0.25));
  $("zoom-out").addEventListener("click", () => setZoom(state.zoom - 0.25));
  $("reset").addEventListener("click", () => chooseScene(state.scene));
  $("position").addEventListener("input", (event) => {
    stopTour();
    state.x = Number(event.target.value);
    clampCamera();
    render();
    updateUI();
  });
  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.addEventListener("click", () => chooseScene(button.dataset.scene));
  });
  $("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify("当前浏览器不支持全屏显示");
    } catch { notify("当前浏览器未允许全屏显示"); }
  });
  document.addEventListener("fullscreenchange", () => {
    icon($("fullscreen"), document.fullscreenElement ? "minimize" : "maximize");
    $("fullscreen").setAttribute("aria-label", document.fullscreenElement ? "退出全屏" : "进入全屏");
    $("fullscreen").dataset.tip = document.fullscreenElement ? "退出全屏" : "全屏";
  });
  $("snapshot").addEventListener("click", () => {
    if (!state.ready) { notify("画卷仍在加载中"); return; }
    render();
    canvas.toBlob((blob) => {
      if (!blob) { notify("画面保存失败"); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `qingming-${state.scene}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
  });
  $("retry").addEventListener("click", () => {
    if (!program || characters.error) { location.reload(); return; }
    for (const tile of tiles) if (tile.status === "error") tile.status = "idle";
    requestVisible();
  });

  function localPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  function pinchMetrics() {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    stopTour();
    canvas.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    pointerStart = point;
    pointerDistance = 0;
    canvas.classList.add("dragging");
    if (pointers.size === 2) pinch = { ...pinchMetrics(), zoom: state.zoom };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event);
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, point);
    pointerDistance += Math.hypot(point.x - previous.x, point.y - previous.y);
    if (pointers.size === 2 && pinch) {
      const current = pinchMetrics();
      const oldCenter = pinch.center;
      setZoom(pinch.zoom * current.distance / Math.max(1, pinch.distance), current.center);
      const scale = view().scale;
      state.x -= (current.center.x - oldCenter.x) / scale;
      state.y -= (current.center.y - oldCenter.y) / scale;
      pinch.center = current.center;
    } else {
      const scale = view().scale;
      state.x -= (point.x - previous.x) / scale;
      state.y -= (point.y - previous.y) / scale;
    }
    clampCamera();
    render();
    updateUI();
  });
  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    if (event.type === "pointerup" && pointers.size === 1 && pointerDistance < 5 && pointerStart) {
      const camera = view();
      ripple = [camera.left + pointerStart.x / camera.scale, camera.top + pointerStart.y / camera.scale, state.time];
    }
    pointers.delete(event.pointerId);
    pinch = null;
    if (pointers.size === 0) canvas.classList.remove("dragging");
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      stopTour();
      state.x += event.deltaX / view().scale;
      clampCamera();
      render();
      updateUI();
    } else setZoom(state.zoom * Math.exp(-event.deltaY * 0.0015), localPoint(event));
  }, { passive: false });
  canvas.addEventListener("dblclick", (event) => {
    setZoom(state.zoom > 1.5 ? 1 : 2.2, localPoint(event));
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === " ") { event.preventDefault(); $("play").click(); }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      stopTour();
      const delta = event.shiftKey ? 350 : 120;
      if (event.key === "ArrowLeft") state.x -= delta;
      if (event.key === "ArrowRight") state.x += delta;
      if (event.key === "ArrowUp") state.y -= delta;
      if (event.key === "ArrowDown") state.y += delta;
      clampCamera();
      render();
      updateUI();
    } else if (event.key === "+" || event.key === "=") setZoom(state.zoom + 0.25);
    else if (event.key === "-") setZoom(state.zoom - 0.25);
    else if (event.key === "0") chooseScene(state.scene);
  });
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) {
      state.playing = false;
      stopTour();
      playbackUI();
      render();
    }
  });
  document.addEventListener("visibilitychange", () => { lastFrame = 0; });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    $("loading").hidden = false;
    $("loading-text").textContent = "正在恢复画卷";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    try {
      initializeGL();
      characters.initialize();
      characters.upload();
      for (const tile of tiles) tile.status = "idle";
      resize();
    } catch (error) { fatal("图形加速恢复失败，请刷新页面。", error); }
  });

  // Deterministic frame rendering is also used to export and verify the animation.
  window.qingming = {
    getState: () => ({ ...state, viewport: view(), tiles: tiles.map((tile) => tile.status) }),
    seek: (time) => { state.time = Math.max(0, Number(time) || 0); render(); },
    actorPoses: (time = state.time) => characters.inspect(time),
    renderTourFrame: async (time, duration = tourDuration) => {
      if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 4.8) {
        throw new Error("Tour time and duration must be finite; duration must exceed 4.8 seconds");
      }
      const updatePlayback = state.playing || state.original || state.tour;
      stopTour();
      state.playing = false;
      state.original = false;
      state.time = Math.max(0, time);
      tourFrame(state.time, duration);
      await Promise.all(visibleTiles().map(loadTile));
      render();
      updateUI();
      if (updatePlayback) playbackUI();
      return { x: state.x, reveal: state.reveal, ready: state.ready };
    },
    moveTo: (x, y = 600, zoom = state.zoom) => {
      stopTour(); state.x = x; state.y = y;
      state.zoom = Math.max(1, Math.min(3.5, zoom));
      clampCamera(); render(); updateUI();
    },
  };
  window.lucide?.createIcons();
  playbackUI();
  new ResizeObserver(resize).observe(stage);
  resize();
  requestAnimationFrame(frame);
})();
