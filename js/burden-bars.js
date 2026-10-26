/* VIEW B: each state's share of added population-weighted distance, May 2022 -> July 2026.
   Top states individually, the rest as one explicitly aggregated "Other states" bar (last). */
window.CATL = window.CATL || {};
window.CATL.burdenBars = function(rows, all, head, sel){
"use strict";
var ns=window.CATL;
var root=document.querySelector(sel);
var top3=head.burden.top3_share_pct;
var pct=function(v){ return v.toFixed(1)+"%"; };

function draw(){
  root.innerHTML="";
  var W=ns.width(root), narrow=W<560;
  var rowH=30, M={t:10,r:narrow?52:70,b:34,l:narrow?112:150}, H=M.t+rows.length*rowH+M.b;
  var annW=narrow?0:170;
  var x=d3.scaleLinear().domain([0,100]).range([M.l,W-M.r-annW]);
  var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("role","img")
    .attr("aria-labelledby","burden-t burden-d");
  svg.append("title").attr("id","burden-t").text("Share of added population-weighted distance by state");
  svg.append("desc").attr("id","burden-d").text(rows.map(function(d){return d.label+" "+pct(d.share_pct);}).join("; "));
  svg.append("g").attr("transform","translate(0,"+(H-M.b)+")")
    .call(d3.axisBottom(x).ticks(narrow?4:5).tickFormat(function(v){return v+"%";}).tickSize(-(H-M.b-M.t)))
    .call(function(a){ a.select(".domain").remove(); a.selectAll("line").attr("stroke","var(--rule)");
      a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); });
  var g=svg.append("g").selectAll("g").data(rows).join("g")
    .attr("transform",function(d,i){return "translate(0,"+(M.t+i*rowH)+")";})
    .on("mousemove",function(e,d){
      ns.tip(e,"<div class='t'>"+d.label+"</div>"+d.share_pct.toFixed(2)+"% of the total<br><span class='k'>women 15–44 × added miles</span> "+
        ns.fmt(Math.round(d.burden))+(d.is_other?"<br><span class='k'>combined total of "+d.n_states+" states</span>":""));
    }).on("mouseleave",ns.hideTip);
  g.append("rect").attr("x",x(0)).attr("y",5).attr("height",rowH-10)
    .attr("width",function(d){return Math.max(1,x(d.share_pct)-x(0));})
    .attr("fill",function(d){return d.highlight?"var(--accent)":d.is_other?"var(--surface-2)":"var(--retained)";})
    .attr("stroke",function(d){return d.is_other?"var(--ink-3)":"none";})
    .attr("stroke-dasharray",function(d){return d.is_other?"4 3":null;});
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

var h="<table class='dt'><thead><tr><th>#</th><th>State</th><th class='n'>Share</th><th class='n'>Women 15–44 × added miles</th><th class='n'>Counties with an increase</th></tr></thead><tbody>";
all.filter(function(d){return d.burden>0;}).forEach(function(d){
  h+="<tr><td>"+d.rank+"</td><td>"+d.state+"</td><td class='n'>"+d.share_pct.toFixed(2)+"%</td><td class='n'>"+ns.fmt(Math.round(d.burden))+"</td><td class='n'>"+d.counties_increase+"</td></tr>";
});
var zero=all.filter(function(d){return !(d.burden>0);}).map(function(d){return d.state;});
document.getElementById("burden-table").innerHTML=h+"</tbody></table>"+(zero.length?"<p class='note'>No added burden: "+zero.join(", ")+".</p>":"");

draw();
ns.onResize(draw);
};
