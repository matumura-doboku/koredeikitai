// /js/system/legend-wire.js
// VC 4段階の凡例を #legend に動的生成し、指標セレクタ変更に追従

import { VC_STYLE } from './js/system/ui-spec.js';

function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

function buildVCLegend() {
  const box = document.getElementById('legend');
  if (!box) return;
  box.innerHTML = '';
  box.appendChild(el('strong', {}, '交通量（V/C）'));
  VC_STYLE.forEach(rule => {
    const sw = el('span', { class: 'sw', style: { background: rule.color } });
    const row = el('div', { class: 'row' }, [sw, rule.label]);
    box.appendChild(row);
  });
}

function onSelectorChange() {
  const sel = document.getElementById('layerSelector');
  if (!sel) return;
  const val = sel.value;
  if (val === 'traffic') {
    buildVCLegend();
  } else {
    // 他指標は仮：凡例を簡易表示
    const box = document.getElementById('legend');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('strong', {}, val === 'noise' ? '騒音（dB）' : 'CO₂'));
    box.appendChild(el('div', { class:'row' }, [el('span', { class:'sw', style:{ background:'#9e9e9e' }}), '準備中']));
  }
}

function mount() {
  buildVCLegend();
  const sel = document.getElementById('layerSelector');
  if (sel) sel.addEventListener('change', onSelectorChange);
}

// DOMが準備できたら実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}