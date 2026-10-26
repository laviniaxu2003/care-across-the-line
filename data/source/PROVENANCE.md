# Supplied processed inputs

These files are the team's **processed** tables (built 14 Oct 2026, documentation corrected 18 Oct 2026).
They are not raw downloads. They were moved here unchanged from the `data/data/` folder of the
project ZIP; `README.md` and `DATA_DICTIONARY.md` are the original documentation, also unchanged.
`data/source/` is the start of the reproducible pipeline (see `docs/pipeline.md`).

| File | Used by the site? |
|---|---|
| `counties.csv` | yes: burden, county view, rurality, catchments |
| `states.csv` | yes: clinic counts (May 2022, Jul 2026), resident women |
| `access_trend_by_tier.csv` | yes: distance trend |
| `county_distance_monthly.csv` | validation only (May 2022 / Jul 2026 agree with `counties.csv`); not loaded by the browser |
| `chain_by_group.csv`, `state_outcomes_by_year.csv`, `prenatal_visits_maternal_complications_bystate.xlsx` | no; kept for possible future views |

## Not reproducible from this repository

The original `README.md` says the tables are rebuilt with `cd ../data && ../venv/bin/python build_final.py`
from raw inputs (the AHRF zip, the 98 MB Myers panel, WONDER exports, API responses) and refers to
`../analysis/ERRATA.md` and `../analysis/FINDINGS.md`. None of these are in this repository, and
`build_final.py` and the raw inputs were not found in the team's working folders on this machine (searched
26 Oct 2026). `ERRATA.md` and `FINDINGS.md` exist in the separate Milestone 6 project
(`cs1710-milestone6/analysis/`). The steps that produced these tables therefore cannot be verified
here; everything downstream of them can.

## Corrections to the original documentation (recorded, not edited in place)

- `README.md` suggests `d3.csv("counties.csv", d3.autoType)` keeps `fips` as a string. It does not:
  `d3.autoType` turns `"01001"` into the number `1001`. The site parses columns explicitly
  (`js/data.js`) and the build reads every column as text before converting named numeric columns.
- `README.md` says "nothing is estimated or typed in by hand". PLACES values are modeled estimates (the
  dictionary says so), the WONDER outcomes were exported by hand, and several columns are derived.
- `hit_twice` uses **current** distance (`drive_miles_jul2026 >= 100`) and no OB-GYN (836 counties), not
  a distance *increase*. The 316-of-589 claim uses a separately derived flag (`inc100_no_obgyn`).
  `access_band` also describes current distance and is not used for distance change.
- The README's nonmetro comparison uses ranks 1–3 vs 5–7; the site uses ranks 1–2 vs 6–7. Both are
  correct for their own definitions; the site keeps one definition throughout.
