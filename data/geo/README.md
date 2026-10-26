# Geometry

| File | Source | Used for |
|---|---|---|
| `states-10m.json` | us-atlas 3.0.1 `states-10m.json` (unprojected, lon/lat); same file as before, moved from `data/` | catchment map (D), projected with `d3.geoAlbersUsa` |
| `counties-albers-10m.json` | us-atlas 3.0.1 `counties-albers-10m.json` (Census 2017 cartographic boundaries, **pre-projected** to 975×610 with Albers USA); copied from the team's Milestone 6 dashboard (`node_modules/us-atlas`) | county map (C), drawn with `d3.geoPath()` and no projection |
| `us-atlas-LICENSE.txt` | us-atlas licence (ISC) | |

## Join checks (run by `scripts/build_data.py`, reported in `headline.json`)

- County shapes: 3,142. County rows: 3,143. Join key: `fips` (5-character string) = feature `id`.
- All 3,140 counties with both plotted values have a shape.
- Valdez-Cordova, AK (`02261`) has a 2017 shape but no OB-GYN or population data: drawn hatched as missing.
- Chugach (`02063`) and Copper River (`02066`), AK, were created from Valdez-Cordova in 2019. They have no
  2017 shape and no distance data. They are not crosswalked to the old shape and are not drawn.
- District of Columbia (`11001`) has a shape but no county row: drawn hatched as missing.
- Connecticut uses its 8 legacy counties (`09001`–`09015`) in both the data and the 2017 geometry, so they match.
- The state file includes territories (Puerto Rico, Guam, etc.); the catchment map keeps only the 50 states and DC.
