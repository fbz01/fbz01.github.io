(function () {
  const html = document.documentElement;
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  // Vill du spara valet i framtiden? Avkommentera localStorage-raderna nedan.
  // const saved = localStorage.getItem("theme");
  // if (saved) html.setAttribute("data-theme", saved);

  updateAria();
  btn.addEventListener("click", () => {
    const cur = html.getAttribute("data-theme") || "auto";
    const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
    html.setAttribute("data-theme", next);
    updateAria();
    // localStorage.setItem("theme", next);
  });

  function updateAria() {
    const mode = html.getAttribute("data-theme") || "auto";
    const label =
      mode === "auto"
        ? "Auto (f\u00f6ljer system)"
        : mode === "dark"
        ? "M\u00f6rkt"
        : "Ljust";
    btn.setAttribute("aria-pressed", mode !== "auto");
    btn.title = `Tema: ${label}`;
    btn.setAttribute("aria-label", `Tema: ${label}`);
  }
})();
