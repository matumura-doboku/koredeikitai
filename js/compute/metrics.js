export function calcVC(flow, capacity){
  if(!capacity || capacity<=0) return Infinity;
  return Math.min(flow / capacity, 99);
}
