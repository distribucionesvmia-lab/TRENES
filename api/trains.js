// Vercel: /api/trains
const { getTrains } = require('../lib/renfe');
module.exports = async (req, res) => {
  try {
    const data = await getTrains();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
