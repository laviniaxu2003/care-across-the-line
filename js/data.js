/* data loading, parsing and shared chrome.
   Every file comes from data/derived/ or data/geo/ over HTTP (see README). There is no bundled
   fallback: if a file fails to load, the chart that needs it says so instead of showing stale values. */
window.CATL = window.CATL || {};
(function(ns){
"use strict";

/* Explicit parsing: listed columns become numbers; blank -> null (never 0); anything else that
   is not a finite number is an error. Every other column, including fips, stays a string. */
function parser(numeric, file){
  return function(row){
    var o={},k,v,n;
    for(k in row){
      v=row[k];
      if(numeric.indexOf(k)<0){ o[k]=(v===""?null:v); continue; }
      if(v===""||v==null){ o[k]=null; continue; }
      n=+v;
      if(!isFinite(n)) throw new Error(file+": non-numeric value '"+v+"' in "+k);
      o[k]=n;
    }
    return o;
  };
}
var SPECS={
  trend:   {url:"data/derived/trend_by_tier.csv", num:["policy_rank","mean_drive_miles_weighted","n_counties"]},
  burden:  {url:"data/derived/burden_chart.csv", num:["burden","share_pct","women_affected","avg_added_miles","is_other","n_states","highlight"]},
  burdenAll:{url:"data/derived/burden_by_state.csv", num:["rank","burden","share_pct","women_affected","avg_added_miles","counties_increase"]},
  counties:{url:"data/derived/counties_view.csv", num:["metro","rural_urban_code","women_15_44","policy_rank",
    "drive_miles_may2022","drive_miles_jul2026","drive_miles_change","obgyn","obgyn_per_10k_women",
    "ob_hospitals","dist_class","supply_class","inc100_no_obgyn"]},
  rurality:{url:"data/derived/rurality_metro.csv", num:["n_counties","n_no_obgyn","pct_no_obgyn"]},
  flows:   {url:"data/derived/state_flows.csv", num:["counties","women_15_44","out_of_state"]},
  recv:    {url:"data/derived/receiving.csv", num:["in_source_tables","clinics_may2022","clinics_jul2026",
    "resident_women","retained_women","incoming_women","assigned_women","outgoing_women",
    "incoming_origin_states","incoming_counties","retained_per_clinic","incoming_per_clinic","assigned_per_clinic"]}
};
var MONTHLY_URL="data/derived/county_monthly.csv";
/* wide table: fips, then one column per month (miles, one decimal; blank -> null) */
function parseMonthly(txt){
  var rows=d3.csvParseRows(txt), months=rows[0].slice(1), by={};
  for(var i=1;i<rows.length;i++){
    by[rows[i][0]]=rows[i].slice(1).map(function(v){
      if(v==="") return null;
      var n=+v; if(!isFinite(n)) throw new Error(MONTHLY_URL+": non-numeric value '"+v+"'");
      return n; });
  }
  return {months:months, byFips:by};
}
var cache={};
/* ns.get("name") -> promise of parsed rows; JSON/TopoJSON by path */
ns.get=function(name){
  if(cache[name]) return cache[name];
  var p;
  if(name==="monthly") p=d3.text(MONTHLY_URL).then(parseMonthly);
  else if(SPECS[name]) p=d3.csv(SPECS[name].url, parser(SPECS[name].num, SPECS[name].url));
  else if(name==="head") p=d3.json("data/derived/headline.json");
  else if(name==="states") p=d3.json("data/geo/states-10m.json");
  else if(name==="counties-geo") p=d3.json("data/geo/counties-albers-10m.json");
  else p=Promise.reject(new Error("unknown dataset "+name));
  cache[name]=p.then(function(d){ if(!d||(Array.isArray(d)&&!d.length)) throw new Error(name+" is empty"); return d; });
  return cache[name];
};

/* figure status: "Loading…" until rendered; a visible error if loading or drawing fails */
ns.status=function(sel,msg,isErr){
  var el=document.querySelector(sel); if(!el) return;
  el.hidden=!msg; el.textContent=msg||""; el.classList.toggle("err",!!isErr);
};
ns.run=function(statusSel,names,draw){
  ns.status(statusSel,"Loading data…");
  return Promise.all(names.map(ns.get)).then(function(a){
    draw.apply(null,a); ns.status(statusSel,"");
  }).catch(function(e){
    console.error(e);
    ns.status(statusSel,"This chart could not load its data ("+e.message+"). Serve the site over HTTP from the repository root; see README.",true);
    ns.dataProblem();
  });
};
ns.dataProblem=function(){
  var b=document.getElementById("data-status"); if(b) b.hidden=false;
};

/* tiny event bus for linked views */
var subs={};
ns.on=function(ev,fn){ (subs[ev]=subs[ev]||[]).push(fn); };
ns.emit=function(ev,v){ (subs[ev]||[]).forEach(function(fn){ fn(v); }); };

/* "your county": one shared selection (a fips string or null). Set only through ns.selectCounty;
   charts subscribe with ns.onCounty and keep no copy of their own. */
ns.county=null;
var cSubs=[], cIdx=null;
function countyIndex(){
  return ns.get("counties").then(function(rows){
    if(!cIdx){ cIdx={}; rows.forEach(function(d){ cIdx[d.fips]=d; d.label=d.county+", "+d.state_abbr; }); }
    return cIdx;
  });
}
ns.countyReady=countyIndex;
ns.countyRow=function(fips){ return cIdx&&fips?cIdx[fips]||null:null; };
/* "Hinds, MS" exactly, or a prefix of that form; null when nothing matches */
ns.matchCounty=function(q){
  q=String(q).trim().toLowerCase(); if(!q||!cIdx) return null;
  var k, first=null;
  for(k in cIdx){ var l=cIdx[k].label.toLowerCase(); if(l===q) return cIdx[k]; if(!first&&l.indexOf(q)===0) first=cIdx[k]; }
  return first;
};
function notifyCounty(){ cSubs.forEach(function(fn){ fn(ns.county); }); }
ns.selectCounty=function(fips){
  fips=fips||null;
  function apply(){
    if(fips&&!cIdx[fips]) fips=null;
    ns.county=fips;
    try{
      var u=new URL(location.href);
      if(fips) u.searchParams.set("county",fips); else u.searchParams.delete("county");
      history.replaceState(null,"",u.toString());
    }catch(e){}
    if(fips) ns.get("monthly").catch(function(){});   // fetched the first time a county is chosen
    notifyCounty();
  }
  if(cIdx) apply(); else countyIndex().then(apply).catch(function(e){ console.error(e); });
};
/* a chart that subscribes after a county is already chosen is told straight away */
ns.onCounty=function(fn){ cSubs.push(fn); if(ns.county) fn(ns.county); };

/* shared chrome */
var tip;
ns.tip=function(e,html){
  tip=tip||document.getElementById("tip"); if(!tip) return;
  tip.innerHTML=html; tip.style.opacity=1;
  var x=(e.clientX!=null?e.clientX:0)+14,y=(e.clientY!=null?e.clientY:0)+14;
  if(x>innerWidth-290) x=Math.max(8,x-304);
  if(y>innerHeight-160) y=Math.max(8,y-170);
  tip.style.left=x+"px"; tip.style.top=y+"px";
};
ns.hideTip=function(){ tip=tip||document.getElementById("tip"); if(tip) tip.style.opacity=0; };
ns.fmt=d3.format(",");
ns.f1=d3.format(",.1f");
ns.M=function(n){ return n==null?"n/a":n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?Math.round(n/1000)+"k":ns.fmt(Math.round(n)); };
ns.na=function(v,f){ return v==null||isNaN(v)?"not available":(f||ns.fmt)(v); };
ns.mo=d3.timeFormat("%b %Y");
ns.parseYM=d3.timeParse("%Y-%m");
ns.fail=function(sel,msg){
  var el=document.querySelector(sel); if(!el) return;
  var d=document.createElement("div"); d.className="err";
  d.textContent="This chart could not load: "+msg; el.replaceWith(d);
};
/* width of an svg's container, for charts that re-layout on resize */
ns.width=function(el){ return Math.max(280, Math.round(el.getBoundingClientRect().width)); };
ns.onResize=function(fn){ var t; addEventListener("resize",function(){ clearTimeout(t); t=setTimeout(fn,150); }); };
})(window.CATL);
