"""
Pipeline step added for Prototype V1, revised for Prototype 1 (Oct 2026).
counties.csv tells us, for every county, which state holds its nearest open abortion
clinic. Rolling that up by (origin state -> destination state) turns 3,143 rows into the
cross-border flow table the main message needs, plus the potential catchment of the
jurisdictions that are the nearest option for other states' counties.

Revisions to the original script:
- Paths resolve from the repository root (was ../data/, which does not exist in this repo).
- The catchment numerator is retained + incoming population. The original used
  own_women + imported_women, which counted residents whose nearest clinic is elsewhere.
- DC is kept as a destination (Arlington County, VA -> DC). Its clinic count and
  resident population are not in the supplied tables, so its per-clinic value is unavailable.
- Zero or unknown clinic counts give an unavailable per-clinic value, never inf or 0.
- The "national average" mixed coverage; the reference is now the 50 states with known
  clinic counts and the population assigned to them.

Called by scripts/build_data.py; can also be run alone:  python3 scripts/build_flows.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OVERVIEW_MIN_WOMEN = 50_000   # map overview hides cross-state links below this; disclosed on the page


def build(c, s, names, out_dir):
    # ---- 1. origin state -> destination state flows -----------------------------
    # counties with a known destination and population; the rest are reported, not dropped silently
    valid = c.dropna(subset=["nearest_provider_state", "women_15_44"])
    excluded = c.drop(valid.index)
    f = (valid.groupby(["state_abbr", "nearest_provider_state"], as_index=False)
              .agg(counties=("fips", "count"), women_15_44=("women_15_44", "sum")))
    f.columns = ["origin_abbr", "dest_abbr", "counties", "women_15_44"]
    f["origin_state"] = f.origin_abbr.map(names)
    f["dest_state"] = f.dest_abbr.map(names)
    if f.dest_state.isna().any():
        raise SystemExit(f"BUILD FAILED: unknown destination codes {f[f.dest_state.isna()].dest_abbr.unique()}")
    f["out_of_state"] = (f.origin_abbr != f.dest_abbr).astype(int)
    f = f.sort_values(["out_of_state", "women_15_44"], ascending=[False, False])
    f[["origin_abbr", "origin_state", "dest_abbr", "dest_state", "counties", "women_15_44",
       "out_of_state"]].to_csv(out_dir / "state_flows.csv", index=False, float_format="%.0f")

    # ---- 2. potential catchment of each receiving jurisdiction -------------------
    cross = f[f.out_of_state == 1]
    retained = f[f.out_of_state == 0].set_index("origin_abbr").women_15_44
    incoming = cross.groupby("dest_abbr").women_15_44.sum()
    outgoing = cross.groupby("origin_abbr").women_15_44.sum()
    n_origins = cross.groupby("dest_abbr").origin_abbr.nunique()
    n_counties = cross.groupby("dest_abbr").counties.sum()
    si = s.set_index("state_abbr")
    rows = []
    for j in sorted(set(s.state_abbr) | set(f.dest_abbr)):
        known = j in si.index
        clinics = si.facilities_jul2026[j] if known else np.nan
        ret, inc = retained.get(j, 0.0), incoming.get(j, 0.0)
        per = (lambda v: v / clinics) if known and clinics > 0 else (lambda v: np.nan)
        rows.append(dict(
            abbr=j, name=names[j], in_source_tables=int(known),
            clinics_may2022=si.facilities_may2022[j] if known else np.nan, clinics_jul2026=clinics,
            resident_women=si.women_15_44[j] if known else np.nan,
            retained_women=ret, incoming_women=inc, assigned_women=ret + inc,
            outgoing_women=outgoing.get(j, 0.0) if known else np.nan,
            incoming_origin_states=int(n_origins.get(j, 0)), incoming_counties=int(n_counties.get(j, 0)),
            retained_per_clinic=per(ret), incoming_per_clinic=per(inc), assigned_per_clinic=per(ret + inc)))
    r = pd.DataFrame(rows).sort_values("assigned_per_clinic", ascending=False, na_position="last")
    r.to_csv(out_dir / "receiving.csv", index=False, float_format="%.2f")

    # ---- 3. headline numbers, written out so the page can't drift from the data --
    in50 = r[r.in_source_tables == 1]
    ref = in50.assigned_women.sum() / in50.clinics_jul2026.sum()
    ks = r.set_index("abbr").loc["KS"]
    dc = r.set_index("abbr").loc["DC"]
    crossing = cross.women_15_44.sum()
    over = cross[cross.women_15_44 >= OVERVIEW_MIN_WOMEN]
    catchment = dict(
        crossing_women=crossing, crossing_pct=crossing / c.women_15_44.sum() * 100,
        counties_crossing=int((valid.state_abbr != valid.nearest_provider_state).sum()),
        pop_all=c.women_15_44.sum(), pop_valid=valid.women_15_44.sum(),
        excluded_counties=excluded.fips.tolist(), excluded_known_pop=excluded.women_15_44.sum(),
        cross_links=len(cross), overview_min_women=OVERVIEW_MIN_WOMEN, overview_links=len(over),
        overview_share_pct=over.women_15_44.sum() / crossing * 100,
        ref_per_clinic=ref, ref_clinics=in50.clinics_jul2026.sum(), ref_assigned=in50.assigned_women.sum())
    kansas = dict(clinics=ks.clinics_jul2026, clinics_may2022=ks.clinics_may2022, incoming=ks.incoming_women,
                  retained=ks.retained_women, residents=ks.resident_women, assigned=ks.assigned_women,
                  per_clinic=ks.assigned_per_clinic, origin_states=ks.incoming_origin_states,
                  ratio_to_ref=ks.assigned_per_clinic / ref)
    dcinfo = dict(incoming=dc.incoming_women, origins=cross[cross.dest_abbr == "DC"].origin_abbr.tolist())

    print(f"state_flows.csv  {len(f):>4} rows  ({len(cross)} cross-border)")
    print(f"receiving.csv    {len(r):>4} rows  (50 states + DC)")
    print(f"women whose nearest clinic is out of state: {crossing:,.0f} ({catchment['crossing_pct']:.1f}%)")
    print(f"reference, 50 states: {ref:,.0f} assigned women per clinic\n")
    return catchment, kansas, dcinfo


if __name__ == "__main__":
    import subprocess
    import sys
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_data.py")], check=False)
