/**
 * Modular Chord Circle Studio — browser UI (vanilla JS + SVG DOM).
 * Mirrors chords.py model: edge i → (k*i mod N); self-loops skipped.
 * Offline only — no fetch / no CDN.
 */
(function () {
  "use strict";

  const MAX_N = 400;
  const MIN_N = 3;
  const DEFAULT_N = 200;
  const DEFAULT_K = 2;
  const SIZE = 720;
  const MARGIN = 36;
  const BG = "#0b1020";
  const RING = "#1e293b";
  const POINT = "#67e8f9";
  const ACCENT = "#a5b4fc";
  const MUTED = "#94a3b8";
  const SOLID = "#f472b6";

  const els = {
    nSlider: document.getElementById("nSlider"),
    kSlider: document.getElementById("kSlider"),
    nVal: document.getElementById("nVal"),
    kVal: document.getElementById("kVal"),
    colorMode: document.getElementById("colorMode"),
    btnReset: document.getElementById("btnReset"),
    btnAnimate: document.getElementById("btnAnimate"),
    btnExport: document.getElementById("btnExport"),
    status: document.getElementById("status"),
    stage: document.getElementById("stage"),
  };

  let animId = null;
  let animLast = 0;

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  function modularTarget(i, k, n) {
    return (((k * i) % n) + n) % n;
  }

  function chordEdges(n, k) {
    const edges = [];
    for (let i = 0; i < n; i++) {
      const j = modularTarget(i, k, n);
      if (j !== i) edges.push([i, j]);
    }
    return edges;
  }

  function pointCoords(n, cx, cy, radius) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const theta = (2 * Math.PI * i) / n;
      pts.push([cx + radius * Math.cos(theta), cy + radius * Math.sin(theta)]);
    }
    return pts;
  }

  function chordLength(i, j, pts) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[j];
    return Math.hypot(x1 - x0, y1 - y0);
  }

  function edgeColor(i, j, n, pts, mode) {
    if (mode === "solid") return SOLID;
    if (mode === "length") {
      const diameter = 2 * (SIZE / 2 - MARGIN);
      const t = Math.min(1, chordLength(i, j, pts) / diameter);
      return hslToHex(190 + t * 140, 0.85, 0.62);
    }
    return hslToHex((i / Math.max(n, 1)) * 360, 0.8, 0.62);
  }

  function clampNK() {
    let n = parseInt(els.nSlider.value, 10);
    if (!Number.isFinite(n)) n = DEFAULT_N;
    n = Math.max(MIN_N, Math.min(MAX_N, n));
    els.nSlider.value = String(n);
    els.kSlider.max = String(Math.max(0, n - 1));
    let k = parseInt(els.kSlider.value, 10);
    if (!Number.isFinite(k)) k = DEFAULT_K;
    k = Math.max(0, Math.min(n - 1, k));
    els.kSlider.value = String(k);
    els.nVal.textContent = String(n);
    els.kVal.textContent = String(k);
    return { n, k };
  }

  function render() {
    const { n, k } = clampNK();
    const mode = els.colorMode.value || "index";
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const radius = SIZE / 2 - MARGIN;
    const pts = pointCoords(n, cx, cy, radius);
    const edges = chordEdges(n, k);
    const strokeW = n >= 120 ? 1.1 : n >= 60 ? 1.4 : 1.8;

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute("width", String(SIZE));
    svg.setAttribute("height", String(SIZE));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Modular chords N=${n} k=${k}`);

    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", BG);
    svg.appendChild(bg);

    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", String(cx));
    ring.setAttribute("cy", String(cy));
    ring.setAttribute("r", String(radius));
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", RING);
    ring.setAttribute("stroke-width", "1.5");
    svg.appendChild(ring);

    const title = document.createElementNS(ns, "text");
    title.setAttribute("x", String(SIZE / 2));
    title.setAttribute("y", "22");
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("fill", ACCENT);
    title.setAttribute("font-family", "ui-sans-serif,system-ui,sans-serif");
    title.setAttribute("font-size", "14");
    title.setAttribute("font-weight", "600");
    title.textContent = `Modular chords · N=${n} · k=${k}`;
    svg.appendChild(title);

    const foot = document.createElementNS(ns, "text");
    foot.setAttribute("x", String(SIZE / 2));
    foot.setAttribute("y", String(SIZE - 12));
    foot.setAttribute("text-anchor", "middle");
    foot.setAttribute("fill", MUTED);
    foot.setAttribute("font-family", "ui-monospace,Menlo,monospace");
    foot.setAttribute("font-size", "11");
    foot.textContent = `edges=${edges.length} (self-loops skipped) · offline`;
    svg.appendChild(foot);

    const g = document.createElementNS(ns, "g");
    g.setAttribute("id", "chords");
    g.setAttribute("stroke-linecap", "round");
    g.setAttribute("stroke-opacity", "0.85");
    for (const [i, j] of edges) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[j];
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", x0.toFixed(3));
      line.setAttribute("y1", y0.toFixed(3));
      line.setAttribute("x2", x1.toFixed(3));
      line.setAttribute("y2", y1.toFixed(3));
      line.setAttribute("stroke", edgeColor(i, j, n, pts, mode));
      line.setAttribute("stroke-width", String(strokeW));
      g.appendChild(line);
    }
    svg.appendChild(g);

    if (n <= 120) {
      const pg = document.createElementNS(ns, "g");
      pg.setAttribute("id", "points");
      const pr = n > 60 ? 2.2 : 3.0;
      for (const [x, y] of pts) {
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("cx", x.toFixed(3));
        c.setAttribute("cy", y.toFixed(3));
        c.setAttribute("r", String(pr));
        c.setAttribute("fill", POINT);
        pg.appendChild(c);
      }
      svg.appendChild(pg);
    }

    els.stage.replaceChildren(svg);
    els.status.innerHTML = `N=<strong>${n}</strong> k=<strong>${k}</strong> · ${edges.length} chords · ${mode}`;
    return svg;
  }

  function stopAnimate() {
    if (animId != null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    els.btnAnimate.classList.remove("active");
    els.btnAnimate.textContent = "Animate k";
  }

  function startAnimate() {
    stopAnimate();
    els.btnAnimate.classList.add("active");
    els.btnAnimate.textContent = "Stop";
    animLast = 0;
    const tick = (ts) => {
      if (!animLast) animLast = ts;
      if (ts - animLast >= 120) {
        animLast = ts;
        const { n } = clampNK();
        let k = parseInt(els.kSlider.value, 10) + 1;
        if (k >= n) k = 0;
        els.kSlider.value = String(k);
        render();
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
  }

  function exportSvg() {
    const svg = els.stage.querySelector("svg");
    if (!svg) return;
    const { n, k } = clampNK();
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chords-n${n}-k${k}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    els.status.innerHTML = `exported <strong>chords-n${n}-k${k}.svg</strong>`;
  }

  els.nSlider.addEventListener("input", () => {
    clampNK();
    render();
  });
  els.kSlider.addEventListener("input", () => {
    clampNK();
    render();
  });
  els.colorMode.addEventListener("change", render);
  els.btnReset.addEventListener("click", () => {
    stopAnimate();
    els.nSlider.value = String(DEFAULT_N);
    els.kSlider.value = String(DEFAULT_K);
    els.colorMode.value = "index";
    render();
  });
  els.btnAnimate.addEventListener("click", () => {
    if (animId != null) stopAnimate();
    else startAnimate();
  });
  els.btnExport.addEventListener("click", exportSvg);

  // Initial paint — hero cardioid
  render();
})();
