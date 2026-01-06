/* assets/app.js
   Lokar site script (UI + Games loaded from JSON, language dropdown, modal gallery)
   Requirements:
   - assets/ui.<lang>.json
   - assets/games.<lang>.json
   - HTML ids/classes: #game-list, #modal, #modal-title, #modal-image, #modal-image-mobile,
     #modal-description, #modal-platforms, #meta-grid, #modal-icons, #modal-screenshots,
     #screenshot-container
   - Language dropdown: #lang, #langBtn, #langMenu, #langShort (optional)
   - Inline onclick hooks in HTML: closeModal(), scrollCarousel(dir)
*/

(() => {
  "use strict";

  // ---------- Language + Data ----------
  let LANG = localStorage.getItem("lang") || "be";
  let UI = null;
  let GAMES = [];

  function getByPath(obj, path) {
    return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Cannot load ${path}: ${res.status}`);
    return await res.json();
  }

  async function loadUI() {
    UI = await loadJSON(`assets/ui.${LANG}.json`);
  }

  async function loadGames() {
    GAMES = await loadJSON(`assets/games.${LANG}.json`);
  }

  // ---------- UI apply (for static HTML strings) ----------
  function applyUI() {
    if (!UI) return;

    // lang label in header
    const short = getByPath(UI, "lang.short") || LANG.toUpperCase();
    const langShortEl = document.getElementById("langShort");
    if (langShortEl) langShortEl.textContent = short;

    // Set page lang attribute
    document.documentElement.lang = LANG;

    // data-ui -> textContent / innerHTML if contains \n
    document.querySelectorAll("[data-ui]").forEach((el) => {
      const key = el.getAttribute("data-ui");
      const val = getByPath(UI, key);
      if (val === undefined) return;

      if (typeof val === "string" && val.includes("\n")) {
        el.innerHTML = val.replace(/\n/g, "<br>");
      } else {
        el.textContent = String(val);
      }
    });

    // data-ui-aria -> aria-label
    document.querySelectorAll("[data-ui-aria]").forEach((el) => {
      const key = el.getAttribute("data-ui-aria");
      const val = getByPath(UI, key);
      if (val === undefined) return;
      el.setAttribute("aria-label", String(val));
    });

    // modal close aria-label
    const closeBtn = document.querySelector(".modal-x");
    const closeLabel = getByPath(UI, "modal.close");
    if (closeBtn && closeLabel) closeBtn.setAttribute("aria-label", String(closeLabel));
  }

  // ---------- Language dropdown ----------
  function initLangDropdown() {
    const wrap = document.getElementById("lang");
    const btn = document.getElementById("langBtn");
    const menu = document.getElementById("langMenu");

    if (!wrap || !btn || !menu) return;

    // click-to-open (touch)
    btn.addEventListener("click", (e) => {
    // адкрываем толькі на тач/без hover
    if (window.matchMedia("(hover:hover)").matches) return;

    e.stopPropagation();
    wrap.classList.toggle("open");
    btn.setAttribute("aria-expanded", wrap.classList.contains("open") ? "true" : "false");
    });


    // close on outside click
    document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
        wrap.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
    }
    });


    // choose language
    menu.querySelectorAll(".lang-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const newLang = item.dataset.lang;
        if (!newLang || newLang === LANG) {
          wrap.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
          return;
        }

        LANG = newLang;
        localStorage.setItem("lang", LANG);

        // close modal before rerender (avoid mixed content)
        if (modal && modal.style.display === "flex") {
          closeModal();
        }

        try {
          await bootstrap();
        } catch (e) {
          console.error(e);
        }

        wrap.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---------- DOM refs ----------
  const gameList = document.getElementById("game-list");

  const modal = document.getElementById("modal");
  const body = document.body;

  const modalTitle = document.getElementById("modal-title");
  const modalImage = document.getElementById("modal-image");
  const modalImageMobile = document.getElementById("modal-image-mobile");
  const modalDescription = document.getElementById("modal-description");

  const modalPlatforms = document.getElementById("modal-platforms");
  const modalScreenshots = document.getElementById("modal-screenshots");
  const screenshotContainer = document.getElementById("screenshot-container");
  const iconsContainer = document.getElementById("modal-icons");
  const metaGrid = document.getElementById("meta-grid");

  let debounceTimer = null;

  // ---------- Helpers ----------
  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim();
  }

  function getCardDescription(game) {
    if (game.cardDescription) return game.cardDescription;
    const plain = stripHtml(game.description || "");
    if (!plain) return "";
    const max = 180;
    return plain.length > max ? plain.slice(0, max - 1) + "…" : plain;
  }

  // ---------- Render game cards ----------
  function createGameCard(game) {
    const card = document.createElement("div");
    card.className = "game-card";
    card.addEventListener("click", () => openGameModal(game));

    const img = document.createElement("img");
    img.src = game.cover;
    img.alt = game.title;

    const info = document.createElement("div");
    info.className = "game-info";

    const h2 = document.createElement("h2");
    h2.className = "game-title";
    h2.textContent = game.title;

    const platforms = document.createElement("div");
    platforms.className = "game-platforms";
    platforms.textContent = game.cardPlatforms || "";

    const desc = document.createElement("p");
    desc.className = "game-desc";
    // use safe text (not innerHTML) on cards
    desc.textContent = getCardDescription(game);

    info.appendChild(h2);
    info.appendChild(platforms);
    info.appendChild(desc);

    const btnWrap = document.createElement("div");
    btnWrap.className = "button-container";

    const btn = document.createElement("a");
    btn.href = game.pageUrl || "#";
    btn.className = "game-button";
    btn.textContent = getByPath(UI, "cards.more") || "Details";
    btn.addEventListener("click", (e) => {
      // keep modal behavior, but allow open in new tab if user wants
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      openGameModal(game);
    });

    btnWrap.appendChild(btn);

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(btnWrap);

    return card;
  }

  function renderGameList() {
    if (!gameList) return;
    gameList.innerHTML = "";
    GAMES.forEach((g) => gameList.appendChild(createGameCard(g)));
  }

  // ---------- Modal ----------
  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
    document.querySelector(".game-section")?.classList.remove("game-section-blur");
  }

  function openGameModal(game) {
    if (!modal) return;

    // headings from UI
    const downloadsTitle = getByPath(UI, "modal.downloads") || "Downloads";
    if (modalPlatforms) modalPlatforms.innerHTML = `<h3 class="modal-screenshots-title">${downloadsTitle}</h3>`;

    if (screenshotContainer) screenshotContainer.innerHTML = "";
    if (metaGrid) metaGrid.innerHTML = "";
    if (iconsContainer) iconsContainer.innerHTML = "";

    if (modalTitle) modalTitle.textContent = game.title;
    if (modalImage) modalImage.src = game.cover;
    if (modalImageMobile) modalImageMobile.src = game.cover;

    if (modalDescription) modalDescription.innerHTML = game.description || "";

    renderIcons(game.icons || []);
    renderMetaBadges(game.meta || {});
    renderDownloads(game.downloads || []);
    renderScreenshots(game.screenshots || []);

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    document.querySelector(".game-section")?.classList.add("game-section-blur");
  }

  function renderIcons(icons) {
    if (!iconsContainer) return;
    iconsContainer.innerHTML = "";
    if (!icons.length) return;

    icons.forEach((ic) => {
      const img = document.createElement("img");
      img.className = "modal-icon";
      img.src = ic.img;
      img.alt = ic.alt || "icon";

      if (ic.url) {
        const a = document.createElement("a");
        a.className = "modal-icon-link";
        a.href = ic.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = ic.alt || "";
        a.appendChild(img);
        iconsContainer.appendChild(a);
      } else {
        const span = document.createElement("span");
        span.className = "modal-icon-link";
        span.title = ic.alt || "";
        span.style.cursor = "default";
        span.appendChild(img);
        iconsContainer.appendChild(span);
      }
    });
  }

  function renderMetaBadges(meta) {
    if (!metaGrid) return;

    const dash = getByPath(UI, "common.dash") ?? "—";
    const items = [
      { key: getByPath(UI, "metaLabels.developer") ?? "Developer:", value: meta.developer ?? dash },
      { key: getByPath(UI, "metaLabels.genre") ?? "Genre:", value: meta.genre ?? dash },
      { key: getByPath(UI, "metaLabels.authors") ?? "Translators:", value: meta.translators ?? dash },
      { key: getByPath(UI, "metaLabels.words") ?? "Word count:", value: meta.words ?? dash, cls: "words" }
    ];

    items.forEach((item) => {
      const badge = document.createElement("div");
      badge.className = "meta-badge" + (item.cls ? " " + item.cls : "");

      const k = document.createElement("span");
      k.className = "k";
      k.textContent = item.key;

      const v = document.createElement("span");
      v.className = "v";
      v.textContent = String(item.value);

      badge.appendChild(k);
      badge.appendChild(v);
      metaGrid.appendChild(badge);
    });
  }

  function renderDownloads(downloads) {
    if (!modalPlatforms) return;

    downloads.forEach((platform) => {
      const platformDiv = document.createElement("div");

      const platformTitle = document.createElement("div");
      platformTitle.classList.add("modal-platform-title");
      platformTitle.textContent = platform.platform;
      platformDiv.appendChild(platformTitle);

      const buttonsDiv = document.createElement("div");
      buttonsDiv.classList.add("modal-download-buttons");

      (platform.links || []).forEach((link) => {
        const a = document.createElement("a");
        a.href = link.url;
        a.classList.add("game-button");
        a.textContent = link.text;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        buttonsDiv.appendChild(a);
      });

      platformDiv.appendChild(buttonsDiv);
      modalPlatforms.appendChild(platformDiv);
    });
  }

  function renderScreenshots(screenshots) {
    if (!modalScreenshots || !screenshotContainer) return;

    if (!screenshots.length) {
      modalScreenshots.style.display = "none";
      return;
    }
    modalScreenshots.style.display = "block";

    screenshots.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.classList.add("modal-screenshot");
      img.alt = "Screenshot";
      img.addEventListener("click", () => centerOnImage(img, true));
      screenshotContainer.appendChild(img);
    });

    requestAnimationFrame(() => {
      const imgs = getImages();
      const mid = Math.floor(imgs.length / 2);
      centerOnIndex(mid, false);
      updateActiveScreenshot();
    });
  }

  function getImages() {
    if (!screenshotContainer) return [];
    return Array.from(screenshotContainer.querySelectorAll(".modal-screenshot"));
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function setActive(img) {
    getImages().forEach((i) => i.classList.remove("active"));
    if (img) img.classList.add("active");
  }

  function centerOnImage(img, smooth = true) {
    if (!img || !screenshotContainer) return;
    const targetLeft =
      img.offsetLeft + img.clientWidth / 2 - screenshotContainer.clientWidth / 2;

    screenshotContainer.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: smooth ? "smooth" : "auto"
    });

    setActive(img);
  }

  function centerOnIndex(index, smooth = true) {
    const imgs = getImages();
    const img = imgs[index];
    if (!img) return;
    centerOnImage(img, smooth);
  }

  function getClosestToCenter() {
    const imgs = getImages();
    if (!imgs.length || !screenshotContainer) return { img: null, index: -1 };

    const center = screenshotContainer.scrollLeft + screenshotContainer.clientWidth / 2;

    let bestIdx = 0;
    let bestDiff = Infinity;

    imgs.forEach((img, idx) => {
      const imgCenter = img.offsetLeft + img.clientWidth / 2;
      const diff = Math.abs(center - imgCenter);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });

    return { img: imgs[bestIdx], index: bestIdx };
  }

  function scrollCarousel(dir) {
    const imgs = getImages();
    if (!imgs.length) return;

    const { index } = getClosestToCenter();
    const nextIndex = clamp(index + dir, 0, imgs.length - 1);
    centerOnIndex(nextIndex, true);
  }

  function updateActiveScreenshot() {
    const { img } = getClosestToCenter();
    setActive(img);
  }

  // ---------- Event wiring ----------
  function initModalEvents() {
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (modal.style.display !== "flex") return;
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") scrollCarousel(-1);
      if (e.key === "ArrowRight") scrollCarousel(1);
    });

    if (screenshotContainer) {
      screenshotContainer.addEventListener(
        "scroll",
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(updateActiveScreenshot, 80);
        },
        { passive: true }
      );
    }
  }

  // Expose functions for inline onclick in HTML
  window.closeModal = closeModal;
  window.scrollCarousel = scrollCarousel;

  // ---------- Bootstrap ----------
  async function bootstrap() {
    // load UI + games, then render
    await loadUI();
    applyUI();
    await loadGames();
    renderGameList();
  }

  (async () => {
    try {
      initLangDropdown();
      initModalEvents();

      await bootstrap();
    } catch (e) {
      console.error(e);
      if (gameList) gameList.textContent = "Failed to load site data.";
    }
  })();
})();
