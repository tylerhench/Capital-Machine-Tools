/* GET /inventory/:id — a machine's own page, built from inventory.html.
   Live machines get their full page; sold ones a "has been sold" note;
   hidden or unknown ones a "not found" page. */
import { fromRow, getMachine } from '../_lib/machines.js';
import { esc, isLive, headTags, machineJSON, detailHTML, pageTitle, summary, soldHTML, notFoundHTML } from '../_lib/page.js';

export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || '');
  const row = /^[a-z0-9-]{1,90}$/.test(id) ? await getMachine(env, id) : null;
  const m = row ? fromRow(row) : null;

  const shell = await env.ASSETS.fetch(new URL('/inventory', request.url));
  let status = 200, title, description, head, body;

  if (m && isLive(m)) {
    title = pageTitle(m);
    description = summary(m);
    head = headTags(m);
    body = detailHTML(m) + machineJSON(m);
  } else if (m && m.status === 'sold') {
    status = 410;   // tells search engines it's gone for good
    title = 'Sold: ' + m.manufacturer + ' ' + m.model + ' | Capital Machine Tools';
    head = '<base href="/"><meta name="robots" content="noindex">';
    body = soldHTML(m);
  } else {
    status = 404;
    title = 'Machine not found | Capital Machine Tools';
    head = '<base href="/"><meta name="robots" content="noindex">';
    body = notFoundHTML();
  }

  const page = new HTMLRewriter()
    .on('head', { element(el) { el.prepend(head, { html: true }); } })
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', { element(el) { if (description) el.setAttribute('content', description); } })
    .on('body', { element(el) { el.setAttribute('data-machine-page', ''); } })
    .on('#app', { element(el) { el.setInnerContent(body, { html: true }); } })
    .transform(shell);

  return new Response(page.body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
  });
}
