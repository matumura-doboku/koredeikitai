// js/tools/aoi-draw.js
export function startPolygonSelect(map, onComplete){
  const pts = [];
  let moving = null;

  function ensureTemp(){
    if(!map.getSource('aoi-temp')){
      map.addSource('aoi-temp', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
      map.addLayer({ id:'aoi-temp-fill', type:'fill', source:'aoi-temp',
        paint:{ 'fill-color':'#3b82f6','fill-opacity':0.12 } });
      map.addLayer({ id:'aoi-temp-line', type:'line', source:'aoi-temp',
        paint:{ 'line-color':'#2563eb','line-width':2 } });
      map.addLayer({ id:'aoi-temp-pts', type:'circle', source:'aoi-temp',
        paint:{ 'circle-color':'#2563eb','circle-radius':4,'circle-stroke-color':'#fff','circle-stroke-width':1.5 } });
    }
  }
  function updateTemp(){
    ensureTemp();
    const src = map.getSource('aoi-temp');
    const line = [...pts];
    if(moving) line.push(moving);
    const features = [];
    features.push({ type:'Feature', geometry:{ type:'MultiPoint', coordinates: pts }, properties:{} });
    if(line.length>=2) features.push({ type:'Feature', geometry:{ type:'LineString', coordinates: line }, properties:{} });
    if(pts.length>=3){
      const poly = [...pts, pts[0]];
      features.push({ type:'Feature', geometry:{ type:'Polygon', coordinates:[poly] }, properties:{} });
    }
    src.setData({ type:'FeatureCollection', features });
  }
  function cleanupTemp(){
    if(map.getLayer('aoi-temp-fill')) map.removeLayer('aoi-temp-fill');
    if(map.getLayer('aoi-temp-line')) map.removeLayer('aoi-temp-line');
    if(map.getLayer('aoi-temp-pts'))  map.removeLayer('aoi-temp-pts');
    if(map.getSource('aoi-temp'))     map.removeSource('aoi-temp');
  }
  function persistAOI(polygon){
    // persistent AOI layers
    if(!map.getSource('aoi')){
      map.addSource('aoi', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
      map.addLayer({ id:'aoi-fill', type:'fill', source:'aoi',
        paint:{ 'fill-color':'#60a5fa','fill-opacity':0.10 } }, 'impact-line');
      map.addLayer({ id:'aoi-line', type:'line', source:'aoi',
        paint:{ 'line-color':'#2563eb','line-width':2.5 } }, 'impact-line');
    }
    const gj = { type:'FeatureCollection', features:[{ type:'Feature', geometry: polygon, properties:{} }] };
    map.getSource('aoi').setData(gj);
  }

  const onClick=(e)=>{ pts.push([e.lngLat.lng, e.lngLat.lat]); updateTemp(); };
  const onMove=(e)=>{ moving=[e.lngLat.lng, e.lngLat.lat]; updateTemp(); };
  const onDbl=()=>finish();
  const onKey=(ev)=>{ if(ev.key==='Enter') finish(); if(ev.key==='Escape') cancel(); };

  function finish(){
    detach();
    const poly = (pts.length>=3) ? { type:'Polygon', coordinates:[ [...pts, pts[0]] ] } : null;
    cleanupTemp();
    if(poly){ persistAOI(poly); if(onComplete) onComplete(poly); }
  }
  function cancel(){ detach(); cleanupTemp(); }
  function detach(){
    map.off('click', onClick); map.off('mousemove', onMove); map.off('dblclick', onDbl);
    map.getCanvas().removeEventListener('keydown', onKey, true);
    map.getCanvas().style.cursor='';
  }

  map.getCanvas().style.cursor='crosshair';
  map.on('click', onClick); map.on('mousemove', onMove); map.on('dblclick', onDbl);
  map.getCanvas().tabIndex=0; map.getCanvas().focus({preventScroll:true});
  map.getCanvas().addEventListener('keydown', onKey, true);
}
