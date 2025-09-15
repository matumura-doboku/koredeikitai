// /js/system/ui-spec.js
// UI・表示ルールの“契約”。DOMや地図ライブラリのコードは含まない。

export const DATA_PATHS = {
  segments: "./data/segments.csv",
  traffic: "./data/traffic.csv",
};

export const LAYER_IDS = {
  base: "L_segments_base",
  heat: "L_segments_heat",
  scenario: "L_scenario",
};

// VCの色分け（凡例と一致）
export const VC_STYLE = [
  { max: 0.70, label: "余裕 (<0.70)", color: "#4caf50" },
  { max: 0.90, label: "混雑 (0.70–0.90)", color: "#ffc107" },
  { max: 1.00, label: "飽和 (0.90–1.00)", color: "#ff9800" },
  { max: Infinity, label: "容量超 (>1.00)", color: "#f44336" },
];

export function colorForVC(vc) {
  for (const rule of VC_STYLE) {
    if (Number.isFinite(vc) && vc <= rule.max) return rule.color;
  }
  return "#9e9e9e"; // 不明
}

// V（台/h）用の自動分級（四分位・UI側で凡例文字列を作る想定）
export function quantileStops(values, classes = 5) {
  const xs = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return [];
  const stops = [];
  for (let i = 1; i < classes; i++) {
    const p = i / classes;
    const idx = Math.floor(p * (xs.length - 1));
    stops.push(xs[idx]);
  }
  return stops;
}

// I/O契約（他モジュールが満たすべきメソッド一覧）
export const CONTRACT = {
  // data-mapper.js
  loadSegmentsCSV: "function(path) -> Promise<segments[]>",
  loadTrafficCSV: "function(path) -> Promise<traffic[]>",
  joinSegmentsTraffic: "function(segments, traffic) -> records[]",

  // compute-spec.js
  computeHourMetrics: "function(records, hour) -> records_with_metrics[]",
  proportionateDiversion: "function(records, closedIds, hour, hop) -> {records:[], ...}",
};