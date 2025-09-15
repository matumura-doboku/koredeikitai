// /js/system/heat-style.js
// V/C 4段階の色分けをレイヤに適用する小さなユーティリティ

import { VC_STYLE } from './js/system/ui-spec.js';

export function applyVCStyle(map, layerId = 'segments-heat') {
  if (!map || !map.getLayer(layerId)) return;
  const expr = [
    'let', 'v', ['to-number', ['get', 'VC']],
    ['case',
      ['<=', ['var','v'], VC_STYLE[0].max], VC_STYLE[0].color,
      ['<=', ['var','v'], VC_STYLE[1].max], VC_STYLE[1].color,
      ['<=', ['var','v'], VC_STYLE[2].max], VC_STYLE[2].color,
      VC_STYLE[3].color
    ]
  ];
  map.setPaintProperty(layerId, 'line-color', expr);
  map.setPaintProperty(layerId, 'line-width', 3.0);
  map.setPaintProperty(layerId, 'line-opacity', 0.95);
}

// 凡例を legend-wire.js なしでも更新できるようにするオプション
export function rebuildLegend() {
  const box = document.getElementById('legend');
  if (!box) return;
  box.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = '交通量（V/C）';
  box.appendChild(title);
  for (const r of VC_STYLE) {
    const row = document.createElement('div');
    row.className = 'row';
    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = r.color;
    row.appendChild(sw);
    row.appendChild(document.createTextNode(r.label));
    box.appendChild(row);
  }
}

// DOM Ready で自動適用（初回のみ）
function onReady() {
  if (window?.map?.getLayer?.('segments-heat')) {
    applyVCStyle(window.map, 'segments-heat');
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady);
} else {
  onReady();
}