/* POST /api/admin/ebay/import/:itemId — copy one eBay listing onto the
   website as a hidden machine, for Dave to review. Photos are copied
   afterwards, one per request (see ../photo/[id].js), so each request
   stays well inside Cloudflare's per-request limits. */
import { json, problem, clean, slugify, uniqueId, COLUMNS, values, getMachine, fromRow } from '../../../../_lib/machines.js';
import { getItem, machineFromItem, EbayError } from '../../../../_lib/ebay.js';

const MAX_PHOTOS = 24;   // eBay's own maximum

export async function onRequestPost({ env, params, data }) {
  const itemId = String(params.itemId || '');
  if (!/^\d{6,20}$/.test(itemId)) return problem('That isn’t an eBay item number.');

  const existing = await env.DB.prepare('SELECT id FROM machines WHERE ebay_item_id = ?1').bind(itemId).first();
  if (existing) return json({ skipped: true, id: existing.id });

  let item;
  try {
    item = machineFromItem(await getItem(env, itemId));
  } catch (e) {
    return problem(e instanceof EbayError ? e.message : 'Couldn’t read that eBay listing.', 502);
  }

  const { machine, error } = clean(item.machine);
  if (error) return problem('eBay item ' + itemId + ': ' + error);
  machine.photos = [];
  machine.published = false;

  try {
    const id = await uniqueId(env, slugify([machine.year, machine.manufacturer, machine.model].filter(Boolean).join(' ')));
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO machines (id, ' + COLUMNS + ', date_added, updated_at, updated_by, ebay_item_id, ebay_status, ebay_data) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)'
    ).bind(id, ...values(machine), item.dateAdded || now.slice(0, 10), now, data.email, itemId, 'listed', JSON.stringify(item.ebay)).run();
    return json({ imported: true, machine: fromRow(await getMachine(env, id)), pictures: item.pictures.slice(0, MAX_PHOTOS) }, 201);
  } catch (e) {
    return problem('Couldn’t save eBay item ' + itemId + ': ' + e.message, 500);
  }
}
