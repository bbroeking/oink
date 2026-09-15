// cards.js — filters + the card viewer for /cards.
//
// The grid is static HTML (built by scripts/build-trading-card-gallery.mjs);
// this file only hides tiles that miss the active filters and drives the
// <dialog> viewer, whose text comes from cards.json (fetched once, on the
// first open). A card's number lives in the URL hash (#019) so a single card
// can be linked.
(function () {
  "use strict";

  var grid = document.getElementById("grid");
  var tiles = Array.prototype.slice.call(grid.querySelectorAll(".tile"));
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var search = document.getElementById("search");
  var active = { type: "", style: "", rarity: "", q: "" };
  var total = tiles.length;

  // ------------------------------------------------------------ filters --

  function visible(tile) {
    if (active.type && tile.dataset.type !== active.type) return false;
    if (active.style && tile.dataset.style.split(" ").indexOf(active.style) < 0) return false;
    if (active.rarity && tile.dataset.rarity !== active.rarity) return false;
    if (active.q && tile.dataset.name.indexOf(active.q) < 0 && tile.dataset.number.indexOf(active.q) < 0) return false;
    return true;
  }

  function applyFilters() {
    var shown = 0;
    tiles.forEach(function (tile) {
      var on = visible(tile);
      tile.hidden = !on;
      if (on) shown += 1;
    });
    countEl.textContent = shown === total ? total + " cards" : shown + " of " + total + " cards";
    emptyEl.hidden = shown > 0;
  }

  document.querySelectorAll(".filters__group").forEach(function (group) {
    var key = group.dataset.filter;
    group.addEventListener("click", function (event) {
      var chip = event.target.closest(".chip");
      if (!chip) return;
      active[key] = chip.dataset.value;
      group.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-selected", c === chip ? "true" : "false");
      });
      applyFilters();
    });
  });

  search.addEventListener("input", function () {
    active.q = search.value.trim().toLowerCase();
    applyFilters();
  });

  // ------------------------------------------------------------- viewer --

  var viewer = document.getElementById("viewer");
  var art = document.getElementById("viewer-art");
  var el = {
    number: document.getElementById("viewer-number"),
    name: document.getElementById("viewer-name"),
    tags: document.getElementById("viewer-tags"),
    stats: document.getElementById("viewer-stats"),
    play: document.getElementById("viewer-play"),
    playLabel: document.getElementById("viewer-play-label"),
    text: document.getElementById("viewer-text"),
    training: document.getElementById("viewer-training"),
    trainingName: document.getElementById("viewer-training-name"),
    trainingText: document.getElementById("viewer-training-text"),
    flavor: document.getElementById("viewer-flavor"),
  };
  var data = null;
  var byNumber = {};
  var current = null;
  var opener = null;

  function loadData() {
    if (data) return Promise.resolve(data);
    return fetch("/cards/cards.json")
      .then(function (r) { return r.json(); })
      .then(function (json) {
        data = json;
        json.cards.forEach(function (card) { byNumber[card.number] = card; });
        return data;
      });
  }

  function tag(label, cls) {
    var li = document.createElement("li");
    li.className = "tag" + (cls ? " tag--" + cls : "");
    li.textContent = label;
    return li;
  }

  function stat(label, value) {
    var wrap = document.createElement("div");
    var dt = document.createElement("dt");
    var dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    return wrap;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function render(card) {
    el.number.textContent = card.number + " / " + data.set.cardCount + " · " + data.set.code;
    el.name.textContent = card.name;
    el.tags.replaceChildren();
    el.tags.appendChild(tag(card.typeLabel));
    if (card.legend) {
      el.tags.appendChild(tag(card.startingCheer + " Cheer"));
      card.favoredStyles.forEach(function (s) { el.tags.appendChild(tag(cap(s), s)); });
    } else {
      el.tags.appendChild(tag("Rank " + card.rank));
      el.tags.appendChild(tag(card.styleLabel, card.style));
    }
    el.tags.appendChild(tag(card.rarityLabel, card.rarity));

    el.stats.replaceChildren();
    if (card.guard) el.stats.appendChild(stat("Guard", card.guard));
    if (card.bash) el.stats.appendChild(stat("Bash", card.bash));
    if (card.hearts) el.stats.appendChild(stat("Hearts", card.hearts));
    el.stats.hidden = el.stats.childElementCount === 0;

    el.playLabel.textContent = card.legend ? card.abilityName : "Play";
    el.text.textContent = card.text;
    el.training.hidden = !card.training;
    if (card.training) {
      el.trainingName.textContent = card.training.name;
      el.trainingText.textContent = card.training.text;
    }
    el.flavor.textContent = card.flavor || "";
  }

  function show(number, fromHash) {
    var tile = grid.querySelector('.tile[data-number="' + number + '"]');
    if (!tile) return;
    current = number;
    var img = tile.querySelector(".tile__art");
    // The tile's thumb shows at once; the full render swaps in when it lands.
    art.src = img.src;
    art.alt = tile.querySelector(".tile__name").textContent;
    loadData().then(function () {
      var card = byNumber[number];
      if (!card || current !== number) return;
      render(card);
      art.src = "/cards/" + card.img;
      // Warm the neighbours so ← → feel instant.
      [-1, 1].forEach(function (step) {
        var n = neighbour(number, step);
        if (n) { var pre = new Image(); pre.src = "/cards/" + byNumber[n].img; }
      });
    });
    if (!viewer.open) viewer.showModal();
    if (!fromHash) history.replaceState(null, "", "#" + number);
  }

  // Steps through the tiles the filters currently show, wrapping at the ends.
  function neighbour(number, step) {
    var shown = tiles.filter(function (t) { return !t.hidden; });
    if (!shown.length) return null;
    var i = shown.findIndex(function (t) { return t.dataset.number === number; });
    if (i < 0) return shown[0].dataset.number;
    return shown[(i + step + shown.length) % shown.length].dataset.number;
  }

  function close() {
    if (viewer.open) viewer.close();
  }

  grid.addEventListener("click", function (event) {
    var button = event.target.closest(".tile__button");
    if (!button) return;
    opener = button;
    show(button.closest(".tile").dataset.number);
  });

  viewer.addEventListener("click", function (event) {
    var nav = event.target.closest("[data-step]");
    if (nav) { show(neighbour(current, Number(nav.dataset.step))); return; }
    if (event.target.closest("[data-close]")) { close(); return; }
    // A click on the backdrop lands on the dialog element itself.
    if (event.target === viewer) close();
  });

  viewer.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") { event.preventDefault(); show(neighbour(current, -1)); }
    if (event.key === "ArrowRight") { event.preventDefault(); show(neighbour(current, 1)); }
  });

  viewer.addEventListener("close", function () {
    current = null;
    history.replaceState(null, "", location.pathname + location.search);
    if (opener) opener.focus();
  });

  applyFilters();
  var hash = location.hash.replace("#", "");
  if (/^\d{3}$/.test(hash)) show(hash, true);
  // Fetch the card text while the reader is still scanning the grid.
  if ("requestIdleCallback" in window) requestIdleCallback(loadData);
})();
