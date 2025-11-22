// js/ui/inspector.js
// 区画インスペクタ：クリックで近傍区画のそばに小さなカードを表示し、選択区画を白っぽく強調します。
// 他機能（経路編集・通行止めピッキング）と排他に動作。Shift+クリックでピン留め（複数比較）。
import { getMetricsFor } from '../domain/services/InspectorService.js';

const INSPECTOR_DISABLED = true; // 一時的にインスペクタ機能を無効化


// --- relaxed picker: try known layers, then broad fallback filtered by sources ---
function pickRoadFeature(map, point){
  const candidateLayers = ['road-fill','road-outline','road-fill-poly','road-outline-poly','roads-line','roads-casing'];
  const layers = candidateLayers.filter(id => map.getLayer && map.getLayer(id));
  let feats = [];
  try{
    if (layers.length){
      feats = map.queryRenderedFeatures(point, { layers });
    }
  }catch(_){ feats = []; }
  try{
    if (!feats || feats.length === 0){
      // Broad fallback: query all and filter by desired sources
      const all = map.queryRenderedFeatures(point) || [];
      feats = all.filter(f => f && (f.source === 'road-areas' || f.source === 'roads'));
      // If still empty, allow any feature that looks like a road segment (has id or linkid)
      if (feats.length === 0){
        feats = all.filter(f => f && (f.id != null || (f.properties && (f.properties.linkid != null || f.properties.id != null))));
      }
    }
  }catch(_){}
  return (feats && feats.length) ? feats[0] : null;
}

let _map = null;
let _selected = null; // { id, lngLat }
let _pinned = new Map(); // id -> { id, lngLat, el }
let _container = null;

// Utility: existing layers guard
function existingLayers(map, ids){ return ids.filter(id => !!map.getLayer(id)); }
function isRouteEditing(){ try{ return !!(window.isRouteEditing && window.isRouteEditing()); }catch(_){ return false; } }
function isClosurePicking(){
  const el = document.getElementById('closure-mode');
  return !!(el && el.classList && el.classList.contains('active'));
}
function getHour(){ const s = document.getElementById('time-range'); return s ? Number(s.value||0) : 0; }
function getMode(){
  // 属性パネルは常に観測値（before）のみを参照する
  return 'obs';
}

// DOM
function ensureContainer(){
  if (_container) return _container;
  const el = document.createElement('div');
  el.id = 'inspect-layer';
  el.style.position = 'absolute';
  el.style.left = '0'; el.style.top = '0';
  el.style.right = '0'; el.style.bottom = '0';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  _container = el;
  return el;
}
function createCard(id){
  const el = document.createElement('div');
  el.className = 'inspect-card';
  el.dataset.linkid = String(id);
  // style (最小限)
  Object.assign(el.style, {
    position:'absolute', transform:'translate(-50%, -100%)',
    minWidth:'160px', maxWidth:'240px', padding:'8px 10px',
    background:'rgba(17,24,39,0.88)', color:'#fff',
    borderRadius:'10px', boxShadow:'0 6px 16px rgba(0,0,0,.25)',
    font:'12px/1.5 system-ui, -apple-system, Segoe UI, sans-serif',
    pointerEvents:'auto', zIndex: 20
  });
  el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
      <strong style="font-size:12px;">区画 <span class="id"></span></strong>
      <button class="pin" title="ピン留め" style="all:unset;cursor:pointer;font-size:14px;">📌</button>
      <button class="close" title="閉じる" style="all:unset;cursor:pointer;font-size:14px;margin-left:4px;">✕</button>
    </div>
    <div class="main" style="margin-top:4px;font-variant-numeric:tabular-nums;">
      <div style="font-size:18px;"><span class="R">N/A</span></div>
      <div class="sub" style="opacity:.9;margin-top:2px;"></div>
    </div>`;
  return el;
}
function renderCard(el, data){
  const idEl = el.querySelector('.id'); if (idEl) idEl.textContent = data.linkid || '';
  const R = (typeof data.R === 'number') ? Math.round(data.R*100) : null;
  const Rstr = (R==null || !isFinite(R)) ? 'N/A' : `${R}%` + (R>100 ? ' 超過' : '');
  el.querySelector('.R').textContent = Rstr;
  const sub = el.querySelector('.sub');
  const flowStr = (data.flow!=null && isFinite(data.flow)) ? `${Math.round(data.flow).toLocaleString()} 台/時` : 'N/A';
  const capStr  = (data.youryou!=null && isFinite(data.youryou)) ? `${Math.round(data.youryou).toLocaleString()} 台/時` : 'N/A';
  const rem = (typeof data.R === 'number') ? Math.max(0, 1 - data.R) : null;
  const remStr = (rem==null) ? 'N/A' : `${Math.round(rem*100)}% 残`;
  // 属性パネルは常に観測値のみを表示する
  sub.innerHTML = `時刻 ${data.hour}:00 ／ 観測<br>
    交通量 ${flowStr} ／ 容量 ${capStr} ／ 残容量 ${remStr}`;
  // badge-ish: R>100%
  if (R!=null && R>100){
    el.style.outline = '2px solid rgba(239,68,68,.9)';
  } else {
    el.style.outline = 'none';
  }
}

function setSelectedFeature(id, flag){
  if (!_map || !_map.getSource('roads')) return;
  try { _map.setFeatureState({ source: (_map.getSource && _map.getSource('road-areas')) ? 'road-areas' : 'roads', id: String(id) }, { sel: !!flag }); } catch(_){}
}

function positionCard(el, lngLat){
  const p = _map.project(lngLat);
  // 画面端から16px内側に収める
  const margin = 16;
  const vw = _map.getContainer().clientWidth;
  const vh = _map.getContainer().clientHeight;
  let x = Math.min(vw - margin, Math.max(margin, p.x));
  let y = Math.min(vh - margin, Math.max(margin, p.y));
  el.style.left = `${x}px`; el.style.top = `${y}px`;
}

function clearSelection(){
  if (_selected){
    setSelectedFeature(_selected.id, false);
    const card = document.querySelector(`.inspect-card[data-linkid="${_selected.id}"]:not(.pinned)`);
    card && card.remove();
    _selected = null;
  }
}

function attachMoveReposition(){
  _map.on('move', ()=>{
    if (_selected){
      const el = document.querySelector(`.inspect-card[data-linkid="${_selected.id}"]:not(.pinned)`);
      if (el) positionCard(el, _selected.lngLat);
    }
    // pinned
    for (const v of _pinned.values()){
      if (v.el) positionCard(v.el, v.lngLat);
    }
  });
}

function handleClick(ev){
  if (isRouteEditing() || isClosurePicking()) return; // 他機能ON中はオフ
  const layers = existingLayers(_map, ['road-fill','road-outline','road-fill-poly','road-outline-poly','roads-line','roads-casing']);
  let f = null;
  if (layers.length){
    const feats = _map.queryRenderedFeatures(ev.point, { layers });
    f = feats && feats[0];
  }
  if (!f){
    // 空クリック＝解除
    clearSelection();
    return;
  }
  const linkid = String(f.id ?? f.properties?.linkid ?? f.properties?.link_id);
  const lngLat = ev.lngLat;

  // Shift+クリックでピン留め
  if (ev.shiftKey){
    if (_pinned.has(linkid)){
      const pv = _pinned.get(linkid);
      if (pv.el) pv.el.remove();
      _pinned.delete(linkid);
      setSelectedFeature(linkid, false);
      return;
    }
    const el = createCard(linkid);
    el.classList.add('pinned');
    ensureContainer().appendChild(el);
    positionCard(el, lngLat);
    const hour = getHour(); const mode = getMode();
    const data = getMetricsFor(linkid, hour, mode);
    renderCard(el, data);
    el.querySelector('.pin')?.addEventListener('click', ()=>{/* already pinned */});
    el.querySelector('.close')?.addEventListener('click', ()=>{
      el.remove(); _pinned.delete(linkid); setSelectedFeature(linkid, false);
    });
    _pinned.set(linkid, { id: linkid, lngLat, el });
    setSelectedFeature(linkid, true);
    return;
  }

  // 通常クリック＝単一選択に置き換え
  clearSelection();
  _selected = { id: linkid, lngLat };
  setSelectedFeature(linkid, true);
  const el = createCard(linkid);
  ensureContainer().appendChild(el);
  positionCard(el, lngLat);
  const hour = getHour(); const mode = getMode();
  const data = getMetricsFor(linkid, hour, mode);
  renderCard(el, data);
  // pin button -> pin this card
  el.querySelector('.pin')?.addEventListener('click', ()=>{
    el.classList.add('pinned');
    _pinned.set(linkid, { id: linkid, lngLat, el });
  });
  el.querySelector('.close')?.addEventListener('click', ()=>{
    el.remove(); setSelectedFeature(linkid, false); _selected=null;
  });
}

export function initInspector(map){
  if (INSPECTOR_DISABLED){ return; }
  _map = map;
  ensureContainer();
  attachMoveReposition();

  // Map click to pick feature
  map.on('click', handleClick);

  // ESC to clear selection
  document.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Escape') clearSelection();
  }, true);

  // 時刻スライダー変化でカード更新
  const s = document.getElementById('time-range');
  if (s){
    s.addEventListener('input', ()=>{
      // selected
      if (_selected){
        const el = document.querySelector(`.inspect-card[data-linkid="${_selected.id}"]:not(.pinned)`);
        if (el){
          const data = getMetricsFor(_selected.id, getHour(), getMode());
          renderCard(el, data);
        }
      }
      // pinned
      for (const v of _pinned.values()){
        if (v.el){
          const data = getMetricsFor(v.id, getHour(), getMode());
          renderCard(v.el, data);
        }
      }
    });
  }
}
