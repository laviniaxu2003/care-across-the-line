/* data loading: real files first, bundled copy as the offline fallback */
window.CATL = window.CATL || {};
(function(ns){
"use strict";
var NUM=["origin_policy_rank","counties","women_15_44","births_annual","median_drive_miles",
  "out_of_state","policy_rank","own_women","clinics","clinics_may2022","imported_women",
  "imported_births","counties_served","origin_states","total_women_served",
  "women_per_clinic_own","women_per_clinic_total","load_vs_national","imported_pct_of_own"];
function coerce(r){ var o={},k; for(k in r){ o[k]=NUM.indexOf(k)>=0?(r[k]===""||r[k]==null?null:+r[k]):r[k]; } return o; }

ns.load=function(){
  return Promise.all([
    d3.csv("data/state_flows.csv"), d3.csv("data/receiving_states.csv"),
    d3.json("data/headline.json"), d3.json("data/states-10m.json")
  ]).then(function(a){
    return {flows:a[0].map(coerce), recv:a[1].map(coerce), head:a[2], topo:a[3]};
  }).catch(function(){
    var B=window.BUNDLE||{};
    return {flows:(B.state_flows||[]).map(coerce), recv:(B.receiving_states||[]).map(coerce),
            head:B.headline||{}, topo:B.topo};
  });
};

/* shared chrome */
var tip;
ns.tip=function(e,html){
  tip=tip||document.getElementById("tip"); if(!tip) return;
  tip.innerHTML=html; tip.style.opacity=1;
  var x=e.clientX+14,y=e.clientY+14;
  if(x>innerWidth-280) x=e.clientX-280;
  if(y>innerHeight-140) y=e.clientY-140;
  tip.style.left=x+"px"; tip.style.top=y+"px";
};
ns.hideTip=function(){ tip=tip||document.getElementById("tip"); if(tip) tip.style.opacity=0; };
ns.fmt=d3.format(",");
ns.M=function(n){ return n>=1e6?(n/1e6).toFixed(1)+"M":Math.round(n/1000)+"k"; };
ns.fail=function(sel,msg){
  var el=document.querySelector(sel); if(!el) return;
  var d=document.createElement("div"); d.className="err";
  d.textContent="This chart could not load: "+msg; el.replaceWith(d);
};
})(window.CATL);
