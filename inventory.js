/* Capital Machine Tools — Inventory
   ------------------------------------------------------------------
   Runs both pages:
     inventory.html      buyers see published machines
     admin/index.html    Dave adds, edits, publishes and marks sold

   Machines are saved through the backend in /functions, which keeps
   them in Cloudflare's database (D1) and photos in Cloudflare R2.

   SAFE TO EDIT: wording, phone/email below, categories and spec names.
   LEAVE ALONE unless you mean to change how saving works: the Store
   section, and the ids/names in admin/index.html this file looks for. */
(function () {
  'use strict';

  var ADMIN = document.body.getAttribute('data-page') === 'admin';
  /* A machine's own page (/inventory/<id>), built by functions/inventory/[id].js */
  var MACHINE_PAGE = document.body.hasAttribute('data-machine-page');

  var PHONE = '203-767-6705';
  var TEL = '+12037676705';
  var EMAIL = 'dave@capitalmachinetools.com';

  var DEFAULT_CATEGORIES = [
    'CNC Machinery', 'Fabricating Machinery', 'Grinders', 'Lathes', 'Milling Machinery',
    'Presses', 'Saws', 'Drills', 'EDM', 'Comparators', 'Hone', 'Misc'
  ];

  /* Spec names that fill in when Dave picks a category */
  var SPEC_TEMPLATES = {
    'CNC Machinery': ['Control', 'Travels', 'Spindle'],
    'Fabricating Machinery': ['Capacity', 'Length', 'Motor'],
    'Grinders': ['Grinder type', 'Table size', 'Chuck'],
    'Lathes': ['Swing', 'Between centers', 'Spindle bore'],
    'Milling Machinery': ['Table size', 'Spindle taper', 'Motor'],
    'Presses': ['Tonnage', 'Stroke', 'Bed size'],
    'Saws': ['Capacity', 'Motor', 'Blade'],
    'Drills': ['Drilling capacity', 'Spindle taper', 'Motor'],
    'EDM': ['Type', 'Travels', 'Max. workpiece'],
    'Comparators': ['Screen size', 'Magnification', 'Stage size'],
    'Hone': ['Bore range', 'Stroke', 'Motor'],
    'Misc': ['Capacity', 'Motor', 'Size']
  };

  /* ================================================================
     Store — talks to the backend in /functions
     ================================================================ */

  function request(method, path, body, type) {
    var opts = { method: method, headers: {}, credentials: 'same-origin', redirect: 'manual' };
    if (body !== undefined) {
      opts.body = type ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = type || 'application/json';
    }
    return fetch(path, opts).then(function (res) {
      // Once Dave's sign-in runs out, Cloudflare answers with a redirect to its sign-in page
      if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
        throw new Error('Your sign-in has run out. Reload the page to sign in again.');
      }
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Something went wrong (error ' + res.status + '). Please try again.');
        return data;
      });
    }, function () {
      throw new Error('Couldn’t reach the website. Check the internet connection and try again.');
    });
  }

  var Store = {
    all: function () { return request('GET', ADMIN ? '/api/admin/machines' : '/api/machines'); },
    save: function (id, data) {
      return id
        ? request('PUT', '/api/admin/machines/' + encodeURIComponent(id), data)
        : request('POST', '/api/admin/machines', data);
    },
    remove: function (id) { return request('DELETE', '/api/admin/machines/' + encodeURIComponent(id)); },
    /* Resolves to { url, small } — small means the photo may look blurry on the site */
    uploadPhoto: function (file) {
      return preparePhoto(file).then(function (p) {
        return request('POST', '/api/admin/photos', p.blob, p.blob.type).then(function (data) {
          return { url: data.url, small: Math.max(p.width, p.height) < SMALL_PHOTO };
        });
      });
    },
    /* For photos uploaded in the form but never saved; '/photos/x.jpg' → '/api/admin/photos/x.jpg' */
    discardPhoto: function (url) { return request('DELETE', '/api/admin' + url).catch(function () {}); }
  };

  var MAX_SIDE = 2400;              // longest side kept on the site, in pixels
  var KEEP_AS_IS_BYTES = 4 * 1024 * 1024;
  var SMALL_PHOTO = 1000;           // warn below this
  var UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /* Photos that are already a sensible size upload untouched, so they
     are never re-compressed. Only big ones (phone photos are 3–5 MB)
     are resized, with high-quality settings. */
  function preparePhoto(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var fits = Math.max(w, h) <= MAX_SIDE && file.size <= KEEP_AS_IS_BYTES;
        if (fits && UPLOAD_TYPES.indexOf(file.type) !== -1) {
          URL.revokeObjectURL(url);
          resolve({ blob: file, width: w, height: h });
          return;
        }
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * scale);
        c.height = Math.round(h * scale);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';          // see-through areas become white, not black
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          blob ? resolve({ blob: blob, width: w, height: h }) : reject(new Error('That photo couldn’t be read.'));
        }, 'image/jpeg', 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file isn’t a photo we can read.')); };
      img.src = url;
    });
  }

  /* ================================================================
     Helpers
     ================================================================ */

  var machines = [];
  var selectedCats = [];
  var selectedMakes = [];
  var expanded = { cat: false, make: false };
  var FILTER_CAP = 8;   // items shown before "See more"
  var query = '';
  var sort = 'newest';
  var showSold = false;

  var app = document.getElementById('app');
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isLive(m) { return m.published && m.status !== 'sold'; }
  function inGrid(m) { return ADMIN ? (showSold || m.status !== 'sold') : isLive(m); }
  function canOpen(m) { return ADMIN || isLive(m); }
  function name(m) { return m.manufacturer + ' ' + m.model; }
  function kicker(m) { return [m.year, m.type].filter(Boolean).join(' '); }
  function hasPrice(m) { return m.showPrice && m.price > 0; }
  /* Accepts youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/… and /embed/… links */
  function youtubeId(link) {
    var m = String(link || '').trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : '';
  }
  function findById(id) { return machines.filter(function (m) { return m.id === id; })[0]; }

  function categories() {
    var list = DEFAULT_CATEGORIES.slice();
    machines.forEach(function (m) {
      if (m.category && list.indexOf(m.category) === -1) list.splice(list.length - 1, 0, m.category);
    });
    return list;
  }

  function priceHTML(m) {
    return hasPrice(m)
      ? '<span class="price">' + money.format(m.price) + '</span>'
      : '<span class="price call">Call for price</span>';
  }
  function tagHTML(m) {
    var t = '';
    if (m.status === 'pending') t = '<span class="tag pending">Pending sale</span>';
    else if (ADMIN && m.status === 'sold') t = '<span class="tag sold">Sold</span>';
    else if (ADMIN && !m.published) t = '<span class="tag hidden">Hidden</span>';
    if (ADMIN && m.ebayItemId) t += '<span class="tag ebay">eBay</span>';
    return t ? '<span class="tags">' + t + '</span>' : '';
  }
  var PH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-8 7"/></svg>';
  function placeholder(m) {
    return '<div class="ph" aria-hidden="true">' + PH_ICON + '<span>' + esc(m.category) + '</span></div>';
  }
  function specsHTML(rows, cls) {
    var items = rows.filter(function (r) { return r[0] && r[1]; })
      .map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    return items ? '<dl class="specs ' + cls + '">' + items + '</dl>' : '';
  }

  function sorted(list) {
    function byDate(a, b) { return b.dateAdded.localeCompare(a.dateAdded); }
    function priced(fn) {
      return function (a, b) {
        var pa = hasPrice(a), pb = hasPrice(b);
        if (pa !== pb) return pa ? -1 : 1;
        return pa ? fn(a, b) : byDate(a, b);
      };
    }
    var cmp = {
      newest: byDate,
      priceLow: priced(function (a, b) { return a.price - b.price; }),
      priceHigh: priced(function (a, b) { return b.price - a.price; }),
      yearNew: function (a, b) { return (b.year || 0) - (a.year || 0); },
      yearOld: function (a, b) { return (a.year || 9999) - (b.year || 9999); }
    }[sort];
    return list.slice().sort(cmp);
  }
  function matches(m) {
    if (!query) return true;
    var hay = [m.year, m.manufacturer, m.model, m.type, m.category].join(' ').toLowerCase();
    return query.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function inCats(m) { return !selectedCats.length || selectedCats.indexOf(m.category) !== -1; }
  function inMakes(m) { return !selectedMakes.length || selectedMakes.indexOf(m.manufacturer) !== -1; }
  function filtering() { return selectedCats.length + selectedMakes.length > 0; }

  /* ================================================================
     Grid
     ================================================================ */

  function renderGrid() {
    var adminTools = ADMIN
      ? '<label class="check"><input type="checkbox" id="showsold"' + (showSold ? ' checked' : '') + '> Show sold</label>' +
        '<button type="button" class="btn" id="add-btn">+ Add a machine</button>'
      : '';
    var intro = ADMIN
      ? '<h2 class="section-title">Your inventory</h2>' +
        '<p class="lead">Add machines, update prices and mark them sold. Changes show on the public Inventory page right away.</p>' +
        '<div class="ebaybox" id="ebaybox"></div>'
      : '<h2 class="section-title">Machines in Stock</h2>' +
        '<p class="lead">Every machine is in our 50,000 sq. ft. warehouse, and most can be run under power for your inspection. Call Dave at <a href="tel:' + TEL + '">' + PHONE + '</a>.</p>';

    app.innerHTML = intro +
      '<div class="tools">' +
        '<div class="grow"><label class="lbl" for="q">Search</label>' +
          '<input id="q" type="search" placeholder="Make, model or type" value="' + esc(query) + '"></div>' +
        '<div><label class="lbl" for="sort">Sort by</label>' +
          '<select id="sort">' +
            '<option value="newest">Newest arrivals</option>' +
            '<option value="priceLow">Price, low to high</option>' +
            '<option value="priceHigh">Price, high to low</option>' +
            '<option value="yearNew">Year, newest first</option>' +
            '<option value="yearOld">Year, oldest first</option>' +
          '</select></div>' +
        adminTools +
      '</div>' +
      '<details class="filters-inline"><summary class="lbl" id="filter-summary">Filter by category or manufacturer</summary>' +
        '<div class="filter-host"></div></details>' +
      '<p class="counts" id="counts"></p>' +
      '<div id="results"></div>';

    $('#sort').value = sort;
    $('#q').addEventListener('input', function (e) { query = e.target.value.trim(); renderResults(); });
    $('#sort').addEventListener('change', function (e) { sort = e.target.value; renderResults(); });
    if (ADMIN) {
      renderEbayBox();
      $('#add-btn').addEventListener('click', function () { openEditor(null); });
      $('#showsold').addEventListener('change', function (e) { showSold = e.target.checked; renderResults(); });
    }
    renderResults();
  }

  /* ================================================================
     Filters: Category and Manufacturer
     Shown in the side panel on wide screens, and in a fold-out
     above the results on laptops, tablets and phones.
     ================================================================ */

  function makes() {
    return machines.map(function (m) { return m.manufacturer; })
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
      .sort(function (a, b) { return a.localeCompare(b); });
  }

  function filterGroups() {
    // Each list's counts take the other list's choices into account
    var base = machines.filter(function (m) { return inGrid(m) && matches(m); });
    var forCats = base.filter(inMakes);
    var forMakes = base.filter(inCats);
    function build(values, selected, field, pool) {
      return values.map(function (v) {
        return { value: v, n: pool.filter(function (m) { return m[field] === v; }).length, on: selected.indexOf(v) !== -1 };
      }).filter(function (o) {
        // Dave sees every category; buyers only see ones with machines listed
        return o.on || (ADMIN && field === 'category') || base.some(function (m) { return m[field] === o.value; });
      });
    }
    return [
      { key: 'cat', title: 'Category', items: build(categories(), selectedCats, 'category', forCats) },
      { key: 'make', title: 'Manufacturer', items: build(makes(), selectedMakes, 'manufacturer', forMakes) }
    ];
  }

  function groupHTML(g, where) {
    var open = expanded[g.key];
    var shown = g.items.filter(function (o, i) { return open || i < FILTER_CAP || o.on; });
    var hiddenCount = g.items.length - shown.length;
    var picked = g.items.filter(function (o) { return o.on; }).length;
    var find = open && g.items.length > 15
      ? '<input type="search" class="ffind" data-group="' + g.key + '" placeholder="Find a ' + g.title.toLowerCase() + '" aria-label="Find a ' + g.title.toLowerCase() + '">'
      : '';
    return '<fieldset class="fgroup' + (open ? ' open' : '') + '" data-group="' + g.key + '">' +
      '<legend class="lbl">' + g.title + '</legend>' + find +
      '<ul class="flist">' + shown.map(function (o) {
        return '<li><label class="fopt' + (o.n ? '' : ' zero') + '">' +
          '<input type="checkbox" data-group="' + g.key + '" value="' + esc(o.value) + '"' + (o.on ? ' checked' : '') + '>' +
          '<span class="nm">' + esc(o.value) + '</span><span class="n">' + o.n + '</span></label></li>';
      }).join('') + '</ul>' +
      '<div class="factions">' +
        (g.items.length > FILTER_CAP
          ? '<button type="button" class="flink" data-more="' + g.key + '" data-where="' + where + '" aria-expanded="' + open + '">' +
              (open ? 'See less' : 'See more (' + hiddenCount + ')') + '</button>'
          : '') +
        (picked ? '<button type="button" class="flink" data-clear="' + g.key + '" data-where="' + where + '">Clear</button>' : '') +
      '</div>' +
    '</fieldset>';
  }

  function renderFilters() {
    var groups = filterGroups();
    $$('.filter-host').forEach(function (host) {
      var where = host.closest('.rail') ? 'rail' : 'inline';
      host.innerHTML = groups.map(function (g) { return groupHTML(g, where); }).join('');
      wireFilters(host, where);
    });
    var n = selectedCats.length + selectedMakes.length;
    var sum = $('#filter-summary');
    if (sum) sum.textContent = n ? 'Filter by category or manufacturer (' + n + ' selected)' : 'Filter by category or manufacturer';
  }

  function wireFilters(host, where) {
    function refocus(sel) {
      var el = $('.' + (where === 'rail' ? 'rail' : 'filters-inline') + ' ' + sel);
      if (el) el.focus();
    }
    function changed() {
      // picking a filter from a machine's page goes back to the list
      if (MACHINE_PAGE) { location.href = '/inventory' + filterQuery(); return; }
      if (location.hash.length > 1) { location.hash = ''; return; }
      renderResults();
    }
    $$('input[type="checkbox"]', host).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var key = cb.dataset.group;
        var list = key === 'cat' ? selectedCats : selectedMakes;
        var next = cb.checked ? list.concat(cb.value) : list.filter(function (v) { return v !== cb.value; });
        if (key === 'cat') selectedCats = next; else selectedMakes = next;
        changed();
        refocus('input[data-group="' + key + '"][value="' + CSS.escape(cb.value) + '"]');
      });
    });
    $$('[data-more]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        expanded[b.dataset.more] = !expanded[b.dataset.more];
        renderFilters();
        refocus('[data-more="' + b.dataset.more + '"]');
      });
    });
    $$('[data-clear]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.clear === 'cat') selectedCats = []; else selectedMakes = [];
        changed();
        refocus('fieldset[data-group="' + b.dataset.clear + '"] input');
      });
    });
    $$('.ffind', host).forEach(function (input) {
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        $$('li', input.parentNode).forEach(function (li) {
          li.hidden = q && li.textContent.toLowerCase().indexOf(q) === -1;
        });
      });
    });
  }

  /* ?cat=Lathes&make=Haas — lets a filter picked elsewhere open the list already filtered */
  function filterQuery() {
    var q = new URLSearchParams();
    selectedCats.forEach(function (c) { q.append('cat', c); });
    selectedMakes.forEach(function (mk) { q.append('make', mk); });
    var s = q.toString();
    return s ? '?' + s : '';
  }
  function readFilterQuery() {
    var q = new URLSearchParams(location.search);
    selectedCats = q.getAll('cat');
    selectedMakes = q.getAll('make');
    if (q.get('q')) query = q.get('q');
  }

  function renderCounts(list) {
    var el = $('#counts');
    if (!ADMIN) {
      el.textContent = list.length + (list.length === 1 ? ' machine' : ' machines') + (filtering() || query ? ' found' : ' in stock');
      return;
    }
    var base = machines.filter(function (m) { return matches(m) && inCats(m) && inMakes(m); });
    var live = base.filter(isLive).length;
    var hidden = base.filter(function (m) { return !isLive(m) && m.status !== 'sold'; }).length;
    var sold = base.filter(function (m) { return m.status === 'sold'; }).length;
    el.textContent = live + ' on the website · ' + hidden + ' hidden · ' + sold + ' sold' + (showSold ? '' : ' (not shown)');
  }

  function renderResults() {
    renderFilters();
    var list = sorted(machines.filter(function (m) { return inGrid(m) && matches(m) && inCats(m) && inMakes(m); }));
    renderCounts(list);
    var results = $('#results');
    if (!list.length) {
      var picked = selectedMakes.concat(selectedCats);
      var where = picked.length ? ' in ' + picked.map(esc).join(', ') : '';
      results.innerHTML = '<div class="empty"><h3>No machines here right now</h3><p>' +
        (query ? 'Nothing matches “' + esc(query) + '”' + where + '.' : 'Nothing listed' + where + ' at the moment.') +
        (ADMIN ? '' : ' Call Dave at ' + PHONE + '. We often have machines that aren’t listed yet.') +
        '</p><div class="buttons"><button type="button" class="btn small secondary" id="clear-btn">Show all machines</button></div></div>';
      $('#clear-btn').addEventListener('click', function () { query = ''; selectedCats = []; selectedMakes = []; renderGrid(); });
      return;
    }
    results.innerHTML = '<ul class="grid">' + list.map(cardHTML).join('') + '</ul>';
    wireAdminButtons(results);
    equalizeCards();
  }

  /* Line up titles, specs and prices across each row of cards */
  function equalizeCards() {
    var cards = $$('#results .card');
    var parts = ['.kicker', 'h3', '.specs'];
    cards.forEach(function (c) { parts.forEach(function (p) { var el = $(p, c); if (el) el.style.minHeight = ''; }); });
    var rows = {};
    cards.forEach(function (c) { (rows[c.offsetTop] = rows[c.offsetTop] || []).push(c); });
    Object.keys(rows).forEach(function (k) {
      parts.forEach(function (p) {
        var els = rows[k].map(function (c) { return $(p, c); }).filter(Boolean);
        if (els.length < 2) return;
        var h = Math.max.apply(null, els.map(function (e) { return e.getBoundingClientRect().height; }));
        els.forEach(function (e) { e.style.minHeight = h + 'px'; });
      });
    });
  }

  function machineLink(m) {
    return (ADMIN ? '#' : '/inventory/') + encodeURIComponent(m.id);
  }

  function cardHTML(m) {
    var img = m.photos[0] ? '<img src="' + esc(m.photos[0]) + '" alt="" loading="lazy">' : placeholder(m);
    var off = ADMIN && !isLive(m) ? ' off' : '';
    return '<li class="card' + off + '">' +
      '<a class="card-link" href="' + machineLink(m) + '">' +
        '<div class="photo">' + img + (m.video ? '<span class="vidbadge">&#9654; Video</span>' : '') + '</div>' +
        '<div class="card-body">' +
          '<p class="kicker">' + esc(kicker(m)) + '</p>' +
          '<h3>' + esc(name(m)) + '</h3>' +
          specsHTML(m.specs.slice(0, 3), '') +
          '<div class="card-foot">' + priceHTML(m) + tagHTML(m) + '</div>' +
        '</div>' +
      '</a>' +
      (ADMIN ? '<div class="adminrow">' + adminButtons(m) + '</div>' : '') +
    '</li>';
  }

  /* ================================================================
     Admin buttons
     ================================================================ */

  function adminButtons(m) {
    var live = isLive(m);
    var label = live ? 'On website' : 'Hidden';
    var hint = live ? 'Click to hide it from the website.' : (m.status === 'sold' ? 'Sold. Click to relist it.' : 'Click to put it on the website.');
    return '<button type="button" class="pub ' + (live ? 'on' : 'off') + '" data-pub="' + esc(m.id) + '" title="' + hint + '" aria-label="' + label + '. ' + hint + '">' + label + '</button>' +
      (m.status === 'sold' ? '' : '<button type="button" class="btn small secondary" data-sold="' + esc(m.id) + '">Mark sold</button>') +
      '<button type="button" class="btn small secondary" data-edit="' + esc(m.id) + '">Edit</button>';
  }

  function wireAdminButtons(root) {
    if (!ADMIN) return;
    $$('[data-sold]', root).forEach(function (b) { b.addEventListener('click', function () { markSold(findById(b.dataset.sold)); }); });
    $$('[data-edit]', root).forEach(function (b) { b.addEventListener('click', function () { openEditor(findById(b.dataset.edit)); }); });
    $$('[data-pub]', root).forEach(function (b) { b.addEventListener('click', function () { togglePublish(findById(b.dataset.pub)); }); });
  }

  function replaceMachine(id, saved) {
    machines = machines.map(function (m) { return m.id === id ? saved : m; });
  }

  function saveMachine(m, changes, msg) {
    return Store.save(m.id, Object.assign({}, m, changes)).then(function (saved) {
      replaceMachine(m.id, saved);
      toast(msg);
      route();
    }, function (err) { toast(err.message, true); });
  }

  function markSold(m) {
    askConfirm('Mark the ' + name(m) + ' as sold? It will come off the website right away.', 'Mark sold').then(function (ok) {
      if (ok) saveMachine(m, { status: 'sold', published: false }, name(m) + ' marked sold');
    });
  }

  function togglePublish(m) {
    var id = m.id;
    var done = function (changes, msg) {
      saveMachine(m, changes, msg).then(function () {
        var again = $('[data-pub="' + CSS.escape(id) + '"]');
        if (again) again.focus();
      });
    };
    if (isLive(m)) { done({ published: false }, name(m) + ' hidden from the website'); return; }
    if (m.status !== 'sold') { done({ published: true }, name(m) + ' is on the website'); return; }
    askConfirm('The ' + name(m) + ' is marked sold. Relist it as available and put it back on the website?', 'Relist').then(function (ok) {
      if (ok) done({ status: 'available', published: true }, name(m) + ' relisted');
    });
  }

  /* ================================================================
     Machine detail
     ================================================================ */

  function renderDetail(m) {
    var rows = m.specs.slice();
    if (m.power) rows.push(['Electrical', m.power]);
    var many = m.photos.length > 1;
    var mainImg = m.photos[0]
      ? '<img id="main-img" src="' + esc(m.photos[0]) + '" alt="' + esc(name(m)) + ', photo 1">' +
        '<button type="button" class="expand" aria-label="View photos full screen">' + ICON_EXPAND + '</button>' +
        (many
          ? '<button type="button" class="nav prev" aria-label="Previous photo">' + ICON_PREV + '</button>' +
            '<button type="button" class="nav next" aria-label="Next photo">' + ICON_NEXT + '</button>' +
            '<span class="count" aria-live="polite">1 / ' + m.photos.length + '</span>'
          : '')
      : placeholder(m);
    var thumbs = m.photos.length > 1
      ? '<div class="thumbs">' + m.photos.map(function (p, i) {
          return '<button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Show photo ' + (i + 1) + '"><img src="' + esc(p) + '" alt=""></button>';
        }).join('') + '</div>'
      : '';
    var subject = encodeURIComponent(('Inquiry: ' + kicker(m) + ' ' + name(m)).trim());

    app.innerHTML =
      '<article>' +
        '<a class="back" href="#">&larr; All machines</a>' +
        '<div class="detail-grid">' +
          '<div class="gallery"><div class="main">' + mainImg + '</div>' + thumbs + videoHTML(m) + '</div>' +
          '<div class="info">' +
            (ADMIN ? '<div class="adminrow">' + adminButtons(m) + '</div>' : '') +
            (ADMIN && (isLive(m) || m.ebayItemId)
              ? '<p class="publink">' +
                  (isLive(m) ? '<a href="/inventory/' + encodeURIComponent(m.id) + '" target="_blank" rel="noopener">View on website &#8599;</a>' : '') +
                  (m.ebayItemId ? '<a href="' + ebayItemUrl(m.ebayItemId) + '" target="_blank" rel="noopener">View on eBay &#8599;</a>' : '') +
                '</p>'
              : '') +
            '<p class="kicker">' + esc(kicker(m)) + '</p>' +
            '<h1>' + esc(name(m)) + '</h1>' +
            '<div class="pricerow">' + priceHTML(m) + tagHTML(m) + '</div>' +
            specsHTML(rows, 'large') +
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

    if (m.photos.length) setupGallery(m);
    wireAdminButtons(app);
  }

  /* ================================================================
     Photo gallery: arrows, swipe, arrow keys, full-screen viewer
     ================================================================ */

  var ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

  var gallery = null;   // the photo set on the open machine page, if any

  function setupGallery(m) {
    var photos = m.photos, title = name(m), at = 0;
    var main = $('.gallery .main', app);

    function show(i) {
      at = (i + photos.length) % photos.length;
      var img = $('#main-img');
      img.src = photos[at];
      img.alt = title + ', photo ' + (at + 1);
      var count = $('.count', main);
      if (count) count.textContent = (at + 1) + ' / ' + photos.length;
      $$('.thumbs button', app).forEach(function (t) { t.setAttribute('aria-pressed', String(Number(t.dataset.i) === at)); });
      preload(photos, at);
    }

    gallery = { photos: photos, title: title, show: show, at: function () { return at; } };

    $$('.thumbs button', app).forEach(function (b) {
      b.addEventListener('click', function () { show(Number(b.dataset.i)); });
    });
    var prev = $('.nav.prev', main), next = $('.nav.next', main);
    if (prev) prev.addEventListener('click', function () { show(at - 1); });
    if (next) next.addEventListener('click', function () { show(at + 1); });
    $('#main-img').addEventListener('click', function () { openViewer(at); });
    $('.expand', main).addEventListener('click', function () { openViewer(at); });
    onSwipe(main, function (dir) { show(at + dir); });
    preload(photos, 0);
  }

  function preload(photos, at) {
    if (photos.length < 2) return;
    [at + 1, at - 1].forEach(function (i) { new Image().src = photos[(i + photos.length) % photos.length]; });
  }

  /* Calls back with +1 (swiped left, next) or -1 (swiped right, previous) */
  function onSwipe(el, cb) {
    var x0 = null, y0 = 0;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) cb(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* Full-screen viewer, built once and reused */
  var viewer = null;
  function openViewer(i) {
    if (!gallery) return;
    if (!viewer) {
      viewer = document.createElement('dialog');
      viewer.id = 'viewer';
      viewer.setAttribute('aria-label', 'Photo viewer');
      viewer.innerHTML =
        '<img alt="">' +
        '<button type="button" class="vclose" aria-label="Close">' + ICON_CLOSE + '</button>' +
        '<button type="button" class="nav prev" aria-label="Previous photo">' + ICON_PREV + '</button>' +
        '<button type="button" class="nav next" aria-label="Next photo">' + ICON_NEXT + '</button>' +
        '<span class="count" aria-live="polite"></span>';
      document.body.appendChild(viewer);
      $('.vclose', viewer).addEventListener('click', function () { viewer.close(); });
      $('.prev', viewer).addEventListener('click', function () { viewerShow(viewer.at - 1); });
      $('.next', viewer).addEventListener('click', function () { viewerShow(viewer.at + 1); });
      // a click on the dark background (not the photo or a button) closes it
      viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close(); });
      onSwipe(viewer, function (dir) { viewerShow(viewer.at + dir); });
      // keep the page's photo in step with where the viewer ended up
      viewer.addEventListener('close', function () { if (gallery) gallery.show(viewer.at); });
    }
    viewer.classList.toggle('single', gallery.photos.length < 2);
    viewerShow(i);
    viewer.showModal();
    $('.vclose', viewer).focus();
  }
  function viewerShow(i) {
    var photos = gallery.photos;
    viewer.at = (i + photos.length) % photos.length;
    var img = $('img', viewer);
    img.src = photos[viewer.at];
    img.alt = gallery.title + ', photo ' + (viewer.at + 1);
    $('.count', viewer).textContent = photos.length > 1 ? (viewer.at + 1) + ' / ' + photos.length : '';
    preload(photos, viewer.at);
  }

  /* Left/right arrow keys: in the viewer, or on a machine page */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var dir = e.key === 'ArrowLeft' ? -1 : 1;
    if (viewer && viewer.open) { e.preventDefault(); viewerShow(viewer.at + dir); return; }
    if (!gallery || !$('#main-img') || gallery.photos.length < 2) return;
    if (document.querySelector('dialog[open]')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault();
    gallery.show(gallery.at() + dir);
  });

  /* Shows YouTube's preview image first; the player loads on click */
  function videoHTML(m) {
    if (!m.video) return '';
    return '<h3 class="vidtitle">See it run</h3>' +
      '<div class="video"><button type="button" class="vidplay" data-video="' + esc(m.video) + '" aria-label="Play video of the ' + esc(name(m)) + '">' +
        '<img src="https://i.ytimg.com/vi/' + esc(m.video) + '/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">' +
        '<span class="playicon" aria-hidden="true"></span>' +
      '</button></div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.vidplay');
    if (!b) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.dataset.video) + '?autoplay=1&rel=0&modestbranding=1';
    f.title = b.getAttribute('aria-label').replace('Play video', 'Video');
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    b.parentNode.replaceChild(f, b);
  });

  /* ================================================================
     Routing: inventory.html#machine-id opens that machine
     ================================================================ */

  var baseTitle = document.title;
  var lastRoute = null;
  function route() {
    var id = decodeURIComponent(location.hash.slice(1));
    var m = id && findById(id);
    if (m && canOpen(m)) {
      renderDetail(m);
      renderFilters();
      document.title = name(m) + ' — Capital Machine Tools';
      if (lastRoute !== id) window.scrollTo(0, 0);
      lastRoute = id;
    } else {
      document.title = baseTitle;
      gallery = null;
      var cameBack = lastRoute;
      renderGrid();
      lastRoute = '';
      if (cameBack) {
        var link = $('.card-link[href="#' + CSS.escape(encodeURIComponent(cameBack)) + '"]');
        if (link) link.scrollIntoView({ block: 'center' });
      }
    }
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', function () { if ($('#results')) equalizeCards(); });

  /* ================================================================
     Editor (admin only)
     ================================================================ */

  var dlg = document.getElementById('editor');
  var form = document.getElementById('editor-form');
  var editing = null;
  var draftPhotos = [];
  var newUploads = [];   // photos uploaded since the form opened, not saved yet
  var uploading = 0;
  var saved = false;
  var lastTemplate = [];

  if (ADMIN) setupEditor();

  function setupEditor() {
    var newcatWrap = $('#newcat-wrap');
    var newcatInput = $('#f-newcat');
    var pubYes = $('input[name="published"][value="yes"]', form);
    var pubHelp = $('#pub-help');

    newcatInput.addEventListener('input', function () { newcatInput.setCustomValidity(''); });
    form.video.addEventListener('input', function () { form.video.setCustomValidity(''); });

    form.category.addEventListener('change', function () {
      newcatWrap.hidden = form.category.value !== '__new__';
      if (!newcatWrap.hidden) newcatInput.focus();
      var tpl = SPEC_TEMPLATES[form.category.value] || [];
      [0, 1, 2].forEach(function (i) {
        var input = form['specLabel' + i];
        if (!input.value || input.value === lastTemplate[i]) input.value = tpl[i] || '';
      });
      lastTemplate = tpl;
    });

    form.status.addEventListener('change', syncSoldLock);
    function syncSoldLock() {
      var sold = form.status.value === 'sold';
      pubYes.disabled = sold;
      if (sold) setPublished(false);
      pubHelp.textContent = sold
        ? 'Sold machines come off the website automatically.'
        : 'Hidden machines stay in your list but don’t show on the website.';
    }
    setupEditor.syncSoldLock = syncSoldLock;

    $('#photo-input').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      e.target.value = '';
      if (!files.length) return;
      var label = $('#photo-status');
      var failed = 0, small = 0;
      uploading += files.length;
      syncSaveButton();
      label.textContent = 'Uploading ' + files.length + (files.length === 1 ? ' photo…' : ' photos…');
      // one at a time keeps the order Dave picked and is kinder to a phone connection
      files.reduce(function (chain, f) {
        return chain.then(function () {
          return Store.uploadPhoto(f).then(function (r) {
            if (!dlg.open) { Store.discardPhoto(r.url); return; }
            if (r.small) small++;
            draftPhotos.push(r.url);
            newUploads.push(r.url);
            renderPhotoGrid();
          }, function () { failed++; }).then(function () { uploading--; syncSaveButton(); });
        });
      }, Promise.resolve()).then(function () {
        var notes = [];
        if (failed) notes.push(failed + (failed === 1 ? ' photo' : ' photos') + ' didn’t upload. Try adding ' + (failed === 1 ? 'it' : 'them') + ' again.');
        if (small) notes.push((small === 1 ? 'One photo is' : small + ' photos are') + ' small and may look blurry. For sharper results, use the original from your phone or camera.');
        label.textContent = notes.join(' ');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var cat = form.category.value;
      if (cat === '__new__') {
        var typed = newcatInput.value.trim();
        if (!typed) { newcatInput.setCustomValidity('Type a name for the new category.'); newcatInput.reportValidity(); return; }
        cat = categories().filter(function (c) { return c.toLowerCase() === typed.toLowerCase(); })[0] || typed;
      }
      var videoLink = form.video.value.trim();
      if (videoLink && !youtubeId(videoLink)) {
        form.video.setCustomValidity('That doesn’t look like a YouTube link. Copy it from YouTube’s Share button.');
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var typedMake = form.manufacturer.value.trim();
      var make = machines.map(function (m) { return m.manufacturer; })
        .filter(function (mk) { return mk.toLowerCase() === typedMake.toLowerCase(); })[0] || typedMake;
      var specs = [0, 1, 2]
        .map(function (i) { return [form['specLabel' + i].value.trim(), form['specValue' + i].value.trim()]; })
        .filter(function (r) { return r[0] && r[1]; });
      var status = form.status.value;
      var data = {
        published: status !== 'sold' && $('input[name="published"]:checked', form).value === 'yes',
        status: status,
        category: cat,
        year: form.year.value ? Number(form.year.value) : '',
        manufacturer: make,
        model: form.model.value.trim(),
        type: form.type.value.trim(),
        price: form.price.value ? Number(form.price.value) : 0,
        showPrice: form.showPrice.checked,
        specs: specs,
        power: form.power.value.trim(),
        condition: form.condition.value.trim(),
        description: form.description.value.trim(),
        photos: draftPhotos.slice(),
        video: youtubeId(videoLink)
      };

      var btn = $('#save-btn');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      Store.save(editing && editing.id, data).then(function (result) {
        if (editing) replaceMachine(editing.id, result);
        else machines.push(result);
        // photos uploaded and then removed before saving aren't needed
        newUploads.filter(function (u) { return result.photos.indexOf(u) === -1; }).forEach(Store.discardPhoto);
        newUploads = [];
        saved = true;
        dlg.close();
        toast(isLive(result) ? 'Saved. It’s on the website.' : (result.status === 'sold' ? 'Saved as sold.' : 'Saved. Hidden from the website.'));
        if (location.hash.length > 1 && location.hash.slice(1) !== result.id) location.hash = result.id;
        else route();
      }, function (err) {
        toast(err.message, true);
      }).then(function () {
        btn.disabled = false;
        syncSaveButton();
      });
    });

    // Closing without saving (Cancel or Esc) throws away photos uploaded in this visit
    dlg.addEventListener('close', function () {
      if (!saved) newUploads.forEach(Store.discardPhoto);
      newUploads = [];
    });

    $('#cancel-btn').addEventListener('click', function () { dlg.close(); });

    $('#delete-btn').addEventListener('click', function () {
      if (!editing) return;
      var gone = editing;
      askConfirm('Delete the ' + name(gone) + ' for good? To keep a record, mark it sold instead.', 'Delete').then(function (ok) {
        if (!ok) return;
        Store.remove(gone.id).then(function () {
          machines = machines.filter(function (m) { return m.id !== gone.id; });
          dlg.close();
          if (location.hash.length > 1) history.replaceState(null, '', location.pathname);
          toast('Machine deleted');
          route();
        }, function (err) { toast(err.message, true); });
      });
    });
  }

  function syncSaveButton() {
    var btn = $('#save-btn');
    if (btn.textContent === 'Saving…') return;
    btn.disabled = uploading > 0;
    btn.textContent = uploading ? 'Uploading photos…' : (editing ? 'Save changes' : 'Save machine');
  }

  function setPublished(on) {
    $('input[name="published"][value="' + (on ? 'yes' : 'no') + '"]', form).checked = true;
  }

  function buildSpecRows(specs) {
    $('#specrows').innerHTML = [0, 1, 2].map(function (i) {
      var s = specs[i] || [];
      return '<div class="specrow">' +
        '<input aria-label="Spec ' + (i + 1) + ' name" name="specLabel' + i + '" placeholder="Spec name" value="' + esc(s[0] || '') + '">' +
        '<input aria-label="Spec ' + (i + 1) + ' value" name="specValue' + i + '" placeholder="Value" value="' + esc(s[1] || '') + '">' +
      '</div>';
    }).join('');
  }

  function renderPhotoGrid() {
    var grid = $('#photogrid');
    grid.innerHTML = draftPhotos.map(function (p, i) {
      return '<figure><img src="' + esc(p) + '" alt="Photo ' + (i + 1) + '">' +
        '<div class="ctl">' +
          (i ? '<button type="button" data-first="' + i + '" aria-label="Make photo ' + (i + 1) + ' the main photo">Main</button>' : '') +
          '<button type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">&times;</button>' +
        '</div>' +
        (i ? '' : '<span class="cover">Main photo</span>') +
      '</figure>';
    }).join('');
    $$('[data-rm]', grid).forEach(function (b) {
      b.addEventListener('click', function () { draftPhotos.splice(Number(b.dataset.rm), 1); renderPhotoGrid(); });
    });
    $$('[data-first]', grid).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = draftPhotos.splice(Number(b.dataset.first), 1)[0];
        draftPhotos.unshift(p);
        renderPhotoGrid();
      });
    });
  }

  function openEditor(m) {
    editing = m;
    saved = false;
    newUploads = [];
    form.reset();
    $('#makes').innerHTML = machines.map(function (x) { return x.manufacturer; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort()
      .map(function (mk) { return '<option value="' + esc(mk) + '">'; }).join('');
    form.category.innerHTML = '<option value="">Choose a category</option>' +
      categories().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
      '<option value="__new__">+ Add a new category…</option>';
    $('#newcat-wrap').hidden = true;
    $('#f-newcat').value = '';
    $('#photo-status').textContent = '';
    $('#dlg-title').textContent = m ? 'Edit ' + name(m) : 'Add a machine';
    $('#save-btn').disabled = false;
    $('#save-btn').textContent = m ? 'Save changes' : 'Save machine';
    $('#delete-btn').style.visibility = m ? 'visible' : 'hidden';

    var d = m || { published: true, status: 'available', category: '', year: '', manufacturer: '', model: '', type: '',
      price: '', showPrice: false, specs: [], power: '', condition: '', description: '', photos: [], video: '' };
    setPublished(m ? isLive(m) : true);
    form.status.value = d.status;
    form.category.value = d.category;
    form.year.value = d.year || '';
    form.manufacturer.value = d.manufacturer;
    form.model.value = d.model;
    form.type.value = d.type;
    form.price.value = d.price || '';
    form.showPrice.checked = d.showPrice;
    form.power.value = d.power;
    form.condition.value = d.condition;
    form.description.value = d.description;
    form.video.value = d.video ? 'https://youtu.be/' + d.video : '';
    form.video.setCustomValidity('');
    buildSpecRows(d.specs);
    lastTemplate = SPEC_TEMPLATES[d.category] || [];
    draftPhotos = d.photos.slice();
    renderPhotoGrid();
    setupEditor.syncSoldLock();
    dlg.showModal();
    $('.dlg-body', dlg).scrollTop = 0;
  }

  /* ================================================================
     eBay (admin only): connect, import
     ================================================================ */

  var ebay = null;          // connection status from /api/admin/ebay/status
  var ebayNote = '';        // last import result, shown in the box
  var importing = false;

  function ebayItemUrl(id) {
    return (ebay && ebay.sandbox ? 'https://www.sandbox.ebay.com/itm/' : 'https://www.ebay.com/itm/') + encodeURIComponent(id);
  }

  function loadEbayStatus() {
    return request('GET', '/api/admin/ebay/status').then(function (st) { ebay = st; renderEbayBox(); }, function () {});
  }

  function renderEbayBox() {
    var box = document.getElementById('ebaybox');
    if (!box || !ebay) return;
    var practice = ebay.sandbox ? ' <span class="tag hidden">eBay practice system</span>' : '';
    var html;
    if (ebay.setupError) {
      html = '<p><strong>eBay:</strong> ' + esc(ebay.setupError) + '</p>';
    } else if (!ebay.configured) {
      box.hidden = true;     // nothing to show until eBay is set up on the website
      return;
    } else if (!ebay.connected) {
      html = '<p><strong>eBay:</strong> not connected.' + practice + ' Connect your eBay seller account to import and list machines from here.</p>' +
        '<div class="ebayactions"><a class="btn small" href="/api/admin/ebay/connect">Connect eBay account</a></div>';
    } else {
      var until = ebay.expires ? new Date(ebay.expires).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
      html = '<p><strong>eBay:</strong> connected' + (ebay.user ? ' as <strong>' + esc(ebay.user) + '</strong>' : '') + '.' + practice +
          (until ? ' <span class="muted">eBay asks you to reconnect by ' + esc(until) + '.</span>' : '') + '</p>' +
        '<div class="ebayactions">' +
          '<button type="button" class="btn small" id="ebay-import"' + (importing ? ' disabled' : '') + '>' + (importing ? 'Importing…' : 'Import eBay listings') + '</button>' +
          (unpublishedImports() && !importing
            ? '<button type="button" class="btn small secondary" id="ebay-clear">Remove unpublished imports (' + unpublishedImports() + ')</button>'
            : '') +
          '<button type="button" class="btn small secondary" id="ebay-disconnect"' + (importing ? ' disabled' : '') + '>Disconnect</button>' +
        '</div>';
    }
    box.hidden = false;
    box.innerHTML = html + (ebayNote ? '<div class="ebaynote" role="status">' + ebayNote + '</div>' : '');
    var clr = document.getElementById('ebay-clear');
    if (clr) clr.addEventListener('click', function () {
      var n = unpublishedImports();
      askConfirm('Remove the ' + n + (n === 1 ? ' machine' : ' machines') + ' imported from eBay that aren’t on the website yet? ' +
        'Their eBay listings aren’t touched, and you can import them again afterwards.', 'Remove').then(function (ok) {
        if (!ok) return;
        request('POST', '/api/admin/ebay/clear-imports').then(function (r) {
          return Store.all().then(function (list) {
            machines = list; ebayNote = ''; route();
            toast('Removed ' + r.removed + (r.removed === 1 ? ' machine' : ' machines'));
          });
        }, function (err) { toast(err.message, true); });
      });
    });
    var imp = document.getElementById('ebay-import');
    if (imp) imp.addEventListener('click', importFromEbay);
    var dis = document.getElementById('ebay-disconnect');
    if (dis) dis.addEventListener('click', function () {
      askConfirm('Disconnect eBay? Your eBay listings stay as they are; the website just stops managing them until you connect again.', 'Disconnect').then(function (ok) {
        if (!ok) return;
        request('POST', '/api/admin/ebay/disconnect').then(function () { ebayNote = ''; toast('eBay disconnected'); loadEbayStatus(); },
          function (err) { toast(err.message, true); });
      });
    });
  }

  function setEbayNote(html) { ebayNote = html; renderEbayBox(); }

  /* Machines brought in from eBay that haven't been put on the website yet */
  function unpublishedImports() {
    return machines.filter(function (m) { return m.ebayItemId && !m.published && m.status !== 'sold'; }).length;
  }

  function importFromEbay() {
    importing = true;
    setEbayNote('Checking your eBay listings…');
    request('GET', '/api/admin/ebay/active').then(function (listings) {
      var todo = listings.filter(function (l) { return !l.machineId; });
      var already = listings.length - todo.length;
      if (!todo.length) {
        importing = false;
        setEbayNote(listings.length ? 'All ' + listings.length + ' eBay listings are already on the website.' : 'No live listings found on eBay.');
        return;
      }
      var msg = 'Found ' + listings.length + ' live ' + (listings.length === 1 ? 'listing' : 'listings') + ' on eBay' +
        (already ? ' (' + already + ' already on the website)' : '') + '. Import ' + (todo.length === 1 ? 'it' : 'the ' + todo.length) +
        ' as hidden machines for you to review?';
      return askConfirm(msg, 'Import').then(function (ok) {
        if (!ok) { importing = false; setEbayNote(''); return; }
        var done = 0, failed = [], fewerPhotos = [];
        return todo.reduce(function (chain, l, i) {
          return chain.then(function () {
            var label = 'Importing ' + (i + 1) + ' of ' + todo.length + ': ' + esc(l.title);
            setEbayNote(label + '…');
            return request('POST', '/api/admin/ebay/import/' + encodeURIComponent(l.itemId)).then(function (r) {
              if (!r.imported) return;
              done++;
              return copyPhotos(r.machine.id, r.pictures || [], label).then(function (copied) {
                var wanted = (r.pictures || []).length;
                if (copied < wanted) fewerPhotos.push('<li>' + esc(l.title) + ': ' + copied + ' of ' + wanted + ' photos</li>');
              });
            }, function (err) { failed.push('<li>' + esc(l.title) + ': ' + esc(err.message) + '</li>'); });
          });
        }, Promise.resolve()).then(function () {
          importing = false;
          var note = 'Imported ' + done + (done === 1 ? ' machine' : ' machines') + ' as <strong>hidden</strong>. Check each one, then press “Hidden” to put it on the website.' +
            (fewerPhotos.length ? '<br>' + fewerPhotos.length + (fewerPhotos.length === 1 ? ' machine is' : ' machines are') + ' missing some photos; compare with eBay:<ul>' + fewerPhotos.join('') + '</ul>' : '') +
            (failed.length ? '<br>' + failed.length + ' couldn’t be imported:<ul>' + failed.join('') + '</ul>' : '');
          return Store.all().then(function (list) { machines = list; route(); setEbayNote(note); });
        });
      });
    }, function (err) {
      importing = false;
      setEbayNote(esc(err.message));
    });
  }

  /* Copies a listing's eBay photos one at a time; resolves to how many arrived */
  function copyPhotos(machineId, pictures, label) {
    var copied = 0;
    return pictures.reduce(function (chain, url, n) {
      return chain.then(function () {
        setEbayNote(label + ' (photo ' + (n + 1) + ' of ' + pictures.length + ')…');
        return request('POST', '/api/admin/ebay/photo/' + encodeURIComponent(machineId), { url: url })
          .then(function (r) { if (r.added) copied++; }, function () { /* counted as missing */ });
      });
    }, Promise.resolve()).then(function () { return copied; });
  }

  /* After coming back from eBay's approval page */
  function ebayReturnMessage() {
    var q = new URLSearchParams(location.search).get('ebay');
    if (!q) return;
    history.replaceState(null, '', location.pathname + location.hash);
    var msgs = {
      connected: ['eBay connected.', false],
      declined: ['eBay connection was cancelled.', true],
      expired: ['That eBay approval took too long. Please try again.', true]
    };
    var m = msgs[q] || ['eBay connection didn’t work: ' + q.replace(/^failed: /, ''), true];
    toast(m[0], m[1]);
  }

  /* ================================================================
     Confirm box and toast
     ================================================================ */

  function askConfirm(message, okLabel) {
    var box = document.getElementById('confirm-dlg');
    $('#confirm-msg').textContent = message;
    $('#confirm-ok').textContent = okLabel;
    box.returnValue = '';
    box.showModal();
    return new Promise(function (resolve) {
      box.addEventListener('close', function () { resolve(box.returnValue === 'ok'); }, { once: true });
    });
  }

  var toastTimer;
  function toast(msg, isError) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, isError ? 6000 : 2800);
  }

  /* ---------- Start ---------- */

  /* A machine's own page arrives already filled in; just add the photo
     controls and the filter list. */
  if (MACHINE_PAGE) {
    var dataEl = document.getElementById('machine-data');
    if (dataEl) {
      try {
        var current = JSON.parse(dataEl.textContent);
        if (current.photos.length) setupGallery(current);
      } catch (e) { /* the page still reads fine without the photo controls */ }
    }
    Store.all().then(function (list) { machines = list; renderFilters(); }, function () {});
    return;
  }

  /* Old links like inventory.html#2008-haas-vf-2 go to the machine's own page */
  if (!ADMIN && /^#[a-z0-9-]+$/.test(location.hash)) {
    location.replace('/inventory/' + location.hash.slice(1));
    return;
  }
  if (!ADMIN) readFilterQuery();
  if (ADMIN) { ebayReturnMessage(); loadEbayStatus(); }

  app.innerHTML = '<p class="counts">Loading machines…</p>';
  Store.all().then(function (list) {
    machines = list;
    route();
  }, function (err) {
    app.innerHTML = ADMIN
      ? '<div class="empty"><h3>Couldn’t load the inventory</h3><p>' + esc(err.message) + '</p></div>'
      : '<div class="empty"><h3>Inventory is unavailable right now</h3><p>Please try again shortly, or call Dave at <a href="tel:' + TEL + '">' + PHONE + '</a>.</p></div>';
  });
})();
