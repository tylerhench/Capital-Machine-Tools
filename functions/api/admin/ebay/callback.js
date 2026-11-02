/* GET /api/admin/ebay/callback — eBay sends Dave back here after he approves.
   This address is the "auth accepted URL" set on the eBay RuName. */
import { finishConnect } from '../../../_lib/ebay.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)ebay_state=([^;]+)/);
  const back = msg => new Response(null, {
    status: 302,
    headers: {
      Location: '/admin/?ebay=' + encodeURIComponent(msg),
      'Set-Cookie': 'ebay_state=; Path=/api/admin/ebay; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
    }
  });

  if (url.searchParams.get('error') || !url.searchParams.get('code')) return back('declined');
  if (!cookie || cookie[1] !== url.searchParams.get('state')) return back('expired');
  try {
    await finishConnect(env, url.searchParams.get('code'));
    return back('connected');
  } catch (e) {
    return back('failed: ' + e.message);
  }
}
