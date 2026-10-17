/* Think Small — client behaviour. Progressive enhancement only:
   the site is fully readable with JavaScript disabled.
   All state lives in localStorage; the only network request is the
   build-generated search index at /search.json. */
(function () {
  "use strict";

  var LS = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem("ts." + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem("ts." + k, JSON.stringify(v));
      } catch (e) {}
    },
  };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------------- reading settings ---------------- */
  var html = document.documentElement;
  var body = document.body;

  function applySettings() {
    var size = LS.get("size", 0);
    html.setAttribute("data-size", String(size));
    var calm = LS.get("calm", false);
    var spaced = LS.get("spaced", false);
    body.classList.toggle("calm", !!calm);
    body.classList.toggle("spaced", !!spaced);
    var cb = $("#calm");
    if (cb) {
      cb.textContent = calm ? "On" : "Off";
      cb.setAttribute("aria-pressed", String(!!calm));
    }
    var sb = $("#spacing");
    if (sb) {
      sb.textContent = spaced ? "On" : "Off";
      sb.setAttribute("aria-pressed", String(!!spaced));
    }
    $$("[data-size]").forEach(function (b) {
      var on = Number(b.dataset.size) === Number(size);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  applySettings();

  var reader = $("#reader");
  var panel = $("#reader-panel");
  if (reader && panel) {
    reader.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      reader.setAttribute("aria-expanded", String(open));
    });
    $$("[data-size]").forEach(function (b) {
      b.addEventListener("click", function () {
        LS.set("size", Number(b.dataset.size));
        applySettings();
      });
    });
    var calm = $("#calm");
    if (calm) {
      calm.addEventListener("click", function () {
        LS.set("calm", !LS.get("calm", false));
        applySettings();
      });
    }
    var sp = $("#spacing");
    if (sp) {
      sp.addEventListener("click", function () {
        LS.set("spaced", !LS.get("spaced", false));
        applySettings();
      });
    }
  }

  /* ---------------- read aloud ---------------- */
  var speakBtn = $("#speak");
  var speaking = false;
  function usableText() {
    var main = $("#main");
    if (!main) return "";
    var clone = main.cloneNode(true);
    $$(".vote-btns, .crumbs, .sidebox, .chart-note", clone).forEach(function (n) { n.remove(); });
    return clone.textContent.replace(/\s+/g, " ").trim();
  }
  if (speakBtn) {
    if (!("speechSynthesis" in window)) {
      speakBtn.hidden = true;
    } else {
      speakBtn.addEventListener("click", function () {
        if (speaking) {
          window.speechSynthesis.cancel();
          return;
        }
        var u = new SpeechSynthesisUtterance(usableText());
        u.rate = 0.92;
        u.pitch = 1;
        u.onend = u.onerror = function () {
          speaking = false;
          speakBtn.textContent = "Listen";
          speakBtn.setAttribute("aria-pressed", "false");
        };
        window.speechSynthesis.speak(u);
        speaking = true;
        speakBtn.textContent = "Stop";
        speakBtn.setAttribute("aria-pressed", "true");
      });
    }
  }

  /* ---------------- glossary ---------------- */
  var defBox = null;
  function closeDef() {
    if (defBox) {
      defBox.remove();
      defBox = null;
    }
  }
  document.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest(".gloss");
    if (!g) {
      closeDef();
      return;
    }
    e.preventDefault();
    var wasOpen = defBox && defBox.dataset.for === g.dataset.def;
    closeDef();
    if (wasOpen) return;
    defBox = document.createElement("span");
    defBox.className = "gloss-def";
    defBox.dataset.for = g.dataset.def;
    defBox.textContent = g.dataset.def;
    document.body.appendChild(defBox);
    var r = g.getBoundingClientRect();
    defBox.style.left =
      Math.max(10, Math.min(r.left + window.scrollX, window.innerWidth - defBox.offsetWidth - 12)) + "px";
    defBox.style.top = r.bottom + window.scrollY + 8 + "px";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDef();
  });

  /* ---------------- search palette ---------------- */
  var idx = null;
  var pal = $("#palette");
  var pin = $("#palette-input");
  var plist = $("#palette-list");
  var active = -1;
  function loadIdx(cb) {
    if (idx) return cb(idx);
    fetch("/search.json")
      .then(function (r) { return r.json(); })
      .then(function (d) { idx = d; cb(d); })
      .catch(function () { cb([]); });
  }
  function renderPalette(q) {
    if (!plist) return;
    var term = (q || "").toLowerCase().trim();
    var rows = (idx || [])
      .filter(function (r) {
        return !term || (r.t + " " + r.s + " " + r.q).toLowerCase().indexOf(term) > -1;
      })
      .slice(0, 9);
    plist.innerHTML = rows
      .map(function (r, i) {
        return (
          '<li><a href="' + r.u + '"' + (i === active ? ' class="is-active"' : "") + '>' +
          '<span class="pk">' + r.k + "</span>" + r.t + " &mdash; <em>" + r.s + "</em></a></li>"
        );
      })
      .join("");
  }
  if (pal && pin) {
    $("#find").addEventListener("click", function () {
      var open = pal.hidden;
      pal.hidden = !open;
      $("#find").setAttribute("aria-expanded", String(open));
      if (open) {
        loadIdx(function () { renderPalette(""); pin.focus(); });
      }
    });
    pin.addEventListener("input", function () { active = -1; renderPalette(pin.value); });
    pin.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { active = Math.min(active + 1, $$("a", plist).length - 1); e.preventDefault(); renderPalette(pin.value); }
      else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); e.preventDefault(); renderPalette(pin.value); }
      else if (e.key === "Enter") { var l = $$("a", plist)[active < 0 ? 0 : active]; if (l) l.click(); }
      else if (e.key === "Escape") { pal.hidden = true; $("#find").setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && e.target === document.body)) {
        e.preventDefault();
        if (pal.hidden) $("#find").click();
      }
    });
  }

  /* ---------------- index filters ---------------- */
  var pgrid = $("#p-grid");
  if (pgrid) {
    var pcs = $$(".card", pgrid);
    var pcount = $("#p-count");
    function pupdate() {
      var on = $(".chip.is-on", $(".filterbar"));
      var f = on ? on.dataset.filter : "all";
      var n = 0;
      pcs.forEach(function (c) {
        var show = f === "all" || c.dataset.era === f;
        c.hidden = !show;
        if (show) n++;
      });
      if (pcount) pcount.textContent = n + (n === 1 ? " philosopher" : " philosophers") + " shown";
    }
    $$(".chip[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".chip[data-filter]").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        pupdate();
      });
    });
    pupdate();
  }
  if ($("#c-count") && $(".branch")) {
    var ccs = $$(".branch .card");
    function cupdate() {
      var on = $(".chip.is-on", $(".filterbar"));
      var band = on ? Number(on.dataset.age) : 0;
      var n = 0;
      ccs.forEach(function (c) {
        var show = !band || Number(c.dataset.age) <= band;
        c.hidden = !show;
        if (show) n++;
      });
      $$(".branch").forEach(function (s) {
        s.hidden = !$$(".card", s).some(function (c) { return !c.hidden; });
      });
      $("#c-count").textContent = n + " of " + ccs.length + " ideas shown";
    }
    $$(".chip[data-age]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".chip[data-age]").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        cupdate();
      });
    });
    cupdate();
  }

  /* ---------------- wonder board (home) ---------------- */
  var wq = $("#wonder-q");
  if (wq) {
    var wonders = $$(".ticker li").map(function (li) { return li.textContent; });
    var cur = LS.get("wonderIdx", 0) % wonders.length;
    function showW(i) {
      cur = ((i % wonders.length) + wonders.length) % wonders.length;
      wq.textContent = wonders[cur];
      LS.set("wonderIdx", cur);
      var list = LS.get("wonderChosen", []);
      var cb2 = $("#think-it");
      if (cb2) cb2.checked = list.indexOf(cur) > -1;
      var c = $("#think-count");
      if (c) c.textContent = list.length ? "You have taken on " + list.length + " wonder" + (list.length > 1 ? "s" : "") + "." : "";
    }
    showW(cur);
    var nw = $("#next-wonder");
    if (nw) nw.addEventListener("click", function () { showW(cur + 1); });
    var ti = $("#think-it");
    if (ti) {
      ti.addEventListener("change", function () {
        var list = LS.get("wonderChosen", []);
        var i = list.indexOf(cur);
        if (ti.checked && i === -1) list.push(cur);
        if (!ti.checked && i > -1) list.splice(i, 1);
        LS.set("wonderChosen", list);
        showW(cur);
      });
    }
  }

  /* ---------------- wonder wall ---------------- */
  var wall = $("#wall");
  if (wall) {
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function paint() {
      var mine = LS.get("wonders", []);
      var html2 = mine
        .map(function (w) {
          return '<div class="wq mine">' + esc(w) + "<small>Yours &middot; saved on this device</small></div>";
        })
        .join("");
      html2 += $$("#wall-seed .wq").map(function (n) { return n.outerHTML; }).join("");
      wall.innerHTML = html2;
    }
    paint();
    var form = $("#wonder-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = $("#wonder-input").value.trim();
        if (!v) return;
        var mine = LS.get("wonders", []);
        mine.unshift(v);
        LS.set("wonders", mine.slice(0, 40));
        $("#wonder-input").value = "";
        paint();
      });
    }
  }

  /* ---------------- vote ---------------- */
  var vote = $(".vote");
  if (vote) {
    var slug = vote.dataset.slug;
    var res = $("#vote-results");
    var thanks = $("#vote-thanks");
    var prior = LS.get("vote." + slug, null);
    function showPrior() {
      if (!prior) return;
      res.hidden = false;
      $$(".vote-btn", vote).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.vote === prior));
      });
      if (thanks) {
        thanks.textContent =
          "You said: " +
          { yes: "Yes, I think so", no: "No, and here's why", unsure: "I'm not sure yet" }[prior] +
          ". You can change your mind.";
      }
    }
    showPrior();
    $$(".vote-btn", vote).forEach(function (b) {
      b.addEventListener("click", function () {
        prior = b.dataset.vote;
        LS.set("vote." + slug, prior);
        $$(".vote-btn", vote).forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        showPrior();
      });
    });
  }
})();
