// adapters/csv/traffic.migrator.js
export function detectTrafficVersion(row){
  for (const k in row){
    if (/^koutuuryou_ue\d{2}$/.test(k)) return "v2";
  }
  return "v1";
}
export function migrateRowV1toV2(row){
  const out = { linkid: row.linkid ?? row.id ?? String(row.linkId ?? row.LINKID ?? ""), kansokuten: normObs(row.kansokuten ?? row.observed ?? row.obs) };
  for (let i=0;i<24;i++){
    const hh = String(i).padStart(2,"0");
    out[`koutuuryou_ue${hh}`]   = pickNum(row, [`koutuuryou_ue${hh}`, `ue${hh}`, `up${hh}`, `UP${hh}`]);
    out[`koutuuryou_sita${hh}`] = pickNum(row, [`koutuuryou_sita${hh}`, `sita${hh}`, `down${hh}`, `DN${hh}`]);
  }
  return out;
}
function pickNum(row, keys){
  for (const k of keys){
    if (k in row) {
      const v = Number(row[k]);
      return Number.isFinite(v) ? v : (row[k]==='' || row[k]==null ? null : null);
    }
  }
  return null;
}
function normObs(v){ return Number(v)===1 ? 1 : 0; }
