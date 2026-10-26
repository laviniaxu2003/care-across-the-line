# Care Across the Line

A data story on how potential access to abortion care after *Dobbs* depends on geography, local
healthcare resources and provider networks that cross state lines. Built for Harvard CS 1710.

**Live site:** [_Care Across the Line_](https://laviniaxu2003.github.io/care-across-the-line/)

Claire Gutermuth · Chloe Qiu · Lavinia Xu

## Run it

```bash
pip install -r requirements.txt     # pandas, numpy
python3 scripts/build_data.py       # rebuild data/derived/ and run every validation check
python3 -m http.server 8000         # then open http://localhost:8000
```

`build_data.py` resolves paths from the repository root, so it can be run from any directory. It
exits non-zero if any check in `scripts/validate.py` fails (including a mismatch between a number
written in the HTML and the generated `headline.json`).

The pages must be served over HTTP: they fetch `data/derived/*` and `data/geo/*` with D3. There is no
bundled fallback; if a file fails to load, the chart that needs it shows an error and a banner warns
that the text numbers could not be checked. D3 7.9.0, TopoJSON 3.0.2 and the Google fonts load from
public CDNs, so the site also needs an internet connection. It is static and GitHub Pages compatible
(`.nojekyll` is kept).

## Structure

```
index.html              the story (sections A–F)
methods.html            sources, formulas, coverage, limitations
css/style.css           shared styles (light + dark tokens)
js/data.js              explicit CSV parsing, loaders, loading/failure states, tooltip, event bus
js/distance-trend.js    A  distance to nearest clinic by policy group, 2019–2026
js/burden-bars.js       B  state shares of added population-weighted distance
js/county-explorer.js   C  linked county map + scatterplot (from the Milestone 6 dashboard)
js/rurality.js          C2 metro/nonmetro paired dots
js/catchment-map.js     D  catchment map + receiving-state profile (novel view)
js/clinic-load.js       E  potential catchment per clinic (corrected dumbbell)
js/main.js              wiring
data/source/            supplied processed inputs (unchanged; see PROVENANCE.md)
data/derived/           generated chart tables + headline.json (do not edit by hand)
data/geo/               state and county TopoJSON (see README.md there)
scripts/build_data.py   build: trend, burden, county view, rurality, headline numbers
scripts/build_flows.py  build: state flows and receiving-state catchments (original script, revised)
scripts/validate.py     checks on inputs, outputs and the HTML
docs/data-audit.md      every headline: source, formula, dates, denominator, exclusions, status
docs/pipeline.md        pipeline boundary, outputs, validation, geometry
```

## Adding a chart

Write `js/<name>.js` exporting `window.CATL.<name> = function(rows, ...)`. Add its file to the `SPECS`
table in `js/data.js` (listing which columns are numeric), give the figure a `.status` element, and
call it from `js/main.js` with `ns.run("#st-<name>", ["<dataset>"], draw)` so it gets loading and failure
states. Use CSS variables for every colour so dark mode keeps working, and the shared
`ns.tip(event, html)` / `ns.hideTip` for tooltips. If the chart's numbers appear in the text, add them
to `display` in `build_data.py` and mark the text with `data-h="<key>"`; `validate.py` will then check
them. `js/clinic-load.js` is a compact worked example.

## Sources

Myers Abortion Facility Database (OSF `8dg7r`) · Guttmacher State Policy Database · HRSA Area Health
Resource File · CDC PLACES · CDC WONDER · us-atlas 3.0.1 (US Census boundaries).
