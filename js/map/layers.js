// js/map/layers.js (route editing: explicit gate + IME-safe finalize)
// 編集は startRouteEditing()/stopRouteEditing() で明示制御。
// 左クリック・右クリックは「編集中のみ」反応。Enter/ESCで確定/中断→停止。

import { routeStore } from '../state/route-store.js';
import { asLineStringGeometry } from '../routes/trace.js';
import { DiffRenderer } from './diff-render.js';

export function ensureRoadLayer(map, fc){
  if (window.__ROAD_LAYER_LOCK) return;
  window.__ROAD_LAYER_LOCK = true;
  try {
    const fcNorm = fc || (window.__ROAD_FC || { type:'FeatureCollection', features:[] });
    (fcNorm.features||[]).forEach((f,i)=>{
      const id0 = String(f.properties?.linkid ?? f.id ?? i+1);
      const id  = id0 && id0 !== 'undefined' ? id0 : String(i+1);
      f.id = id; (f.properties||(f.properties={})).linkid = id;
    });

    if(!map.getSource('roads')){
      map.addSource('roads', { type:'geojson', data: fcNorm, promoteId:'linkid' });
    } else {
      try{ map.getSource('roads').setData(fcNorm); }catch(e){}
    }

    const areas = window.__ROAD_AREAS;
    const hasAreas = !!(areas && areas.type==='FeatureCollection' && areas.features?.length);
    if (hasAreas && !map.getSource('road-areas')){
      map.addSource('road-areas', { type:'geojson', data: areas, promoteId:'linkid' });
    } else if (hasAreas){
      try{ map.getSource('road-areas').setData(areas); }catch(e){}
    }

    const fillColorExpr = [
      'case',
      // closed > selection > data classes (cls) > unknown
      ['boolean',['feature-state','closed'], false], '#000000',   // closed (優先)
      ['boolean',['feature-state','sel'], false],    '#e5e7eb',   // selection
      ['==',['feature-state','cls'],-1], '#9ca3af',               // unknown
      ['==',['feature-state','cls'], 0], '#16a34a',               // cls0: R ≤ 0.20  (var(--r-c1))
      ['==',['feature-state','cls'], 1], '#84cc16',               // cls1: 0.20-0.35 (var(--r-c2))
      ['==',['feature-state','cls'], 2], '#f59e0b',               // cls2: 0.35-0.50 (var(--r-c3))
      ['==',['feature-state','cls'], 3], '#fca5a5',               // cls3: 0.50-0.70 (var(--r-c4))
      ['==',['feature-state','cls'], 4], '#dc2626',               // cls4: 0.70-0.90 (var(--r-c5))
      ['==',['feature-state','cls'], 5], '#7f1d1d',               // cls5: >0.90     (var(--r-c6))
      '#9ca3af'
    ];
    const POLY_FILTER = ['match',['geometry-type'],['Polygon','MultiPolygon'],true,false];
    const hasPolyInRoads = (fcNorm.features||[]).some(f=>{
      const t = f.geometry?.type; return t==='Polygon'||t==='MultiPolygon';
    });

    if (hasAreas){
      if(!map.getLayer('road-fill-poly')){
        map.addLayer({ id:'road-fill-poly', type:'fill', source:'road-areas',
          paint:{ 'fill-color': fillColorExpr, 'fill-opacity':1 } });
      }
      if(!map.getLayer('road-outline-poly')){
        map.addLayer({ id:'road-outline-poly', type:'line', source:'road-areas',
          layout:{ 'line-join':'round' },
          paint:{ 'line-color':'#6b7280', 'line-width':['interpolate',['linear'],['zoom'],10,0.6,14,1.2] } });
      }
      ['road-fill','road-outline','roads-line','roads-casing'].forEach(id=>{
        if(map.getLayer(id)){ try{ map.setLayoutProperty(id,'visibility','none'); }catch(e){} }
      });
    
      // Ensure polygon layers are visible (defensive)
      ['road-fill-poly','road-outline-poly'].forEach(id=>{
        if(map.getLayer(id)){ try{ map.setLayoutProperty(id,'visibility','visible'); }catch(e){} }
      });
    } else if (hasPolyInRoads){
      if(!map.getLayer('road-fill-poly')){
        map.addLayer({ id:'road-fill-poly', type:'fill', source:'roads', filter: POLY_FILTER,
          paint:{ 'fill-color': fillColorExpr, 'fill-opacity':1 } });
      }
      if(!map.getLayer('road-outline-poly')){
        map.addLayer({ id:'road-outline-poly', type:'line', source:'roads', filter: POLY_FILTER,
          layout:{ 'line-join':'round' },
          paint:{ 'line-color':'#6b7280', 'line-width':['interpolate',['linear'],['zoom'],10,0.6,14,1.2] } });
      }
      ['road-fill','road-outline','roads-line','roads-casing'].forEach(id=>{
        if(map.getLayer(id)){ try{ map.setLayoutProperty(id,'visibility','none'); }catch(e){} }
      });
    
      // Ensure polygon layers are visible (defensive)
      ['road-fill-poly','road-outline-poly'].forEach(id=>{
        if(map.getLayer(id)){ try{ map.setLayoutProperty(id,'visibility','visible'); }catch(e){} }
      });
    } else {
      const fillWidth   = ['interpolate',['linear'],['zoom'],10,6,12,9,14,12,16,18];
      const casingWidth = ['interpolate',['linear'],['zoom'],10,7.2,12,10.2,14,13.2,16,19.2];
      if(!map.getLayer('road-outline')){
        map.addLayer({ id:'road-outline', type:'line', source:'roads',
          layout:{ 'line-cap':'round','line-join':'round' },
          paint:{ 'line-color':'#6b7280','line-opacity':1,'line-width':casingWidth } });
      }
      if(!map.getLayer('road-fill')){
        map.addLayer({ id:'road-fill', type:'line', source:'roads',
          layout:{ 'line-cap':'round','line-join':'round' },
          paint:{ 'line-color': fillColorExpr, 'line-opacity':1, 'line-width':fillWidth } });
      } else {
        map.setPaintProperty('road-fill','line-color', fillColorExpr);
      
      // Ensure line layers are visible and polygon layers are hidden when using line rendering
      ['road-fill','road-outline','roads-line','roads-casing'].forEach(id=>{
        if(map.getLayer(id)){ try{ map.setLayoutProperty(id,'visibility','visible'); }catch(e){} }
      });
      ['road-fill-poly','road-outline-poly'].forEach(id=>{
        if(map.getLayer(id)){ try{ map.setLayoutProperty(id,'visibility','none'); }catch(e){} }
      });
      try{ _ensureRoadsVisibleFallback(map); }catch(e){}
    }
    }
  } finally {
    window.__ROAD_LAYER_LOCK = false;
  }
}

let __trafficDiffRenderer = null;

export function updateTrafficStyle(map, opt = {}){
  if (!map) return false;

  const mode = opt.mode || 'before';
  const dir  = opt.dir  || 'up';
  const hour = (Number.isFinite(opt.hour) ? opt.hour : undefined);

  if (!__trafficDiffRenderer){
    __trafficDiffRenderer = new DiffRenderer(map, 'roads');
  }

  // ベースとなる道路 FeatureCollection
  const src  = map.getSource('roads');
  const fc   = (window.__ROAD_FC)
            || (src && src.serialize && src.serialize().data)
            || { type:'FeatureCollection', features:[] };

  const closures = (window.__CLOSURES || []).map(id => String(id));
  const closedSet = new Set(closures);

  const states = {};

  const features = fc.features || [];
  for (const f of features){
    const props = f.properties || {};
    const linkidRaw = props.linkid ?? props.link_id ?? props.linkId ?? props.LINKID ?? f.id;
    if (linkidRaw == null) continue;
    const linkid = String(linkidRaw);

    const isClosed = closedSet.has(linkid);

    let R = null;
    if (typeof window.getTrafficRForDisplay === 'function'){
      const v = window.getTrafficRForDisplay({ mode, linkid, dir, hour });
      if (v && Number.isFinite(v.R)){
        R = Number(v.R);
      }
    }

    // R値をクラスに分類（CSS/凡例と同じ閾値）
    //  R は 0.0〜1.0 の比率値想定
    //    cls0: R ≤ 0.20
    //    cls1: 0.20 < R ≤ 0.35
    //    cls2: 0.35 < R ≤ 0.50
    //    cls3: 0.50 < R ≤ 0.70
    //    cls4: 0.70 < R ≤ 0.90
    //    cls5: 0.90 < R
    let cls = -1;
    if (!isClosed && R != null && Number.isFinite(R)){
      if      (R <= 0.20) cls = 0;
      else if (R <= 0.35) cls = 1;
      else if (R <= 0.50) cls = 2;
      else if (R <= 0.70) cls = 3;
      else if (R <= 0.90) cls = 4;
      else                 cls = 5;
    }

    states[linkid] = {
      cls,
      R: (R != null && Number.isFinite(R)) ? R : 0,
      closed: isClosed
    };
  }

  __trafficDiffRenderer.applyFeatureStateDict(states);
  return true;
}

// ----- Route selection visualization (Polygon/MultiPolygon -> Line 表示) -----
let __routeLayersReady = false;
function ensureRouteSelectionLayers(map){
  if (__routeLayersReady) return;
  const srcId = 'route-selection';
  if (!map.getSource(srcId)){
    map.addSource(srcId, { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
  }
  if (!map.getLayer('route-selection-blue')){
    map.addLayer({ id:'route-selection-blue', source:srcId, type:'line',
      paint:{ 'line-color':'#1E90FF', 'line-width':6, 'line-opacity':0.9 },
      filter:['all', ['==',['get','kind'],'other']]
    });
  }
  if (!map.getLayer('route-selection-red')){
    map.addLayer({ id:'route-selection-red', source:srcId, type:'line',
      paint:{ 'line-color':'#FF3B30', 'line-width':8, 'line-opacity':0.95 },
      filter:['all', ['==',['get','kind'],'exit']]
    });
  }
  if (!map.getLayer('route-selection-pts')){
    map.addLayer({ id:'route-selection-pts', source:srcId, type:'circle',
      paint:{ 'circle-radius':5, 'circle-color':['match',['get','pt'],'entry','#1E90FF','exit','#FF3B30','#888'],
              'circle-stroke-color':'#fff','circle-stroke-width':1.5 },
      filter:['==',['geometry-type'],'Point']
    });
  }
  __routeLayersReady = true;
}

function getFeatureById(linkId){
  const id = String(linkId);
  const fc = window.__ROAD_FC || { type:'FeatureCollection', features:[] };
  if (!window.__ROAD_FEATURE_BY_ID){
    window.__ROAD_FEATURE_BY_ID = {};
    for(const f of (fc.features||[])){
      const fid = String(f.id || f.properties?.linkid || '');
      if (fid) window.__ROAD_FEATURE_BY_ID[fid] = f;
    }
  }
  return window.__ROAD_FEATURE_BY_ID[id] || null;
}

function updateRouteSelection(map, sel){
  const src = map.getSource('route-selection');
  if (!src) return;
  if (!sel || !sel.linkIds || !sel.linkIds.length){
    src.setData({ type:'FeatureCollection', features:[] });
    return;
  }
  const feats = [];
  for(const id of sel.linkIds){
    const f = getFeatureById(id);
    if(!f) continue;
    let geom = f.geometry;
    if (geom && geom.type !== 'LineString' && geom.type !== 'MultiLineString') {
      geom = asLineStringGeometry(geom);
    }
    if (!geom) continue;
    feats.push({ type:'Feature', geometry: geom,
      properties:{ linkid:String(id), kind:(String(id)===String(sel.exitLinkId)?'exit':'other') } });
  }
  if(sel.entryCoord){
    feats.push({ type:'Feature', geometry:{type:'Point', coordinates: sel.entryCoord }, properties:{ pt:'entry' } });
  }
  if(sel.exitCoord){
    feats.push({ type:'Feature', geometry:{type:'Point', coordinates: sel.exitCoord }, properties:{ pt:'exit' } });
  }
  src.setData({ type:'FeatureCollection', features:feats });
}

// ---- Explicit editing mode (start/stop) & IME-safe Enter ----
let __routeUiBound = false;
let __editing = false;  // false: idle / true: editing route

function setEditing(flag){
  if (__editing === flag) return;
  __editing = flag;
  window.dispatchEvent(new CustomEvent('route:edit:' + (flag ? 'start' : 'stop')));
}

export function startRouteEditing(){ setEditing(true); routeStore.cancel(); }
export function stopRouteEditing(){ setEditing(false); }
export function isRouteEditing(){ return __editing; }

export function bindRouteEditing(map){
  if (__routeUiBound) return;
  __routeUiBound = true;
  ensureRouteSelectionLayers(map);

  window.addEventListener('route:changed', (e)=> updateRouteSelection(map, e.detail));

  // route:finalized は「編集中の確定」のときだけ反映する
  // これにより、編集中でない状態で誤って Enter などから finalize が
  // 呼ばれた場合でも、直前の経路が勝手に再表示されるのを防ぐ。
  window.addEventListener('route:finalized', (e)=> {
    if (!__editing) return;   // idle 状態での finalize は無視
    updateRouteSelection(map, e.detail);
  });

  // 任意：外部イベントでも開始/停止できる
  window.addEventListener('route:edit:start', ()=> startRouteEditing());
  window.addEventListener('route:edit:stop',  ()=> stopRouteEditing());

  // クリックは「編集中のみ」反応（常時起動を防止）
  map.on('click', (ev)=>{
    if (!__editing) return;
    const pt = [ev.lngLat.lng, ev.lngLat.lat];
    routeStore.pushPointFromLngLat(pt);
  });

  // 右クリック：編集中のみ 1手戻す
  const cc = map.getCanvasContainer ? map.getCanvasContainer() : map.getCanvas();
  if (cc){
    cc.addEventListener('contextmenu', (ev)=>{
      if (!__editing) return;
      ev.preventDefault();
      routeStore.popPoint();
    });
  }

  // Enter = 確定→停止 / Esc = 中断→停止（IME入力中は無視）
  document.addEventListener('keydown', (ev)=>{
    const tag = (ev.target && ev.target.tagName) ? String(ev.target.tagName).toLowerCase() : '';
    const inForm = (tag === 'input' || tag === 'textarea' || tag === 'select' || ev.isComposing || ev.keyCode === 229);
    if (!__editing) return;
    if (ev.key === 'Enter' && !inForm){
      ev.preventDefault();
      routeStore.finalize();
      stopRouteEditing();
    } else if (ev.key === 'Escape'){
      ev.preventDefault();
      routeStore.cancel();
      stopRouteEditing();
    }
  }, true);

  // デバッグ用にグローバル公開
  window.startRouteEditing = startRouteEditing;
  window.stopRouteEditing  = stopRouteEditing;
  window.isRouteEditing    = isRouteEditing;
}
