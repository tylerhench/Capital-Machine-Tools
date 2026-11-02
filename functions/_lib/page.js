/* Capital Machine Tools — machine pages for search engines
   ------------------------------------------------------------------
   Builds /inventory/<machine-id> on request: takes inventory.html
   (so the header, menu and footer stay in one place) and fills in
   that machine's title, description, share preview, Google product
   details and page content.

   The page markup here matches renderDetail() in inventory.js, which
   the admin page uses. If you change one, change the other. */

export const SITE = 'https://capitalmachinetools.com';
const PHONE = '203-767-6705';
const TEL = '+12037676705';
const EMAIL = 'dave@capitalmachinetools.com';

const ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-8 7"/></svg>';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const name = m => m.manufacturer + ' ' + m.model;
const kicker = m => [m.year, m.type].filter(Boolean).join(' ');
const hasPrice = m => m.showPrice && m.price > 0;
export const isLive = m => m.published && m.status !== 'sold';
export const machineUrl = m => SITE + '/inventory/' + encodeURIComponent(m.id);
const absolute = p => (p.startsWith('http') ? p : SITE + p);

function priceHTML(m) {
  return hasPrice(m)
    ? '<span class="price">' + money.format(m.price) + '</span>'
    : '<span class="price call">Call for price</span>';
}
function specsHTML(rows) {
  const items = rows.filter(r => r[0] && r[1]).map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('');
  return items ? '<dl class="specs large">' + items + '</dl>' : '';
}
function placeholder(m) {
  return '<div class="ph" aria-hidden="true">' + PH_ICON + '<span>' + esc(m.category) + '</span></div>';
}
function videoHTML(m) {
  if (!m.video) return '';
  return '<h3 class="vidtitle">See it run</h3>' +
    '<div class="video"><button type="button" class="vidplay" data-video="' + esc(m.video) + '" aria-label="Play video of the ' + esc(name(m)) + '">' +
      '<img src="https://i.ytimg.com/vi/' + esc(m.video) + '/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">' +
      '<span class="playicon" aria-hidden="true"></span>' +
    '</button></div>';
}

/* One line for search results and share previews, about 155 characters */
export function summary(m) {
  const parts = [[m.year, name(m), m.type && m.type.toLowerCase()].filter(Boolean).join(' ') + ' for sale'];
  if (hasPrice(m)) parts.push(money.format(m.price));
  const lead = parts.join(', ') + '.';
  const extra = (m.condition || m.description || '').replace(/\s+/g, ' ').trim();
  const text = lead + ' ' + (extra || 'In our Fairfield, CT warehouse; most machines can be run under power.');
  return text.length > 155 ? text.slice(0, 152).replace(/\s+\S*$/, '') + '…' : text;
}

export function pageTitle(m) {
  return [m.year, name(m), m.type].filter(Boolean).join(' ') + (hasPrice(m) ? ' — ' + money.format(m.price) : '') + ' | Capital Machine Tools';
}

/* The page content, inside <div id="app"> */
export function detailHTML(m) {
  const rows = m.specs.slice();
  if (m.power) rows.push(['Electrical', m.power]);
  const many = m.photos.length > 1;
  const main = m.photos[0]
    ? '<img id="main-img" src="' + esc(m.photos[0]) + '" alt="' + esc(name(m)) + ', photo 1">' +
      '<button type="button" class="expand" aria-label="View photos full screen">' + ICON_EXPAND + '</button>' +
      (many
        ? '<button type="button" class="nav prev" aria-label="Previous photo">' + ICON_PREV + '</button>' +
          '<button type="button" class="nav next" aria-label="Next photo">' + ICON_NEXT + '</button>' +
          '<span class="count" aria-live="polite">1 / ' + m.photos.length + '</span>'
        : '')
    : placeholder(m);
  const thumbs = many
    ? '<div class="thumbs">' + m.photos.map((p, i) =>
        '<button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Show photo ' + (i + 1) + '"><img src="' + esc(p) + '" alt="" loading="lazy"></button>'
      ).join('') + '</div>'
    : '';
  const subject = encodeURIComponent(('Inquiry: ' + kicker(m) + ' ' + name(m)).trim());
  const tag = m.status === 'pending' ? '<span class="tag pending">Pending sale</span>' : '';

  return '<article>' +
    '<a class="back" href="/inventory">&larr; All machines</a>' +
    '<div class="detail-grid">' +
      '<div class="gallery"><div class="main">' + main + '</div>' + thumbs + videoHTML(m) + '</div>' +
      '<div class="info">' +
        '<p class="kicker">' + esc(kicker(m)) + '</p>' +
        '<h1>' + esc(name(m)) + '</h1>' +
        '<div class="pricerow">' + priceHTML(m) + tag + '</div>' +
        specsHTML(rows) +
        (m.condition ? '<h3>Condition and Features</h3><p class="text">' + esc(m.condition) + '</p>' : '') +
        (m.description ? '<h3>More Details</h3><p class="text">' + esc(m.description) + '</p>' : '') +
        '<div class="buttons">' +
          '<a class="btn" href="tel:' + TEL + '">Call ' + PHONE + '</a>' +
          '<a class="btn secondary" href="mailto:' + EMAIL + '?subject=' + subject + '">Email About This Machine</a>' +
        '</div>' +
        '<p class="note">Want to see it run? Call ahead and we will have it under power when you arrive.</p>' +
      '</div>' +
    '</div>' +
  '</article>';
}

/* Google's product format (schema.org), shown as price and stock in results */
export function productData(m) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: [m.year, name(m)].filter(Boolean).join(' '),
    description: summary(m),
    url: machineUrl(m),
    category: m.category,
    brand: { '@type': 'Brand', name: m.manufacturer },
    model: m.model
  };
  if (m.photos.length) data.image = m.photos.map(absolute);
  if (hasPrice(m)) {
    data.offers = {
      '@type': 'Offer',
      url: machineUrl(m),
      price: String(m.price),
      priceCurrency: 'USD',
      itemCondition: 'https://schema.org/UsedCondition',
      availability: m.status === 'pending' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Capital Machine Tools', url: SITE }
    };
  }
  // keep "</script>" in any text from ending the script tag early
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/* Everything that goes into <head> for a live machine */
export function headTags(m) {
  const title = pageTitle(m), desc = summary(m), url = machineUrl(m);
  const image = m.photos[0] ? absolute(m.photos[0]) : SITE + '/cmt-badge.png';
  return [
    '<base href="/">',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta property="og:type" content="product">',
    '<meta property="og:site_name" content="Capital Machine Tools">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:image" content="' + esc(image) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<script type="application/ld+json">' + productData(m) + '</script>'
  ].join('\n');
}

/* For the page script: the machine's details, safe inside a <script> tag */
export function machineJSON(m) {
  return '<script type="application/json" id="machine-data">' + JSON.stringify(m).replace(/</g, '\\u003c') + '</script>';
}

export function soldHTML(m) {
  return '<div class="empty gone">' +
    '<p class="kicker">' + esc(kicker(m)) + '</p>' +
    '<h1>' + esc(name(m)) + ' has been sold</h1>' +
    '<p>This machine is no longer available. We get new machines in regularly. Have a look at what’s in stock, or call Dave at <a href="tel:' + TEL + '">' + PHONE + '</a> and tell him what you’re after.</p>' +
    '<div class="buttons"><a class="btn" href="/inventory">See machines in stock</a></div>' +
  '</div>';
}

export function notFoundHTML() {
  return '<div class="empty gone">' +
    '<h1>We couldn’t find that machine</h1>' +
    '<p>It may have been sold or taken down. Have a look at what’s in stock, or call Dave at <a href="tel:' + TEL + '">' + PHONE + '</a>.</p>' +
    '<div class="buttons"><a class="btn" href="/inventory">See machines in stock</a></div>' +
  '</div>';
}
