// js/app.js (UI wiring patch for route editing buttons)
import { initBaseMap } from './map/init.js';
import * as layers from './map/layers.js'; // ensureRoadLayer, bindRouteEditing, maybe start/stop/isRoute
import { wireTabs } from './ui/tabs.js';
import { mountHomePanel } from './ui/home-panel.js';
import { mountCalcPanel } from './ui/calc-panel.js';
import { mountReportPanel } from './ui/report-panel.js';
import { setupRunner, bindRouteBoundary } from './compute/runner.js';
import { loadDataset } from './data/loader.js';
import { routeStore } from './state/route-store.js';
import { initInspector } from './ui/inspector.js';
import './runtime/result-watcher.js'; // added wiring

// ---- helper: safe notifier for closures:apply ----
function emitClosuresApply(ids = (Array.isArray(window.__CLOSURES) ? [...window.__CLOSURES].map(String) : [])) {
  document.dispatchEvent(new CustomEvent('closures:apply', { detail: { ids } }));
}

wireTabs();
const map = initBaseMap();
window.map = map; // debug

// Fallback-friendly wrappers (works with older layers.js that listen to custom events)
function startRouteEditing(){
  if (typeof layers.startRouteEditing === 'function') return layers.startRouteEditing();
  window.dispatchEvent(new Event('route:edit:start'));
}
function stopRouteEditing(){
  if (typeof layers.stopRouteEditing === 'function') return layers.stopRouteEditing();
  window.dispatchEvent(new Event('route:edit:stop'));
}
function isRouteEditing(){
  if (typeof layers.isRouteEditing === 'function') return !!layers.isRouteEditing();
  return !!window.__ROUTE_EDITING; // may be set by newer layers.js
}

map.on('load', async () => {
  try {
    await loadDataset(window.__DATA_AREA || '34_hiroshima');
  } catch (e) {
    console.error('[loader] failed', e);
    window.__ROAD_FC = { type: 'FeatureCollection', features: [] };
    window.__TRAFFIC_BY_ID = {};
  }

  const fc = window.__ROAD_FC || { type: 'FeatureCollection', features: [] };
  layers.ensureRoadLayer(map, fc);

  // ---- 計算ランナー初期化 ----
  const runner = setupRunner(map);
  // --- wire calc events to runner.runAt (fixed insertion) ---
  if (typeof runner?.runAt === 'function') {
    document.addEventListener('calc:run', (ev) => {
      try { runner.runAt(ev.detail || {}); } catch (e) { console.error('[calc:run]', e); }
    });
    document.addEventListener('compute:run', (ev) => {
      try { runner.runAt(ev.detail || {}); } catch (e) { console.error('[compute:run]', e); }
    });
  }

  // ---- 新ルート選択機能の統合 ----
  layers.bindRouteEditing(map);                       // クリック/戻る/Enter/Esc の入力ハンドラを1回だけ設定
  bindRouteBoundary(map, 3, 'up'); // 確定時に ±0.9 境界を渡して計算実行

  // ---- 交通量再描画イベント ----
  document.addEventListener('traffic:render', (ev) => {
    const opt = ev.detail || {};
    import('./map/layers.js').then((m) => m.updateTrafficStyle && m.updateTrafficStyle(map, opt));
  });

  // ---- パネルUI ----
  mountHomePanel(map);
  mountCalcPanel();
  mountReportPanel(map);

  // ---- 区画インスペクタ起動（近傍カード＋白ハイライト） ----
  try { initInspector(map); } catch(e){ console.warn('inspector init failed', e); }

  // ---- 移動経路UI（今回追加：既存 index.html のボタンに配線） ----
  (function setupRouteUI(){
    const btnStart = document.getElementById('route-start');
    const btnReset = document.getElementById('route-reset');

    function reflect(){
      btnStart && btnStart.classList.toggle('active', !!isRouteEditing());
    }
    window.addEventListener('route:edit:start', reflect);
    window.addEventListener('route:edit:stop', reflect);

    btnStart?.addEventListener('click', ()=>{
      if (isRouteEditing()) stopRouteEditing();
      else startRouteEditing(); // 内部で未確定をクリア（確定表示は残す）
      reflect();
    });

    btnReset?.addEventListener('click', ()=>{
      try{ routeStore.cancel(); }catch(_){}
      stopRouteEditing();
      // 画面上の選択レイヤも空に
      window.dispatchEvent(new CustomEvent('route:changed', { detail:{ linkIds:[], entryCoord:null, exitCoord:null, exitLinkId:null } }));
      reflect();
    });
  })();

  // ---- AOI 適用（範囲選択） ----
  window.__AOI_POLYGON = null;
  document.addEventListener('aoi:apply', (ev) => {
    const poly = ev.detail?.polygon;
    if (!poly) return;
    window.__AOI_POLYGON = poly;
    try {
      map.setFilter('roads-line', ['within', poly]);
      const _b = bboxOfPolygon(poly?.coordinates?.[0]);
      if (_b) map.fitBounds(_b, { padding: 40, maxZoom: 16, duration: 600 });
    } catch (e) {
      console.warn('AOI filter failed', e);
    }
  });

  // ---- 通行止めID適用 ----
  window.__CLOSURES = window.__CLOSURES || [];
  document.addEventListener('closures:apply', (ev) => {
    const ids = ev.detail?.ids || [];
    window.__CLOSURES = ids.map(String);
    ids.forEach((id) => {
      const sid = String(id);
      map.setFeatureState({ source: 'roads', id: sid }, { closed: true });
    });
  });
});

function bboxOfPolygon(ring) {
  if (!ring || !ring.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}

// ===== revised: closures change notifier (emit only on actual changes) =====
(function closuresApplyWiring(){
  function emitClosures(){
    try{
      const ids = Array.isArray(window.__CLOSURES) ? [...window.__CLOSURES].map(String) : [];
      document.dispatchEvent(new CustomEvent('closures:apply', { detail: { ids } }));
    }catch(e){}
  }

  function wrapIfArray(){
    if (!Array.isArray(window.__CLOSURES)) return false;
    if (window.__CLOSURES.__wrapped) return true;

    const raw = window.__CLOSURES;
    const prox = new Proxy(raw, {
      set(t, p, v){
        const ok = Reflect.set(t,p,v);
        if (p !== '__wrapped') emitClosures();
        return ok;
      },
      deleteProperty(t,p){
        const ok = Reflect.deleteProperty(t,p);
        emitClosures();
        return ok;
      }
    });

    // 配列メソッドをフックして変更時のみ通知
    ['push','pop','shift','unshift','splice','sort','reverse'].forEach((fn)=>{
      const orig = raw[fn];
      prox[fn] = function(...args){
        const r = orig.apply(raw, args);
        emitClosures();
        return r;
      };
    });

    prox.__wrapped = true;
    window.__CLOSURES = prox;
    // 初期状態の通知（必要なら）
    emitClosures();
    return true;
  }

  // __CLOSURES がまだ未設定の場合に備えて、短期ポーリングで1回だけラップ
  const iv = setInterval(()=>{
    if (wrapIfArray()) clearInterval(iv);
  }, 200);
})();
// ===== end revised =====


// ---- 通行止めUI（修正版） ----
(function setupClosureUI(){
  const elMode = document.getElementById('closure-mode');
  const elClear = document.getElementById('closure-clear');
  const elTypeFull = document.getElementById('closure-full');
  const elTypePartial = document.getElementById('closure-partial');
  const elPartialBox = document.getElementById('partial-box');
  const elClosedLanes = document.getElementById('closed-lanes');

  window.__CLOSURES = window.__CLOSURES || [];
  window.__CLOSURE_META = window.__CLOSURE_META || {};

  function syncPartialBox() {
    if (!elPartialBox) return;
    elPartialBox.style.display = (elTypePartial && elTypePartial.checked) ? 'block' : 'none';
  }
  elTypeFull && elTypeFull.addEventListener('change', syncPartialBox);
  elTypePartial && elTypePartial.addEventListener('change', syncPartialBox);
  syncPartialBox();

  const PICK_LAYERS = ['road-fill', 'road-outline', 'road-fill-poly', 'road-outline-poly'];
  let picking = false;
  function existingLayers(map, ids) { return ids.filter((id) => !!map.getLayer(id)); }

  function onMapPick(e) {
    const layersArr = existingLayers(map, PICK_LAYERS);
    if (!layersArr.length) return;
    const feats = map.queryRenderedFeatures(e.point, { layers: layersArr });
    const f = feats && feats[0];
    if (!f) return;
    const id = String(f.id ?? f.properties?.linkid ?? f.properties?.link_id);
    if (!id) return;

    const idx = window.__CLOSURES.indexOf(id);
    if (idx >= 0) {
      window.__CLOSURES.splice(idx, 1);
      delete window.__CLOSURE_META[id];
      if (map.getSource('roads')) {
        map.setFeatureState({ source: 'roads', id }, { closed: false });
      }
    } else {
      window.__CLOSURES.push(id);
      const type = (elTypePartial && elTypePartial.checked) ? 'partial' : 'full';
      const closedLanes = Number(elClosedLanes?.value || 1);
      window.__CLOSURE_META[id] = { type, closedLanes };
      if (map.getSource('roads')) {
        map.setFeatureState({ source: 'roads', id }, { closed: true });
      }
    }
    // ★ 選択/解除の直後に常に通知（変更時のみ発火になっているのでOK）
    emitClosuresApply();
  }

  elMode?.addEventListener('click', () => {
    picking = !picking;
    elMode.classList.toggle('active', picking);
    if (picking) map.on('click', onMapPick);
    else map.off('click', onMapPick);
  });

  elClear?.addEventListener('click', () => {
    const ids = [...window.__CLOSURES];
    window.__CLOSURES.length = 0;
    window.__CLOSURE_META = {};
    ids.forEach((id) => {
      if (map.getSource('roads')) {
        map.setFeatureState({ source: 'roads', id: String(id) }, { closed: false });
      }
    });
    // ★ クリア直後に「空」で通知
    emitClosuresApply([]);
  });
})();