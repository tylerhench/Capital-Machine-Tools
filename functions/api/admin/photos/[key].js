/* DELETE /api/admin/photos/:key — remove a photo that was uploaded
   but never saved to a machine (e.g. Dave pressed Cancel). */
import { json, problem, isPhotoUrl } from '../../../_lib/machines.js';

export async function onRequestDelete({ env, params }) {
  const url = '/photos/' + params.key;
  if (!isPhotoUrl(url)) return problem('Not a photo address.');
  // Never delete a photo a saved machine still uses
  const used = await env.DB.prepare('SELECT 1 FROM machines WHERE instr(photos, ?1) > 0 LIMIT 1')
    .bind('"' + url + '"').first();
  if (!used) await env.PHOTOS.delete(params.key);
  return json({ ok: true });
}
