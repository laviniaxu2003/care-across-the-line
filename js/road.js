/* VIEW A2 (editorial companion to the trend line): "the road that keeps getting longer".
   The same series the line chart plots - mean_drive_miles_weighted for policy rank 1,
   the Most Restrictive group - read at the three months the chart already annotates.
   Length along a fixed winding path is proportional to that average, so the road is a
   SCHEMATIC of a distance, not a route: no clinic coordinates, no geography, no claim
   about any individual's journey. The line chart below carries the full series. */
window.CATL = window.CATL || {};
window.CATL.road = function(rows, sel){
"use strict";
var ns=window.CATL;
var root=document.querySelector(sel);
var r1={}; rows.forEach(function(d){ if(d.policy_rank===1) r1[d.ym]=d.mean_drive_miles_weighted; });
var STOPS=[{ym:"2022-05",label:"May 2022",note:"the month before the decision"},
           {ym:"2022-07",label:"July 2022",note:"the first month after"},
           {ym:"2023-01",label:"January 2023",note:"eight months after"}]
  .filter(function(s){ return r1[s.ym]!=null; })
  .map(function(s){ s.mi=r1[s.ym]; return s; });
if(STOPS.length<2) return ns.fail(sel,"the Most Restrictive series is missing its key months");
var MAX=d3.max(STOPS,function(s){return s.mi;});
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var DUR=reduce?0:900;
var idx=0, shown=0;            // shown = miles currently drawn, so a change tweens from here

/* ---- chrome that does not redraw on resize ---- */
root.innerHTML="";
var head=d3.select(root).append("div").attr("class","road-head");
var num=head.append("p").attr("class","road-num").attr("aria-live","polite");
var cap=head.append("p").attr("class","road-cap");
var figWrap=d3.select(root).append("div").attr("class","road-svg");
var ctl=d3.select(root).append("div").attr("class","controls road-ctl");
var seg=ctl.append("div").attr("class","ctl").call(function(c){
  c.append("span").attr("class","lab").attr("id","lab-road").text("Compare");
  return c.append("div").attr("class","seg").attr("role","group").attr("aria-labelledby","lab-road");
});
var segBox=seg.select(".seg");
STOPS.forEach(function(s,i){
  segBox.append("button").attr("type","button").attr("data-i",i)
    .attr("aria-pressed",i===0?"true":"false").text(s.label)
    .on("click",function(){ go(i,true); });
});
ctl.append("div").attr("class","ctl").call(function(c){
  c.append("span").attr("class","lab").html("&nbsp;");
  c.append("button").attr("type","button").attr("class","plain").attr("id","road-replay")
    .text(reduce?"Show the change":"Replay").on("click",function(){ replay(); });
});

/* ---- the drawing ---- */
var svg,pathEl,total,surface,centre,car,pin,pinLab,W,H,GEO;
function draw(){
  figWrap.selectAll("*").interrupt();
  figWrap.html("");
  W=ns.width(figWrap.node()); var narrow=W<520;
  H=narrow?210:250;
  svg=figWrap.append("svg").attr("viewBox","0 0 "+W+" "+H).attr("role","img")
    .attr("aria-labelledby","road-t road-d");
  svg.append("title").attr("id","road-t").text("Schematic road showing the average distance to the nearest open clinic in the Most Restrictive states");
  svg.append("desc").attr("id","road-d");

  // one winding path, scaled to the box; length along it stands in for miles
  var m={l:34,r:34,t:46,b:52}, w=W-m.l-m.r, h=H-m.t-m.b;
  var d="M"+m.l+","+(m.t+h*0.82)+
        "C"+(m.l+w*0.16)+","+(m.t+h*0.82)+" "+(m.l+w*0.16)+","+(m.t+h*0.12)+" "+(m.l+w*0.34)+","+(m.t+h*0.12)+
        "S"+(m.l+w*0.52)+","+(m.t+h*0.92)+" "+(m.l+w*0.68)+","+(m.t+h*0.92)+
        "S"+(m.l+w*0.86)+","+(m.t+h*0.18)+" "+(m.l+w)+","+(m.t+h*0.18);
  var g=svg.append("g");
  // the whole journey, ghosted: the reader can see how much road is still to come
  g.append("path").attr("d",d).attr("fill","none").attr("stroke","var(--rule)")
    .attr("stroke-width",narrow?16:20).attr("stroke-linecap","round").attr("opacity",.55);
  surface=g.append("path").attr("d",d).attr("fill","none").attr("stroke","var(--pol-4)")
    .attr("stroke-width",narrow?16:20).attr("stroke-linecap","round");
  centre=g.append("path").attr("d",d).attr("fill","none").attr("stroke","var(--spot)")
    .attr("stroke-width",2).attr("stroke-linecap","butt").attr("opacity",.9);
  pathEl=surface.node();
  // Every SVG engine implements these, but if one does not, degrade to a drawn road
  // plus the exact figure rather than replacing the whole figure with an error.
  GEO=typeof pathEl.getTotalLength==="function"&&typeof pathEl.getPointAtLength==="function";
  total=GEO?pathEl.getTotalLength():0;

  // origin marker stays put; it is a county, not a person
  var p0=GEO?pathEl.getPointAtLength(0):{x:m.l,y:m.t+h*0.82};
  g.append("circle").attr("cx",p0.x).attr("cy",p0.y).attr("r",5.5)
    .attr("fill","var(--surface-1)").attr("stroke","var(--ink)").attr("stroke-width",2);
  svg.append("text").attr("x",p0.x).attr("y",p0.y+26).attr("text-anchor","middle")
    .attr("font-size",12).attr("fill","var(--ink-3)").text("County");

  pin=g.append("g");
  // Ivy, the access colour: the same token the catchment map rings its destination
  // with. Crimson stays reserved for an emphasised subset and site chrome.
  pin.append("circle").attr("r",7).attr("fill","var(--pol-7)")
    .attr("stroke","var(--surface-1)").attr("stroke-width",2.5);
  pinLab=svg.append("text").attr("text-anchor","middle").attr("font-size",12)
    .attr("fill","var(--ink-2)").text("nearest clinic");
  car=g.append("g").attr("aria-hidden","true");
  car.append("rect").attr("x",-7).attr("y",-3.5).attr("width",14).attr("height",7).attr("rx",2.5)
    .attr("fill","var(--ink)").attr("stroke","var(--surface-1)").attr("stroke-width",1.5);
  paint(shown);
}

// dashes only along the stretch already travelled, then one gap longer than the path
function centreDash(len){
  var a=[],used=0,on=11,off=13;
  while(used<len-1){ var dOn=Math.min(on,len-used); a.push(dOn); used+=dOn;
    if(used>=len) break; var dOff=Math.min(off,len-used); a.push(dOff); used+=dOff; }
  a.push(0,total+40);
  return a.join(" ");
}
function paint(mi){
  num.html(ns.f1(mi)+"<small> mi</small>");
  if(!GEO){ surface.attr("stroke-dasharray",null); centre.attr("stroke-dasharray","11 13");
    pin.attr("opacity",0); pinLab.attr("opacity",0); car.attr("opacity",0); return; }
  var L=total*(mi/MAX);
  surface.attr("stroke-dasharray",L+" "+(total+40));
  centre.attr("stroke-dasharray",centreDash(L));
  var pe=pathEl.getPointAtLength(L);
  pin.attr("transform","translate("+pe.x+","+pe.y+")");
  pinLab.attr("x",pe.x).attr("y",pe.y-16);
  var cl=Math.max(0,L-30), pc=pathEl.getPointAtLength(cl), pa=pathEl.getPointAtLength(Math.max(0,cl-6));
  var ang=Math.atan2(pc.y-pa.y,pc.x-pa.x)*180/Math.PI;
  car.attr("transform","translate("+pc.x+","+pc.y+") rotate("+ang+")").attr("opacity",L>44?1:0);
  pin.attr("opacity",1); pinLab.attr("opacity",1);
}

function describe(){
  var s=STOPS[idx];
  svg.select("#road-d").text("In "+s.label+", the average distance to the nearest open clinic across counties in the "+
    "Most Restrictive policy group was "+ns.f1(s.mi)+" road miles. The road is drawn to scale against "+
    ns.f1(MAX)+" miles and is schematic, not a route.");
  cap.html("<b>"+s.label+"</b> &middot; "+s.note+" &middot; average across Most Restrictive counties, weighted by women aged 15–44");
}
function go(i,animate){
  idx=i;
  segBox.selectAll("button").attr("aria-pressed",function(){ return +this.dataset.i===idx?"true":"false"; });
  var target=STOPS[idx].mi;
  figWrap.selectAll("*").interrupt();                 // never leave a half-finished tween running
  if(!animate||reduce||DUR===0||!GEO){ shown=target; paint(shown); describe(); return; }
  var from=shown;
  svg.transition().duration(DUR).ease(d3.easeCubicInOut)
    .tween("road",function(){
      var it=d3.interpolateNumber(from,target);
      return function(t){ shown=it(t); paint(shown); };
    })
    .on("end interrupt",function(){ shown=target; paint(shown); });
  describe();
}
function replay(){
  if(reduce){ go(STOPS.length-1,false); return; }
  shown=STOPS[0].mi; paint(shown);
  go(0,false);
  var i=1;
  (function step(){
    if(i>=STOPS.length) return;
    go(i,true);
    var n=i++;
    svg.transition().delay(DUR+320).duration(0).on("end",step);
  })();
}

draw(); go(0,false);
ns.onResize(function(){ draw(); paint(shown); });
};
