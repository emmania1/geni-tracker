/* ============================================================================
   GENI KPI Tracker — app.js
   Single responsibility: fetch data/metrics.json and render the whole page.
   - KPI strip from `kpis[]`
   - One Chart.js line chart per `series[]`, grouped into its `section`
   - Visual conventions:
       color  : market = green, share = blue, monetization = gold
       line   : reported = solid, estimate = dashed, illustrative = dotted+grey
       empty  : needs_data series render axes + a subtle "awaiting data" note
   Adding a data point or a whole new series = edit metrics.json only. No code change.
   ========================================================================== */
(function () {
  "use strict";

  var SECTION_COLOR = { market: "#3fb950", share: "#1f6feb", monetization: "#d4a017" };
  var ILLUSTRATIVE = "#8b949e";
  var GRID = "#1c2230";
  var AXIS = "#8b949e";

  /* ---- Chart.js global defaults + "awaiting data" plugin ---- */
  if (window.Chart) {
    Chart.defaults.color = AXIS;
    Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.plugins.legend.display = false;

    Chart.register({
      id: "awaitingData",
      afterDraw: function (chart) {
        var pts = (chart.data.datasets || []).reduce(function (n, d) {
          return n + ((d.data && d.data.length) || 0);
        }, 0);
        if (pts > 0) return; // has real data → nothing to overlay
        var ctx = chart.ctx, area = chart.chartArea;
        if (!area) return;
        ctx.save();
        ctx.fillStyle = "#6e7681";
        ctx.font = "11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("awaiting data — populate metrics.json",
          (area.left + area.right) / 2, (area.top + area.bottom) / 2);
        ctx.restore();
      }
    });
  }

  /* ---- helpers ---- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function unitSuffix(unit, v) {
    if (unit === "%") return v + "%";
    if (unit === "x") return v + "×";
    if (unit === "$B") return v + " $B";
    if (unit === "$M") return v + " $M";
    if (unit === "$") return "$" + v;
    return "" + v;
  }

  function styleFor(series) {
    var isIllus = series.type === "illustrative";
    var color = isIllus ? ILLUSTRATIVE : (SECTION_COLOR[series.section] || "#e6edf3");
    var dash = series.type === "reported" ? []      // solid
             : series.type === "estimate" ? [6, 4]  // dashed
             : [2, 3];                               // dotted (illustrative)
    return { color: color, dash: dash, width: isIllus ? 1.6 : 2 };
  }

  /* ---- chart ---- */
  function makeChart(canvas, series) {
    var hasData = series.status !== "needs_data" && series.data && series.data.length > 0;
    var st = styleFor(series);
    var labels = hasData ? series.data.map(function (d) { return d.period; }) : ["", ""];
    var datasets = [];

    if (hasData) {
      datasets.push({
        label: series.label,
        data: series.data.map(function (d) { return d.value; }),
        borderColor: st.color,
        backgroundColor: st.color,
        borderWidth: st.width,
        borderDash: st.dash,
        pointRadius: 2.6,
        pointHoverRadius: 4,
        tension: 0.18,
        spanGaps: true
      });
      if (series.benchmark && typeof series.benchmark.value === "number") {
        datasets.push({
          label: series.benchmark.label + " (" + unitSuffix(series.unit, series.benchmark.value) + ")",
          data: labels.map(function () { return series.benchmark.value; }),
          borderColor: ILLUSTRATIVE,
          borderWidth: 1.2,
          borderDash: [3, 3],
          pointRadius: 0
        });
      }
    }

    var unit = series.unit || "";
    return new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, position: "top", labels: { boxWidth: 18, font: { size: 9 } } },
          tooltip: {
            enabled: hasData,
            callbacks: { label: function (c) { return c.dataset.label + ": " + unitSuffix(unit, c.parsed.y); } }
          }
        },
        scales: {
          x: { grid: { color: GRID }, ticks: { font: { size: 9 } } },
          y: { grid: { color: GRID }, beginAtZero: true,
               ticks: { font: { size: 9 }, callback: function (v) { return unitSuffix(unit, v); } } }
        }
      }
    });
  }

  /* ---- card DOM ---- */
  function cardEl(series) {
    var card = document.createElement("div");
    card.className = "chart-card";

    var ct = document.createElement("div");
    ct.className = "ct";
    var title = document.createElement("span");
    title.textContent = series.label + (series.unit ? " (" + series.unit + ")" : "");
    var tagType = series.status === "needs_data" ? "needs_data" : series.type;
    var tag = document.createElement("span");
    tag.className = "tag tag-" + tagType;
    tag.textContent = series.status === "needs_data" ? "awaiting data" : series.type;
    ct.appendChild(title);
    ct.appendChild(tag);

    var cs = document.createElement("div");
    cs.className = "cs";
    var bits = [];
    if (series.note) bits.push(series.note);
    if (series.source) bits.push("src: " + series.source);
    cs.textContent = bits.join(" · ");

    var wrap = document.createElement("div");
    wrap.className = "canvas-wrap";
    var canvas = document.createElement("canvas");
    canvas.id = series.id; // canvas id === series id
    wrap.appendChild(canvas);

    card.appendChild(ct);
    card.appendChild(cs);
    card.appendChild(wrap);
    return { card: card, canvas: canvas };
  }

  /* ---- renderers ---- */
  function renderKpis(kpis) {
    var strip = document.getElementById("kpi-strip");
    if (!strip) return;
    strip.innerHTML = "";
    (kpis || []).forEach(function (k) {
      var arrow = k.trend === "up" ? "▲" : k.trend === "down" ? "▼" : "→";
      var trCls = k.trend === "up" ? "tr-up" : k.trend === "down" ? "tr-down" : "tr-flat";
      var el = document.createElement("div");
      el.className = "kpi";
      el.innerHTML =
        '<div class="k">' + esc(k.label) + '</div>' +
        '<div class="v">' + esc(k.value) + ' <span class="tr ' + trCls + '">' + arrow + '</span></div>' +
        '<div class="vs">' + esc(k.sub || "") + '</div>';
      strip.appendChild(el);
    });
  }

  function renderSection(hostId, list) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = "";
    if (!list.length) { host.innerHTML = '<div class="cs">No series defined for this section.</div>'; return; }
    list.forEach(function (s) {
      var made = cardEl(s);
      host.appendChild(made.card);
      try { makeChart(made.canvas, s); }
      catch (e) { console.error("chart error:", s.id, e); }
    });
  }

  function setHeader(m) {
    var stats = document.getElementById("hd-stats");
    if (stats) {
      stats.innerHTML =
        "Price <b>$" + esc(m.price) + "</b> · Mkt cap <b>" + esc(m.mktcap) + "</b> · EV <b>" + esc(m.ev) +
        "</b> · <span style=\"color:var(--mut)\">Last updated " + esc(m.updated) + "</span>";
    }
    var asof = document.getElementById("asof");
    if (asof) {
      asof.textContent = "Baseline as of " + (m.updated || "—") +
        " · appended each GENI 6-K (next ~Aug 11 2026) and each AGA quarter.";
    }
  }

  /* ---- load metrics ----
     Read the inline <script id="metrics-data"> block FIRST — this works when the page is
     opened directly as a local file (file://), with no network request. Only fall back to
     fetch() if the inline block is missing/unparseable (e.g. during local dev over http). */
  function loadMetrics() {
    var el = document.getElementById("metrics-data");
    if (el && el.textContent.trim()) {
      try { return Promise.resolve(JSON.parse(el.textContent)); }
      catch (e) { console.error("inline #metrics-data parse failed, falling back to fetch:", e); }
    }
    return fetch("data/metrics.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  /* ---- boot ---- */
  loadMetrics()
    .then(function (m) {
      setHeader(m);
      renderKpis(m.kpis);
      var by = { market: [], share: [], monetization: [] };
      (m.series || []).forEach(function (s) { if (by[s.section]) by[s.section].push(s); });
      renderSection("sec-market", by.market);
      renderSection("sec-share", by.share);
      renderSection("sec-monetization", by.monetization);
    })
    .catch(function (e) {
      console.error(e);
      ["sec-market", "sec-share", "sec-monetization"].forEach(function (id) {
        var host = document.getElementById(id);
        if (host) host.innerHTML =
          '<div class="err">Could not load metrics (' + esc(e.message) +
          '). Data is embedded in index.html as &lt;script id="metrics-data"&gt;; re-run ' +
          '<code>python3 scripts/add_point.py --sync</code> if it is missing.</div>';
      });
    });
})();
