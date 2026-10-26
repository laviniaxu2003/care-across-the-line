/* VIEW C2: share of counties with no OB-GYN (2023), ranks 1-2 vs ranks 6-7, within metro and nonmetro.
   Paired dots on a common 0-100% scale; denominators in the table. */
window.CATL = window.CATL || {};
window.CATL.rurality = function(rows, sel){
"use strict";
var ns=window.CATL;
var root=document.querySelector(sel);
var TYPES=["Metro","Nonmetro"];
var R12="Ranks 1-2 (most restrictive)", R67="Ranks 6-7 (most protective)";
function get(t,g){ return rows.filter(function(d){return d.county_type===t&&d.policy_group===g;})[0]; }

function draw(){
  root.innerHTML="";
  var W=ns.width(root), narrow=W<560, rowH=58, M={t:34,r:narrow?20:40,b:40,l:narrow?80:110}, H=M.t+TYPES.length*rowH+M.b;
  var x=d3.scaleLinear().domain([0,100]).range([M.l,W-M.r]);
  var svg=d3.select(root).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("role","img").attr("aria-labelledby","rur-t rur-d");
  svg.append("title").attr("id","rur-t").text("Share of counties with no OB-GYN, by county type and policy group");
  svg.append("desc").attr("id","rur-d").text(TYPES.map(function(t){
    return t+": "+get(t,R12).pct_no_obgyn.toFixed(1)+"% in ranks 1 to 2 versus "+get(t,R67).pct_no_obgyn.toFixed(1)+"% in ranks 6 to 7"; }).join(". "));
  svg.append("g").attr("transform","translate(0,"+(H-M.b)+")")
    .call(d3.axisBottom(x).ticks(narrow?5:10).tickFormat(function(v){return v+"%";}).tickSize(-(H-M.b-M.t+10)))
    .call(function(a){ a.select(".domain").remove(); a.selectAll("line").attr("stroke","var(--rule)");
      a.selectAll("text").attr("font-size",11.5).attr("fill","var(--ink-2)"); });
  // key
  var k=svg.append("g").attr("transform","translate("+M.l+",12)");
  [[R67,"var(--protect)","Policy ranks 6–7"],[R12,"var(--accent)","Policy ranks 1–2"]].forEach(function(e,i){
    var g=k.append("g").attr("transform","translate("+(i*(narrow?120:150))+",0)");
    g.append("circle").attr("r",6).attr("cy",-4).attr("fill",e[1]);
    g.append("text").attr("x",11).attr("font-size",12).attr("fill","var(--ink-2)").text(e[2]);
  });
  TYPES.forEach(function(t,i){
    var yy=M.t+i*rowH+rowH/2, a=get(t,R67), b=get(t,R12);
    svg.append("text").attr("x",M.l-14).attr("y",yy+4).attr("text-anchor","end").attr("font-size",13)
      .attr("fill","var(--ink)").text(t);
    svg.append("line").attr("x1",x(a.pct_no_obgyn)).attr("x2",x(b.pct_no_obgyn)).attr("y1",yy).attr("y2",yy)
      .attr("stroke","var(--ink-3)").attr("stroke-width",2.5);
    [[a,"var(--protect)",-1],[b,"var(--accent)",1]].forEach(function(p){
      svg.append("circle").attr("cx",x(p[0].pct_no_obgyn)).attr("cy",yy).attr("r",7.5).attr("fill",p[1])
        .attr("stroke","var(--surface-1)").attr("stroke-width",2)
        .on("mousemove",function(e){ ns.tip(e,"<div class='t'>"+t+", "+p[0].policy_group.replace(/ \(.*/,"")+"</div>"+
          p[0].n_no_obgyn+" of "+p[0].n_counties+" counties ("+p[0].pct_no_obgyn.toFixed(1)+"%) had no OB-GYN in 2023"); })
        .on("mouseleave",ns.hideTip);
      svg.append("text").attr("x",x(p[0].pct_no_obgyn)).attr("y",yy-14).attr("text-anchor","middle")
        .attr("font-size",12).attr("fill","var(--ink)").text(p[0].pct_no_obgyn.toFixed(1)+"%");
    });
  });
}
var h="<table class='dt'><thead><tr><th>County type</th><th>Policy group</th><th class='n'>Counties with OB-GYN data</th><th class='n'>No OB-GYN</th><th class='n'>Share</th></tr></thead><tbody>";
rows.forEach(function(d){ h+="<tr><td>"+d.county_type+"</td><td>"+d.policy_group+"</td><td class='n'>"+ns.fmt(d.n_counties)+"</td><td class='n'>"+ns.fmt(d.n_no_obgyn)+"</td><td class='n'>"+d.pct_no_obgyn.toFixed(1)+"%</td></tr>"; });
document.getElementById("rural-table").innerHTML=h+"</tbody></table><p class='note'>Every county in these groups has a metro code. Connecticut&rsquo;s legacy counties, which lack one, are in policy rank 5 and so are not part of this comparison. Alaska&rsquo;s Valdez-Cordova has no OB-GYN data and is excluded.</p>";
draw();
ns.onResize(draw);
};
