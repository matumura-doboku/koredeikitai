// js/ui/route-toggle.js
// 既存UIに「移動経路」ボタンがある場合にトグル化（任意の補助）
import { bindRouteEditing, startRouteEditing, stopRouteEditing, isRouteEditing } from '../map/layers.js';

export function wireRouteToggle(map){
  bindRouteEditing(map); // ハンドラ初期化（1回だけ）

  const ids = ['route-mode', 'route-start', 'route', 'btn-route'];
  let btn = null;
  for(const id of ids){
    const el = document.getElementById(id);
    if (el){ btn = el; break; }
  }
  if (!btn) return;

  function setUi(on){ btn.classList.toggle('active', !!on); }

  btn.addEventListener('click', ()=>{
    const on = !isRouteEditing();
    if (on) startRouteEditing(); else stopRouteEditing();
    setUi(on);
  });

  window.addEventListener('route:edit:start', ()=> setUi(true));
  window.addEventListener('route:edit:stop',  ()=> setUi(false));
}
