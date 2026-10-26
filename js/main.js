/* page wiring: headline numbers, then each chart with its own loading/failure state */
(function(){
"use strict";
var ns=window.CATL;
if(typeof d3==="undefined"){
  var b=document.getElementById("data-status");
  if(b){ b.hidden=false; b.textContent="The charting library (D3, loaded from cdnjs) could not be loaded, so the charts cannot be drawn. Numbers in the text come from the last data build."; }
  return;
}

/* Numbers in the text are written from the same build (scripts/validate.py checks they match).
   At runtime they are refreshed from headline.json; if that fails, the banner says so. */
ns.get("head").then(function(h){
  document.querySelectorAll("[data-h]").forEach(function(el){
    var v=h.display[el.dataset.h];
    if(v==null){ console.warn("no headline value for",el.dataset.h); el.classList.add("unverified"); }
    else el.textContent=v;
  });
}).catch(function(e){ console.error(e); ns.dataProblem(); });

if(document.querySelector("#trend"))
  ns.run("#st-trend",["trend"],function(t){ ns.distanceTrend(t,"#trend"); });
if(document.querySelector("#burden"))
  ns.run("#st-burden",["burden","burdenAll","head"],function(b,a,h){ ns.burdenBars(b,a,h,"#burden"); });
if(document.querySelector("#county-map"))
  ns.run("#st-county",["counties","counties-geo","head"],function(c,g,h){ ns.countyExplorer(c,g,h); });
if(document.querySelector("#rural"))
  ns.run("#st-rural",["rurality"],function(r){ ns.rurality(r,"#rural"); });
if(document.querySelector("#load"))
  ns.run("#st-load",["recv","head"],function(r,h){ ns.clinicLoad({recv:r,head:h},"#load"); });
if(document.querySelector("#map"))
  ns.run("#st-catch",["flows","recv","head","states"],function(f,r,h,topo){
    ns.catchmentMap({flows:f,recv:r,head:h,topo:topo},"#map"); });
})();
