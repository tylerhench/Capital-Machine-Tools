/* GET /api/admin/ebay/active — Dave's live eBay listings, marked with
   whether each is already on the website. */
import { json, problem } from '../../../_lib/machines.js';
import { activeListings, EbayError } from '../../../_lib/ebay.js';

export async function onRequestGet({ env }) {
  try {
    const listings = await activeListings(env);
    const { results } = await env.DB.prepare("SELECT ebay_item_id, id FROM machines WHERE ebay_item_id != ''").all();
    const linked = new Map(results.map(r => [r.ebay_item_id, r.id]));
    return json(listings.map(l => ({ ...l, machineId: linked.get(l.itemId) || '' })));
  } catch (e) {
    return problem(e instanceof EbayError ? e.message : 'Couldn’t read the eBay listings: ' + e.message, 502);
  }
}
