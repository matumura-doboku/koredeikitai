// js/domain/services/route-builder.js (new)
// 始点→（曲がり点…）→終点 から「移動経路」を組み立てるユーティリティ（簡易版）
// - mae/usiro での自動追従を基本とし、分岐時は角度差/線種/幅員でタイブレーク（簡易）

export function buildMoveRoute(roadRepo, waypoints /* [{lon,lat}] */, { maxLenKm=5 } = {}){
  // TODO: 実装環境のノード/スナップAPIに合わせて差し替え
  // ここではダミー実装（リンクID列は呼び出し側で決める想定）
  return { linkIds: [], name: '移動経路', waypoints };
}

// mae/usiro で自動一括選択する雛形（開始/終了リンクIDが既知のとき）
export function chainByMaeUsiro(roadRepo, { startLinkId, goalLinkId, dir='up' }, limit=10000){
  const route = [];
  const seen = new Set();
  let cur = String(startLinkId);
  for (let step=0; step<limit; step++){
    route.push(cur); seen.add(cur);
    if (String(cur) === String(goalLinkId)) break;
    const e = roadRepo.get(cur);
    if (!e) break;
    // 直進優先
    const next = (dir === 'up') ? (e.mae || null) : (e.usiro || null);
    if (!next || seen.has(String(next))) break;
    cur = String(next);
  }
  return Array.from(new Set(route));
}
