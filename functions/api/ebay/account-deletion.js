/* /api/ebay/account-deletion — eBay requires every connected app to
   receive notices when any eBay member deletes their account. This
   site stores no eBay buyers' details, so the notice is just
   acknowledged.

   Needs EBAY_VERIFICATION_TOKEN (32–80 letters/numbers, any value you
   choose) in the Pages settings, entered on eBay's developer site too. */
const ENDPOINT = 'https://capitalmachinetools.com/api/ebay/account-deletion';

/* eBay checks the address by sending a challenge code */
export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get('challenge_code');
  if (!code || !env.EBAY_VERIFICATION_TOKEN) return new Response('Not found', { status: 404 });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code + env.EBAY_VERIFICATION_TOKEN + ENDPOINT));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return new Response(JSON.stringify({ challengeResponse: hex }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost() {
  return new Response(null, { status: 204 });
}
