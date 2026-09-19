/*
 * Client-side filter and search for /blog/.
 *
 * Progressive enhancement, deliberately. Without JavaScript the band shows
 * #blog-filter-fallback — three ordinary links to /blog/points/, /blog/coupon/
 * and /blog/reviews/ — and the paginated list works as it always has. The
 * search box and the two popover triggers start hidden because neither has a
 * no-JS equivalent, and a control that does nothing is worse than no control.
 *
 * The post data comes from /blog/articles.json rather than the DOM, because
 * /blog/ paginates at 10 and search has to reach the posts that are not on
 * screen. It is fetched on first interaction, so a reader who only scrolls the
 * list never pays for it. The panels' options are rendered server-side, so
 * opening one never waits on that fetch.
 *
 * The card markup below mirrors the <li> in blog/index.html. Two copies of one
 * design is a real cost; the alternative was rendering all posts server-side
 * and dropping pagination, which would 404 the /blog/page2/ URLs already
 * published. Change one, change the other.
 */
(function () {
  'use strict';

  var search = document.getElementById('blog-search');
  var searchWrap = document.getElementById('blog-search-wrap');
  var searchClear = document.getElementById('blog-search-clear');
  var results = document.getElementById('blog-results');
  var staticList = document.getElementById('blog-static');
  var status = document.getElementById('blog-status');
  var escalate = document.getElementById('blog-escalate');
  var fallback = document.getElementById('blog-filter-fallback');
  var controls = document.getElementById('blog-filter-controls');
  var backdrop = document.getElementById('blog-sheet-backdrop');
  var themeFilter = document.getElementById('blog-theme-filter');
  var themeTotal = document.querySelector('[data-theme-total]');
  if (!search || !results || !staticList || !status || !controls) return;

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

  function count(q, app, section) {
    if (!posts) return null;
    var needle = q.toLowerCase();
    return posts.filter(function (p) {
      if (app && p.app !== app) return false;
      if (section && p.section !== section) return false;
      if (needle && haystack(p).indexOf(needle) === -1) return false;
      return true;
    }).length;
  }

  function found() {
    var needle = state.q.toLowerCase();
    return posts.filter(function (p) {
      if (state.app && p.app !== state.app) return false;
      if (state.section && p.section !== state.section) return false;
      if (needle && haystack(p).indexOf(needle) === -1) return false;
      return true;
    });
  }

  function active() {
    return !!(state.q || state.app || state.section);
  }

  /* ---- popovers ---- */

  // One controller per filter. Both are single-select listboxes: an option sets
  // the value and closes. A section option carries its app too — section keys
  // are shared (`appearance` is both 会員ステージ's and クーポン's), so choosing one
  // under a group header only means something if it sets the app as well.
  function Panel(name) {
    var root = controls.querySelector('[data-filter="' + name + '"]');
    this.name = name;
    this.root = root;
    this.shell = root.querySelector('[data-shell]');
    this.trigger = root.querySelector('[data-trigger]');
    this.label = root.querySelector('[data-label]');
    this.chevron = root.querySelector('[data-chevron]');
    this.divider = root.querySelector('[data-divider]');
    this.clear = root.querySelector('[data-clear]');
    this.panel = root.querySelector('[role="listbox"]');
    this.options = Array.prototype.slice.call(this.panel.querySelectorAll('[role="option"]'));
    this.groups = Array.prototype.slice.call(this.panel.querySelectorAll('[data-group]'));
    this.open = false;
    this.cursor = -1;
    // Where the panel lives as a popover. In sheet mode it is moved to <body>
    // and must come back here, or the next desktop open anchors to nothing.
    this.home = this.panel.parentNode;
  }

  Panel.prototype.isSheet = function () {
    return window.matchMedia('(max-width: 639px)').matches;
  };

  Panel.prototype.setOpen = function (open) {
    if (open) closeAll(this);
    this.open = open;
    this.panel.hidden = !open;
    this.trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.chevron.style.transform = open ? 'rotate(180deg)' : '';

    var sheet = open && this.isSheet();
    // Geometry goes in inline styles, not Tailwind classes. The CDN build
    // generates CSS from what it sees in the markup; a class that only ever
    // appears via classList at runtime gets no rule, which silently left the
    // sheet floating at the popover's `top` instead of pinned to the bottom.
    // The page card carries `backdrop-blur-sm`, and a backdrop-filter makes an
    // element a containing block for its fixed descendants — so a sheet left
    // in place is pinned to the card, not the viewport (it rendered 358px wide
    // inset by 16). Moving it to <body> is what makes `fixed` mean the screen.
    if (sheet && this.panel.parentNode !== document.body) {
      document.body.appendChild(this.panel);
    } else if (!sheet && this.panel.parentNode !== this.home) {
      this.home.appendChild(this.panel);
    }

    var st = this.panel.style;
    if (sheet) {
      st.position = 'fixed';
      st.left = '0'; st.right = '0'; st.bottom = '0'; st.top = 'auto';
      st.width = 'auto';
      st.maxHeight = '70vh';
      st.borderRadius = '20px 20px 0 0';
      st.borderBottom = '0';
    } else {
      st.position = ''; st.left = ''; st.right = ''; st.bottom = ''; st.top = '';
      st.width = ''; st.maxHeight = ''; st.borderRadius = ''; st.borderBottom = '';
    }
    if (backdrop) backdrop.hidden = !sheet;

    if (open) {
      this.cursor = Math.max(0, this.options.indexOf(this.selectedOption()));
      this.paintCursor();
      if (this.name === 'section' && themeFilter && !sheet) themeFilter.focus();
      else this.panel.focus();
    } else {
      if (themeFilter) { themeFilter.value = ''; this.applyTextFilter(''); }
      this.cursor = -1;
      this.paintCursor();
    }
  };

  Panel.prototype.selectedOption = function () {
    var self = this;
    return this.options.filter(function (o) {
      return self.name === 'app'
        ? o.getAttribute('data-app') === state.app
        : o.getAttribute('data-section') === state.section;
    })[0] || this.options[0];
  };

  Panel.prototype.visibleOptions = function () {
    return this.options.filter(function (o) { return !o.hidden; });
  };

  Panel.prototype.paintCursor = function () {
    var self = this;
    this.options.forEach(function (o, i) {
      var on = i === self.cursor;
      o.classList.toggle('bg-brand-light', on);
      o.classList.toggle('text-brand-blue', on);
      o.classList.toggle('shadow-[inset_3px_0_0_#0066CC]', on);
      if (on) o.setAttribute('id', 'blog-opt-' + self.name);
      else o.removeAttribute('id');
    });
    if (this.cursor >= 0) {
      this.panel.setAttribute('aria-activedescendant', 'blog-opt-' + this.name);
      var el = this.options[this.cursor];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    } else {
      this.panel.removeAttribute('aria-activedescendant');
    }
  };

  Panel.prototype.moveCursor = function (delta) {
    var vis = this.visibleOptions();
    if (!vis.length) return;
    var here = vis.indexOf(this.options[this.cursor]);
    var next = here === -1 ? 0 : (here + delta + vis.length) % vis.length;
    this.cursor = this.options.indexOf(vis[next]);
    this.paintCursor();
  };

  Panel.prototype.applyTextFilter = function (q) {
    if (this.name !== 'section') return;
    var needle = q.trim().toLowerCase();
    this.options.forEach(function (o) {
      var name = o.getAttribute('data-name');
      if (!name) return; // the "すべてのテーマ" row always shows
      o.hidden = !!needle && name.toLowerCase().indexOf(needle) === -1;
    });
    // A group header with nothing under it is a label for an empty list.
    this.groups.forEach(function (g) {
      var el = g.nextElementSibling, any = false;
      while (el && el.getAttribute('role') === 'option') {
        if (!el.hidden) { any = true; break; }
        el = el.nextElementSibling;
      }
      g.hidden = !any;
    });
  };

  Panel.prototype.choose = function (opt) {
    if (this.name === 'app') {
      state.app = opt.getAttribute('data-app') || '';
      // Sections do not span apps in any useful way — clearing avoids landing
      // on a combination with nothing in it.
      state.section = '';
    } else {
      state.section = opt.getAttribute('data-section') || '';
      var owner = opt.getAttribute('data-app') || '';
      if (state.section) state.app = owner;
    }
    this.setOpen(false);
    this.trigger.focus();
    apply();
  };

  Panel.prototype.paint = function () {
    var self = this;
    var value = this.name === 'app' ? state.app : state.section;
    var chosen = this.options.filter(function (o) {
      return (self.name === 'app' ? o.getAttribute('data-app') : o.getAttribute('data-section')) === value;
    })[0];

    this.label.textContent = value && chosen
      ? chosen.querySelector('span').textContent
      : (this.name === 'app' ? 'すべてのアプリ' : 'すべてのテーマ');

    // Set filters invert to solid blue: on a brand-light band a tint has
    // nothing to push against.
    var on = !!value;
    this.shell.className = 'inline-flex items-stretch overflow-hidden rounded-lg border ' +
      (on ? 'border-brand-blue bg-brand-blue' : 'border-[#B8DAFF] bg-white');
    this.trigger.className = 'min-h-[44px] inline-flex items-center gap-2 px-3 py-2.5 text-sm ' +
      (on ? 'font-bold text-white' : 'text-gray-700');
    this.clear.className = 'min-h-[44px] inline-flex min-w-[36px] items-center justify-center px-2 ' +
      (on ? 'text-white' : 'text-gray-700');
    this.clear.hidden = !on;
    this.divider.hidden = !on;

    this.options.forEach(function (o) {
      var v = self.name === 'app' ? o.getAttribute('data-app') : o.getAttribute('data-section');
      var sel = (v || '') === (value || '');
      o.setAttribute('aria-selected', sel ? 'true' : 'false');
      var check = o.querySelector('[data-check]');
      if (check) check.style.visibility = sel ? '' : 'hidden';
    });

    // Counts are rendered against the whole site at build time. Once an app is
    // picked they are wrong — 表示設定 reads 7 across both apps but only 5 of
    // those belong to 会員ステージ — so recount against the current filter.
    if (posts) {
      this.options.forEach(function (o) {
        var badge = o.querySelector('[data-count]');
        if (!badge) return;
        if (self.name === 'app') {
          badge.textContent = count(state.q, o.getAttribute('data-app') || '', '');
        } else {
          var sec = o.getAttribute('data-section') || '';
          badge.textContent = count(state.q, sec ? o.getAttribute('data-app') : state.app, sec);
        }
      });
    }

    // With an app chosen, the other apps' groups are dead ends.
    if (this.name === 'section') {
      this.groups.forEach(function (g) {
        var key = g.getAttribute('data-group');
        var dead = !!state.app && key !== state.app;
        g.hidden = dead;
        var el = g.nextElementSibling;
        while (el && el.getAttribute('role') === 'option') {
          el.hidden = dead;
          el = el.nextElementSibling;
        }
      });
      if (themeTotal) {
        themeTotal.textContent = self.visibleOptions().length - 1 + ' テーマ';
      }
    }
  };

  var panels = { app: new Panel('app'), section: new Panel('section') };

  function closeAll(except) {
    Object.keys(panels).forEach(function (k) {
      if (panels[k] !== except && panels[k].open) panels[k].setOpen(false);
    });
    if (!except && backdrop) backdrop.hidden = true;
  }

  /* ---- rendering ---- */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Highlights the matched run. Amber, not brand-light: brand-light is the
  // band and the section chip, so a brand-light mark would disappear.
  function mark(text) {
    var out = esc(text);
    if (!state.q) return out;
    var needle = esc(state.q);
    var at = out.toLowerCase().indexOf(needle.toLowerCase());
    if (at === -1) return out;
    return out.slice(0, at) +
      '<mark class="rounded-[3px] bg-[#FFE9A8] px-0.5 text-gray-900">' +
      out.slice(at, at + needle.length) + '</mark>' +
      out.slice(at + needle.length);
  }

  function card(p) {
    // Mirrors the static card: the section's own page, not the filter URL.
    var chip = p.sectionLabel
      ? '<p class="relative z-10"><a href="/blog/' + encodeURIComponent(p.app) + '/' +
        encodeURIComponent(p.section) + '/" class="inline-block rounded-full border ' +
        (p.section === state.section
          ? 'border-brand-blue bg-brand-light text-brand-blue'
          : 'border-gray-200 text-gray-700 hover:border-brand-blue hover:text-brand-blue') +
        ' px-2.5 py-0.5 text-xs transition-colors">' + esc(p.sectionLabel) + '</a></p>'
      : '';

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
            'after:absolute after:inset-0 after:content-[\'\']">' + mark(p.title) + '</a>' +
          '</h2>' +
          '<p class="text-sm sm:text-base text-gray-600 leading-relaxed mb-4">' + mark(p.description) + '</p>' +
          chip +
        '</div>' + thumb +
      '</div></li>';
  }

  function emptyState() {
    return '<li class="rounded-xl border border-gray-200 p-8 text-center">' +
      '<p class="mb-2 text-lg font-bold text-gray-900">' +
        (state.q ? '「' + esc(state.q) + '」に当たる記事はありません' : '条件に合う記事はありません') + '</p>' +
      '<p class="mb-6 text-sm leading-relaxed text-gray-600">' +
        '検索はタイトル・説明・テーマ・タグを見ています。本文は対象外です。</p>' +
      '<div class="flex flex-wrap justify-center gap-2.5">' +
        '<button type="button" data-reset class="min-h-[44px] rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">' +
          '条件をクリアして全' + posts.length + '件を見る</button>' +
        '<a href="/blog/points-guide/" class="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:border-brand-blue hover:text-brand-blue">記事ガイドから探す</a>' +
      '</div></li>';
  }

  // /blog/ is one page for both apps, so the navbar CTA cannot be resolved at
  // build time — the app comes from a query string. Swap it with the filter.
  var APP_CTA = {
    points: { label: '会員ステージ', url: 'https://points.illumenza.dev' },
    coupon: { label: 'Illumenza Coupon', url: 'https://coupon.illumenza.dev' }
  };
  function paintCta() {
    var el = document.querySelector('[data-app-cta]');
    if (!el) return;
    var cta = APP_CTA[state.app] || APP_CTA.points;
    el.textContent = cta.label;
    el.setAttribute('href', cta.url);
  }

  // A filter narrow enough to be worth escaping should say what loosening it
  // would buy, rather than offering a blunt clear-all.
  function paintEscalate(n) {
    if (!escalate) return;
    var steps = [];
    if (state.section) {
      var a = count(state.q, state.app, '');
      if (a > n) steps.push('テーマを外すと ' + a + ' 件');
    }
    if (state.app) {
      var b = count(state.q, '', '');
      if (b > n) steps.push((steps.length ? 'アプリも外すと ' : 'アプリを外すと ') + b + ' 件');
    }
    escalate.hidden = !(n > 0 && steps.length);
    escalate.textContent = steps.length ? steps.join('、') : '';
  }

  function render() {
    panels.app.paint();
    panels.section.paint();
    paintCta();
    if (searchClear) searchClear.hidden = !state.q;

    if (!active()) {
      results.hidden = true;
      results.innerHTML = '';
      staticList.hidden = false;
      status.hidden = true;
      if (escalate) escalate.hidden = true;
      return;
    }

    if (!posts) {
      status.textContent = '読み込み中…';
      status.hidden = false;
      return;
    }

    var list = found();
    staticList.hidden = true;
    results.hidden = false;
    status.hidden = false;
    status.innerHTML = '<strong class="font-bold">' + list.length + ' 件</strong> 該当';
    paintEscalate(list.length);
    results.innerHTML = list.length ? list.map(card).join('') : emptyState();
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
    if (!posts) {
      render();
      load().then(render).catch(function () { /* status already set */ });
    } else {
      render();
    }
  }

  /* ---- wiring ---- */

  Object.keys(panels).forEach(function (k) {
    var panel = panels[k];

    panel.trigger.addEventListener('click', function () {
      panel.setOpen(!panel.open);
      // Counts inside the panel need the data; fetch it the moment one opens.
      if (panel.open && !posts) load().then(render).catch(function () {});
    });

    panel.clear.addEventListener('click', function () {
      if (k === 'app') { state.app = ''; state.section = ''; } else { state.section = ''; }
      apply();
    });

    panel.options.forEach(function (o) {
      o.addEventListener('click', function () { panel.choose(o); });
    });

    panel.panel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); panel.moveCursor(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); panel.moveCursor(-1); }
      else if (e.key === 'Home') { e.preventDefault(); panel.cursor = -1; panel.moveCursor(1); }
      else if (e.key === 'End') { e.preventDefault(); panel.cursor = -1; panel.moveCursor(-1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        if (panel.cursor >= 0) { e.preventDefault(); panel.choose(panel.options[panel.cursor]); }
      } else if (e.key === 'Escape') {
        e.preventDefault(); panel.setOpen(false); panel.trigger.focus();
      }
    });

    panel.trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && !panel.open) { e.preventDefault(); panel.setOpen(true); }
    });
  });

  if (themeFilter) {
    themeFilter.addEventListener('input', function () {
      panels.section.applyTextFilter(themeFilter.value);
      panels.section.cursor = -1;
      panels.section.moveCursor(1);
    });
    // This input sits inside the listbox, so every key here also bubbles to the
    // panel's own handler. Without stopPropagation both run and one ArrowDown
    // moves the cursor twice — or one Enter chooses twice.
    themeFilter.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation(); panels.section.setOpen(false); panels.section.trigger.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        panels.section.moveCursor(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        if (panels.section.cursor >= 0) panels.section.choose(panels.section.options[panels.section.cursor]);
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (!controls.contains(e.target)) closeAll();
  });
  if (backdrop) backdrop.addEventListener('click', function () { closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  results.addEventListener('click', function (e) {
    var reset = e.target.closest ? e.target.closest('[data-reset]') : null;
    if (!reset) return;
    state = { q: '', app: '', section: '' };
    search.value = '';
    apply();
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

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      state.q = '';
      search.value = '';
      search.focus();
      apply();
    });
  }

  /* ---- boot ---- */

  // Same containing-block trap as the sheet: the backdrop must sit on <body>
  // to cover the viewport rather than the card.
  if (backdrop && backdrop.parentNode !== document.body) document.body.appendChild(backdrop);

  if (searchWrap) searchWrap.hidden = false;
  controls.hidden = false;
  if (fallback) fallback.hidden = true;

  var params = new URLSearchParams(location.search);
  state.q = (params.get('q') || '').trim();
  state.app = params.get('app') || '';
  state.section = params.get('section') || '';
  search.value = state.q;
  if (active()) apply(); else render();
})();
