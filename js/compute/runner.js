// js/compute/runner.js  (dir mapping + robust route detection + import fix)
import { CalculationService } from '../domain/services/CalculationService.js';
import { VisualizationService } from '../domain/services/VisualizationService.js';
import { RoadRepository } from '../domain/repositories/RoadRepository.js';
import { TrafficRepository } from '../domain/repositories/TrafficRepository.js';
import { DiffRenderer } from '../map/diff-render.js';
import { redistribute } from './redistribute.js';

export function setupRunner(map){
  const fc = (window.__ROAD_FC && window.__ROAD_FC.features) ? window.__ROAD_FC : { type:'FeatureCollection', features:[] };
  const roadRepo = new RoadRepository(fc);
  const trafficRepo = new TrafficRepository(fc);
  const calcService = new CalculationService(roadRepo, trafficRepo, {});
  const vizService  = new VisualizationService(roadRepo, { classes:[0.2,0.35,0.5,0.7,0.9] });
  const diffRoads = new DiffRenderer(map, 'roads');
  const diffAreas = new DiffRenderer(map, 'road-areas');

  function getRouteLinkIds(detourPaths){
    if (detourPaths?.[0]?.length) return detourPaths[0];
    const rs = (window.routeStore && window.routeStore.state) ? window.routeStore.state : null;
    const cands = [
      rs?.linkIds,
      rs?.route?.linkIds,
      rs?.selected?.linkIds,
      (typeof window.routeStore?.get === 'function') ? window.routeStore.get('linkIds') : null,
      (typeof window.routeStore?.toJSON === 'function') ? window.routeStore.toJSON()?.linkIds : null,
      window.__DETOUR_PATH,
    ].filter(Boolean);
    for (const v of cands){ if (Array.isArray(v) && v.length) return v; }
    return [];
  }

  async function runAt({ hour=0, K=3, dir='up', closures=[], detourPaths=[], boundary=null } = {}){
    const engineDir = (dir === 'up') ? 'ue' : 'usiro';

    const linkIds = getRouteLinkIds(detourPaths);
    const hasRoute = linkIds.length > 0;
    if (!hasRoute){
      console.warn('[runner] route not set; skip run');
      return;
    }
    const detours = [linkIds];

    const __closureIds = (closures||[]).map(c => (typeof c === 'object') ? String(c.linkId||c.id||c.linkid||'') : String(c)).filter(Boolean);
    let res = calcService.runAt({ hour, K, dir: engineDir, closures: __closureIds });
    try {
      res = redistribute(res, roadRepo, { closures, detourPaths: detours, hour, dir: engineDir, K, boundary: (boundary||null)});
    } catch(e){ console.warn('[redistribute] skip', e); }
    window.__CALC_RESULT = res;
    const dict = vizService.toFeatureState(res);
    diffRoads.applyFeatureStateDict(dict);
    try { if (map.getSource('road-areas')) diffAreas.applyFeatureStateDict(dict); } catch(e) {}
  }

  return { runAt };
}

// Route boundary integration
import { routeStore } from '../state/route-store.js';
export function bindRouteBoundary(map, K=3, dir='up'){
  window.addEventListener('route:finalized', (e)=>{
    const sel = e.detail || {};
    const linkIds = (sel?.linkIds && sel.linkIds.length) ? sel.linkIds : (routeStore?.state?.linkIds || []);
    const boundary = {
      inflow: [{ linkid: linkIds && linkIds[0], q: 0.9, coord: sel.entryCoord }],
      outflow:[{ linkid: sel.exitLinkId, q: -0.9, coord: sel.exitCoord }]
    };
    try {
      const ctx = { hour:0, K, dir, closures:[], detourPaths:[linkIds||[]], boundary };
      if (typeof runAt === 'function'){ runAt(ctx); }
      else { window.dispatchEvent(new CustomEvent('compute:run', { detail: ctx })); }
    } catch(err){ console.warn('route boundary run skipped', err); }
  });
}
