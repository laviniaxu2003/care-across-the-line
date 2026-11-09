/* Sticky section rail: marks the link for whichever section is currently in view.
   Progressive enhancement - the links are plain anchors and work without this file. */
(function(){
"use strict";
var links=[].slice.call(document.querySelectorAll(".railnav a[data-sec]"));
if(!links.length) return;
var byId={}, secs=[];
links.forEach(function(a){
  var el=document.getElementById(a.dataset.sec);
  if(el){ byId[a.dataset.sec]=a; secs.push(el); }
});
function mark(id){ links.forEach(function(a){ a.setAttribute("aria-current", a.dataset.sec===id?"true":"false"); }); }
if(!("IntersectionObserver" in window)){ mark(secs[0]&&secs[0].id); return; }
var seen={};
var io=new IntersectionObserver(function(entries){
  entries.forEach(function(e){ seen[e.target.id]=e.isIntersecting?e.intersectionRatio:0; });
  // the section nearest the top of the viewport that is still visible wins
  var best=null, bestTop=Infinity;
  secs.forEach(function(s){
    if(!seen[s.id]) return;
    var t=s.getBoundingClientRect().top;
    if(t<innerHeight*0.6 && Math.abs(t)<bestTop){ bestTop=Math.abs(t); best=s.id; }
  });
  if(best) mark(best);
},{rootMargin:"-10% 0px -55% 0px",threshold:[0,0.15,0.5,1]});
secs.forEach(function(s){ io.observe(s); });
mark(secs[0].id);
})();
