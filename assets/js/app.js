"use strict";

// ---------- State ----------
const state = {
  all: [],
  filtered: [],
  search: "",
  searchDisplay: "",
  category: "",
  tags: new Set(),
};

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------- Elements ----------
const grid = $("#grid");
const emptyEl = $("#empty");
const searchInput = $("#search");
const catButtons = $("#catButtons");
const tagChips = $("#tagChips");
const activeFilters = $("#activeFilters");
const resultSummary = $("#resultSummary");
const clearButtons = $$('[data-action="clear-filters"]');
const dlg = $("#dlg");
const dlgTitle = $("#dlgTitle");
const dlgImg = $("#dlgImg");
const dlgIng = $("#dlgIng");
const dlgSteps = $("#dlgSteps");
const dlgTips = $("#dlgTips");
const dlgClose = $("#dlgClose");
const filterSection = $("#filters");
const filterToggle = $("#filterToggle");
const filterClose = $("#filterClose");
const sheetScrim = $("#sheetScrim");

if (resultSummary) resultSummary.textContent = "Laddar recept...";

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isSheetLayout = () => window.matchMedia("(max-width: 700px)").matches;

let __lockY = 0;
let currentRecipeId = null;

function lockScroll() {
  __lockY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.classList.add("no-scroll");
  document.body.style.position = "fixed";
  document.body.style.top = `-${__lockY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockScroll() {
  document.body.classList.remove("no-scroll");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, __lockY || 0);
}

// ---------- Dialog handling ----------
if (dlg) {
  dlg.addEventListener("close", () => {
    currentRecipeId = null;
    dlg.removeAttribute("data-open");
    const prevScroll = __lockY;
    unlockScroll();

    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has("id")) {
      params.delete("id");
      setHashFromParams(params, { preserveScrollY: prevScroll });
    }
  });
}

if (dlgClose) {
  dlgClose.addEventListener("click", () => dlg.close());
}

// ---------- Init ----------
fetch("data/recipes.json")
  .then((response) => response.json())
  .then((data) => {
    state.all = data;
    buildCategoryButtons(data);
    buildTagChips(data);
    restoreFromHash();
    if (grid) grid.setAttribute("aria-busy", "false");
  })
  .catch((err) => {
    console.error("Kunde inte ladda receptdata", err);
    if (resultSummary) {
      resultSummary.textContent = "Kunde inte ladda receptdata.";
    }
    if (grid) grid.setAttribute("aria-busy", "false");
  });

// ---------- Event wiring ----------
if (grid) {
  grid.addEventListener("click", onGridClick);
  grid.addEventListener("keydown", onGridKeydown);
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const raw = searchInput.value.trim();
    state.searchDisplay = raw;
    state.search = raw.toLowerCase();
    updateHash();
    applyFilters();
  });
}

clearButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    state.search = "";
    state.searchDisplay = "";
    state.category = "";
    state.tags.clear();
    if (searchInput) searchInput.value = "";

    if (catButtons) {
      catButtons.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.remove("active");
        chip.setAttribute("aria-selected", "false");
      });
    }
    if (tagChips) {
      tagChips.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.remove("active");
      });
    }

    updateHash();
    applyFilters();
  })
);

if (filterToggle) filterToggle.addEventListener("click", toggleFilters);
if (filterClose) filterClose.addEventListener("click", closeFilters);
if (sheetScrim) sheetScrim.addEventListener("click", closeFilters);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFilters();
  }
});

window.addEventListener("hashchange", restoreFromHash);

// ---------- Build UI ----------
function buildCategoryButtons(data) {
  if (!catButtons) return;
  const cats = Array.from(new Set(data.map((r) => r.category).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));

  const frag = document.createDocumentFragment();
  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.cat = cat;
    btn.role = "tab";
    btn.ariaSelected = "false";
    btn.textContent = cat;
    frag.appendChild(btn);
  });
  catButtons.innerHTML = "";
  catButtons.appendChild(frag);

  catButtons.addEventListener("click", (event) => {
    const el = event.target.closest("button[data-cat]");
    if (!el) return;
    const cat = el.dataset.cat;
    const wasActive = el.classList.contains("active");

    catButtons.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.remove("active");
      chip.setAttribute("aria-selected", "false");
    });

    if (wasActive) {
      state.category = "";
    } else {
      el.classList.add("active");
      el.setAttribute("aria-selected", "true");
      state.category = cat;
    }

    updateHash();
    applyFilters();
  });
}

function buildTagChips(data) {
  if (!tagChips) return;
  const tagSet = new Set();
  data.forEach((recipe) => (recipe.tags || []).forEach((tag) => tagSet.add(tag)));
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

  const frag = document.createDocumentFragment();
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.tag = tag;
    btn.textContent = tag;
    btn.title = `Filtrera p\u00e5 ${tag}`;
    frag.appendChild(btn);
  });
  tagChips.innerHTML = "";
  tagChips.appendChild(frag);

  tagChips.addEventListener("click", (event) => {
    const el = event.target.closest("button[data-tag]");
    if (!el) return;
    const tag = el.dataset.tag;
    const isActive = el.classList.toggle("active");

    if (isActive) {
      state.tags.add(tag);
    } else {
      state.tags.delete(tag);
    }

    updateHash();
    applyFilters();
  });
}

// ---------- Filtering + Rendering ----------
function applyFilters() {
  const { search, category, tags } = state;
  if (grid) grid.setAttribute("aria-busy", "true");

  state.filtered = state.all.filter((recipe) => {
    const byCategory = !category || recipe.category === category;
    const bySearch =
      !search ||
      recipe.title.toLowerCase().includes(search) ||
      (recipe.ingredients || []).some((item) =>
        item.toLowerCase().includes(search)
      ) ||
      (recipe.tags || []).some((tag) => tag.toLowerCase().includes(search));
    const byTags =
      tags.size === 0 || (recipe.tags || []).some((tag) => tags.has(tag));
    return byCategory && bySearch && byTags;
  });

  render();
  renderActiveFilters();
  if (grid) grid.setAttribute("aria-busy", "false");
}

function render() {
  if (!grid) return;

  if (!state.filtered.length) {
    grid.innerHTML = "";
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  grid.innerHTML = state.filtered
    .map((recipe) => {
      const titleRaw = recipe.title || "Recept";
      const title = escapeHtml(titleRaw);
      const image = escapeHtml(recipe.image || "assets/placeholder.png");
      const categoryRaw = recipe.category || "";
      const category = categoryRaw ? escapeHtml(categoryRaw) : "";
      const ariaLabel = escapeHtml(`\u00d6ppna ${titleRaw}`);
      const badgeHtml = category
        ? `<span class="card-badge">${category}</span>`
        : "";

      const tagsHtml = (recipe.tags || [])
        .map((tag) => {
          const tagText = escapeHtml(tag);
          const tagTitle = escapeHtml(`Filtrera p\u00e5 ${tag}`);
          return `<button class="mini-tag" data-tag="${tagText}" title="${tagTitle}" type="button">${tagText}</button>`;
        })
        .join("");

      const tagListHtml = tagsHtml
        ? `<div class="tag-row" role="list">${tagsHtml}</div>`
        : "";

      return `
    <article class="card" data-id="${escapeHtml(
      recipe.id || ""
    )}" tabindex="0" role="button" aria-label="${ariaLabel}">
      <div class="card-media">
        <img src="${image}" alt="${title}" loading="lazy" decoding="async">
        ${badgeHtml}
      </div>
      <div class="card-body">
        <div class="card-header">
          <h3>${title}</h3>
        </div>
        ${tagListHtml}
      </div>
    </article>
  `;
    })
    .join("");
}

function renderActiveFilters() {
  if (!activeFilters) return;

  const chips = [];
  if (state.category) {
    chips.push(
      `<span class="pill">Kategori: ${escapeHtml(state.category)}</span>`
    );
  }
  if (state.tags.size) {
    chips.push(
      `<span class="pill">Taggar: ${[...state.tags]
        .map((tag) => escapeHtml(tag))
        .join(", ")}</span>`
    );
  }
  if (state.searchDisplay) {
    chips.push(
      `<span class="pill">S\u00f6k: "${escapeHtml(state.searchDisplay)}"</span>`
    );
  }

  if (!chips.length) {
    activeFilters.innerHTML = '<span class="muted">Inga aktiva filter</span>';
  } else {
    activeFilters.innerHTML = chips.join(" ");
  }

  if (resultSummary) {
    const count = state.filtered.length;
    if (count === 0) {
      resultSummary.textContent = "Inga recept matchar ditt urval.";
    } else {
      const hasFilters =
        !!state.category || state.tags.size > 0 || !!state.searchDisplay;
      const suffix = hasFilters
        ? "matchar ditt urval"
        : "tillg\u00e4ngliga";
      resultSummary.textContent = `${count} recept ${suffix}`;
    }
  }
}

// ---------- Grid interactions ----------
function onGridClick(event) {
  const tagBtn = event.target.closest(".mini-tag");
  if (tagBtn) {
    const tag = tagBtn.dataset.tag;
    if (state.tags.has(tag)) {
      state.tags.delete(tag);
    } else {
      state.tags.add(tag);
    }
    if (tagChips) {
      const chip = tagChips.querySelector(
        `[data-tag="${CSS.escape(tag)}"]`
      );
      if (chip) chip.classList.toggle("active");
    }
    updateHash();
    applyFilters();
    return;
  }

  const card = event.target.closest(".card");
  if (card) openRecipe(card.dataset.id);
}

function onGridKeydown(event) {
  const card = event.target.closest(".card");
  if (!card) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openRecipe(card.dataset.id);
  }
}

// ---------- Modal ----------
function openRecipe(id, options = {}) {
  const { fromHash = false } = options;
  if (!dlg) return;

  const recipe = state.all.find((item) => item.id === id);
  if (!recipe) return;

  if (!fromHash) {
    const params = new URLSearchParams(location.hash.slice(1));
    params.set("id", id);
    setHashFromParams(params);
  } else if (currentRecipeId === id && dlg.open) {
    return;
  }

  dlgTitle.textContent = recipe.title;
  dlgImg.src = recipe.image || "assets/placeholder.png";
  dlgImg.alt = recipe.title;
  dlgImg.loading = "eager";

  dlgIng.innerHTML = (recipe.ingredients || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  dlgSteps.innerHTML = (recipe.instructions || [])
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  if (recipe.tips) {
    dlgTips.hidden = false;
    dlgTips.textContent = recipe.tips;
  } else {
    dlgTips.hidden = true;
    dlgTips.textContent = "";
  }

  currentRecipeId = id;
  if (!dlg.open) {
    dlg.showModal();
    lockScroll();
  }
  requestAnimationFrame(() => dlg.setAttribute("data-open", "true"));
}

// ---------- Filter sheet ----------
function openFilters() {
  if (!filterSection || !filterSection.hasAttribute("hidden")) {
    if (filterToggle) filterToggle.setAttribute("aria-expanded", "true");
    return;
  }

  filterSection.removeAttribute("hidden");
  const sheetLayout = isSheetLayout();
  if (filterToggle) filterToggle.setAttribute("aria-expanded", "true");

  if (sheetLayout) {
    lockScroll();
    requestAnimationFrame(() => {
      filterSection.setAttribute("data-open", "true");
      if (sheetScrim) sheetScrim.hidden = false;
    });
  } else {
    filterSection.removeAttribute("data-open");
    if (sheetScrim) sheetScrim.hidden = true;
  }
}

function closeFilters() {
  if (!filterSection || filterSection.hasAttribute("hidden")) return;

  if (filterToggle) filterToggle.setAttribute("aria-expanded", "false");
  const sheetLayout = isSheetLayout();

  if (!sheetLayout) {
    filterSection.setAttribute("hidden", "");
    return;
  }

  filterSection.removeAttribute("data-open");
  if (sheetScrim) sheetScrim.hidden = true;

  const prefersReduceMotion = window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  const finishClose = () => {
    filterSection.setAttribute("hidden", "");
    if (document.body.classList.contains("no-scroll")) {
      unlockScroll();
    }
  };

  if (prefersReduceMotion) {
    finishClose();
    return;
  }

  const onTransitionEnd = (event) => {
    if (event.propertyName !== "transform") return;
    filterSection.removeEventListener("transitionend", onTransitionEnd);
    finishClose();
  };

  filterSection.addEventListener("transitionend", onTransitionEnd);
}

function toggleFilters() {
  if (!filterSection) return;
  filterSection.hasAttribute("hidden") ? openFilters() : closeFilters();
}

// ---------- Hash <-> State ----------
function updateHash() {
  const params = new URLSearchParams();
  if (state.searchDisplay) params.set("q", state.searchDisplay);
  if (state.category) params.set("cat", state.category);
  if (state.tags.size) params.set("tags", [...state.tags].join(","));

  setHashFromParams(params);
}

function restoreFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));

  state.searchDisplay = (params.get("q") || "").trim();
  state.search = state.searchDisplay.toLowerCase();
  if (searchInput) searchInput.value = state.searchDisplay;

  state.category = params.get("cat") || "";
  if (catButtons) {
    catButtons.querySelectorAll(".chip").forEach((chip) => {
      const isActive = chip.dataset.cat === state.category;
      chip.classList.toggle("active", isActive);
      chip.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  state.tags.clear();
  const tagStr = params.get("tags");
  if (tagStr) {
    tagStr.split(",").forEach((tag) => state.tags.add(tag));
  }
  if (tagChips) {
    tagChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", state.tags.has(chip.dataset.tag));
    });
  }

  const id = params.get("id");
  if (id) {
    setTimeout(() => openRecipe(id, { fromHash: true }), 0);
  }

  applyFilters();
}

function setHashFromParams(params, options = {}) {
  const { preserveScrollY } = options;
  const restoreY =
    typeof preserveScrollY === "number" ? preserveScrollY : null;
  const newHash = params.toString();

  if (newHash) {
    if (location.hash.slice(1) !== newHash) {
      location.hash = newHash;
      if (restoreY !== null) {
        requestAnimationFrame(() => window.scrollTo(0, restoreY));
      }
    }
    return;
  }

  if (location.hash) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    if (restoreY !== null) {
      requestAnimationFrame(() => window.scrollTo(0, restoreY));
    }
  }
}
