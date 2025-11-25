self.onmessage = (e)=>{
  const { cmd } = e.data || {};
  if(cmd === 'ping'){ self.postMessage({ ok:true, pong:true }); }
};
