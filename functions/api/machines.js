/* GET /api/machines — what buyers see: published machines that aren't sold. */
import { json, fromRow } from '../_lib/machines.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM machines WHERE published = 1 AND status != 'sold' ORDER BY date_added DESC"
  ).all();
  return json(results.map(fromRow));
}
