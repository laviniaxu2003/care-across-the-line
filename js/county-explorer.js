/* VIEW C: linked county map + scatterplot, adapted from the team's Milestone 6 dashboard.
   x = change in road miles to the nearest clinic (May 2022 -> July 2026); y = OB-GYNs per 10,000
   women 15-44 (2023, square-root scale). Map: 3x3 categories of the same two measures.
   Geometry: us-atlas 3.0.1 counties-albers-10m (Census 2017 boundaries, pre-projected). */
window.CATL = window.CATL || {};
window.CATL.countyExplorer = function(rows, topo, head){
"use strict";
var ns=window.CATL;
var byFips={}; rows.forEach(function(d){ byFips[d.fips]=d; d.label=d.county+", "+d.state_abbr; });
var plotted=rows.filter(function(d){ return d.drive_miles_change!=null && d.obgyn_per_10k_women!=null; });
var feats=topojson.feature(topo, topo.objects.counties).features;
var stateMesh=topojson.mesh(topo, topo.objects.states, function(a,b){return a!==b;});
var nation=topojson.feature(topo, topo.objects.nation);
var st={metro:"all", hl:true, sel:null, hover:null, cell:null};
var DIST=["≤0 mi",">0 to <100 mi","≥100 mi"], SUP=["0",">0 to 2.5",">2.5"];
function color(d){ return d&&d.dist_class&&d.supply_class?"var(--b"+d.dist_class+(4-d.supply_class)+")":null; }
function inFilter(d){ return st.metro==="all" || (d.metro!=null && String(d.metro)===st.metro); }
function inCell(d){ return !st.cell || (d.dist_class===st.cell[0] && d.supply_class===st.cell[1]); }
function ctype(d){ return d.metro===1?"Metro":d.metro===0?"Nonmetro":"Unknown (no metro code)"; }

/* ---------------- map ---------------- */
var mapRoot=document.getElementById("county-map");
var msvg=d3.select(mapRoot).append("svg").attr("viewBox","0 0 975 610").attr("role","img")
  .attr("aria-labelledby","cmap-t cmap-d");
msvg.append("title").attr("id","cmap-t").text("County map of distance change and OB-GYN supply categories");
msvg.append("desc").attr("id","cmap-d").text("Counties colored by a 3 by 3 category: change in miles to the nearest abortion clinic and OB-GYNs per 10,000 women. Counts per category are in the legend below the map.");
var pat=msvg.append("defs").append("pattern").attr("id","hatch").attr("patternUnits","userSpaceOnUse")
  .attr("width",5).attr("height",5).attr("patternTransform","rotate(45)");
pat.append("rect").attr("width",5).attr("height",5).attr("fill","var(--surface-1)");
pat.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",5).attr("stroke","var(--ink-3)").attr("stroke-width",1.4);
var path=d3.geoPath();
msvg.append("path").datum(nation).attr("d",path).attr("fill","var(--surface-2)");
var cpaths=msvg.append("g").selectAll("path").data(feats).join("path").attr("d",path)
  .attr("stroke","none").style("cursor","pointer");
msvg.append("path").datum(stateMesh).attr("d",path).attr("fill","none").attr("stroke","var(--surface-1)")
  .attr("stroke-width",.9).attr("pointer-events","none");
var mapMark=msvg.append("g").attr("pointer-events","none");
function rowOf(f){ return byFips[String(f.id)]; }
function mapFill(){
  cpaths.attr("fill",function(f){ var d=rowOf(f), c=color(d); return c||"url(#hatch)"; })
    .attr("fill-opacity",function(f){ var d=rowOf(f); if(!d||!color(d)) return 1;
      if(!inFilter(d)||!inCell(d)) return .12;
      return st.hl && !st.cell ? (d.inc100_no_obgyn?1:.55) : 1; });
}
function mapMarks(){
  var ids=[st.sel,st.hover].filter(Boolean);
  mapMark.selectAll("path").data(ids.map(function(id){return feats.filter(function(f){return String(f.id)===id;})[0];}).filter(Boolean))
    .join("path").attr("d",path).attr("fill","none").attr("stroke","var(--ink)")
    .attr("stroke-width",function(f){return String(f.id)===st.sel?2.6:1.6;});
}
cpaths.on("mousemove",function(e,f){
    var d=rowOf(f); st.hover=d?d.fips:null; mapMarks(); scatterMarks();
    ns.tip(e,d?tipHtml(d):"<div class='t'>"+(f.properties.name||"")+"</div>No county record in the data");
    if(!st.sel) details(d,"hovered");
  }).on("mouseleave",function(){ st.hover=null; mapMarks(); scatterMarks(); ns.hideTip(); if(!st.sel) details(null); })
  .on("click",function(e,f){ var d=rowOf(f); if(d) select(d.fips===st.sel?null:d.fips); });

/* ---------------- scatter ---------------- */
var scRoot=document.getElementById("county-scatter");
var x,y,dots,marks,delaunay,vis=[],SW,SH,SM;
function drawScatter(){
  scRoot.innerHTML="";
  SW=ns.width(scRoot); var narrow=SW<480; SH=Math.max(300,Math.min(440,Math.round(SW*0.78)));
  SM={t:34,r:12,b:50,l:narrow?44:54};
  x=d3.scaleLinear().domain([-240,800]).range([SM.l,SW-SM.r]);
  y=d3.scaleSqrt().domain([0,80]).range([SH-SM.b,SM.t]);
  var svg=d3.select(scRoot).append("svg").attr("viewBox","0 0 "+SW+" "+SH).attr("role","img")
    .attr("aria-labelledby","csc-t csc-d");
  svg.append("title").attr("id","csc-t").text("Scatterplot of county distance change against OB-GYN supply");
  svg.append("desc").attr("id","csc-d").text(head.overlap.scatter_eligible+" counties. Counties with an increase of at least 100 miles and no OB-GYN are highlighted: "+head.overlap.inc100_no_obgyn+" of them.");
  svg.append("g").attr("transform","translate(0,"+(SH-SM.b)+")")
    .call(d3.axisBottom(x).tickValues(narrow?[-200,0,200,400,600,800]:[-200,-100,0,100,200,300,400,500,600,700,800]).tickSizeOuter(0))
    .call(function(a){ a.selectAll("text").attr("font-size",11).attr("fill","var(--ink-2)"); a.selectAll("line,path").attr("stroke","var(--rule)"); });
  svg.append("g").attr("transform","translate("+SM.l+",0)")
    .call(d3.axisLeft(y).tickValues([0,1,2.5,5,10,20,40,80]).tickFormat(d3.format("~g")).tickSize(-(SW-SM.l-SM.r)))
    .call(function(a){ a.select(".domain").remove(); a.selectAll("line").attr("stroke","var(--rule)").attr("stroke-opacity",.6);
      a.selectAll("text").attr("font-size",11).attr("fill","var(--ink-2)"); });
  svg.append("text").attr("x",(SM.l+SW-SM.r)/2).attr("y",SH-12).attr("text-anchor","middle").attr("font-size",11.5)
    .attr("fill","var(--ink-2)").text(narrow?"change in miles, May 2022 → Jul 2026":"change in road miles to nearest clinic, May 2022 → Jul 2026");
  svg.append("text").attr("x",4).attr("y",12).attr("font-size",11).attr("fill","var(--ink-2)")
    .text(narrow?"OB-GYNs per 10k women, 2023 (sqrt scale)":"OB-GYNs per 10k women 15–44, 2023 (square-root scale)");
  [[0,"no change","end",-4],[100,"+100 mi","start",4]].forEach(function(r){
    svg.append("line").attr("x1",x(r[0])).attr("x2",x(r[0])).attr("y1",SM.t-6).attr("y2",SH-SM.b)
      .attr("stroke","var(--ink-3)").attr("stroke-dasharray","4 3");
    svg.append("text").attr("x",x(r[0])+r[3]).attr("y",SM.t-8).attr("text-anchor",r[2]).attr("font-size",10.5).attr("fill","var(--ink-3)").text(r[1]);
  });
  svg.append("line").attr("x1",SM.l).attr("x2",SW-SM.r).attr("y1",y(2.5)).attr("y2",y(2.5))
    .attr("stroke","var(--ink-3)").attr("stroke-dasharray","2 3").attr("stroke-opacity",.7);
  dots=svg.append("g");
  marks=svg.append("g").attr("pointer-events","none");
  var over=svg.append("rect").attr("x",SM.l).attr("y",SM.t).attr("width",SW-SM.l-SM.r).attr("height",SH-SM.t-SM.b)
    .attr("fill","transparent").style("cursor","crosshair");
  function find(e){ if(!delaunay||!vis.length) return null; var p=d3.pointer(e); var i=delaunay.find(p[0],p[1]);
    var d=vis[i]; return Math.hypot(x(d.drive_miles_change)-p[0],y(d.obgyn_per_10k_women)-p[1])<14?d:null; }
  over.on("pointermove",function(e){ var d=find(e); st.hover=d?d.fips:null; mapMarks(); scatterMarks();
      if(d){ ns.tip(e,tipHtml(d)); if(!st.sel) details(d,"hovered"); } else { ns.hideTip(); if(!st.sel) details(null); } })
    .on("pointerleave",function(){ st.hover=null; mapMarks(); scatterMarks(); ns.hideTip(); if(!st.sel) details(null); })
    .on("click",function(e){ var d=find(e); select(d?(d.fips===st.sel?null:d.fips):null); });
  scatterDots();
}
function scatterDots(){
  vis=plotted.filter(function(d){return inFilter(d);});
  // highlighted subset drawn last so it sits on top
  vis.sort(function(a,b){ return (st.hl?(a.inc100_no_obgyn-b.inc100_no_obgyn):0) || (inCell(a)-inCell(b)); });
  delaunay=d3.Delaunay.from(vis,function(d){return x(d.drive_miles_change);},function(d){return y(d.obgyn_per_10k_women);});
  dots.selectAll("circle").data(vis,function(d){return d.fips;}).join("circle")
    .attr("cx",function(d){return x(d.drive_miles_change);}).attr("cy",function(d){return y(d.obgyn_per_10k_women);})
    .attr("r",2.6)
    .attr("fill",function(d){ if(st.cell) return inCell(d)?color(d):"var(--dot)";
      return st.hl&&d.inc100_no_obgyn?"var(--accent)":"var(--dot)"; })
    .attr("fill-opacity",function(d){ if(st.cell) return inCell(d)?.9:.08;
      return st.hl? (d.inc100_no_obgyn?.75:.22) : .35; })
    .attr("stroke",function(d){ return st.cell&&inCell(d)?"var(--ink)":"none"; }).attr("stroke-width",.4);
  scatterMarks();
}
function scatterMarks(){
  if(!marks) return;
  var ids=[st.sel,st.hover].filter(function(id){ var d=byFips[id]; return d&&d.drive_miles_change!=null&&d.obgyn_per_10k_women!=null; });
  marks.selectAll("circle").data(ids).join("circle")
    .attr("cx",function(id){return x(byFips[id].drive_miles_change);}).attr("cy",function(id){return y(byFips[id].obgyn_per_10k_women);})
    .attr("r",function(id){return id===st.sel?7:6;}).attr("fill","none").attr("stroke","var(--ink)")
    .attr("stroke-width",function(id){return id===st.sel?2.4:1.5;});
}

/* ---------------- shared pieces ---------------- */
function v(n,f,suf){ return n==null?"not available":(f||ns.fmt)(n)+(suf||""); }
function tipHtml(d){
  return "<div class='t'>"+d.county+", "+d.state+"</div>"+
    "<span class='k'>miles, May 2022 → Jul 2026</span> "+v(d.drive_miles_may2022,ns.f1)+" → "+v(d.drive_miles_jul2026,ns.f1)+"<br>"+
    "<span class='k'>change</span> "+v(d.drive_miles_change,d3.format("+,.1f"))+" mi<br>"+
    "<span class='k'>OB-GYNs 2023</span> "+v(d.obgyn)+" ("+v(d.obgyn_per_10k_women,d3.format(",.2f"))+" per 10k)<br>"+
    "<span class='k'>click to keep details</span>";
}
function details(d,tag){
  var el=document.getElementById("county-details");
  if(!d){ el.innerHTML="<p class='counts' style='margin:0'>Select a county on the map or chart, or search by name, to see its details here.</p>"; return; }
  var cat=d.dist_class&&d.supply_class?("Distance change "+DIST[d.dist_class-1]+"; OB-GYN supply "+SUP[d.supply_class-1]+" per 10k"):"Not in a map category: a plotted value is missing";
  el.innerHTML="<h4>"+d.county+", "+d.state+" <span class='flag' style='margin:0 0 0 6px;vertical-align:middle'>"+tag+"</span></h4><dl>"+
    "<dt>Road miles to nearest clinic, May 2022</dt><dd>"+v(d.drive_miles_may2022,ns.f1)+"</dd>"+
    "<dt>Road miles, July 2026</dt><dd>"+v(d.drive_miles_jul2026,ns.f1)+"</dd>"+
    "<dt>Change</dt><dd>"+v(d.drive_miles_change,d3.format("+,.1f"),' mi')+"</dd>"+
    "<dt>Nearest clinic is in (Jul 2026)</dt><dd>"+(d.nearest_provider_state||"not available")+"</dd>"+
    "<dt>OB-GYNs, 2023</dt><dd>"+v(d.obgyn)+"</dd>"+
    "<dt>OB-GYNs per 10,000 women 15–44</dt><dd>"+v(d.obgyn_per_10k_women,d3.format(",.2f"))+"</dd>"+
    "<dt>Hospitals with obstetric care, 2023</dt><dd>"+v(d.ob_hospitals)+"</dd>"+
    "<dt>Women aged 15–44</dt><dd>"+v(d.women_15_44)+"</dd>"+
    "<dt>County type</dt><dd>"+ctype(d)+(d.rural_urban_code!=null?" (USDA code "+d.rural_urban_code+")":"")+"</dd>"+
    "</dl><p class='note' style='margin-top:8px'>"+cat+"</p>";
}
function select(fips){
  st.sel=fips; mapMarks(); scatterMarks();
  details(fips?byFips[fips]:null,"selected");
}

/* matrix legend with counts (updates with the filter) */
function matrix(){
  var el=d3.select("#county-matrix").html("");
  el.append("p").attr("class","counts").style("margin","10px 0 0").html("<b>Categories</b> (counties in the current filter; click a cell to emphasise it)");
  var m=el.append("div").attr("class","matrix").attr("role","group").attr("aria-label","Category legend");
  [3,2,1].forEach(function(sc){
    m.append("div").attr("class","rl").text(SUP[sc-1]+(sc===3?" per 10k":""));
    [1,2,3].forEach(function(dc){
      var n=plotted.filter(function(d){return inFilter(d)&&d.dist_class===dc&&d.supply_class===sc;}).length;
      var on=st.cell&&st.cell[0]===dc&&st.cell[1]===sc;
      var dark=(dc===3&&sc===1)||(dc===2&&sc===1)||(dc===3&&sc===2);
      m.append("button").attr("type","button").attr("class","cell").attr("aria-pressed",on)
        .attr("aria-label","Distance change "+DIST[dc-1]+", OB-GYN supply "+SUP[sc-1]+": "+n+" counties")
        .style("background","var(--b"+dc+(4-sc)+")").style("color",dark?"#fff":"#14161c")
        .text(ns.fmt(n)).on("click",function(){ st.cell=on?null:[dc,sc]; refresh(); });
    });
  });
  m.append("div");
  DIST.forEach(function(t){ m.append("div").attr("class","cl").text(t); });
  el.append("p").attr("class","counts").style("margin-top","8px").html(
    "Rows: OB-GYNs per 10,000 women aged 15–44, 2023. Columns: change in road miles to the nearest clinic, May 2022 → July 2026.");
}
function counts(){
  var f=plotted.filter(inFilter), inc=f.filter(function(d){return d.drive_miles_change>=100;}),
      inc0=inc.filter(function(d){return d.obgyn===0;});
  var lab=st.metro==="all"?"all":st.metro==="1"?"metro":"nonmetro";
  document.getElementById("county-counts").innerHTML="<b>This view ("+lab+" counties):</b> "+ns.fmt(f.length)+" eligible counties; "+
    ns.fmt(inc.length)+" with at least 100 more miles, of which <b>"+ns.fmt(inc0.length)+"</b> had no OB-GYN. "+
    "<span style='color:var(--ink-3)'>National headline (all counties): "+head.display.inc100_no_obgyn+" of "+head.display.inc100+"."+
    (st.metro!=="all"?" The 8 Connecticut counties without a metro code appear only under All.":"")+"</span>";
}
function refresh(){ mapFill(); scatterDots(); matrix(); counts(); }

/* controls */
d3.selectAll("#ctype button").on("click",function(){
  st.metro=this.dataset.metro;
  d3.selectAll("#ctype button").attr("aria-pressed",function(){return this.dataset.metro===st.metro;});
  refresh();
});
d3.select("#hl-toggle").on("change",function(){ st.hl=this.checked; refresh(); });
var list=d3.select("#county-list");
rows.slice().sort(function(a,b){return d3.ascending(a.label,b.label);}).forEach(function(d){ list.append("option").attr("value",d.label); });
var byLabel={}; rows.forEach(function(d){ byLabel[d.label.toLowerCase()]=d; });
function doSearch(){
  var q=this.value.trim().toLowerCase(); if(!q) return;
  var d=byLabel[q]||rows.filter(function(r){return r.label.toLowerCase().indexOf(q)===0;})[0];
  if(d){ select(d.fips); }
  else document.getElementById("county-details").innerHTML="<p class='counts' style='margin:0'>No county matches “"+this.value+"”. Try the form “Hinds, MS”.</p>";
}
d3.select("#county-search").on("change",doSearch).on("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); doSearch.call(this); } });
d3.select("#county-reset").on("click",function(){
  st={metro:"all",hl:true,sel:null,hover:null,cell:null};
  d3.selectAll("#ctype button").attr("aria-pressed",function(){return this.dataset.metro==="all";});
  document.getElementById("hl-toggle").checked=true; document.getElementById("county-search").value="";
  select(null); refresh();
});

drawScatter(); refresh(); mapMarks(); details(null);
ns.onResize(function(){ drawScatter(); scatterMarks(); });
};
