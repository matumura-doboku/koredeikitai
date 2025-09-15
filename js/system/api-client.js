
// js/api-client.js
// 薄いフェッチラッパーと、GSI AddressSearch API クライアント
export class APIClient {
  constructor(opts = {}) {
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  async _fetchJson(url, opts = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * GSI AddressSearch
   * https://msearch.gsi.go.jp/address-search/AddressSearch?q=…
   * @param {string} query
   * @returns {Promise<Array<{name:string, center:[number,number], bbox?:[number,number,number,number]}>>}
   */
  async geocodeGSI(query) {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
    const data = await this._fetchJson(url);
    // 返却データを統一フォーマットへ
    return (data || []).map(d => ({
      name: d.properties.title || d.properties.address || query,
      center: d.geometry?.coordinates || [0,0], // [lng, lat]
      bbox: d.properties.bbox || null
    }));
  }
}
