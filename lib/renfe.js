// Lógica compartida (Vercel y Netlify). Lee los feeds GTFS-Realtime en JSON de Renfe (datos abiertos)
// y devuelve una lista simple de trenes. Sin dependencias externas (Node 18+).
// Direcciones sobreescribibles con variables de entorno (separadas por coma):
//   RENFE_VP_URLS  posiciones   RENFE_TU_URLS  retrasos
const VP = (process.env.RENFE_VP_URLS || 'https://gtfsrt.renfe.com/vehicle_positions_LD.json,https://gtfsrt.renfe.com/vehicle_positions.json').split(',');
const TU = (process.env.RENFE_TU_URLS || 'https://gtfsrt.renfe.com/trip_updates_LD.json,https://gtfsrt.renfe.com/trip_updates.json').split(',');

const pick = (o, ...k) => { for (const n of k) if (o && o[n] != null) return o[n]; return undefined; };

async function feed(url) {
  const r = await fetch(url.trim(), { headers: { 'user-agent': 'railtrack-espana', accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' respondió HTTP ' + r.status);
  const j = await r.json();
  return Array.isArray(j.entity) ? j.entity : [];
}

async function getTrains() {
  const [vps, tus] = await Promise.all([
    Promise.allSettled(VP.map(feed)),
    Promise.allSettled(TU.map(feed)),
  ]);
  const errors = vps.filter(x => x.status === 'rejected').map(x => String(x.reason.message || x.reason));
  if (vps.every(x => x.status === 'rejected')) throw new Error(errors.join(' | '));

  const delays = {};
  for (const res of tus) {
    if (res.status !== 'fulfilled') continue;
    for (const e of res.value) {
      const u = pick(e, 'tripUpdate', 'trip_update');
      if (!u) continue;
      const trip = u.trip || {};
      const id = pick(trip, 'tripId', 'trip_id');
      let d = u.delay;
      if (d == null) {
        const st = pick(u, 'stopTimeUpdate', 'stop_time_update');
        if (st && st.length) {
          const s = st[0];
          d = (s.arrival && s.arrival.delay) != null ? s.arrival.delay : (s.departure && s.departure.delay);
        }
      }
      if (id != null && d != null) delays[id] = Number(d);
    }
  }

  const STATUS = { INCOMING_AT: 'Llegando a parada', STOPPED_AT: 'Parado en estación', IN_TRANSIT_TO: 'En marcha', 0: 'Llegando a parada', 1: 'Parado en estación', 2: 'En marcha' };
  const seen = new Set(), trains = [];
  for (const res of vps) {
    if (res.status !== 'fulfilled') continue;
    for (const e of res.value) {
      const v = e.vehicle;
      const pos = v && v.position;
      if (!pos || pos.latitude == null || pos.longitude == null) continue;
      const veh = v.vehicle || {};
      const trip = v.trip || {};
      const tripId = pick(trip, 'tripId', 'trip_id');
      const id = String(veh.id || e.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const ts = Number(v.timestamp);
      trains.push({
        id,
        label: String(veh.label || tripId || id),
        lat: Number(pos.latitude),
        lon: Number(pos.longitude),
        bearing: pos.bearing != null ? Number(pos.bearing) : null,
        speed: pos.speed != null ? Math.round(Number(pos.speed) * 3.6) : null,
        status: STATUS[pick(v, 'currentStatus', 'current_status')] || null,
        stopId: pick(v, 'stopId', 'stop_id') || null,
        tripId: tripId || null,
        delay: tripId != null && delays[tripId] != null ? delays[tripId] : null,
        time: ts ? ts * 1000 : null,
      });
    }
  }
  return { ts: Date.now(), source: 'Renfe GTFS-Realtime (datos abiertos)', warnings: errors, trains };
}

module.exports = { getTrains };
