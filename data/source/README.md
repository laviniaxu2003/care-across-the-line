# Processed data

Built 14 Oct 2026 from the live sources. Every number traces to one of them; nothing is
estimated or typed in by hand.

**Read `DATA_DICTIONARY.md` before you plot anything.** It is two pages.

```
counties.csv                 3,143 rows x 31 cols   one row per county   START HERE
states.csv                      50 rows x 20 cols   state rollups
state_outcomes_by_year.csv     400 rows             50 states x 2017-2024
county_distance_monthly.csv  285,922 rows           county x month, 2019-2026
chain_by_group.csv             140 rows             pre-aggregated, pre-weighted
access_trend_by_tier.csv       637 rows             pre-aggregated by policy tier
prenatal_visits_maternal_complications_bystate.xlsx
                               255 rows             51 (50 states + DC) x 2020-2024
```

Everything joins on `fips` (county) or `state_abbr` (state). Read `fips` as a **string**.

```python
import pandas as pd
c = pd.read_csv("counties.csv", dtype={"fips": str})
```
```js
const c = await d3.csv("counties.csv", d3.autoType);   // fips stays a string
```

## Which file for which question

| You want to show | Use |
|---|---|
| Counties by access loss vs OB-GYN supply | `counties.csv` — `drive_miles_jul2026`, `obgyn_per_10k_women`, `births_annual` |
| A map | `counties.csv` — join `fips` to any US county TopoJSON; colour by `access_band`, `obgyn_band` or `hit_twice` |
| Preventive care by policy environment | `chain_by_group.csv` — already weighted, do not recompute |
| Distance changing over time | `access_trend_by_tier.csv` (7 lines) or `county_distance_monthly.csv` (per county) |
| Infant mortality / preterm before vs after | `state_outcomes_by_year.csv` |
| Zero prenatal visits / maternal complications | `prenatal_visits_maternal_complications_bystate.xlsx` (sheet `Data`; 2020–24 only) |
| A state-level summary | `states.csv` |

## Sources

| | What we took | Period |
|---|---|---|
| **Myers Abortion Facility Database** — the Abortion Access Dashboard's underlying data, [OSF 8dg7r](https://osf.io/8dg7r/) | road travel miles from each county to the nearest open clinic, monthly; open clinic counts by state | 2009–Jul 2026 |
| **Guttmacher State Policy Database** — [states.guttmacher.org](https://states.guttmacher.org/policies/) | 7-tier policy environment | accessed Oct 2026 |
| **HRSA Area Health Resource File 2024–25** | OB-GYNs, obstetric hospitals, births, women 15–44, rural–urban codes | 2020–24 |
| **CDC PLACES** county releases | mammography, cervical screening, checkups, uninsured, transportation | 2020 & 2022 BRFSS |
| **CDC WONDER** — Linked Birth/Infant Death + Natality, exported by hand | infant mortality, preterm and very preterm rates by state and year; zero prenatal visits and maternal complications (workbook) | 2017–2024 (workbook 2020–2024) |
| **NCHS** county teen birth file | teen birth rate | 2020 |

## Rebuilding

```bash
cd ../data && ../venv/bin/python build_final.py
```
Raw inputs stay in `../data/` (the AHRF zip, the 98 MB Myers panel, the WONDER exports,
the API responses), so this runs offline and reproduces every file above.

## What it already shows

_Figures checked against the CSVs on 18 Oct 2026; the earlier values and the analysis are in
`../analysis/ERRATA.md` and `../analysis/FINDINGS.md`. Policy tiers are the October 2026
Guttmacher classification applied to every year, not a timeline of when laws took effect._

- **1,273 counties** are further from a clinic than in May 2022 (`drive_miles_change > 0`);
  **20.7 million women 15–44** live in them. Hinds County, Mississippi — home of the clinic
  in *Dobbs* — went from **6.5 to 340 miles**, nearest provider now in Georgia.
- In the Most Restrictive tier the median county went **74 → 151 road miles**, and
  **82%** now cross a state line. Weighted by women 15–44, the tier's mean went
  **37.5 → 123.0 → 215.6 miles** (May 2022 → Jul 2022 → Jan 2023) and was 212.5 in Jul 2026.
- **1,457 counties (46%)** have no OB-GYN (2023 count; 3,142 counties with data). Nonmetro:
  **65%** in restrictive states (ranks 1–3) vs **50%** in protective ones (ranks 5–7). The
  policy gap is real, but rurality drives more of it.
- Infant mortality (pooled deaths ÷ births) 2017–22 → 2023–24: **6.31 → 6.35** in the Most
  Restrictive tier, **4.41 → 4.32** in the Most Protective. With 2017–21 as the
  pre-period (2022 as a transition year): 6.29 → 6.35 and 4.42 → 4.32. These changes are
  small and sensitive to the choice of years and to Texas. Preterm rose in every tier
  against a 2017–21 or 2017–22 baseline, but not against 2020–21 (Restrictive fell 0.03 pts).
