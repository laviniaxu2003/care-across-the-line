/* VIEW 2: load per clinic, before and after out-of-state inflow.
   One row per receiving state; hollow dot = own residents only, filled = with inflow. */
window.CATL = window.CATL || {};
window.CATL.clinicLoad = function(D, sel){
"use strict";
var ns=window.CATL;
var rows=D.recv.filter(function(r){return r.imported_women>0 && r.clinics>0;})
               .sort(function(a,b){return b.women_per_clinic_total-a.women_per_clinic_total;});
if(!rows.length) return ns.fail(sel,"no receiving states in the data");

var W=960, M={t:34,r:150,b:62,l:56}, rowH=19, H=M.t+rows.length*rowH+M.b;
var svg=d3.select(sel).attr("viewBox","0 0 "+W+" "+H);
var x=d3.scaleLog()
  .domain([d3.min(rows,function(d){return d.women_per_clinic_own;})*0.8,
           d3.max(rows,function(d){return d.women_per_clinic_total;})*1.25])
  .range([M.l,W-M.r]);
var y=function(i){ return M.t+i*rowH+rowH/2; };

[20000,50000,100000,250000,500000,1000000].forEach(function(v){
  if(v<x.domain()[0]||v>x.domain()[1]) return;
  svg.append("line").attr("x1",x(v)).attr("x2",x(v)).attr("y1",M.t-6).attr("y2",H-M.b+4)
    .attr("stroke","var(--rule)");
  svg.append("text").attr("x",x(v)).attr("y",M.t-14).attr("text-anchor","middle")
    .attr("font-size",11).attr("font-family","DM Mono, monospace")
    .attr("fill","var(--ink-3)").text(v>=1e6?(v/1e6)+"M":(v/1000)+"k");
});
var NAT=(D.head&&D.head.national_women_per_clinic)||81655;
svg.append("line").attr("x1",x(NAT)).attr("x2",x(NAT)).attr("y1",M.t-6).attr("y2",H-M.b+4)
  .attr("stroke","var(--ink)").attr("stroke-width",1.4).attr("stroke-dasharray","5 4");
svg.append("text").attr("x",x(NAT)).attr("y",H-M.b+24).attr("text-anchor","middle")
  .attr("font-size",11.5).attr("font-family","DM Mono, monospace")
  .attr("fill","var(--ink)").text("national average "+ns.fmt(NAT));
svg.append("text").attr("x",M.l-50).attr("y",H-M.b+48).attr("font-size",12.5)
  .attr("fill","var(--ink-2)").text("women aged 15–44 per open clinic (log scale)");

var g=svg.append("g").selectAll("g").data(rows).join("g")
  .on("mousemove",function(e,d){
    ns.tip(e,"<div class='t'>"+d.state+"</div>"+
      "<span class='k'>clinics</span> "+d.clinics+"<br>"+
      "<span class='k'>own residents</span> "+ns.fmt(d.women_per_clinic_own)+" per clinic<br>"+
      "<span class='k'>with inflow</span> "+ns.fmt(d.women_per_clinic_total)+" per clinic<br>"+
      "<span class='k'>absorbs</span> "+ns.M(d.imported_women)+" women from "+d.origin_states+" states");
  }).on("mouseleave",ns.hideTip);

g.append("rect").attr("x",M.l-50).attr("y",function(d,i){return y(i)-rowH/2;})
  .attr("width",W-M.r-M.l+62).attr("height",rowH).attr("fill","transparent");
g.append("text").attr("x",M.l-14).attr("y",function(d,i){return y(i)+4;})
  .attr("text-anchor","end").attr("font-size",12).attr("font-family","DM Mono, monospace")
  .attr("fill","var(--ink-2)").text(function(d){return d.state_abbr;});
g.append("line")
  .attr("x1",function(d){return x(d.women_per_clinic_own);})
  .attr("x2",function(d){return x(d.women_per_clinic_total);})
  .attr("y1",function(d,i){return y(i);}).attr("y2",function(d,i){return y(i);})
  .attr("stroke","var(--receiver)").attr("stroke-width",2).attr("stroke-linecap","round").attr("opacity",.55);
g.append("circle").attr("cx",function(d){return x(d.women_per_clinic_own);})
  .attr("cy",function(d,i){return y(i);}).attr("r",4)
  .attr("fill","var(--surface-1)").attr("stroke","var(--ink-3)").attr("stroke-width",1.8);
g.append("circle").attr("cx",function(d){return x(d.women_per_clinic_total);})
  .attr("cy",function(d,i){return y(i);}).attr("r",5)
  .attr("fill","var(--receiver)").attr("stroke","var(--surface-1)").attr("stroke-width",2);
g.filter(function(d,i){return i<6;}).append("text")
  .attr("x",function(d){return x(d.women_per_clinic_total)+12;})
  .attr("y",function(d,i){return y(i)+4;}).attr("font-size",11.5)
  .attr("font-family","DM Mono, monospace").attr("fill","var(--ink)")
  .text(function(d){return ns.fmt(d.women_per_clinic_total)+"   "+d.load_vs_national.toFixed(1)+"×";});
};
