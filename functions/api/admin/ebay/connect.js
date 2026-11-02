/* GET /api/admin/ebay/connect — sends Dave to eBay to approve access */
import { problem } from '../../../_lib/machines.js';
import { ebayConfig, authorizeUrl } from '../../../_lib/ebay.js';

export async function onRequestGet({ env }) {
  if (!ebayConfig(env).ready) return problem('eBay isn’t set up on the website yet (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME).', 500);
  const state = crypto.randomUUID();
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl(env, state),
      // remembered for 15 minutes so the reply from eBay can be checked
      'Set-Cookie': 'ebay_state=' + state + '; Path=/api/admin/ebay; Max-Age=900; HttpOnly; Secure; SameSite=Lax'
    }
  });
}
