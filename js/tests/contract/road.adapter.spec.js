// tests/contract/road.adapter.spec.js
// 実行: node js/tests/contract/road.adapter.spec.js
import { adaptRoadGeoJSON } from "../../adapters/geojson/road.adapter.js";
function assert(cond, msg){ if(!cond){ console.error("FAIL:", msg); process.exit(1);} }

const fc = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[139,35],[139.01,35.01]] },
    properties: {
      linkid: 12345, sensyu: "Nat", syasensuu: 2, youryou: 1600, oneway: "both",
      entyou: 350, haba: 3.5, mae: 12346, usiro: 12344, bunki: "22301;22302", kousaten: 1
    }
  }]
};

const links = adaptRoadGeoJSON(fc);
assert(links.length===1, "length");
assert(links[0].linkId==="12345", "linkId");
assert(links[0].bunki.length===2 && links[0].bunki[0]==="22301", "bunki parse");
console.log("PASS: road basic");
