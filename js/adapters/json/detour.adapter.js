// js/adapters/json/detour.adapter.js
export function saveDetoursToJSON(detours){
  try{
    const json = JSON.stringify({ detours }, null, 2);
    const blob = new Blob([json], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'detours.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }catch(e){ console.warn('saveDetoursToJSON failed', e); }
}
export function loadDetoursFromJSON(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const obj = JSON.parse(fr.result);
        resolve(obj.detours || []);
      }catch(e){ reject(e); }
    };
    fr.onerror = reject;
    fr.readAsText(file, 'utf-8');
  });
}