// js/domain/repositories/RoadRepository.js
const BASE_CAP_BY_SENSYU = {
  'Nat':700, 'Pref':500, 'Muni':400, 'Other':300,
  '国道':700, '県道':500, '市道':400, 'その他':300, 'Sonota':300
};
export class RoadRepository {
  constructor(featureCollection){
    this.fc = featureCollection || { type:'FeatureCollection', features: [] };
    this.byId = new Map();
    for (const f of (this.fc.features || [])){
      const id = String(f.properties?.linkid ?? f.id ?? '');
      if (!id) continue;
      const props = f.properties || {};
      this.byId.set(id, {
        id,
        linkId: id,
        geometry: f.geometry,
        syasensuu: Number(props.syasensuu ?? 1) || 1,
        youryou: (props.youryou != null && props.youryou !== '')
          ? Number(props.youryou)
          : (Number(props.syasensuu ?? 1) * (BASE_CAP_BY_SENSYU[String(props.sensyu ?? 'その他')] ?? 300)),
        sensyu: String(props.sensyu ?? 'その他'),
        entyou: Number(props.entyou ?? props.enchou ?? 0) || 0,
        mae: String(props.mae ?? ''),
        usiro: String(props.usiro ?? ''),
        bunki: String(props.bunki ?? '').split(';').map(s=>String(s).trim()).filter(Boolean),
      });
    }
  }

  get(id){
    return this.byId.get(String(id));
  }

  ids(){
    return [...this.byId.keys()];
  }

  /** 指定方向の隣接リンクを取得（上り: mae + bunki, 下り: usiro + bunki） */
  neighbors(id, dir='up'){
    const r = this.get(id);
    if (!r) return [];
    const main = (dir === 'up') ? r.mae : r.usiro;
    const out = [];
    if (main) out.push(main);
    for (const b of (r.bunki || [])) out.push(b);
    return out.filter(Boolean).map(String);
  }
}