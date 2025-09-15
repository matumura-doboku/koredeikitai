// /js/system/compute-spec.js
// 計算式(容量, VC, ランク) と 簡易比例再配分（UIに結線しやすい純関数群）

export const CAPACITY_PER_LANE = 1800;

export const RANK_THRESHOLDS = {
  loose: 0.70,
  congested: 0.90,
  saturated: 1.00,
};

export function capacity(lanes) {
  const n = Number(lanes ?? 0);
  return Number.isFinite(n) ? n * CAPACITY_PER_LANE : NaN;
}

export function vc(v, c) {
  if (!Number.isFinite(v) || !Number.isFinite(c) || c <= 0) return NaN;
  return v / c;
}

export function rank(vcRatio) {
  if (!Number.isFinite(vcRatio)) return "不明";
  if (vcRatio < RANK_THRESHOLDS.loose) return "余裕";
  if (vcRatio < RANK_THRESHOLDS.congested) return "混雑";
  if (vcRatio <= RANK_THRESHOLDS.saturated) return "飽和";
  return "容量超";
}

// records: data-mapper.joinSegmentsTraffic() の戻り値
// hour: 0..23
export function computeHourMetrics(records, hour) {
  return records.map(rec => {
    const v = pickHour(rec, hour);
    const c = capacity(rec.lanes);
    const ratio = vc(v, c);
    return {
      ...rec,
      hour,
      Vh: v,
      C: c,
      VC: ratio,
      level: rank(ratio),
    };
  });
}

export function pickHour(rec, hour) {
  if (!rec?.hours) return NaN;
  const item = rec.hours.find(o => o.h === hour);
  return item ? item.v : NaN;
}

export function peakHour(rec) {
  if (!rec?.hours?.length) return { h: null, v: NaN };
  let best = { h: null, v: -Infinity };
  for (const o of rec.hours) {
    if (Number.isFinite(o.v) && o.v > best.v) best = { h: o.h, v: o.v };
  }
  return best;
}

// --- 簡易：比例再配分（距離や並行度は未使用、weight=lanes×v24h） ---
// closedIds: 閉鎖する segment_id の配列（方向は画面側でフィルタ）
// hour: 対象時刻
// hop: 今は未使用（将来の近傍探索用）
export function proportionateDiversion(records, closedIds, hour, hop = 3) {
  const set = new Set(closedIds);
  const base = computeHourMetrics(records, hour);

  // 消失交通量 ΔV を集計
  let delta = 0;
  for (const r of base) {
    if (set.has(r.segment_id)) delta += (Number.isFinite(r.Vh) ? r.Vh : 0);
  }

  // 受け皿候補（閉鎖区間は除外）と重み
  const candidates = base.filter(r => !set.has(r.segment_id));
  const weights = candidates.map(r => (Number(r.lanes || 0) * Number(r.v24h || 0)) || 0);
  const W = weights.reduce((a, b) => a + b, 0);

  // 分配
  const result = base.map((r, i) => {
    if (set.has(r.segment_id)) {
      // 閉鎖区間は V' = 0
      return { ...r, Vh_prime: 0, VC_prime: 0, level_prime: rank(0) };
    }
    const idx = candidates.indexOf(r);
    const add = (W > 0 && idx >= 0) ? delta * (weights[idx] / W) : 0;
    const v2 = (Number.isFinite(r.Vh) ? r.Vh : 0) + add;
    const vc2 = vc(v2, r.C);
    return { ...r, Vh_prime: v2, VC_prime: vc2, level_prime: rank(vc2) };
  });

  return {
    hour,
    closedIds: [...set],
    totalDelta: delta,
    records: result,
  };
}