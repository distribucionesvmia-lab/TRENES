// Geometría real de las vías (OpenStreetMap vía Overpass) por celdas de 1° x 1°.
// Devuelve las líneas principales simplificadas. Sin dependencias (Node 18+).
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let m = -1, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > m) { m = d; idx = i; }
    }
    if (m > tol) { keep[idx] = 1; st.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

async function getTile(x, y) {
  x = Math.floor(Number(x)); y = Math.floor(Number(y));
  if (!(x >= -10 && x <= 5 && y >= 35 && y <= 44)) throw new Error('celda fuera de España');
  const q = `[out:json][timeout:25];way["railway"="rail"]["usage"~"^(main|branch)$"][!"service"](${y},${x},${y + 1},${x + 1});out geom qt;`;
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'railtrack-espana' },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!r.ok) throw new Error('Overpass respondió HTTP ' + r.status);
  const j = await r.json();
  const ways = [];
  for (const e of j.elements || []) {
    if (!e.geometry || e.geometry.length < 2) continue;
    const pts = dp(e.geometry.map(g => [g.lon, g.lat]), 0.0003).map(p => [+p[0].toFixed(4), +p[1].toFixed(4)]);
    ways.push({ h: e.tags && e.tags.highspeed === 'yes' ? 1 : 0, p: pts });
  }
  return { x, y, ways };
}
module.exports = { getTile };
