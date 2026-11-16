/* VIEW D (novel): the catchment map + state profile.
   Arrows run from a home state to the state holding the nearest open clinic for some of its
   counties (county assignments added up by state, July 2026). Width is linear in women 15-44.

   Revised Nov 2026: the incoming/outgoing toggle and the jurisdiction dropdown are gone. They
   asked the reader to hold two directions in mind at once, and "outgoing" was easy to misread as
   people leaving a state that still has clinics. The map now has one view, the overview of every
   state, and clicking a state highlights it and fills the profile panel on the right.

   Colour: ochre for states with no clinic left, violet for states that are the nearest option for
   another state's residents and for the connections into them. Deliberately not red/blue,
   which read as party colours on a US map.

   Revised Nov 2026 (2): the links are tapered ribbons rather than arrows. Width at the origin is
   still linear in women aged 15-44, so the encoding is unchanged, but each band narrows to a point
   at the destination. Direction comes from the taper, so the heavy arrowheads are gone, and the ink
   thins exactly where links converge, which is where the old version turned into a blot. One
   journey marker can be traced along a single connection on request; nothing moves on its own. */
window.CATL = window.CATL || {};
window.CATL.catchmentMap = function(D, sel){
"use strict";
var ns=window.CATL;
var W=960, H=600;
if(typeof topojson==="undefined"||!D.topo) return ns.fail(sel,"map geometry unavailable");
var C=D.head.catchment, MINW=C.overview_min_women;

var byAbbr={}, byName={};
D.recv.forEach(function(r){ byAbbr[r.abbr]=r; byName[r.name]=r; });
var states=topojson.feature(D.topo, D.topo.objects.states);
states.features=states.features.filter(function(f){ return byName[f.properties.name]; }); // 50 states + DC
var proj=d3.geoAlbersUsa().fitSize([W-30,H-40],states);
var path=d3.geoPath(proj);
var cen={};
states.features.forEach(function(f){
  var r=byName[f.properties.name], c=path.centroid(f);
  if(c&&!isNaN(c[0])) cen[r.abbr]=c;
});
// small nudges where the polygon centroid falls awkwardly (schematic positions only)
var NUDGE={FL:[22,10],LA:[-10,-4],MI:[16,24],KY:[6,4],ID:[0,30],VA:[8,4]};
Object.keys(NUDGE).forEach(function(k){ if(cen[k]) cen[k]=[cen[k][0]+NUDGE[k][0],cen[k][1]+NUDGE[k][1]]; });
var cross=D.flows.filter(function(f){ return f.out_of_state===1; });
var missing=cross.filter(function(f){ return !cen[f.origin_abbr]||!cen[f.dest_abbr]; });
if(missing.length) console.warn("links without a centroid",missing);
/* Editorial overview rule, stated on the page: the six largest single connections by
   women aged 15-44. They carry more than half of everyone whose nearest clinic is out
   of state. Nothing is discarded - selecting a state draws all of its connections, and
   "Show all connections" draws all 100. */
var TOPN=6;
var ranked=cross.slice().sort(function(a,b){return b.women_15_44-a.women_15_44;});
var overview=ranked.slice(0,TOPN);
var overviewShare=d3.sum(overview,function(d){return d.women_15_44;})/
                   (d3.sum(cross,function(d){return d.women_15_44;})||1)*100;
var FEATURED=["TX","TN","LA"];

var maxW=d3.max(cross,function(d){return d.women_15_44;});
var wScale=d3.scaleLinear().domain([0,maxW]).range([0,15]);   // linear: width proportional to women
var MINPX=1;
function wpx(v){ return Math.max(MINPX,wScale(v)); }

var root=document.querySelector(sel);
root.innerHTML="";
var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("role","img")
  .attr("aria-labelledby","map-title map-desc");
svg.append("title").attr("id","map-title").text("Cross-state nearest-clinic catchment map");
var desc=svg.append("desc").attr("id","map-desc");
var g=svg.append("g").attr("transform","translate(15,10)");
var shapes=g.append("g").selectAll("path").data(states.features).join("path")
  .attr("d",path).attr("stroke","var(--surface-1)").attr("stroke-width",1).style("cursor","pointer");
var linkG=g.append("g");
var circG=g.append("g");
var labG=g.append("g");
var carG=g.append("g").attr("pointer-events","none");   // journey marker + arrival ring
// DC is too small to click on the map: a labelled marker stands in for it
var dcc=cen.DC;
var dcG=g.append("g").style("cursor","pointer");
if(dcc){
  dcG.append("line").attr("x1",dcc[0]).attr("y1",dcc[1]).attr("x2",dcc[0]+34).attr("y2",dcc[1]+30)
    .attr("stroke","var(--ink-3)");
  dcG.append("circle").attr("cx",dcc[0]).attr("cy",dcc[1]).attr("r",4).attr("fill","var(--ink)");
  dcG.append("text").attr("x",dcc[0]+37).attr("y",dcc[1]+40).attr("font-size",14).attr("fill","var(--ink)")
    .attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3).text("DC");
  dcG.append("rect").attr("x",dcc[0]-8).attr("y",dcc[1]-8).attr("width",72).attr("height",58).attr("fill","transparent");
}


var selected=null;      // null = editorial overview
var showAll=false;      // true = every one of the 100 cross-state connections
var journey=null;       // the single connection being traced, or null
var played=false;
var threadState=null;   // the state the "your county" selection chose
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var DUR=reduce?0:2500, FADE=reduce?0:420;

/* "your county": the band from its state to the state of its nearest clinic, or null */
function threadInfo(){
  var r=ns.countyRow(ns.county); if(!r) return null;
  var dest=r.nearest_provider_state, same=dest!=null&&dest===r.state_abbr;
  return {row:r, dest:dest, same:same, cross:dest!=null&&!same&&!!byAbbr[dest]};
}
function hot(d){ var t=threadInfo(); return !!(t&&t.cross&&d.origin_abbr===t.row.state_abbr&&d.dest_abbr===t.dest); }
function isJourney(d){ return !!journey&&d.origin_abbr===journey.origin_abbr&&d.dest_abbr===journey.dest_abbr; }
function touches(d){ return selected && (d.origin_abbr===selected || d.dest_abbr===selected); }
function linksOf(a){ return cross.filter(function(d){return d.origin_abbr===a;})
  .sort(function(x,y){return y.women_15_44-x.women_15_44;}); }

function ribbon(d){
  var a=cen[d.origin_abbr], b=cen[d.dest_abbr], w=wpx(d.women_15_44);
  var dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy)||1;
  var nx=-dy/len, ny=dx/len, h=w/2;
  var c=[(a[0]+b[0])/2-dy*0.17, (a[1]+b[1])/2+dx*0.17];
  return {
    area:"M"+(a[0]+nx*h)+","+(a[1]+ny*h)+
         "Q"+(c[0]+nx*h*0.55)+","+(c[1]+ny*h*0.55)+" "+b[0]+","+b[1]+
         "Q"+(c[0]-nx*h*0.55)+","+(c[1]-ny*h*0.55)+" "+(a[0]-nx*h)+","+(a[1]-ny*h)+"Z",
    mid:"M"+a[0]+","+a[1]+"Q"+c[0]+","+c[1]+" "+b[0]+","+b[1],
    w:w };
}
function shownLinks(){
  var set={}, out=[];
  function add(d){ var k=d.origin_abbr+">"+d.dest_abbr; if(set[k]) return; set[k]=1; out.push(d); }
  if(showAll) cross.forEach(add);
  else if(selected) linksOf(selected).forEach(add);
  else overview.forEach(add);
  if(selected) cross.filter(touches).forEach(add);
  cross.filter(hot).forEach(add);
  if(journey) add(journey);
  return out.filter(function(d){ return cen[d.origin_abbr]&&cen[d.dest_abbr]; })
            .sort(function(a,b){ return b.women_15_44-a.women_15_44; })
            .map(function(d){ return Object.assign({},d,ribbon(d)); });
}
function bandOpacity(d){
  if(journey) return isJourney(d)?0.92:0.05;
  if(hot(d)) return 0.92;
  if(!selected) return 0.55;
  return touches(d)?0.85:0.06;
}
function drawLinks(){
  var data=shownLinks();
  var sel=linkG.selectAll("g.lk").data(data,function(d){return d.origin_abbr+">"+d.dest_abbr;});
  sel.exit().transition().duration(FADE).style("opacity",0).remove();
  var en=sel.enter().append("g").attr("class","lk").style("opacity",0);
  en.append("path").attr("class","ln");
  var all=en.merge(sel);
  all.select(".ln").attr("d",function(d){return d.area;}).attr("fill","var(--conn)")
    .attr("stroke","var(--ink)")
    .attr("stroke-width",function(d){return hot(d)||isJourney(d)?1.4:0;})
    .attr("stroke-opacity",function(d){return hot(d)||isJourney(d)?0.8:0;});
  all.transition().duration(FADE).style("opacity",1)
    .select(".ln").attr("fill-opacity",bandOpacity);
  all.on("mousemove",function(e,d){
      ns.tip(e,"<div class='t'>"+d.origin_state+" → "+d.dest_state+"</div>"+ns.fmt(d.women_15_44)+
        " women aged 15–44 in "+d.counties+" "+(d.counties===1?"county":"counties")+
        " whose nearest clinic is in "+d.dest_state);
    }).on("mouseleave",ns.hideTip)
    .on("click",function(e,d){ e.stopPropagation(); play(d); });
  all.order();
  return data;
}

/* role of each state, independent of what is selected */
function role(r){
  if(r.clinics_jul2026===0) return "none";
  if(r.incoming_women>0)    return "serves";
  return "other";
}
var ROLE={none:"var(--pol-1)", serves:"var(--pol-7)", other:"var(--neutral)"};
function fillFor(f){
  var r=byName[f.properties.name], k=role(r);
  // quieter than before: the overview is a backdrop, not a choropleth to read closely.
  // --neutral is a darker grey (3:1 as a swatch), so "other" uses a lower opacity for the same tint.
  var base=k==="other"?0.14:(k==="none"?0.20:0.22);
  if(journey){
    if(r.abbr===journey.origin_abbr) return ["var(--pol-1)",0.55];
    if(r.abbr===journey.dest_abbr)   return ["var(--pol-7)",0.60];
    return [ROLE[k],base*0.5];
  }
  if(!selected) return [ROLE[k],base];
  if(r.abbr===selected) return ["var(--pol-1)",0.52];
  var dest=cross.some(function(x){ return x.origin_abbr===selected&&x.dest_abbr===r.abbr; });
  if(dest) return ["var(--pol-7)",0.46];
  var src=cross.some(function(x){ return x.dest_abbr===selected&&x.origin_abbr===r.abbr; });
  return [ROLE[k], src?base+0.08:base*0.42];
}

function render(){
  shapes.transition().duration(FADE)
    .attr("fill",function(f){return fillFor(f)[0];})
    .attr("fill-opacity",function(f){return fillFor(f)[1];});
  shapes.attr("stroke",function(f){ return byName[f.properties.name].abbr===selected?"var(--ink)":"var(--surface-1)"; })
    .attr("stroke-width",function(f){ return byName[f.properties.name].abbr===selected?1.8:1; });
  shapes.filter(function(f){return byName[f.properties.name].abbr===selected;}).raise();
  circG.selectAll("*").remove(); labG.selectAll("*").remove();
  var drawn=drawLinks();

  // Receiving-state circles: the per-clinic quantity, shown for the destinations of the
  // bands currently drawn. Tying the two layers together stops the overview labelling a
  // state whose connection is not on screen; every state's figure stays in its profile.
  var dests={}; drawn.forEach(function(d){ dests[d.dest_abbr]=1; });
  var recv=D.recv.filter(function(d){return d.incoming_women>0&&d.clinics_jul2026>0&&cen[d.abbr]&&dests[d.abbr];});
  var rS=d3.scaleSqrt().domain([0,d3.max(recv,function(d){return d.assigned_per_clinic;})]).range([0,24]);
  circG.selectAll("circle").data(recv).join("circle")
    .attr("cx",function(d){return cen[d.abbr][0];}).attr("cy",function(d){return cen[d.abbr][1];})
    .attr("r",function(d){return rS(d.assigned_per_clinic);})
    .attr("fill","none").attr("stroke","var(--ink)").attr("stroke-width",1)
    .attr("stroke-opacity",function(d){ return (!selected&&!journey)?0.45:
      (d.abbr===selected||(journey&&d.abbr===journey.dest_abbr)?0.9:0.12); })
    .attr("pointer-events","none");
  var top=recv.slice().sort(function(a,b){return b.assigned_per_clinic-a.assigned_per_clinic;}).slice(0,3);
  if(!recv.length) rS=d3.scaleSqrt().domain([0,1]).range([0,24]);
  labG.selectAll("text").data(top).join("text")
    .attr("x",function(d){return cen[d.abbr][0];}).attr("y",function(d){return cen[d.abbr][1]-rS(d.assigned_per_clinic)-7;})
    .attr("text-anchor","middle").attr("font-size",13).attr("font-weight",600).attr("fill","var(--ink)")
    .attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3.5).attr("pointer-events","none")
    .attr("opacity",function(d){ return (!selected&&!journey)||d.abbr===selected?1:0.25; })
    .text(function(d){return d.abbr+" "+ns.M(d.assigned_per_clinic)+"/clinic";});

  note();
  chips();
  profile();
  desc.text(document.getElementById("catch-note").textContent);
}

/* one short line under the map, never a paragraph */
function note(){
  var el=document.getElementById("catch-note"); if(!el) return;
  var t=threadInfo(), extra="";
  if(t&&t.cross) extra=" <b>"+t.row.label+"</b>&rsquo;s nearest clinic is in "+byAbbr[t.dest].name+".";
  else if(t&&t.same) extra=" <b>"+t.row.label+"</b>&rsquo;s nearest clinic is in its own state.";
  if(showAll) el.innerHTML="All <b>"+C.cross_links+"</b> cross-state connections."+extra+
    " <button type='button' class='linkish' id='catch-top'>Show the six largest</button>";
  else if(selected) el.innerHTML="<b>"+byAbbr[selected].name+"</b>: every one of its connections, including the smallest."+extra;
  else el.innerHTML="The <b>six largest</b> of "+C.cross_links+" connections, carrying "+overviewShare.toFixed(0)+
    "% of the "+ns.M(C.crossing_women)+" women whose nearest clinic is out of state."+extra+
    " <button type='button' class='linkish' id='catch-all'>Show all "+C.cross_links+"</button>";
  var a=document.getElementById("catch-all"); if(a) a.onclick=function(){ showAll=true; select(null); };
  var b=document.getElementById("catch-top"); if(b) b.onclick=function(){ showAll=false; render(); };
}
function chips(){
  d3.selectAll(".pick .chip[data-state]").attr("aria-pressed",function(){
    return this.dataset.state===selected?"true":"false"; });
  var rb=document.getElementById("catch-reset");
  if(rb) rb.disabled=!selected&&!journey&&!showAll;
}

/* ---------------- the journey ---------------- */
function stopJourney(clear){
  carG.selectAll("*").interrupt(); carG.html("");
  if(clear!==false) { journey=null; played=false; }
}
function car(g){
  // a side-on silhouette, about 22 units long: cabin, bonnet, two wheels
  g.append("path").attr("d","M-10.5,2.4L-10.5,0.3C-10.5,-0.8 -9.9,-1.3 -8.8,-1.55L-5.4,-2.2"+
      "C-4,-4 -2.3,-4.9 -0.2,-5L2.6,-5C4.6,-4.9 6.2,-4.1 7.4,-2.5L9.6,-1.7"+
      "C10.7,-1.3 11,-0.7 11,0.4L11,2.4Z")
    .attr("fill","var(--ink)").attr("stroke","var(--surface-1)").attr("stroke-width",1.1)
    .attr("stroke-linejoin","round");
  g.append("path").attr("d","M-4.6,-2.3C-3.5,-3.6 -2.2,-4.1 -0.4,-4.2L2.4,-4.2C3.9,-4.1 5,-3.5 5.9,-2.4Z")
    .attr("fill","var(--surface-1)").attr("fill-opacity",.75);
  [[-5.9,2.4],[6.1,2.4]].forEach(function(w){
    g.append("circle").attr("cx",w[0]).attr("cy",w[1]).attr("r",2.2)
      .attr("fill","var(--ink)").attr("stroke","var(--surface-1)").attr("stroke-width",1.1);
  });
}
function play(d){
  if(!d||!cen[d.origin_abbr]||!cen[d.dest_abbr]) return;
  stopJourney();
  journey=d; played=true;
  if(selected!==d.origin_abbr){ selected=d.origin_abbr; }
  render();
  var track=carG.append("path").attr("d",d.mid).attr("fill","none").attr("stroke","none");
  var node=track.node();
  var ok=node&&typeof node.getTotalLength==="function"&&typeof node.getPointAtLength==="function";
  var end=cen[d.dest_abbr];
  // the connection draws itself as the car travels
  var trail=carG.append("path").attr("d",d.mid).attr("fill","none")
    .attr("stroke","var(--conn)").attr("stroke-width",2.5).attr("stroke-linecap","round");
  var g=carG.append("g"); car(g);
  function arrive(){
    carG.append("circle").attr("cx",end[0]).attr("cy",end[1]).attr("r",8)
      .attr("fill","none").attr("stroke","var(--pol-7)").attr("stroke-width",2.5)
      .call(function(c){ if(reduce) return c.attr("r",17).attr("stroke-opacity",.5);
        c.transition().duration(700).ease(d3.easeCubicOut).attr("r",24).attr("stroke-opacity",0).remove(); });
    carG.append("circle").attr("cx",end[0]).attr("cy",end[1]).attr("r",5.5)
      .attr("fill","var(--pol-7)").attr("stroke","var(--surface-1)").attr("stroke-width",2);
    profile();
  }
  if(!ok||reduce){
    trail.attr("stroke-dasharray",null);
    g.attr("transform","translate("+end[0]+","+end[1]+")");
    arrive(); return;
  }
  var total=node.getTotalLength();
  trail.attr("stroke-dasharray",total+" "+total).attr("stroke-dashoffset",total);
  g.transition().duration(DUR).ease(d3.easeCubicInOut)
    .attrTween("transform",function(){
      return function(t){
        var L=total*t, pt=node.getPointAtLength(L), pr=node.getPointAtLength(Math.max(0,L-4));
        trail.attr("stroke-dashoffset",total-L);
        return "translate("+pt.x+","+pt.y+") rotate("+(Math.atan2(pt.y-pr.y,pt.x-pr.x)*180/Math.PI)+")";
      };
    }).on("end",arrive);
}

/* ---------------- the panel ---------------- */
function destList(a){
  var links=linksOf(a); if(!links.length) return "";
  var max=links[0].women_15_44;
  return "<p class='lead'>Nearest clinics are in</p><ol class='dests'>"+links.map(function(d){
    var on=journey&&isJourney(d);
    return "<li><button type='button' data-o='"+d.origin_abbr+"' data-d='"+d.dest_abbr+"' aria-pressed='"+(on?"true":"false")+"'>"+
      "<span class='r'><span class='d'>"+d.dest_state+"</span><span class='n'>"+ns.M(d.women_15_44)+"</span></span>"+
      "<span class='bar'><i style='width:"+Math.max(3,d.women_15_44/max*100)+"%'></i></span>"+
      "<small>"+d.counties+" "+(d.counties===1?"county":"counties")+"</small></button></li>";
  }).join("")+"</ol>";
}
function profile(){
  var el=document.getElementById("catch-profile"); if(!el) return;
  var h="";
  if(journey){
    h+="<div class='jroute'><p class='od'>"+journey.origin_state+"<span class='ar'>→</span>"+journey.dest_state+"</p>"+
       "<div class='big-n'>"+ns.M(journey.women_15_44)+"</div>"+
       "<p class='sub'>women aged 15–44 in "+journey.counties+" "+(journey.counties===1?"county":"counties")+
       "</p></div>";
  }
  if(!selected){
    var topR=D.recv.slice().sort(function(a,b){return b.incoming_women-a.incoming_women;}).slice(0,4);
    var mx=topR[0]?topR[0].incoming_women:1;
    h+="<div class='big-n'>"+ns.M(C.crossing_women)+"</div>"+
      "<p class='sub'>women aged 15–44 whose nearest open clinic is in another state, "+
      C.crossing_pct.toFixed(1)+"% of those the data cover</p>"+
      "<p class='lead'>Largest catchments drawn from elsewhere</p><ol class='dests'>"+
      topR.map(function(d){ return "<li><button type='button' data-sel='"+d.abbr+"'>"+
        "<span class='r'><span class='d'>"+d.name+"</span><span class='n'>"+ns.M(d.incoming_women)+"</span></span>"+
        "<span class='bar'><i style='width:"+Math.max(3,d.incoming_women/mx*100)+"%'></i></span></button></li>"; }).join("")+
      "</ol><p class='hint'>Select a state on the map for its own connections.</p>";
  } else {
    var r=byAbbr[selected], known=r.in_source_tables===1;
    h+="<h4>"+r.name+"</h4><p class='sub'>"+
      (known?ns.fmt(r.outgoing_women)+" residents&rsquo; nearest clinic is in another state":"not in the supplied state tables")+
      "</p>"+destList(selected);
    if(!linksOf(selected).length) h+="<p class='hint'>No county here has its nearest clinic in another state.</p>";
    h+="<details class='more'><summary>All figures for "+r.name+"</summary><table>"+
      row("Open clinics",known?(r.clinics_jul2026+" <span style='color:var(--ink-3)'>(May 2022: "+r.clinics_may2022+")</span>"):"not available")+
      row("Residents served in this state",ns.fmt(r.retained_women))+
      row("Arriving from other states",ns.fmt(r.incoming_women)+
        (r.incoming_origin_states?" <span style='color:var(--ink-3)'>("+r.incoming_origin_states+" state"+(r.incoming_origin_states===1?"":"s")+")</span>":""))+
      row("Total assigned catchment",ns.fmt(r.assigned_women||0))+
      row("Per open clinic",r.assigned_per_clinic!=null?ns.fmt(Math.round(r.assigned_per_clinic)):"not available")+
      "</table></details>";
  }
  el.innerHTML=h;
  el.querySelectorAll("ol.dests button[data-d]").forEach(function(b){
    b.onclick=function(){ var d=cross.filter(function(x){return x.origin_abbr===b.dataset.o&&x.dest_abbr===b.dataset.d;})[0];
      if(d) play(d); };
  });
  el.querySelectorAll("ol.dests button[data-sel]").forEach(function(b){
    b.onclick=function(){ select(b.dataset.sel); };
  });
}
function row(k,v){ return "<tr><td>"+k+"</td><td>"+v+"</td></tr>"; }

/* ---------------- selection ---------------- */
function select(abbr){
  stopJourney();
  selected=(abbr===selected?null:abbr)||null;
  render();
}
ns.onCounty(function(f){
  var r=ns.countyRow(f);
  stopJourney();
  if(r&&byAbbr[r.state_abbr]){ threadState=r.state_abbr; selected=r.state_abbr; render(); }
  else { if(threadState&&selected===threadState) selected=null; threadState=null; render(); }
});
d3.select("#catch-reset").on("click",function(){ showAll=false; stopJourney(); selected=null; render(); });
d3.selectAll(".pick .chip[data-state]").on("click",function(){ select(this.dataset.state); });
shapes.on("click",function(e,f){ select(byName[f.properties.name].abbr); })
  .on("mousemove",function(e,f){
    var r=byName[f.properties.name];
    ns.tip(e,"<div class='t'>"+r.name+"</div>"+
      "<span class='k'>clinics, Jul 2026</span> "+ns.na(r.clinics_jul2026)+"<br>"+
      "<span class='k'>own residents served here</span> "+ns.M(r.retained_women)+"<br>"+
      "<span class='k'>from other states</span> "+ns.M(r.incoming_women)+"<br>"+
      "<span class='k'>residents served elsewhere</span> "+ns.M(r.outgoing_women)+"<br><span class='k'>click to select</span>");
  }).on("mouseleave",ns.hideTip);
dcG.on("click",function(){ select("DC"); });

/* legend: roles, then the band scale */
var lg=d3.select("#catch-legend").html("");
lg.append("span").html("<i class='sw' style='background:var(--pol-1)'></i>Origin / no clinic left");
lg.append("span").html("<i class='sw' style='background:var(--pol-7)'></i>Destination");
lg.append("span").html("<i class='sw ring'></i>Circle area = catchment per clinic");
var ls=lg.append("span").append("svg").attr("width",236).attr("height",24)
  .attr("aria-label","Band width legend: width at the wide end is proportional to women aged 15 to 44");
[[500000,"0.5M"],[2000000,"2M"],[4500000,"4.5M women"]].forEach(function(v,i){
  var x0=i*66, h=wpx(v[0])/2;
  ls.append("path").attr("d","M"+x0+","+(12-h)+"L"+(x0+22)+",12L"+x0+","+(12+h)+"Z")
    .attr("fill","var(--conn)").attr("fill-opacity",.65);
  ls.append("text").attr("x",x0+26).attr("y",16).attr("font-size",12).attr("fill","var(--ink-2)").text(v[1]);
});

render();
};
