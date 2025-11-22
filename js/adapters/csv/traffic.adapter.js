// adapters/csv/traffic.adapter.js
import { migrateRowV1toV2, detectTrafficVersion } from "./traffic.migrator.js";
export const HOURS = Array.from({length:24}, (_,i)=>String(i).padStart(2,"0"));
export function rowV2ToDomain(row){
  const linkId = String(row.linkid);
  const observed = Number(row.kansokuten||0) === 1;
  const byHour = {};
  for(const hh of HOURS){
    const ue = safeNum(row[`koutuuryou_ue${hh}`]);
    const si = safeNum(row[`koutuuryou_sita${hh}`]);
    byHour[hh] = { ue, sita: si };
  }
  return { linkId, observed, byHour };
}
export function adaptTrafficRows(rows){
  if (!Array.isArray(rows)) throw new Error("rows must be an array");
  const out = [];
  for (const r of rows){
    const ver = detectTrafficVersion(r);
    const v2 = (ver==="v2") ? r : migrateRowV1toV2(r);
    out.push(rowV2ToDomain(v2));
  }
  return out;
}
function safeNum(x){
  if (x===undefined || x===null || x==='') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
