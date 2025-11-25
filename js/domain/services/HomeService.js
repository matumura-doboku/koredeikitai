// js/domain/services/HomeService.js
// store.js のエクスポート差異に耐える互換レイヤ付き HomeService
import * as StoreMod from '../../state/store.js';

// --- 互換吸収: いずれの書き方でも動くように ---
const __store = (StoreMod.store || StoreMod.default || StoreMod || {});
// 関数参照を抽出（get / set / addClosures / clearClosures のいずれか）
const getState    = __store.get || __store.getState || StoreMod.get || StoreMod.getState || (()=>({}));
const setState    = __store.set || __store.setState || StoreMod.set || StoreMod.setState || (()=>{});
const addClosures = __store.addClosures || StoreMod.addClosures || (()=>{});
const clearClosures = __store.clearClosures || StoreMod.clearClosures || (()=>{});

import { geocode } from '../../adapters/api/geocoding.adapter.js';

export class HomeService {
  constructor({ map, roadRepository }){
    this.map = map;
    this.roads = roadRepository;
  }

  async searchAddress(query, { limit=5 } = {}){
    const result = await geocode(query, { limit, lang:'ja' });
    if (result && result[0]) setState({ lastGeocode: result[0] });
    return result;
  }

  flyTo(lon, lat, zoom=13){
    if (typeof lon!=='number' || typeof lat!=='number') return false;
    this.map.flyTo({ center:[lon, lat], zoom });
    setState({ lastGeocode: { lon, lat, display_name:'' } });
    return true;
  }

  flyToLast(zoom=13){
    const g = (getState && getState().lastGeocode) || null;
    if (!g) return false;
    this.map.flyTo({ center:[g.lon, g.lat], zoom });
    return true;
  }

  setAOIPolygon(polygon){
    setState({ aoiPolygon: polygon });
    if (this.roads?.findWithinPolygon){
      const { linkIds } = this.roads.findWithinPolygon(polygon);
      setState({ aoiLinkIds: linkIds });
    }
    try { this.map.setFilter('roads-line', ['within', polygon]); } catch(e){}
    const st = (getState && getState()) || {};
    return { count: st.aoiLinkIds ? st.aoiLinkIds.size || st.aoiLinkIds.length || 0 : 0 };
  }

  applyClosures(ids){
    (addClosures)(ids);
    for (const id of (ids||[])){
      try { this.map.setFeatureState({ source:'roads', id:String(id) }, { closed:true }); } catch(e){}
    }
    const st = (getState && getState()) || {};
    const closures = st.closures || { size:0, length:0 };
    return { count: closures.size || closures.length || 0 };
  }

  clearClosures(){
    (clearClosures)();
    // 表示側の state は layers 側で参照されるので、ここでは 0 を返すだけ
    return { count: 0 };
  }
}
