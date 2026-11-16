/* VIEW D (novel): the catchment map + state profile.
   Arrows run from a home state to the state holding the nearest open clinic for some of its
   counties (county assignments added up by state, July 2026). Width is linear in women 15-44.

   Revised Nov 2026: the incoming/outgoing toggle and the jurisdiction dropdown are gone. They
   asked the reader to hold two directions in mind at once, and "outgoing" was easy to misread as
   people leaving a state that still has clinics. The map now has one view, the overview of every
   state, and clicking a state highlights it and fills the profile panel on the right.

   Colour: Saffron for states with no clinic left, Ivy for states that are the nearest option for
   another state's residents, Indigo for the connections themselves. Deliberately not red/blue,
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
var overview=cross.filter(function(d){ return d.women_15_44>=MINW; });

var maxW=d3.max(cross,function(d){return d.women_15_44;});
var wScale=d3.scaleLinear().domain([0,maxW]).range([0,13]);   // linear: width proportional to women
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

var selected=null;   // null = overview of every state
var journey=null;    // the one link being traced, or null
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function isJourney(d){ return !!journey&&d.origin_abbr===journey.origin_abbr&&d.dest_abbr===journey.dest_abbr; }
/* Which connection the journey button offers: the county's own crossing if one is
   chosen, otherwise the biggest link touching the selected state, otherwise the
   biggest cross-state link there is. */
function journeyPick(){
  var t=threadInfo();
  if(t&&t.cross){
    var own=cross.filter(function(d){return d.origin_abbr===t.row.state_abbr&&d.dest_abbr===t.dest;})[0];
    if(own) return own;
  }
  var pool=selected?cross.filter(touches):cross;
  return pool.slice().sort(function(a,b){return b.women_15_44-a.women_15_44;})[0]||null;
}
var threadState=null;   // the state the "your county" selection chose, so clearing the county can undo it

/* "your county": the arrow from its state to the state of its nearest clinic, or null */
function threadInfo(){
  var r=ns.countyRow(ns.county); if(!r) return null;
  var dest=r.nearest_provider_state, same=dest!=null&&dest===r.state_abbr;
  return {row:r, dest:dest, same:same, cross:dest!=null&&!same&&!!byAbbr[dest]};
}
function hot(d){ var t=threadInfo(); return !!(t&&t.cross&&d.origin_abbr===t.row.state_abbr&&d.dest_abbr===t.dest); }
function ribbon(d){
  // Same bow as the old arrow. The band is full width at the origin and closes to a
  // point at the destination, so direction is carried by the shape, not an arrowhead.
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
function touches(d){ return selected && (d.origin_abbr===selected || d.dest_abbr===selected); }
function drawLinks(){
  // the overview set is always drawn; selecting a state adds its own links, however small
  var set={}, data=[];
  function add(d){ var k=d.origin_abbr+">"+d.dest_abbr; if(set[k]) return; set[k]=1; data.push(d); }
  overview.forEach(add);
  if(selected) cross.filter(touches).forEach(add);
  cross.filter(hot).forEach(add);
  data=data.filter(function(d){ return cen[d.origin_abbr]&&cen[d.dest_abbr]; })
    .sort(function(a,b){ return b.women_15_44-a.women_15_44; })
    .map(function(d){ return Object.assign({},d,ribbon(d)); });
  var s=linkG.selectAll("g.lk").data(data,function(d){return d.origin_abbr+">"+d.dest_abbr;});
  s.exit().remove();
  var en=s.enter().append("g").attr("class","lk");
  en.append("path").attr("class","ln");
  var all=en.merge(s);
  function op(d){
    if(journey&&!isJourney(d)) return 0.06;      // tracing one journey mutes the rest
    if(journey) return 0.95;
    return hot(d)?0.95:!selected?0.6:(touches(d)?0.9:0.08);
  }
  all.select(".ln").attr("d",function(d){return d.area;}).attr("fill","var(--conn)")
    .attr("fill-opacity",op)
    .attr("stroke","var(--ink)")
    .attr("stroke-width",function(d){return hot(d)||isJourney(d)?1.4:0;})
    .attr("stroke-opacity",function(d){return hot(d)||isJourney(d)?0.85:0;});
  all.on("mousemove",function(e,d){
      ns.tip(e,"<div class='t'>"+d.origin_state+" → "+d.dest_state+"</div>"+ns.fmt(d.women_15_44)+
        " women aged 15–44 in "+d.counties+" "+(d.counties===1?"county":"counties")+
        " whose nearest clinic is in "+d.dest_state);
    }).on("mouseleave",ns.hideTip);
  all.order();
  return data;
}

/* role of each state, independent of what is selected */
function role(r){
  if(r.clinics_jul2026===0) return "none";          // no open clinic left in the state
  if(r.incoming_women>0)    return "serves";        // nearest option for another state's residents
  return "other";
}
var ROLE={none:"var(--pol-1)", serves:"var(--pol-7)", other:"var(--neutral)"};
function fillFor(f){
  var r=byName[f.properties.name], k=role(r), base=k==="other"?0.5:(k==="none"?0.3:0.34);
  if(!selected) return [ROLE[k],base];
  if(r.abbr===selected) return [ROLE[k],0.62];
  var linked=cross.some(function(x){ return (x.dest_abbr===selected&&x.origin_abbr===r.abbr)||
                                            (x.origin_abbr===selected&&x.dest_abbr===r.abbr); });
  return [ROLE[k], linked?base+0.1:base*0.4];
}

function render(){
  shapes.attr("fill",function(f){return fillFor(f)[0];}).attr("fill-opacity",function(f){return fillFor(f)[1];})
    .attr("stroke",function(f){ return byName[f.properties.name].abbr===selected?"var(--ink)":"var(--surface-1)"; })
    .attr("stroke-width",function(f){ return byName[f.properties.name].abbr===selected?2:1; });
  shapes.filter(function(f){return byName[f.properties.name].abbr===selected;}).raise();
  circG.selectAll("*").remove(); labG.selectAll("*").remove();
  var shown=drawLinks();
  var note=document.getElementById("catch-note");

  // circles on the receiving states, area = total assigned catchment per clinic
  var recv=D.recv.filter(function(d){return d.incoming_women>0&&d.clinics_jul2026>0&&cen[d.abbr];});
  var rS=d3.scaleSqrt().domain([0,d3.max(recv,function(d){return d.assigned_per_clinic;})]).range([0,26]);
  circG.selectAll("circle").data(recv).join("circle")
    .attr("cx",function(d){return cen[d.abbr][0];}).attr("cy",function(d){return cen[d.abbr][1];})
    .attr("r",function(d){return rS(d.assigned_per_clinic);})
    .attr("fill","none").attr("stroke","var(--ink)").attr("stroke-width",1.5)
    .attr("stroke-opacity",function(d){ return !selected||d.abbr===selected?1:0.25; })
    .attr("pointer-events","none");
  var top=recv.slice().sort(function(a,b){return b.assigned_per_clinic-a.assigned_per_clinic;}).slice(0,4);
  labG.selectAll("text").data(top).join("text")
    .attr("x",function(d){return cen[d.abbr][0];}).attr("y",function(d){return cen[d.abbr][1]-rS(d.assigned_per_clinic)-7;})
    .attr("text-anchor","middle").attr("font-size",13).attr("font-weight",600).attr("fill","var(--ink)")
    .attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3.5).attr("pointer-events","none")
    .attr("opacity",function(d){ return !selected||d.abbr===selected?1:0.3; })
    .text(function(d){return d.abbr+" "+ns.M(d.assigned_per_clinic)+"/clinic";});

  if(!selected){
    note.innerHTML="Showing <b>"+overview.length+" of "+C.cross_links+"</b> cross-state connections, those with at least "+
      ns.fmt(MINW)+" women aged 15–44 each. Together they represent "+C.overview_share_pct.toFixed(1)+"% of the "+
      ns.M(C.crossing_women)+" women whose nearest clinic is in another state. Each band is widest where the women live and "+
      "narrows to the state holding their nearest clinic. Circles: total assigned catchment per clinic (area). "+
      "<b>Click any state</b> for its own figures, including connections too small to draw here.";
  } else {
    var r=byAbbr[selected], mine=shown.filter(touches);
    note.innerHTML="<b>"+r.name+"</b> selected: "+mine.length+" cross-state connection"+(mine.length===1?"":"s")+
      " drawn, including any below the overview threshold. Use <b>Show all states</b> above, or click it again, "+
      "to go back. Bands thinner than "+MINPX+" px are drawn at "+MINPX+" px so they stay visible.";
  }
  var rb=document.getElementById("catch-reset");
  if(rb) rb.disabled=!selected&&!journey;
  journeyButton();
  var t=threadInfo();
  if(t){
    var nm=t.row.label;
    note.innerHTML+=" <b>"+nm+"</b>: "+(t.dest==null?"the state of its nearest clinic is not available."
      :t.same?"its nearest clinic is in the same state ("+t.row.state+"), so there is no cross-state arrow for it."
      :t.cross?"its nearest clinic is in "+byAbbr[t.dest].name+"; the band from "+t.row.state+" to "+byAbbr[t.dest].name+" is outlined, and <b>Trace</b> follows it."
      :"its nearest clinic is in "+t.dest+".");
  }
  desc.text(note.textContent);
  profile();
}

function row(k,v){ return "<tr><td>"+k+"</td><td>"+v+"</td></tr>"; }
function list(items,label,dir){
  if(!items.length) return "<p class='sub' style='margin-top:12px'>"+label+": none</p>";
  return "<p class='sub' style='margin-top:12px'>"+label+"</p><ol>"+items.slice(0,5).map(function(d){
    var who=dir==="in"?d.origin_state:d.dest_state;
    return "<li>"+who+" <span>"+ns.M(d.women_15_44)+"</span><br><small style='color:var(--ink-3)'>"+
      d.counties+" "+(d.counties===1?"county":"counties")+"</small></li>";
  }).join("")+"</ol>";
}
function profile(){
  var el=document.getElementById("catch-profile");
  if(!selected){
    var topR=D.recv.slice().sort(function(a,b){return b.incoming_women-a.incoming_women;}).slice(0,6);
    el.innerHTML="<h4>All states</h4><p class='sub'>July 2026 clinic and nearest-clinic data</p><table>"+
      row("Women whose nearest clinic is in another state",ns.fmt(C.crossing_women))+
      row("Share of covered women aged 15–44",C.crossing_pct.toFixed(1)+"%")+
      row("Cross-state connections",C.cross_links)+"</table>"+
      "<p class='sub' style='margin-top:14px'>Largest catchments drawn from other states</p><ol>"+
      topR.map(function(d){return "<li>"+d.name+" <span>"+ns.M(d.incoming_women)+"</span></li>";}).join("")+"</ol>"+
      "<p class='sub' style='margin-top:14px'>Click a state on the map to see its own figures.</p>";
    return;
  }
  var r=byAbbr[selected], known=r.in_source_tables===1;
  var inL=cross.filter(function(d){return d.dest_abbr===selected;}).sort(function(a,b){return b.women_15_44-a.women_15_44;});
  var outL=cross.filter(function(d){return d.origin_abbr===selected;}).sort(function(a,b){return b.women_15_44-a.women_15_44;});
  var tot=r.assigned_women||0;
  var h="<h4>"+r.name+"</h4><p class='sub'>July 2026 clinic and nearest-clinic data</p><table>"+
    row("Open clinics",known?(r.clinics_jul2026+" <span style='color:var(--ink-3)'>(May 2022: "+r.clinics_may2022+")</span>"):"not in supplied data")+
    row("Residents whose nearest clinic is in this state",ns.fmt(r.retained_women))+
    row("Residents of other states whose nearest clinic is here",ns.fmt(r.incoming_women)+
        (r.incoming_origin_states?" <span style='color:var(--ink-3)'>("+r.incoming_origin_states+(r.incoming_origin_states===1?" state, ":" states, ")+r.incoming_counties+(r.incoming_counties===1?" county)":" counties)")+"</span>":""))+
    row("Total assigned catchment",ns.fmt(tot))+
    row("Per open clinic",r.assigned_per_clinic!=null?ns.fmt(Math.round(r.assigned_per_clinic)):"not available")+
    row("Residents whose nearest clinic is in another state",known?ns.fmt(r.outgoing_women):"not in supplied data")+"</table>";
  if(tot>0) h+="<div class='bar' role='img' aria-label='Own residents "+ns.fmt(r.retained_women)+", from other states "+ns.fmt(r.incoming_women)+"'>"+
    "<span style='width:"+(r.retained_women/tot*100)+"%;background:var(--retained)'></span>"+
    "<span style='width:"+(r.incoming_women/tot*100)+"%;background:var(--pol-7)'></span></div>"+
    "<p class='sub'>pale: this state&rsquo;s own residents &middot; green: residents of other states</p>";
  h+=list(inL,"Where its incoming catchment comes from","in");
  h+=list(outL,"Where its residents&rsquo; nearest clinics are","out");
  if(!known) h+="<p class='sub'>DC is not in the supplied state tables, so its clinic count, residents, and per-clinic value are unavailable.</p>";
  el.innerHTML=h;
}

/* One marker, one connection, on request. Nothing autoplays and nothing loops. */
function stopJourney(keepSelection){
  carG.selectAll("*").interrupt(); carG.html("");
  if(!keepSelection) journey=null;
}
function journeyLine(d,arrived){
  var el=document.getElementById("catch-journey-line"); if(!el) return;
  el.innerHTML=d?("<b>"+d.origin_state+" &rarr; "+d.dest_state+"</b> &middot; "+ns.fmt(d.women_15_44)+
    " women aged 15\u201344 in "+d.counties+" "+(d.counties===1?"county":"counties")+
    " whose nearest open clinic is in "+d.dest_state+
    (arrived?" &middot; <span style='color:var(--ink-3)'>schematic curve between state centres, not a driving route</span>":"")):"";
}
function playJourney(){
  var d=journeyPick();
  if(!d||!cen[d.origin_abbr]||!cen[d.dest_abbr]) return;
  journey=d; stopJourney(true); render();
  var track=carG.append("path").attr("d",d.mid).attr("fill","none").attr("stroke","none");
  var node=track.node();
  var ok=node&&typeof node.getTotalLength==="function"&&typeof node.getPointAtLength==="function";
  var end=cen[d.dest_abbr];
  var car=carG.append("g");
  car.append("rect").attr("x",-6.5).attr("y",-3.2).attr("width",13).attr("height",6.4).attr("rx",2.2)
    .attr("fill","var(--ink)").attr("stroke","var(--surface-1)").attr("stroke-width",1.4);
  function arrive(){
    carG.append("circle").attr("cx",end[0]).attr("cy",end[1]).attr("r",7)
      .attr("fill","none").attr("stroke","var(--pol-7)").attr("stroke-width",2.5)
      .call(function(c){ if(reduce) return c.attr("r",16).attr("stroke-opacity",.55);
        c.transition().duration(620).ease(d3.easeCubicOut)
         .attr("r",20).attr("stroke-opacity",0).remove(); });
    carG.append("circle").attr("cx",end[0]).attr("cy",end[1]).attr("r",5)
      .attr("fill","var(--pol-7)").attr("stroke","var(--surface-1)").attr("stroke-width",2);
    journeyLine(d,true);
  }
  if(!ok||reduce){ car.attr("transform","translate("+end[0]+","+end[1]+")"); arrive(); return; }
  var total=node.getTotalLength();
  journeyLine(d,false);
  car.transition().duration(2200).ease(d3.easeCubicInOut)
    .attrTween("transform",function(){
      return function(t){
        var pt=node.getPointAtLength(total*t),
            pr=node.getPointAtLength(Math.max(0,total*t-4));
        return "translate("+pt.x+","+pt.y+") rotate("+(Math.atan2(pt.y-pr.y,pt.x-pr.x)*180/Math.PI)+")";
      };
    }).on("end",arrive);
}
function journeyButton(){
  var b=document.getElementById("catch-journey"); if(!b) return;
  var d=journeyPick();
  b.disabled=!d;
  b.textContent=d?((journey&&isJourney(d)?"Replay ":"Trace ")+d.origin_abbr+" \u2192 "+d.dest_abbr):"No connection to trace";
}

function select(abbr){ stopJourney(); journeyLine(null); selected=(abbr===selected?null:abbr)||null; render(); }
// the county thread selects its state (never toggles it off), and undoes only that choice when cleared
ns.onCounty(function(f){
  var r=ns.countyRow(f);
  stopJourney(); journeyLine(null);
  if(r&&byAbbr[r.state_abbr]){ threadState=r.state_abbr; selected=r.state_abbr; render(); }
  else { if(threadState&&selected===threadState) selected=null; threadState=null; render(); }
});
d3.select("#catch-reset").on("click",function(){ select(null); });
d3.select("#catch-journey").on("click",playJourney);
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

// legend: roles, then the linear width scale
var lg=d3.select("#catch-legend").html("");
lg.append("span").html("<i class='sw' style='background:var(--pol-1)'></i>No open clinic left in the state");
lg.append("span").html("<i class='sw' style='background:var(--pol-7)'></i>Nearest option for another state&rsquo;s residents");
lg.append("span").html("<i class='sw' style='background:var(--neutral)'></i>Neither");
var ls=lg.append("span").append("svg").attr("width",262).attr("height",26)
  .attr("aria-label","Band width legend: width at the wide end is proportional to women aged 15 to 44");
[[100000,"100k"],[1000000,"1M"],[4000000,"4M women"]].forEach(function(v,i){
  var x0=i*74, h=wpx(v[0])/2;
  ls.append("path").attr("d","M"+x0+","+(13-h)+"L"+(x0+26)+",13L"+x0+","+(13+h)+"Z")
    .attr("fill","var(--conn)").attr("fill-opacity",.7);
  ls.append("text").attr("x",x0+30).attr("y",17).attr("font-size",11.5).attr("fill","var(--ink-2)").text(v[1]);
});
lg.append("span").text("band width at the wide end \u221d women aged 15\u201344; it narrows toward the clinic state");

render();
};
