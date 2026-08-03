/*
 * Client-side filter and search for /blog/.
 *
 * Progressive enhancement, deliberately. Without JavaScript the app chips are
 * ordinary links to /blog/points/ and /blog/coupon/, the search box and the
 * section chips stay hidden, and the paginated list works as it always has.
 * With JavaScript, all of it filters in place — one click instead of two.
 *
 * The post data comes from /blog/articles.json rather than the DOM, because
 * /blog/ paginates at 10 and search has to reach the posts that are not on
 * screen. It is fetched on first interaction, so a reader who only scrolls the
 * list never pays for it.
 *
 * The card markup below mirrors the <li> in blog/index.html. Two copies of one
 * design is a real cost; the alternative was rendering all posts server-side
 * and dropping pagination, which would 404 the /blog/page2/ URLs already
 * published. Change one, change the other.
 */
(function () {
  'use strict';

  var search = document.getElementById('blog-search');
  var results = document.getElementById('blog-results');
  var staticList = document.getElementById('blog-static');
  var status = document.getElementById('blog-status');
  var clearBtn = document.getElementById('blog-clear');
  var sectionWrap = document.getElementById('blog-section-chips');
  if (!search || !results || !staticList || !status) return;

  var appChips = Array.prototype.slice.call(document.querySelectorAll('[data-app]'));
  var sectionChips = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));

  var state = { q: '', app: '', section: '' };
  var posts = null;
  var loading = null;
  var composing = false;

  /* ---- data ---- */

  function load() {
    if (posts) return Promise.resolve(posts);
    if (loading) return loading;
    loading = fetch('/blog/articles.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        posts = data;
        return posts;
      })
      .catch(function () {
        // Leave the static list in place and say so, rather than showing an
        // empty result set that reads as "no articles match".
        posts = null;
        loading = null;
        status.textContent = '記事の読み込みに失敗しました。ページを再読み込みしてください。';
        status.hidden = false;
        throw new Error('load failed');
      });
    return loading;
  }

  /* ---- filtering ---- */

  function haystack(p) {
    var tags = p.tags.map(function (t) { return t.name; }).join(' ');
    return (p.title + ' ' + p.description + ' ' + p.sectionLabel + ' ' + tags + ' ' + p.app).toLowerCase();
  }

  function matches(p) {
    if (state.app && p.app !== state.app) return false;
    if (state.section && p.section !== state.section) return false;
    if (state.q && haystack(p).indexOf(state.q.toLowerCase()) === -1) return false;
    return true;
  }

  function active() {
    return !!(state.q || state.app || state.section);
  }

  /* ---- rendering ---- */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function card(p) {
    var tags = p.tags.map(function (t) {
      return '<li><a href="/blog/tags/#' + encodeURIComponent(t.slug) + '" ' +
        'class="inline-block px-3 py-1 text-xs bg-brand-light text-brand-blue rounded-full ' +
        'hover:bg-brand-blue hover:text-white transition-colors">' + esc(t.name) + '</a></li>';
    }).join('');

    var thumb = p.image
      ? '<div class="shrink-0"><img src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async" ' +
        'class="w-20 h-20 sm:w-32 sm:h-32 object-cover rounded bg-gray-100"></div>'
      : '';

    return '<li class="group relative border-b border-gray-100 last:border-0">' +
      '<div class="flex gap-5 sm:gap-8 py-7 sm:py-9">' +
        '<div class="min-w-0 flex-1">' +
          '<p class="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-2">' +
            '<time datetime="' + esc(p.iso) + '">' + esc(p.date) + '</time>' +
            '<span aria-hidden="true">·</span><span>' + p.minutes + '分で読めます</span>' +
          '</p>' +
          '<h2 class="text-lg sm:text-2xl font-bold leading-snug mb-2">' +
            '<a href="' + esc(p.url) + '" class="text-gray-900 group-hover:text-brand-blue transition-colors ' +
            'after:absolute after:inset-0 after:content-[\'\']">' + esc(p.title) + '</a>' +
          '</h2>' +
          '<p class="text-sm sm:text-base text-gray-600 leading-relaxed mb-4">' + esc(p.description) + '</p>' +
          (tags ? '<ul class="relative z-10 flex flex-wrap gap-2">' + tags + '</ul>' : '') +
        '</div>' + thumb +
      '</div></li>';
  }

  function paintChips() {
    appChips.forEach(function (c) {
      var on = c.getAttribute('data-app') === state.app;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.className = chipClass(on);
    });
    sectionChips.forEach(function (c) {
      var key = c.getAttribute('data-section');
      var on = key === state.section;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.className = chipClass(on);
      // Counts are rendered against the whole site at build time. Once an app
      // is picked they are wrong — 表示設定 reads 7 across both apps but only
      // 5 of those are Points — so recount against the current filter. A chip
      // that drops to zero is noise, not a choice: hide it.
      if (posts) {
        var n = posts.filter(function (p) {
          return (!state.app || p.app === state.app) && p.section === key;
        }).length;
        var badge = c.querySelector('[data-count]');
        if (badge) badge.textContent = n;
        c.hidden = n === 0;
      } else {
        c.hidden = false;
      }
    });
  }

  function chipClass(on) {
    return 'rounded-full border px-3 py-1.5 text-sm transition-colors ' +
      (on
        ? 'border-brand-blue bg-brand-blue text-white'
        : 'border-gray-300 text-gray-700 hover:border-brand-blue hover:text-brand-blue');
  }

  function render() {
    paintChips();
    clearBtn.hidden = !active();

    if (!active()) {
      results.hidden = true;
      results.innerHTML = '';
      staticList.hidden = false;
      status.hidden = true;
      return;
    }

    if (!posts) {
      status.textContent = '読み込み中…';
      status.hidden = false;
      return;
    }

    var found = posts.filter(matches);
    staticList.hidden = true;
    results.hidden = false;
    status.hidden = false;
    status.textContent = found.length ? found.length + '件' : '条件に合う記事がありません。';
    results.innerHTML = found.map(card).join('');
  }

  /* ---- url state ---- */

  function pushUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.app) p.set('app', state.app);
    if (state.section) p.set('section', state.section);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '/blog/?' + qs : '/blog/');
  }

  function apply() {
    pushUrl();
    if (active() && !posts) {
      render();
      load().then(render).catch(function () { /* status already set */ });
    } else {
      render();
    }
  }

  /* ---- wiring ---- */

  appChips.forEach(function (c) {
    c.addEventListener('click', function (e) {
      e.preventDefault();
      var v = c.getAttribute('data-app');
      state.app = state.app === v ? '' : v;
      // Sections do not span apps in any useful way — clearing avoids
      // landing on a combination with nothing in it.
      state.section = '';
      apply();
    });
  });

  sectionChips.forEach(function (c) {
    c.addEventListener('click', function () {
      var v = c.getAttribute('data-section');
      state.section = state.section === v ? '' : v;
      apply();
    });
  });

  // Japanese input fires `input` on every keystroke of an in-progress
  // composition, so 「く」 would filter before 「クーポン」 is finished.
  search.addEventListener('compositionstart', function () { composing = true; });
  search.addEventListener('compositionend', function () {
    composing = false;
    state.q = search.value.trim();
    apply();
  });
  search.addEventListener('input', function () {
    if (composing) return;
    state.q = search.value.trim();
    apply();
  });

  clearBtn.addEventListener('click', function () {
    state = { q: '', app: '', section: '' };
    search.value = '';
    apply();
  });

  /* ---- boot ---- */

  search.hidden = false;
  if (sectionWrap) sectionWrap.hidden = false;

  var params = new URLSearchParams(location.search);
  state.q = (params.get('q') || '').trim();
  state.app = params.get('app') || '';
  state.section = params.get('section') || '';
  search.value = state.q;
  if (active()) apply(); else render();
})();
