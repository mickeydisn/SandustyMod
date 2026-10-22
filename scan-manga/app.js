/* Scan-Manga Navigator — modern app (ES6+) */
const BASE = 'https://www.scan-manga.com';
const LS_H = 'scanmanga_history';
const LS_R = 'scanmanga_read';

// API locale (server.py) : le scraping se fait cote serveur, car
// scan-manga.com bloque le navigateur (CORS + Cloudflare + header Origin
// obligatoire sur le CDN des images).
// -> le mode "serveur local" est OBLIGATOIRE, pas de repli proxy public.
const API = '/api';
const VIEWS = ['catalogue', 'history', 'read', 'manga', 'reader'];

const $ = (id) => document.getElementById(id);

const state = {
  catalog: [],
  chapters: [],
  manga: null,
  chapterIndex: -1
};

function loadLS(k) {
  try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; }
}
function saveLS(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function getH() { return loadLS(LS_H); }
function getR() { return loadLS(LS_R); }
function isRead(id) { return !!getR()[id]; }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function touchH(m, chapter) {
  const h = getH();
  const p = h[m.id] || {};
  h[m.id] = {
    id: m.id,
    title: m.title,
    url: m.url,
    lastChapterId: chapter ? chapter.id : (p.lastChapterId || null),
    lastChapterTitle: chapter ? chapter.title : (p.lastChapterTitle || null),
    openedCount: (p.openedCount || 0) + (chapter ? 0 : 1),
    updatedAt: Date.now()
  };
  saveLS(LS_H, h);
  renderCounts();
  renderHistory();
}
function toggleRead(m, force) {
  const r = getR();
  const w = (typeof force === 'boolean') ? force : !r[m.id];
  if (w) r[m.id] = { id: m.id, title: m.title, url: m.url, markedAt: Date.now() };
  else delete r[m.id];
  saveLS(LS_R, r);
  renderCounts();
  renderCatalogue($('searchInput').value);
  renderRead();
  syncBtns();
  return w;
}
/* Fetch via l'API locale du serveur (server.py).
   Le serveur scrape avec curl_cffi (TLS navigateur) -> Cloudflare passe.
   Le scraping se fait UNIQUEMENT cote serveur : les proxies CORS publics
   ne peuvent pas fournir l'header `Origin` exige par le CDN des pages. */
function fetchSmart(url) {
  return fetch(API + '/manga?url=' + encodeURIComponent(url), { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) return res.json().then((j) => { throw new Error(j.error || ('HTTP ' + res.status)); });
      return res.json();
    })
    .then((data) => {
      if (!data || !data.chapters || !data.chapters.length) throw new Error('Aucun chapitre');
      return { data: data, via: 'local' };
    });
}
/* URL d'une cover : passe par le proxy local (/img/...) qui envoie le
   Referer scan-manga obligatoire (sinon le CDN renvoie 403).
   Le CDN sert les covers sous /img/ : le proxy local ajoute lui-meme
   ce prefixe, on ne le met donc pas deux fois. */
function coverUrl(cover) {
  if (!cover) return '';
  if (cover.startsWith('/')) return cover;
  const m = cover.match(/^https?:\/\/static\.scan-manga\.com\/(.*)$/i);
  if (m) return '/img/' + m[1].replace(/^\/+/, '').replace(/^img\//, '');
  return cover;
}
/* URL d'une page de chapitre : passe par /pageimg (le CDN exige un
   header Origin, impossible a envoyer depuis une balise <img>). */
function pageImgUrl(src, referer) {
  return '/pageimg?u=' + encodeURIComponent(src) +
         '&r=' + encodeURIComponent(referer || BASE + '/');
}
function showView(name) {
  VIEWS.forEach((v) => {
    $('view-' + v).classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  window.scrollTo(0, 0);
}
function normM(id, title) {
  if (id[0] !== '/') id = '/' + id;
  return { id: id, title: (title || id).trim(), url: BASE + id };
}
function setCatalog(list, label) {
  state.catalog = list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  $('status').textContent = list.length + ' mangas (' + label + ')';
  $('proxyNotice').classList.add('hidden');
  renderCatalogue($('searchInput').value);
  renderCounts();
}
function loadCatalog() {
  $('status').textContent = 'Chargement du catalogue…';
  $('catalogueGrid').innerHTML = '<p class="meta">Chargement…</p>';
  // Le serveur renvoie catalogue.json (local) ou, a defaut, le catalogue
  // distant scrape par lui-meme.
  // La promesse est retournee pour permettre l'attente (tests, appelant).
  return fetch(API + '/catalogue', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) return res.json().then((j) => { throw new Error(j.error || ('HTTP ' + res.status)); });
      return res.json();
    })
    .then((data) => {
      const items = data.items || data;
      if (!items || !items.length) throw new Error('Catalogue vide');
      setCatalog(items, data.source === 'distant' ? 'distant' : 'local');
    })
    .catch((err) => {
      console.warn('catalogue indisponible:', err);
      $('status').textContent = 'Échec chargement : ' + esc(err.message);
      $('proxyNotice').classList.remove('hidden');
      $('proxyNotice').textContent = 'Le catalogue ne peut pas être chargé. Vérifiez que le serveur local (server.py) tourne bien sur le port attendu.';
      renderCatalogue($('searchInput').value);
      renderCounts();
    });
}
function cardHTML(m) {
  const read = isRead(m.id);
  const cover = coverUrl(m.cover || '');
  const statusPill = m.status ? '<span class="pill status-pill status-' + esc(m.status).toLowerCase().replace(/\s/g, '-') + '">' + esc(m.status) + '</span>' : '';
  const author = m.auteur ? '<div class="author">' + esc(m.auteur) + '</div>' : '';
  let rating = '';
  if (m.note) {
    rating = '<div class="rating"><span class="star">★</span> <span>' + esc(m.note) + '/5</span>' + (m.nb_votes ? ' <span style="color:var(--muted);font-weight:400">(' + esc(m.nb_votes) + ' votes)</span>' : '') + '</div>';
  }
  const genres = m.genres ? '<span class="pill" style="font-size:10px">' + esc(m.genres) + '</span>' : '';
  const type = m.type ? '<span class="pill" style="font-size:10px">' + esc(m.type) + '</span>' : '';
  const last = m.last_chapter ? '<div class="author" style="font-size:11px">Dernier : ' + esc(m.last_chapter) + '</div>' : '';
  // nb_ch : nombre de chapitres reellement lisibles (scrape local).
  const nbCh = m.nb_ch ? '<span class="pill" style="font-size:10px">' + esc(m.nb_ch) + ' ch.</span>' : '';
  return '<article class="card' + (read ? ' is-read' : '') + '" data-id="' + esc(m.id) + '" data-url="' + esc(m.url) + '" data-title="' + esc(m.title) + '">' +
    '<div class="cover-wrap">' +
    '<img class="card-cover" src="' + esc(cover) + '" alt="Couverture de ' + esc(m.title) + '" loading="lazy" onerror="this.src=\'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><text y=\".9em\" font-size=\"90\">📕</text></svg>') + '\'">' +
    '<div class="cover-fallback">📕</div>' +
    '</div>' +
    '<h3>' + esc(m.title) + '</h3>' +
    '<div class="meta-row">' + statusPill + nbCh + '</div>' +
    author + rating + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + genres + type + '</div>' +
    last +
    '<div class="row">' +
    '<button class="ghost" onclick="appOpenManga(this)">Ouvrir</button>' +
    '<button class="ghost' + (read ? ' done' : '') + '" onclick="appToggleRead(this)">' + (read ? '✔ Lu' : '✅ Lu') + '</button>' +
    '</div>' +
    '</article>';
}

function renderCatalogue(q) {
  const grid = $('catalogueGrid');
  const empty = $('catalogueEmpty');
  const term = (q || '').toLowerCase().trim();
  let list = state.catalog;
  // filtre "chapitres lisibles" (scrape local : nb_ch > 0)
  if ($('onlyReadable') && $('onlyReadable').checked) {
    list = list.filter((m) => m.nb_ch > 0);
  }
  if (term) {
    list = list.filter((m) => m.title.toLowerCase().includes(term) ||
      (m.auteur && m.auteur.toLowerCase().includes(term)) ||
      (m.genres && m.genres.toLowerCase().includes(term)));
  }
  updateReadableInfo();
  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = list.map(cardHTML).join('');
}

/* Nombre de mangas ayant au moins un chapitre lisible. */
function updateReadableInfo() {
  const info = $('readableInfo');
  if (!info) return;
  const n = state.catalog.filter((m) => m.nb_ch > 0).length;
  info.textContent = n + ' / ' + state.catalog.length + ' mangas lisibles';
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function renderCounts() {
  const h = Object.keys(getH()).length;
  const r = Object.keys(getR()).length;
  $('countHistory').textContent = h;
  $('countRead').textContent = r;
}
function renderHistory() {
  const grid = $('historyGrid');
  const h = getH();
  const items = Object.values(h).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (items.length === 0) {
    grid.innerHTML = '<p class="meta">Aucun manga ouvert pour l\'instant.</p>';
    return;
  }
  grid.innerHTML = items.map((m) => {
    const read = isRead(m.id);
    const last = m.lastChapterTitle ? '<div class="author" style="font-size:11px">Dernier : ' + esc(m.lastChapterTitle) + '</div>' : '';
    return '<article class="card' + (read ? ' is-read' : '') + '" data-id="' + esc(m.id) + '" data-url="' + esc(m.url) + '" data-title="' + esc(m.title) + '">' +
      '<div class="cover-wrap"><div class="cover-fallback">🕘</div></div>' +
      '<h3>' + esc(m.title) + '</h3>' +
      '<div class="meta-row"><span class="pill">' + esc(m.openedCount || 1) + ' ouvert' + ((m.openedCount || 1) > 1 ? 's' : '') + '</span></div>' +
      last +
      '<div class="row">' +
      '<button class="ghost" onclick="appOpenManga(this)">Ouvrir</button>' +
      '<button class="ghost' + (read ? ' done' : '') + '" onclick="appToggleRead(this)">' + (read ? '✔ Lu' : '✅ Lu') + '</button>' +
      '</div>' +
      '</article>';
  }).join('');
}
function renderRead() {
  const grid = $('readGrid');
  const r = getR();
  const items = Object.values(r).sort((a, b) => (b.markedAt || 0) - (a.markedAt || 0));
  if (items.length === 0) {
    grid.innerHTML = '<p class="meta">Aucun manga marqué comme lu.</p>';
    return;
  }
  grid.innerHTML = items.map((m) => {
    return '<article class="card is-read" data-id="' + esc(m.id) + '" data-url="' + esc(m.url) + '" data-title="' + esc(m.title) + '">' +
      '<div class="cover-wrap"><div class="cover-fallback">✅</div></div>' +
      '<h3>' + esc(m.title) + '</h3>' +
      '<div class="meta-row"><span class="pill done">Déjà lu</span></div>' +
      '<div class="row">' +
      '<button class="ghost" onclick="appOpenManga(this)">Ouvrir</button>' +
      '<button class="ghost done" onclick="appToggleRead(this)">✔ Lu</button>' +
      '</div>' +
      '</article>';
  }).join('');
}
function appOpenManga(btn) {
  const card = btn.closest('.card');
  const m = { id: card.dataset.id, title: card.dataset.title, url: card.dataset.url };
  openManga(m);
}
function appToggleRead(btn) {
  const card = btn.closest('.card');
  const m = { id: card.dataset.id, title: card.dataset.title, url: card.dataset.url };
  toggleRead(m);
}
function openManga(m) {
  state.manga = m;
  state.chapters = [];
  state.chapterIndex = -1;
  showView('manga');
  $('mangaTitle').textContent = m.title;
  $('mangaLink').href = m.url;
  $('mangaLink').textContent = 'Voir sur scan-manga.com ↗';
  $('mangaCover').src = coverUrl(m.cover || '');
  $('mangaCoverFallback').style.display = m.cover ? 'none' : 'flex';
  $('mangaStatusBadge').textContent = '';
  $('mangaStatusBadge').className = 'pill status-pill';
  $('mangaMetaGrid').innerHTML = '';
  $('mangaDescription').textContent = '';
  $('toggleReadBtn').textContent = isRead(m.id) ? '✅ Déjà lu' : '✅ Marquer comme déjà lu';
  $('countChapters').textContent = '0';
  $('chapterList').innerHTML = '<p class="meta">Chargement des chapitres…</p>';
  touchH(m);
  // les metadonnees completes (cover, auteur, genres...) viennent du
  // catalogue deja charge en memoire ; sinon on les recupere via l'API.
  const found = state.catalog.find((it) =>
    (m.id && it.id === m.id) || (m.url && it.url === m.url) ||
    (m.title && it.title === m.title));
  if (found) renderManga(found);
  else fetchChapters(m);
}
function renderManga(f) {
  state.manga = Object.assign({}, state.manga, f);
  const m = state.manga;
  $('mangaTitle').textContent = m.title;
  $('mangaLink').href = m.url;
  $('mangaCover').src = coverUrl(m.cover || '');
  $('mangaCoverFallback').style.display = m.cover ? 'none' : 'flex';
  const statusLabel = m.status || 'Inconnu';
  $('mangaStatusBadge').textContent = statusLabel;
  $('mangaStatusBadge').className = 'pill status-pill status-' + esc(statusLabel).toLowerCase().replace(/\s/g, '-');
  const meta = [];
  if (m.auteur) meta.push({ label: 'Auteur', value: m.auteur });
  if (m.annee) meta.push({ label: 'Année', value: m.annee });
  if (m.editeur) meta.push({ label: 'Éditeur', value: m.editeur });
  if (m.equipe) meta.push({ label: 'Équipe', value: m.equipe });
  if (m.categorie) meta.push({ label: 'Catégorie', value: m.categorie });
  if (m.type) meta.push({ label: 'Type', value: m.type });
  if (m.note) meta.push({ label: 'Note', value: m.note + '/5', note: true });
  if (m.nb_votes) meta.push({ label: 'Votes', value: m.nb_votes });
  if (m.popularite) meta.push({ label: 'Popularité', value: m.popularite });
  $('mangaMetaGrid').innerHTML = meta.map((it) =>
    '<div class="meta-item"><span class="label">' + esc(it.label) + '</span><span class="value' + (it.note ? ' note' : '') + '">' + esc(it.value) + '</span></div>'
  ).join('');
  if (m.description) {
    $('mangaDescription').textContent = m.description;
  } else {
    $('mangaDescription').textContent = 'Aucune description disponible.';
  }
  $('toggleReadBtn').textContent = isRead(m.id) ? '✅ Déjà lu' : '✅ Marquer comme déjà lu';
  fetchChapters(m);
}
function fetchChapters(m) {
  fetchSmart(m.url).then((res) => {
    const data = res.data || {};
    const chs = data.chapters || parseChapters(res.text || '', m.url);
    // la fiche fraiche du serveur complete le catalogue local
    if (data.cover) state.manga.cover = data.cover;
    if (data.title) state.manga.title = data.title;
    if (data.description) state.manga.description = data.description;
    if (state.manga.cover) {
      $('mangaCover').src = coverUrl(state.manga.cover);
      $('mangaCoverFallback').style.display = 'none';
    }
    state.chapters = chs;
    state.chapterIndex = -1;
    renderChapters();
  }).catch((err) => {
    $('chapterList').innerHTML = '<p class="meta">Chapitres indisponibles (' + esc(err.message) + ').</p>';
  });
}
function parseChapters(html, baseUrl) {
  const chs = [];
  const seen = new Set();
  // Sur le site, la classe "chapitre_nom" est portee par le <div> parent
  // du <a>, pas par le <a> lui-meme.
  const re = /<div[^>]*class=["'][^"']*chapitre_nom[^"']*["'][^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = m[1];
    let title = m[2].replace(/<[^>]+>/g, '').trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    if (href[0] !== '/') href = '/' + href;
    chs.push({ id: href, title: title || 'Chapitre', url: BASE + href });
  }
  if (chs.length === 0) {
    const re2 = /<a[^>]*href=["']([^"']+\/chapitre[^"']*)["'][^>]*>(.*?)<\/a>/gi;
    while ((m = re2.exec(html))) {
      let href = m[1];
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      if (seen.has(href)) continue;
      seen.add(href);
      if (href[0] !== '/') href = '/' + href;
      chs.push({ id: href, title: title || 'Chapitre', url: BASE + href });
    }
  }
  return chs;
}
function renderChapters() {
  const list = $('chapterList');
  const filter = ($('chapterFilter').value || '').toLowerCase();
  const sort = $('sortChapters').value;
  let chs = state.chapters.filter((c) => c.title.toLowerCase().includes(filter));
  chs.sort((a, b) => sort === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
  $('countChapters').textContent = chs.length;
  if (chs.length === 0) {
    list.innerHTML = '<p class="meta">Aucun chapitre.</p>';
    return;
  }
  list.innerHTML = chs.map((c, i) => {
    return '<div class="chapter">' +
      '<span class="n">' + (i + 1) + '</span>' +
      '<a href="' + esc(c.url) + '" onclick="event.preventDefault(); appOpenChapter(' + i + ')">' + esc(c.title) + '</a>' +
      '</div>';
  }).join('');
}
function appOpenChapter(i) {
  openChapter(i);
}
function openChapter(i) {
  if (i < 0 || i >= state.chapters.length) return;
  state.chapterIndex = i;
  const c = state.chapters[i];
  const m = state.manga;
  showView('reader');
  $('readerTitle').textContent = m.title + ' — ' + c.title;
  $('readerHint').textContent = 'Chapitre ' + (i + 1) + ' sur ' + state.chapters.length + ' · ' + esc(c.url);
  // build chapter select
  const sel = $('readerChapterSelect');
  sel.innerHTML = state.chapters.map((cc, j) =>
    '<option value="' + j + '" ' + (j === i ? 'selected' : '') + '>' + esc(cc.title) + '</option>'
  ).join('');
  $('pages').innerHTML = '<p class="meta">Chargement des pages…</p>';
  fetch(API + '/pages?url=' + encodeURIComponent(c.url), { cache: 'no-store' })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) throw new Error(data.error);
      const pages = (data.pages || []).map((p) => ({
        src: p.url,
        w: parseInt(p.width, 10) || 0,
        h: parseInt(p.height, 10) || 0
      }));
      if (!pages.length) throw new Error('Aucune page');
      renderPages(pages, c.url);
    })
    .catch((err) => {
      $('readerHint').textContent = 'Chapitre inaccessible (' + err.message + ').';
      $('pages').innerHTML = '<p><a href="' + esc(c.url) + '" target="_blank" rel="noopener">Ouvrir sur scan-manga.com</a></p>';
    });
}
function renderPages(pages, referer) {
  const box = $('pages');
  box.innerHTML = '';
  if (pages.length === 0) {
    box.innerHTML = '<p class="meta">Aucune page détectée.</p>';
    return;
  }
  pages.forEach((p, i) => {
    const src = (typeof p === 'string') ? p : p.src;
    const proxied = pageImgUrl(src, referer);
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    const img = document.createElement('img');
    img.alt = 'Page ' + (i + 1);
    img.loading = 'lazy';
    // pas de referrerPolicy=no-referrer : c'est le proxy local qui fournit
    // l'Origin/Referer scan-manga exige par le CDN.
    img.addEventListener('error', function () {
      // relance avec un cache-buster : l'image peut avoir echoue
      // temporairement (CDN / cache local).
      img.src = proxied + '&retry=' + Date.now();
    });
    img.addEventListener('click', function () {
      img.src = proxied + '&retry=' + Date.now();
    });
    img.src = proxied;
    const meta = document.createElement('span');
    meta.className = 'pmeta';
    meta.textContent = 'Page ' + (i + 1);
    wrap.appendChild(img);
    wrap.appendChild(meta);
    box.appendChild(wrap);
  });
  window.scrollTo(0, 0);
}
function stepChapter(d) {
  const n = state.chapterIndex + d;
  if (n < 0 || n >= state.chapters.length) {
    alert(d > 0 ? 'Dernier chapitre.' : 'Premier chapitre.');
    return;
  }
  openChapter(n);
}
/* ---------- Event listeners ---------- */
const sT = null;
$('searchInput').addEventListener('input', debounce((e) => {
  showView('catalogue');
  renderCatalogue(e.target.value);
}, 150));
$('searchBtn').addEventListener('click', () => {
  showView('catalogue');
  renderCatalogue($('searchInput').value);
});
$('reloadBtn').addEventListener('click', loadCatalog);
$('clearHistoryBtn').addEventListener('click', () => {
  if (confirm('Vider l\'historique ?')) { saveLS(LS_H, {}); renderHistory(); renderCounts(); }
});
$('clearReadBtn').addEventListener('click', () => {
  if (confirm('Retirer les mangas déjà lus ?')) { saveLS(LS_R, {}); renderRead(); renderCounts(); renderCatalogue($('searchInput').value); }
});
$('manualAddBtn').addEventListener('click', () => {
  const raw = $('manualUrl').value.trim();
  if (!raw) { alert('Colle une URL.'); return; }
  try {
    const u = new URL(raw, BASE);
    const slug = u.pathname.split('/').pop().replace(/\.html?$/i, '').replace(/[_-]+/g, ' ');
    openManga(normM(u.pathname + u.search, slug || u.pathname));
  } catch (e) { alert('URL invalide.'); }
});
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    if (t.dataset.tab === 'history') renderHistory();
    if (t.dataset.tab === 'read') renderRead();
    showView(t.dataset.tab);
  });
});
$('backToCatalogue').addEventListener('click', () => showView('catalogue'));
$('toggleReadBtn').addEventListener('click', () => { if (state.manga) toggleRead(state.manga); });
$('readerReadBtn').addEventListener('click', () => { if (state.manga) toggleRead(state.manga, true); });
$('removeHistoryBtn').addEventListener('click', () => {
  if (!state.manga) return;
  const x = getH();
  delete x[state.manga.id];
  saveLS(LS_H, x);
  renderCounts();
  showView('history');
  renderHistory();
});
$('chapterFilter').addEventListener('input', renderChapters);
$('sortChapters').addEventListener('change', renderChapters);
$('onlyReadable').addEventListener('change', () => renderCatalogue($('searchInput').value));
$('backToManga').addEventListener('click', () => showView('manga'));
$('readerChapterSelect').addEventListener('change', (e) => { openChapter(parseInt(e.target.value, 10)); });
$('prevChapterBtn').addEventListener('click', () => stepChapter(-1));
$('nextChapterBtn').addEventListener('click', () => stepChapter(1));
$('prevChapterBtn2').addEventListener('click', () => stepChapter(-1));
$('nextChapterBtn2').addEventListener('click', () => stepChapter(1));
$('markChapterReadBtn').addEventListener('click', () => {
  if (state.manga) toggleRead(state.manga, true);
  stepChapter(1);
});
$('pageWidth').addEventListener('input', (e) => {
  document.querySelectorAll('#pages img').forEach((im) => { im.style.width = e.target.value + 'px'; });
});
document.addEventListener('DOMContentLoaded', () => {
  renderCounts();
  loadCatalog();
});
