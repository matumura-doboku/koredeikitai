export function wireTabs(){
  const tabs=document.querySelectorAll('.tab');
  const panels=document.querySelectorAll('.panel');
  tabs.forEach(btn=>{
    btn.addEventListener('click',()=>{
      tabs.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const id=btn.dataset.tab;
      panels.forEach(p=>p.classList.toggle('hidden', p.dataset.panel!==id));
    });
  });
}