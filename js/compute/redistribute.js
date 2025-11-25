// js/compute/redistribute.js
// Safe augment: adjust capacities and (optionally) re-compute R if schema is available.
// This is designed to be non-breaking: if shapes are unknown, it passes results through.
import { calcCapacity } from '../services/capacity.service.js';
import { createRingEngineV2 } from './redistribute/engines/ring.v2.js';
import { adaptRoadGeoJSON } from '../adapters/geojson/road.adapter.js';

export function redistribute(result, roadRepo, ctx={}){
  const { closures=[], detourPaths=[], hour=0, dir='up' } = ctx || {};

  // Build closure map { linkid -> {type, closedLanes} }
  const cMap = new Map();
  (closures||[]).forEach(c=>{
    const id = String(c.linkId ?? c.id ?? c.linkid ?? '');
    if (!id) return;
    cMap.set(id, { type: c.type||'full', closedLanes: Number(c.closedLanes||0) });
  });

  // Try to update capacities on the road FeatureCollection if available
  try{
    const fc = (window.__ROAD_FC && window.__ROAD_FC.features) ? window.__ROAD_FC : null;
    if (fc){
      for (const f of fc.features){
        const id = String(f.id ?? f.properties?.linkid ?? f.properties?.link_id ?? '');
        if (!id) continue;
        const closure = cMap.get(id) || null;
        const cap = calcCapacity(f.properties || {}, closure);
        if (!f.properties) f.properties = {};
        f.properties.youryou_eff = cap; // write effective capacity (non-destructive)
      }
    }
  }catch(e){ /* swallow */ }

  // If result has a recognizable map (e.g., { volumes: {linkid: {v:...}} }), try to recompute R.
  try{
    const dict = (result && result.volumes) ? result.volumes : null;
    if (dict){
      const rMap = {};
      for (const [id, rec] of Object.entries(dict)){
        const vol = (rec && typeof rec === 'object') ? (rec.v ?? rec.volume ?? rec[hour] ?? 0) : Number(rec)||0;
        let cap = null;
        // Prefer roadRepo if it exposes a getter
        try{
          const link = roadRepo?.getById ? roadRepo.getById(String(id)) : null;
          cap = link ? calcCapacity(link.properties||{}, cMap.get(String(id))||null) : null;
        }catch(_){}
        if (cap == null){
          // fallback: read from window.__ROAD_FC
          try{
            const f = window.__ROAD_FC.features.find(x => String(x.id||x.properties?.linkid)==String(id));
            cap = f?.properties?.youryou_eff ?? f?.properties?.youryou ?? null;
          }catch(_){}
        }
        const R = (cap && cap>0) ? (vol / cap) : 0;
        rMap[id] = { ...rec, R };
      }
      const newRes = { ...result, volumes: rMap };
      return newRes;
    }
  }catch(e){ /* pass-through */ }

  try { return applyBoundaryPropagation(result, roadRepo, ctx); } catch(e) { return result; }
}

function applyBoundaryPropagation(result, roadRepo, ctx){
  const boundary = ctx && ctx.boundary;
  const path = (ctx && ctx.detourPaths && ctx.detourPaths[0]) || null;
  if (!boundary || !Array.isArray(boundary.inflow) || !result?.volumes) return result;

  const fc = window.__ROAD_FC || { type:'FeatureCollection', features:[] };
  const links = adaptRoadGeoJSON(fc);
  const engine = createRingEngineV2({});
  const seeds = new Map();
  // inject inflow and outflow as deltas
  for(const b of (boundary.inflow||[])){ const id = String(b.linkid||b.linkId||''); if(id) seeds.set(id, (seeds.get(id)||0) + Number(b.q||0)); }
  for(const b of (boundary.outflow||[])){ const id = String(b.linkid||b.linkId||''); if(id) seeds.set(id, (seeds.get(id)||0) + Number(b.q||0)); }

  if (seeds.size===0) return result;
  const dir = (ctx && ctx.dir) === 'down' ? 'sita' : 'ue';
  const rounds = engine.run({ links, seeds, dir, K: Number(ctx.K||3) });
  const delta = rounds[rounds.length-1] || new Map();

  const newVols = { ...(result.volumes||{}) };
  for(const [id, d] of delta.entries()){
    const key = String(id);
    const rec = newVols[key] || { vol: 0, R: 0 };
    const vol = Number(rec.vol||0) + Number(d||0);
    newVols[key] = { ...rec, vol };
  }
  return { ...result, volumes: newVols };
}
