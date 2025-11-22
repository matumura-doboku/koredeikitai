// home-panel.js (住所検索＋地図更新＋HUD右上、通行止め=左設定/右解除/Esc/Enter終了、移動経路=起動/終了ログ＋十字カーソル)
import { HomeService } from '../domain/services/HomeService.js';

export function mountHomePanel(map, roadRepository){
  const svc = new HomeService({ map, roadRepository });

  // ---- 住所検索UI ----
  const q = document.getElementById('addr-input');
  const btnFly = document.getElementById('addr-fly');
  const results = document.getElementById('addr-results');

  function renderResults(arr){
    if (!results) return;
    results.innerHTML = '';
    for (const item of (arr || [])){
      const div = document.createElement('div');
      div.className = 'result-item';
      div.textContent = item.display_name || `${item.lat},${item.lon}`;
      div.dataset.lon = String(item.lon);
      div.dataset.lat = String(item.lat);
      div.addEventListener('click', ()=>{
        svc.flyTo(Number(div.dataset.lon), Number(div.dataset.lat));
        results.innerHTML = '';
      });
      results.appendChild(div);
    }
  }

  q?.addEventListener('keydown', async (ev)=>{
    if (ev.key !== 'Enter') return;
    const text = q.value?.trim();
    if (!text) return;
    try{
      renderResults(await svc.searchAddress(text, { limit: 5 }));
    }catch(e){
      console.warn('[home-panel] search failed:', e);
    }
  });

  btnFly?.addEventListener('click', async ()=>{
    if (!q) return;
    const text = q.value?.trim();
    if (!text) return;
    try{
      const hit = (await svc.searchAddress(text, { limit: 1 }))[0];
      if (hit) svc.flyTo(Number(hit.lon), Number(hit.lat));
    }catch(e){
      console.warn('[home-panel] fly search failed:', e);
    }
  });

  // ---- 地図更新（再計算イベントを通知）----
  const recalcIds = ['map-update','recalc','recalculate','refresh','update','update-traffic','apply','display-refresh'];
  for (const rid of recalcIds){
    const el = document.getElementById(rid);
    if (el){
      el.addEventListener('click', ()=>{
        document.dispatchEvent(new CustomEvent('calc:recalculate'));
        document.dispatchEvent(new CustomEvent('traffic:refresh'));
      });
    }
  }

  // ---- HUDログ（右上） ----
  function ensureHud(){
    let hud = document.getElementById('hud-log');
    if (!hud){
      hud = document.createElement('div');
      hud.id = 'hud-log';
      Object.assign(hud.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: '8px',
        fontSize: '12px',
        lineHeight: '1.4',
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'none',
        maxWidth: '46vw',
        textAlign: 'right'
      });
      document.body.appendChild(hud);
    }
    return hud;
  }

  function showLog(msg, ms = 1200){
    const hud = ensureHud();
    hud.textContent = msg;
    hud.style.display = 'block';
    clearTimeout(showLog._t);
    showLog._t = setTimeout(()=>{ hud.style.display = 'none'; }, ms);
  }

  // ---- カーソル管理（どちらかのモードがONなら十字） ----
  let closureOn = false;
  let routeMode = false;
  let routeLogActive = false;   // 「移動経路選択開始」ログを出した後かどうか
  function updateCursor(){
    const on = closureOn || routeMode;
    try{
      map.getCanvas().style.cursor = on ? 'crosshair' : '';
    }catch(_){}
  }

  // ---- 通行止め（左クリック=設定 / 右クリック=解除 / Esc/Enter=終了） ----
  const btnClosure = document.getElementById('closure-mode');
  const btnClear = document.getElementById('closure-clear');
  const closuresSet = new Set();

  function pickRoadFeature(point){
    let feats = [];
    try{
      feats = map.queryRenderedFeatures(point, { layers:['road-fill-poly','road-outline-poly'] });
      if (!feats.length){
        feats = map.queryRenderedFeatures(point, { layers:['road-fill','road-outline'] });
      }
    }catch(_){}
    return feats[0];
  }

  function setClosedState(id, closed){
    const sourceId = map.getSource('road-areas') ? 'road-areas' : 'roads';
    try{
      map.setFeatureState({ source: sourceId, id }, { closed });
    }catch(_){
      return;
    }
    if (closed) closuresSet.add(String(id));
    else closuresSet.delete(String(id));

    // 下流へ反映
    svc.applyClosures(Array.from(closuresSet));
    document.dispatchEvent(new CustomEvent('closures:apply', { detail:{ ids: Array.from(closuresSet) } }));
  }

  function setClosureMode(on){
    closureOn = on;
    updateCursor();
    showLog(on ? '通行止め設定' : '通行止め設定解除');
  }

  btnClosure?.addEventListener('click', ()=> setClosureMode(!closureOn));

  // Enter キーで通行止めボタンがフォーカスされていても「開始」にならないようにする
  btnClosure?.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){
      e.preventDefault();
    }
  });

  // 左クリック：設定
  map.on('click', (e)=>{
    if (!closureOn) return;
    const f = pickRoadFeature(e.point);
    if (!f) return;
    const id = String(f.id ?? f.properties?.linkid ?? '');
    if (!id) return;
    setClosedState(id, true);
  });

  // 右クリック：解除（ブラウザのコンテキストメニューを抑制）
  map.on('contextmenu', (e)=>{
    if (!closureOn) return;
    if (e.originalEvent) e.originalEvent.preventDefault?.();
    const f = pickRoadFeature(e.point);
    if (!f) return;
    const id = String(f.id ?? f.properties?.linkid ?? '');
    if (!id) return;
    setClosedState(id, false);
  });

  // Esc/Enter：モード終了（解除ログ）
  window.addEventListener('keydown', (e)=>{
    if (!closureOn) return;
    if (e.key === 'Escape' || e.key === 'Enter'){
      setClosureMode(false);
    }
  });

  // すべて解除ボタン
  btnClear?.addEventListener('click', ()=>{
    const sourceIds = ['road-areas','roads'].filter(s => map.getSource(s));
    for (const id of Array.from(closuresSet)){
      for (const src of sourceIds){
        try{
          map.setFeatureState({ source: src, id }, { closed:false });
        }catch(_){}
      }
    }
    closuresSet.clear();
    svc.clearClosures();
    document.dispatchEvent(new CustomEvent('closures:apply', { detail:{ ids: [] } }));
  });

  // ---- 移動経路（起動/終了ログ＋十字カーソル） ----

  // 既存の route-toggle.js と同じID候補を見に行く（どれが使われていても対応する）
  const routeBtnIds = ['route-mode','route-start','route','btn-route'];
  let btnRoute = null;
  for (const id of routeBtnIds){
    const el = document.getElementById(id);
    if (el){ btnRoute = el; break; }
  }
  const btnRouteEnd = document.getElementById('route-end'); // 任意の終了ボタンがある場合を想定

  // silent=true のときはHUDログを出さずに状態だけ合わせる
  function setRouteMode(on, opts = {}){
    const { silent = false } = opts;
    routeMode = !!on;
    updateCursor();
    if (!silent){
      // ログ付きで状態を変えるときのみ routeLogActive を更新
      showLog(routeMode ? '移動経路選択開始' : '移動経路選択解除');
      routeLogActive = routeMode;  // 開始ログを出したら true、解除ログを出したら false
    }
  }

  // 「移動経路選択開始」ボタン：毎回「開始」ログを出す
  btnRoute?.addEventListener('click', ()=>{
    setRouteMode(true, { silent:false });
  });

  // 任意の終了ボタンがある場合：ここでは解除ログを出す
  btnRouteEnd?.addEventListener('click', ()=> setRouteMode(false, { silent:false }));

  // カスタムイベント：内部ロジックからのモード変更ではログを出さない
  document.addEventListener('route:mode', (e)=>{
    const on = !!(e.detail && e.detail.on);
    setRouteMode(on, { silent:true });
  });
  document.addEventListener('route:end', ()=>{
    setRouteMode(false, { silent:true });
  });

  // ルート編集開始/終了イベントと同期（ボタンを押していなくてもカーソル状態を合わせる）
  window.addEventListener('route:edit:start', ()=>{
    setRouteMode(true, { silent:true });
  });
  window.addEventListener('route:edit:stop', ()=>{
    setRouteMode(false, { silent:true });
  });

  // Esc で経路モード終了（解除ログ）※Enterでは何もしない
  window.addEventListener('keydown', (e)=>{
    if (e.key !== 'Escape') return;
    // 「開始ログを出してからまだ解除ログを出していない」場合だけ解除ログを出す
    if (routeLogActive){
      setRouteMode(false, { silent:false });   // 解除ログ付き
      routeLogActive = false;
    }else{
      // それ以外はログなしで状態だけOFFに寄せておく
      if (routeMode){
        setRouteMode(false, { silent:true });
      }
    }
  });
}
