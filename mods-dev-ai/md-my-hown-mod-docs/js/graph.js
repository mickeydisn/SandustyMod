/**
 * Clean hierarchical relation graph — ranks by dependency, no layer rings.
 */
(function () {
  const NODES = [
    { id: "elements", label: "Elements", section: "content", anchor: "c-elements", color: "#6b9eff" },
    { id: "terrains", label: "Terrains", section: "content", anchor: "c-terrains", color: "#a08060" },
    { id: "sprites", label: "Sprites", section: "content", anchor: "c-sprites", color: "#7ec8e3" },
    { id: "buffers", label: "Buffers", section: "content", anchor: "c-buffers", color: "#8fbc8f" },
    { id: "structures", label: "Structures", section: "content", anchor: "c-structures", color: "#5ec4a0" },
    { id: "items", label: "Items", section: "content", anchor: "c-items", color: "#b794f4" },
    { id: "contacts", label: "Contacts", section: "systems", anchor: "s-contacts", color: "#e8b84a" },
    { id: "recipes", label: "Recipes", section: "systems", anchor: "s-recipes", color: "#e07a5f" },
    { id: "processing", label: "Processors", section: "systems", anchor: "s-processing", color: "#d64550" },
    { id: "techs", label: "Tech nodes", section: "systems", anchor: "s-techs", color: "#5b8def" },
    { id: "unlockNodes", label: "Unlock nodes", section: "systems", anchor: "s-unlock", color: "#7aa2f7" },
    { id: "upgrades", label: "Upgrades", section: "systems", anchor: "s-upgrades", color: "#c084fc" },
    { id: "triggers", label: "Triggers", section: "systems", anchor: "s-triggers", color: "#f0a070" },
    { id: "signals", label: "Signals", section: "systems", anchor: "s-signals", color: "#f5b880" },
    { id: "modifiers", label: "Modifiers", section: "systems", anchor: "s-modifiers", color: "#e89870" },
    { id: "networks", label: "Energy nets", section: "systems", anchor: "s-networks", color: "#2dd4bf" },
    { id: "energy", label: "Energy nodes", section: "systems", anchor: "s-energy", color: "#14b8a6" },
    { id: "processes", label: "Processes", section: "handlers", anchor: "h-processes", color: "#fbbf24" },
    { id: "actions", label: "Atomic actions", section: "handlers", anchor: "h-actions", color: "#f59e0b" },
  ];

  // directed: source references target (or produces/uses)
  const EDGES = [
    { from: "contacts", to: "elements", label: "elementA/B · outputs" },
    { from: "recipes", to: "elements", label: "input / output" },
    { from: "terrains", to: "elements", label: "drop" },
    { from: "structures", to: "unlockNodes", label: "unlockNode" },
    { from: "structures", to: "sprites", label: "render.imageName" },
    { from: "structures", to: "processing", label: "hosts" },
    { from: "structures", to: "signals", label: "hosts" },
    { from: "structures", to: "energy", label: "hosts" },
    { from: "items", to: "sprites", label: "sprite.id" },
    { from: "items", to: "upgrades", label: "upgraded by" },
    { from: "items", to: "processes", label: "processId" },
    { from: "signals", to: "processes", label: "processId" },
    { from: "triggers", to: "processes", label: "processId" },
    { from: "processing", to: "processes", label: "processId" },
    { from: "upgrades", to: "processes", label: "processId" },
    { from: "modifiers", to: "processes", label: "processId" },
    { from: "processes", to: "actions", label: "steps[]" },
    { from: "processes", to: "buffers", label: "buffer R/W" },
    { from: "techs", to: "unlockNodes", label: "grants" },
    { from: "unlockNodes", to: "structures", label: "gates" },
    { from: "upgrades", to: "items", label: "targets" },
    { from: "energy", to: "networks", label: "network" },
    { from: "energy", to: "structures", label: "on structure" },
  ];

  const state = {
    onlyConnected: false,
    scale: 1,
    panX: 40,
    panY: 40,
    nodes: {},
    dragging: null,
    panning: false,
    lastX: 0,
    lastY: 0,
  };

  /** Rank = longest path from leaves (no incoming) — layout left → right */
  function computeRanks() {
    const ids = new Set(NODES.map((n) => n.id));
    const incoming = {};
    const outgoing = {};
    ids.forEach((id) => {
      incoming[id] = [];
      outgoing[id] = [];
    });
    EDGES.forEach((e) => {
      if (!ids.has(e.from) || !ids.has(e.to)) return;
      incoming[e.to].push(e.from);
      outgoing[e.from].push(e.to);
    });
    const rank = {};
    // sources first (few incoming from our graph)
    const order = [];
    const visit = (id, stack) => {
      if (rank[id] != null) return rank[id];
      if (stack.has(id)) return 0;
      stack.add(id);
      let r = 0;
      for (const p of incoming[id]) r = Math.max(r, visit(p, stack) + 1);
      stack.delete(id);
      rank[id] = r;
      return r;
    };
    ids.forEach((id) => visit(id, new Set()));
    return rank;
  }

  function initPositions() {
    const rank = computeRanks();
    const cols = {};
    NODES.forEach((n) => {
      const r = rank[n.id] || 0;
      if (!cols[r]) cols[r] = [];
      cols[r].push(n);
    });
    const colW = 200;
    const rowH = 56;
    Object.keys(cols)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((r) => {
        const list = cols[r];
        list.forEach((n, i) => {
          const totalH = list.length * rowH;
          const startY = 80 + (list.length === 1 ? 120 : 0);
          state.nodes[n.id] = {
            ...n,
            x: 100 + r * colW,
            y: startY + i * rowH + (280 - totalH) / 2,
          };
        });
      });
  }

  function visibleNodeIds() {
    let ids = NODES.map((n) => n.id);
    if (state.onlyConnected) {
      const linked = new Set();
      EDGES.forEach((e) => {
        linked.add(e.from);
        linked.add(e.to);
      });
      ids = ids.filter((id) => linked.has(id));
    }
    return ids;
  }

  function visibleEdges(nodeIds) {
    const set = new Set(nodeIds);
    return EDGES.filter((e) => set.has(e.from) && set.has(e.to));
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    const svg = document.getElementById("g-svg");
    if (!svg) return;
    const nodeIds = visibleNodeIds();
    const edges = visibleEdges(nodeIds);
    const W = svg.clientWidth || 1000;
    const H = svg.clientHeight || 640;

    const parts = [];
    parts.push(
      `<defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="rgba(255,255,255,0.28)"/>
        </marker>
      </defs>`
    );
    parts.push(`<g transform="translate(${state.panX},${state.panY}) scale(${state.scale})">`);

    // curved edges
    edges.forEach((e) => {
      const a = state.nodes[e.from];
      const b = state.nodes[e.to];
      if (!a || !b) return;
      const x1 = a.x + 52;
      const y1 = a.y;
      const x2 = b.x - 52;
      const y2 = b.y;
      const cx = (x1 + x2) / 2;
      const path = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
      parts.push(
        `<path d="${path}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.6" marker-end="url(#arrow)"/>`
      );
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 8;
      parts.push(
        `<text class="edge-label" x="${mx}" y="${my}" text-anchor="middle">${escapeXml(e.label)}</text>`
      );
    });

    nodeIds.forEach((id) => {
      const n = state.nodes[id];
      if (!n) return;
      const w = 104;
      const h = 40;
      parts.push(`<g class="g-node" data-id="${n.id}" data-section="${n.section}" data-anchor="${n.anchor || ""}" style="cursor:pointer">`);
      parts.push(
        `<rect x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" rx="10" fill="#1a1f2b" stroke="${n.color}" stroke-width="2"/>`
      );
      parts.push(
        `<circle cx="${n.x - w / 2 + 14}" cy="${n.y}" r="5" fill="${n.color}"/>`
      );
      parts.push(
        `<text class="node-label" x="${n.x + 6}" y="${n.y + 4}" text-anchor="middle">${escapeXml(n.label)}</text>`
      );
      parts.push(`</g>`);
    });

    parts.push(`</g>`);
    svg.innerHTML = parts.join("");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    svg.querySelectorAll(".g-node").forEach((el) => {
      el.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        state.dragging = el.getAttribute("data-id");
        state.lastX = ev.clientX;
        state.lastY = ev.clientY;
        state._moved = false;
      });
      el.addEventListener("click", (ev) => {
        if (state._moved) return;
        const section = el.getAttribute("data-section");
        const anchor = el.getAttribute("data-anchor");
        if (section && window.__mdShow) {
          window.__mdShow(section, anchor);
        }
      });
    });
  }

  function bindStage() {
    const stage = document.getElementById("g-stage");
    if (!stage) return;

    stage.addEventListener("mousedown", (ev) => {
      if (ev.target.closest(".g-node")) return;
      state.panning = true;
      state.lastX = ev.clientX;
      state.lastY = ev.clientY;
    });

    window.addEventListener("mousemove", (ev) => {
      const dx = ev.clientX - state.lastX;
      const dy = ev.clientY - state.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) state._moved = true;
      state.lastX = ev.clientX;
      state.lastY = ev.clientY;
      if (state.dragging) {
        const n = state.nodes[state.dragging];
        if (n) {
          n.x += dx / state.scale;
          n.y += dy / state.scale;
          render();
        }
      } else if (state.panning) {
        state.panX += dx;
        state.panY += dy;
        render();
      }
    });

    window.addEventListener("mouseup", () => {
      state.dragging = null;
      state.panning = false;
    });

    stage.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const factor = ev.deltaY > 0 ? 0.9 : 1.1;
        state.scale = Math.min(2.2, Math.max(0.4, state.scale * factor));
        render();
      },
      { passive: false }
    );

    document.getElementById("g-reset")?.addEventListener("click", () => {
      state.scale = 1;
      state.panX = 40;
      state.panY = 40;
      initPositions();
      render();
    });

    document.getElementById("g-fit")?.addEventListener("click", () => {
      state.scale = 1;
      state.panX = 40;
      state.panY = 40;
      render();
    });

    document.getElementById("g-only")?.addEventListener("change", (ev) => {
      state.onlyConnected = !!ev.target.checked;
      render();
    });
  }

  function boot() {
    if (!document.getElementById("g-svg")) return;
    initPositions();
    bindStage();
    render();
    window.addEventListener("resize", () => render());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__mdGraphRender = render;
})();
