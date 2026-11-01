/* PUT    /api/admin/machines/:id — save changes
   DELETE /api/admin/machines/:id — delete the machine and its photos */
import { json, problem, fromRow, clean, values, getMachine, deletePhotos } from '../../../_lib/machines.js';

export async function onRequestPut({ request, env, params, data }) {
  const before = await getMachine(env, params.id);
  if (!before) return problem('That machine no longer exists. Reload the page.', 404);

  const { machine, error } = clean(await request.json().catch(() => null));
  if (error) return problem(error);

  await env.DB.prepare(
    'UPDATE machines SET published = ?1, status = ?2, category = ?3, year = ?4, manufacturer = ?5, model = ?6, ' +
    'type = ?7, price = ?8, show_price = ?9, specs = ?10, power = ?11, condition = ?12, description = ?13, ' +
    'photos = ?14, video = ?15, updated_at = ?16, updated_by = ?17 WHERE id = ?18'
  ).bind(...values(machine), new Date().toISOString(), data.email, params.id).run();

  // Photos Dave removed from this machine come out of storage too
  const kept = new Set(machine.photos);
  await deletePhotos(env, fromRow(before).photos.filter(p => !kept.has(p)));

  return json(fromRow(await getMachine(env, params.id)));
}

export async function onRequestDelete({ env, params }) {
  const before = await getMachine(env, params.id);
  if (!before) return json({ ok: true });
  await env.DB.prepare('DELETE FROM machines WHERE id = ?1').bind(params.id).run();
  await deletePhotos(env, fromRow(before).photos);
  return json({ ok: true });
}
