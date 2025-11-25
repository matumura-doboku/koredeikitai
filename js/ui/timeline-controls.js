// js/ui/timeline-controls.js
export function wireTimelineControls(){
  const t=document.getElementById('ui-t');
  const lbl=document.getElementById('ui-t-label');
  if(t && lbl){
    const sync=()=> lbl.textContent=String(Number(t.value)).padStart(2,'0');
    t.addEventListener('input', sync); sync();
  }
}
