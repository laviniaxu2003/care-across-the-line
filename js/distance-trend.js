/* VIEW A: average road miles to the nearest clinic by policy group, monthly 2019-2026.
   Source: access_trend_by_tier.csv (already weighted by women 15-44; not re-averaged here). */
window.CATL = window.CATL || {};
window.CATL.distanceTrend = function(rows, sel){
"use strict";
var ns=window.CATL;
var root=document.querySelector(sel);
var TIERS=d3.groups(rows,function(d){return d.policy_rank;}).map(function(g){
  return {rank:g[0], name:g[1][0].policy_tier,
    values:g[1].map(function(d){ return {date:ns.parseYM(d.ym), ym:d.ym, v:d.mean_drive_miles_weighted}; })
              .sort(function(a,b){return a.date-b.date;})};
}).sort(function(a,b){return a.rank-b.rank;});
var months=TIERS[0].values.map(function(d){return d.date;});
var RANGES={focus:[ns.parseYM("2022-03"),ns.parseYM("2023-03")], full:[months[0],months[months.length-1]]};
var DOBBS=new Date(2022,5,24);
var show={1:true,7:true,2:false,3:false,4:false,5:false,6:false};
var range="focus", cursor=null;
var cty=null;   // the selected county's own line, once its monthly values have arrived: {name, vals}
var COLOR=function(r){ return "var(--pol-"+r+")"; };   // ochre -> grey ramp -> violet, never red/blue
var KEY=["2022-05","2022-07","2023-01"];
function cval(ym){ var t=cty&&cty.vals.filter(function(d){return d.ym===ym;})[0]; return t?t.v:null; }
function val(rank,ym){ var t=TIERS[rank-1].values.filter(function(d){return d.ym===ym;})[0]; return t&&t.v; }

// legend: ranks 1 and 7 are always shown (static keys); the other five are optional checkboxes
var fixed=d3.select("#trend-fixed").html(""), tiers=d3.select("#trend-tiers").html("");
TIERS.forEach(function(t){
  var key=t.rank===1||t.rank===7;
  var lab=(key?fixed.append("span").attr("class","check static"):tiers.append("label").attr("class","check"));
  if(!key){
    lab.append("input").attr("type","checkbox").property("checked",show[t.rank])
      .on("change",function(){ show[t.rank]=this.checked; draw(); });
  }
  lab.append("i").attr("class","sw line").attr("aria-hidden","true").style("background",COLOR(t.rank)).style("height",key?"3px":"2px");
  lab.append("span").text(t.name);
});
d3.selectAll("#fig-trend [data-range]").on("click",function(){
  range=this.dataset.range;
  d3.selectAll("#fig-trend [data-range]").attr("aria-pressed",function(){return this.dataset.range===range;});
  cursor=null; draw();
});

var readout=document.createElement("p"); readout.className="counts"; readout.setAttribute("aria-live","polite");
function setReadout(){
  if(!cursor){ readout.innerHTML="Hover, tap, or focus the chart and use the arrow keys to read values for any month."; return; }
  var ym=d3.timeFormat("%Y-%m")(cursor);
  readout.innerHTML="<b>"+ns.mo(cursor)+"</b>: "+TIERS.filter(function(t){return show[t.rank];}).map(function(t){
    return t.name+" <b>"+ns.f1(val(t.rank,ym))+"</b> mi"; }).join(" · ")+
    (cty?" · "+cty.name+" <b>"+(cval(ym)==null?"not available":ns.f1(cval(ym))+"</b> mi"):"");
}

function draw(){
  root.innerHTML="";
  var W=ns.width(root), narrow=W<560, H=narrow?320:400;
  var M={t:24,r:narrow?12:24,b:44,l:narrow?40:52};
  var x=d3.scaleTime().domain(RANGES[range]).range([M.l,W-M.r]);
  var y=d3.scaleLinear().domain([0,240]).range([H-M.b,M.t]);
  if(cty){   // a county can run past 240 miles; widen the scale only then
    var cmax=d3.max(cty.vals.filter(function(d){return d.date>=RANGES[range][0]&&d.date<=RANGES[range][1];}),function(d){return d.v;});
    if(cmax>240) y.domain([0,cmax]).nice();
  }
  var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("tabindex",0)
    .attr("role","img").attr("aria-labelledby","trend-t trend-d");
  svg.append("title").attr("id","trend-t").text("Average road miles to the nearest abortion clinic by policy group, "+
    (range==="focus"?"March 2022 to March 2023":"January 2019 to July 2026"));
  svg.append("desc").attr("id","trend-d").text(document.getElementById("trend-summary").textContent);
  var cid="clip-trend-"+range;
  svg.append("clipPath").attr("id",cid).append("rect").attr("x",M.l).attr("y",0).attr("width",W-M.l-M.r).attr("height",H);

  // axes
  svg.append("g").attr("transform","translate(0,"+(H-M.b)+")")
    .call(d3.axisBottom(x).ticks(range==="focus"?(narrow?4:7):(narrow?4:8))
      .tickFormat(range==="focus"?d3.timeFormat("%b %Y"):d3.timeFormat("%Y")).tickSizeOuter(0))
    .call(function(a){ a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); a.selectAll("line,path").attr("stroke","var(--rule)"); });
  svg.append("g").attr("transform","translate("+M.l+",0)")
    .call(d3.axisLeft(y).ticks(6).tickSize(-(W-M.l-M.r)))
    .call(function(a){ a.select(".domain").remove(); a.selectAll("line").attr("stroke","var(--rule)");
      a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); });
  svg.append("text").attr("x",M.l).attr("y",M.t-10).attr("font-size",11.5).attr("fill","var(--ink-3)").text("road miles");

  // Dobbs: the decision date, distinct from the monthly observations
  svg.append("line").attr("x1",x(DOBBS)).attr("x2",x(DOBBS)).attr("y1",M.t).attr("y2",H-M.b)
    .attr("stroke","var(--ink)").attr("stroke-dasharray","4 4");
  svg.append("text").attr("x",x(DOBBS)-6).attr("y",M.t+12).attr("text-anchor","end").attr("font-size",11.5).attr("fill","var(--ink)")
    .text(narrow?"Dobbs, Jun 24 2022":"Dobbs decision, June 24, 2022");

  var line=d3.line().x(function(d){return x(d.date);}).y(function(d){return y(d.v);});
  var vis=TIERS.filter(function(t){return show[t.rank];}).sort(function(a,b){
    return (a.rank===1||a.rank===7)-(b.rank===1||b.rank===7); });   // emphasised lines on top
  var lg=svg.append("g").attr("clip-path","url(#"+cid+")");
  lg.selectAll("path").data(vis).join("path").attr("fill","none")
    .attr("stroke",function(t){return COLOR(t.rank);})
    .attr("stroke-width",function(t){return t.rank===1||t.rank===7?3:1.5;})
    .attr("d",function(t){return line(t.values);});
  // direct labels at the right end
  vis.forEach(function(t){
    var last=t.values.filter(function(d){return d.date<=RANGES[range][1];}).pop();
    var key=t.rank===1||t.rank===7;
    if(!key) return;
    svg.append("text").attr("x",W-M.r-2).attr("y",y(last.v)+(t.rank===1?20:-8)).attr("text-anchor","end")
      .attr("font-size",12.5).attr("font-weight",600).attr("fill",COLOR(t.rank))
      .attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3)
      .text(t.name);
  });
  // the selected county, on top of the tier lines
  if(cty){
    var cline=d3.line().defined(function(d){return d.v!=null;}).x(function(d){return x(d.date);}).y(function(d){return y(d.v);});
    lg.append("path").attr("fill","none").attr("stroke","var(--ink)").attr("stroke-width",2).attr("d",cline(cty.vals));
    var clast=cty.vals.filter(function(d){return d.date<=RANGES[range][1]&&d.v!=null;}).pop();
    if(clast){
      var ly=y(clast.v)-8, taken=vis.filter(function(t){return t.rank===1||t.rank===7;}).map(function(t){
        var l=t.values.filter(function(d){return d.date<=RANGES[range][1];}).pop(); return y(l.v)+(t.rank===1?20:-8); });
      for(var n=0;n<6&&taken.some(function(v){return Math.abs(v-ly)<14;});n++) ly-=14;
      svg.append("text").attr("x",W-M.r-2).attr("y",ly).attr("text-anchor","end").attr("font-size",12.5).attr("font-weight",600)
        .attr("fill","var(--ink)").attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3).text(cty.name);
    }
  }
  // annotate May 2022, Jul 2022, Jan 2023 on the Most Restrictive line
  var pos={"2022-05":narrow?["middle",0,20]:["end",-8,16],"2022-07":["start",8,4],"2023-01":narrow?["end",6,-12]:["middle",0,-12]};
  KEY.forEach(function(ym){
    var d=TIERS[0].values.filter(function(v){return v.ym===ym;})[0];
    svg.append("circle").attr("cx",x(d.date)).attr("cy",y(d.v)).attr("r",4.5)
      .attr("fill","var(--pol-1)").attr("stroke","var(--surface-1)").attr("stroke-width",2);
    svg.append("text").attr("x",x(d.date)+pos[ym][1]).attr("y",y(d.v)+pos[ym][2]).attr("text-anchor",pos[ym][0])
      .attr("font-size",12).attr("fill","var(--ink)").attr("paint-order","stroke").attr("stroke","var(--surface-1)").attr("stroke-width",3)
      .text(ns.f1(d.v)+" mi"+(narrow?"":", "+d3.timeFormat("%b %Y")(d.date)));
  });

  // hover / tap / keyboard: a month cursor with persistent readout
  var rule=svg.append("line").attr("y1",M.t).attr("y2",H-M.b).attr("stroke","var(--ink-3)").attr("opacity",0);
  var dots=svg.append("g");
  function place(){
    if(!cursor){ rule.attr("opacity",0); dots.selectAll("*").remove(); setReadout(); return; }
    var ym=d3.timeFormat("%Y-%m")(cursor);
    rule.attr("x1",x(cursor)).attr("x2",x(cursor)).attr("opacity",1);
    dots.selectAll("circle").data(vis).join("circle").attr("r",3.5).attr("cx",x(cursor))
      .attr("cy",function(t){return y(val(t.rank,ym));}).attr("fill",function(t){return COLOR(t.rank);});
    if(cty&&cval(ym)!=null) dots.append("circle").attr("r",3.5).attr("cx",x(cursor)).attr("cy",y(cval(ym))).attr("fill","var(--ink)");
    setReadout();
  }
  var inRange=months.filter(function(m){return m>=RANGES[range][0]&&m<=RANGES[range][1];});
  function nearest(px){ var d=x.invert(px); return inRange.reduce(function(a,b){ return Math.abs(b-d)<Math.abs(a-d)?b:a; }); }
  svg.append("rect").attr("x",M.l).attr("y",M.t).attr("width",W-M.l-M.r).attr("height",H-M.t-M.b)
    .attr("fill","transparent")
    .on("pointermove pointerdown",function(e){ cursor=nearest(d3.pointer(e)[0]); place(); });
  svg.on("keydown",function(e){
    var i=cursor?inRange.findIndex(function(m){return +m===+cursor;}):-1;
    if(e.key==="ArrowRight"){ i=Math.min(inRange.length-1,i+1); }
    else if(e.key==="ArrowLeft"){ i=i<0?inRange.length-1:Math.max(0,i-1); }
    else if(e.key==="Escape"){ cursor=null; place(); return; }
    else return;
    e.preventDefault(); cursor=inRange[i]; place();
  });
  root.appendChild(readout);
  place();
}

// data table
var tm=["2019-01","2022-05","2022-07","2023-01","2026-07"];
function table(){
var h="<table class='dt'><thead><tr><th>Policy group</th>"+tm.map(function(m){return "<th class='n'>"+ns.mo(ns.parseYM(m))+"</th>";}).join("")+"</tr></thead><tbody>";
TIERS.forEach(function(t){ h+="<tr><td>"+t.rank+". "+t.name+"</td>"+tm.map(function(m){return "<td class='n'>"+ns.f1(val(t.rank,m))+"</td>";}).join("")+"</tr>"; });
if(cty) h+="<tr><td>"+cty.name+" (selected county)</td>"+tm.map(function(m){return "<td class='n'>"+(cval(m)==null?"n/a":ns.f1(cval(m)))+"</td>";}).join("")+"</tr>";
document.getElementById("trend-table").innerHTML=h+"</tbody></table><p class='note'>Average road miles, weighted by women aged 15–44.</p>";
}
table();

draw();
ns.onResize(draw);

// "your county": fetch its monthly values (first time only), then draw its line
ns.onCounty(function(f){
  cty=null; draw(); table();
  if(!f){ ns.status("#st-trend",""); return; }
  ns.status("#st-trend","Loading this county\u2019s monthly distances\u2026");
  ns.get("monthly").then(function(m){
    if(ns.county!==f) return;   // the reader moved on while it loaded
    var r=ns.countyRow(f), a=m.byFips[f];
    cty={name:r.label, vals:m.months.map(function(ym,i){ return {date:ns.parseYM(ym), ym:ym, v:a?a[i]:null}; })};
    ns.status("#st-trend",""); draw(); table();
  }).catch(function(e){
    console.error(e); ns.status("#st-trend","This county\u2019s monthly line could not load ("+e.message+").",true);
  });
});
};
