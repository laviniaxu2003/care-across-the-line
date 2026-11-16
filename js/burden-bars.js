/* VIEW B: each state's share of added population-weighted distance, May 2022 -> July 2026.
   Top states individually, the rest as one explicitly aggregated "Other states" bar (last). */
window.CATL = window.CATL || {};
window.CATL.burdenBars = function(rows, all, head, sel){
"use strict";
var ns=window.CATL;
var root=document.querySelector(sel);
var top3=head.burden.top3_share_pct;
var pct=function(v){ return v.toFixed(1)+"%"; };

/* the selected county's state: its own bar, or the "Other" bar when it is folded in there */
function mine(d){
  var r=ns.countyRow(ns.county); if(!r) return false;
  if(!d.is_other) return d.state_abbr===r.state_abbr;
  return !rows.some(function(x){return !x.is_other&&x.state_abbr===r.state_abbr;}) &&
    all.some(function(x){return x.state_abbr===r.state_abbr&&x.burden>0;});
}
function outline(sel){
  return sel.attr("stroke",function(r){ var d=r.d||r; return mine(d)?"var(--ink)":d.is_other?"var(--ink-3)":"none"; })
    .attr("stroke-width",function(r){ return mine(r.d||r)?2.5:null; })
    .attr("stroke-dasharray",function(r){ var d=r.d||r; return d.is_other&&!mine(d)?"4 3":null; });
}
function mineNote(d){
  return d.is_other&&mine(d)?"<br><span class='k'>includes "+ns.countyRow(ns.county).state+", the selected county\u2019s state</span>":"";
}

function draw(){
  root.innerHTML="";
  var W=ns.width(root);
  if(W<560) drawBars(W); else drawArea(W);
}

/* Variable-width bars: width = women affected, height = average added miles, area = burden. */
function drawArea(W){
  var M={t:48,r:16,b:50,l:58}, H=440, gap=2, step=28;
  var totalW=d3.sum(rows,function(d){return d.women_affected;});
  var maxH=d3.max(rows,function(d){return d.avg_added_miles;});
  var x=d3.scaleLinear().domain([0,totalW]).range([M.l,W-M.r]);
  var y=d3.scaleLinear().domain([0,maxH*1.12]).range([H-M.b,M.t]);
  var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("role","img")
    .attr("aria-label","Added burden by state: width is women affected, height is average added miles, area is burden")
    .attr("aria-describedby","burden-d");
  svg.append("desc").attr("id","burden-d").text(rows.map(function(d){
    return d.label+" "+pct(d.share_pct)+", "+(d.women_affected/1e6).toFixed(2)+" million women affected, "+
      Math.round(d.avg_added_miles)+" average added miles";}).join("; "));
  svg.append("g").attr("transform","translate("+M.l+",0)")
    .call(d3.axisLeft(y).ticks(5).tickSize(-(W-M.r-M.l)))
    .call(function(a){ a.select(".domain").remove(); a.selectAll("line").attr("stroke","var(--rule)");
      a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); });
  svg.append("g").attr("transform","translate(0,"+(H-M.b)+")")
    .call(d3.axisBottom(x).tickValues(d3.range(0,totalW,5e6)).tickFormat(function(v){return v/1e6;}))
    .call(function(a){ a.select(".domain").attr("stroke","var(--ink-3)");
      a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); });
  svg.append("text").attr("x",(M.l+W-M.r)/2).attr("y",H-8).attr("text-anchor","middle").attr("font-size",12).attr("fill","var(--ink-2)")
    .text("Women aged 15\u201344 in counties where the nearest clinic got farther (millions)");
  svg.append("text").attr("transform","rotate(-90)").attr("x",-(M.t+H-M.b)/2).attr("y",14).attr("text-anchor","middle")
    .attr("font-size",12).attr("fill","var(--ink-2)").text("Average added miles");
  // geometry
  var acc=0;
  var geo=rows.map(function(d){
    var x0=x(acc); acc+=d.women_affected; var x1=x(acc);
    return {d:d,x0:x0,x1:x1,top:y(d.avg_added_miles)};
  });
  var g=svg.append("g").selectAll("rect").data(geo).join("rect")
    .attr("x",function(r){return r.x0+gap/2;}).attr("y",function(r){return r.top;})
    .attr("width",function(r){return Math.max(1,r.x1-r.x0-gap);}).attr("height",function(r){return y(0)-r.top;})
    .attr("fill",function(r){return r.d.highlight?"var(--accent)":r.d.is_other?"var(--surface-2)":"var(--retained)";})
    .call(outline)
    .on("mousemove",function(e,r){ var d=r.d;
      ns.tip(e,"<div class='t'>"+d.label+"</div>"+d.share_pct.toFixed(2)+"% of the total burden<br>"+
        "<span class='k'>women affected</span> "+ns.fmt(Math.round(d.women_affected))+"<br>"+
        "<span class='k'>average added miles</span> "+Math.round(d.avg_added_miles)+
        (d.is_other?"<br><span class='k'>combined total of "+d.n_states+" states</span>":"")+mineNote(d));
    }).on("mouseleave",ns.hideTip);
  // labels: abbreviation + share, raised in tiers (with a leader line) until nothing overlaps
  var placed=[];
  geo.forEach(function(r){
    var d=r.d, ab=d.is_other?"Other":d.state_abbr, ps=pct(d.share_pct);
    var w=Math.max(ab.length*8,ps.length*6.6)+6, cx=(r.x0+r.x1)/2, tier=0, box;
    for(;tier<8;tier++){
      var yb=r.top-4-tier*step;
      box={x0:cx-w/2,x1:cx+w/2,yb:yb,yt:yb-26};
      var clash=placed.some(function(b){return b.x0<box.x1+2&&b.x1>box.x0-2&&b.yt<box.yb+2&&b.yb>box.yt-2;})||
        geo.some(function(o){return o.x0<box.x1&&o.x1>box.x0&&o.top<box.yb+1;});
      if(!clash) break;
    }
    placed.push(box);
    if(tier>0) svg.append("line").attr("x1",cx).attr("x2",cx).attr("y1",r.top).attr("y2",box.yb+2)
      .attr("stroke","var(--ink-3)").attr("stroke-width",0.8);
    var t=svg.append("text").attr("x",cx).attr("text-anchor","middle").attr("fill",d.highlight?"var(--ink)":"var(--ink-2)");
    t.append("tspan").attr("x",cx).attr("y",box.yb-14).attr("font-size",12).attr("font-weight",600).text(ab);
    t.append("tspan").attr("x",cx).attr("y",box.yb-1).attr("font-size",11.5).text(ps);
  });
  // shared annotation for the highlighted states (contiguous at the left)
  var hg=geo.filter(function(r){return r.d.highlight;});
  if(hg.length){
    var bx0=hg[0].x0+gap/2, bx1=hg[hg.length-1].x1-gap/2, by=30;
    svg.append("path").attr("d","M"+bx0+","+(by+6)+"V"+by+"H"+bx1+"V"+(by+6)).attr("fill","none")
      .attr("stroke","var(--accent)").attr("stroke-width",1.5);
    svg.append("text").attr("x",(bx0+bx1)/2).attr("y",by-7).attr("text-anchor","middle").attr("font-size",13).attr("font-weight",600)
      .attr("fill","var(--accent)").text(pct(top3)+" combined, TX + LA + TN");
  }
}

function drawBars(W){
  var narrow=true;
  var rowH=30, M={t:10,r:narrow?52:70,b:34,l:narrow?112:150}, H=M.t+rows.length*rowH+M.b;
  var annW=narrow?0:170;
  var x=d3.scaleLinear().domain([0,100]).range([M.l,W-M.r-annW]);
  var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("role","img")
    .attr("aria-label","Share of added population-weighted distance by state").attr("aria-describedby","burden-d");
  svg.append("desc").attr("id","burden-d").text(rows.map(function(d){return d.label+" "+pct(d.share_pct)+", "+(d.women_affected/1e6).toFixed(2)+
    " million women affected, "+Math.round(d.avg_added_miles)+" average added miles";}).join("; "));
  svg.append("g").attr("transform","translate(0,"+(H-M.b)+")")
    .call(d3.axisBottom(x).ticks(narrow?4:5).tickFormat(function(v){return v+"%";}).tickSize(-(H-M.b-M.t)))
    .call(function(a){ a.select(".domain").remove(); a.selectAll("line").attr("stroke","var(--rule)");
      a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); });
  var g=svg.append("g").selectAll("g").data(rows).join("g")
    .attr("transform",function(d,i){return "translate(0,"+(M.t+i*rowH)+")";})
    .on("mousemove",function(e,d){
      ns.tip(e,"<div class='t'>"+d.label+"</div>"+d.share_pct.toFixed(2)+"% of the total<br><span class='k'>women 15–44 × added miles</span> "+
        ns.fmt(Math.round(d.burden))+(d.is_other?"<br><span class='k'>combined total of "+d.n_states+" states</span>":"")+mineNote(d));
    }).on("mouseleave",ns.hideTip);
  g.append("rect").attr("x",x(0)).attr("y",5).attr("height",rowH-10)
    .attr("width",function(d){return Math.max(1,x(d.share_pct)-x(0));})
    .attr("fill",function(d){return d.highlight?"var(--accent)":d.is_other?"var(--surface-2)":"var(--retained)";})
    .call(outline);
  g.append("text").attr("x",M.l-10).attr("y",rowH/2+4).attr("text-anchor","end").attr("font-size",12.5)
    .attr("fill",function(d){return d.highlight?"var(--ink)":"var(--ink-2)";})
    .attr("font-style",function(d){return d.is_other?"italic":null;})
    .text(function(d){return d.label;});
  g.append("text").attr("x",function(d){return x(d.share_pct)+6;}).attr("y",rowH/2+4).attr("font-size",12)
    .attr("fill","var(--ink)").text(function(d){return pct(d.share_pct);});
  // shared annotation for the three highlighted states
  var hi=rows.map(function(d,i){return d.highlight?i:-1;}).filter(function(i){return i>=0;});
  if(hi.length&&!narrow){
    var y0=M.t+hi[0]*rowH+5, y1=M.t+hi[hi.length-1]*rowH+rowH-5, bx=W-M.r-annW+56;
    svg.append("path").attr("d","M"+bx+","+y0+"h8V"+y1+"h-8").attr("fill","none").attr("stroke","var(--accent)").attr("stroke-width",1.5);
    svg.append("text").attr("x",bx+16).attr("y",(y0+y1)/2-4).attr("font-size",13).attr("font-weight",600).attr("fill","var(--accent)")
      .text(pct(top3)+" combined");
    svg.append("text").attr("x",bx+16).attr("y",(y0+y1)/2+13).attr("font-size",11.5).attr("fill","var(--ink-2)")
      .text("TX + LA + TN");
  } else if(hi.length){
    d3.select(root).append("p").attr("class","counts").html("<b style='color:var(--accent)'>Texas + Louisiana + Tennessee: "+pct(top3)+" combined</b>");
  }
}

var h="<table class='dt'><thead><tr><th>#</th><th>State</th><th class='n'>Share</th><th class='n'>Women 15–44 × added miles</th><th class='n'>Women affected</th><th class='n'>Average added miles</th><th class='n'>Counties with an increase</th></tr></thead><tbody>";
all.filter(function(d){return d.burden>0;}).forEach(function(d){
  h+="<tr><td>"+d.rank+"</td><td>"+d.state+"</td><td class='n'>"+d.share_pct.toFixed(2)+"%</td><td class='n'>"+ns.fmt(Math.round(d.burden))+"</td><td class='n'>"+ns.fmt(Math.round(d.women_affected))+"</td><td class='n'>"+Math.round(d.avg_added_miles)+"</td><td class='n'>"+d.counties_increase+"</td></tr>";
});
var zero=all.filter(function(d){return !(d.burden>0);}).map(function(d){return d.state;});
document.getElementById("burden-table").innerHTML=h+"</tbody></table>"+(zero.length?"<p class='note'>No added burden: "+zero.join(", ")+".</p>":"");

draw();
ns.onResize(draw);
ns.onCounty(draw);
};
