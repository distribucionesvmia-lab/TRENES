// Lógica compartida (Vercel y Netlify). Lee el feed GTFS-Realtime abierto de Renfe y devuelve JSON simple.
// Si Renfe cambia las URLs, defínelas como variables de entorno en Vercel:
//   RENFE_VP_URL (posiciones de vehículos)  y  RENFE_TU_URL (actualizaciones de viaje / retrasos)
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const VP_URL = process.env.RENFE_VP_URL || 'https://gtfs.renfe.com/vehicle_positions.pb';
const TU_URL = process.env.RENFE_TU_URL || 'https://gtfs.renfe.com/trip_updates.pb';

async function feed(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'railtrack-espana' } });
  if (!r.ok) throw new Error(url + ' respondió HTTP ' + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
}

async function getTrains() {

    const [vp, tu] = await Promise.all([feed(VP_URL), feed(TU_URL).catch(() => null)]);
    const delays = {};
    if (tu) {
      for (const e of tu.entity) {
        const u = e.tripUpdate;
        if (!u || !u.trip) continue;
        let d = u.delay;
        if (d == null && u.stopTimeUpdate && u.stopTimeUpdate.length) {
          const s = u.stopTimeUpdate[0];
          d = (s.arrival && s.arrival.delay) ?? (s.departure && s.departure.delay);
        }
        if (d != null) delays[u.trip.tripId] = Number(d);
      }
    }
    const STATUS = ['Llegando a parada', 'Parado en estación', 'En marcha'];
    const trains = [];
    for (const e of vp.entity) {
      const v = e.vehicle;
      if (!v || !v.position || v.position.latitude == null) continue;
      const tripId = v.trip && v.trip.tripId;
      trains.push({
        id: String((v.vehicle && v.vehicle.id) || e.id),
        label: String((v.vehicle && v.vehicle.label) || (v.trip && v.trip.routeId) || e.id),
        lat: v.position.latitude,
        lon: v.position.longitude,
        bearing: v.position.bearing || 0,
        speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : null,
        status: v.currentStatus != null ? STATUS[v.currentStatus] || null : null,
        stopId: v.stopId || null,
        tripId: tripId || null,
        delay: tripId && delays[tripId] != null ? delays[tripId] : null,
        time: v.timestamp ? Number(v.timestamp) * 1000 : null,
      });
    }
  return { ts: Date.now(), source: 'Renfe GTFS-Realtime', trains };
}

module.exports = { getTrains, feed };
