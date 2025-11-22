// js/domain/services/VisualizationService.js (patched: full coverage)
// 目的: 全区画に feature-state を付与する（未計算区画も {R:0, cls:0}）
// - id は properties.linkid を優先（無ければ feature.id）
// - classes は既定 [0.2,0.35,0.5,0.7,0.9]
export class VisualizationService {
  constructor(roadRepo, options={}){
    this.roadRepo = roadRepo;
    this.opts = {
      classes: [0.15, 0.30, 0.45, 0.65, 0.85],
      ...options
    };
  }

  /** feature-state辞書を生成（全Featureを網羅）: { linkId: { R, cls } } */
  toFeatureState(calcResult){
    const st = {};
    const byLink = (calcResult && calcResult.byLink) ? calcResult.byLink : {};

    const feats = (this.roadRepo && this.roadRepo.fc && this.roadRepo.fc.features) ? this.roadRepo.fc.features : [];
    for (const f of feats){
      const id = String(f.properties?.linkid ?? f.id ?? '');
      if (!id) continue;
      const r = byLink[id];
      const R = (r && Number.isFinite(r.R_max)) ? r.R_max : 0; // 未計算は0扱いで可視化
      st[id] = { R, cls: this._classOf(R) };
    }
    return st;
  }

  _classOf(R){
    if (R==null || !Number.isFinite(R)) return -1;
    const cuts = this.opts.classes;
    for (let i=0;i<cuts.length;i++){
      if (R < cuts[i]) return i;
    }
    return cuts.length;
  }
}
