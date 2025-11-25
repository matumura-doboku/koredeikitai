// js/domain/repositories/TrafficRepository.js
export class TrafficRepository {
  constructor(featureCollection){
    // 交通量はGeoJSONの各Feature.propertiesから参照するか、window.__TRAFFIC_BY_IDを利用
    this.fc = featureCollection || { type:'FeatureCollection', features: [] };
    this.byId = new Map();
    for (const f of (this.fc.features || [])){
      const id = String(f.properties?.linkid ?? f.id ?? '');
      if (!id) continue;
      this.byId.set(id, f.properties || {});
    }
    this.fallback = (typeof window !== 'undefined' && window.__TRAFFIC_BY_ID) ? window.__TRAFFIC_BY_ID : null;
  }

  /** 時刻(hour), 方向(dir='up'|'down')の交通量を返す */
  get(hour=0, dir='up', id){
    // hour は "0" や 0 などを許容し、常に2桁化（00..23）
    const hnum = (hour==null)?0:Number(hour);
    const hh = String(isNaN(hnum)?0:hnum).padStart(2,'0');

    // 1) 本命：方向付き列（koutuuryou_ueHH / koutuuryou_sitaHH）
    const keyDir = (dir === 'up')
      ? `koutuuryou_ue${hh}`
      : `koutuuryou_sita${hh}`;

    // 2) フォールバック：方向なし列（koutuuryouHH）
    const keyAny = `koutuuryou${hh}`;

    const props = this.byId.get(String(id));
    const fb = (this.fallback && this.fallback[id]) ? this.fallback[id] : null;

    const pick = (obj, key) => {
      if (!obj || obj[key] == null) return undefined;
      const v = Number(obj[key]);
      return Number.isFinite(v) ? v : undefined;
    };

    // 優先順: props.dir → fb.dir → props.any → fb.any
    let v = pick(props, keyDir);
    if (v === undefined) v = pick(fb, keyDir);
    if (v === undefined) v = pick(props, keyAny);
    if (v === undefined) v = pick(fb, keyAny);

    return v ?? 0;
  }
}
