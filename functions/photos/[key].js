/* GET /photos/:key — serve a machine photo from storage.
   Each photo gets a new random name, so browsers can keep it for a year. */
export async function onRequestGet({ env, params }) {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(params.key)) return new Response('Not found', { status: 404 });
  const obj = await env.PHOTOS.get(params.key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { headers });
}
