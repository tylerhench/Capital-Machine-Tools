/* GET /api/admin/ebay/status — is eBay set up and connected? */
import { json } from '../../../_lib/machines.js';
import { connectionStatus } from '../../../_lib/ebay.js';

export async function onRequestGet({ env }) {
  try {
    return json(await connectionStatus(env));
  } catch (e) {
    // most likely the eBay database update (migrations/002-ebay.sql) hasn't been run yet
    return json({ configured: false, connected: false, setupError: 'The eBay database update hasn’t been run yet (migrations/002-ebay.sql).' });
  }
}
