
// js/aoi-draw.js
// Civil3D風のポリライン/ポリゴン描画 + 計測 + バッファ（任意）
// 依存: なし（HTMLCanvasまたは任意の地図と併用）

/**
 * @typedef {Object} Projection
 * @property {(lngLat:{lng:number,lat:number})=>{x:number,y:number}} project  // WGS84 -> screen
 * @property {(pt:{x:number,y:number})=>{lng:number,lat:number}} unproject  // screen -> WGS84
 */

/**
 * @param {Object} opts
 * @param {HTMLCanvasElement} opts.canvas       描画先（マップ上の最前面に重ねてください）
 * @param {Projection} opts.proj               地図の座標変換関数
 * @param {'polygon'|'polyline'} [opts.mode]   既定は 'polygon'
 * @param {number} [opts.bufferMeters]         ライブバッファの太さ（省略可）
 * @param {(geojson:object)=>void} [opts.onComplete]  確定時に呼ばれる
 */
export class AOIDraw {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.proj = opts.proj;
    this.mode = opts.mode || 'polygon';
    this.bufferMeters = opts.bufferMeters ?? 0;
    this.onComplete = opts.onComplete;
    this.pointsScreen = []; // [{x,y}]
    this.active = false;
    this._bind();
    this._render();
  }

  _bind() {
    this._onClick = (e) => {
      if (!this.active) return;
      const rect = this.canvas.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const q = this._maybeSnap(p, e);
      this.pointsScreen.push(q);
      this._render();
    };
    this._onKey = (e) => {
      if (!this.active) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.pointsScreen.pop();
        this._render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this._complete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    };
    this.canvas.addEventListener('click', this._onClick);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', () => this._render());
  }

  start(mode) {
    if (mode) this.mode = mode;
    this.active = true;
    this.pointsScreen = [];
    this._render();
  }

  cancel() {
    this.active = false;
    this.pointsScreen = [];
    this._render();
  }

  isActive() { return this.active; }

  _maybeSnap(p, e) {
    if (e.shiftKey && this.pointsScreen.length) {
      const prev = this.pointsScreen[this.pointsScreen.length - 1];
      const dx = p.x - prev.x, dy = p.y - prev.y;
      if (Math.abs(dx) > Math.abs(dy)) return { x: p.x, y: prev.y }; // 水平
      else return { x: prev.x, y: p.y }; // 垂直
    }
    return p;
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width = this.canvas.clientWidth;
    const h = this.canvas.height = this.canvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    // 背景モード表示
    if (this.active) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,w,h);
      ctx.restore();
    }

    if (!this.pointsScreen.length) return;

    // 線描画
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00aaff';
    ctx.fillStyle = 'rgba(0,170,255,0.12)';
    ctx.beginPath();
    this.pointsScreen.forEach((p,i)=> i? ctx.lineTo(p.x,p.y): ctx.moveTo(p.x,p.y));
    if (this.mode === 'polygon' && this.pointsScreen.length > 2) {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();

    // 頂点
    for (const p of this.pointsScreen) {
      ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#00aaff'; ctx.stroke();
    }
    ctx.restore();

    // 計測表示
    const metrics = this._measure();
    if (metrics) {
      ctx.save();
      ctx.fillStyle = '#222';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      const text = (this.mode === 'polygon')
        ? `面積: ${formatArea(metrics.area)} / 周長: ${formatLen(metrics.length)}`
        : `延長: ${formatLen(metrics.length)}`;
      ctx.font = '12px sans-serif';
      ctx.strokeText(text, 10, 20);
      ctx.fillText(text, 10, 20);
      ctx.restore();
    }
  }

  _screenToLngLat(p) { return this.proj.unproject(p); }
  _lngLatToScreen(ll) { return this.proj.project(ll); }

  _measure() {
    if (this.pointsScreen.length < 2) return null;
    // 距離は簡易に平面距離（画面→地理へ落とす）。実運用では投影座標で算出してください。
    const ll = this.pointsScreen.map(p=>this._screenToLngLat(p));
    const length = polylineLength(ll);
    let area = 0;
    if (this.mode === 'polygon' && ll.length >= 3) area = polygonArea(ll);
    return { length, area };
  }

  _complete() {
    if (!this.pointsScreen.length) return;
    const ll = this.pointsScreen.map(p=>this._screenToLngLat(p)).map(({lng,lat})=>[lng,lat]);
    let geo;
    if (this.mode === 'polygon') {
      if (ll.length < 3) return;
      geo = { type:'Feature', geometry:{ type:'Polygon', coordinates:[ closeRing(ll) ] }, properties:{} };
    } else {
      geo = { type:'Feature', geometry:{ type:'LineString', coordinates: ll }, properties:{} };
    }
    this.onComplete?.(geo);
    this.cancel();
  }

  getGeoJSON() {
    const ll = this.pointsScreen.map(p=>this._screenToLngLat(p)).map(({lng,lat})=>[lng,lat]);
    if (this.mode === 'polygon' && ll.length >= 3) {
      return { type:'Feature', geometry:{ type:'Polygon', coordinates:[ closeRing(ll) ] }, properties:{} };
    }
    if (this.mode === 'polyline' && ll.length >= 2) {
      return { type:'Feature', geometry:{ type:'LineString', coordinates: ll }, properties:{} };
    }
    return null;
    }
}

// --- 計測ユーティリティ（WGS84・近似） ---
const R = 6378137;
function hav(d){return Math.sin(d/2)**2;}
function toRad(d){return d*Math.PI/180;}
function dist(a,b){
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const H = hav(dLat)+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*hav(dLng);
  return 2*R*Math.asin(Math.sqrt(H));
}
function polylineLength(ll){
  let sum=0;
  for (let i=1;i<ll.length;i++) {
    const a = {lng: ll[i-1][0], lat: ll[i-1][1]};
    const b = {lng: ll[i][0], lat: ll[i][1]};
    sum += dist(a,b);
  }
  return sum;
}
function polygonArea(ll){
  // 球面多角形の近似（小面積前提）: 投影簡易式
  let area=0;
  for (let i=0;i<ll.length;i++) {
    const [x1,y1]=ll[i], [x2,y2]=ll[(i+1)%ll.length];
    area += toRad(x2-x1) * (2 + Math.sin(toRad(y1)) + Math.sin(toRad(y2)));
  }
  return Math.abs(area)*R*R/2;
}
function closeRing(ll){
  const first = ll[0], last = ll[ll.length-1];
  if (first[0]===last[0] && first[1]===last[1]) return ll;
  return ll.concat([first]);
}
function formatLen(m){ return (m>1000? (m/1000).toFixed(2)+' km': m.toFixed(1)+' m'); }
function formatArea(a){
  return (a>1e6? (a/1e6).toFixed(2)+' km²' : a.toFixed(1)+' m²');
}
