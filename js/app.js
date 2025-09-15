const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      gsi_std: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© 国土地理院'
      }
    },
    layers: [{ id: 'gsi_std', type: 'raster', source: 'gsi_std' }]
  },
  center: [139.767, 35.681],
  zoom: 12,
  hash: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));

const drawer = document.getElementById('drawer');
document.getElementById('drawerToggle').addEventListener('click', () => {
  drawer.classList.toggle('open');
});
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});
function toggleButton(id){ document.getElementById(id).classList.toggle('active'); }
document.getElementById('tool-aoi').addEventListener('click', ()=>toggleButton('tool-aoi'));
document.getElementById('tool-closure').addEventListener('click', ()=>toggleButton('tool-closure'));
document.getElementById('tool-category').addEventListener('click', ()=>toggleButton('tool-category'));

const GRID_SRC_ID = 'grid-src', GRID_FILL_ID='grid-fill', GRID_LINE_ID='grid-line';
let gridOn = false, cellSizeM = 250;
function metersToLngLatDelta(lat, metersX, metersY){
  const dLat = metersY / 111320;
  const dLng = metersX / (111320 * Math.cos(lat * Math.PI/180));
  return [dLng, dLat];
}
function buildGridGeoJSON(bounds, cellSizeM){
  const [w, s, e, n] = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  const lat0 = (s + n) / 2;
  const [dLng, dLat] = metersToLngLatDelta(lat0, cellSizeM, cellSizeM);
  const lngStart = Math.floor(w / dLng) * dLng;
  const latStart = Math.floor(s / dLat) * dLat;
  const features = [];
  for(let lng=lngStart; lng<e+dLng; lng+=dLng){
    for(let lat=latStart; lat<n+dLat; lat+=dLat){
      const poly = [[lng,lat],[lng+dLng,lat],[lng+dLng,lat+dLat],[lng,lat+dLat],[lng,lat]];
      features.push({type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[poly]}});
    }
  }
  return {type:'FeatureCollection', features};
}
function addOrUpdateGrid(){
  const geo = buildGridGeoJSON(map.getBounds(), cellSizeM);
  if(!map.getSource(GRID_SRC_ID)){
    map.addSource(GRID_SRC_ID, {type:'geojson', data:geo});
    map.addLayer({id:GRID_FILL_ID, type:'fill', source:GRID_SRC_ID,
      paint:{'fill-color':'#000','fill-opacity':0.04}});
    map.addLayer({id:GRID_LINE_ID, type:'line', source:GRID_SRC_ID,
      paint:{'line-color':'#444','line-width':0.5,'line-opacity':0.35}});
  }else{
    map.getSource(GRID_SRC_ID).setData(geo);
  }
}
function removeGrid(){
  if(map.getLayer(GRID_LINE_ID)) map.removeLayer(GRID_LINE_ID);
  if(map.getLayer(GRID_FILL_ID)) map.removeLayer(GRID_FILL_ID);
  if(map.getSource(GRID_SRC_ID)) map.removeSource(GRID_SRC_ID);
}
document.getElementById('tool-grid').addEventListener('click', ()=>{
  gridOn = !gridOn;
  document.getElementById('tool-grid').classList.toggle('active');
  if(gridOn){
    addOrUpdateGrid();
    map.on('moveend', addOrUpdateGrid);
  }else{
    map.off('moveend', addOrUpdateGrid);
    removeGrid();
  }
});

const times = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00"];
let ti = 6;
const timeLabel = document.getElementById('timeLabel');
function updateTime(){ timeLabel.textContent = times[ti]; }
document.getElementById('timePrev').addEventListener('click', ()=>{ ti=(ti-1+times.length)%times.length; updateTime(); });
document.getElementById('timeNext').addEventListener('click', ()=>{ ti=(ti+1)%times.length; updateTime(); });
let playing = false, timer=null;
document.getElementById('timePlay').addEventListener('click', ()=>{
  playing = !playing;
  const btn = document.getElementById('timePlay');
  btn.textContent = playing ? "⏸" : "▶";
  if(playing){ timer = setInterval(()=>{ ti=(ti+1)%times.length; updateTime(); }, 1000); }
  else{ clearInterval(timer); }
});
updateTime();

const history = [
  {id: 101, at: "2025-09-11 12:10", grid:"250m", closures:1, note:"テスト実行"},
  {id: 102, at: "2025-09-11 12:35", grid:"250m", closures:3, note:"通行止め3区間"},
  {id: 103, at: "2025-09-11 13:05", grid:"100m", closures:2, note:"細分グリッド"}
];
const list = document.getElementById('historyList');
history.forEach(r=>{
  const li = document.createElement('li');
  li.textContent = `#${r.id} | ${r.at} | グリッド:${r.grid} | 閉鎖:${r.closures} | ${r.note}`;
  list.appendChild(li);
});
document.getElementById('metric').addEventListener('change', e=>{
  const m = e.target.value;
  const title = m === 'traffic' ? '交通量' : (m === 'noise' ? '騒音' : 'CO₂');
  document.getElementById('legendTitle').textContent = title;
});
