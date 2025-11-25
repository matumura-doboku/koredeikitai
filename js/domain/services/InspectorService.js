// js/domain/services/InspectorService.js
// CSV/GeoJSONから必要項目を集約してRや残容量%を算出する軽量サービス。
// 可能な限り既存のグローバルを使い、列名ゆらぎに耐える。

function buildFeatureIndex(){
  const fc = (window.__ROAD_FC || { type:'FeatureCollection', features:[] });
  if (!window.__ROAD_FEATURE_BY_ID){
    window.__ROAD_FEATURE_BY_ID = {};
    for (const f of (fc.features||[])){
      const id = String(f.id || f.properties?.linkid || f.properties?.link_id || '');
      if (id) window.__ROAD_FEATURE_BY_ID[id] = f;
    }
  }
  return window.__ROAD_FEATURE_BY_ID;
}

function pickHourly(rec, hour, candidates){
  // 例：['calc','trf','traffic','koutuuryou','vol'] -> 'calc_8' or 'koutuuryou08' 等
  const h2 = String(hour).padStart(2, '0');
  for (const p of candidates){
    const k1 = `${p}_${hour}`;   // calc_8
    const k2 = `${p}_${h2}`;     // calc_08
    const k3 = `${p}${hour}`;    // koutuuryou8
    const k4 = `${p}${h2}`;      // koutuuryou08
    if (rec[k1]!=null) return Number(rec[k1]);
    if (rec[k2]!=null) return Number(rec[k2]);
    if (rec[k3]!=null) return Number(rec[k3]);
    if (rec[k4]!=null) return Number(rec[k4]);
  }
  return null;
}

function getFlow(linkid, hour, mode){
  const r = (window.__TRAFFIC_BY_ID || {})[String(linkid)] || {};
  if (mode === 'calc'){
    // 優先：直近計算結果
    const calcByLink = (window.__RESULT_BY_LINK || {})[String(linkid)] || null;
    if (calcByLink && calcByLink.calc && Array.isArray(calcByLink.calc)){
      const v = calcByLink.calc[hour];
      if (v!=null) return Number(v);
    }
    // CSVから候補
    const v2 = pickHourly(r, hour, ['calc','calcflow','recalc','est']);
    if (v2!=null) return v2;
  }
  // 観測系列
  const v3 = pickHourly(r, hour, ['trf','traffic','koutuuryou','flow','obs']);
  return (v3!=null) ? v3 : null;
}

function getCapacity(linkid){
  // 1) CSV youryou -> 2) GeoJSON properties.youryou -> 3) 簡易推定（線種×車線）
  const rec = (window.__TRAFFIC_BY_ID || {})[String(linkid)] || {};
  if (rec.youryou!=null) return Number(rec.youryou);

  const f = (buildFeatureIndex()[String(linkid)] || {});
  const props = f.properties || {};
  if (props.youryou!=null) return Number(props.youryou);

  // 簡易推定
  const lanes = Number(props.lanes || 1);
  const lt = String(props.line_type || props.sensyu || 'Other');
  const base = (lt==='Nat') ? 1000 : (lt==='Pref') ? 700 : (lt==='Muni') ? 500 : 300;
  let cap = lanes * base;
  // 交差点係数
  const isInt = Number(props.is_intersection || 0) > 0;
  if (isInt) cap *= 0.7;
  return cap;
}

export function getMetricsFor(linkid, hour, mode='auto'){
  const m = { linkid:String(linkid), hour:Number(hour) };
  // モード自動判定
  let useMode = mode;
  if (useMode==='auto'){
    useMode = window.__RESULT_BY_LINK ? 'calc' : 'obs';
  }
  const flow = getFlow(linkid, hour, useMode);
  const youryou = getCapacity(linkid);
  let R = null;
  if (youryou>0 && flow!=null){
    R = flow / youryou;
    if (R>1.5) R = 1.5; // 表示は150%上限
  }
  return Object.assign(m, {
    lanes: (buildFeatureIndex()[String(linkid)]?.properties?.lanes ?? null),
    sensyu: (buildFeatureIndex()[String(linkid)]?.properties?.line_type ?? null),
    youryou, flow, R, source: (useMode==='calc'?'calc':'obs')
  });
}
