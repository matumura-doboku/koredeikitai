export function extractWithinAOI(roads, aoiPolygon){
  if(!aoiPolygon) return roads;
  const xs = aoiPolygon.coordinates[0].map(c=>c[0]);
  const ys = aoiPolygon.coordinates[0].map(c=>c[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const feats = (roads.features||[]).filter(f=>{
    const g = f.geometry;
    if(!g) return false;
    const coords = g.type==='LineString' ? g.coordinates : g.type==='MultiLineString' ? g.coordinates.flat() : [];
    return coords.some(([x,y])=> x>=bbox[0] && x<=bbox[2] && y>=bbox[1] && y<=bbox[3]);
  });
  return { type:'FeatureCollection', features: feats };
}
