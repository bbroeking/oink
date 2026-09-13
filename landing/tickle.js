/* tickle.js — the shared interaction layer for the public landing family.
 *
 * Extracted once from the byte-identical inline scripts in landing/index.html and
 * landing/i/index.html (findings-G-web G-10; design-system-spec §3 rule 7). Four
 * behaviours, one place to fix each:
 *
 *   TTP.reveal()              the reveal safety net — content is never stuck invisible
 *   TTP.stars(el)             the floating confetti-star field
 *   TTP.tickle(stage, opts)   tap/Enter/Space on Rosie -> wiggle + giggle + spark burst
 *   TTP.copy(text)            clipboard write that reports the TRUTH (see below)
 *   TTP.toast(el, message)    the one-at-a-time pill
 *
 * The copy fix: the old inline version called done() even when the write threw, so a
 * failed copy still said "Copied". TTP.copy resolves false when nothing reached the
 * clipboard, and the caller shows the honest fallback instead.
 *
 * Motion: every animated flourish here is skipped entirely under
 * `prefers-reduced-motion: reduce`. The CSS block in site.css disarms the rest.
 *
 * Colours come from tokens.css as `var(--…)` strings — no hex lives in this file.
 */
(function (global) {
  "use strict";

  var REDUCE =
    global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The sanctioned dingbat set (taste standard: ★ ✦ ✧ ♥ ✓ › are typography,
     everything else is a Glyph). No emoji reaches a web surface. */
  var MARKS = ["★", "✦", "✧", "♥"];
  var STAR_TINTS = ["var(--fill-rose-deep)", "var(--fill-lilac)"];
  var SPARK_TINTS = ["var(--fill-rose-deep)", "var(--fill-sun)"];
  var GIGGLES = ["hehehe!", "oink!", "teehee!", "wheee!", "snort!"];

  /* ---------------------------------------------------------------- reveal -- */
  /* Intro animations can be throttled in a background tab; after MOTION.toast-ish
     we force the end state so nothing is ever left at opacity 0. */
  function reveal(delay) {
    global.setTimeout(function () {
      document.body.classList.add("shown");
    }, typeof delay === "number" ? delay : 1600);
  }

  /* ----------------------------------------------------------------- stars -- */
  function stars(wrap) {
    if (!wrap || REDUCE) return;
    var count = global.innerWidth < 540 ? 9 : 16;
    for (var i = 0; i < count; i++) {
      var star = document.createElement("b");
      star.textContent = MARKS[i % MARKS.length];
      star.style.left = Math.random() * 100 + "vw";
      star.style.fontSize = 12 + Math.random() * 14 + "px";
      var dur = 9 + Math.random() * 10;
      star.style.animationDuration = dur + "s";
      star.style.animationDelay = -Math.random() * dur + "s";
      star.style.color = STAR_TINTS[i % 2 === 1 ? 1 : 0];
      wrap.appendChild(star);
    }
  }

  /* ---------------------------------------------------------------- tickle -- */
  function burst(stage) {
    for (var i = 0; i < 9; i++) {
      var spark = document.createElement("span");
      spark.className = "spark";
      spark.textContent = MARKS[i % MARKS.length];
      spark.style.left = 35 + Math.random() * 30 + "%";
      spark.style.top = 30 + Math.random() * 30 + "%";
      spark.style.color = SPARK_TINTS[i % 2];
      var angle = Math.random() * Math.PI * 2;
      var dist = 50 + Math.random() * 55;
      spark.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      spark.style.setProperty("--dy", Math.sin(angle) * dist - 30 + "px");
      spark.style.setProperty("--dr", Math.random() * 360 - 180 + "deg");
      stage.appendChild(spark);
      (function (el) {
        global.setTimeout(function () {
          el.remove();
        }, 820);
      })(spark);
    }
  }

  function tickle(stage, opts) {
    if (!stage) return;
    var giggle = (opts && opts.giggle) || null;
    var index = 0;

    function play() {
      if (!REDUCE) {
        stage.classList.remove("tickled");
        void stage.offsetWidth; /* restart the animation */
        stage.classList.add("tickled");
        burst(stage);
      }
      if (giggle) {
        giggle.textContent = GIGGLES[index++ % GIGGLES.length];
        giggle.classList.remove("show");
        void giggle.offsetWidth;
        giggle.classList.add("show");
      }
    }

    stage.addEventListener("click", play);
    stage.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play();
      }
    });
  }

  /* ------------------------------------------------------------------ copy -- */
  /* Returns a promise of a boolean: did the text actually reach the clipboard? */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  function copy(text) {
    if (!text) return Promise.resolve(false);
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        },
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  /* Best-effort pre-warm so the app's first-launch clipboard sniff
     (parseReferralCodeFromClipboard) can find the code. Silent by design:
     browsers block clipboard writes without a gesture, and the Copy control
     is the reliable path. */
  function prewarm(text) {
    if (!text || !global.navigator || !navigator.clipboard || !navigator.clipboard.writeText) {
      return;
    }
    navigator.clipboard.writeText(text).catch(function () {});
  }

  /* If the clipboard is unavailable, put the text under the user's finger
     instead of lying about it. */
  function selectText(el) {
    if (!el || !global.getSelection || !document.createRange) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = global.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* ----------------------------------------------------------------- glyph -- */
  /* Pages write the contract form: <use href="/glyph.svg#glyph-snout"/>.
     WebKit still refuses to resolve a <use> that points at another file, and
     iPhone is our whole audience — so fetch the sprite once, park it in the
     document, and repoint the references at the now-local symbols. Same-origin,
     cached, and purely additive: in a browser that already honours the external
     reference the mark is drawn before this ever resolves, and in one that
     doesn't, nothing but a decorative mark was ever missing. */
  function sprite(url) {
    var src = url || "/glyph.svg";
    if (!global.fetch || document.getElementById("ttp-glyph-sprite")) return;
    fetch(src)
      .then(function (res) {
        return res.ok ? res.text() : null;
      })
      .then(function (markup) {
        if (!markup) return;
        var host = document.createElement("div");
        host.id = "ttp-glyph-sprite";
        host.setAttribute("aria-hidden", "true");
        host.style.position = "absolute";
        host.style.width = "0";
        host.style.height = "0";
        host.style.overflow = "hidden";
        host.innerHTML = markup;
        document.body.appendChild(host);
        var uses = document.querySelectorAll('use[href^="' + src + '#"]');
        for (var i = 0; i < uses.length; i++) {
          var id = uses[i].getAttribute("href").split("#")[1];
          uses[i].setAttribute("href", "#" + id);
        }
      })
      .catch(function () {});
  }

  /* ----------------------------------------------------------------- toast -- */
  var toastTimer = null;
  function toast(el, message) {
    if (!el) return;
    if (message) el.textContent = message;
    el.classList.add("show");
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      el.classList.remove("show");
    }, 2400 /* MOTION.toast */);
  }

  /* ------------------------------------------------------------------ code -- */
  /* The referral/herd code format the app emits and validates
     (REFERRAL_CODE_PATTERN in utils/referrals.ts): 5 letters, dash, 4 alphanumerics. */
  var PATTERN = /^[A-Z]{5}-[A-Z0-9]{4}$/;

  /* `prefix` is the route segment the code rides in: 'r' for /r/CODE (the
     marketing link), 'i' for /i/CODE (the invite link). ?code= always works. */
  function readCode(prefix) {
    var parts = global.location.pathname.split("/").filter(Boolean);
    var fromPath =
      parts.length >= 2 && parts[0].toLowerCase() === prefix ? parts[1] : "";
    var fromQuery = new URLSearchParams(global.location.search).get("code") || "";
    // The path wins, but only if it IS a code — otherwise a stray segment
    // (/i/index.html on a local server, a trailing slug) would mask ?code=.
    return normalise(fromPath) || normalise(fromQuery);
  }

  function normalise(raw) {
    if (!raw) return null;
    var code = decodeURIComponent(raw).toUpperCase().trim();
    return PATTERN.test(code) ? code : null;
  }

  global.TTP = {
    reduceMotion: REDUCE,
    reveal: reveal,
    stars: stars,
    tickle: tickle,
    sprite: sprite,
    copy: copy,
    prewarm: prewarm,
    selectText: selectText,
    toast: toast,
    readCode: readCode,
    CODE_PATTERN: PATTERN,
  };
})(window);
