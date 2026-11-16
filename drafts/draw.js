/* Two visualization drafts for the process book. Both are drawn from the project's own
   derived tables (inlined in data.js) and styled with the site's tokens, so a screenshot
   of either sits beside the implemented views without looking like a different project. */
(function(){
"use strict";
var D=window.DRAFT, YEARS=D.years;
var BANDS=[
  {k:"restrictive", c:"var(--accent)",   lab:D.labels.restrictive, n:D.n_states.restrictive},
  {k:"middle",      c:"var(--tier-mid)", lab:D.labels.middle,      n:D.n_states.middle},
  {k:"protective",  c:"var(--protect)",  lab:D.labels.protective,  n:D.n_states.protective}
];
var MONO="DM Mono, monospace";
function txt(g,x,y,s,o){ var t=g.append("text").attr("x",x).attr("y",y).text(s)
  .attr("font-size",(o&&o.size)||11.5).attr("fill",(o&&o.fill)||"var(--ink-3)")
  .attr("font-family",(o&&o.font)||MONO);
  if(o&&o.anchor) t.attr("text-anchor",o.anchor); if(o&&o.weight) t.attr("font-weight",o.weight);
  return t; }

/* ---------- DRAFT A - sketch 13, "Footprints" ----------
   One footprint per state-group per year. Footprint AREA = infant deaths per 1,000 births.
   The walk runs left to right through time; the stride alternates like a real gait.
   A larger footprint on the right carries the 2020 teen birth rate for the same group. */
function footprint(g,cx,cy,s,flip,fill,op){
  var k=flip?-1:1, f=g.append("g")
    .attr("transform","translate("+cx+","+cy+") scale("+(k*s)+","+s+") rotate("+(flip?6:-6)+")")
    .attr("fill",fill).attr("opacity",op==null?1:op);
  f.append("ellipse").attr("cx",0).attr("cy",1.4).attr("rx",2.55).attr("ry",4.9);
  f.append("ellipse").attr("cx",.35).attr("cy",6.1).attr("rx",2.05).attr("ry",2.7);
  [[-2.25,-4.0,.80],[-.85,-5.05,.92],[.55,-5.15,.84],[1.75,-4.6,.70],[2.65,-3.7,.56]]
    .forEach(function(t){ f.append("circle").attr("cx",t[0]).attr("cy",t[1]).attr("r",t[2]); });
  return f;
}
function draftA(sel){
  var W=960,M={t:62,r:196,b:58,l:132},H=430,rowH=(H-M.t-M.b)/3;
  var svg=d3.select(sel).attr("viewBox","0 0 "+W+" "+H);
  var x=d3.scalePoint().domain(YEARS).range([M.l,W-M.r]).padding(.62);
  var all=[]; BANDS.forEach(function(b){ YEARS.forEach(function(y){ all.push(D.imr[b.k][y]); }); });
  var size=d3.scaleSqrt().domain([0,d3.max(all)]).range([0,1.9]);   /* area ∝ rate */

  YEARS.forEach(function(y){ txt(svg,x(y),M.t-26,y,{anchor:"middle",size:11}); });
  var dob=(x(2022)+x(2021))/2;
  svg.append("line").attr("x1",dob).attr("x2",dob).attr("y1",M.t-18).attr("y2",H-M.b+6)
    .attr("stroke","var(--ink)").attr("stroke-width",1.3).attr("stroke-dasharray","5 4");
  txt(svg,dob,M.t-42,"DOBBS",{anchor:"middle",size:10.5,fill:"var(--ink)"}).attr("letter-spacing","0.18em");

  var sepX=W-M.r+34;
  svg.append("line").attr("x1",sepX).attr("x2",sepX).attr("y1",M.t-46).attr("y2",H-M.b+6).attr("stroke","var(--rule)");
  txt(svg,sepX+54,M.t-26,"teen births, 2020",{anchor:"middle",size:11});

  BANDS.forEach(function(b,i){
    var cy=M.t+rowH*i+rowH/2;
    txt(svg,M.l-26,cy-5,b.lab,{anchor:"end",size:12.5,fill:"var(--ink)",font:"Archivo, sans-serif",weight:600});
    txt(svg,M.l-26,cy+12,b.n+" states",{anchor:"end",size:11});
    YEARS.forEach(function(y,j){
      var v=D.imr[b.k][y];
      footprint(svg,x(y),cy+(j%2?10:-10),size(v),j%2===1,b.c,.92);
      txt(svg,x(y),cy+(j%2?10:-10)+30,v.toFixed(2),{anchor:"middle",size:9.5,fill:"var(--ink-3)"});
    });
    var tv=D.teen[b.k];
    footprint(svg,sepX+54,cy,d3.scaleSqrt().domain([0,25]).range([0,2.6])(tv),false,b.c,.92);
    txt(svg,sepX+54,cy+40,tv.toFixed(1),{anchor:"middle",size:11,fill:"var(--ink)"});
  });
  txt(svg,M.l-26,H-18,"Footprint area = infant deaths per 1,000 live births (left) and births per 1,000 women aged 15–19 (right)",
      {size:11.5,fill:"var(--ink-2)",font:"Archivo, sans-serif"}).attr("x",M.l-110);
}

/* ---------- DRAFT B - sketch 15, "Tourniquet" ----------
   A ribbon per state group, thickness = preterm births as a share of all births.
   The design was built to show a band tightening after Dobbs. The lower panel plots the
   gap that the metaphor predicts, and the data declines to produce it. */
function draftB(sel){
  var W=960,M={t:58,r:188,b:150,l:168},H=470;
  var svg=d3.select(sel).attr("viewBox","0 0 "+W+" "+H);
  var x=d3.scalePoint().domain(YEARS).range([M.l,W-M.r]).padding(.18);
  var band=(H-M.t-M.b)/3, thick=d3.scaleLinear().domain([0,12]).range([0,band*.86]);

  YEARS.forEach(function(y){ txt(svg,x(y),M.t-24,y,{anchor:"middle",size:11}); });
  var dob=(x(2022)+x(2021))/2;

  BANDS.forEach(function(b,i){
    var cy=M.t+band*i+band/2, s=D.preterm[b.k];
    var area=d3.area().x(function(y){return x(y);})
      .y0(function(y){return cy-thick(s[y])/2;}).y1(function(y){return cy+thick(s[y])/2;})
      .curve(d3.curveMonotoneX);
    svg.append("path").datum(YEARS).attr("d",area).attr("fill",b.c).attr("opacity",.8);
    txt(svg,M.l-26,cy-4,b.lab,{anchor:"end",size:12.5,fill:"var(--ink)",font:"Archivo, sans-serif",weight:600});
    txt(svg,M.l-26,cy+13,s[2017].toFixed(2)+"% → "+s[2024].toFixed(2)+"%",{anchor:"end",size:11});
    txt(svg,W-M.r+14,cy+4,s[2024].toFixed(2)+"%",{size:11.5,fill:"var(--ink)"});
  });
  /* the strap: where the metaphor says the band should cinch */
  svg.append("rect").attr("x",dob-7).attr("y",M.t-16).attr("width",14).attr("height",band*3+6)
    .attr("fill","none").attr("stroke","var(--ink)").attr("stroke-width",1.3).attr("rx",3);
  txt(svg,dob,M.t-30,"DOBBS",{anchor:"middle",size:10.5,fill:"var(--ink)"}).attr("letter-spacing","0.18em");

  /* lower panel: the gap the design was built to reveal */
  var gy=H-M.b+44, gh=58;
  var gaps=YEARS.map(function(y){ return D.preterm.restrictive[y]-D.preterm.protective[y]; });
  var gs=d3.scaleLinear().domain([1.4,2.0]).range([gy+gh,gy]);
  svg.append("line").attr("x1",M.l).attr("x2",W-M.r).attr("y1",gy+gh).attr("y2",gy+gh).attr("stroke","var(--rule)");
  svg.append("path").datum(YEARS).attr("fill","none").attr("stroke","var(--ink)").attr("stroke-width",2)
    .attr("d",d3.line().x(function(y){return x(y);}).y(function(y,j){return gs(gaps[j]);}).curve(d3.curveMonotoneX));
  YEARS.forEach(function(y,j){
    svg.append("circle").attr("cx",x(y)).attr("cy",gs(gaps[j])).attr("r",3.4)
      .attr("fill","var(--surface-1)").attr("stroke","var(--ink)").attr("stroke-width",1.8);
    if(j===0||j===4||j===7) txt(svg,x(y),gs(gaps[j])-12,gaps[j].toFixed(2),{anchor:"middle",size:10.5,fill:"var(--ink)"});
  });
  svg.append("line").attr("x1",dob).attr("x2",dob).attr("y1",gy-8).attr("y2",gy+gh)
    .attr("stroke","var(--ink)").attr("stroke-width",1.3).attr("stroke-dasharray","5 4");
  txt(svg,M.l-26,gy+6,"Gap in points",{anchor:"end",size:11.5,fill:"var(--ink)",font:"Archivo, sans-serif",weight:600});
  txt(svg,M.l-26,gy+22,"restrictive minus",{anchor:"end",size:10.5});
  txt(svg,M.l-26,gy+35,"protective",{anchor:"end",size:10.5});
  txt(svg,W-M.r+14,gs(gaps[7])+4,"peaks in 2021,",{size:11,fill:"var(--ink-2)",font:"Archivo, sans-serif"});
  txt(svg,W-M.r+14,gs(gaps[7])+18,"before the ruling",{size:11,fill:"var(--ink-2)",font:"Archivo, sans-serif"});
  txt(svg,M.l-110,H-14,"Ribbon thickness = preterm births as a share of live births, measured from zero",
      {size:11.5,fill:"var(--ink-2)",font:"Archivo, sans-serif"});
}
draftA("#draft-13"); draftB("#draft-15");
})();
