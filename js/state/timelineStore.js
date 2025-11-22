// js/state/timelineStore.js
// 再生状態とキャッシュを一元管理（軽量Pub/Sub + 先読み）
// 依存を避けるため、計算関数は外部から setCompute(handler) で注入する。
// handler({ tHH, K, closures }) → Promise<calcResult>
/* eslint-disable */

const S = {
  t: "00",                  // 現在時刻 "00".."23"
  playing: false,
  speed: 1,                 // 1,2,4...
  K: 6,                     // 伝播リング数
  closures: [],             // 通行止め linkid[]
  fps: 10,                  // 再生fps
  preload: 2,               // t±N を先読み
  cacheSize: 6,             // キャッシュ枠
  cache: new Map(),         // key -> result
  _sub: new Set(),
  _timer: null,
  _compute: null,           // async fn injected
};

export function configurePlayback(opts={}){
  if (opts.fps) S.fps = Number(opts.fps);
  if (opts.preload!=null) S.preload = Number(opts.preload);
  if (opts.cache_size!=null) S.cacheSize = Number(opts.cache_size);
}

export function getState(){ return { t:S.t, playing:S.playing, speed:S.speed, K:S.K, closures:S.closures.slice(0), fps:S.fps, preload:S.preload, cacheSize:S.cacheSize, cache:S.cache }; }
export function subscribe(fn){ S._sub.add(fn); fn(getState()); return ()=>S._sub.delete(fn); }
function emit(){ for(const fn of S._sub) try{ fn(getState()); }catch(e){ console.error(e); } }

export function setCompute(handler){ S._compute = handler; }
export function setTime(tHH){ const t = String(tHH).padStart(2,"0"); if (S.t!==t){ S.t=t; emit(); _maybePrefetch(); } }
export function setSpeed(x){ const v = Math.max(1, Number(x)||1); if (S.speed!==v){ S.speed=v; emit(); } }
export function setK(k){ const v = Math.max(1, Number(k)||1); if (S.K!==v){ S.K=v; _clearCache(); emit(); _maybePrefetch(); } }
export function setClosures(list){
  const arr = Array.isArray(list) ? list.map(x=>String(x)) : parseList(list);
  S.closures = arr;
  _clearCache(); emit(); _maybePrefetch();
}

export function play(){ if (!S.playing){ S.playing=true; _loop(); emit(); } }
export function pause(){ if (S.playing){ S.playing=false; if (S._timer) clearTimeout(S._timer); S._timer=null; emit(); } }

export function makeKey(t=S.t){ return `${t}|K=${S.K}|C=${S.closures.slice().sort().join(",")}`; }
export function recall(key){ return S.cache.get(key); }
export function remember(key, value){
  if (!value) return;
  if (S.cache.has(key)) return; // 既に格納済み
  S.cache.set(key, value);
  // LRU的にサイズ制限
  if (S.cache.size > S.cacheSize){
    const firstKey = S.cache.keys().next().value;
    S.cache.delete(firstKey);
  }
}

async function _prefetchFor(tHH){
  if (!S._compute) return;
  const key = `${tHH}|K=${S.K}|C=${S.closures.slice().sort().join(",")}`;
  if (S.cache.has(key)) return;
  try{
    const result = await S._compute({ tHH, K:S.K, closures:S.closures.slice(0) });
    remember(key, result);
  }catch(e){ console.warn("prefetch error:", e); }
}

function _maybePrefetch(){
  // 現在tとその前後 preload 分を先読み
  const h = parseInt(S.t,10);
  const todo = new Set();
  for (let i=-S.preload; i<=S.preload; i++){
    const t = ((h+i+24)%24).toString().padStart(2,"0");
    todo.add(t);
  }
  todo.forEach(t => _prefetchFor(t));
}

function _clearCache(){ S.cache.clear(); }

function _loop(){
  if (!S.playing) return;
  const stepMs = Math.max(50, 1000/Math.max(1,S.fps));
  S._timer = setTimeout(()=>{
    const next = (parseInt(S.t,10) + S.speed) % 24;
    S.t = String(next).padStart(2,"0");
    emit();
    _maybePrefetch();
    _loop();
  }, stepMs);
}

// ユーティリティ
function parseList(x){
  if (x==null) return [];
  if (Array.isArray(x)) return x.map(String);
  return String(x).split(/[,\s;]+/).map(s=>s.trim()).filter(Boolean);
}
