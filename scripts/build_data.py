"""
Build every table the website loads from the supplied processed inputs.

    python3 scripts/build_data.py          (from anywhere; paths resolve from the repo root)

Inputs   data/source/   supplied processed tables (never modified)
         data/geo/      state and county TopoJSON (only ids are read here)
Outputs  data/derived/  chart tables + headline.json
Then runs scripts/validate.py, which fails loudly if any check does not hold.

Conventions
- FIPS codes stay 5-character strings. Blank numeric cells become NaN (never 0).
- A county enters a calculation only if every field that calculation needs is present;
  the excluded counties and their known populations are reported in headline.json.
- Distance means are weighted by women 15-44; county shares are counts of eligible counties.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_flows  # noqa: E402  (teammate's flow builder, revised)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source"
GEO = ROOT / "data" / "geo"
OUT = ROOT / "data" / "derived"

COUNTY_NUM = ["lon", "lat", "rural_urban_code", "metro", "women_15_44", "births_annual",
              "policy_rank", "drive_miles_may2022", "drive_miles_jul2026", "drive_miles_change",
              "crossed_state_line", "obgyn", "obgyn_per_10k_women", "no_obgyn", "ob_hospitals",
              "no_ob_hospital", "hit_twice"]
STATE_NUM = ["policy_rank", "counties", "women_15_44", "facilities_may2022", "facilities_jul2026"]
TREND_NUM = ["policy_rank", "post_dobbs", "median_drive_miles", "mean_drive_miles_weighted",
             "pct_counties_over_100mi", "n_counties"]

BURDEN_TOP_N = 7          # individual states shown before "Other states"


def fail(msg):
    sys.exit(f"BUILD FAILED: {msg}")


def read_strict(path, numeric, key=None):
    """Read every column as text, then convert the named numeric columns explicitly.
    Blank -> NaN; any other non-numeric text is an error, not a silent NaN."""
    if not path.exists():
        fail(f"missing input {path.relative_to(ROOT)}")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    for col in numeric:
        if col not in df.columns:
            fail(f"{path.name}: expected column '{col}' not found")
        raw = df[col].str.strip()
        vals = pd.to_numeric(raw.replace("", np.nan), errors="coerce")
        bad = raw[(raw != "") & vals.isna()]
        if len(bad):
            fail(f"{path.name}: non-numeric values in '{col}': {bad.unique()[:5].tolist()}")
        df[col] = vals
    for col in df.columns:
        if col not in numeric:
            df[col] = df[col].replace("", np.nan)
    if key and df[key].duplicated().any():
        fail(f"{path.name}: duplicate {key}")
    return df


def r(x, nd=1):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), nd)


def millions(n):
    return f"{n / 1e6:.1f} million"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    c = read_strict(SRC / "counties.csv", COUNTY_NUM, key="fips")
    s = read_strict(SRC / "states.csv", STATE_NUM, key="state_abbr")
    t = read_strict(SRC / "access_trend_by_tier.csv", TREND_NUM)
    if not c.fips.str.fullmatch(r"\d{5}").all():
        fail("counties.csv: FIPS not all 5-digit strings")
    names = dict(zip(s.state_abbr, s.state))
    names["DC"] = "District of Columbia"

    # ------------------------------------------------------------------ A. trend
    trend = t[["policy_rank", "policy_tier", "ym", "mean_drive_miles_weighted", "n_counties"]]
    trend = trend.sort_values(["policy_rank", "ym"])
    trend.to_csv(OUT / "trend_by_tier.csv", index=False)
    tv = trend.set_index(["policy_rank", "ym"]).mean_drive_miles_weighted

    # ------------------------------------------------------------------ B. burden
    # population x additional nearest-clinic miles, May 2022 -> Jul 2026; reductions count as 0
    bc = c.dropna(subset=["drive_miles_change", "women_15_44"]).copy()
    bc["burden"] = bc.women_15_44 * bc.drive_miles_change.clip(lower=0)
    bs = (bc.groupby("state_abbr", as_index=False)
            .agg(burden=("burden", "sum"), counties_increase=("drive_miles_change", lambda x: int((x > 0).sum()))))
    bs["state"] = bs.state_abbr.map(names)
    total_burden = bs.burden.sum()
    bs["share_pct"] = bs.burden / total_burden * 100
    bs = bs.sort_values("burden", ascending=False).reset_index(drop=True)
    bs["rank"] = np.arange(1, len(bs) + 1)
    bs[["rank", "state_abbr", "state", "burden", "share_pct", "counties_increase"]].to_csv(
        OUT / "burden_by_state.csv", index=False, float_format="%.6f")
    top = bs.head(BURDEN_TOP_N)
    rest = bs.iloc[BURDEN_TOP_N:]
    chart = pd.concat([
        top.assign(label=top.state, is_other=0, n_states=1),
        pd.DataFrame([dict(state_abbr="OTHER", state="Other states", label=f"Other {int((rest.burden > 0).sum())} states",
                           burden=rest.burden.sum(), share_pct=rest.share_pct.sum(), is_other=1,
                           n_states=int((rest.burden > 0).sum()))])])
    chart["highlight"] = chart.state_abbr.isin(["TX", "LA", "TN"]).astype(int)
    chart[["state_abbr", "label", "burden", "share_pct", "is_other", "n_states", "highlight"]].to_csv(
        OUT / "burden_chart.csv", index=False, float_format="%.6f")
    top3 = bs[bs.state_abbr.isin(["TX", "LA", "TN"])].share_pct.sum()
    signed = (bc.women_15_44 * bc.drive_miles_change)
    top3_signed = signed[bc.state_abbr.isin(["TX", "LA", "TN"])].sum() / signed.sum() * 100

    # ------------------------------------------------------------------ C. county view
    cv = c[["fips", "county", "state", "state_abbr", "metro", "rural_urban_code", "women_15_44",
            "policy_rank", "drive_miles_may2022", "drive_miles_jul2026", "drive_miles_change",
            "nearest_provider_state", "obgyn", "obgyn_per_10k_women", "ob_hospitals"]].copy()
    ch, rate = cv.drive_miles_change, cv.obgyn_per_10k_women
    cv["dist_class"] = np.select([ch <= 0, (ch > 0) & (ch < 100), ch >= 100], [1, 2, 3], default=0)
    cv["supply_class"] = np.select([rate == 0, (rate > 0) & (rate <= 2.5), rate > 2.5], [1, 2, 3], default=0)
    cv.loc[ch.isna(), "dist_class"] = 0
    cv.loc[rate.isna(), "supply_class"] = 0
    # derived flag for the 316-of-589 claim (NOT hit_twice, which uses current distance)
    cv["inc100_no_obgyn"] = ((ch >= 100) & (cv.obgyn == 0)).astype(int)
    cv.to_csv(OUT / "counties_view.csv", index=False)

    inc = c[c.drive_miles_change >= 100]
    inc0 = inc[inc.obgyn == 0]
    inc00 = inc0[inc0.ob_hospitals == 0]
    scatter_ok = cv.drive_miles_change.notna() & cv.obgyn_per_10k_women.notna()

    # ------------------------------------------------------------------ C2. rurality
    rows = []
    for grp, ranks in [("Ranks 1-2 (most restrictive)", [1, 2]), ("Ranks 6-7 (most protective)", [6, 7])]:
        for mlabel, mval in [("Metro", 1), ("Nonmetro", 0)]:
            x = c[c.policy_rank.isin(ranks) & c.obgyn.notna() & (c.metro == mval)]
            rows.append(dict(policy_group=grp, county_type=mlabel, n_counties=len(x),
                             n_no_obgyn=int((x.obgyn == 0).sum()), pct_no_obgyn=(x.obgyn == 0).mean() * 100))
    rur = pd.DataFrame(rows)
    rur.to_csv(OUT / "rurality_metro.csv", index=False, float_format="%.4f")

    def short(ranks):
        x = c[c.policy_rank.isin(ranks) & c.obgyn.notna()]
        return x, (x.obgyn == 0).mean() * 100
    x12, p12 = short([1, 2])
    x67, p67 = short([6, 7])
    unknown_metro_12 = int(x12.metro.isna().sum())
    unknown_metro_67 = int(x67.metro.isna().sum())
    # direct standardization to the ranks 6-7 metro/nonmetro mix
    w_metro = (x67.metro == 1).mean()
    rr = rur.set_index(["policy_group", "county_type"]).pct_no_obgyn
    std12 = w_metro * rr[("Ranks 1-2 (most restrictive)", "Metro")] + (1 - w_metro) * rr[("Ranks 1-2 (most restrictive)", "Nonmetro")]
    std67 = w_metro * rr[("Ranks 6-7 (most protective)", "Metro")] + (1 - w_metro) * rr[("Ranks 6-7 (most protective)", "Nonmetro")]

    # ------------------------------------------------------------------ D/E. catchments
    # flows, receiving-jurisdiction catchments and their headline numbers (scripts/build_flows.py)
    catchment, kansas, dcinfo = build_flows.build(c, s, names, OUT)

    # ------------------------------------------------------------------ geometry join (ids only)
    topo = json.loads((GEO / "counties-albers-10m.json").read_text())
    geo_ids = {str(g["id"]) for g in topo["objects"]["counties"]["geometries"]}
    plotted = cv[scatter_ok]
    no_shape = plotted[~plotted.fips.isin(geo_ids)]
    shape_no_row = sorted(geo_ids - set(cv.fips))

    H = dict(
        sources=dict(counties="data/source/counties.csv", states="data/source/states.csv",
                     trend="data/source/access_trend_by_tier.csv"),
        trend=dict(r1_may2022=tv[(1, "2022-05")], r1_jun2022=tv[(1, "2022-06")], r1_jul2022=tv[(1, "2022-07")],
                   r1_jan2023=tv[(1, "2023-01")], r1_jul2026=tv[(1, "2026-07")],
                   r7_may2022=tv[(7, "2022-05")], r7_jan2023=tv[(7, "2023-01")], r7_jul2026=tv[(7, "2026-07")],
                   first_month=trend.ym.min(), last_month=trend.ym.max()),
        burden=dict(top3_share_pct=top3, top3_share_signed_pct=top3_signed,
                    tx=bs.set_index("state_abbr").share_pct["TX"], la=bs.set_index("state_abbr").share_pct["LA"],
                    tn=bs.set_index("state_abbr").share_pct["TN"], counties_used=len(bc),
                    states_positive=int((bs.burden > 0).sum()), top_n=BURDEN_TOP_N),
        overlap=dict(inc100=len(inc), inc100_no_obgyn=len(inc0), inc100_no_obgyn_no_hosp=len(inc00),
                     inc100_no_obgyn_nonmetro=int((inc0.metro == 0).sum()),
                     inc100_none_both_nonmetro=int((inc00.metro == 0).sum()),
                     hit_twice_column=int(c.hit_twice.sum()),
                     scatter_eligible=int(scatter_ok.sum()),
                     scatter_excluded=c.loc[~scatter_ok, "fips"].tolist(),
                     map_shapes_missing_for_plotted=no_shape.fips.tolist(),
                     shapes_without_row=shape_no_row),
        shortage=dict(r12_pct=p12, r12_n=len(x12), r12_none=int((x12.obgyn == 0).sum()),
                      r67_pct=p67, r67_n=len(x67), r67_none=int((x67.obgyn == 0).sum()),
                      r1_only_pct=short([1])[1], unknown_metro_r12=unknown_metro_12, unknown_metro_r67=unknown_metro_67,
                      std_weight_metro=w_metro, std_r12_pct=std12, std_r67_pct=std67,
                      std_gap_share_pct=(std12 - std67) / (p12 - p67) * 100),
        catchment=catchment, kansas=kansas, dc=dcinfo,
        clinics=dict(may2022=s.facilities_may2022.sum(), jul2026=s.facilities_jul2026.sum(),
                     states_to_zero=int(((s.facilities_may2022 > 0) & (s.facilities_jul2026 == 0)).sum()),
                     states_zero_jul2026=int((s.facilities_jul2026 == 0).sum())),
    )
    # strings exactly as they appear in the page (validate.py checks the HTML against these)
    T, B, O, S, C, K = H["trend"], H["burden"], H["overlap"], H["shortage"], H["catchment"], H["kansas"]
    H["display"] = {
        "r1_may2022": f"{T['r1_may2022']:.1f}", "r1_jul2022": f"{T['r1_jul2022']:.1f}",
        "r1_jan2023": f"{T['r1_jan2023']:.1f}", "r1_jul2026": f"{T['r1_jul2026']:.1f}",
        "r7_may2022": f"{T['r7_may2022']:.1f}", "r7_jan2023": f"{T['r7_jan2023']:.1f}",
        "r7_jul2026": f"{T['r7_jul2026']:.1f}",
        "burden_top3": f"{B['top3_share_pct']:.1f}%", "burden_tx": f"{B['tx']:.1f}%",
        "burden_la": f"{B['la']:.1f}%", "burden_tn": f"{B['tn']:.1f}%",
        "inc100": f"{O['inc100']:,}", "inc100_no_obgyn": f"{O['inc100_no_obgyn']:,}",
        "inc100_no_obgyn_no_hosp": f"{O['inc100_no_obgyn_no_hosp']:,}",
        "inc100_no_obgyn_nonmetro": f"{O['inc100_no_obgyn_nonmetro']:,}",
        "scatter_eligible": f"{O['scatter_eligible']:,}",
        "short_r12": f"{S['r12_pct']:.1f}%", "short_r67": f"{S['r67_pct']:.1f}%",
        "short_r12_metro": f"{rr[('Ranks 1-2 (most restrictive)', 'Metro')]:.1f}%",
        "short_r67_metro": f"{rr[('Ranks 6-7 (most protective)', 'Metro')]:.1f}%",
        "short_r12_nonmetro": f"{rr[('Ranks 1-2 (most restrictive)', 'Nonmetro')]:.1f}%",
        "short_r67_nonmetro": f"{rr[('Ranks 6-7 (most protective)', 'Nonmetro')]:.1f}%",
        "crossing_women": millions(C["crossing_women"]), "crossing_women_exact": f"{C['crossing_women']:,.0f}",
        "crossing_pct": f"{C['crossing_pct']:.1f}%",
        "ks_clinics": f"{K['clinics']:.0f}", "ks_incoming": millions(K["incoming"]),
        "ks_incoming_exact": f"{K['incoming']:,.0f}", "ks_retained": f"{K['retained']:,.0f}",
        "ks_residents": f"{K['residents']:,.0f}", "ks_assigned": f"{K['assigned']:,.0f}",
        "ks_per_clinic": f"{K['per_clinic']:,.0f}", "ks_origin_states": f"{K['origin_states']}",
        "ref_per_clinic": f"{C['ref_per_clinic']:,.0f}",
        "dc_incoming": f"{H['dc']['incoming']:,.0f}",
        "clinics_may2022": f"{H['clinics']['may2022']:.0f}", "clinics_jul2026": f"{H['clinics']['jul2026']:.0f}",
        "states_to_zero": f"{H['clinics']['states_to_zero']}",
        "overview_links": f"{C['overview_links']}", "overview_share": f"{C['overview_share_pct']:.1f}%",
        "cross_links": f"{C['cross_links']}",
        "std_r12": f"{S['std_r12_pct']:.1f}%", "std_r67": f"{S['std_r67_pct']:.1f}%",
        "std_gap_share": f"{S['std_gap_share_pct']:.1f}%", "std_weight_metro": f"{S['std_weight_metro'] * 100:.1f}%",
        "short_r1_only": f"{S['r1_only_pct']:.1f}%", "short_r12_n": f"{S['r12_n']:,}", "short_r67_n": f"{S['r67_n']:,}",
        "pop_all": f"{C['pop_all']:,.0f}", "pop_valid": f"{C['pop_valid']:,.0f}",
        "excluded_known_pop": f"{C['excluded_known_pop']:,.0f}", "counties_crossing": f"{C['counties_crossing']:,}",
        "burden_top3_signed": f"{B['top3_share_signed_pct']:.1f}%",
        "inc100_none_both_nonmetro": f"{O['inc100_none_both_nonmetro']:,}",
        "ks_ratio": f"{K['ratio_to_ref']:.1f}",
    }

    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [clean(v) for v in o]
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (float, np.floating)):
            return None if np.isnan(o) else round(float(o), 4)
        return o
    (OUT / "headline.json").write_text(json.dumps(clean(H), indent=1))

    print("Wrote data/derived/: trend_by_tier.csv burden_by_state.csv burden_chart.csv counties_view.csv")
    print("                     rurality_metro.csv state_flows.csv receiving.csv headline.json")
    for k, v in H["display"].items():
        print(f"  {k:28s} {v}")
    res = subprocess.run([sys.executable, str(ROOT / "scripts" / "validate.py")])
    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
