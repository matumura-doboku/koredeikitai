// js/compute/redistribute/engines/ring.v2.js
// 安定版リング伝播エンジン（容量クリップ＋減衰を“量”に適用＋差し戻し＋緩和＋収束）
/* eslint-disable */

export function createRingEngineV2(userParams={}) {
  const params = withDefaults(userParams);

  function decay(d_km) {
    const a = params.alpha;
    if (!(d_km > 0)) return 1.0;
    const base = Math.max(0.0, 1 - a);
    return Math.pow(base, d_km);
  }

  function linechgWeight(li, lj) {
    const Ci = params.linechg.C[li.sensyu] || params.linechg.C_default;
    const base = (Ci && Ci[lj.sensyu] != null) ? Ci[lj.sensyu] : params.linechg.base_default;
    const lane_ratio  = clamp((safeNum(lj.syasensuu) || 1) / Math.max(1, safeNum(li.syasensuu) || 1), 0.2, 1.0);
    const width_ratio = clamp((safeNum(lj.haba) || lane_ratio) / Math.max(1e-9, safeNum(li.haba) || 1), 0.2, 1.0);
    const scale = Math.pow(Math.min(lane_ratio, width_ratio), params.linechg.beta);
    return base * scale;
  }

  function outEdgesFor(link, dir, linkIndex) {
    const outs = [];
    if (dir === "ue") {
      if (link.mae != null) outs.push({ j: String(link.mae), turn: "straight" });
      for (const b of (link.bunki || [])) outs.push({ j: String(b), turn: "turn" });
    } else {
      const usiroKey = link.usiro ?? link.ushiro ?? link.uriso;
      if (usiroKey != null) outs.push({ j: String(usiroKey), turn: "straight" });
      for (const b of (link.bunki || [])) outs.push({ j: String(b), turn: "turn" });
    }
    for (const e of outs) {
      const lj = linkIndex.get(e.j);
      e._lj = lj || null;
      const _lenm = lj && (lj.entyou ?? lj.length_m ?? lj.length ?? 0);
      e.d_km = Number(_lenm) ? Number(_lenm) / 1000.0 : 0.0;
    }
    return outs.filter(e => !!e._lj);
  }

  function wNoDecay(li, e) {
    const lj = e._lj;
    const lanes = Math.max(1, Number(lj.syasensuu || 1));
    const lanePow = Math.pow(lanes, params.gamma);
    const classW = params.class_w[lj.sensyu] ?? params.class_w_default;
    const turnW  = params.turn_w[e.turn] ?? params.turn_w_default;
    const lineW  = linechgWeight(li, lj);
    return lanePow * classW * turnW * lineW;
  }

  function normalize(weights) {
    const sum = weights.reduce((a,b)=>a + b.w, 0);
    if (sum <= 0) return weights.map(x => ({ ...x, wn: 0 }));
    return weights.map(x => ({ ...x, wn: x.w / sum }));
  }

  function capacityOf(lj) {
    const _bun = (lj.bunki ?? lj.branch ?? lj.to ?? []);
    const isInter = Array.isArray(_bun) && _bun.length > 0;
    const factor = isInter ? params.intersection_factor : 1.0;
    const _rawCap = (lj.youryou ?? lj.capacity ?? lj.cap ?? 0);
    const cap = Number(_rawCap) * factor;
    return Number.isFinite(cap) && cap > 0 ? cap : 0;
  }

  function run({ links, seeds, dir="ue", K=50, eps=1e-2 }) {
    const linkIndex = new Map(links.map(l => [String(l.linkId), l]));
    const E = links.map(l => String(l.linkId));

    const _entries = toEntries(seeds);
    let seedMass = 0; for (const _e of _entries) { seedMass += Math.abs(Number(_e[1])||0); }
    if (seedMass <= 0) {
      return { rounds: [], total: new Map(), q: new Map(), capacity: new Map(), skipped: true };
    }
    const C = new Map(E.map(id => [id, capacityOf(linkIndex.get(id))]));
    let f = new Map(E.map(id => [id, 0]));
    let q = new Map(E.map(id => [id, 0]));
    let seed = new Map(_entries);

    let retUp = new Map();

    for (let r = 1; r <= K; r++) {
      for (const [k, v] of retUp.entries()) {
        seed.set(k, (seed.get(k) || 0) + v);
      }
      retUp = new Map();

      const proposed = new Map();
      const contrib = new Map();

      for (const id of E) {
        const li = linkIndex.get(id);
        if (!li) continue;
        const outs = outEdgesFor(li, dir, linkIndex);
        if (outs.length === 0) continue;

        const ws = outs.map(e => ({ e, w: wNoDecay(li, e) }));
        const wn = normalize(ws);
        const f_up = f.get(id) || 0;
        if (f_up <= 0) continue;

        for (const {e, wn:ratio} of wn) {
          if (ratio <= 0) continue;
          const add = f_up * ratio * decay(e.d_km) * params.beta;
          proposed.set(e.j, (proposed.get(e.j) || 0) + add);

          let cm = contrib.get(e.j);
          if (!cm) { cm = new Map(); contrib.set(e.j, cm); }
          cm.set(id, (cm.get(id) || 0) + add);
        }
      }

      for (const [k, v] of seed.entries()) {
        if (!v) continue;
        const add = v * params.beta;
        proposed.set(k, (proposed.get(k) || 0) + add);

        let cm = contrib.get(k);
        if (!cm) { cm = new Map(); contrib.set(k, cm); }
        cm.set(k, (cm.get(k) || 0) + add);
      }
      seed = new Map();

      const fNew = new Map(f);
      const qTmp = new Map(q);
      const overflow = new Map();

      for (const id of E) {
        const inflow = (proposed.get(id) || 0) + (q.get(id) || 0);
        const take   = Math.min(inflow, C.get(id) || 0);
        const oflow  = Math.max(0, inflow - take);

        const nxt = (1 - params.alpha_flow) * (f.get(id) || 0) + params.alpha_flow * take;
        fNew.set(id, nxt);

        qTmp.set(id, oflow * (1 - params.gamma_leak));
        overflow.set(id, oflow);
      }

      for (const [dstId, of] of overflow.entries()) {
        if (of <= 0) continue;
        const back = of * params.delta_spill;
        const cm = contrib.get(dstId);
        if (cm && back > 0) {
          let sum = 0; for (const v of cm.values()) sum += v || 0;
          if (sum > 0) {
            for (const [srcId, v] of cm.entries()) {
              const w = v / sum;
              retUp.set(srcId, (retUp.get(srcId) || 0) + back * w);
            }
            qTmp.set(dstId, Math.max(0, (qTmp.get(dstId) || 0) - back));
          }
        }
      }

      const prev = f;
      f = fNew; q = qTmp;

      let maxRel = 0;
      for (const id of E) {
        const denom = Math.max(1, C.get(id) || 1);
        const rel = Math.abs((f.get(id) || 0) - (prev.get(id) || 0)) / denom;
        if (rel > maxRel) maxRel = rel;
      }
      if (maxRel < eps) break;
    }

    const total = new Map(f);
    return { rounds: [], total, q, capacity: C, params };
  }

  return { run, decay, linechgWeight, _normalize: normalize, outEdgesFor, withDefaults };
}

function withDefaults(p={}) {
  return {
    alpha: p.alpha ?? 0.10,            // [/km]
    gamma: p.gamma ?? 1.0,
    class_w: p.class_w ?? { Nat:1.0, Pref:0.7, Muni:0.4, Sonota:0.3 },
    class_w_default: p.class_w_default ?? 0.3,
    turn_w: p.turn_w ?? { straight:0.6, left:0.2, right:0.2, turn:0.2 },
    turn_w_default: p.turn_w_default ?? 0.2,
    linechg: {
      beta: (p.linechg && p.linechg.beta)!=null ? p.linechg.beta : 1.0,
      base_default: (p.linechg && p.linechg.base_default)!=null ? p.linechg.base_default : 0.5,
      C_default: { Nat:0.8, Pref:0.8, Muni:0.8, Sonota:0.8 },
      C: (p.linechg && p.linechg.C) || {
        Nat:   { Nat:0.8, Pref:0.2, Muni:0.2, Sonota:0.2 },
        Pref:  { Nat:0.8, Pref:0.8, Muni:0.2, Sonota:0.2 },
        Muni:  { Nat:0.8, Pref:0.8, Muni:0.8, Sonota:0.2 },
        Sonota:{ Nat:0.8, Pref:0.8, Muni:0.8, Sonota:0.8 }
      }
    },
    beta: p.beta ?? 0.90,
    alpha_flow: p.alpha_flow ?? 0.30,
    delta_spill: p.delta_spill ?? 0.50,
    gamma_leak: p.gamma_leak ?? 0.05,
    intersection_factor: p.intersection_factor ?? 0.7
  };
}

function safeNum(x){ const n=Number(x); return Number.isFinite(n)? n : null; }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

function toEntries(x){
  if (!x) return [];
  if (x instanceof Map) return Array.from(x.entries());
  if (Array.isArray(x)) return x.map(function(p){ return [String(p[0]), Number(p[1])||0]; });
  if (typeof x === "object") return Object.entries(x).map(function(kv){ return [String(kv[0]), Number(kv[1])||0]; });
  return [];
}
