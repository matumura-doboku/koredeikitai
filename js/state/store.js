// js/state/store.js
// Patched: store.js
export const store = {
  aoi: null,
  closures: [],
  settings: { startDate:'', endDate:'', startDateTime:'', endDateTime:'' },
  data: { roads:null, traffic:null },
  results: { features:[], summary:null },
};

export const getState = ()=>store;
export const setAOI = (polygon)=>{ store.aoi = polygon; };
export const addClosures = (ids=[])=>{
  const set = new Set([...(store.closures||[])].map(String));
  for(const id of (ids||[])){ set.add(String(id)); }
  store.closures = Array.from(set);
};
export const clearClosures = ()=>{ store.closures = []; };
