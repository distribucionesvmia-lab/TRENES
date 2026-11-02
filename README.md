# RailTrack España (con datos en directo)

Mapa ferroviario de España. Si el servidor responde, muestra los trenes reales del feed abierto de Renfe
(GTFS-Realtime: posición, velocidad y retraso). Si no, usa una demostración simulada, claramente etiquetada.

## Publicar en Vercel
1. Sube esta carpeta a un repositorio de GitHub (o usa `npx vercel` desde esta carpeta).
2. En vercel.com: Add New > Project > importa el repositorio > Deploy. No hace falta configurar nada.

## Publicar en Netlify
1. Sube la carpeta a GitHub o arrástrala en app.netlify.com/drop (para funciones, mejor repositorio).
2. Add new site > Import from Git > Deploy. `netlify.toml` ya redirige `/api/trains` a la función.

## Comprobar que funciona
Abre `https://TU-SITIO/api/trains`. Debe devolver un JSON con `trains`.
- Si da error 502, Renfe habrá cambiado las URLs del feed: define las variables de entorno
  `RENFE_VP_URL` (posiciones) y `RENFE_TU_URL` (retrasos) con las direcciones actuales
  (están en el portal de datos abiertos de Renfe, buscar «GTFS-Realtime»).
- En la app, Ajustes > Fuente de datos permite forzar En directo o Demo.

## Qué es real y qué no
- Real: posición, velocidad, estado y retraso de los trenes que publique el feed.
- Aún simulado: seguimiento de un viaje concreto, horarios de estación y cruces (solo modo demo).
- iryo y OUIGO no publican datos abiertos equivalentes, así que no aparecen en modo directo.
- Sin GPS ni notificaciones nativas en un navegador web: la ubicación es de prueba salvo que
  el navegador conceda permiso al pulsar «Usar mi ubicación».
