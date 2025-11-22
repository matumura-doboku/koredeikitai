// js/domain/services/CalculationService.js
// Path fix: repositories/*
import { RoadRepository } from '../repositories/RoadRepository.js';
import { TrafficRepository } from '../repositories/TrafficRepository.js';

export class CalculationService {
  constructor(roadRepo, trafficRepo, options={}){
    this.road = roadRepo;
    this.traffic = trafficRepo;
    this.opts = Object.assign({
      alpha: 0.10,
      gamma: 1.0,
      class_w: {
        '国道': 1.0, '県道': 0.7, '市道': 0.4, 'その他': 0.3, 'Nat':1.0, 'Pref':0.7, 'Muni':0.4, 'Sonota':0.3
      },
      turn_w: { straight: 0.6, turn: 0.4 },
      linechg: { '国道>県道': 0.2, '県道>国道': 0.8 },
      maxSteps: 3
    }, options || {});
  }

  runAt({ hour=0, K=3, dir='up', closures=[] } = {}){
    const steps = Math.min(Number(K)||0, this.opts.maxSteps);
    const ids = this.road.ids();
    const V0 = new Map(ids.map(id=>[id, this.traffic.get(hour, dir, id)]));
    const V  = new Map(ids.map(id=>[id, V0.get(id)]));

    const q = [];
    for (const cid of (closures||[])){
      const id = String(cid);
      const v = V.get(id) || 0;
      if (v > 0){
        V.set(id, 0);
        q.push({ id, delta:v, depth:0 });
      }
    }

    while(q.length){
      const { id:i, delta:dv, depth } = q.shift();
      if (depth >= steps) continue;
      const nbrs = this.road.neighbors(i, dir);
      if (!nbrs.length) continue;

      const w_raw = [];
      let sum = 0;
      for (const j of nbrs){
        const Rj = this.road.get(j);
        if (!Rj) continue;

        const ri = this.road.get(i);
        const straightTarget = (dir==='up') ? (ri?.mae || '') : (ri?.usiro || '');
        const isStraight = (String(j) === String(straightTarget));
        const turnWeight = isStraight ? this.opts.turn_w.straight : (this.opts.turn_w.turn / Math.max(nbrs.length - (isStraight?0:0), 1));

        const from = ri?.sensyu || '';
        const to   = Rj?.sensyu || '';
        const key  = `${from}>${to}`;
        const linechg = this.opts.linechg[key] ?? 1.0;

        const d_km = Math.max(Number(Rj.entyou || 0) / 1000, 0);
        const decay = Math.pow(1 - this.opts.alpha, d_km);

        const raw =
          Math.pow(Math.max(Rj.syasensuu || 1, 1), this.opts.gamma) *
          (this.opts.class_w[to] ?? 0.3) *
          turnWeight *
          linechg *
          decay;

        if (raw > 0){
          w_raw.push([j, raw]);
          sum += raw;
        }
      }
      if (sum <= 0) continue;

      for (const [j, wr] of w_raw){
        const w = wr / sum;
        const add = dv * w;
        V.set(j, (V.get(j) || 0) + add);
        q.push({ id:j, delta:add, depth:depth + 1 });
      }
    }

    const byLink = {};
    const affected = new Set();
    for (const id of ids){
      const road = this.road.get(id);
      if (!road) continue;
      const vol = V.get(id) || 0;
      const cap = Math.max(Number(road.youryou || 0), 1);
      const R = vol / cap;
      byLink[id] = {
        linkid: id,
        ue: (dir==='up') ? vol : undefined,
        sita: (dir==='down') ? vol : undefined,
        youryou: cap,
        R_ue: (dir==='up') ? R : undefined,
        R_sita: (dir==='down') ? R : undefined,
        R_max: R
      };
      if ((V0.get(id) || 0) !== (V.get(id) || 0)) affected.add(id);
    }

    return { byLink, affectedIds: [...affected] };
  }
}