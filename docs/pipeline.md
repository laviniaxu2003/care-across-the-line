# Data pipeline

```
 raw downloads (not in repo) ──build_final.py (not in repo)──▶ data/source/   supplied processed inputs
                                                                    │
                                     python3 scripts/build_data.py  │  (+ scripts/build_flows.py)
                                                                    ▼
                                                             data/derived/  ──▶ js/*.js (D3) ──▶ index.html
                                                                    │
                                          scripts/validate.py ◀─────┘  (also checks index.html, methods.html)
```

The **pipeline boundary** is `data/source/`. Everything after it is reproducible with one command
from the repository root:

```bash
pip install -r requirements.txt
python3 scripts/build_data.py
```

## Steps

| Step | Script | Input | Output |
|---|---|---|---|
| Strict parsing | `build_data.py` `read_strict` | `counties.csv`, `states.csv`, `access_trend_by_tier.csv` | text columns kept as text (FIPS stays `"01001"`); blank → missing; any non-numeric text in a numeric column stops the build |
| A. Distance trend | `build_data.py` | `access_trend_by_tier.csv` | `trend_by_tier.csv` (7 tiers × 91 months; supplied weighted means, not re-averaged) |
| B. Added burden | `build_data.py` | `counties.csv` | `burden_by_state.csv` (all states), `burden_chart.csv` (top 7 + "Other 34 states", last) |
| C. County view | `build_data.py` | `counties.csv` | `counties_view.csv` (15 source columns + `dist_class`, `supply_class`, `inc100_no_obgyn`) |
| C2. Rurality | `build_data.py` | `counties.csv` | `rurality_metro.csv` (ranks 1–2 vs 6–7 × metro / nonmetro, with denominators) |
| D/E. Catchments | `build_flows.py` (the original V1 script, revised) | `counties.csv`, `states.csv` | `state_flows.csv` (137 origin→destination pairs, 100 cross-state), `receiving.csv` (50 states + DC) |
| Headlines | `build_data.py` | all of the above | `headline.json` (values, coverage lists, and `display` strings used in the HTML) |
| Geometry join | `build_data.py` | `data/geo/counties-albers-10m.json` (ids only) | unmatched ids reported in `headline.json` |
| Validation | `validate.py` | source, derived, HTML | PASS/FAIL list; non-zero exit on any failure |

The 5.8 MB monthly county panel is used only for validation; the browser loads the small
pre-aggregated trend table instead. The outcome tables are not loaded by the browser.

## Category definitions (county view)

`dist_class`: 1 = change ≤ 0; 2 = 0 < change < 100; 3 = change ≥ 100 miles.
`supply_class`: 1 = 0 per 10k; 2 = 0 < rate ≤ 2.5; 3 = rate > 2.5. Missing values get class 0 (drawn as no data).

## Validation checks (scripts/validate.py)

Keys and formats · dates (no monthly gaps; monthly panel = county table for May 2022 and Jul 2026) ·
missingness (exact expected missing rows; known population of excluded rows = 1,735; unknown metro
kept distinct; zero OB-GYN counts preserved, and `obgyn == 0` exactly when the rate is 0) · legal ranges
and `change = jul2026 − may2022` · catchment reconciliation (assigned total = valid origin population;
incoming = outgoing; retained + outgoing = residents for every state; VA → DC present; DC per-clinic
unavailable; no infinite values; no assigned population in states without clinics; Kansas values) ·
chart summaries (shares sum to 100%; "Other" last; 83.4%; 589/316/297; bivariate emphasis cell = 316;
rurality cells; trend table = source) · HTML (`data-h` numbers equal `headline.json`; retired claims absent
from the story page).

## Front end

Plain HTML, CSS, D3 v7 and TopoJSON, shared through `window.CATL`. Each figure has a status element
that shows "Loading data…", disappears once the chart draws, or turns into an error message if a file
fails. The page never substitutes bundled values; the old `data/bundle.js` was removed.
