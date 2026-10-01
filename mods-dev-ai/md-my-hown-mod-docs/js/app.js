(function () {
  const sections = document.querySelectorAll(".section");
  const navItems = document.querySelectorAll(".nav-item");
  const content = document.querySelector(".content");
  const PAGE_IDS = new Set(["graph", "editor", "blocky", "start", "content", "systems", "handlers"]);
  const ANCHOR_PAGE = {
    "h-processes": "handlers", "h-actions": "handlers", "h-ids": "handlers",
    "start-overview": "start", "start-gs": "start", "start-shape": "start", "start-panel": "start",
  };
  ["c-elements","c-terrains","c-structures","c-items","c-sprites","c-buffers",
   "s-contacts","s-recipes","s-processing","s-techs","s-unlock","s-upgrades",
   "s-triggers","s-signals","s-modifiers","s-inputs","s-networks","s-energy"
  ].forEach((a) => { ANCHOR_PAGE[a] = a.startsWith("c-") ? "content" : "systems"; });

  function show(id, anchor) {
    let target = id || "graph";
    let scrollTo = anchor || null;
    if (!PAGE_IDS.has(target) && ANCHOR_PAGE[target]) {
      scrollTo = target; target = ANCHOR_PAGE[target];
    }
    if (String(target).startsWith("role-") || String(target).startsWith("action-")) {
      scrollTo = target; target = "handlers";
    }
    if (!PAGE_IDS.has(target)) target = "graph";
    sections.forEach((s) => s.classList.toggle("active", s.id === target));
    navItems.forEach((n) => n.classList.toggle("active", n.dataset.section === target));
    if (content) {
      content.classList.toggle("graph-mode", target === "graph");
      content.classList.toggle("editor-mode", target === "editor" || target === "blocky");
      content.classList.toggle("blocky-mode", target === "blocky");
    }
    const main = document.querySelector(".main");
    if (main && !scrollTo) main.scrollTo(0, 0);
    try {
      const hash = scrollTo ? target + "/" + scrollTo : target;
      if (history.replaceState) history.replaceState(null, "", "#" + hash);
    } catch (_) {}
    if (target === "graph" && window.__mdGraphRender) requestAnimationFrame(() => window.__mdGraphRender());
    if (target === "editor" && window.__mdEditorBoot) requestAnimationFrame(() => window.__mdEditorBoot());
    if (target === "blocky" && window.__mdBlockyBoot) requestAnimationFrame(() => window.__mdBlockyBoot());
    if (scrollTo) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.getElementById(scrollTo);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 40);
      });
    }
  }
  window.__mdShow = show;
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); show(item.dataset.section); });
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (href.length < 2) return;
    e.preventDefault();
    const raw = href.slice(1);
    if (raw.includes("/")) {
      const [page, anchor] = raw.split("/");
      show(page, anchor);
      return;
    }
    if (PAGE_IDS.has(raw)) { show(raw); return; }
    if (ANCHOR_PAGE[raw] || raw.startsWith("role-") || raw.startsWith("action-")) { show(raw); return; }
    const el = document.getElementById(raw);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      try { history.replaceState(null, "", "#" + raw); } catch (_) {}
    }
  });
  function fromHash() {
    const raw = (location.hash || "#graph").slice(1);
    if (!raw) return show("graph");
    if (raw.includes("/")) {
      const [page, anchor] = raw.split("/");
      show(page, anchor);
    } else show(raw);
  }
  window.addEventListener("hashchange", fromHash);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fromHash);
  else fromHash();
})();
