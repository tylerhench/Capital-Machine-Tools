/* Runs before every /api/admin request: only signed-in people get through. */
import { accessEmail } from '../../_lib/access.js';
import { problem } from '../../_lib/machines.js';

export async function onRequest(context) {
  const { request, env } = context;
  const host = new URL(request.url).hostname;

  // Local testing on this computer only (never true on the live site)
  if (env.LOCAL_DEV === '1' && (host === 'localhost' || host === '127.0.0.1')) {
    context.data.email = 'local-test';
    return context.next();
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return problem('The login check isn’t set up yet (ACCESS_TEAM_DOMAIN and ACCESS_AUD).', 500);
  }
  let email = null;
  try { email = await accessEmail(request, env); } catch (e) { email = null; }
  if (!email) return problem('Please sign in again. Reload the page.', 401);

  context.data.email = email;
  return context.next();
}
