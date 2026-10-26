"""
Pipeline step added for Prototype V1.
counties.csv tells us, for every county, which state holds its nearest open abortion
clinic. Rolling that up by (origin state -> destination state) turns 3,143 rows into the
cross-border flow table the main message needs, plus the per-clinic load on the states
that absorb the demand.
Run:  python build_flows.py      (from site/)
"""
import pandas as pd, numpy as np, json

c = pd.read_csv("../data/counties.csv", dtype={"fips": str})
s = pd.read_csv("../data/states.csv")

# ---- 1. origin state -> destination state flows -----------------------------
f = (c.groupby(["state", "state_abbr", "policy_tier", "policy_rank",
                "nearest_provider_state"], as_index=False)
       .agg(counties=("fips", "count"),
            women_15_44=("women_15_44", "sum"),
            births_annual=("births_annual", "sum"),
            median_drive_miles=("drive_miles_jul2026", "median")))
f.columns = ["origin_state","origin_abbr","origin_policy_tier","origin_policy_rank",
             "dest_abbr","counties","women_15_44","births_annual","median_drive_miles"]
f["out_of_state"] = (f.origin_abbr != f.dest_abbr).astype(int)
f = f.sort_values(["origin_abbr","women_15_44"], ascending=[True, False])
f.to_csv("data/state_flows.csv", index=False)

# ---- 2. load on the receiving states ----------------------------------------
imp = (f[f.out_of_state == 1].groupby("dest_abbr")
        .agg(imported_women=("women_15_44","sum"),
             imported_births=("births_annual","sum"),
             counties_served=("counties","sum"),
             origin_states=("origin_abbr","nunique")).reset_index())
own = s[["state","state_abbr","policy_tier","policy_rank","women_15_44",
         "facilities_jul2026","facilities_may2022"]].rename(
         columns={"women_15_44":"own_women","facilities_jul2026":"clinics",
                  "facilities_may2022":"clinics_may2022"})
r = own.merge(imp, left_on="state_abbr", right_on="dest_abbr", how="left").fillna(
        {"imported_women":0,"imported_births":0,"counties_served":0,"origin_states":0})
r["total_women_served"] = r.own_women + r.imported_women
NATIONAL = c.women_15_44.sum() / s.clinics.sum() if False else c.women_15_44.sum()/s.facilities_jul2026.sum()
r["women_per_clinic_own"]   = np.where(r.clinics>0, r.own_women/r.clinics, np.nan).round(0)
r["women_per_clinic_total"] = np.where(r.clinics>0, r.total_women_served/r.clinics, np.nan).round(0)
r["load_vs_national"]       = (r.women_per_clinic_total/NATIONAL).round(2)
r["imported_pct_of_own"]    = (r.imported_women/r.own_women*100).round(0)
r = r.drop(columns=["dest_abbr"]).sort_values("imported_women", ascending=False)
r.to_csv("data/receiving_states.csv", index=False)

# ---- 3. headline numbers, written out so the page can't drift from the data --
out  = c[c.crossed_state_line == 1]
tot  = c.women_15_44.sum()
top  = r.nlargest(1, "imported_women").iloc[0]
head = dict(
    national_women_per_clinic = round(float(NATIONAL)),
    women_crossing            = int(out.women_15_44.sum()),
    women_crossing_pct        = round(float(out.women_15_44.sum()/tot*100), 1),
    counties_crossing         = int(len(out)),
    us_women_15_44            = int(tot),
    clinics_now               = int(s.facilities_jul2026.sum()),
    clinics_may2022           = int(s.facilities_may2022.sum()),
    top_receiver              = dict(state=top.state, abbr=top.state_abbr,
                                     clinics=int(top.clinics),
                                     imported=int(top.imported_women),
                                     per_clinic=int(top.women_per_clinic_total),
                                     load=float(top.load_vs_national),
                                     origin_states=int(top.origin_states)),
    states_to_zero            = int(((s.facilities_may2022>0)&(s.facilities_jul2026==0)).sum()))
json.dump(head, open("data/headline.json","w"), indent=1)

print(f"state_flows.csv      {len(f):>4} rows  ({f.out_of_state.sum()} cross-border)")
print(f"receiving_states.csv {len(r):>4} rows")
print(f"\nnational average women 15-44 per open clinic: {NATIONAL:,.0f}")
print(f"women whose nearest clinic is out of state : {head['women_crossing']:,} "
      f"({head['women_crossing_pct']}%)\n")
print(r.head(8)[["state_abbr","clinics","own_women","imported_women","origin_states",
                 "women_per_clinic_total","load_vs_national"]].to_string(index=False))
