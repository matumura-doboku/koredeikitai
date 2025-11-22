import { createReportAggregator } from '../report/ReportAggregator.js';

/**
 * レポートパネル — AFTER再インデックス対応（runnerは無改変）
 * - after(traffic,R) ← window.__CALC_RESULT.byLink を「linkidキー」に再インデックスして参照
 * - before(traffic,R) ← CSV（koutuuryou[hour], youryou）
 * - linkid は properties.* 優先で統一
 */
export function mountReportPanel(map, { trafficRepo = null } = {}) {

  let latestClosures = [];
  let snapshotAfter = null; // ← 再インデックス後の辞書を保持

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  // --- 計算後フィールド名の自動検出（report-panel.js 単独対応） ---
  let __afterKeyCache = null; // { trafficKey, rKey } を保持

  function detectAfterKeys(by){
const isNum = (x)=> x != null && Number.isFinite(Number(x));
    const sample = Object.values(by || {}).find(v => v && typeof v === 'object') || {};
    const pickWL = (obj, cands)=> cands.find(k => (k in obj) && isNum(obj[k])) || null;
    // ホワイトリスト一致のみ採用。id系は候補に含めない。
    const trafficKey = pickWL(sample, ['traffic','value','flow','vol','q','t','after_traffic','traffic_after','q_after']);
    const rKey       = pickWL(sample, ['R','r','ratio','vc','V_C','V/C','r_after','R_after']);
    return { trafficKey, rKey };
}


  function preferPropLinkId(props, fallbackId){
    const cand = props?.linkid ?? props?.link_id ?? props?.linkId ?? props?.LINKID;
    return String((cand != null && cand !== '') ? cand : fallbackId);
  }

  // ---- Road FeatureCollection 取得（id を properties 優先で正規化） ----
  function getRoadFC() {
    try {
      const src = map.getSource && map.getSource('roads');
      if (src && typeof src.serialize === 'function') {
        const ser = src.serialize();
        if (ser?.data?.type === 'FeatureCollection') {
          return {
            type: 'FeatureCollection',
            features: (ser.data.features || []).map(f => ({
              ...f,
              id: preferPropLinkId(f.properties || {}, f.id)
            }))
          };
        }
      }
    } catch (_) {}

    try {
      const feats = map.querySourceFeatures?.('roads') || [];
      return {
        type: 'FeatureCollection',
        features: feats.map(f => ({
          type: 'Feature',
          id: preferPropLinkId(f.properties, f.id),
          properties: f.properties,
          geometry: f.geometry
        }))
      };
    } catch (_) {}

    const fc = window.__ROAD_FC || { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: (fc.features || []).map(f => ({
        ...f,
        id: preferPropLinkId(f.properties || {}, f.id)
      }))
    };
  }

  /** 生ID(f.id) → 本来の linkid の対応表を作る */
  function buildIdMapping(){
    const fc = getRoadFC();
    const mapRawToLinkid = new Map();
    for (const f of (fc.features || [])){
      const raw = String(f.id);
      const canon = preferPropLinkId(f.properties || {}, f.id);
      if (raw && canon) mapRawToLinkid.set(raw, String(canon));
    }
    return mapRawToLinkid;
  }

  /** __CALC_RESULT.byLink を linkid キーに再インデックス */
  function reindexByLinkid(by){
    const out = {};
    if (!by) return out;
    const m = buildIdMapping();

    for (const k of Object.keys(by)){
      const canon = m.get(String(k));
      const key = String(canon || k);
      // 数値/文字列の揺れも吸収
      out[String(key)] = by[k];
    }
    return out;
  }

  // ---- after (runner結果) ----
  function getAfterDictReindexed() {
    const res = window.__CALC_RESULT || {};
    const by = res.byLink || {};
    return reindexByLinkid(by);
  }

  // ---- before (CSV結果) ----
  function getBeforeDict() {
    if (trafficRepo?.dumpBase) return trafficRepo.dumpBase();
    return window.__TRAFFIC_BY_ID || window.__TRAFFIC_BEFORE || {};
  }

  function pickHour() {
    const fromInput = document.getElementById('report-hour');
    const hv = fromInput ? Number(fromInput.value) : NaN;
    if (Number.isFinite(hv) && hv >= 0 && hv <= 23) return hv;
    const g = Number(window.__REPORT_HOUR);
    if (Number.isFinite(g) && g >= 0 && g <= 23) return g;
    return 0;
  }

  function getKoutuuryouAt(v, hour) {
    if (!v) return null;

    if (Array.isArray(v.koutuuryou)) return num(v.koutuuryou[hour]);
    if (v.koutuuryou && typeof v.koutuuryou === 'object') {
      const x = num(v.koutuuryou[String(hour)]);
      if (x != null) return x;
      const hh = String(hour).padStart(2,'0');
      const y = num(v.koutuuryou[hh]);
      if (y != null) return y;
    }

    const h  = String(hour);
    const hh = h.padStart(2,'0');
    const keys = [
      `koutuuryou_${h}`,  `koutuuryou${h}`,
      `koutuuryou_${hh}`,`koutuuryou${hh}`,
      `kouturyou_${h}`,  `kouturyou${h}`,
      `kouturyou_${hh}`, `kouturyou${hh}`,
      `kotsuryou_${h}`,  `kotsuryou${h}`,
      `kotsuryou_${hh}`, `kotsuryou${hh}`,
    ];
    for (const k of keys){
      if (k in v) {
        const val = num(v[k]);
        if (val != null) return val;
      }
    }
    return null;
  }

  function toCSV(rows) {
    const header = ['linkid','dist_m','traffic_before','traffic_after','R_before','R_after','dR'];
    const esc = x => (x == null ? '' : String(x).replace(/"/g, '""'));
    const lines = rows.map(r => [
      esc(r.linkid),
      esc(r.dist_m),
      esc(r.traffic_before),
      esc(r.traffic_after),
      esc(r.R_before),
      esc(r.R_after),
      esc(r.dR)
    ].join(','));
    return [header.join(','), ...lines].join('\n');
  }

  function buildAggregator() {
    return createReportAggregator({
      map,

      // after: 再インデックス済み辞書を参照（traffic|value, R|r を許容）
      getAfter(id) {
        
        const by = snapshotAfter || getAfterDictReindexed();

        // 再検出キャッシュがない場合は作る（存在すればそのまま）
        if (!__afterKeyCache && typeof detectAfterKeys === 'function') {
          __afterKeyCache = detectAfterKeys(by);
        }

        let v = by[String(id)];
        if (!v) {
          // roads準備前にreindexされた可能性があるので、都度再インデックス
          const latest = getAfterDictReindexed();
          if (latest && latest !== by) {
            snapshotAfter = latest;
            __afterKeyCache = null; // 新辞書で再検出
          }
          v = (snapshotAfter || latest || {})[String(id)];
          if (!v) return null;
        }

        // id系キーは誤検出しない
        const __isBadKey = (k) => !!k && /(?:^|[_-])(?:id|linkid)$|id$/i.test(String(k));
        if (window.__afterKeyCache) {
          if (__isBadKey(window.__afterKeyCache.trafficKey)) window.__afterKeyCache.trafficKey = null;
          if (__isBadKey(window.__afterKeyCache.rKey)) window.__afterKeyCache.rKey = null;
        }

        // ---- 交通量(traffic) 候補 ----
        const candTrafficKeys = [
          window.__afterKeyCache && window.__afterKeyCache.trafficKey,
          'traffic','value','flow','vol','q','t',
          // runnerの出力に合わせて方向別の候補も許容
          'ue','sita'
        ].filter(Boolean);

        let traffic = null;
        for (const k of candTrafficKeys) {
          if (v && v[k] != null && Number.isFinite(Number(v[k]))) { traffic = Number(v[k]); break; }
        }

        // ---- R値 候補 ----
        const candRKeys = [
          window.__afterKeyCache && window.__afterKeyCache.rKey,
          'R','r','ratio','vc','V_C','V/C',
          // runnerの出力に合わせて最大/方向別Rも許容
          'R_max','R_ue','R_sita'
        ].filter(Boolean);

        let R = null;
        for (const k of candRKeys) {
          if (v && v[k] != null && Number.isFinite(Number(v[k]))) { R = Number(v[k]); break; }
        }

        // ---- 交通量が無いが R と 容量(youryou) がある場合は、traffic = R * youryou を推定 ----
        if ((traffic == null || !Number.isFinite(Number(traffic))) && (R != null) ) {
          const cap = (v && Number.isFinite(Number(v.youryou))) ? Number(v.youryou) : null;
          if (cap != null) {
            traffic = R * cap;
          }
        }

        // 最後の保険：両方とも取れなかった場合は null を返す
        const toNum = (x)=> (Number.isFinite(Number(x)) ? Number(x) : null);
        return { traffic: toNum(traffic), R: toNum(R) };

      },

      // before: CSV （traffic=koutuuryou[hour], R=traffic/youryou）
      getBefore(id) {
        const by = getBeforeDict();
        const v = by[String(id)];
        if (!v) return null;
        const hour = pickHour();
        const traffic = getKoutuuryouAt(v, hour);
        const youryou = num(v.youryou ?? v.capacity ?? v.cap);
        const R = (traffic != null && youryou && youryou > 0) ? +(traffic / youryou) : null;
        return { traffic, R };
      },

      roadFeatureCollection: getRoadFC()
    });
  }

  // ---- イベント ----
  document.addEventListener('closures:apply', e => {
    latestClosures = e?.detail?.ids?.map(String) || [];
  });

  // 計算更新時に AFTER を linkid キーへ再インデックスして保持
  document.addEventListener('traffic:refresh', () => {
    snapshotAfter = getAfterDictReindexed();
    __afterKeyCache = null; // 再検出させる
  });

  // ---- UI ----
  document.addEventListener('click', ev => {
    const csvBtn = ev.target.closest('#export-csv');
    if (csvBtn) {
      ev.preventDefault();
      const radius = Number(document.getElementById('report-radius')?.value || 500);

      if (!snapshotAfter || !Object.keys(snapshotAfter).length)
        snapshotAfter = getAfterDictReindexed(); // 念のため直前でも再構築

      const centers = latestClosures.length ? latestClosures : (window.__CLOSURES || []);
      const rows = buildAggregator().build({ centerIds: centers, radiusM: radius });
      const csv = toCSV(rows);

      const blob = new Blob([csv], { type:'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `impact-report-r${radius}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }
  });
}
