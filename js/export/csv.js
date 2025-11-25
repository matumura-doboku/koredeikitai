export function exportCSV(store){
  const lines = [['linkId','baseFlow','postFlow','capacity','vc']];
  const feats = store.results?.features || [];
  feats.forEach(f=>{
    const p = f.properties||{};
    lines.push([p.linkId ?? '', p._baseFlow ?? '', p._postFlow ?? '', p._capacity ?? '', p._vc ?? '']);
  });
  return lines.map(r=>r.join(',')).join('\n');
}
