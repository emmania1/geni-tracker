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
  chart appears (empty `needs_data` series are hidden from the dashboard until they have data).
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

`"status": "needs_data"` with an empty `data` array is **hidden** from the dashboard until it has
data — the series definition stays in the JSON and the chart reappears automatically once populated.
Never a fabricated line.

Color also encodes the **section**: market = green, GENI share = blue, monetization = gold.
(`illustrative` overrides to grey so it always reads as not-real.)

### Optional per-series fields
- `source` — short provenance string, shown under the chart title.
- `note` — one-line context, shown under the chart title.
- `benchmark: {label, value}` — draws a dashed reference line (e.g. EU mature in-play ≈ 78%).

### Seeded vs empty
A verified baseline is loaded (2026-06-05). **Reported** actuals: US handle & GGR (AGA), GENI
group/segment revenue, adj EBITDA ($ and margin), net loss, and the Q1 2026 rights-cost ratio
(all GENI filings, CIK 1834489). **Estimate**: bettor penetration, the modeled in-play % series,
and the `*_guide` guidance series. **Illustrative**: the monetization-per-event index. Everything
else stays `needs_data` with a precise `source`/`note` so backfill is one step.

> ⚠️ **Denominator note:** the base panel measures in-play as **% of GGR**, while the build
> brief references **% of handle**. The seeded `us_inplay_pct` series is faithfully labeled
> **% of GGR**. Decide which denominator you want before adding more points, and relabel if needed.

---

## Update cadence

Verified primary sources for each block (use these — don't substitute estimates for reported lines):

- **Each GENI 6-K / 20-F** (EDGAR **CIK 1834489**) — refresh group revenue (`geni_revenue`),
  segment revenue (`geni_betting_rev`, `geni_media_rev`; note Sports Tech was discontinued as a
  separate segment from Q1 2026), adj EBITDA (`adj_ebitda_usd`, `ebitda_margin`), net loss
  (`geni_net_loss`), and rights-cost ratio (`rev_over_rights_cost`). Q1 2026 6-K was **May 7
  2026**; next is **~Aug 11 2026**.
- **Each AGA quarter** (American Gaming Association Commercial Gaming Revenue Tracker) — refresh
  US handle (`us_handle`), GGR & hold (`us_ggr`), and bettor penetration (`bettor_penetration`).
  Plot full calendar years on the annual axis; keep partial-year (e.g. Q1) figures in `note` only.
- **Opportunistic** — Sportradar split (`geni_srad_split`) from SRAD filings; prediction-market
  volume (`prediction_mkt_volume`) from Kalshi / Polymarket public data; in-play mix
  (`us_inplay_pct`) is *modeled* (operator decks + analyst notes), not reported — keep it `estimate`.

Guidance lives in dedicated `*_guide` series tagged `estimate` (dashed), so reported actuals stay
clean `reported` (solid). Bump the top-level `"updated"` field each time — it drives the header
"Last updated" stamp and the "Baseline as of …" caption. The fastest way to do all of this is the
helper script below.

### Helper: `scripts/add_point.py`

```bash
python scripts/add_point.py <series_id> <period> <value>
# e.g.
python scripts/add_point.py us_handle 2026 205
python scripts/add_point.py geni_revenue "2026E PF" 1100
```

It appends (or updates) that period's point, flips `needs_data → ok` if the series was empty, and
bumps `"updated"` to today. Stdlib only — no dependencies. It does **not** change a series' `type`;
set `reported` / `estimate` / `illustrative` by hand in the JSON.

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
