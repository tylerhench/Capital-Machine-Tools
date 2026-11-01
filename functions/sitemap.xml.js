/* GET /sitemap.xml — every page Google should know about, including
   each machine on the website. Updates itself as Dave adds machines. */
import { fromRow } from './_lib/machines.js';
import { SITE, machineUrl, esc } from './_lib/page.js';

const PAGES = ['/', '/inventory', '/products', '/contact'];

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM machines WHERE published = 1 AND status != 'sold' ORDER BY date_added DESC"
  ).all();
  const urls = PAGES.map(p => '<url><loc>' + SITE + p + '</loc></url>')
    .concat(results.map(r => {
      const m = fromRow(r);
      return '<url><loc>' + esc(machineUrl(m)) + '</loc><lastmod>' + esc(r.updated_at.slice(0, 10)) + '</lastmod></url>';
    }));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
