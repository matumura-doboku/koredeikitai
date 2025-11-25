// js/tools/closures.js
import { store } from '../state/store.js';
import { notify } from '../ui/toast.js';

let active = false;
let handler = null;

export function startClosureSelect(map){
  if(active){ stopClosureSelect(map); }
  active = true;
  map.getCanvas().style.cursor = 'crosshair';
  notify('通行止めモード：道路をクリックで選択／再クリックで解除。Escで終了。','warn');

  handler = (e)=>{
    const feats = map.queryRenderedFeatures(e.point, { layers: ['impact-line','roads-line'] });
    if(!feats || feats.length===0) return;
    const f = feats[0];
    const id = f.id ?? f.properties?.linkId;
    if(id===undefined || id===null) return;
    const key = { source: 'roads', id: id };
    const st = map.getFeatureState(key) || {};
    const nextClosed = !st.closed;
    map.setFeatureState(key, { closed: nextClosed });

    // properties側にも反映（エクスポート等で使えるように）
    try{
      const src = map.getSource('roads');
      const data = src._data || src._options?.data;
      if(data && data.features){
        const idx = data.features.findIndex(ff => (ff.id??ff.properties?.linkId) === id);
        if(idx>=0){
          data.features[idx].properties = { ...(data.features[idx].properties||{}), _closed: nextClosed };
          src.setData(data);
        }
      }
    }catch(_e){}

    // storeにも保持（linkIdベース）
    const lid = String(f.properties?.linkId ?? id);
    const set = new Set(store.closures.map(String));
    if(nextClosed) set.add(lid); else set.delete(lid);
    store.closures = Array.from(set);;

    // mirror to global
    window.__CLOSURES = Array.from(set);
    try { document.dispatchEvent(new CustomEvent('closures:changed', { detail: window.__CLOSURES })); } catch(_e) {}

  };

  const onKey = (ev)=>{ if(ev.key==='Escape'){ stopClosureSelect(map); notify('通行止めモードを終了。','ok'); } };
  map.on('click', handler);
  map.getCanvas().tabIndex = 0;
  map.getCanvas().focus({preventScroll:true});
  map.getCanvas().addEventListener('keydown', onKey, { once:true });
}

export function stopClosureSelect(map){
  if(!active) return;
  active = false;
  if(handler){ map.off('click', handler); handler = null; }
  map.getCanvas().style.cursor = '';
}
