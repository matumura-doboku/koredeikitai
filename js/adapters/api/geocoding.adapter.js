// Nominatim (OSM) を使った簡易ジオコーディング
// 公開運用では自前プロキシ経由を推奨（レート/利用規約対策）
export async function geocode(query, { limit=5, lang='ja' } = {}){
  if (!query || !query.trim()) return [];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format','json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('accept-language', lang);
  url.searchParams.set('q', query.trim());
  const res = await fetch(url.toString(), { headers:{ 'Accept':'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const arr = await res.json();
  return arr.map(x=>({ lon:+x.lon, lat:+x.lat, display_name:x.display_name }));
}
