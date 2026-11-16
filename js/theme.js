/* Light/dark switch. Loaded in <head> so a saved choice applies before first paint.
   With no saved choice the site follows the system setting (the CSS media query);
   a click sets data-theme on <html>, which the CSS already honours, and remembers it.
   Charts read colour from CSS variables, so nothing needs redrawing. */
(function(){
"use strict";
var KEY="catl-theme", root=document.documentElement;
var sys=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
function saved(){ try{ var v=localStorage.getItem(KEY); return v==="dark"||v==="light"?v:null; }catch(e){ return null; } }
function save(v){ try{ localStorage.setItem(KEY,v); }catch(e){} }
function isDark(){ var t=root.getAttribute("data-theme"); return t?t==="dark":!!(sys&&sys.matches); }

var s=saved(); if(s) root.setAttribute("data-theme",s);

function sync(){
  var on=isDark();
  [].forEach.call(document.querySelectorAll(".theme-toggle"),function(b){ b.setAttribute("aria-pressed",on?"true":"false"); });
}
document.addEventListener("DOMContentLoaded",function(){
  [].forEach.call(document.querySelectorAll(".theme-toggle"),function(b){
    b.addEventListener("click",function(){
      var next=isDark()?"light":"dark";
      root.setAttribute("data-theme",next); save(next); sync();
    });
  });
  sync();
});
if(sys){ var f=function(){ if(!saved()) sync(); };
  if(sys.addEventListener) sys.addEventListener("change",f); else if(sys.addListener) sys.addListener(f); }
})();
