// adapters/geojson/road.adapter.js
export function adaptRoadGeoJSON(geojson){
  if (!geojson || geojson.type!=="FeatureCollection") throw new Error("FeatureCollection expected");
  const out = [];
  for (const f of geojson.features || []){
    if (!f || f.type!=="Feature") continue;
    const p = f.properties || {};
    const linkId = String(p.linkid ?? p.linkId ?? "");
    if (!linkId) continue;
    const bunki = (p.bunki || "").trim() ? String(p.bunki).split(";").map(s=>s.trim()).filter(Boolean) : [];
    const rec = {
      linkId,
      sensyu: p.sensyu ?? "Sonota",
      syasensuu: num(p.syasensuu, 2),
      youryou: num(p.youryou, null),
      oneway: p.oneway ?? "both",
      entyou: num(p.entyou, null),
      haba: num(p.haba, null),
      mae: p.mae!=null ? String(p.mae) : null,
      usiro: p.usiro!=null ? String(p.usiro) : null,
      bunki,
      kousaten: Number(p.kousaten||0)===1,
      geometry: f.geometry
    };
    out.push(rec);
  }
  return out;
}
function num(v, dflt){
  if (v===undefined || v===null || v==='') return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}


export function getFeatureByLinkId(fc, linkId){
  const id = String(linkId);
  for(const f of (fc.features||[])){
    const fid = String(f.id || f.properties?.linkid || '');
    if (fid===id) return f;
  }
  return null;
}
