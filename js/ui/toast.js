export function notify(message, type='info'){
  const wrap = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast ' + (type==='ok'?'ok':type==='warn'?'warn':type==='bad'?'bad':'');
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(), 600); }, 2600);
}
