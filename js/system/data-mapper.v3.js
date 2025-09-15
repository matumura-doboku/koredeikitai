// /js/system/data-mapper.js
// CSVロード & 列マッピング & 結合（描画は含まない）

// ---- tiny CSV loader (simple, no quoted comma support) ----
export async function loadCSV(path, init = {}) {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  const header = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    header.forEach((h, i) => obj[h.trim()] = (cols[i] ?? "").trim());
    return obj;
  });
}

// ---- segments.csv loader ----
// 必須: 区間番号,start_x,start_y,end_x,end_y
export async function loadSegmentsCSV(path = "/data/segments.csv") {
  const rows = await loadCSV(path);
  return rows.map(r => ({
    segment_id: toInt(r["区間番号"]),
    start_x: +r["start_x"],
    start_y: +r["start_y"],
    end_x: +r["end_x"],
    end_y: +r["end_y"],
    raw: r,
  })).filter(r => Number.isFinite(r.start_x) && Number.isFinite(r.start_y) && Number.isFinite(r.end_x) && Number.isFinite(r.end_y));
}

// ---- traffic.csv loader ----
// 代表列:
//  - 交通量調査単位区間番号
//  - 上り・下りの別 (1:up / 2:down)
//  - 代表車線数
//  - 時間帯別自動車類交通量（台／時）／XX時台 … 0〜23hを動的検出
export async function loadTrafficCSV(path = "/data/traffic.csv") {
  const rows = await loadCSV(path);
  // 動的に時間列を検出
  const hourColumns = detectHourColumns(Object.keys(rows[0] ?? {}));
  return rows.map(r => normalizeTrafficRow(r, hourColumns));
}

export function detectHourColumns(headers) {
  // 日本語カラム例に対応：「時間帯別自動車類交通量（台／時）／０時台」など
  // 「VC」などの派生列は除外
  const hourCols = [];
  for (const h of headers) {
    if (h.includes("時間帯別自動車類交通量") && h.includes("時台") && !h.includes("VC")) {
      // 時台の先頭が数字でなく全角数字の場合もあるので、0〜23を順に探す
      hourCols.push(h);
    }
  }
  // 0〜23hに並び替え（末尾の「○時台」をキーにソート）
  const order = (name) => {
    const m = name.match(/([0-2]?\d)時台/);
    if (m) return parseInt(m[1], 10);
    // 全角の場合のフォールバック（「０」「１」…）
    const z = name.match(/([０-２]?\d)時台/);
    if (z) return zenToHan(z[1]);
    return 99;
  };
  return hourCols.sort((a, b) => order(a) - order(b));
}

export function normalizeTrafficRow(r, hourColumns) {
  const id = toInt(r["交通量調査単位区間番号"]);
  const dirRaw = r["上り・下りの別"];
  const direction = normalizeDirection(dirRaw);
  const lanes = toInt(r["代表車線数"] ?? r["車線数"] ?? r["代表車線数（車線）]);
  const hours = hourColumns.map((col, h) => ({
    h,
    v: toNumberSafe(r[col]),
    col
  }));
  const v24 = sum(hours.map(o => o.v));
  return {
    segment_id: id,
    direction,
    lanes,
    hours,   // [{h, v, col}, ...]
    v24h: v24,
    raw: r,
  };
}

export function normalizeDirection(v) {
  const s = String(v ?? "").trim();
  if (s === "1") return "up";
  if (s === "2") return "down";
  if (/上/.test(s)) return "up";
  if (/下/.test(s)) return "down";
  return s || "unknown";
}

export function joinSegmentsTraffic(segments, traffic) {
  // segment_id で内部結合し、trafficは方向別に複数行ある前提
  const segIndex = new Map(segments.map(s => [s.segment_id, s]));
  const grouped = new Map();
  for (const t of traffic) {
    const seg = segIndex.get(t.segment_id);
    if (!seg) continue; // 交通量のみのIDはスキップ
    const key = `${t.segment_id}:${t.direction}`;
    const arr = grouped.get(key) ?? [];
    arr.push({ seg, t });
    grouped.set(key, arr);
  }
  // 方向別で複数行あればそのまま配列で保持（将来の観測日違い等に対応）
  const records = [];
  for (const [key, list] of grouped) {
    for (const item of list) {
      records.push({
        segment_id: item.t.segment_id,
        direction: item.t.direction,
        lanes: item.t.lanes,
        hours: item.t.hours,
        v24h: item.t.v24h,
        geom: {
          type: "LineString",
          coordinates: [
            [item.seg.start_x, item.seg.start_y],
            [item.seg.end_x, item.seg.end_y],
          ],
        },
        segRaw: item.seg.raw,
        trafficRaw: item.t.raw,
      });
    }
  }
  return records;
}

// Utility
function toInt(v) { const n = parseInt(String(v ?? "").replace(/[^\d\-]/g, ""), 10); return Number.isFinite(n) ? n : null; }
function toNumberSafe(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const s = String(v).replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function sum(arr) { return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0); }
function zenToHan(s) { 
  const z2h = {"０":"0","１":"1","２":"2","３":"3","４":"4","５":"5","６":"6","７":"7","８":"8","９":"9"};
  return parseInt(String(s).split("").map(ch => z2h[ch] ?? ch).join(""), 10);
}