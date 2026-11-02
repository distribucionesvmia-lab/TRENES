// Netlify: /.netlify/functions/trains (reenviada desde /api/trains en netlify.toml)
const { getTrains } = require('../../lib/renfe');
exports.handler = async () => {
  try {
    const data = await getTrains();
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=15' }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
