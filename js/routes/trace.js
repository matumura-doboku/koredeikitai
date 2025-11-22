// js/routes/trace.js
// ===============================================================
// 段階接続版：クリックごとに前ノードと現在ノードを確実に接続
// ===============================================================

// 既存のシンプル探索（フォールバック用）
export function autoTraceBetween(startId, endId, { roadRepo, dir = 'up', maxSteps = 200 } = {}) {
  const s = String(startId), t = String(endId);
  if (!s || !t) return [];
  if (s === t) return [s];
  if (!roadRepo?.get?.(s) || !roadRepo?.get?.(t)) return [];

  const greedy = [s];
  let cur = s, steps = 0, loopGuard = new Set([s]);
  while (cur !== t && steps++ < maxSteps) {
    const nb = roadRepo.neighbors?.(cur, dir) || [];
    if (nb.length === 0) break;
    const next = nb.find(x => !loopGuard.has(String(x)));
    if (!next) break;
    greedy.push(String(next));
    cur = String(next);
    if (cur === t) return greedy;
    loopGuard.add(cur);
  }

  // Fallback BFS
  const pred = new Map();
  const q = [s];
  const seen = new Set([s]);
  while (q.length) {
    const u = q.shift();
    if (u === t) break;
    const outs = roadRepo.neighbors?.(u, dir) || [];
    for (const v0 of outs) {
      const v = String(v0);
      if (seen.has(v)) continue;
      seen.add(v);
      pred.set(v, u);
      q.push(v);
      if (v === t) break;
    }
  }
  if (!pred.has(t)) return greedy.length >= 2 ? greedy : [];
  const path = [];
  let x = t;
  path.push(x);
  while (pred.has(x)) { x = pred.get(x); path.push(x); if (x === s) break; }
  path.reverse();
  return path.filter((id, i, a)=> i===0 || a[i-1]!==id);
}

// -----------------------------------------------------------------------------
// New: クリックごとに2点間を最短でつなぐ関数（段階接続のコア）
// -----------------------------------------------------------------------------
export function traceBetween(roadRepo, a, b, opts = {}){
  const tp = opts.turnPenalty ?? 0.8;
  const wp = opts.wrongWayPenalty ?? 3.0;
  const maxHops = opts.maxHops ?? 800;
  const angleThreshold = opts.angleThreshold ?? 30;
  const s = String(a), t = String(b);
  if (!roadRepo?.get?.(s) || !roadRepo?.get?.(t)) return [];

  const seg = shortestPath(roadRepo, s, t, { turnPenalty:tp, wrongWayPenalty:wp, maxHops, angleThreshold });
  if (seg && seg.length >= 2) return seg;

  // フォールバック
  const alt = autoTraceBetween(s, t, { roadRepo });
  return (alt && alt.length >= 2) ? alt : [s, t];
}

// -----------------------------------------------------------------------------
// 内部：Dijkstra風の最短経路（属性＋幾何隣接統合／角度・方向ペナルティ）
// -----------------------------------------------------------------------------
function neighborsOf(repo, linkId){
  const attr = (repo.neighborsByAttr?.(linkId) || []).map(String);
  const geom = (repo.neighbors?.(linkId) || []).map(String);
  return [...new Set([...attr, ...geom])];
}

function shortestPath(repo, startId, goalId, { turnPenalty, wrongWayPenalty, maxHops, angleThreshold }){
  const dist = new Map([[startId, 0]]);
  const prev = new Map();
  const pq = [[0, startId, null]]; // [cost, id, prevId]
  const seen = new Set();

  let hops = 0;
  while (pq.length && hops++ < maxHops){
    pq.sort((a,b)=>a[0]-b[0]);
    const [cost, u, uprev] = pq.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    if (u === goalId) break;

    const outs = neighborsOf(repo, u);
    const uVec = linkVector(repo, u, uprev);

    for (const v of outs){
      if (seen.has(v)) continue;
      let step = 1;

      const vVec = linkVector(repo, v, u);
      const ang = turnAngleDeg(uVec, vVec);
      if (isFinite(ang) && ang > (angleThreshold ?? 30)){
        step += turnPenalty * (ang / 180);
      }

      const vf = repo.get(v)?.properties || {};
      const dirFlag = vf.dir ?? vf.direction ?? null;
      if (dirFlag && typeof dirFlag === 'string'){
        const low = dirFlag.toLowerCase();
        if (low.includes('opposite') || low.includes('down_only')) step += wrongWayPenalty;
      }

      const nd = cost + step;
      if (nd < (dist.get(v) ?? Infinity)){
        dist.set(v, nd);
        prev.set(v, u);
        pq.push([nd, v, u]);
      }
    }
  }

  if (!prev.has(goalId) && !dist.has(goalId)) return [];

  const path = [];
  let cur = goalId;
  path.push(cur);
  while (prev.has(cur)){
    cur = prev.get(cur);
    path.push(cur);
    if (cur === startId) break;
  }
  path.reverse();
  return path;
}

// -----------------------------------------------------------------------------
// 幾何ユーティリティ（ポリゴン→擬似ライン、角度計算など）
// -----------------------------------------------------------------------------
function linkVector(repo, id, fromId){
  try{
    const f = repo.get(id);
    const g = f?.geometry;
    const line = (g?.type === 'LineString') ? g : asLineStringGeometry(g);
    const coords = line?.coordinates;
    if (!coords || coords.length < 2) return null;
    let a = coords[0], b = coords[coords.length-1];
    if (fromId){
      const other = repo.get(fromId);
      const og = other?.geometry;
      const oline = (og?.type === 'LineString') ? og : asLineStringGeometry(og);
      const ocoords = oline?.coordinates;
      if (ocoords && ocoords.length){
        const p = ocoords[Math.floor(ocoords.length/2)];
        const d0 = sqDist(coords[0], p);
        const d1 = sqDist(coords[coords.length-1], p);
        if (d1 < d0){ a = coords[coords.length-1]; b = coords[0]; }
      }
    }
    return [b[0]-a[0], b[1]-a[1]];
  }catch(e){ return null; }
}

function sqDist(p, q){ const dx = p[0]-q[0], dy = p[1]-q[1]; return dx*dx+dy*dy; }

function turnAngleDeg(u, v){
  if (!u || !v) return 0;
  const du = Math.hypot(u[0], u[1]); const dv = Math.hypot(v[0], v[1]);
  if (!du || !dv) return 0;
  let cos = (u[0]*v[0] + u[1]*v[1]) / (du*dv);
  cos = Math.max(-1, Math.min(1, cos));
  const rad = Math.acos(cos);
  return rad * 180 / Math.PI;
}

// Polygon/MultiPolygon → 擬似 LineString（外周リングを間引き）
export function asLineStringGeometry(geom){
  if (!geom) return null;
  if (geom.type === 'LineString') return geom;
  const ringOf = (g) => {
    if (g.type === 'Polygon') return (g.coordinates?.[0]) || null;
    if (g.type === 'MultiPolygon') return (g.coordinates?.[0]?.[0]) || null;
    return null;
  };
  const ring = ringOf(geom);
  if (!ring || ring.length < 2) return null;
  const step = Math.max(1, Math.floor(ring.length / 50));
  const path = [];
  for (let i=0;i<ring.length;i+=step) path.push(ring[i]);
  if (path.length < 2) return null;
  return { type:'LineString', coordinates: path };
}

// --------------------------------------------------------------
// 互換用：旧関数 traceThrough()
// 現在は traceBetween() に処理を委譲する
// --------------------------------------------------------------

// --------------------------------------------------------------
// 改良版：旧関数 traceThrough()
// endId を第4引数で受け取り、最後まで確実に接続する
// --------------------------------------------------------------
export function traceThrough(roadRepo, startId, requiredIds = [], endId = null, opts = {}) {
  if (!roadRepo || !startId) return [];
  const ids = [String(startId), ...requiredIds.map(String)];
  if (endId) ids.push(String(endId));

  let full = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const a = ids[i], b = ids[i + 1];
    const sub = traceBetween(roadRepo, a, b, opts);
    if (sub.length >= 2) {
      if (full.length && sub[0] === full[full.length - 1]) sub.shift();
      full.push(...sub);
    }
  }
  return full;
}
