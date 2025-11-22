// js/services/capacity.service.js
import { BASE_CAPACITY_PER_LANE, PARTIAL_CAPACITY_PER_LANE, INTERSECTION_FACTOR } from '../config/capacity.js';

/**
 * Calculate effective capacity (youryou) for a link, considering closures and intersection factor.
 * @param {Object} props - link properties (sensyu, syasensuu, bunki_count, linkid, etc.)
 * @param {Object} closure - { type: 'full'|'partial', closedLanes: number } or null
 * @returns {number} effective capacity for the link (per hour)
 */
export function calcCapacity(props={}, closure=null){
  const sensyu = String(props.sensyu || 'Other');
  const lanes  = Math.max(1, Number(props.syasensuu || 1));
  let capPerLane = BASE_CAPACITY_PER_LANE[sensyu] ?? BASE_CAPACITY_PER_LANE.Other;
  let laneCountForCap = lanes;

  if (closure && closure.type === 'full') {
    return 0;
  }
  if (closure && closure.type === 'partial') {
    const closed = Math.max(0, Math.min(lanes, Number(closure.closedLanes || 0)));
    const open   = Math.max(0, lanes - closed);
    const partialPerLane = PARTIAL_CAPACITY_PER_LANE[sensyu] ?? PARTIAL_CAPACITY_PER_LANE.Other;
    capPerLane = partialPerLane;
    laneCountForCap = open;
  }

  let cap = capPerLane * laneCountForCap;
  const bunki = Number(props.bunki_count || 0);
  if (bunki >= 1) cap *= INTERSECTION_FACTOR;
  return Math.max(0, Math.round(cap));
}