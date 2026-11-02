/* Capital Machine Tools — shared backend code
   ------------------------------------------------------------------
   Used by the files in functions/api. Not a page or a route itself.
   Cloudflare provides two connections, set up under the Pages
   project's Settings → Bindings:
     env.DB      the D1 database (cmt-inventory)
     env.PHOTOS  the R2 photo bucket (cmt-photos) */

export const STATUSES = ['available', 'pending', 'sold'];
const PHOTO_PREFIX = '/photos/';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export function problem(message, status = 400) {
  return json({ error: message }, status);
}

/* Database row → the shape the pages use */
export function fromRow(r) {
  return {
    id: r.id,
    published: !!r.published,
    status: r.status,
    category: r.category,
    year: r.year || '',
    manufacturer: r.manufacturer,
    model: r.model,
    type: r.type,
    price: r.price,
    showPrice: !!r.show_price,
    specs: safeParse(r.specs, []),
    power: r.power,
    condition: r.condition,
    description: r.description,
    photos: safeParse(r.photos, []),
    video: r.video,
    dateAdded: r.date_added,
    ebayItemId: r.ebay_item_id || '',
    ebayStatus: r.ebay_status || '',
    ebayError: r.ebay_error || ''
  };
}

function safeParse(text, fallback) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

/* Checks what the admin page sent and returns clean values, or an error message */
export function clean(input) {
  if (!input || typeof input !== 'object') return { error: 'Nothing was sent.' };
  const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

  const m = {
    status: STATUSES.includes(input.status) ? input.status : 'available',
    category: text(input.category, 60),
    manufacturer: text(input.manufacturer, 80),
    model: text(input.model, 80),
    type: text(input.type, 100),
    power: text(input.power, 120),
    condition: text(input.condition, 4000),
    description: text(input.description, 8000),
    video: /^[\w-]{11}$/.test(input.video || '') ? input.video : ''
  };
  m.published = m.status !== 'sold' && !!input.published;
  m.showPrice = !!input.showPrice;

  const year = Number(input.year);
  m.year = Number.isInteger(year) && year >= 1850 && year <= 2100 ? year : null;
  const price = Number(input.price);
  m.price = Number.isFinite(price) && price > 0 ? Math.min(Math.round(price), 100000000) : 0;

  m.specs = (Array.isArray(input.specs) ? input.specs : [])
    .filter(r => Array.isArray(r) && r[0] && r[1])
    .slice(0, 3)
    .map(r => [text(r[0], 40), text(r[1], 80)]);

  m.photos = (Array.isArray(input.photos) ? input.photos : [])
    .filter(p => typeof p === 'string' && isPhotoUrl(p))
    .slice(0, 40);

  if (!m.category) return { error: 'Choose a category.' };
  if (!m.manufacturer) return { error: 'Enter the manufacturer.' };
  if (!m.model) return { error: 'Enter the model.' };
  if (!m.type) return { error: 'Enter the machine type.' };
  return { machine: m };
}

export function isPhotoUrl(p) {
  return p.startsWith(PHOTO_PREFIX) && /^[\w-]+\.(jpg|png|webp)$/.test(p.slice(PHOTO_PREFIX.length));
}
export function photoKey(url) {
  return url.slice(PHOTO_PREFIX.length);
}

/* Removes photos from storage that a machine no longer uses */
export async function deletePhotos(env, urls) {
  const keys = urls.filter(isPhotoUrl).map(photoKey);
  if (keys.length) await env.PHOTOS.delete(keys);
}

export function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').slice(0, 70).replace(/^-+|-+$/g, '') || 'machine';
}

export async function uniqueId(env, base) {
  // Plain text comparison: Cloudflare's database rejects LIKE patterns over ~50 characters
  const rows = await env.DB.prepare('SELECT id FROM machines WHERE id = ?1 OR substr(id, 1, ?2) = ?3')
    .bind(base, base.length + 1, base + '-').all();
  const taken = new Set(rows.results.map(r => r.id));
  let id = base, n = 2;
  while (taken.has(id)) id = base + '-' + n++;
  return id;
}

/* Values in the same order as the columns in COLUMNS */
export const COLUMNS = 'published, status, category, year, manufacturer, model, type, price, show_price, specs, power, condition, description, photos, video';
export function values(m) {
  return [
    m.published ? 1 : 0, m.status, m.category, m.year, m.manufacturer, m.model, m.type,
    m.price, m.showPrice ? 1 : 0, JSON.stringify(m.specs), m.power, m.condition,
    m.description, JSON.stringify(m.photos), m.video
  ];
}

export async function getMachine(env, id) {
  return env.DB.prepare('SELECT * FROM machines WHERE id = ?1').bind(id).first();
}
