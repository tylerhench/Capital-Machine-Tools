/* POST /api/admin/ebay/disconnect — forget the eBay sign-in.
   Listings on eBay are left as they are. */
import { json } from '../../../_lib/machines.js';
import { clearConnection } from '../../../_lib/ebay.js';

export async function onRequestPost({ env }) {
  await clearConnection(env);
  return json({ ok: true });
}
