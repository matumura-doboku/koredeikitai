// js/map/diff-render.js
// 差分適用レンダラ：リンクごとの FeatureState を最小限の差分だけ Map に反映する。
// - R や cls の「閾値ロジック」は呼び出し元（layers.js 等）で決定する。
// - ここでは渡された state をそのまま roads ソースの feature-state に反映するだけ。
// - 過去 state との比較により、実際に変わったリンクだけ set/remove してパフォーマンスを確保する。

export class DiffRenderer{
  constructor(map, sourceId){
    this.map = map;
    this.sourceId = sourceId;
    this.prev = new Map(); // id(string) -> state(object|null)
  }

  /**
   * dict: { linkid: { cls, R, closed, sel, ... } | null, ... }
   */
  applyFeatureStateDict(dict){
    const next = new Map(
      Object.entries(dict || {}).map(([id, val]) => [String(id), val || null])
    );
    const ids = new Set([...this.prev.keys(), ...next.keys()]);

    for (const id of ids){
      const a = this.prev.get(id) || null;
      const b = next.get(id) || null;

      if (!a && b){
        // 新規 state
        this._set(id, b);
        continue;
      }
      if (a && !b){
        // state 削除
        this._clear(id);
        continue;
      }
      if (a && b){
        // 重要なフィールドに変化があれば更新
        if (
          a.cls    !== b.cls    ||
          a.R      !== b.R      ||
          a.closed !== b.closed ||
          a.sel    !== b.sel
        ){
          this._set(id, b);
        }
      }
    }

    this.prev = next;
  }

  _set(id, st){
    try{
      this.map.setFeatureState({ source:this.sourceId, id }, st);
    }catch(e){
      // console.warn('DiffRenderer setFeatureState error', e);
    }
  }

  _clear(id){
    try{
      this.map.removeFeatureState({ source:this.sourceId, id });
    }catch(e){
      // console.warn('DiffRenderer removeFeatureState error', e);
    }
  }
}
