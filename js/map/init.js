// js/map/init.js (patched)
// - Use correct GSI XYZ URL with layer name `std`
// - Constrain maxzoom to 18 to avoid 404 tile fetches
export function initBaseMap(){
  const style = {
    version: 8,
    sources: {
      gsi: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        attribution: '地理院タイル'
      }
    },
    layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }]
  };

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: [132.455, 34.385],
    zoom: 9,
    maxZoom: 18
  });

  // Double guard: if style is replaced later, still cap zoom.
  try{ map.setMaxZoom(18); }catch(e){}

  return map;
}


import { bindRouteEditing, updateTrafficStyle } from './layers.js';
export function afterMapLoaded(map){
  try { bindRouteEditing(map); } catch(e){ /* no-op */ }

  // 計算前/計算後 表示切替イベントに応じて道路スタイルを更新
  try{
    document.addEventListener('traffic:render', (ev)=>{
      const detail = ev.detail || {};
      try{
        updateTrafficStyle(map, detail);
      }catch(e){}
    });
  }catch(e){}
}
