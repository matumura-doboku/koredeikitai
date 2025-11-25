// js/tests/services/services.smoke.spec.js
// 実行: node js/tests/services/services.smoke.spec.js
import { RoadRepository } from "../../domain/repositories/RoadRepository.js";
import { TrafficRepository } from "../../domain/repositories/TrafficRepository.js";
import { CalculationService } from "../../domain/services/CalculationService.js";
import { VisualizationService } from "../../domain/services/VisualizationService.js";

// Tiny network A->B->C (ue 方向)。A を通行止めと想定し再配分。
const fc = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type:"LineString", coordinates:[[139,35],[139.01,35.01]] },
      properties: { linkid:"A", sensyu:"Nat", syasensuu:2, youryou:1600, oneway:"both", entyou:300, haba:3.5, mae:"B", usiro:null, bunki:"", kousaten:0 } },
    { type: "Feature", geometry: { type:"LineString", coordinates:[[139.01,35.01],[139.02,35.02]] },
      properties: { linkid:"B", sensyu:"Pref", syasensuu:1, youryou:800, oneway:"both", entyou:300, haba:3.0, mae:"C", usiro:"A", bunki:"", kousaten:0 } },
    { type: "Feature", geometry: { type:"LineString", coordinates:[[139.02,35.02],[139.03,35.03]] },
      properties: { linkid:"C", sensyu:"Muni", syasensuu:1, youryou:800, oneway:"both", entyou:300, haba:3.0, mae:null, usiro:"B", bunki:"", kousaten:0 } }
  ]
};

const trafficRows = [{
  linkid: "A", kansokuten: 1,
  koutuuryou_ue00: 100, koutuuryou_sita00: 0
},{
  linkid: "B", kansokuten: 0,
  koutuuryou_ue00: 0, koutuuryou_sita00: 0
},{
  linkid: "C", kansokuten: 0,
  koutuuryou_ue00: 0, koutuuryou_sita00: 0
}];

// Arrange
const roads = new RoadRepository(); roads.loadFromGeoJSON(fc);
const traff = new TrafficRepository(); traff.loadFromRows(trafficRows);
const calc  = new CalculationService(roads, traff, { engine: { alpha:0.10 } });
const viz   = new VisualizationService(roads);

// Act
const result = await calc.runAt({ tHH:"00", K:5, closures:["A"], dir:"ue" });

// Assert-ish (print)
console.log("affected:", result.affectedIds);
const geo = viz.toGeoJSON(result);
console.log("features:", geo.features.length);
if (geo.features.length===0) { console.error("FAIL: no affected features"); process.exit(1); }
console.log("PASS: services smoke");
