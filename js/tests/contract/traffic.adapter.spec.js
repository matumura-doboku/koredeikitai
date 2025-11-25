// tests/contract/traffic.adapter.spec.js
// 実行: node js/tests/contract/traffic.adapter.spec.js
import { adaptTrafficRows } from "../../adapters/csv/traffic.adapter.js";
function assert(cond, msg){ if(!cond){ console.error("FAIL:", msg); process.exit(1);} }

(function testV2(){
  const rows = [{ linkid: 123, kansokuten: 1, koutuuryou_ue00: 1200, koutuuryou_sita00: 1100 }];
  const dom = adaptTrafficRows(rows);
  assert(dom.length===1, "length");
  assert(dom[0].linkId==="123", "linkId");
  assert(dom[0].observed===true, "observed");
  assert(dom[0].byHour["00"].ue===1200, "ue00");
  assert(dom[0].byHour["00"].sita===1100, "sita00");
  console.log("PASS: v2 basic");
})();

(function testV1Migrate(){
  const rows = [{ linkid: "A01", obs: 0, ue00: 500, down00: 480 }];
  const dom = adaptTrafficRows(rows);
  assert(dom[0].byHour["00"].ue===500, "migrate ue00");
  assert(dom[0].byHour["00"].sita===480, "migrate down00");
  console.log("PASS: v1 migrate");
})();
