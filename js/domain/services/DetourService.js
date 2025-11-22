// js/domain/services/DetourService.js
// Build "injections" (additional sources) for detours based on lost flows near startNodeId.
export function buildDetourInjections({ store, prevFlowsByLink, graph }){
  const injections = [];
  for(const detour of store.detours){
    const lost = estimateLostFlowNear(detour.startNodeId, prevFlowsByLink, graph);
    const inflow = (lost || 0) * (detour.inflowRatio ?? 0.9);
    injections.push({ nodeId: detour.startNodeId, amount: inflow, pathLinkIds: detour.pathLinkIds, endNodeId: detour.endNodeId });
  }
  return injections;
}

// naive: sum of lost flows on incident links of the node
function estimateLostFlowNear(nodeId, prevFlowsByLink, graph){
  if(!nodeId || !graph || !graph.incidentLinks) return 0;
  const links = graph.incidentLinks(nodeId) || [];
  let s = 0;
  for(const lid of links){
    const f = prevFlowsByLink?.[lid];
    if(typeof f === 'number' && f>0) s += f * 0.5; // half as conservative estimate
  }
  return s;
}