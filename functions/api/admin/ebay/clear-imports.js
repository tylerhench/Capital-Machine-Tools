/* POST /api/admin/ebay/clear-imports — remove machines that came from eBay
   and haven't been put on the website yet (with their website photos), so
   an import can be run again cleanly. Never touches eBay itself, published
   machines, or machines added by hand. */
import { json, fromRow, deletePhotos } from '../../../_lib/machines.js';

export async function onRequestPost({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM machines WHERE ebay_item_id != '' AND published = 0 AND status != 'sold'"
  ).all();
  for (const row of results) {
    await env.DB.prepare('DELETE FROM machines WHERE id = ?1').bind(row.id).run();
    await deletePhotos(env, fromRow(row).photos);
  }
  return json({ removed: results.length });
}
