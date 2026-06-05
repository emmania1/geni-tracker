# GENI KPI Tracker

A static, data-driven dashboard tracking **Genius Sports (NYSE: GENI)** along the three
questions the build brief specified:

1. **Sports-gambling KPIs** — the market / the pie
2. **GENI's share** — its capture of that pie
3. **Inventory monetization over time** — are they milking the same inventory better?

It is the time-series *tracker* (not the bull/bear/synthesis thesis tool it was styled from).
All numbers live in one file — [`data/metrics.json`](data/metrics.json) — so maintaining it
means editing JSON, never the markup or code.

Live site: **https://emmania1.github.io/geni-tracker** (once Pages is enabled — see below).

---

## Repo layout

```
geni-tracker/
  index.html              # structure only — header, KPI strip, 3 section containers, footer
  assets/
    css/styles.css        # theme lifted from the base GENI panel + tracker additions
    js/app.js             # fetch metrics.json → render KPI strip + all charts (Chart.js)
  data/
    metrics.json          # ALL series + KPIs live here
  README.md
```

The chart cards are **generated from `metrics.json` at load time** and grouped by `section`.
Each `<canvas>` is created with `id === series.id`. This keeps `index.html` free of inline
data and means **adding or removing a whole series is also a JSON-only edit** (no HTML change).

---

## How to add a data point (the common case)

Find the series by `id` in `data/metrics.json` and append to its `data` array:

```jsonc
{
  "id": "us_handle",
  "status": "ok",
  "data": [
    {"period": "2025", "value": 175},
    {"period": "2026", "value": 205}   // ← add this line, save, done
  ]
}
```

- `period` is any label string (`"2025"`, `"2026E"`, `"Q1 2026"`, `"H1 2026"` — quarterly and
  annual can mix on one chart).
- If a series is currently empty, also flip `"status": "needs_data"` → `"status": "ok"` so the
  chart draws the line instead of the **awaiting data** placeholder.
- Update the top-level `"updated"` date and the header `price` / `mktcap` / `ev` when relevant.

No build step. Refresh the page (or redeploy) and the chart picks it up.

---

## Data-integrity tagging — read before adding numbers

Every series carries a `type`. **Do not invent numbers; if unsure, leave `data: []` and set
`"status": "needs_data"`.** The UI distinguishes the three types so a real number is never
confused with a placeholder:

| `type`         | Meaning                                         | Line style          | Tag color |
|----------------|-------------------------------------------------|---------------------|-----------|
| `reported`     | Straight from a filing (6-K, regulator report)  | **solid**           | green     |
| `estimate`     | Analyst / internal estimate                     | **dashed**          | gold      |
| `illustrative` | Directional only — *not* a real metric          | **dotted, greyed**  | grey      |

`"status": "needs_data"` with an empty `data` array renders an empty, labeled chart (axes +
title + an "awaiting data" note) — never a fabricated line.

Color also encodes the **section**: market = green, GENI share = blue, monetization = gold.
(`illustrative` overrides to grey so it always reads as not-real.)

### Optional per-series fields
- `source` — short provenance string, shown under the chart title.
- `note` — one-line context, shown under the chart title.
- `benchmark: {label, value}` — draws a dashed reference line (e.g. EU mature in-play ≈ 78%).

### Seeded vs empty
Only six series are pre-filled, all migrated from the internal base panel (Jun 2026):
`us_handle`, `us_inplay_pct`, `bettor_penetration`, `geni_revenue`, `ebitda_margin`
(all `estimate`), and `rev_per_event` (`illustrative`). Everything else is `needs_data`.

> ⚠️ **Denominator note:** the base panel measures in-play as **% of GGR**, while the build
> brief references **% of handle**. The seeded `us_inplay_pct` series is faithfully labeled
> **% of GGR**. Decide which denominator you want before adding more points, and relabel if needed.

---

## Update cadence

- **Each GENI 6-K** — refresh GENI revenue, segments, margins, rights/leagues, take-rate and
  attach metrics. Q1 2026 6-K was dated **May 7 2026**; next is **~Aug 11 2026**.
  SEC filings: EDGAR **CIK 1834489**.
- **Quarterly** — refresh state-handle / GGR / in-play / # legal states from state regulator
  reports + Roth / Texas Capital notes.
- **Opportunistic** — Sportradar split from SRAD filings; prediction-market volume from
  Kalshi / Polymarket public data.

Bump the top-level `"updated"` field each time — it drives the header "Last updated" stamp.

---

## Local preview

`fetch()` needs HTTP (not `file://`), so serve the folder:

```bash
cd geni-tracker
python3 -m http.server 8000
# open http://localhost:8000
```

---

## GitHub Pages

1. Push this repo to `emmania1/geni-tracker`.
2. **Settings → Pages → Source = `main` branch, root (`/`)**.
3. Wait ~1 min; it publishes at **https://emmania1.github.io/geni-tracker**.

No backend, no build — Pages serves the static files and `app.js` fetches `data/metrics.json`
client-side.

---

*Framework output — not investment advice, a price target, or a buy/sell recommendation.*
