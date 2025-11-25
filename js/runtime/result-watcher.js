
// js/runtime/result-watcher.js
(function(){
  let _value = undefined;
  let _attached = false;

  function emit(){
    try{
      const detail = _value || null;
      document.dispatchEvent(new CustomEvent('traffic:refresh', { detail }));
    }catch(_){}
  }

  if (!Object.getOwnPropertyDescriptor(window, '__CALC_RESULT')){
    Object.defineProperty(window, '__CALC_RESULT', {
      configurable: true,
      enumerable: false,
      get(){ return _value; },
      set(v){
        _value = v;
        setTimeout(emit, 0);
      }
    });
    _attached = true;
  }

  if (!_attached){
    let last = window.__CALC_RESULT;
    setInterval(()=>{
      if (window.__CALC_RESULT !== last){
        last = window.__CALC_RESULT;
        _value = last;
        emit();
      }
    }, 800);
  }
})();
