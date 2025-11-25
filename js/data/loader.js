// js/data/loader.js (freeze-safe)
// - Prefer existing polygons in roads.geojson
// - If input is lines, buffer per-feature (no union/dissolve)
// - Normalize linkid and expose __ROAD_AREAS for rendering
export async function loadDataset(areaCode = "34_hiroshima") {
  const base = `data/prefectures/${areaCode}`;
  const roadsUrl = `${base}/roads.geojson`;
  const trafficUrl = `${base}/traffic.csv`;

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  }
  async function fetchCSV(url) {
    try{
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) return [];
      const text = await res.text();
      const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter(Boolean);
      if (!lines.length) return [];
      const header = lines[0].split(",");
      return lines.slice(1).map(line => {
        const cols = line.split(",");
        const rec = {}; header.forEach((h,i)=> rec[h] = cols[i]);
        return rec;
      });
    }catch(_){ return []; }
  }

  const [fcRaw, trafficRows] = await Promise.all([ fetchJSON(roadsUrl), fetchCSV(trafficUrl) ]);

  // Normalize ids
  const features = (fcRaw.features || []).map((f,i)=>{
    const p = f.properties || (f.properties = {});
    const id0 = String(p.linkid ?? p.gml_id ?? p.gml_id_27 ?? p.gml_id_33 ?? f.id ?? (i+1));
    const id  = id0 && id0 !== "undefined" ? id0 : String(i+1);
    f.id = id; p.linkid = id;
    return f;
  });
  const fc = { type:"FeatureCollection", features };

  // Build polygons:
  // Case A: input has Polygon/MultiPolygon -> use as-is (fast)
  const polyFeats = features.filter(f => {
    const t = f.geometry?.type;
    return t === "Polygon" || t === "MultiPolygon";
  });
  let areas = null;
  if (polyFeats.length){
    areas = {
      type:"FeatureCollection",
      features: polyFeats.map(f => ({ type:"Feature", geometry:f.geometry, properties:{ linkid:f.properties.linkid } }))
    };
  } else {
    // Case B: input is lines -> buffer per feature (NO union to avoid freeze)
    const turf = (window.turf || window.Turf || globalThis.turf);
    if (turf){
      const feats = [];
      for (const f of features){
        const p = f.properties || {};
        const w = Math.max(2, Number(p.haba ?? 8));
        const half = w/2;
        try{
          const poly = turf.buffer(f, half, { units:"meters" });
          if (poly?.geometry){
            poly.properties = { linkid: p.linkid };
            feats.push(poly);
          }
        }catch(_){ /* skip broken geom */ }
      }
      areas = { type:"FeatureCollection", features: feats };
    } else {
      areas = null; // fallback: renderer will handle line-band if needed
    }
  }

  // Simple traffic index
  const trafficById = {};
  for (const r of (trafficRows||[])){
    const id = String(r.linkid ?? "").trim();
    if (id) trafficById[id] = r;
  }

  // Expose
  window.__DATA_AREA = areaCode;
  window.__ROAD_FC = fc;
  window.__ROAD_AREAS = areas;
  window.__TRAFFIC_BY_ID = trafficById;

  console.info("[loader] area:", areaCode);
  console.info("[loader] roads:", fc.features.length, "features");
  if (areas) console.info("[loader] areas:", areas.features.length, "polygons (no-union)");
  console.info("[loader] traffic:", Object.keys(trafficById).length, "rows");
  return { fc, areas, trafficById };
}


// Optional: load direction hints CSV into window.__LINK_DIR_HINTS
export async function loadDirectionHints(urls=[ 'data/link_directions.csv', 'js/data/link_directions.csv' ]){
  for(const url of urls){
    try {
      const res = await fetch(url);
      if(!res.ok) continue;
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);
      const head = lines.shift().split(',');
      const idxLink = head.findIndex(h=>/linkid/i.test(h));
      const idxDir  = head.findIndex(h=>/sensyu_|sensyu|dir/i.test(h));
      if(idxLink<0 || idxDir<0) continue;
      const map = {};
      for(const ln of lines){
        const cols = ln.split(',');
        const id = String(cols[idxLink]||'').trim();
        const d  = String(cols[idxDir]||'').trim();
        if(id) map[id]=d;
      }
      window.__LINK_DIR_HINTS = map;
      console.info('[loader] direction hints loaded', Object.keys(map).length);
      return map;
    }catch(_){}
  }
  return null;
}
