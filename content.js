// content.js — Tile hover badge, single badge, clean title
(function () {
  "use strict";

  const host = location.hostname;
  const isPrime   = host.includes("primevideo.com") || host.includes("amazon.com");
  const isHotstar = host.includes("hotstar.com") || host.includes("disneyplus.com");
  if (!isPrime) return; // Only run Prime block on Prime sites

  console.log("[IMDB Ext] ✅ Loaded on", host);

  // ── Messaging ──────────────────────────────────────────────────────────────
  function getRating(title) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "GET_RATING", title, year: null }, res => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (res?.ok) resolve(res.data);
        else reject(new Error(res?.error || "unknown"));
      });
    });
  }

  // ── Clean title before sending to OMDb ────────────────────────────────────
  function cleanTitle(raw) {
    return raw
      .replace(/\s*[\|\-–—]\s*(tamil|telugu|hindi|malayalam|kannada|english|dubbed|official|trailer|4k|hd|uhd)\b.*/gi, "")
      .replace(/\s*\((?:tamil|telugu|hindi|malayalam|kannada|english|dubbed)\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ── Extract title from a tile ──────────────────────────────────────────────
  function extractTitle(tile) {
    // 1. img alt — most reliable (Prime uses title-treatment images)
    const imgs = tile.querySelectorAll("img[alt]");
    for (const img of imgs) {
      const alt = (img.getAttribute("alt") || "").trim();
      if (alt.length > 1 && alt.length < 120 && !/^(logo|prime|button|icon|avatar|\s*)$/i.test(alt)) {
        return cleanTitle(alt);
      }
    }

    // 2. aria-label on tile or direct child link
    for (const el of [tile, ...tile.querySelectorAll("a[aria-label], [aria-label]")]) {
      const label = (el.getAttribute("aria-label") || "").trim();
      if (label.length > 1 && label.length < 120 && !/^(button|link|menu|play|add|like)/i.test(label)) {
        return cleanTitle(label);
      }
    }

    // 3. visible text in a title element
    const titleEl = tile.querySelector('[class*="title"i],[class*="Title"i],[class*="TitleText"i]');
    if (titleEl) {
      const t = (titleEl.innerText || "").trim();
      if (t.length > 1 && t.length < 120) return cleanTitle(t);
    }

    return null;
  }

  // ── Determine the right "root" tile to attach badge to ───────────────────
  // Prime nests: <a href="/detail/..."> wraps <div> wraps <img>
  // We want the outermost clickable card that has an img inside it.
  // Strategy: walk UP from the hovered element to find a link to /detail/ or /dp/
  function findTileRoot(el) {
    let cur = el;
    for (let i = 0; i < 10; i++) {
      if (!cur || cur === document.body) break;
      const href = cur.getAttribute("href") || "";
      if (/\/(detail|dp)\//.test(href)) return cur;
      cur = cur.parentElement;
    }
    // Fallback: find closest element that has an img child and is reasonably sized
    cur = el;
    for (let i = 0; i < 8; i++) {
      if (!cur || cur === document.body) break;
      if (cur.querySelector("img") && cur.offsetWidth > 80) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  // ── Badge management ───────────────────────────────────────────────────────
  const bound  = new WeakSet();
  const timers = new WeakMap();
  const badges = new WeakMap();

  function getOrCreateBadge(root) {
    if (badges.has(root)) return badges.get(root);
    const b = document.createElement("div");
    b.className = "imdb-tile-badge";
    b.innerHTML = `<span class="itb-logo">IMDb</span><span class="itb-score"></span>`;
    // Append to img's direct parent so top:8px right:8px lands on image corner
    // Anchor badge to root but position relative to the img's top
    const img = root.querySelector("img");
    if (getComputedStyle(root).position === "static") root.style.position = "relative";
    root.appendChild(b);
    // If img exists, offset badge to align with img top
    if (img) {
      b.style.top = img.offsetTop + 8 + "px";
    }
    badges.set(root, b);
    return b;
  }

  function bindTile(tile) {
    const root = findTileRoot(tile);
    if (!root || bound.has(root)) return;
    bound.add(root);

    const pos = getComputedStyle(root).position;
    if (pos === "static") root.style.position = "relative";

    root.addEventListener("mouseenter", () => {
      const t = setTimeout(async () => {
        const title = extractTitle(root);
        if (!title) {
          console.warn("[IMDB Ext] No title found on tile");
          return;
        }
        console.log("[IMDB Ext] Hover →", title);

        const badge = getOrCreateBadge(root);
        badge.querySelector(".itb-score").textContent = "…";
        badge.classList.add("itb-visible");

        try {
          const data = await getRating(title);
          const score = data.rating && data.rating !== "N/A" ? data.rating : "?";
          console.log("[IMDB Ext] Rating for", title, "→", score);
          badge.querySelector(".itb-score").textContent = score;
          badge.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`https://www.imdb.com/title/${data.imdbId}/`, "_blank");
          };
        } catch (e) {
          console.warn("[IMDB Ext] No match for:", title, "|", e.message);
          badge.classList.remove("itb-visible");
        }
      }, 400);

      timers.set(root, t);
    });

    root.addEventListener("mouseleave", () => {
      clearTimeout(timers.get(root));
      const badge = badges.get(root);
      if (badge) badge.classList.remove("itb-visible");
    });
  }

  // ── Scan: only bind to <a> tags pointing to detail pages ──────────────────
  // This is the tightest selector — avoids double-binding on nested divs
  function scanTiles() {
    document.querySelectorAll('a[href*="/detail/"], a[href*="/dp/"]').forEach(bindTile);
    // Also scan card containers — some Prime cards need this to find the right root
    if (isPrime) {
      document.querySelectorAll('[data-testid*="card"]').forEach(bindTile);
    }
  }

  // ── Watch DOM for new tiles ────────────────────────────────────────────────
  let scanTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanTiles, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ── SPA navigation ─────────────────────────────────────────────────────────
  const origPush = history.pushState.bind(history);
  history.pushState = function (...args) { origPush(...args); setTimeout(scanTiles, 1200); };
  window.addEventListener("popstate", () => setTimeout(scanTiles, 1200));

  // ── Boot ───────────────────────────────────────────────────────────────────
  setTimeout(scanTiles, 1200);

  // Sanity check
  chrome.runtime.sendMessage({ type: "GET_RATING", title: "Inception", year: "2010" }, res => {
    if (res?.ok) console.log("[IMDB Ext] ✅ OMDb alive. Inception =", res.data.rating);
    else console.error("[IMDB Ext] ❌ OMDb failed:", res?.error);
  });

})();

// ── HOTSTAR SUPPORT ──────────────────────────────────────────────────────────
// Approach: track mouse position globally, use elementFromPoint to find card
// under cursor. No event binding on cards = immune to Hotstar's DOM replacement.
(function hotstar() {
  if (!location.hostname.includes("hotstar.com") && !location.hostname.includes("disneyplus.com")) return;
  console.log("[IMDB Ext] ✅ Hotstar block running");

  function getRating(title) {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendMessage) return reject(new Error("ctx lost"));
      try {
        chrome.runtime.sendMessage({ type: "GET_RATING", title, year: null }, res => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (res?.ok) resolve(res.data);
          else reject(new Error(res?.error || "unknown"));
        });
      } catch (e) { reject(e); }
    });
  }

  // Floating badge — lives in Shadow DOM so Hotstar can never touch it
  const host = document.createElement("div");
  host.id = "imdb-hs-host";
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  const badgeEl = document.createElement("div");
  badgeEl.innerHTML = `
    <style>
      .badge {
        position: fixed;
        display: none;
        align-items: center;
        gap: 5px;
        background: rgba(0,0,0,0.88);
        border: 1.5px solid #f5c518;
        border-radius: 6px;
        padding: 4px 9px;
        font-family: -apple-system, sans-serif;
        pointer-events: auto;
        cursor: pointer;
        z-index: 2147483647;
        transition: opacity 0.15s;
      }
      .badge.show { display: flex; }
      .logo {
        background: #f5c518;
        color: #000;
        font-size: 9px;
        font-weight: 900;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: "Arial Black", sans-serif;
      }
      .score {
        color: #f5c518;
        font-size: 15px;
        font-weight: 700;
      }
    </style>
    <div class="badge" id="b">
      <span class="logo">IMDb</span>
      <span class="score" id="s"></span>
    </div>
  `;
  shadow.appendChild(badgeEl);
  const badge = shadow.getElementById("b");
  const scoreEl = shadow.getElementById("s");

  function showBadge(score, x, y, imdbId) {
    scoreEl.textContent = score;
    badge.style.top = y + "px";
    badge.style.right = (window.innerWidth - x) + "px";
    badge.classList.add("show");
    badge.onclick = imdbId
      ? () => window.open("https://www.imdb.com/title/" + imdbId + "/", "_blank")
      : null;
  }

  function hideBadge() {
    badge.classList.remove("show");
  }

  // ── Global mouse tracking ─────────────────────────────────────────────────
  const ratingCache = {}; // title → {score, imdbId}
  let currentTitle = "";
  let fetchTimer = null;

  function getTitle(card) {
    const action = card.querySelector('[data-testid="action"][aria-label]');
    if (action) return (action.getAttribute("aria-label") || "").split(",")[0].trim();
    const labeled = card.querySelector("[aria-label]");
    if (labeled) return (labeled.getAttribute("aria-label") || "").split(",")[0].trim();
    const img = card.querySelector("img[alt]");
    if (img) return (img.getAttribute("alt") || "").trim();
    return "";
  }

  let lastMX = 0, lastMY = 0;

  function checkMouse(e) {
    lastMX = e.clientX;
    lastMY = e.clientY;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) { leavingCard(); return; }

    const card = el.closest('[data-testid="tray-card-default"]');
    if (!card) { leavingCard(); return; }

    const title = getTitle(card);
    if (!title || title.length < 2) return;

    // Same card as before — keep showing badge, update position
    if (title === currentTitle) {
      if (ratingCache[title]) {
        const { score, imdbId } = ratingCache[title];
        const rect = card.getBoundingClientRect();
        showBadge(score, rect.right - 8, rect.top + 8, imdbId);
      }
      return;
    }

    // New card
    currentTitle = title;
    clearTimeout(fetchTimer);

    fetchTimer = setTimeout(async () => {
      const rect = card.getBoundingClientRect();

      if (ratingCache[title]) {
        const { score, imdbId } = ratingCache[title];
        showBadge(score, rect.right - 8, rect.top + 8, imdbId);
        return;
      }

      showBadge("…", rect.right - 8, rect.top + 8, null);
      console.log("[IMDB Ext] Hotstar →", title);

      try {
        const data = await getRating(title);
        const score = data.rating && data.rating !== "N/A" ? data.rating : "?";
        console.log("[IMDB Ext]", title, "→", score);
        ratingCache[title] = { score, imdbId: data.imdbId };
        // Update badge score directly — don't re-query DOM
        if (currentTitle === title) {
          scoreEl.textContent = score;
          badge.onclick = data.imdbId
            ? () => window.open("https://www.imdb.com/title/" + data.imdbId + "/", "_blank")
            : null;
        }
      } catch (err) {
        hideBadge();
      }
    }, 400);
  }

  function leavingCard() {
    if (currentTitle) {
      currentTitle = "";
      clearTimeout(fetchTimer);
      hideBadge();
    }
  }

  // Throttled mousemove — check every 150ms
  let lastCheck = 0;
  document.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastCheck < 150) return;
    lastCheck = now;
    checkMouse(e);
  }, { passive: true });

  // Also hide on scroll
  window.addEventListener("scroll", hideBadge, { passive: true });
})();
