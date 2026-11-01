/* POST /api/admin/photos — store one photo, return its address.
   The admin page shrinks photos to about 200 KB before sending. */
import { json, problem } from '../../../_lib/machines.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 8 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!TYPES[type]) return problem('Photos must be JPEG, PNG or WebP.', 415);

  const body = await request.arrayBuffer();
  if (!body.byteLength) return problem('The photo was empty.');
  if (body.byteLength > MAX_BYTES) return problem('That photo is too large.', 413);

  const key = crypto.randomUUID() + '.' + TYPES[type];
  await env.PHOTOS.put(key, body, { httpMetadata: { contentType: type } });
  return json({ url: '/photos/' + key }, 201);
}
