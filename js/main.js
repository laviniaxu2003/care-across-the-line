/* page wiring */
(function(){
"use strict";
var ns=window.CATL;
ns.load().then(function(D){
  var h=D.head||{};
  function set(id,v){ var e=document.getElementById(id); if(e&&v!=null) e.textContent=v; }
  if(h.women_crossing){
    set("t1",(h.women_crossing/1e6).toFixed(1)+"M");
    set("t2",h.women_crossing_pct+"%");
    set("t4",h.states_to_zero);
    set("h-zero",h.states_to_zero+" states");
    set("h-clinics",h.clinics_may2022+" to "+h.clinics_now);
    if(h.top_receiver) set("t3",h.top_receiver.load.toFixed(1)+"×");
  }
  if(document.querySelector("#map")) { try{ ns.catchmentMap(D,"#map"); }catch(e){ console.error(e); ns.fail("#map",e.message); } }
  if(document.querySelector("#load")){ try{ ns.clinicLoad(D,"#load"); }catch(e){ console.error(e); ns.fail("#load",e.message); } }
}).catch(function(e){ console.error(e); });
})();
