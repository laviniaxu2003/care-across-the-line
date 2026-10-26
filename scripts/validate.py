"""
Validate the supplied inputs, the derived tables and the numbers printed in the HTML.

    python3 scripts/validate.py     (also run automatically at the end of build_data.py)

Every check prints PASS/FAIL; any FAIL exits with status 1.
"""
import json
import re
import sys
from html import unescape
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "data" / "source", ROOT / "data" / "derived"
failures = []


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(name)


def num(df, cols):
    for col in cols:
        df[col] = pd.to_numeric(df[col], errors="raise")
    return df


c = pd.read_csv(SRC / "counties.csv", dtype={"fips": str})
s = pd.read_csv(SRC / "states.csv")
t = pd.read_csv(SRC / "access_trend_by_tier.csv")
cv = pd.read_csv(OUT / "counties_view.csv", dtype={"fips": str})
fl = pd.read_csv(OUT / "state_flows.csv")
rc = pd.read_csv(OUT / "receiving.csv")
bs = pd.read_csv(OUT / "burden_by_state.csv")
bch = pd.read_csv(OUT / "burden_chart.csv")
ru = pd.read_csv(OUT / "rurality_metro.csv")
tr = pd.read_csv(OUT / "trend_by_tier.csv")
H = json.loads((OUT / "headline.json").read_text())

print("— keys and formats")
check("counties: 3,143 rows, unique FIPS", len(c) == 3143 and c.fips.is_unique, f"{len(c)} rows")
check("counties: FIPS are 5-digit strings", c.fips.str.fullmatch(r"\d{5}").all())
check("counties_view: FIPS preserved as 5-digit strings", cv.fips.str.fullmatch(r"\d{5}").all() and set(cv.fips) == set(c.fips))
check("states: 50 unique state_abbr", len(s) == 50 and s.state_abbr.is_unique)
check("trend: unique (policy_rank, ym)", not t.duplicated(["policy_rank", "ym"]).any())
check("state_flows: unique (origin, dest)", not fl.duplicated(["origin_abbr", "dest_abbr"]).any())
check("receiving: unique jurisdiction", rc.abbr.is_unique, f"{len(rc)} jurisdictions")

print("— dates")
months = pd.period_range("2019-01", "2026-07", freq="M").strftime("%Y-%m").tolist()
check("trend: every tier has Jan 2019–Jul 2026 monthly, no gaps",
      all(sorted(g.ym) == months for _, g in t.groupby("policy_rank")) and t.policy_rank.nunique() == 7)
m = pd.read_csv(SRC / "county_distance_monthly.csv", dtype={"fips": str}, usecols=["fips", "ym", "drive_miles"])
check("monthly panel: Jan 2019–Jul 2026", m.ym.min() == "2019-01" and m.ym.max() == "2026-07")
mm = m[m.ym.isin(["2022-05", "2026-07"])].pivot(index="fips", columns="ym", values="drive_miles")
j = c.set_index("fips").join(mm, how="inner")
check("monthly panel May 2022 / Jul 2026 equal counties.csv",
      np.allclose(j["2022-05"], j.drive_miles_may2022, equal_nan=True) and np.allclose(j["2026-07"], j.drive_miles_jul2026, equal_nan=True),
      f"{len(j)} counties compared")

print("— missingness (missing is never zero)")
miss_dist = sorted(c[c.drive_miles_change.isna()].fips)
miss_pop = sorted(c[c.women_15_44.isna()].fips)
check("distance missing only for 02063, 02066", miss_dist == ["02063", "02066"], str(miss_dist))
check("their known population sums to 1,735", c[c.fips.isin(miss_dist)].women_15_44.sum() == 1735)
check("population/OB-GYN missing only for 02261", miss_pop == ["02261"] and sorted(c[c.obgyn.isna()].fips) == ["02261"])
check("metro unknown for 9 rows (CT legacy + 02261), kept distinct from nonmetro",
      c.metro.isna().sum() == 9 and cv.metro.isna().sum() == 9)
check("real zero OB-GYN counts preserved (1,457 zeros, 1 null)", (c.obgyn == 0).sum() == 1457 and c.obgyn.isna().sum() == 1)
check("obgyn == 0 exactly when rate == 0", ((c.obgyn == 0) == (c.obgyn_per_10k_women == 0)).all())

print("— legal ranges and arithmetic")
check("distances >= 0", (c[["drive_miles_may2022", "drive_miles_jul2026"]].dropna() >= 0).all().all())
d = c.dropna(subset=["drive_miles_change"])
err = (d.drive_miles_jul2026 - d.drive_miles_may2022 - d.drive_miles_change).abs().max()
check("drive_miles_change = jul2026 − may2022 (rounding tolerance 0.15)", err <= 0.15, f"max |diff| {err:.3f}")
check("obgyn, ob_hospitals non-negative integers",
      all((c[k].dropna() >= 0).all() and (c[k].dropna() % 1 == 0).all() for k in ["obgyn", "ob_hospitals"]))
check("women_15_44 > 0 where present", (c.women_15_44.dropna() > 0).all())
check("policy_rank in 1..7", c.policy_rank.between(1, 7).all() and t.policy_rank.between(1, 7).all())
check("clinic counts non-negative", (s[["facilities_may2022", "facilities_jul2026"]] >= 0).all().all())
check("trend means are finite and >= 0", np.isfinite(t.mean_drive_miles_weighted).all() and (t.mean_drive_miles_weighted >= 0).all())

print("— catchment reconciliation")
valid = c.dropna(subset=["nearest_provider_state", "women_15_44"])
check("excluded from catchments: 02063, 02066 (no destination), 02261 (no population)",
      sorted(set(c.fips) - set(valid.fips)) == ["02063", "02066", "02261"])
check("every valid origin population appears in exactly one destination",
      np.isclose(rc.assigned_women.sum(), valid.women_15_44.sum()) and np.isclose(fl.women_15_44.sum(), valid.women_15_44.sum()),
      f"{rc.assigned_women.sum():,.0f} = {valid.women_15_44.sum():,.0f}")
check("incoming total = outgoing total = cross-state total",
      np.isclose(rc.incoming_women.sum(), rc.outgoing_women.sum()) and np.isclose(rc.incoming_women.sum(), H["catchment"]["crossing_women"]))
own = valid.groupby("state_abbr").women_15_44.sum()
r50 = rc[rc.in_source_tables == 1].set_index("abbr")
check("each state: retained + outgoing = its valid residents",
      np.allclose((r50.retained_women + r50.outgoing_women).reindex(own.index), own))
check("DC kept as a destination: VA → DC 63,923",
      "DC" in set(rc.abbr) and ((fl.origin_abbr == "VA") & (fl.dest_abbr == "DC") & (fl.women_15_44 == 63923)).any())
dcr = rc.set_index("abbr").loc["DC"]
check("DC clinic count and per-clinic values left unavailable", pd.isna(dcr.clinics_jul2026) and pd.isna(dcr.assigned_per_clinic))
check("per-clinic values: no inf; NaN wherever clinics are 0 or unknown",
      np.isfinite(rc.assigned_per_clinic.dropna()).all()
      and rc[(rc.clinics_jul2026.fillna(0) == 0)].assigned_per_clinic.isna().all())
check("states without clinics have no assigned population",
      (rc[rc.clinics_jul2026 == 0].assigned_women == 0).all())
ks = rc.set_index("abbr").loc["KS"]
check("Kansas: 7 clinics, 545,960 retained + 6,128,642 incoming = 6,674,602",
      ks.clinics_jul2026 == 7 and ks.retained_women == 545960 and ks.incoming_women == 6128642 and ks.assigned_women == 6674602)

print("— chart summaries")
check("burden shares sum to 100% (all states)", np.isclose(bs.share_pct.sum(), 100))
check("burden chart shares sum to 100% (top states + Other)", np.isclose(bch.share_pct.sum(), 100))
check("'Other states' is last and flagged", bch.iloc[-1].is_other == 1 and bch.is_other.sum() == 1)
b = c.dropna(subset=["drive_miles_change", "women_15_44"])
bb = (b.women_15_44 * b.drive_miles_change.clip(lower=0)).groupby(b.state_abbr).sum()
check("TX+LA+TN share recomputed = 83.4%", round(bb[["TX", "LA", "TN"]].sum() / bb.sum() * 100, 1) == round(H["burden"]["top3_share_pct"], 1) == 83.4)
inc = c[c.drive_miles_change >= 100]
check("589 / 316 / 297 recomputed", (len(inc), (inc.obgyn == 0).sum(), ((inc.obgyn == 0) & (inc.ob_hospitals == 0)).sum()) == (589, 316, 297))
check("derived inc100_no_obgyn flag (not hit_twice) sums to 316", cv.inc100_no_obgyn.sum() == 316 and c.hit_twice.sum() == 836)
el = cv.dropna(subset=["drive_miles_change", "obgyn_per_10k_women"])
check("scatter-eligible counties all have both bivariate classes", len(el) == 3140 and (el.dist_class > 0).all() and (el.supply_class > 0).all())
check("bivariate (≥100 mi, 0 OB-GYN) cell = 316", ((el.dist_class == 3) & (el.supply_class == 1)).sum() == 316)
for _, row in ru.iterrows():
    ranks = [1, 2] if row.policy_group.startswith("Ranks 1-2") else [6, 7]
    x = c[c.policy_rank.isin(ranks) & c.obgyn.notna() & (c.metro == (1 if row.county_type == "Metro" else 0))]
    check(f"rurality {row.policy_group[:9]} {row.county_type}: {row.n_no_obgyn}/{row.n_counties}",
          len(x) == row.n_counties and (x.obgyn == 0).sum() == row.n_no_obgyn)
check("trend table equals source", tr.set_index(["policy_rank", "ym"]).mean_drive_miles_weighted.equals(
      t.set_index(["policy_rank", "ym"]).mean_drive_miles_weighted))
check("trend headline values 37.5 / 215.6 / 9.7 / 8.9",
      (H["trend"]["r1_may2022"], H["trend"]["r1_jan2023"], H["trend"]["r7_may2022"], H["trend"]["r7_jan2023"]) == (37.5, 215.6, 9.7, 8.9))

print("— numbers written in the HTML")
disp = H["display"]
for page in ["index.html", "methods.html"]:
    html = (ROOT / page).read_text()
    spans = re.findall(r'data-h="([a-z0-9_]+)"[^>]*>([^<]*)<', html)
    bad = [(k, unescape(v), disp.get(k)) for k, v in spans if disp.get(k) != unescape(v)]
    check(f"{page}: {len(spans)} data-h numbers match headline.json", not bad, str(bad[:5]))
    if page == "index.html":   # methods.html quotes retired figures only to explain why they were retired
        stale = [p for p in ["81,655", "11.7×", "64 to 89", "64–89", "never built", "have not moved", "nothing is estimated"] if p in html]
        check(f"{page}: no retired claims", not stale, str(stale))

print()
if failures:
    print(f"{len(failures)} check(s) FAILED")
    sys.exit(1)
print("All checks passed.")
