/* VIEW D (novel): the catchment map + receiving-state profile.
   Arrows run from a home state to the state holding the nearest open clinic for some of its
   counties (county assignments added up by state, July 2026). Width is linear in women 15-44.
   Revised from the original ribbon map: arrows show direction, the width scale is linear with a
   legend, the overview threshold is disclosed, a selected jurisdiction shows all of its links
   (incoming or outgoing), DC is kept, and a profile panel summarises the selection. */
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

var state={sel:"KS",dir:"in"};

function arrow(d,color){
  var a=cen[d.origin_abbr], b=cen[d.dest_abbr], w=wpx(d.women_15_44);
  var mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2, dx=b[0]-a[0], dy=b[1]-a[1];
  var c=[mx-dy*0.17, my+dx*0.17];                     // same bend as the original ribbons
  var tx=b[0]-c[0], ty=b[1]-c[1], tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
  var head=Math.max(7,w*1.5), half=Math.max(4.5,w*0.95), gap=5;
  var tip=[b[0]-tx*gap,b[1]-ty*gap], base=[tip[0]-tx*head,tip[1]-ty*head];
  return {
    line:"M"+a[0]+","+a[1]+"Q"+c[0]+","+c[1]+" "+base[0]+","+base[1],
    head:"M"+tip[0]+","+tip[1]+"L"+(base[0]-ty*half)+","+(base[1]+tx*half)+"L"+(base[0]+ty*half)+","+(base[1]-tx*half)+"Z",
    w:w, color:color };
}
function drawLinks(links,color){
  var data=links.filter(function(d){ return cen[d.origin_abbr]&&cen[d.dest_abbr]; })
    .sort(function(a,b){ return b.women_15_44-a.women_15_44; })
    .map(function(d){ return Object.assign({},d,arrow(d,color)); });
  var sel=linkG.selectAll("g.lk").data(data,function(d){return d.origin_abbr+">"+d.dest_abbr;});
  sel.exit().remove();
  var en=sel.enter().append("g").attr("class","lk");
  en.append("path").attr("class","ln").attr("fill","none").attr("stroke-linecap","butt");
  en.append("path").attr("class","hd");
  var all=en.merge(sel);
  all.select(".ln").attr("d",function(d){return d.line;}).attr("stroke",function(d){return d.color;})
    .attr("stroke-width",function(d){return d.w;}).attr("stroke-opacity",.75);
  all.select(".hd").attr("d",function(d){return d.head;}).attr("fill",function(d){return d.color;}).attr("fill-opacity",.9);
  all.on("mousemove",function(e,d){
      ns.tip(e,"<div class='t'>"+d.origin_state+" → "+d.dest_state+"</div>"+ns.fmt(d.women_15_44)+
        " women aged 15–44 in "+d.counties+" "+(d.counties===1?"county":"counties")+
        " whose nearest clinic is in "+d.dest_state);
    }).on("mouseleave",ns.hideTip);
  all.order();
  return data;
}

function fillFor(f){
  var r=byName[f.properties.name];
  if(state.sel===null){
    if(r.clinics_jul2026===0) return ["var(--accent)",.22];
    return r.incoming_women>0?["var(--receiver)",.32]:["var(--neutral)",.5];
  }
  if(r.abbr===state.sel) return [state.dir==="in"?"var(--receiver)":"var(--outgoing)",.38];
  var linked=cross.some(function(x){ return state.dir==="in"?(x.dest_abbr===state.sel&&x.origin_abbr===r.abbr):(x.origin_abbr===state.sel&&x.dest_abbr===r.abbr); });
  if(linked) return [state.dir==="in"?"var(--receiver)":"var(--outgoing)",.14];
  return ["var(--neutral)",.5];
}

function render(){
  var s=state.sel, r=s?byAbbr[s]:null;
  shapes.attr("fill",function(f){return fillFor(f)[0];}).attr("fill-opacity",function(f){return fillFor(f)[1];})
    .attr("stroke",function(f){ return byName[f.properties.name].abbr===s?"var(--ink)":"var(--surface-1)"; })
    .attr("stroke-width",function(f){ return byName[f.properties.name].abbr===s?2:1; });
  shapes.filter(function(f){return byName[f.properties.name].abbr===s;}).raise();
  circG.selectAll("*").remove(); labG.selectAll("*").remove();
  var note=document.getElementById("catch-note"), shown;
  if(!s){
    shown=drawLinks(cross.filter(function(d){return d.women_15_44>=MINW;}),"var(--receiver)");
    // receiver circles from the original design, now sized by total assigned catchment per clinic
    var recv=D.recv.filter(function(d){return d.incoming_women>0&&d.clinics_jul2026>0&&cen[d.abbr];});
    var rS=d3.scaleSqrt().domain([0,d3.max(recv,function(d){return d.assigned_per_clinic;})]).range([0,26]);
    circG.selectAll("circle").data(recv).join("circle")
      .attr("cx",function(d){return cen[d.abbr][0];}).attr("cy",function(d){return cen[d.abbr][1];})
      .attr("r",function(d){return rS(d.assigned_per_clinic);})
      .attr("fill","none").attr("stroke","var(--ink)").attr("stroke-width",1.5).attr("pointer-events","none");
    var top=recv.slice().sort(function(a,b){return b.assigned_per_clinic-a.assigned_per_clinic;}).slice(0,4);
    labG.selectAll("text").data(top).join("text")
      .attr("x",function(d){return cen[d.abbr][0];}).attr("y",function(d){return cen[d.abbr][1]-rS(d.assigned_per_clinic)-7;})
      .attr("text-anchor","middle").attr("font-size",13).attr("font-weight",600).attr("fill","var(--ink)")
      .attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3.5).attr("pointer-events","none")
      .text(function(d){return d.abbr+" "+ns.M(d.assigned_per_clinic)+"/clinic";});
    note.innerHTML="Overview: showing <b>"+shown.length+" of "+C.cross_links+"</b> cross-state connections, those with at least "+
      ns.fmt(MINW)+" women aged 15–44 each. Together they represent "+C.overview_share_pct.toFixed(1)+"% of the "+
      ns.M(C.crossing_women)+" women whose nearest clinic is in another state. Circles: total assigned catchment per clinic (area). "+
      "Select a state to see all of its connections, including small ones.";
  } else {
    var links=cross.filter(function(d){ return state.dir==="in"?d.dest_abbr===s:d.origin_abbr===s; });
    shown=drawLinks(links,state.dir==="in"?"var(--receiver)":"var(--outgoing)");
    var sum=d3.sum(links,function(d){return d.women_15_44;});
    note.innerHTML=links.length?
      "Showing all <b>"+links.length+"</b> "+(state.dir==="in"?"incoming":"outgoing")+" connection"+(links.length>1?"s":"")+" for "+r.name+
      " ("+ns.fmt(sum)+" women aged 15–44). Arrows narrower than "+MINPX+" px are drawn at "+MINPX+" px so they stay visible.":
      "No "+(state.dir==="in"?"other state's counties have their nearest clinic in ":"counties have a nearest clinic outside ")+r.name+
      ". Try "+(state.dir==="in"?"Outgoing":"Incoming")+".";
  }
  desc.text(note.textContent);
  profile();
  ns.currentState=s;
  ns.emit("state-selected",s);
}

function row(k,v){ return "<tr><td>"+k+"</td><td>"+v+"</td></tr>"; }
function profile(){
  var el=document.getElementById("catch-profile"), s=state.sel;
  if(!s){
    var topR=D.recv.slice().sort(function(a,b){return b.incoming_women-a.incoming_women;}).slice(0,6);
    el.innerHTML="<h4>All states</h4><p class='sub'>July 2026 clinic and nearest-clinic data</p><table>"+
      row("Women whose nearest clinic is in another state",ns.fmt(C.crossing_women))+
      row("Share of covered women aged 15–44",C.crossing_pct.toFixed(1)+"%")+
      row("Cross-state connections",C.cross_links)+"</table>"+
      "<p class='sub' style='margin-top:14px'>Largest incoming catchments</p><ol>"+
      topR.map(function(d){return "<li>"+d.name+" <span>"+ns.M(d.incoming_women)+"</span></li>";}).join("")+"</ol>";
    return;
  }
  var r=byAbbr[s], known=r.in_source_tables===1;
  var inL=cross.filter(function(d){return d.dest_abbr===s;}).sort(function(a,b){return b.women_15_44-a.women_15_44;});
  var outL=cross.filter(function(d){return d.origin_abbr===s;}).sort(function(a,b){return b.women_15_44-a.women_15_44;});
  var list=state.dir==="in"?inL:outL;
  var tot=r.assigned_women||0;
  var h="<h4>"+r.name+"</h4><p class='sub'>July 2026 clinic and nearest-clinic data</p><table>"+
    row("Open clinics",known?(r.clinics_jul2026+" <span style='color:var(--ink-3)'>(May 2022: "+r.clinics_may2022+")</span>"):"not in supplied data")+
    row("Retained local catchment",ns.fmt(r.retained_women))+
    row("Incoming catchment",ns.fmt(r.incoming_women)+(r.incoming_origin_states?" <span style='color:var(--ink-3)'>("+r.incoming_origin_states+(r.incoming_origin_states===1?" state, ":" states, ")+r.incoming_counties+(r.incoming_counties===1?" county)":" counties)")+"</span>":""))+
    row("Total assigned catchment",ns.fmt(tot))+
    row("Per open clinic",r.assigned_per_clinic!=null?ns.fmt(Math.round(r.assigned_per_clinic)):"not available")+
    row("Residents with nearest clinic elsewhere",known?ns.fmt(r.outgoing_women):"not in supplied data")+"</table>";
  if(tot>0) h+="<div class='bar' role='img' aria-label='Retained "+ns.fmt(r.retained_women)+", incoming "+ns.fmt(r.incoming_women)+"'>"+
    "<span style='width:"+(r.retained_women/tot*100)+"%;background:var(--retained)'></span>"+
    "<span style='width:"+(r.incoming_women/tot*100)+"%;background:var(--receiver)'></span></div>"+
    "<p class='sub'>grey: retained · blue: incoming</p>";
  h+="<p class='sub' style='margin-top:12px'>"+(state.dir==="in"?"Top origin states":"Top destination states")+"</p>";
  h+=list.length?"<ol>"+list.slice(0,6).map(function(d){
      var who=state.dir==="in"?d.origin_state:d.dest_state;
      return "<li>"+who+" <span>"+ns.M(d.women_15_44)+"</span><br><small style='color:var(--ink-3)'>"+d.counties+" "+(d.counties===1?"county":"counties")+"</small></li>";
    }).join("")+"</ol>":"<p class='sub'>None</p>";
  if(!known) h+="<p class='sub'>DC is not in the supplied state tables, so its clinic count, residents and per-clinic value are unavailable.</p>";
  el.innerHTML=h;
}

function select(abbr){
  state.sel=abbr;
  if(abbr){
    var nIn=cross.filter(function(d){return d.dest_abbr===abbr;}).length;
    var nOut=cross.filter(function(d){return d.origin_abbr===abbr;}).length;
    if(state.dir==="in"&&!nIn&&nOut) setDir("out",true);
    else if(state.dir==="out"&&!nOut&&nIn) setDir("in",true);
  }
  document.getElementById("catch-select").value=abbr||"";
  render();
}
function setDir(d,silent){
  state.dir=d;
  d3.selectAll("#catch-dir button").attr("aria-pressed",function(){ return this.dataset.dir===d; })
    .property("disabled",function(){ return !state.sel; });
  if(!silent) render();
}

// controls
var opts=D.recv.slice().sort(function(a,b){return d3.ascending(a.name,b.name);});
d3.select("#catch-select").selectAll("option").data([{abbr:"",name:"All states (overview)"}].concat(opts)).join("option")
  .attr("value",function(d){return d.abbr;}).text(function(d){return d.name;});
d3.select("#catch-select").on("change",function(){ select(this.value||null); setDir(state.dir,true); });
d3.selectAll("#catch-dir button").on("click",function(){ setDir(this.dataset.dir); });
d3.select("#catch-overview").on("click",function(){ select(null); setDir(state.dir,true); });
shapes.on("click",function(e,f){ select(byName[f.properties.name].abbr); setDir(state.dir,true); })
  .on("mousemove",function(e,f){
    var r=byName[f.properties.name];
    ns.tip(e,"<div class='t'>"+r.name+"</div>"+
      "<span class='k'>clinics, Jul 2026</span> "+ns.na(r.clinics_jul2026)+"<br>"+
      "<span class='k'>retained</span> "+ns.M(r.retained_women)+" · <span class='k'>incoming</span> "+ns.M(r.incoming_women)+"<br>"+
      "<span class='k'>nearest clinic elsewhere</span> "+ns.M(r.outgoing_women)+"<br><span class='k'>click to select</span>");
  }).on("mouseleave",ns.hideTip);
dcG.on("click",function(){ select("DC"); setDir(state.dir,true); });
ns.on("select-state",function(abbr){ select(abbr); setDir(state.dir,true);
  document.getElementById("fig-catch").scrollIntoView({behavior:"smooth",block:"start"}); });

// width legend (linear)
var lg=d3.select("#catch-legend").html("");
lg.append("span").html("<i class='sw' style='background:var(--receiver)'></i>Incoming");
lg.append("span").html("<i class='sw' style='background:var(--outgoing)'></i>Outgoing");
var ls=lg.append("span").append("svg").attr("width",250).attr("height",26).attr("aria-label","Arrow width legend");
[[100000,"100k"],[1000000,"1M"],[4000000,"4M women"]].forEach(function(v,i){
  var x0=i*70;
  ls.append("line").attr("x1",x0).attr("x2",x0+26).attr("y1",13).attr("y2",13)
    .attr("stroke","var(--ink-3)").attr("stroke-width",wpx(v[0]));
  ls.append("text").attr("x",x0+30).attr("y",17).attr("font-size",11.5).attr("fill","var(--ink-2)").text(v[1]);
});
lg.append("span").text("width ∝ women aged 15–44 (linear)");

select("KS"); setDir("in",true);
};
