/* POST /api/admin/ebay/import/:itemId — copy one eBay listing onto the
   website as a hidden machine, with its photos, for Dave to review.
   One listing per request keeps each well inside Cloudflare's limits. */
import { json, problem, clean, slugify, uniqueId, COLUMNS, values, getMachine, fromRow, deletePhotos } from '../../../../_lib/machines.js';
import { getItem, machineFromItem, largestPicture, EbayError } from '../../../../_lib/ebay.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTOS = 12;

async function copyPicture(env, urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const type = (res.headers.get('Content-Type') || '').split(';')[0].trim();
      if (!res.ok || !TYPES[type]) continue;
      const body = await res.arrayBuffer();
      if (!body.byteLength || body.byteLength > 8 * 1024 * 1024) continue;
      const key = crypto.randomUUID() + '.' + TYPES[type];
      await env.PHOTOS.put(key, body, { httpMetadata: { contentType: type } });
      return '/photos/' + key;
    } catch (e) { /* try the next size */ }
  }
  return null;
}

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

  // Copy the photos into the website's own storage, largest size first
  const photos = [];
  for (const original of item.pictures.slice(0, MAX_PHOTOS)) {
    const url = await copyPicture(env, [...new Set([largestPicture(original), original])]);
    if (url) photos.push(url);
  }
  machine.photos = photos;
  machine.published = false;

  try {
    const id = await uniqueId(env, slugify([machine.year, machine.manufacturer, machine.model].filter(Boolean).join(' ')));
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO machines (id, ' + COLUMNS + ', date_added, updated_at, updated_by, ebay_item_id, ebay_status, ebay_data) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)'
    ).bind(id, ...values(machine), item.dateAdded || now.slice(0, 10), now, data.email, itemId, 'listed', JSON.stringify(item.ebay)).run();
    return json({ imported: true, machine: fromRow(await getMachine(env, id)), photos: photos.length, of: item.pictures.length }, 201);
  } catch (e) {
    await deletePhotos(env, photos);
    return problem('Couldn’t save eBay item ' + itemId + ': ' + e.message, 500);
  }
}
