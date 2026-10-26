/* VIEW E: potential catchment per clinic in each receiving state.
   One row per state that is the nearest option for some county in another state;
   hollow dot = retained local catchment per clinic, filled = total assigned catchment per clinic.
   Revised from the original dumbbell: endpoints now use retained (not all residents) and
   retained + incoming; the reference line is computed, not typed in; DC is reported separately. */
window.CATL = window.CATL || {};
window.CATL.clinicLoad = function(D, sel){
"use strict";
var ns=window.CATL;
var root=document.querySelector(sel);
var rows=D.recv.filter(function(r){return r.incoming_women>0 && r.clinics_jul2026>0;})
               .sort(function(a,b){return b.assigned_per_clinic-a.assigned_per_clinic;});
if(!rows.length) return ns.fail(sel,"no receiving states in the data");
var NAT=D.head.catchment.ref_per_clinic;
var selected=ns.currentState||null;  // the map may have selected Kansas first

function draw(){
  root.innerHTML="";
  var W=ns.width(root), narrow=W<560;
  var M={t:34,r:narrow?16:150,b:52,l:narrow?92:132}, rowH=21, H=M.t+rows.length*rowH+M.b;
  var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H)
    .attr("role","img").attr("aria-labelledby","load-title load-desc");
  svg.append("title").attr("id","load-title").text("Potential catchment per clinic in receiving states");
  svg.append("desc").attr("id","load-desc").text("Log-scale dot chart. Kansas: "+ns.fmt(Math.round(rows[0].assigned_per_clinic))+
    " women aged 15 to 44 per clinic in total, versus "+ns.fmt(Math.round(NAT))+" for all 50 states combined. Full values in the data table below.");
  var x=d3.scaleLog()
    .domain([d3.min(rows,function(d){return d.retained_per_clinic;})*0.8,
             d3.max(rows,function(d){return d.assigned_per_clinic;})*1.15])
    .range([M.l,W-M.r]);
  var y=function(i){ return M.t+i*rowH+rowH/2; };

  [10000,20000,50000,100000,200000,500000,1000000].forEach(function(v){
    if(v<x.domain()[0]||v>x.domain()[1]) return;
    if(narrow&&(v===20000||v===200000)) return;
    svg.append("line").attr("x1",x(v)).attr("x2",x(v)).attr("y1",M.t-6).attr("y2",H-M.b+4)
      .attr("stroke","var(--rule)");
    svg.append("text").attr("x",x(v)).attr("y",M.t-14).attr("text-anchor","middle")
      .attr("font-size",11).attr("fill","var(--ink-3)").text(v>=1e6?(v/1e6)+"M":(v/1000)+"k");
  });
  svg.append("line").attr("x1",x(NAT)).attr("x2",x(NAT)).attr("y1",M.t-6).attr("y2",H-M.b+4)
    .attr("stroke","var(--ink)").attr("stroke-width",1.4).attr("stroke-dasharray","5 4");
  svg.append("text").attr("x",x(NAT)).attr("y",H-M.b+20).attr("text-anchor","middle")
    .attr("font-size",11).attr("fill","var(--ink)").text("50 states combined "+ns.fmt(Math.round(NAT)));
  svg.append("text").attr("x",M.l).attr("y",H-M.b+42).attr("font-size",12)
    .attr("fill","var(--ink-2)").text("women aged 15–44 per open clinic (log scale)");

  var g=svg.append("g").selectAll("g").data(rows).join("g").attr("class","row")
    .style("cursor","pointer")
    .on("mousemove",function(e,d){
      ns.tip(e,"<div class='t'>"+d.name+"</div>"+
        "<span class='k'>open clinics, Jul 2026</span> "+d.clinics_jul2026+"<br>"+
        "<span class='k'>retained local</span> "+ns.fmt(d.retained_women)+" ("+ns.fmt(Math.round(d.retained_per_clinic))+" per clinic)<br>"+
        "<span class='k'>incoming</span> "+ns.fmt(d.incoming_women)+" from "+d.incoming_origin_states+" state"+(d.incoming_origin_states>1?"s":"")+"<br>"+
        "<span class='k'>total assigned</span> "+ns.fmt(Math.round(d.assigned_per_clinic))+" per clinic");
    }).on("mouseleave",ns.hideTip)
    .on("click",function(e,d){ ns.emit("select-state",d.abbr); });

  g.append("rect").attr("class","hit").attr("x",4).attr("y",function(d,i){return y(i)-rowH/2;})
    .attr("width",W-8).attr("height",rowH).attr("rx",2).attr("fill","transparent");
  g.append("text").attr("x",M.l-12).attr("y",function(d,i){return y(i)+4;})
    .attr("text-anchor","end").attr("font-size",12).attr("fill","var(--ink-2)")
    .text(function(d){return (narrow?d.abbr:d.name)+" ("+d.clinics_jul2026+")";});
  g.append("line")
    .attr("x1",function(d){return x(d.retained_per_clinic);})
    .attr("x2",function(d){return x(d.assigned_per_clinic);})
    .attr("y1",function(d,i){return y(i);}).attr("y2",function(d,i){return y(i);})
    .attr("stroke","var(--receiver)").attr("stroke-width",2).attr("stroke-linecap","round").attr("opacity",.55);
  g.append("circle").attr("cx",function(d){return x(d.retained_per_clinic);})
    .attr("cy",function(d,i){return y(i);}).attr("r",4)
    .attr("fill","var(--surface-1)").attr("stroke","var(--ink-3)").attr("stroke-width",1.8);
  g.append("circle").attr("cx",function(d){return x(d.assigned_per_clinic);})
    .attr("cy",function(d,i){return y(i);}).attr("r",5)
    .attr("fill","var(--receiver)").attr("stroke","var(--surface-1)").attr("stroke-width",2);
  if(!narrow) g.filter(function(d,i){return i<6;}).append("text")
    .attr("x",function(d){return x(d.assigned_per_clinic)+12;})
    .attr("y",function(d,i){return y(i)+4;}).attr("font-size",11.5).attr("fill","var(--ink)")
    .text(function(d){return ns.fmt(Math.round(d.assigned_per_clinic));});
  highlight();
}
function highlight(){
  d3.select(root).selectAll("g.row").select("rect.hit")
    .attr("fill",function(d){ return d.abbr===selected?"var(--surface-2)":"transparent"; })
    .attr("stroke",function(d){ return d.abbr===selected?"var(--ink-3)":"none"; });
}
ns.on("state-selected",function(abbr){ selected=abbr; highlight(); });

/* DC: known incoming population, per-clinic unavailable */
var dc=D.recv.filter(function(r){return r.abbr==="DC";})[0];
if(dc) document.getElementById("load-dc").innerHTML="<b>District of Columbia</b> is not shown as a row: it is the nearest option for "+
  ns.fmt(dc.incoming_women)+" women aged 15–44 in Arlington County, Virginia, but the supplied tables have no DC clinic count or resident population, so its per-clinic value is not available.";

/* accessible table */
var tb="<table class='dt'><thead><tr><th>State</th><th class='n'>Clinics</th><th class='n'>Retained</th><th class='n'>Incoming</th><th class='n'>Total assigned</th><th class='n'>Per clinic</th></tr></thead><tbody>";
rows.concat(dc?[dc]:[]).forEach(function(d){
  tb+="<tr><td>"+d.name+"</td><td class='n'>"+ns.na(d.clinics_jul2026)+"</td><td class='n'>"+ns.fmt(d.retained_women)+
    "</td><td class='n'>"+ns.fmt(d.incoming_women)+"</td><td class='n'>"+ns.fmt(d.assigned_women)+
    "</td><td class='n'>"+ns.na(d.assigned_per_clinic==null?null:Math.round(d.assigned_per_clinic))+"</td></tr>";
});
document.getElementById("load-table").innerHTML=tb+"</tbody></table>";

draw();
ns.onResize(draw);
};
