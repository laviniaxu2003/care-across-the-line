# Care Across the Line - CS 1710 submission

**Live site:** https://laviniaxu2003.github.io/care-across-the-line/
**Repository:** https://github.com/laviniaxu2003/care-across-the-line

Claire Gutermuth · Chloe Qiu · Lavinia Xu

## Open it

The pages fetch their data with D3, so they must be served over HTTP. Opening
`index.html` by double-clicking it shows an error banner instead of charts.

```bash
cd <this folder>
python3 -m http.server 8000
```

Then open **http://localhost:8000** — or just use the live link above.

| Page | URL |
|---|---|
| The story, with all six views | http://localhost:8000/ |
| Data & methods | http://localhost:8000/methods.html |
| Visualization drafts (sketches 13 and 15) | http://localhost:8000/drafts/ |

## What is here

```
index.html  methods.html      the site
drafts/                       the two unimplemented visualization drafts
css/  js/                     styles and the six D3 views
data/derived/  data/geo/      everything the pages load at runtime
data/source/                  the merged inputs the pipeline reads
scripts/  docs/               the build pipeline and its documentation
```

`scripts/build_data.py` regenerates `data/derived/` and runs 41 validation
checks, including a check that every number printed in the HTML matches the
generated `headline.json`. It exits non-zero if any check fails.

```bash
pip install -r requirements.txt
python3 scripts/build_data.py
```
