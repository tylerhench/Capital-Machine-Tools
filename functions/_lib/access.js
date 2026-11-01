/* Capital Machine Tools — login check
   ------------------------------------------------------------------
   Cloudflare Access asks for the emailed code before anyone reaches
   /admin or /api/admin. When it lets someone through, it attaches a
   signed pass to the request. This file checks that pass is genuine,
   as a second lock in case the Access rule is ever misconfigured.

   Needs two settings in the Pages project (Settings → Variables and Secrets):
     ACCESS_TEAM_DOMAIN  e.g. capitalmachinetools.cloudflareaccess.com
     ACCESS_AUD          the "Application Audience (AUD) Tag" from the Access app */

let certCache = { domain: '', keys: null, fetched: 0 };

async function signingKeys(domain) {
  const fresh = Date.now() - certCache.fetched < 60 * 60 * 1000;
  if (certCache.domain === domain && certCache.keys && fresh) return certCache.keys;
  const res = await fetch('https://' + domain + '/cdn-cgi/access/certs');
  if (!res.ok) throw new Error('Could not load Access signing keys');
  const { keys } = await res.json();
  certCache = { domain, keys, fetched: Date.now() };
  return keys;
}

function b64urlBytes(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
}

/* Returns the signed-in person's email, or null if the pass is missing or fake */
export async function accessEmail(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch (e) { return null; }

  const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const jwk = (await signingKeys(domain)).find(k => k.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') return null;

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (payload.exp && payload.exp < now) return null;
  if (payload.iss && payload.iss !== 'https://' + domain) return null;
  return payload.email || null;
}
