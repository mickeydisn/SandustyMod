(function () {
  const sections = document.querySelectorAll(".section");
  const navItems = document.querySelectorAll(".nav-item");
  const content = document.querySelector(".content");

  function show(id, anchor) {
    const target = id || "graph";
    sections.forEach((s) => s.classList.toggle("active", s.id === target));
    navItems.forEach((n) => n.classList.toggle("active", n.dataset.section === target));
    if (content) {
      content.classList.toggle("graph-mode", target === "graph");
      content.classList.toggle("editor-mode", target === "editor");
    }
    document.querySelector(".main")?.scrollTo(0, 0);
    try {
      if (history.replaceState) {
        history.replaceState(null, "", "#" + target + (anchor ? "/" + anchor : ""));
      }
    } catch (_) {}
    if (target === "graph" && window.__mdGraphRender) {
      requestAnimationFrame(() => window.__mdGraphRender());
    }
    if (target === "editor" && window.__mdEditorBoot) {
      requestAnimationFrame(() => window.__mdEditorBoot());
    }
    if (anchor) {
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  window.__mdShow = show;

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      show(item.dataset.section);
    });
  });

  function fromHash() {
    const raw = (location.hash || "#graph").slice(1);
    const [page, anchor] = raw.split("/");
    const valid = ["graph", "editor", "start", "content", "systems", "handlers"];
    show(valid.includes(page) ? page : "graph", anchor);
  }

  window.addEventListener("hashchange", fromHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fromHash);
  } else {
    fromHash();
  }
})();
