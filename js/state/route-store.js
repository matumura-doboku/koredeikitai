// js/state/route-store.js
import { traceBetween } from '../routes/trace.js';

const KEY_HISTORY = 'route_history_v1';
const MAX_HISTORY = 10;
const ANGLE_DEG = 20;

function fire(type, detail){ window.dispatchEvent(new CustomEvent(type, { detail })); }
function loadHistory(){ try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); } catch { return []; } }
function saveHistory(arr){ try { localStorage.setItem(KEY_HISTORY, JSON.stringify(arr.slice(0,MAX_HISTORY))); } catch {} }

function nearestLinkId(fc, coord){
  let bestId = null, bestD = Infinity;
  for(const f of (fc.features||[])){
    const id = String(f.properties?.linkid ?? f.id ?? '');
    if(!id) continue;
    const g = f.geometry; if(!g) continue;
    const cs = g.coordinates || [];
    if(g.type === 'LineString'){
      for(const p of cs){ const d=(p[0]-coord[0])**2+(p[1]-coord[1])**2; if(d<bestD){bestD=d; bestId=id;} }
    }else if(g.type === 'MultiLineString'){
      for(const line of cs){ for(const p of line){ const d=(p[0]-coord[0])**2+(p[1]-coord[1])**2; if(d<bestD){bestD=d; bestId=id;} } }
    }else if(g.type === 'Polygon'){
      const ring = Array.isArray(cs?.[0]) ? cs[0] : [];
      for(const p of ring){ const d=(p[0]-coord[0])**2+(p[1]-coord[1])**2; if(d<bestD){bestD=d; bestId=id;} }
    }else if(g.type === 'MultiPolygon'){
      for(const poly of cs){
        const ring = Array.isArray(poly?.[0]) ? poly[0] : [];
        for(const p of ring){ const d=(p[0]-coord[0])**2+(p[1]-coord[1])**2; if(d<bestD){bestD=d; bestId=id;} }
      }
    }
  }
  return bestId;
}

function buildRepoFromFC(fc){
  const index = new Map();
  const adj = new Map();
  for(const f of (fc.features||[])){
    const id = String(f.properties?.linkid ?? f.id ?? '');
    if(!id) continue;
    index.set(id, f);
  }
  for(const f of (fc.features||[])){
    const id = String(f.properties?.linkid ?? f.id ?? '');
    if(!id) continue;
    const props = f.properties || {};
    const outs = new Set();
    const add = (v)=>{ if(v!=null && v!=='') outs.add(String(v)); };
    add(props.mae);
    add(props.usiro);
    if(typeof props.bunki === 'string'){
      for(const t of props.bunki.split(';')){ const s=t.trim(); if(s) outs.add(s); }
    }else if(Array.isArray(props.bunki)){
      for(const t of props.bunki){ const s=String(t).trim(); if(s) outs.add(s); }
    }
    adj.set(id, Array.from(outs));
  }
  return {
    get: (id)=> index.get(String(id)),
    neighbors: (id)=> adj.get(String(id)) || [],
  };
}

export const routeStore = (()=>{
  const st = {
    points: [],
    linkIds: [],
    entryCoord: null,
    exitCoord: null,
    exitLinkId: null,
    finalized: null,
    history: loadHistory(),
    repo: null
  };

  function fc(){ return window.__ROAD_FC || { type:'FeatureCollection', features:[] }; }
  function ensureRepo(){ if(st.repo) return st.repo; st.repo = buildRepoFromFC(fc()); return st.repo; }
  function selection(){ return { linkIds:[...st.linkIds], entryCoord:st.entryCoord, exitCoord:st.exitCoord, exitLinkId:st.exitLinkId }; }

  function pushPointFromLngLat(coord){
    const id = nearestLinkId(fc(), coord);
    if(!id) return false;
    st.points.push({ coord, linkid:id });

    if(st.points.length === 1){
      st.entryCoord = coord;
      st.linkIds = [id];
    
    try{ document.dispatchEvent(new CustomEvent('route:mode', { detail: { on: true } })); }catch(e){}
}else{
      const prev = st.points[st.points.length-2].linkid;
      const seg = traceBetween(ensureRepo(), prev, id, { angleThreshold: ANGLE_DEG }) || [];
      if(seg.length){
        if(st.linkIds.length && seg[0] === st.linkIds[st.linkIds.length-1]) seg.shift();
        st.linkIds.push(...seg);
      }else{
        if(st.linkIds[st.linkIds.length-1] !== id) st.linkIds.push(id);
      }
    }

    st.exitCoord = coord;
    st.exitLinkId = st.linkIds[st.linkIds.length-1] || id;
    fire('route:changed', selection());
    return true;
  }

  function popPoint(){
    if(!st.points.length) return false;
    st.points.pop();
    if(!st.points.length){
      st.linkIds = []; st.entryCoord = null; st.exitCoord = null; st.exitLinkId = null;
    }else{
      st.linkIds = [st.points[0].linkid];
      st.entryCoord = st.points[0].coord;
      for(let i=1;i<st.points.length;i++){
        const a = st.points[i-1].linkid;
        const b = st.points[i].linkid;
        const seg = traceBetween(ensureRepo(), a, b, { angleThreshold: ANGLE_DEG }) || [];
        if(seg.length){
          if(st.linkIds[st.linkIds.length-1] === seg[0]) seg.shift();
          st.linkIds.push(...seg);
        }else{
          if(st.linkIds[st.linkIds.length-1] !== b) st.linkIds.push(b);
        }
      }
      const last = st.points[st.points.length-1];
      st.exitCoord = last.coord;
      st.exitLinkId = last.linkid;
    }
    fire('route:changed', selection());
    return true;
  }

  function finalize(){
    const sel = selection();
    st.finalized = sel;
    st.history.unshift({ ...sel, ts: Date.now() });
    saveHistory(st.history);
    fire('route:finalized', sel);
    
    try{ document.dispatchEvent(new CustomEvent('route:end')); }catch(e){}
return sel;
  }

  function cancel(){
    st.points = [];
    if(st.finalized){
      st.linkIds = [...st.finalized.linkIds];
      st.entryCoord = st.finalized.entryCoord;
      st.exitCoord = st.finalized.exitCoord;
      st.exitLinkId = st.finalized.exitLinkId;
    }else{
      st.linkIds = []; st.entryCoord = null; st.exitCoord = null; st.exitLinkId = null;
    try{ document.dispatchEvent(new CustomEvent('route:end')); }catch(e){}

    }
    fire('route:changed', selection());
  }

  function restoreFromHistory(idx){
    const rec = st.history[idx];
    if(!rec) return false;
    st.finalized = { ...rec };
    st.points = [];
    st.linkIds = [...(rec.linkIds||[])];
    st.entryCoord = rec.entryCoord || null;
    st.exitCoord = rec.exitCoord || null;
    st.exitLinkId = rec.exitLinkId || (st.linkIds.length ? st.linkIds[st.linkIds.length-1] : null);
    fire('route:changed', selection());
    fire('route:finalized', selection());
    return true;
  }

  return { state: st, pushPointFromLngLat, popPoint, finalize, cancel, restoreFromHistory };
})();

// ---- Added: expose to global & Enter finalize hook ----
if (typeof window !== 'undefined') {
  // expose
  window.routeStore = routeStore;

  // Enter key: finalize current route & enable Run button immediately
  try {
    window.addEventListener('keydown', (ev)=>{
      if (ev.key !== 'Enter') return;
      const ids = window.routeStore?.state?.linkIds || [];
      if (!Array.isArray(ids) || !ids.length) return;
      try { window.routeStore?.finalize?.(); } catch(e) {}
      
      try{ document.dispatchEvent(new CustomEvent('route:end')); }catch(e){}
try {
        const btn = document.getElementById('btn-run');
        if (btn) btn.disabled = false;
      } catch(e) {}
    }, { capture: true });
  } catch(e) { console.warn('[route-store] Enter hook failed', e); }
}
// ---- End Added ----

