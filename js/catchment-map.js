/* VIEW D (novel): the catchment map + state profile.
   Arrows run from a home state to the state holding the nearest open clinic for some of its
   counties (county assignments added up by state, July 2026). Width is linear in women 15-44.

   Revised Nov 2026: the incoming/outgoing toggle and the jurisdiction dropdown are gone. They
   asked the reader to hold two directions in mind at once, and "outgoing" was easy to misread as
   people leaving a state that still has clinics. The map now has one view, the overview of every
   state, and clicking a state highlights it and fills the profile panel on the right.

   Colour: ochre for states with no clinic left, violet for states that are the nearest option for
   another state's residents. Deliberately not red/blue, which read as party colours on a US map. */
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
var wScale=d3.scaleLinear().domain([0,maxW]).range([0,18]);   // linear: width proportional to women
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

function arrow(d){
  var a=cen[d.origin_abbr], b=cen[d.dest_abbr], w=wpx(d.women_15_44);
  var mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2, dx=b[0]-a[0], dy=b[1]-a[1];
  var c=[mx-dy*0.17, my+dx*0.17];
  var tx=b[0]-c[0], ty=b[1]-c[1], tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
  var head=Math.max(7,w*1.5), half=Math.max(4.5,w*0.95), gap=5;
  var tip=[b[0]-tx*gap,b[1]-ty*gap], base=[tip[0]-tx*head,tip[1]-ty*head];
  return {
    line:"M"+a[0]+","+a[1]+"Q"+c[0]+","+c[1]+" "+base[0]+","+base[1],
    head:"M"+tip[0]+","+tip[1]+"L"+(base[0]-ty*half)+","+(base[1]+tx*half)+"L"+(base[0]+ty*half)+","+(base[1]-tx*half)+"Z",
    w:w };
}
function touches(d){ return selected && (d.origin_abbr===selected || d.dest_abbr===selected); }
function drawLinks(){
  // the overview set is always drawn; selecting a state adds its own links, however small
  var set={}, data=[];
  function add(d){ var k=d.origin_abbr+">"+d.dest_abbr; if(set[k]) return; set[k]=1; data.push(d); }
  overview.forEach(add);
  if(selected) cross.filter(touches).forEach(add);
  data=data.filter(function(d){ return cen[d.origin_abbr]&&cen[d.dest_abbr]; })
    .sort(function(a,b){ return b.women_15_44-a.women_15_44; })
    .map(function(d){ return Object.assign({},d,arrow(d)); });
  var s=linkG.selectAll("g.lk").data(data,function(d){return d.origin_abbr+">"+d.dest_abbr;});
  s.exit().remove();
  var en=s.enter().append("g").attr("class","lk");
  en.append("path").attr("class","ln").attr("fill","none").attr("stroke-linecap","butt");
  en.append("path").attr("class","hd");
  var all=en.merge(s);
  function op(d){ return !selected?0.72:(touches(d)?0.95:0.10); }
  all.select(".ln").attr("d",function(d){return d.line;}).attr("stroke","var(--pol-7)")
    .attr("stroke-width",function(d){return d.w;}).attr("stroke-opacity",op);
  all.select(".hd").attr("d",function(d){return d.head;}).attr("fill","var(--pol-7)").attr("fill-opacity",op);
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
      ns.M(C.crossing_women)+" women whose nearest clinic is in another state. Circles: total assigned catchment per clinic (area). "+
      "<b>Click any state</b> for its own figures, including connections too small to draw here.";
  } else {
    var r=byAbbr[selected], mine=shown.filter(touches);
    note.innerHTML="<b>"+r.name+"</b> selected: "+mine.length+" cross-state connection"+(mine.length===1?"":"s")+
      " drawn. Use <b>Show all states</b> above, or click it again, to go back. Arrows narrower than "+MINPX+
      " px are drawn at "+MINPX+" px so they stay visible.";
  }
  var rb=document.getElementById("catch-reset");
  if(rb) rb.disabled=!selected;
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
    "<p class='sub'>grey: this state&rsquo;s own residents &middot; violet: residents of other states</p>";
  h+=list(inL,"Where its incoming catchment comes from","in");
  h+=list(outL,"Where its residents&rsquo; nearest clinics are","out");
  if(!known) h+="<p class='sub'>DC is not in the supplied state tables, so its clinic count, residents, and per-clinic value are unavailable.</p>";
  el.innerHTML=h;
}

function select(abbr){ selected=(abbr===selected?null:abbr)||null; render(); }
d3.select("#catch-reset").on("click",function(){ select(null); });
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
var ls=lg.append("span").append("svg").attr("width",250).attr("height",26).attr("aria-label","Arrow width legend");
[[100000,"100k"],[1000000,"1M"],[4000000,"4M women"]].forEach(function(v,i){
  var x0=i*70;
  ls.append("line").attr("x1",x0).attr("x2",x0+26).attr("y1",13).attr("y2",13)
    .attr("stroke","var(--ink-3)").attr("stroke-width",wpx(v[0]));
  ls.append("text").attr("x",x0+30).attr("y",17).attr("font-size",11.5).attr("fill","var(--ink-2)").text(v[1]);
});
lg.append("span").text("arrow width ∝ women aged 15–44 (linear)");

render();
};
