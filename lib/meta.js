// Nombres de trenes: tipo de servicio, origen y destino, a partir del GTFS estático de Renfe.
// Se lee el .zip por rangos HTTP (solo las tablas necesarias) y se guarda en memoria 6 h.
// Sin dependencias (Node 18+). Si falla, la app sigue funcionando sin nombres detallados.
const zlib = require('zlib');
const SOURCES = (process.env.RENFE_STATIC_URLS ||
  'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip,https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip').split(',');

async function rget(url, range) {
  const r = await fetch(url, { headers: { range, 'user-agent': 'railtrack-espana' } });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), cr: r.headers.get('content-range') };
}

async function readZip(url, wanted) {
  const first = await rget(url, 'bytes=-131072');
  let full = null, total;
  if (first.status === 200) { full = first.buf; total = full.length; } else total = Number((first.cr || '').split('/')[1]);
  const get = async (a, b) => (full ? full.subarray(a, b + 1) : (await rget(url, `bytes=${a}-${b}`)).buf);
  const tail = first.buf, tailStart = total - tail.length;
  const e = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (e < 0) throw new Error('zip sin directorio central');
  const cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
  const cd = cdOff >= tailStart ? tail.subarray(cdOff - tailStart, cdOff - tailStart + cdSize) : await get(cdOff, cdOff + cdSize - 1);
  const found = {};
  for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
    const method = cd.readUInt16LE(p + 10), cs = cd.readUInt32LE(p + 20), nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32), lo = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nl).split('/').pop();
    if (wanted.includes(name)) found[name] = { method, cs, lo };
    p += 46 + nl + el + cl;
  }
  const out = {};
  for (const name of Object.keys(found)) {
    const { method, cs, lo } = found[name];
    let buf = await get(lo, lo + 30 + 1024 + cs);
    const start = 30 + buf.readUInt16LE(26) + buf.readUInt16LE(28);
    if (start + cs > buf.length) buf = await get(lo, lo + start + cs);
    const data = buf.subarray(start, start + cs);
    out[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8').replace(/^﻿/, '');
  }
  return out;
}

function csv(text) {
  const rows = []; let f = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const H = rows.shift() || [];
  return { H, rows, i: n => H.indexOf(n) };
}

let cache = null;
async function loadStatic() {
  if (cache && Date.now() - cache.t < 6 * 3600e3) return cache.v;
  const v = { routes: {}, trips: {}, byNum: {}, stops: {} };
  const res = await Promise.allSettled(SOURCES.map(u => readZip(u.trim(), ['routes.txt', 'trips.txt', 'stops.txt'])));
  let ok = 0;
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    ok++;
    const f = r.value;
    if (f['routes.txt']) { const t = csv(f['routes.txt']), a = t.i('route_id'), s = t.i('route_short_name'), l = t.i('route_long_name');
      for (const x of t.rows) v.routes[x[a]] = { short: x[s] || '', long: x[l] || '' }; }
    if (f['stops.txt']) { const t = csv(f['stops.txt']), a = t.i('stop_id'), n = t.i('stop_name');
      for (const x of t.rows) v.stops[x[a]] = x[n]; }
    if (f['trips.txt']) { const t = csv(f['trips.txt']), a = t.i('trip_id'), r2 = t.i('route_id'), h = t.i('trip_headsign');
      for (const x of t.rows) { const o = { r: x[r2], h: h >= 0 ? x[h] : '' }; v.trips[x[a]] = o; const n = (x[a].match(/^\d+/) || [])[0]; if (n) v.byNum[n] = o; } }
  }
  if (!ok) throw new Error('no se pudo leer ningún GTFS estático');
  cache = { t: Date.now(), v };
  return v;
}

const SERV = { AVE: 'AVE', ALVIA: 'Alvia', AVLO: 'Avlo', AVANT: 'Avant', MD: 'Media Distancia', REGIONAL: 'Regional', EUROMED: 'Euromed', INTERCITY: 'Intercity', TRENHOTEL: 'Trenhotel', ALTARIA: 'Altaria', TALGO: 'Talgo' };

function describe(meta, tripId, label, stopId) {
  const out = { service: null, from: null, to: null, nextStop: null };
  const lab = String(label || '');
  const cer = lab.match(/^([A-Z]{1,2}\d{1,2}[a-z]?)-/);
  if (cer) out.service = 'Cercanías ' + cer[1];
  if (meta) {
    const id = String(tripId || ''), num = (id.match(/^\d+/) || [])[0];
    const t = meta.trips[id] || (num && meta.byNum[num]);
    if (t) {
      const r = meta.routes[t.r] || {};
      const sv = (r.short || '').trim();
      if (sv && !out.service) out.service = SERV[sv.toUpperCase()] || sv;
      const parts = (r.long || '').split(' - ');
      if (parts.length === 2) { out.from = parts[0].trim(); out.to = parts[1].trim(); }
      if (t.h) out.to = t.h.trim();
    }
    if (stopId && meta.stops[stopId]) out.nextStop = meta.stops[stopId];
  }
  return out;
}
module.exports = { loadStatic, describe };
