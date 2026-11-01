/* GET  /api/admin/machines — every machine, for Dave's page
   POST /api/admin/machines — add a machine */
import { json, problem, fromRow, clean, slugify, uniqueId, COLUMNS, values, getMachine } from '../../../_lib/machines.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM machines ORDER BY date_added DESC').all();
  return json(results.map(fromRow));
}

export async function onRequestPost({ request, env, data }) {
  const { machine, error } = clean(await request.json().catch(() => null));
  if (error) return problem(error);

  const id = await uniqueId(env, slugify([machine.year, machine.manufacturer, machine.model].filter(Boolean).join(' ')));
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO machines (id, ' + COLUMNS + ', date_added, updated_at, updated_by) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)'
  ).bind(id, ...values(machine), now.slice(0, 10), now, data.email).run();

  return json(fromRow(await getMachine(env, id)), 201);
}
