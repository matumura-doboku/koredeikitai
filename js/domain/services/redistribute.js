// js/domain/services/redistribute.js (patched)
// 伝播ロジック拡張のフック。CalculationService.runAt 内で伝播済みの場合は no-op。
// 将来、別アルゴリズム（K最短+ロジット+簡易BPR）を差し替える際に利用。
export function redistribute(volMap, roadRepo, { steps=0 } = {}){
  return volMap;
}
