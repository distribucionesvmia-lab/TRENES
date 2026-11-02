// Vercel: /api/rails?x=-4&y=40  (celda de 1° cuyo vértice suroeste es lon=x, lat=y)
const { getTile } = require('../lib/rails');
module.exports = async (req, res) => {
  try {
    const data = await getTile(req.query.x, req.query.y);
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) { res.status(502).json({ error: String(err.message || err) }); }
};
