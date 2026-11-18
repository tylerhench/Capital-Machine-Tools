/* Capital Machine Tools — small extras for the public pages
   ------------------------------------------------------------------
   1. The phone menu button (every public page).
   2. Reads the same public list the Inventory page uses (/api/machines)
      and never changes anything:

     Home page      shows the three newest machines under "Recently Added"
     Products page  makes a category tile open the Inventory already
                    filtered, when that category has machines in stock

   If the list can't be loaded, both pages still work: the Recently
   Added section stays hidden and the tiles open the full Inventory. */
/* Phone menu: on narrow screens the four menu links fold behind a
   "Menu" button. Without this script the links simply stay visible. */
(function () {
  'use strict';
  var nav = document.querySelector('.nav');
  var btn = nav && nav.querySelector('.nav-toggle');
  if (!btn) return;
  var label = btn.querySelector('.nav-toggle-label');
  nav.classList.add('has-toggle');
  function setOpen(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close' : 'Menu';
  }
  btn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); btn.focus(); }
  });
})();

(function () {
  'use strict';

  var recent = document.getElementById('recent');
  var tiles = Array.prototype.slice.call(document.querySelectorAll('a[data-cat]'));
  if (!recent && !tiles.length) return;

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function name(m) { return m.manufacturer + ' ' + m.model; }
  function kicker(m) { return [m.year, m.type].filter(Boolean).join(' '); }
  function price(m) { return m.showPrice && m.price > 0 ? money.format(m.price) : 'Call for price'; }

  function cardHTML(m) {
    var photo = m.photos && m.photos[0]
      ? '<img src="' + esc(m.photos[0]) + '" alt="" loading="lazy">'
      : '<div class="rph" aria-hidden="true">' + esc(m.category) + '</div>';
    return '<li><a class="rcard" href="/inventory/' + encodeURIComponent(m.id) + '">' +
      '<div class="rphoto">' + photo + '</div>' +
      '<div class="rbody">' +
        '<p class="rkicker">' + esc(kicker(m)) + '</p>' +
        '<h3>' + esc(name(m)) + '</h3>' +
        '<p class="rprice">' + esc(price(m)) + '</p>' +
      '</div></a></li>';
  }

  function showRecent(list) {
    var host = document.getElementById('recent-list');
    if (!recent || !host || !list.length) return;
    // the list arrives newest first
    host.innerHTML = list.slice(0, 3).map(cardHTML).join('');
    recent.hidden = false;
  }

  function linkTiles(list) {
    tiles.forEach(function (a) {
      var cat = a.getAttribute('data-cat');
      var inStock = list.some(function (m) { return m.category === cat; });
      if (inStock) a.setAttribute('href', a.getAttribute('href').split('?')[0] + '?cat=' + encodeURIComponent(cat));
    });
  }

  fetch('/api/machines', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (list) {
      if (!Array.isArray(list)) return;
      showRecent(list);
      linkTiles(list);
    })
    .catch(function () { /* the pages work without it */ });
})();
