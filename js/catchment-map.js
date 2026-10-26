/* VIEW 1 (novel): the catchment map.
   States coloured by their role in the post-Dobbs service network, ribbons from the
   state that lost its clinics to the state now holding the nearest one, circles sized
   by how many women each receiving clinic must now cover. */
window.CATL = window.CATL || {};
window.CATL.catchmentMap = function(D, sel){
"use strict";
var ns=window.CATL;
var svg=d3.select(sel), W=960, H=600;
if(typeof topojson==="undefined"||!D.topo) return ns.fail(sel,"map geometry unavailable");

var states=topojson.feature(D.topo, D.topo.objects.states);
var proj=d3.geoAlbersUsa().fitSize([W-30,H-96],states);
var path=d3.geoPath(proj);
var byName={}; D.recv.forEach(function(r){ byName[r.state]=r; });
var cen={};
states.features.forEach(function(f){
  var r=byName[f.properties.name]; if(!r) return;
  var c=path.centroid(f); if(c&&!isNaN(c[0])) cen[r.state_abbr]=c;
});

function role(r){ if(!r) return "na";
  if(r.clinics===0) return "exporter";
  return r.imported_women>0 ? "receiver" : "self"; }
var FILL={exporter:"var(--exporter)",receiver:"var(--receiver)",self:"var(--neutral)",na:"var(--neutral)"};

var g=svg.append("g").attr("transform","translate(15,16)");
var shapes=g.append("g").selectAll("path").data(states.features).join("path")
  .attr("d",path)
  .attr("fill",function(f){ return FILL[role(byName[f.properties.name])]; })
  .attr("fill-opacity",function(f){ var c=role(byName[f.properties.name]);
    return (c==="self"||c==="na")?.28:.80; })
  .attr("stroke","var(--surface-1)").attr("stroke-width",1).style("cursor","pointer");

var cross=D.flows.filter(function(f){
    return f.out_of_state===1 && f.women_15_44>40000 && cen[f.origin_abbr] && cen[f.dest_abbr]; })
  .sort(function(a,b){ return b.women_15_44-a.women_15_44; });
var wScale=d3.scaleSqrt().domain([0,d3.max(cross,function(d){return d.women_15_44;})||1]).range([0.8,14]);
function ribbon(d){
  var a=cen[d.origin_abbr], b=cen[d.dest_abbr];
  var mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2, dx=b[0]-a[0], dy=b[1]-a[1];
  return "M"+a[0]+","+a[1]+"Q"+(mx-dy*0.17)+","+(my+dx*0.17)+" "+b[0]+","+b[1];
}
var ribbons=g.append("g").attr("fill","none").selectAll("path").data(cross).join("path")
  .attr("d",ribbon).attr("stroke","var(--flow)")
  .attr("stroke-width",function(d){return wScale(d.women_15_44);})
  .attr("stroke-linecap","round").attr("pointer-events","none");

var recv=D.recv.filter(function(r){ return r.imported_women>0 && r.clinics>0 && cen[r.state_abbr]; });
var rScale=d3.scaleSqrt().domain([0,d3.max(recv,function(d){return d.women_per_clinic_total;})||1]).range([0,27]);
g.append("g").selectAll("circle").data(recv).join("circle")
  .attr("cx",function(d){return cen[d.state_abbr][0];})
  .attr("cy",function(d){return cen[d.state_abbr][1];})
  .attr("r",function(d){return rScale(d.women_per_clinic_total);})
  .attr("fill","none").attr("stroke","var(--receiver)").attr("stroke-width",2)
  .attr("pointer-events","none");

var top=recv.slice().sort(function(a,b){return b.women_per_clinic_total-a.women_per_clinic_total;}).slice(0,5);
g.append("g").selectAll("text").data(top).join("text")
  .attr("x",function(d){return cen[d.state_abbr][0];})
  .attr("y",function(d){return cen[d.state_abbr][1]-rScale(d.women_per_clinic_total)-7;})
  .attr("text-anchor","middle").attr("font-size",12.5).attr("font-weight",600)
  .attr("font-family","DM Mono, monospace").attr("fill","var(--ink)")
  .attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3.5)
  .attr("pointer-events","none")
  .text(function(d){ return d.state_abbr+" "+d.load_vs_national.toFixed(1)+"×"; });

shapes.on("mousemove",function(e,f){
  var r=byName[f.properties.name];
  if(!r){ ns.hideTip(); return; }
  var outflow=D.flows.filter(function(x){return x.origin_abbr===r.state_abbr&&x.out_of_state===1;})
                     .sort(function(a,b){return b.women_15_44-a.women_15_44;});
  var s="<div class='t'>"+r.state+"</div>";
  s+="<span class='k'>clinics now</span> "+r.clinics+" <span class='k'>(was "+r.clinics_may2022+")</span><br>";
  if(r.imported_women>0)
    s+="<span class='k'>absorbs</span> "+ns.M(r.imported_women)+" women from "+r.origin_states+" states<br>"+
       "<span class='k'>per clinic</span> "+ns.fmt(r.women_per_clinic_total)+
       " = "+r.load_vs_national.toFixed(1)+"× national<br>";
  if(outflow.length)
    s+="<span class='k'>sends</span> "+ns.M(d3.sum(outflow,function(x){return x.women_15_44;}))+
       " women to "+outflow.slice(0,3).map(function(x){return x.dest_abbr;}).join(", ");
  ns.tip(e,s);
  ribbons.attr("stroke",function(d){
      return (d.origin_abbr===r.state_abbr||d.dest_abbr===r.state_abbr)?"var(--exporter)":"var(--flow)"; })
    .attr("opacity",function(d){
      return (d.origin_abbr===r.state_abbr||d.dest_abbr===r.state_abbr)?1:.22; });
}).on("mouseleave",function(){
  ns.hideTip(); ribbons.attr("stroke","var(--flow)").attr("opacity",1);
});
};
