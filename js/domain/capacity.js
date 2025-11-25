// js/domain/capacity.js
export function capacityFull(roadClass, lanes, basePerLane){
  const lc = Math.max(0, lanes ?? 1);
  const v = basePerLane?.[roadClass] ?? basePerLane?.Other ?? 300;
  return lc * v;
}
export function capacityPartial(roadClass, usableLanes, partialPerLane){
  const lc = Math.max(0, usableLanes ?? 0);
  const v = partialPerLane?.[roadClass] ?? partialPerLane?.Other ?? 300;
  return lc * v;
}
export function applyIntersectionFactor(capacity, isIntersection, factor=0.7){
  return isIntersection ? Math.round((capacity ?? 0) * (factor ?? 1)) : capacity ?? 0;
}