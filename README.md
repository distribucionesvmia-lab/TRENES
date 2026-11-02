# RailTrack España

Mapa de los trenes de Renfe en directo, con las vías dibujadas con geometría real.

## Cómo funciona
- `/api/trains`: lee los feeds abiertos de Renfe (`gtfsrt.renfe.com`, JSON) y devuelve posición, velocidad y retraso.
- `/api/rails?x=&y=`: devuelve la geometría real de las vías (OpenStreetMap, vía Overpass) de una celda de 1° x 1°.
  La app la pide al hacer zoom y la coloca sobre el mapa; los trenes se ajustan a esas vías.
  Cada celda se cachea una semana en el CDN, así que Overpass apenas recibe peticiones.
- Nombres de los trenes (tipo de servicio, origen, destino, próxima parada): `/api/trains` lee por rangos las tablas del GTFS estático de Renfe (`RENFE_STATIC_URLS` para cambiar las direcciones). Si no se pueden leer, se muestra solo el tipo de tren.
- Sin dependencias externas (Node 18+).

## Publicar
- **Vercel:** Add New > Project > importa el repositorio > Deploy.
- **Netlify:** Add new site > Import from Git > Deploy (`netlify.toml` ya redirige `/api/*`).

## Comprobar
- `https://TU-SITIO/api/trains` debe devolver `trains`.
- `https://TU-SITIO/api/rails?x=-4&y=40` debe devolver `ways` (zona de Madrid).
- Si alguna falla, define `RENFE_VP_URLS`, `RENFE_TU_URLS` u `OVERPASS_URL` con direcciones alternativas.

## Créditos y límites
Datos de Renfe (CC BY 4.0). Vías: © OpenStreetMap contributors (ODbL). Aplicación independiente, sin relación con Renfe.
iryo y OUIGO no publican datos abiertos, por eso no aparecen. El feed no incluye nombres de paradas.
