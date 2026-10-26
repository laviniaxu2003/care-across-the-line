# Care Across the Line

A data story on where abortion care moved after *Dobbs*, built for Harvard CS 1710.

**Live site:** _(GitHub Pages URL goes here once published)_

Claire Gutermuth · Chloe Qiu · Lavinia Xu

## Structure

```
index.html              the story
methods.html            data & methods
css/style.css           shared styles (light + dark)
js/data.js              loading, shared tooltip, formatters
js/catchment-map.js     view 1 — who serves whom
js/clinic-load.js       view 2 — load per receiving state
js/main.js              wiring
data/                   state_flows.csv, receiving_states.csv, headline.json, states-10m.json
build_flows.py          builds data/ from the merged county package
```

## Adding a chart

Write `js/<name>.js` exporting `window.CATL.<name> = function(D, sel)`, where `D` is
`{flows, recv, head, topo}`. Use CSS variables for every colour (`var(--receiver)`,
`var(--exporter)`, `var(--ink-2)`, `var(--rule)`) so dark mode keeps working, and the
shared `ns.tip(event, html)` / `ns.hideTip` for tooltips. `js/clinic-load.js` is the
worked example. Then add the script tag to both pages and one call in `js/main.js`.

## Running locally

```
python3 -m http.server 8000
```

The pages fetch `data/*.csv` over HTTP, so opening `index.html` as a `file://` URL
falls back to the bundled copy in `data/bundle.js`.

## Sources

Myers Abortion Facility Database (OSF `8dg7r`) · Guttmacher State Policy Database ·
HRSA Area Health Resource File · CDC PLACES · CDC WONDER.
