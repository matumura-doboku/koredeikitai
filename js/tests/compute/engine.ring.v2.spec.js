// js/tests/compute/engine.ring.v2.spec.js
// 実行: node js/tests/compute/engine.ring.v2.spec.js
import { createRingEngineV2 } from "../../compute/redistribute/engines/ring.v2.js";

function assert(c,m){ if(!c){ console.error("FAIL:", m); process.exit(1);} }

const links = [
  { linkId:"A", sensyu:"Nat", syasensuu:2, youryou:1600, oneway:"both", entyou:300, haba:3.5, mae:"B", usiro:null, bunki:[] },
  { linkId:"B", sensyu:"Pref", syasensuu:1, youryou:800, oneway:"both", entyou:300, haba:3.0, mae:"C", usiro:"A", bunki:[] },
  { linkId:"C", sensyu:"Muni", syasensuu:1, youryou:800, oneway:"both", entyou:300, haba:3.0, mae:null, usiro:"B", bunki:[] }
];

const eng = createRingEngineV2({ alpha:0.10 });

(function testMonotonicDecay(){
  const seeds = new Map([["A", 100]]); // ΔV=100 [dai/h]
  const { rounds, total } = eng.run({ links, seeds, dir:"ue", K:5, eps:1e-9 });
  // A→B→C と伝播。C の方が B より小さいはず（単調減衰）
  const d1 = rounds[0].get("B") || 0;
  const d2 = rounds[1]?.get("C") || 0;
  assert(d1>0 && d2>0, "positive");
  assert(d2 < d1, "monotonic decay B > C");
  console.log("PASS: monotonic decay");
})();

(function testDirection(){
  // 下り(dir='sita')では A からは usiro が無いので伝播しない
  const seeds = new Map([["A", 100]]);
  const { rounds } = eng.run({ links, seeds, dir:"sita", K:3, eps:1e-9 });
  const hasAny = rounds.some(m => m.size>0);
  assert(!hasAny, "no downstream from A in 'sita'");
  console.log("PASS: direction consistency");
})();
