
// js/address-form.js
// 住所入力フォームの制御と、候補提示→地図移動コールバック
import { APIClient } from './api-client.js';
import { normalizeJapaneseAddress } from './addr-normalize-ja.js';

/**
 * @param {Object} opts
 * @param {HTMLInputElement} opts.input
 * @param {HTMLElement} opts.suggestBox  // <ul> 推奨
 * @param {(lng:number, lat:number, bbox?:[number,number,number,number], meta?:object)=>void} opts.onResolve
 */
export function setupAddressForm(opts) {
  const api = new APIClient();
  const input = opts.input;
  const box = opts.suggestBox;
  let lastQuery = "";

  function clearSuggest() { box.innerHTML = ""; box.style.display = "none"; }
  function showSuggest(items) {
    box.innerHTML = "";
    items.forEach((it, idx) => {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.textContent = `${it.name} (${it.center[1].toFixed(5)}, ${it.center[0].toFixed(5)})`;
      li.addEventListener("click", () => choose(it));
      box.appendChild(li);
    });
    box.style.display = items.length ? "block" : "none";
  }
  async function choose(item) {
    clearSuggest();
    input.value = item.name;
    opts.onResolve?.(item.center[0], item.center[1], item.bbox || null, { source: "gsi" });
  }

  async function search(q) {
    if (!q || q.trim().length < 1) { clearSuggest(); return; }
    lastQuery = q;
    const n = normalizeJapaneseAddress(q);
    const candidates = await api.geocodeGSI(n.normalized || q).catch(()=>[]);
    // クエリが変わっていたら破棄
    if (lastQuery !== q) return;
    showSuggest(candidates.slice(0, 6));
  }

  input.addEventListener("input", (e) => {
    const v = input.value;
    search(v);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search(input.value);
    }
    if (e.key === "Escape") clearSuggest();
  });

  // 初期非表示
  clearSuggest();
  return { search };
}
