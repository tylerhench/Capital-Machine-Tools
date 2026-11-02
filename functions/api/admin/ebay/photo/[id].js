/* POST /api/admin/ebay/photo/:id  { "url": "https://i.ebayimg.com/…" }
   Copies one eBay photo into the website's own storage and adds it to
   the machine. Only eBay's picture servers are allowed as a source. */
import { json, problem, getMachine, fromRow, deletePhotos } from '../../../../_lib/machines.js';
import { largestPicture } from '../../../../_lib/ebay.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTOS = 24;

function fromEbay(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'i.ebayimg.com' || u.hostname.endsWith('.ebayimg.com'));
  } catch (e) { return false; }
}

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  const url = String(body.url || '');
  if (!fromEbay(url)) return problem('Only photos from eBay can be copied here.');

  const row = await getMachine(env, String(params.id || ''));
  if (!row) return problem('That machine no longer exists.', 404);
  if (fromRow(row).photos.length >= MAX_PHOTOS) return json({ added: false, reason: 'full' });

  // eBay's largest size first, then the address eBay gave
  for (const candidate of [...new Set([largestPicture(url), url])]) {
    try {
      const res = await fetch(candidate);
      const type = (res.headers.get('Content-Type') || '').split(';')[0].trim();
      if (!res.ok || !TYPES[type]) continue;
      const data = await res.arrayBuffer();
      if (!data.byteLength || data.byteLength > 8 * 1024 * 1024) continue;

      const key = crypto.randomUUID() + '.' + TYPES[type];
      await env.PHOTOS.put(key, data, { httpMetadata: { contentType: type } });
      const photo = '/photos/' + key;

      // read again just before saving, in case the machine changed meanwhile
      const fresh = await getMachine(env, row.id);
      if (!fresh) { await deletePhotos(env, [photo]); return problem('That machine no longer exists.', 404); }
      const photos = fromRow(fresh).photos.concat(photo);
      await env.DB.prepare('UPDATE machines SET photos = ?1 WHERE id = ?2').bind(JSON.stringify(photos), row.id).run();
      return json({ added: true, photo });
    } catch (e) { /* try the next size */ }
  }
  return problem('eBay didn’t send that photo.', 502);
}
