// js/report/ReportAggregator.js — properties-first linkid + robust rows
function distanceMeters(a, b){
  if (!a || !b) return Infinity;
  try{
    if (typeof turf !== 'undefined' && turf.distance){
      return turf.distance([a.lon,a.lat],[b.lon,b.lat], { units:'meters' });
    }
  }catch(_){}
  const toRad = (d)=> d*Math.PI/180;
  const k = 111000;
  const mx = Math.cos(toRad((a.lat + b.lat)/2));
  const dx = (a.lon - b.lon) * k * mx;
  const dy = (a.lat - b.lat) * k;
  return Math.hypot(dx, dy);
}

function meanLonLat(coords){
  let sx=0, sy=0, n=0;
  for (const c of coords){
    if (Array.isArray(c) && c.length>=2){
      sx += c[0]; sy += c[1]; n++;
    }
  }
  if (!n) return null;
  return { lon: sx/n, lat: sy/n };
}

function getCenterXY(feat){
  if (!feat || !feat.geometry) return null;
  const g = feat.geometry;
  const t = g.type;
  if (t === 'LineString'){
    return meanLonLat(g.coordinates);
  }
  if (t === 'MultiLineString'){
    let best = null, bestLen = -1;
    for (const part of g.coordinates){
      let len = 0;
      for (let i=1;i<part.length;i++){
        const a = part[i-1], b = part[i];
        const pa = { lon:a[0], lat:a[1] }, pb = { lon:b[0], lat:b[1] };
        len += distanceMeters(pa, pb);
      }
      if (len > bestLen){ bestLen = len; best = part; }
    }
    return meanLonLat(best || g.coordinates[0]);
  }
  if (t === 'Point'){
    return { lon: g.coordinates[0], lat: g.coordinates[1] };
  }
  if (t === 'MultiPoint'){
    return meanLonLat(g.coordinates);
  }
  if (t === 'Polygon'){
    const ring = g.coordinates && g.coordinates[0];
    if (ring && ring.length){
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      for (const [x,y] of ring){
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { lon:(minX+maxX)/2, lat:(minY+maxY)/2 };
    }
  }
  if (t === 'MultiPolygon'){
    const ring = g.coordinates?.[0]?.[0];
    if (ring && ring.length){
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      for (const [x,y] of ring){
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { lon:(minX+maxX)/2, lat:(minY+maxY)/2 };
    }
  }
  return null;
}

function resolveLinkId(props, fallbackId){
  const cand = props?.linkid ?? props?.link_id ?? props?.linkId ?? props?.LINKID;
  const id = (cand != null && cand !== '') ? cand : fallbackId;
  return String(id);
}

function indexFeature(fc){
  const m = new Map();
  const feats = fc?.features || [];
  for (const f of feats){
    const id = resolveLinkId(f.properties || {}, f.id);
    if (id != null) m.set(String(id), f);
  }
  return m;
}

export function createReportAggregator({ map, getAfter, getBefore, roadFeatureCollection }){
  const _centerCache = new Map();
  const fc = roadFeatureCollection || (window.__ROAD_FC || { type:'FeatureCollection', features:[] });
  const byId = indexFeature(fc);

  function centerOfLink(linkid){
    const k = String(linkid);
    if (_centerCache.has(k)) return _centerCache.get(k);
    const feat = byId.get(k);
    if (!feat) return null;
    const c = getCenterXY(feat);
    if (c) _centerCache.set(k, c);
    return c;
  }

  function filterByRadius(centerIds, radiusM){
    const centers = (centerIds||[])
      .map(id => ({ id:String(id), c:centerOfLink(id) }))
      .filter(v => !!v.c);
    if (!centers.length){
      if (map && typeof map.getCenter === 'function'){
        const c = map.getCenter();
        centers.push({ id:'map-center', c:{ lon:c.lng, lat:c.lat } });
      }else{
        return [];
      }
    }
    const out = [];
    for (const [linkid] of byId.entries()){
      const p = centerOfLink(linkid);
      if (!p) continue;
      let keep = false, nearest = Infinity;
      for (const ce of centers){
        const d = distanceMeters(p, ce.c);
        if (d < nearest) nearest = d;
        if (d <= radiusM){ keep = true; break; }
      }
      if (keep) out.push({ linkid, dist_m: Math.round(nearest) });
    }
    return out;
  }

  function buildRows({ centerIds, radiusM = 500 }){
    const targets = filterByRadius(centerIds, radiusM);
    const rows = targets.map(t => {
      const id = t.linkid;
      const b = (typeof getBefore === 'function') ? (getBefore(id) || {}) : {};
      const a = (typeof getAfter  === 'function') ? (getAfter(id)  || {}) : {};
      const Rb = (typeof b.R === 'number') ? b.R : null;
      const Ra = (typeof a.R === 'number') ? a.R : null;
      const tb = (typeof b.traffic === 'number') ? b.traffic : null;
      const ta = (typeof a.traffic === 'number') ? a.traffic : null;
      return {
        linkid: id,
        dist_m: t.dist_m,
        traffic_before: tb,
        traffic_after:  ta,
        R_before: Rb,
        R_after:  Ra,
        dR: (Ra!=null && Rb!=null) ? +(Ra - Rb).toFixed(3) : null
      };
    });
    rows.sort((a,b)=> (a.dist_m - b.dist_m) || ((Math.abs(b.dR ?? -9999)) - (Math.abs(a.dR ?? -9999))));
    return rows;
  }

  function toCSV(rows){
    const header = ['linkid','dist_m','traffic_before','traffic_after','R_before','R_after','dR'];
    const lines = [header.join(',')];
    for (const r of rows){
      lines.push([
        r.linkid,
        r.dist_m,
        (r.traffic_before ?? ''),
        (r.traffic_after  ?? ''),
        (r.R_before ?? ''),
        (r.R_after  ?? ''),
        (r.dR ?? '')
      ].join(','));
    }
    return lines.join('\n');
  }

  return { build: buildRows, toCSV, _getCenterXY: getCenterXY };
}
