// js/ui/calc-panel.js  (Enter finalize + robust enable for Run button)
export function mountCalcPanel(){
  const btnRun = document.getElementById('btn-run');

  // ---- route getters ----
  function getRouteLinkIds(){
    const rs = (window.routeStore && window.routeStore.state) ? window.routeStore.state : null;
    const cands = [
      rs?.linkIds,
      rs?.route?.linkIds,
      rs?.selected?.linkIds,
      (typeof window.routeStore?.get === 'function') ? window.routeStore.get('linkIds') : null,
      (typeof window.routeStore?.toJSON === 'function') ? window.routeStore.toJSON()?.linkIds : null,
      window.__DETOUR_PATH,
    ].filter(Boolean);
    for (const v of cands){
      if (Array.isArray(v) && v.length) return v;
    }
    return [];
  }

  // ---- enable/disable run button ----
  function enableRun(force=false){
    if (!btnRun) return;
    if (force){ btnRun.disabled = false; return; }
    const hasRoute = getRouteLinkIds().length > 0;
    btnRun.disabled = !hasRoute;
  }

  // reflect state on events
  const reflectRouteState = ()=> enableRun(false);
  window.addEventListener('route:changed', reflectRouteState);
  window.addEventListener('route:finalized', ()=>{ enableRun(true); }); // finalizeで必ず有効化
  try { window.routeStore?.on?.('change', reflectRouteState); } catch(e) {}
  try { window.routeStore?.subscribe?.(reflectRouteState); } catch(e) {}

  // initial reflect + short polling (to absorb init timing)
  enableRun(false);
  let poll=0; const tm = setInterval(()=>{ enableRun(false); if(++poll>=10) clearInterval(tm); }, 300);

  // ---- Enter to finalize route ----
  const onEnter = (ev)=>{
    if (ev.key !== 'Enter') return;
    const ids = getRouteLinkIds();
    if (!ids.length) return;
    try { window.routeStore?.finalize?.(); } catch(e) {}
    enableRun(true);
    try { btnRun?.focus(); } catch(e) {}
  };
  window.addEventListener('keydown', onEnter, { capture:true });
  window.addEventListener('keyup', onEnter, { capture:true });

  // ---- closures sync (keep in calc panel for robustness) ----
  document.addEventListener('closures:apply', (e)=>{
    const ids = (e?.detail?.ids || []);
    try { window.__CLOSURES = Array.from(ids); } catch(_) { window.__CLOSURES = []; }
  });

  // ---- run ----
  btnRun?.addEventListener('click', ()=>{
    const linkIds = getRouteLinkIds();
    if (!linkIds.length) return;
    const hour = Number(document.getElementById('time-range')?.value || 0);
    const K = Number(document.getElementById('k-range')?.value || 3);
    const dir  = document.querySelector('input[name="dir"]:checked')?.value || 'up';
    const closures = (window.__CLOSURES || []);
    document.dispatchEvent(new CustomEvent('calc:run', { detail:{ hour, K, dir, closures, detourPaths:[linkIds] } }));
  });

  // ---- time label sync (kept) ----
  const t = document.getElementById('time-range');
  const label = document.getElementById('time-label');
  if (t && label){
    const sync = () => label.textContent = String(Number(t.value)).padStart(2,'0');
    t.addEventListener('input', sync);
    sync();
  }

  // ---- preview handler (kept) ----
  document.getElementById('show-traffic')?.addEventListener('click', ()=>{
    const mode = document.querySelector('input[name="view-mode"]:checked')?.value || 'before';
    const dir  = document.querySelector('input[name="dir"]:checked')?.value || 'up';
    const hour = Number(document.getElementById('time-range')?.value || 0);
    document.dispatchEvent(new CustomEvent('traffic:render', { detail:{ mode, dir, hour } }));
  });


  // ==== Traffic / R helper for display (before/after with fallback) ====

  // safe numeric cast
  const __num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // hour: explicit > slider > 0
  function __pickHourForDisplay(hourOverride){
    if (Number.isFinite(hourOverride) && hourOverride >= 0 && hourOverride <= 23){
      return hourOverride;
    }
    const slider = Number(document.getElementById('time-range')?.value);
    if (Number.isFinite(slider) && slider >= 0 && slider <= 23){
      return slider;
    }
    return 0;
  }

  // ---- BEFORE side helpers ----
  function __getBeforeDict(){
    return window.__TRAFFIC_BY_ID || window.__TRAFFIC_BEFORE || {};
  }

  // simplified copy of report-panel.js getKoutuuryouAt
  function __getKoutuuryouAt(rec, hour){
    if (!rec) return null;

    // 1) array
    if (Array.isArray(rec.koutuuryou)){
      return __num(rec.koutuuryou[hour]);
    }

    // 2) object { '0': xx, '1': xx }
    if (rec.koutuuryou && typeof rec.koutuuryou === 'object'){
      const v = rec.koutuuryou[String(hour)];
      if (v != null) return __num(v);
    }

    // 3) flat keys like koutuuryou_14
    const suf = String(hour).padStart(2, '0');
    const candKeys = [
      `koutuuryou_${suf}`,
      `koutuuryou${suf}`,
      `kotsuuryou_${suf}`,
      `kotsuuryou${suf}`,
      `kouturyou_${suf}`,
      `kouturyou${suf}`,
    ];
    for (const k of candKeys){
      if (rec[k] != null) return __num(rec[k]);
    }

    return null;
  }

  function __getBeforeTrafficR(linkid, hourOverride){
    const by = __getBeforeDict() || {};
    const rec = by[String(linkid)];
    if (!rec) return { traffic:null, R:null };

    const hour = __pickHourForDisplay(hourOverride);
    const traffic = __getKoutuuryouAt(rec, hour);
    const youryou = __num(rec.youryou ?? rec.capacity ?? rec.cap);
    const R = (traffic != null && youryou && youryou > 0) ? Number(traffic / youryou) : null;

    return { traffic, R };
  }

  // ---- AFTER side helpers ----
  let __afterReindexedCache = null;

  function __preferPropLinkId(props, fallbackId){
    if (!props) return String(fallbackId ?? '');
    const cand = props.linkid ?? props.link_id ?? props.linkId ?? props.LINKID;
    if (cand != null && cand !== '') return String(cand);
    return String(fallbackId ?? '');
  }

  function __buildAfterReindexed(){
    const base = (window.__CALC_RESULT && window.__CALC_RESULT.byLink) || {};
    const out = {};
    const fc = window.__ROAD_FC;

    // build id -> linkid map if we have road features
    const id2link = new Map();
    if (fc && Array.isArray(fc.features)){
      for (const f of fc.features){
        const props = f.properties || {};
        const linkid = __preferPropLinkId(props, f.id);
        if (f.id != null && linkid != null){
          id2link.set(String(f.id), String(linkid));
        }
      }
    }

    for (const k of Object.keys(base)){
      const rec = base[k];
      const lk = id2link.get(String(k)) || String(k);
      out[String(lk)] = rec;
    }
    return out;
  }

  function __getAfterDictReindexed(){
    if (__afterReindexedCache) return __afterReindexedCache;
    __afterReindexedCache = __buildAfterReindexed();
    return __afterReindexedCache;
  }

  function __extractAfterTrafficR(rec){
    if (!rec) return { traffic:null, R:null };

    const trafficKeys = [
      'traffic','value','flow','vol','q','t',
      'after_traffic','traffic_after',
      'ue','sita'
    ];
    let traffic = null;
    for (const k of trafficKeys){
      if (rec[k] != null && Number.isFinite(Number(rec[k]))){
        traffic = Number(rec[k]);
        break;
      }
    }

    const rKeys = [
      'R','r','ratio','vc','V_C','V/C',
      'R_max','R_ue','R_sita'
    ];
    let R = null;
    for (const k of rKeys){
      if (rec[k] != null && Number.isFinite(Number(rec[k]))){
        R = Number(rec[k]);
        break;
      }
    }

    // if no traffic but R * capacity is available, reconstruct traffic
    if ((traffic == null || !Number.isFinite(traffic)) && (R != null && Number.isFinite(R))){
      const youryou = __num(rec.youryou ?? rec.capacity ?? rec.cap);
      if (youryou && youryou > 0){
        traffic = Number(R * youryou);
      }
    }

    if (!Number.isFinite(traffic)) traffic = null;
    if (!Number.isFinite(R)) R = null;

    return { traffic, R };
  }

  function __getAfterTrafficR(linkid, hourOverride){
    // hourOverride is accepted for symmetry, but after側は record 内の値をそのまま使う
    void hourOverride; // unused
    const by = __getAfterDictReindexed() || {};
    const rec = by[String(linkid)];
    if (!rec) return { traffic:null, R:null };
    return __extractAfterTrafficR(rec);
  }

  /**
   * 公開ヘルパ:
   *   mode  : 'before' | 'after'
   *   linkid: 表示対象リンクID
   *   dir   : 'up' | 'down'  (現状未使用だが将来のために受け取る)
   *   hour  : 0-23 (省略時はスライダー値)
   *
   *   返り値: { traffic, R, source }
   *     source: 'before' | 'after' | 'before-fallback' | 'none'
   */
  function getTrafficRForDisplay(opts){
    const o = opts || {};
    const mode = o.mode || 'before';
    const linkid = o.linkid;
    const hour = __pickHourForDisplay(o.hour);
    const dir = o.dir || 'up';
    void dir; // not yet used

    if (linkid == null){
      return { traffic:null, R:null, source:'none' };
    }

    const before = __getBeforeTrafficR(linkid, hour) || { traffic:null, R:null };

    if (mode === 'before'){
      return { traffic: before.traffic, R: before.R, source:'before' };
    }

    const after = __getAfterTrafficR(linkid, hour) || { traffic:null, R:null };
    if (after.traffic != null && Number.isFinite(after.traffic)){
      return { traffic: after.traffic, R: after.R, source:'after' };
    }

    // 計算範囲外などで after が無い場合は before をそのまま表示
    return { traffic: before.traffic, R: before.R, source:'before-fallback' };
  }

  // グローバルに公開（地図描画など別ファイルから利用する想定）
  try {
    window.getTrafficRForDisplay = getTrafficRForDisplay;
  } catch(e) {
    // ignore
  }


}
