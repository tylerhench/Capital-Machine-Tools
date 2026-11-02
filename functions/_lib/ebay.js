/* Capital Machine Tools — eBay connection
   ------------------------------------------------------------------
   Talks to eBay for the admin page: Dave's one-time sign-in, keeping
   that sign-in fresh, and reading his listings.

   Settings in the Pages project (Settings → Variables and Secrets):
     EBAY_ENV            "sandbox" (eBay's practice site) or "production"
     EBAY_CLIENT_ID      App ID from developer.ebay.com
     EBAY_CLIENT_SECRET  Cert ID from developer.ebay.com — add as a Secret
     EBAY_RUNAME         the "RuName" eBay gives for the sign-in redirect

   Dave's eBay sign-in is kept in the settings table, encrypted with a
   key made from EBAY_CLIENT_SECRET. */

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
].join(' ');

const COMPAT_LEVEL = '1349';

export function ebayConfig(env) {
  const sandbox = (env.EBAY_ENV || 'sandbox') !== 'production';
  return {
    ready: !!(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET && env.EBAY_RUNAME),
    sandbox,
    authorizeUrl: sandbox ? 'https://auth.sandbox.ebay.com/oauth2/authorize' : 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: sandbox ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token' : 'https://api.ebay.com/identity/v1/oauth2/token',
    tradingUrl: sandbox ? 'https://api.sandbox.ebay.com/ws/api.dll' : 'https://api.ebay.com/ws/api.dll',
    itemUrl: id => (sandbox ? 'https://www.sandbox.ebay.com/itm/' : 'https://www.ebay.com/itm/') + id
  };
}

export class EbayError extends Error {}

/* ---------- Settings table, with the sign-in encrypted ---------- */

async function getSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first();
  return row ? row.value : null;
}
async function setSetting(env, key, value) {
  await env.DB.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).bind(key, value, new Date().toISOString()).run();
}
export async function clearConnection(env) {
  await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'ebay_%'").run();
}

async function cryptoKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cmt-ebay:' + env.EBAY_CLIENT_SECRET));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function encrypt(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(env), new TextEncoder().encode(text));
  return b64(iv) + '.' + b64(data);
}
async function decrypt(env, stored) {
  const [iv, data] = stored.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await cryptoKey(env), unb64(data));
  return new TextDecoder().decode(plain);
}

/* ---------- Sign-in (OAuth) ---------- */

export function authorizeUrl(env, state) {
  const c = ebayConfig(env);
  const q = new URLSearchParams({
    client_id: env.EBAY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.EBAY_RUNAME,
    scope: SCOPES,
    state
  });
  return c.authorizeUrl + '?' + q.toString();
}

async function tokenRequest(env, form) {
  const c = ebayConfig(env);
  const res = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(env.EBAY_CLIENT_ID + ':' + env.EBAY_CLIENT_SECRET)
    },
    body: new URLSearchParams(form).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new EbayError(data.error_description || data.error || 'eBay sign-in failed (' + res.status + ')');
  return data;
}

/* After Dave approves on eBay: swap the one-time code for a lasting sign-in */
export async function finishConnect(env, code) {
  const t = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: env.EBAY_RUNAME });
  const now = Date.now();
  await setSetting(env, 'ebay_refresh', await encrypt(env, t.refresh_token));
  await setSetting(env, 'ebay_refresh_expires', new Date(now + t.refresh_token_expires_in * 1000).toISOString());
  await setSetting(env, 'ebay_access', await encrypt(env, t.access_token));
  await setSetting(env, 'ebay_access_expires', new Date(now + (t.expires_in - 120) * 1000).toISOString());
  await setSetting(env, 'ebay_env', ebayConfig(env).sandbox ? 'sandbox' : 'production');
  const user = await trading(env, 'GetUser', '').then(x => tag(x, 'UserID')).catch(() => '');
  await setSetting(env, 'ebay_user', user);
}

/* A working access token, refreshed when the 2-hour one runs out */
async function accessToken(env) {
  const [access, accessExp, refresh, refreshExp, connectedEnv] = await Promise.all(
    ['ebay_access', 'ebay_access_expires', 'ebay_refresh', 'ebay_refresh_expires', 'ebay_env'].map(k => getSetting(env, k))
  );
  if (!refresh) throw new EbayError('eBay isn’t connected yet. Use “Connect eBay account” first.');
  if (connectedEnv !== (ebayConfig(env).sandbox ? 'sandbox' : 'production')) {
    throw new EbayError('The site was switched between eBay’s practice and live systems. Connect the eBay account again.');
  }
  if (refreshExp && new Date(refreshExp) < new Date()) {
    throw new EbayError('The eBay connection has expired (eBay requires this every 18 months). Connect the eBay account again.');
  }
  if (access && accessExp && new Date(accessExp) > new Date()) return decrypt(env, access);

  const t = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: await decrypt(env, refresh), scope: SCOPES });
  await setSetting(env, 'ebay_access', await encrypt(env, t.access_token));
  await setSetting(env, 'ebay_access_expires', new Date(Date.now() + (t.expires_in - 120) * 1000).toISOString());
  return t.access_token;
}

export async function connectionStatus(env) {
  const c = ebayConfig(env);
  const [refresh, refreshExp, user, connectedEnv] = await Promise.all(
    ['ebay_refresh', 'ebay_refresh_expires', 'ebay_user', 'ebay_env'].map(k => getSetting(env, k))
  );
  return {
    configured: c.ready,
    sandbox: c.sandbox,
    connected: !!refresh && connectedEnv === (c.sandbox ? 'sandbox' : 'production'),
    user: user || '',
    expires: refreshExp || ''
  };
}

/* ---------- eBay's Trading API (XML) ---------- */

export async function trading(env, call, innerXml) {
  const c = ebayConfig(env);
  const body = '<?xml version="1.0" encoding="utf-8"?>' +
    '<' + call + 'Request xmlns="urn:ebay:apis:eBLBaseComponents">' + innerXml +
    '<ErrorLanguage>en_US</ErrorLanguage><WarningLevel>High</WarningLevel></' + call + 'Request>';
  const res = await fetch(c.tradingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-CALL-NAME': call,
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': COMPAT_LEVEL,
      'X-EBAY-API-IAF-TOKEN': await accessToken(env)
    },
    body
  });
  const xml = await res.text();
  const ack = tag(xml, 'Ack');
  if (!res.ok || ack === 'Failure' || ack === 'PartialFailure') {
    const msgs = blocks(xml, 'Errors')
      .filter(e => tag(e, 'SeverityCode') === 'Error')
      .map(e => tag(e, 'LongMessage') || tag(e, 'ShortMessage'));
    throw new EbayError(msgs.join(' ') || 'eBay said no (' + res.status + ').');
  }
  return xml;
}

/* ---------- Small XML helpers (Workers have no XML parser) ---------- */

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[k];
  });
}
/* Inner XML of every <name>…</name> (not decoded) */
export function blocks(xml, name) {
  const out = [];
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'g');
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
/* Text of the first <name>, decoded */
export function tag(xml, name) {
  const b = blocks(xml, name)[0];
  return b === undefined ? '' : decodeEntities(b.replace(/^<!\[CDATA\[|\]\]>$/g, '')).trim();
}
export function tags(xml, name) {
  return blocks(xml, name).map(b => decodeEntities(b.replace(/^<!\[CDATA\[|\]\]>$/g, '')).trim());
}
export function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

/* ---------- Reading Dave's listings ---------- */

/* Every active listing: [{ itemId, title, price }] */
export async function activeListings(env) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const xml = await trading(env, 'GetMyeBaySelling',
      '<ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage>' +
      '<PageNumber>' + page + '</PageNumber></Pagination></ActiveList><DetailLevel>ReturnAll</DetailLevel>');
    const list = blocks(xml, 'ActiveList')[0] || '';
    for (const item of blocks(list, 'Item')) {
      out.push({
        itemId: tag(item, 'ItemID'),
        title: tag(item, 'Title'),
        price: Number(tag(blocks(item, 'SellingStatus')[0] || '', 'CurrentPrice')) || Number(tag(item, 'BuyItNowPrice')) || 0
      });
    }
    const pages = Number(tag(blocks(list, 'PaginationResult')[0] || '', 'TotalNumberOfPages')) || 1;
    if (page >= pages) break;
  }
  return out;
}

export async function getItem(env, itemId) {
  const xml = await trading(env, 'GetItem',
    '<ItemID>' + xmlEscape(itemId) + '</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics>');
  return blocks(xml, 'Item')[0] || '';
}

/* ---------- eBay listing → website machine ---------- */

const CATEGORY_RULES = [
  [/\bedm\b|electrical discharge/i, 'EDM'],
  [/comparator/i, 'Comparators'],
  [/\bhon(e|es|ing)\b/i, 'Hone'],
  [/drill/i, 'Drills'],
  [/\bcnc\b|machining cent|turning cent/i, 'CNC Machinery'],
  [/lathe/i, 'Lathes'],
  [/grind/i, 'Grinders'],
  [/\bmill(s|ing)?\b/i, 'Milling Machinery'],
  [/\bsaws?\b|band ?saw/i, 'Saws'],
  [/punch press|\bobi\b|stamping press|power press|hydraulic press(?! ?brake)|straight side press|\bpress(es)?$/i, 'Presses'],
  [/shear|press brake|brake|bender|bending|roll(s|er|ing)\b|iron ?worker|notch|punch|fabricat/i, 'Fabricating Machinery'],
  [/press/i, 'Presses']
];
export function guessCategory(text) {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(text)) return cat;
  return null;
}

const SKIP_SPECIFICS = /^(brand|manufacturer|model|mpn|year|year of manufacture|model year|type|machine type|equipment type|upc|ean|isbn|country\/region of manufacture|custom bundle|modified item|non-domestic product|california prop 65 warning|condition|item length|item width|item height|item weight)$/i;

export function specificsOf(itemXml) {
  const box = blocks(itemXml, 'ItemSpecifics')[0] || '';
  return blocks(box, 'NameValueList').map(nv => [tag(nv, 'Name'), tags(nv, 'Value').join(', ')]).filter(r => r[0] && r[1]);
}

export function htmlToText(html) {
  return decodeEntities(String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* The listing's own description. Other parts of the item (like the
   return policy) have a <Description> too, so drop those first and
   take the longest one left. */
function listingDescription(itemXml) {
  const trimmed = itemXml.replace(/<(ReturnPolicy|ShippingDetails|Variations|PaymentMethods|BuyerRequirementDetails)\b[\s\S]*?<\/\1>/g, '');
  return tags(trimmed, 'Description').sort((a, b) => b.length - a.length)[0] || '';
}

/* Asks eBay's picture server for its largest size */
export function largestPicture(url) {
  return url
    .replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1')
    .replace(/\$_\d+\.(jpg|jpeg|png)/i, '$_57.$1');
}

/* eBay's category names are plural ("Drill Presses"); a machine is one */
function singular(name) {
  return String(name || '').trim()
    .replace(/(ss|sh|ch|x)es$/i, '$1')
    .replace(/([^s])s$/i, '$1');
}

/* Everything the website needs, plus what Phase 2 needs to list again */
export function machineFromItem(itemXml) {
  const title = tag(itemXml, 'Title');
  const specifics = specificsOf(itemXml);
  const spec = re => (specifics.find(r => re.test(r[0])) || [])[1] || '';
  const categoryName = tag(blocks(itemXml, 'PrimaryCategory')[0] || '', 'CategoryName');

  let manufacturer = spec(/^(brand|manufacturer)$/i);
  let model = spec(/^(model|mpn)$/i);
  if (!manufacturer) manufacturer = title.split(/\s+/)[0] || 'Unknown';
  if (!model) model = title.replace(new RegExp('^' + manufacturer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').slice(0, 80) || title.slice(0, 80);

  const yearText = spec(/^(year|year of manufacture|model year)$/i) || (title.match(/\b(19[2-9]\d|20[0-4]\d)\b/) || [])[1] || '';
  const type = spec(/^(type|machine type|equipment type)$/i) || singular(categoryName.split(':').pop()) || 'Machine';
  const price = Number(tag(itemXml, 'StartPrice')) || Number(tag(itemXml, 'BuyItNowPrice')) || 0;
  const pictures = tags(blocks(itemXml, 'PictureDetails')[0] || '', 'PictureURL');
  const profiles = blocks(itemXml, 'SellerProfiles')[0] || '';
  const profile = name => {
    const b = blocks(profiles, 'Seller' + name + 'Profile')[0] || '';
    return { id: tag(b, name + 'ProfileID'), name: tag(b, name + 'ProfileName') };
  };

  return {
    machine: {
      published: false,                 // imported machines start hidden for review
      status: 'available',
      // The title says most about the machine; eBay's own category (just the last part:
      // every metalworking category sits under "CNC, Metalworking & Manufacturing") is the fallback
      category: guessCategory(title) || guessCategory(categoryName.split(':').pop()) || 'Misc',
      manufacturer,
      model,
      type,
      year: Number(yearText) || null,
      price,
      showPrice: false,
      specs: specifics.filter(r => !SKIP_SPECIFICS.test(r[0])).slice(0, 3),
      power: spec(/^(voltage|power|power source|electrical)$/i),
      condition: tag(itemXml, 'ConditionDescription'),
      description: htmlToText(listingDescription(itemXml)).slice(0, 8000),
      video: ''
    },
    pictures,                           // eBay's own addresses; see largestPicture()
    dateAdded: (tag(blocks(itemXml, 'ListingDetails')[0] || '', 'StartTime') || '').slice(0, 10),
    ebay: {
      title,
      categoryId: tag(blocks(itemXml, 'PrimaryCategory')[0] || '', 'CategoryID'),
      categoryName,
      conditionId: tag(itemXml, 'ConditionID'),
      bestOffer: tag(blocks(itemXml, 'BestOfferDetails')[0] || '', 'BestOfferEnabled') === 'true',
      location: tag(itemXml, 'Location'),
      postalCode: tag(itemXml, 'PostalCode'),
      policies: { shipping: profile('Shipping'), payment: profile('Payment'), returns: profile('Return') },
      specifics
    }
  };
}
