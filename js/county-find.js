/* "Find your county": the one search box at the top of the page.
   It only chooses a county (ns.selectCounty); every chart reacts through ns.onCounty. */
window.CATL = window.CATL || {};
window.CATL.countyFind = function(rows, trend){
"use strict";
var ns=window.CATL;
var input=document.getElementById("find-input"), line=document.getElementById("find-line");
var tier={}; trend.forEach(function(d){ tier[d.policy_rank]=d.policy_tier; });
ns.countyReady();
function mi(v){ return v==null?"not available":ns.f1(v); }

function show(f){
  var d=ns.countyRow(f);
  if(!d){ line.textContent=""; return; }
  input.value=d.label;
  line.textContent=d.label+": "+mi(d.drive_miles_may2022)+" miles to the nearest clinic in May 2022, "+mi(d.drive_miles_jul2026)+
    " in July 2026."+(tier[d.policy_rank]?" Its state is in the "+tier[d.policy_rank]+" group.":"");
}
function search(){
  var q=input.value.trim(); if(!q) return;
  var d=ns.matchCounty(q);
  if(d) ns.selectCounty(d.fips);
  else line.textContent="No county matches “"+input.value+"”. Try the form “Hinds, MS”.";
}
input.addEventListener("change",search);
input.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); search(); } });
document.getElementById("find-clear").addEventListener("click",function(){ ns.selectCounty(null); });
ns.onCounty(function(f){ if(f) show(f); else { input.value=""; line.textContent=""; } });

// a link with ?county=<fips> reopens the same county
var q=new URLSearchParams(location.search).get("county");
if(q) ns.selectCounty(q);
};
