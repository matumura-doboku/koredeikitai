export function joinTraffic(roadsGeoJSON, traffic){
  const map = new Map(traffic.map(r=>[String(r.linkId), r]));
  const out = JSON.parse(JSON.stringify(roadsGeoJSON));
  out.features.forEach(f=>{
    const id = String(f.properties?.linkId ?? '');
    const t = map.get(id);
    if(t){
      f.properties = { ...(f.properties||{}), _baseFlow: Number(t.baseFlow||0), _capacity: Number(t.capacity||1) };
    }
  });
  return out;
}
