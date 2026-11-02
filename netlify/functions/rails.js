// Netlify: /.netlify/functions/rails (reenviada desde /api/rails)
const { getTile } = require('../../lib/rails');
exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const data = await getTile(q.x, q.y);
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=604800' }, body: JSON.stringify(data) };
  } catch (err) { return { statusCode: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: String(err.message || err) }) }; }
};
