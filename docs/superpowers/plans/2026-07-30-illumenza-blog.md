# Illumenza Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Japanese-language Jekyll blog at `illumenza.dev/blog/` to the existing static homepage repo, publishing on push to GitHub Pages, with a stable RSS feed the future Mails app can poll.

**Architecture:** The repo is currently a hand-written static site (plain HTML + Tailwind CDN) served by GitHub Pages. GitHub Pages already runs Jekyll by default (there is no `.nojekyll` file), and Jekyll copies files *without* YAML front matter through untouched — so adding `_config.yml`, `_layouts/`, and `_posts/` introduces a blog **without altering any existing page**. Blog pages get their own Jekyll layouts that visually match the homepage (same nav, footer, Tailwind config, brand colors). The RSS feed and sitemap are **hand-written Liquid templates**, not plugins, so their exact XML shape (RSS 2.0 with `pubDate`, clean directory URLs) is under our control and stable for the Mails app contract. Only one plugin is used: `jekyll-paginate` (GitHub Pages whitelisted) for `/blog/` pagination.

**Tech Stack:** Jekyll 3.10 (matches GitHub Pages' builder), Liquid, `jekyll-paginate` 1.1, Kramdown (default Jekyll markdown), Tailwind CSS via CDN with the `typography` plugin for post body styling, Ruby (system 2.6 works; `mise` fallback documented).

## Global Constraints

Every task's requirements implicitly include this section.

- **Canonical blog URL:** `https://illumenza.dev/blog/<slug>/` — root-domain subdirectory. Settled; never move to a subdomain or to `points.illumenza.dev`.
- **Feed URL (contract with Mails app):** `https://illumenza.dev/blog/feed.xml`. Once created, this URL is frozen. Feed items MUST include `title`, `link`, `description`, `pubDate`.
- **Hosting:** GitHub Pages, publish-on-push, markdown source. No CMS, no database. Git history is the edit log.
- **Do NOT create a `.nojekyll` file.** It would disable the Jekyll build entirely.
- **Do NOT modify** `index.html` structure, `privacy/`, `tokushoho/`, `contact-us/`, `coupon/`, `points/`, `mostra/`, `js/`, `css/` — except the two explicit link additions in Task 8. Those pages must keep rendering byte-identically.
- **Do NOT add front matter to any existing `.html` file.** Front matter switches a file from "copied verbatim" to "rendered through Liquid", which risks changing existing output.
- **Language:** all blog content is Japanese, polite 敬体 (です/ます). `<html lang="ja">`. Blog pages are ja-only — no `lang-en`/`lang-jp` span duplication, and blog layouts must NOT load `js/main.js` (it drives the homepage's language toggle).
- **CONTENT RULE — ABSOLUTE:** never write 導入事例, お客様の声, testimonials, case studies, customer quotes, or named/unnamed store examples framed as real users. There are no clients yet; fabricating them is prohibited. Use statistics, screenshots, and how-to content instead.
- **Audience:** ColorMe (カラーミーショップ) store owners. Mostly non-technical, cannot edit DNS, run small shops. No jargon without a plain-Japanese gloss.
- **Every post ends with a CTA linking to `https://points.illumenza.dev`.** Implemented once in the post layout so it cannot be forgotten per-post.
- **No UTM parameters in post content or the feed.** The Mails app appends them downstream.
- **Brand tokens (copy exactly):** `brand-blue: #0066CC`, `brand-light: #E6F2FF`, font stack `['Noto Sans', 'Noto Sans JP', 'sans-serif']`.
- **Google Analytics ID:** `G-PD4WWX28GL` (same as homepage; include on blog pages).
- **Timezone:** `Asia/Tokyo` — prevents post dates shifting a day.
- **Post filename format:** `_posts/YYYY-MM-DD-<ascii-kebab-slug>.md`. Slug is ASCII (not Japanese) so URLs stay clean.

---

## Pre-flight: local Jekyll toolchain

Do this once, before Task 1. It is not a task because it produces no commit.

- [ ] **Try the system Ruby first.** Jekyll 3.10 requires Ruby >= 2.5; system Ruby is 2.6.10, so it should work and needs no install.

```bash
cd /Users/gen/Code/illumenza-HP
ruby -v      # expect: ruby 2.6.10...
bundle -v    # expect: Bundler version 1.17.2
```

- [ ] **Fallback only if `bundle install` in Task 1 fails on a native gem build** (e.g. `ffi`, `sassc`, `eventmachine` compile errors):

```bash
mise use ruby@3.3          # compiles Ruby; takes several minutes
gem install bundler
```

Then re-run the Task 1 `bundle install`. Everything else in this plan is unchanged.

---

### Task 1: Jekyll scaffold — config, Gemfile, gitignore

Turn the repo into a Jekyll site whose build output for existing pages is identical to the current hand-written files.

**Files:**
- Create: `Gemfile`
- Create: `_config.yml`
- Modify: `.gitignore`
- Verify (do not modify): `index.html`, `privacy/index.html`, `contact-us/index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable Jekyll site. Later tasks rely on these `_config.yml` values:
  - `site.title` → `"Illumenza ブログ"`
  - `site.description` → the ja description string below
  - `site.url` → `"https://illumenza.dev"` (makes `absolute_url` work)
  - `site.paginate` → `10`, `site.paginate_path` → `"/blog/page:num/"`
  - post permalink → `/blog/:title/`
  - posts default to `layout: post`

- [ ] **Step 1: Write the failing test**

There is no test framework in this repo. The test cycle for every task in this plan is: **build the site, then assert on the generated `_site/` output.** Create the check script now — it is the test harness for all later tasks.

Create `script/check-build.sh`:

```bash
#!/usr/bin/env bash
# Test harness for the blog. Builds the site, then asserts on _site/ output.
# Usage: script/check-build.sh
set -euo pipefail

cd "$(dirname "$0")/.."

failures=0
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; failures=1; }

check_file() {
  if [ -f "$1" ]; then pass "exists: $1"; else fail "missing: $1"; fi
}

# check_contains <file> <fixed-string>
check_contains() {
  if [ ! -f "$1" ]; then fail "missing: $1"; return; fi
  if grep -qF -- "$2" "$1"; then pass "$1 contains: $2"; else fail "$1 missing: $2"; fi
}

# check_absent <file> <fixed-string>
check_absent() {
  if [ ! -f "$1" ]; then fail "missing: $1"; return; fi
  if grep -qF -- "$2" "$1"; then fail "$1 unexpectedly contains: $2"; else pass "$1 free of: $2"; fi
}

echo "== building =="
bundle exec jekyll build --trace

echo "== existing pages pass through unchanged =="
for f in index.html privacy/index.html tokushoho/index.html contact-us/index.html \
         coupon/contact-us/index.html coupon/uninstall/index.html \
         points/contact-us/index.html mostra/contact-us/index.html; do
  if diff -q "$f" "_site/$f" >/dev/null 2>&1; then
    pass "unchanged: $f"
  else
    fail "MODIFIED BY BUILD: $f"
  fi
done

echo "== static assets copied =="
check_file _site/css/forms.css
check_file _site/js/form-renderer.js
check_file _site/js/forms-config.js
check_file _site/js/main.js
check_file _site/js/footer-year.js
check_file _site/js/particles-simple.js
check_file _site/images/logo-full.png
check_file _site/images/logo-short.png
check_file _site/images/points.webp
check_contains _site/CNAME "illumenza.dev"

echo "== build artifacts not leaked into output =="
for leaked in _site/Gemfile _site/Gemfile.lock _site/README.html _site/docs _site/script; do
  if [ -e "$leaked" ]; then fail "leaked into _site: $leaked"; else pass "not in _site: $leaked"; fi
done

# ---- Blog checks below are added by later tasks ----

echo
if [ "$failures" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
chmod +x script/check-build.sh
script/check-build.sh
```

Expected: FAIL — `bundle: command not found` on a missing Gemfile, or `Could not locate Gemfile`.

- [ ] **Step 3: Write the minimal code to make the test pass**

Create `Gemfile` (pin Jekyll to the version GitHub Pages runs, so local output matches production):

```ruby
source "https://rubygems.org"

# Pinned to the Jekyll version GitHub Pages' builder uses, so local output
# matches what gets published. Do not upgrade without checking
# https://pages.github.com/versions/
gem "jekyll", "~> 3.10.0"

group :jekyll_plugins do
  gem "jekyll-paginate", "~> 1.1"
end

# Ruby 3.x removed webrick from stdlib; harmless on 2.6.
gem "webrick", "~> 1.8"
```

Create `_config.yml`:

```yaml
# Jekyll config for the illumenza.dev blog.
# The rest of this site is hand-written static HTML. Files without YAML front
# matter are copied through untouched, so existing pages are unaffected.

title: "Illumenza ブログ"
description: "カラーミーショップ運営者のための、ポイント・ロイヤルティ施策とECマーケティングの実践ガイド。"
url: "https://illumenza.dev"
lang: ja
timezone: Asia/Tokyo

# Posts live at /blog/<slug>/ — settled URL structure, do not change.
permalink: /blog/:title/

# Pagination for /blog/ (jekyll-paginate is GitHub Pages whitelisted).
paginate: 10
paginate_path: "/blog/page:num/"

plugins:
  - jekyll-paginate

# Posts get the post layout automatically; no per-post `layout:` needed.
defaults:
  - scope:
      path: ""
      type: posts
    values:
      layout: post

# Do not publish posts dated in the future.
future: false

markdown: kramdown
kramdown:
  input: GFM
  hard_wrap: false

exclude:
  - Gemfile
  - Gemfile.lock
  - vendor
  - README.md
  - docs
  - script
  - test-results
  - .playwright-mcp
  - .claude
  - .DS_Store
```

Append to `.gitignore`:

```
_site/
.jekyll-cache/
.jekyll-metadata
vendor/
```

- [ ] **Step 4: Install gems, then run the test to verify it passes**

```bash
bundle install --path vendor/bundle
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`.

If `bundle install` dies on a native extension build, do the Pre-flight fallback (`mise use ruby@3.3`), then re-run both commands.

If any `MODIFIED BY BUILD:` line appears, stop and investigate — an existing page picked up Liquid processing. Do not proceed; that breaks a Global Constraint.

- [ ] **Step 5: Commit**

```bash
git add Gemfile Gemfile.lock _config.yml .gitignore script/check-build.sh
git commit -m "chore: add Jekyll scaffold for blog at /blog/

Existing static pages have no front matter, so Jekyll copies them
through untouched. script/check-build.sh asserts that byte-for-byte."
```

---

### Task 2: Blog layouts — shell, meta/OG, and the points CTA

Two layouts: `default` (nav, footer, head meta, Tailwind, GA) and `post` (article chrome + mandatory CTA). Nothing renders yet — Task 3 adds the first post that exercises them.

**Files:**
- Create: `_layouts/default.html`
- Create: `_layouts/post.html`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `site.title`, `site.description`, `site.url` from Task 1.
- Produces: two layouts. Later tasks set these front matter keys on pages/posts:
  - `title` (string, required) — `<h1>` and `<title>`
  - `description` (string, required) — `<meta name="description">` + OG description
  - `ogImage` (string, optional) — absolute or root-relative path; defaults to `/images/logo-full.png`
  - `tags` (list of strings, optional)
  - `date` (from post filename)

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing the line `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== layouts exist =="
check_file _layouts/default.html
check_file _layouts/post.html
check_contains _layouts/default.html 'cdn.tailwindcss.com?plugins=typography'
check_contains _layouts/default.html "G-PD4WWX28GL"
check_contains _layouts/default.html '#0066CC'
check_contains _layouts/default.html 'application/rss+xml'
# Blog pages must not load the homepage language toggle.
check_absent _layouts/default.html 'js/main.js'
# The points CTA is in the layout so no post can ship without it.
check_contains _layouts/post.html 'https://points.illumenza.dev'

# ---- Blog checks below are added by later tasks ----
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `missing: _layouts/default.html`.

- [ ] **Step 3: Write the minimal implementation**

Create `_layouts/default.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  {%- assign meta_title = page.title | default: site.title -%}
  {%- assign meta_desc = page.description | default: site.description -%}
  {%- assign og_image = page.ogImage | default: '/images/logo-full.png' | absolute_url -%}

  <title>{% if page.title %}{{ page.title }} | Illumenza ブログ{% else %}{{ site.title }}{% endif %}</title>
  <meta name="description" content="{{ meta_desc | strip_newlines | escape }}">
  <link rel="canonical" href="{{ page.url | absolute_url }}">
  <link rel="icon" type="image/png" href="/images/logo-short.png">
  <link rel="alternate" type="application/rss+xml" title="Illumenza ブログ" href="{{ '/blog/feed.xml' | absolute_url }}">

  <!-- Open Graph -->
  <meta property="og:type" content="{% if page.layout == 'post' %}article{% else %}website{% endif %}">
  <meta property="og:site_name" content="Illumenza">
  <meta property="og:url" content="{{ page.url | absolute_url }}">
  <meta property="og:title" content="{{ meta_title | escape }}">
  <meta property="og:description" content="{{ meta_desc | strip_newlines | escape }}">
  <meta property="og:image" content="{{ og_image }}">
  <meta property="og:locale" content="ja_JP">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{ meta_title | escape }}">
  <meta name="twitter:description" content="{{ meta_desc | strip_newlines | escape }}">
  <meta name="twitter:image" content="{{ og_image }}">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Noto+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">

  <!-- Tailwind CSS (typography plugin styles the markdown body) -->
  <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { 'sans': ['Noto Sans', 'Noto Sans JP', 'sans-serif'] },
          colors: { 'brand-blue': '#0066CC', 'brand-light': '#E6F2FF' }
        }
      }
    }
  </script>

  {% if page.layout == 'post' %}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": {{ page.title | jsonify }},
    "description": {{ meta_desc | strip_newlines | jsonify }},
    "image": {{ og_image | jsonify }},
    "datePublished": "{{ page.date | date_to_xmlschema }}",
    "dateModified": "{{ page.date | date_to_xmlschema }}",
    "inLanguage": "ja",
    "mainEntityOfPage": { "@type": "WebPage", "@id": {{ page.url | absolute_url | jsonify }} },
    "author": { "@type": "Organization", "name": "Illumenza", "url": "https://illumenza.dev" },
    "publisher": { "@type": "Organization", "name": "Illumenza", "url": "https://illumenza.dev" }
  }
  </script>
  {% endif %}

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-PD4WWX28GL"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-PD4WWX28GL');
  </script>
</head>
<body class="font-sans text-gray-800 bg-white">

  <nav class="sticky top-0 w-full bg-white/90 backdrop-blur-sm shadow-sm z-50">
    <div class="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
      <a href="/"><img src="/images/logo-full.png" alt="Illumenza" class="h-8 sm:h-10"></a>
      <div class="flex items-center gap-3 sm:gap-5 text-sm">
        <a href="/blog/" class="font-medium text-gray-700 hover:text-brand-blue transition-colors">ブログ</a>
        <a href="https://points.illumenza.dev" class="px-3 sm:px-4 py-1.5 sm:py-2 font-medium bg-brand-light text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-colors">
          Illumenza Points
        </a>
      </div>
    </div>
  </nav>

  <main class="px-4 sm:px-6 py-10 sm:py-16">
    {{ content }}
  </main>

  <footer class="py-8 sm:py-12 px-4 sm:px-6 bg-gray-900 text-white">
    <div class="container mx-auto max-w-4xl">
      <div class="grid md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
        <div class="text-center md:text-left">
          <h4 class="font-bold text-base sm:text-lg mb-1 sm:mb-2">Illumenza</h4>
          <p class="text-gray-400 text-xs sm:text-sm">テクノロジーで事業を明るく照らす</p>
        </div>
        <div class="text-center md:text-right">
          <p class="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">個人事業主</p>
          <p class="text-gray-400 text-xs sm:text-sm">個人事業の開業届出済</p>
        </div>
      </div>
      <div class="border-t border-gray-800 pt-6 sm:pt-8 text-center">
        <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
          <a href="/" class="hover:text-white transition-colors">ホーム</a>
          <a href="/blog/" class="hover:text-white transition-colors">ブログ</a>
          <a href="/contact-us/" class="hover:text-white transition-colors">お問い合わせ</a>
          <a href="/privacy/" class="hover:text-white transition-colors">プライバシーポリシー</a>
          <a href="/tokushoho/" class="hover:text-white transition-colors">特定商取引法に基づく表記</a>
        </div>
        <p class="text-xs sm:text-sm text-gray-400">&copy; <span class="copyright-year">2025</span> Illumenza. All rights reserved.</p>
      </div>
    </div>
  </footer>

  <script src="/js/footer-year.js"></script>
</body>
</html>
```

Create `_layouts/post.html`:

```html
---
layout: default
---
<article class="container mx-auto max-w-3xl">

  <header class="mb-8 sm:mb-12">
    <p class="text-sm text-gray-500 mb-3">
      <time datetime="{{ page.date | date_to_xmlschema }}">{{ page.date | date: '%Y年%-m月%-d日' }}</time>
    </p>
    <h1 class="text-2xl sm:text-4xl font-bold text-gray-900 leading-snug">{{ page.title }}</h1>
    {% if page.tags and page.tags.size > 0 %}
    <ul class="flex flex-wrap gap-2 mt-5">
      {% for tag in page.tags %}
      <li>
        <a href="/blog/tags/#{{ tag | slugify }}" class="inline-block px-3 py-1 text-xs bg-brand-light text-brand-blue rounded-full hover:bg-brand-blue hover:text-white transition-colors">{{ tag }}</a>
      </li>
      {% endfor %}
    </ul>
    {% endif %}
  </header>

  <div class="prose prose-base sm:prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-a:text-brand-blue prose-a:no-underline hover:prose-a:underline">
    {{ content }}
  </div>

  <!-- Mandatory CTA. Lives in the layout so every post has it. -->
  <aside class="mt-12 sm:mt-16 p-6 sm:p-8 bg-brand-light rounded-xl text-center">
    <h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-3">ポイント制度をノーコードで始めませんか</h2>
    <p class="text-sm sm:text-base text-gray-700 mb-6">
      Illumenza Points は、カラーミーショップ向けのロイヤルティアプリです。ポイント付与・会員ランク・友達紹介を、専門知識なしで設定できます。
    </p>
    <a href="https://points.illumenza.dev" class="inline-block px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base bg-brand-blue text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
      Illumenza Points を見る
    </a>
  </aside>

  <nav class="mt-10 flex justify-between text-sm gap-4">
    {% if page.previous %}
      <a href="{{ page.previous.url }}" class="text-brand-blue hover:underline">&larr; {{ page.previous.title }}</a>
    {% else %}<span></span>{% endif %}
    {% if page.next %}
      <a href="{{ page.next.url }}" class="text-brand-blue hover:underline text-right">{{ page.next.title }} &rarr;</a>
    {% else %}<span></span>{% endif %}
  </nav>

</article>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add _layouts script/check-build.sh
git commit -m "feat: add blog layouts matching homepage shell

default.html carries head meta/OG/JSON-LD, nav, footer and GA.
post.html adds article chrome plus the points.illumenza.dev CTA,
placed in the layout so no post can ship without it."
```

---

### Task 3: First post — proves post rendering end to end

Write one real article. It is both the seed content and the fixture that Tasks 4–7 assert against.

**Files:**
- Create: `_posts/2026-07-30-colorme-points-5-decisions.md`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `_layouts/post.html` from Task 2 (front matter keys `title`, `description`, `tags`, `ogImage`).
- Produces: a post at `/blog/colorme-points-5-decisions/` and one entry in `site.posts` for Tasks 4–6 to render.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== first post renders =="
POST=_site/blog/colorme-points-5-decisions/index.html
check_file "$POST"
check_contains "$POST" "<h1"
check_contains "$POST" "ポイント制度"
check_contains "$POST" '<time datetime="2026-07-30'
check_contains "$POST" 'rel="canonical" href="https://illumenza.dev/blog/colorme-points-5-decisions/"'
check_contains "$POST" 'property="og:type" content="article"'
check_contains "$POST" 'property="og:image" content="https://illumenza.dev/images/points.webp"'
check_contains "$POST" '"@type": "BlogPosting"'
check_contains "$POST" 'https://points.illumenza.dev'
# Content rule: forbidden fabricated-social-proof vocabulary.
check_absent "$POST" "導入事例"
check_absent "$POST" "お客様の声"
# No UTM in post content or CTA — the mails app adds those.
check_absent "$POST" "utm_"

# ---- Blog checks below are added by later tasks ----
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `missing: _site/blog/colorme-points-5-decisions/index.html`.

- [ ] **Step 3: Write the post**

Create `_posts/2026-07-30-colorme-points-5-decisions.md`:

```markdown
---
title: "カラーミーショップでポイント制度を始める前に決めておく5つのこと"
date: 2026-07-30 09:00:00 +0900
tags: [ポイント制度, ロイヤルティ, カラーミーショップ]
description: "ポイント制度は「還元率を決めて終わり」ではありません。カラーミーショップで運用を始める前に決めておきたい5つの論点を、計算例つきで整理します。"
ogImage: /images/points.webp
---

ポイント制度は、リピート購入を増やす施策のなかでも導入しやすいものです。一方で「とりあえず1%還元で始めた」あと、次のような迷いが出てくることがよくあります。

- 送料やクーポン利用分にもポイントを付けるべきか
- 有効期限は設けるべきか、設けるとして何か月か
- ポイントの原価は、どの費目で見るべきか

これらは、あとから変更すると既存のお客様に不利益変更として受け取られやすい部分です。走り出す前に決めておくほど、運用は楽になります。この記事では、最低限決めておきたい5つの論点を順番に整理します。

## 1. 還元率と、その原価をどう見るか

還元率は「売上に対して何パーセントを値引き原資として使うか」という意思決定です。1%還元は、粗利ではなく**売上の1%**が将来の値引きとして積み上がることを意味します。

粗利率30%のショップで、税抜1万円の商品を1%還元で販売した場合を考えます。

| 項目 | 金額 |
| --- | --- |
| 売上 | 10,000円 |
| 粗利（30%） | 3,000円 |
| 付与ポイント（1%） | 100円 |
| ポイント考慮後の粗利 | 2,900円 |

粗利に対する負担は 100 ÷ 3,000 ≒ **3.3%** です。売上比では1%でも、粗利比では3倍以上の重さになります。還元率を検討するときは、必ず粗利率と並べて見てください。

なお、付与したポイントの全額がすぐ使われるわけではありません。未使用のまま失効する分（失効率）があるため、実際のコストは付与額より小さくなります。ただし失効率は運用実績が出るまで読めないので、**最初は失効を見込まずに** 成り立つ還元率から始めるのが安全です。

## 2. 何に対してポイントを付けるか

「購入金額の1%」と決めても、次の境界は自動的には決まりません。

- **送料** — 送料にポイントを付けると、送料無料ラインの直前でカゴ落ちしたお客様に、送料分の還元がつくことになります。送料を除外する運用が一般的です。
- **手数料** — 代引き手数料なども同様に除外を検討します。
- **クーポン利用後の金額か、利用前か** — 3,000円の商品に500円クーポンを使った場合、2,500円に対して付与するのが原則です。クーポンと重ねて満額付与すると、実質的な二重値引きになります。
- **ポイント支払い分** — ポイントで支払った金額に再びポイントを付けると、還元が循環します。除外してください。
- **税込か税抜か** — どちらでも構いませんが、**表示と一致させる**ことが重要です。税込表示のショップで税抜計算にすると、お客様の暗算と合わなくなります。

決めた内容は、ポイント規約ページに1行ずつ書き出しておきます。問い合わせが来たときに参照できる形になっていることが大切です。

## 3. 有効期限をどう設計するか

有効期限には2つの型があります。

**固定期限型** — 付与日から12か月など、付与ごとに期限が切れる方式。管理はシンプルですが、お客様は自分のポイントがいつ切れるのか把握しづらくなります。

**最終利用日から延長する型** — 購入やポイント利用があるたびに、保有ポイント全体の期限が延びる方式。アクティブなお客様のポイントは実質的に失効しないため、優良顧客を不利にしません。リピート施策としてはこちらが向いています。

期限なしは、会計上の負債が無期限に積み上がることを意味します。小規模ショップでも、期限は設けておくことをおすすめします。目安としては12か月前後が扱いやすい長さです。

## 4. 失効前に知らせるかどうか

期限を設けるなら、失効前の通知をセットで考えます。通知がないまま失効すると、「気づいたら消えていた」という体験になり、ポイント制度そのものへの信頼が落ちます。

決めることは2つです。

1. **何日前に知らせるか** — 30日前、7日前など。2段階にすると、1回目を見落としたお客様も拾えます。
2. **何ポイント以上を対象にするか** — 数ポイントの失効通知は、かえって煩わしく受け取られます。「送料無料になる」「1品買える」といった、使う動機になる金額から通知すると自然です。

## 5. 誰がポイントを増やせるのか

購入以外にもポイントを付ける経路を用意するかどうかは、初期に決めておきたい論点です。代表的なものは次のとおりです。

- **会員登録時** — 初回購入のハードルを下げます。
- **誕生日** — 年1回、来店理由をつくれます。
- **レビュー投稿** — 商品ページの情報が増えます。
- **友達紹介** — 紹介した側と、された側の両方に付与する形が一般的です。
- **会員ランク** — 累計購入額に応じて還元率を上げ、上位顧客を維持します。

すべてを最初から始める必要はありません。ただし「あとで足す」前提で設計しておくと、還元率の合計が想定を超えないよう調整しやすくなります。**購入時の還元率 + 追加付与の合計**が、1で確認した粗利負担の範囲に収まるかを確認してください。

## まとめ

始める前に決めておきたいのは、次の5点です。

1. 還元率を、売上比ではなく粗利比で確認したか
2. 送料・手数料・クーポン・ポイント払い・税の扱いを書き出したか
3. 有効期限の型（固定か、最終利用日から延長か）を選んだか
4. 失効前通知のタイミングと対象額を決めたか
5. 購入以外の付与経路を、還元率の合計として把握しているか

この5点が決まっていれば、あとの運用は設定作業になります。逆に決めずに始めると、途中の変更がそのままお客様への不利益変更になり、告知の手間が増えていきます。
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Eyeball it in a browser**

```bash
bundle exec jekyll serve --port 4000
```

Open `http://localhost:4000/blog/colorme-points-5-decisions/`. Confirm: heading hierarchy readable, table renders, tag pills show, CTA box at the bottom, footer year filled in by `footer-year.js`. `Ctrl-C` to stop.

- [ ] **Step 6: Commit**

```bash
git add _posts script/check-build.sh
git commit -m "content: add first blog post on points program setup

Seeds /blog/ and acts as the fixture the feed, sitemap and tag
page checks assert against."
```

---

### Task 4: Post list at /blog/ with pagination

**Files:**
- Create: `blog/index.html`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `_layouts/default.html` (Task 2), `site.paginate`/`paginate_path` (Task 1), `site.posts` (Task 3).
- Produces: `/blog/` (page 1) and `/blog/page2/`, `/blog/page3/`… once there are more than 10 posts.

**Note on `jekyll-paginate`:** it only paginates a file literally named `index.html`, and the file's location must line up with `paginate_path`. `blog/index.html` + `paginate_path: "/blog/page:num/"` is the supported combination. It also requires `.html` — a `blog/index.md` will silently not paginate.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== /blog/ list page =="
LIST=_site/blog/index.html
check_file "$LIST"
check_contains "$LIST" "colorme-points-5-decisions"
check_contains "$LIST" "ブログ"
check_contains "$LIST" 'rel="canonical" href="https://illumenza.dev/blog/"'
check_contains "$LIST" 'property="og:type" content="website"'
# paginator must be wired up, not just a plain post loop
if grep -qF 'data-paginator="1"' "$LIST"; then
  pass "$LIST paginator active"
else
  fail "$LIST paginator inactive (jekyll-paginate did not run — check plugin + filename)"
fi

# ---- Blog checks below are added by later tasks ----
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `missing: _site/blog/index.html`.

- [ ] **Step 3: Write the minimal implementation**

Create `blog/index.html`:

```html
---
layout: default
title: "ブログ"
description: "カラーミーショップ運営者のための、ポイント・ロイヤルティ施策とECマーケティングの実践ガイド。"
---
<div class="container mx-auto max-w-3xl" data-paginator="{{ paginator.total_pages }}">

  <header class="mb-10 sm:mb-14">
    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">ブログ</h1>
    <p class="text-base sm:text-lg text-gray-600">
      カラーミーショップでポイント制度やロイヤルティ施策を運用するための、実践的な記事をお届けします。
    </p>
    <p class="mt-4 text-sm">
      <a href="/blog/tags/" class="text-brand-blue hover:underline">タグ一覧</a>
      <span class="text-gray-300 mx-2">|</span>
      <a href="/blog/feed.xml" class="text-brand-blue hover:underline">RSS</a>
    </p>
  </header>

  {% if paginator.posts.size == 0 %}
  <p class="text-gray-600">記事はまだありません。</p>
  {% endif %}

  <ul class="space-y-8 sm:space-y-10">
    {% for post in paginator.posts %}
    <li class="pb-8 sm:pb-10 border-b border-gray-200 last:border-0">
      <p class="text-sm text-gray-500 mb-2">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y年%-m月%-d日' }}</time>
      </p>
      <h2 class="text-xl sm:text-2xl font-bold mb-3 leading-snug">
        <a href="{{ post.url }}" class="text-gray-900 hover:text-brand-blue transition-colors">{{ post.title }}</a>
      </h2>
      <p class="text-sm sm:text-base text-gray-600 mb-4">{{ post.description }}</p>
      {% if post.tags and post.tags.size > 0 %}
      <ul class="flex flex-wrap gap-2">
        {% for tag in post.tags %}
        <li><a href="/blog/tags/#{{ tag | slugify }}" class="inline-block px-3 py-1 text-xs bg-brand-light text-brand-blue rounded-full hover:bg-brand-blue hover:text-white transition-colors">{{ tag }}</a></li>
        {% endfor %}
      </ul>
      {% endif %}
    </li>
    {% endfor %}
  </ul>

  {% if paginator.total_pages > 1 %}
  <nav class="mt-12 flex items-center justify-between text-sm" aria-label="ページ送り">
    {% if paginator.previous_page %}
      <a href="{{ paginator.previous_page_path }}" class="px-4 py-2 bg-brand-light text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-colors">&larr; 新しい記事</a>
    {% else %}<span></span>{% endif %}
    <span class="text-gray-500">{{ paginator.page }} / {{ paginator.total_pages }}</span>
    {% if paginator.next_page %}
      <a href="{{ paginator.next_page_path }}" class="px-4 py-2 bg-brand-light text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-colors">過去の記事 &rarr;</a>
    {% else %}<span></span>{% endif %}
  </nav>
  {% endif %}

</div>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`. The `data-paginator="1"` assertion passes because `paginator.total_pages` is `1` with a single post — proving the plugin ran (without it, `paginator` is nil and the attribute renders empty).

- [ ] **Step 5: Verify pagination actually splits at 11 posts**

Temporarily lower the page size rather than writing 10 throwaway posts:

```bash
sed -i '' 's/^paginate: 10$/paginate: 1/' _config.yml
bundle exec jekyll build
ls _site/blog/          # expect: index.html and (with 2+ posts) page2/
sed -i '' 's/^paginate: 1$/paginate: 10/' _config.yml
bundle exec jekyll build
```

With only one post there is nothing to split yet — confirm the command runs clean and `_site/blog/index.html` still exists. Re-run `script/check-build.sh` afterwards and confirm `paginate: 10` is restored in `_config.yml` before committing.

- [ ] **Step 6: Commit**

```bash
git add blog/index.html script/check-build.sh
git commit -m "feat: add /blog/ post list with pagination"
```

---

### Task 5: RSS feed at /blog/feed.xml

Hand-written RSS 2.0 rather than `jekyll-feed`, because the Mails app contract names `pubDate` (an RSS 2.0 element; `jekyll-feed` emits Atom with `published`), and because the URL must stay frozen independent of plugin behaviour.

**Files:**
- Create: `blog/feed.xml`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `site.title`, `site.description`, `site.url` (Task 1); `site.posts` with `title`, `url`, `description`, `date`, `tags` (Task 3).
- Produces: `https://illumenza.dev/blog/feed.xml` — **frozen URL**, the Mails app integration contract. Each `<item>` carries `title`, `link`, `guid`, `description`, `pubDate`, and zero or more `<category>`.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== RSS feed (mails app contract) =="
FEED=_site/blog/feed.xml
check_file "$FEED"
check_contains "$FEED" '<?xml version="1.0" encoding="UTF-8"?>'
check_contains "$FEED" '<rss version="2.0"'
check_contains "$FEED" "<title>Illumenza ブログ</title>"
check_contains "$FEED" "<link>https://illumenza.dev/blog/</link>"
check_contains "$FEED" "<language>ja</language>"
check_contains "$FEED" 'rel="self"'
check_contains "$FEED" "<link>https://illumenza.dev/blog/colorme-points-5-decisions/</link>"
check_contains "$FEED" "<pubDate>"
check_contains "$FEED" "<description>"
check_contains "$FEED" "<guid isPermaLink=\"true\">https://illumenza.dev/blog/colorme-points-5-decisions/</guid>"
check_contains "$FEED" "<category>ポイント制度</category>"
# No leaked front matter, no UTM (mails app appends those).
check_absent "$FEED" "layout:"
check_absent "$FEED" "utm_"
# Feed must be well-formed XML.
if python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('$FEED')" 2>/dev/null; then
  pass "$FEED is well-formed XML"
else
  fail "$FEED is NOT well-formed XML"
fi

# ---- Blog checks below are added by later tasks ----
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `missing: _site/blog/feed.xml`.

- [ ] **Step 3: Write the minimal implementation**

Create `blog/feed.xml`. `layout: null` means "render Liquid, apply no layout" — required, or the HTML shell would wrap the XML.

```xml
---
layout: null
---
<?xml version="1.0" encoding="UTF-8"?>
<!--
  RSS 2.0 feed for the Illumenza blog.
  CONTRACT: consumed by the Illumenza Mails app to draft biweekly digests.
  This URL (/blog/feed.xml) and the item fields (title, link, description,
  pubDate) are frozen. Do not rename or drop them.
  UTM parameters are appended by the mails app, never baked in here.
-->
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{{ site.title | xml_escape }}</title>
    <link>{{ '/blog/' | absolute_url }}</link>
    <description>{{ site.description | xml_escape }}</description>
    <language>ja</language>
    <atom:link href="{{ '/blog/feed.xml' | absolute_url }}" rel="self" type="application/rss+xml" />
    {%- if site.posts.first %}
    <lastBuildDate>{{ site.posts.first.date | date_to_rfc822 }}</lastBuildDate>
    {%- endif %}
    {%- for post in site.posts limit: 50 %}
    <item>
      <title>{{ post.title | xml_escape }}</title>
      <link>{{ post.url | absolute_url }}</link>
      <guid isPermaLink="true">{{ post.url | absolute_url }}</guid>
      <description>{{ post.description | default: post.excerpt | strip_html | normalize_whitespace | xml_escape }}</description>
      <pubDate>{{ post.date | date_to_rfc822 }}</pubDate>
      {%- for tag in post.tags %}
      <category>{{ tag | xml_escape }}</category>
      {%- endfor %}
    </item>
    {%- endfor %}
  </channel>
</rss>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Read the feed once with your own eyes**

```bash
cat _site/blog/feed.xml
```

Confirm: the `<?xml ...?>` declaration is on the first line (no blank line above it — a leading blank line makes strict parsers reject the feed), `pubDate` reads like `Thu, 30 Jul 2026 09:00:00 +0900`, and the description is the front matter `description`, not truncated body text.

- [ ] **Step 6: Commit**

```bash
git add blog/feed.xml script/check-build.sh
git commit -m "feat: add RSS 2.0 feed at /blog/feed.xml

Hand-written rather than jekyll-feed: the mails app contract calls for
RSS pubDate (jekyll-feed emits Atom), and the URL must stay frozen."
```

---

### Task 6: Sitemap includes the blog; fix the robots.txt sitemap URL

`sitemap.xml` becomes a Liquid template so posts are listed automatically. `jekyll-sitemap` is deliberately not used: it would emit `/contact-us/index.html`-style URLs for the existing static pages instead of the clean directory URLs already published, and it refuses to run at all when a `sitemap.xml` already exists.

Also fixes two pre-existing bugs found while reading these files:
1. `robots.txt` points at `https://thekinng96.github.io/illumenza-HP/sitemap.xml` — a URL that is not this site. Search engines following it get the wrong host.
2. The homepage entry carries `hreflang` alternates pointing at `thekinng96.github.io`, declaring a different host as the en/ja alternate of `illumenza.dev`. Remove them.

**Files:**
- Modify: `sitemap.xml` (whole-file rewrite)
- Modify: `robots.txt`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `site.posts`, `site.url`, `site.tags`.
- Produces: `/sitemap.xml` listing static pages plus every post and the tag page. Static-page entries are a hand-written list — there is no automatic page discovery, so **a new non-post page must be added to `sitemap.xml` by hand.** Post entries are looped from `site.posts` and need no maintenance.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== sitemap + robots =="
SM=_site/sitemap.xml
check_file "$SM"
check_contains "$SM" "<loc>https://illumenza.dev/</loc>"
check_contains "$SM" "<loc>https://illumenza.dev/blog/</loc>"
check_contains "$SM" "<loc>https://illumenza.dev/blog/colorme-points-5-decisions/</loc>"
check_contains "$SM" "<loc>https://illumenza.dev/blog/tags/</loc>"
check_contains "$SM" "<loc>https://illumenza.dev/contact-us/</loc>"
check_contains "$SM" "<loc>https://illumenza.dev/points/contact-us/</loc>"
# Feed is not a page; must not appear. Neither should the wrong host.
check_absent "$SM" "feed.xml"
check_absent "$SM" "thekinng96.github.io"
check_absent "$SM" "layout:"
if python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('$SM')" 2>/dev/null; then
  pass "$SM is well-formed XML"
else
  fail "$SM is NOT well-formed XML"
fi
check_contains _site/robots.txt "Sitemap: https://illumenza.dev/sitemap.xml"
check_absent _site/robots.txt "thekinng96.github.io"
check_contains _site/robots.txt "Allow: /"

# ---- Blog checks below are added by later tasks ----
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `_site/sitemap.xml missing: <loc>https://illumenza.dev/blog/</loc>` and `_site/robots.txt unexpectedly contains: thekinng96.github.io`.

- [ ] **Step 3: Write the minimal implementation**

Replace the entire contents of `sitemap.xml`:

```xml
---
layout: null
---
<?xml version="1.0" encoding="UTF-8"?>
<!--
  Hand-maintained for static pages, generated for blog posts.
  jekyll-sitemap is not used: it emits /path/index.html for the existing
  static HTML pages instead of the clean directory URLs already indexed.
  When adding a new static page, add it to the list below.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{{ '/' | absolute_url }}</loc>
    <lastmod>2025-07-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>{{ '/blog/' | absolute_url }}</loc>
    {%- if site.posts.first %}
    <lastmod>{{ site.posts.first.date | date: '%Y-%m-%d' }}</lastmod>
    {%- endif %}
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  {%- for post in site.posts %}
  <url>
    <loc>{{ post.url | absolute_url }}</loc>
    <lastmod>{{ post.date | date: '%Y-%m-%d' }}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  {%- endfor %}
  {%- if site.tags.size > 0 %}
  <url>
    <loc>{{ '/blog/tags/' | absolute_url }}</loc>
    {%- if site.posts.first %}
    <lastmod>{{ site.posts.first.date | date: '%Y-%m-%d' }}</lastmod>
    {%- endif %}
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  {%- endif %}
  <url>
    <loc>{{ '/contact-us/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{{ '/coupon/contact-us/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{{ '/coupon/uninstall/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>{{ '/mostra/contact-us/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{{ '/points/contact-us/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{{ '/privacy/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>{{ '/tokushoho/' | absolute_url }}</loc>
    <lastmod>2026-06-19</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```

Replace the entire contents of `robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://illumenza.dev/sitemap.xml
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`. The `/blog/tags/` entry passes now because `site.tags` is non-empty (the Task 3 post has tags), even though the tag page itself lands in Task 7 — build and commit that task before deploying, or the sitemap advertises a 404.

- [ ] **Step 5: Commit**

```bash
git add sitemap.xml robots.txt script/check-build.sh
git commit -m "feat: generate blog URLs into sitemap; fix robots sitemap host

robots.txt advertised thekinng96.github.io/illumenza-HP/sitemap.xml,
which is not this site. Also drops hreflang alternates that declared
the github.io host as an alternate of illumenza.dev."
```

---

### Task 7: Tag index page

One page grouping every post by tag, with anchors the post/list pages already link to (`/blog/tags/#<slugified-tag>`). No plugin needed — `site.tags` is built in.

**Files:**
- Create: `blog/tags/index.html`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `site.tags` (map of tag name → posts), `_layouts/default.html`.
- Produces: `/blog/tags/` with an `id="<tag | slugify>"` anchor per tag. The slugify filter must match the one used in `_layouts/post.html` and `blog/index.html` — all three use `{{ tag | slugify }}`.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== tag index =="
TAGS=_site/blog/tags/index.html
check_file "$TAGS"
check_contains "$TAGS" "ポイント制度"
check_contains "$TAGS" "ロイヤルティ"
check_contains "$TAGS" "カラーミーショップ"
check_contains "$TAGS" "colorme-points-5-decisions"
check_contains "$TAGS" 'rel="canonical" href="https://illumenza.dev/blog/tags/"'
# Anchors referenced from post/list pages must exist on this page.
TAG_SLUG=$(grep -o 'id="[^"]*"' "$TAGS" | head -1 || true)
if [ -n "$TAG_SLUG" ]; then pass "tag anchors present ($TAG_SLUG)"; else fail "no id= anchors on tag page"; fi

# ---- Blog checks below are added by later tasks ----
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `missing: _site/blog/tags/index.html`.

- [ ] **Step 3: Write the minimal implementation**

Create `blog/tags/index.html`:

```html
---
layout: default
title: "タグ一覧"
description: "Illumenza ブログの記事をタグ別にまとめています。ポイント制度、ロイヤルティ施策、ECマーケティングなど、関心のあるテーマから記事を探せます。"
---
<div class="container mx-auto max-w-3xl">

  <header class="mb-10 sm:mb-14">
    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">タグ一覧</h1>
    <p class="text-base sm:text-lg text-gray-600">テーマから記事を探せます。</p>
    <p class="mt-4 text-sm"><a href="/blog/" class="text-brand-blue hover:underline">&larr; ブログ一覧に戻る</a></p>
  </header>

  {%- assign tag_names = site.tags | sort %}

  {% if tag_names.size == 0 %}
  <p class="text-gray-600">タグはまだありません。</p>
  {% else %}

  <ul class="flex flex-wrap gap-2 mb-12">
    {% for tag in tag_names %}
    <li>
      <a href="#{{ tag[0] | slugify }}" class="inline-block px-3 py-1.5 text-sm bg-brand-light text-brand-blue rounded-full hover:bg-brand-blue hover:text-white transition-colors">
        {{ tag[0] }} <span class="text-xs opacity-70">({{ tag[1].size }})</span>
      </a>
    </li>
    {% endfor %}
  </ul>

  {% for tag in tag_names %}
  <section id="{{ tag[0] | slugify }}" class="mb-12 scroll-mt-24">
    <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-5 pb-2 border-b border-gray-200">
      {{ tag[0] }} <span class="text-sm font-normal text-gray-500">{{ tag[1].size }}件</span>
    </h2>
    <ul class="space-y-4">
      {% for post in tag[1] %}
      <li>
        <p class="text-xs text-gray-500 mb-1">
          <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y年%-m月%-d日' }}</time>
        </p>
        <a href="{{ post.url }}" class="text-base sm:text-lg font-medium text-gray-900 hover:text-brand-blue transition-colors">{{ post.title }}</a>
      </li>
      {% endfor %}
    </ul>
  </section>
  {% endfor %}

  {% endif %}

</div>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Verify the anchors actually resolve**

Jekyll's default `slugify` mode keeps Unicode letters, so `ポイント制度` should survive as-is. Verify rather than assume — a collapsed slug produces a dangling `#` anchor that silently does nothing:

```bash
bundle exec jekyll build
# Anchors the post page links to:
grep -o 'href="/blog/tags/#[^"]*"' _site/blog/colorme-points-5-decisions/index.html | sort -u
# Anchors the tag page defines:
grep -o 'id="[^"]*"' _site/blog/tags/index.html | sort -u
```

Every `#x` in the first list must appear as `id="x"` in the second, and none may be empty (`href="/blog/tags/#"`).

If they *are* empty, `slugify` stripped the Japanese. Fix by keying anchors off the tag's position instead of its text — in `blog/tags/index.html` change `id="{{ tag[0] | slugify }}"` to `id="tag-{{ forloop.index }}"`, and in **both** `_layouts/post.html` and `blog/index.html` replace the `<a href="/blog/tags/#{{ tag | slugify }}">` with a plain `<a href="/blog/tags/">` (a post has no way to know a tag's index on the tag page). Do not ship dangling `#` anchors.

- [ ] **Step 6: Commit**

```bash
git add blog/tags script/check-build.sh
git commit -m "feat: add blog tag index page with per-tag anchors"
```

---

### Task 8: Link the blog from the homepage

Two link insertions. This is the only permitted edit to `index.html`, and it must not add front matter.

**Files:**
- Modify: `index.html` (nav block around line 180-188; footer links block around line 415-423)
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: `/blog/` from Task 4.
- Produces: nothing consumed downstream.

**Careful:** `script/check-build.sh` asserts `index.html` and `_site/index.html` are identical. That still holds after this edit — the file has no front matter, so Jekyll copies the edited file through verbatim. If that check starts failing, front matter was added by mistake.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, replacing `# ---- Blog checks below are added by later tasks ----`:

```bash
echo "== homepage links to blog =="
check_contains _site/index.html 'href="/blog/"'
# The homepage must stay bilingual and front-matter-free.
check_contains _site/index.html 'lang-jp'
if head -1 index.html | grep -qF '<!DOCTYPE html>'; then
  pass "index.html has no front matter"
else
  fail "index.html gained front matter — Jekyll will now render it through Liquid"
fi
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `_site/index.html missing: href="/blog/"`.

- [ ] **Step 3: Write the minimal implementation**

In `index.html`, find the nav block:

```html
        <div class="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
            <img src="images/logo-full.png" alt="Illumenza" class="h-8 sm:h-10">
            <button id="lang-toggle" class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-brand-light text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-colors">
```

Replace with (wraps the existing button in a flex row and adds the blog link before it — the button and its contents are unchanged):

```html
        <div class="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
            <img src="images/logo-full.png" alt="Illumenza" class="h-8 sm:h-10">
            <div class="flex items-center gap-3 sm:gap-4">
            <a href="/blog/" class="text-xs sm:text-sm font-medium text-gray-700 hover:text-brand-blue transition-colors">
                <span class="lang-en">Blog</span>
                <span class="lang-jp">ブログ</span>
            </a>
            <button id="lang-toggle" class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-brand-light text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-colors">
```

Then close the new wrapper: find the `</button>` that ends that nav button and the `</div>` after it:

```html
            </button>
        </div>
    </nav>
```

Replace with:

```html
            </button>
            </div>
        </div>
    </nav>
```

In the footer links row, find:

```html
                <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
                    <a href="/privacy/" class="hover:text-white transition-colors">
```

Replace with:

```html
                <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
                    <a href="/blog/" class="hover:text-white transition-colors">
                        <span class="lang-jp">ブログ</span>
                        <span class="lang-en">Blog</span>
                    </a>
                    <a href="/privacy/" class="hover:text-white transition-colors">
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`, including `unchanged: index.html`.

- [ ] **Step 5: Check the nav visually — the wrapper div can break the layout**

```bash
bundle exec jekyll serve --port 4000
```

Open `http://localhost:4000/`. Confirm the nav still has the logo left, and blog link + language button right, on both a wide window and a narrow one (~375px). Click the language toggle and confirm the blog link switches ja/en. `Ctrl-C` when done.

- [ ] **Step 6: Commit**

```bash
git add index.html script/check-build.sh
git commit -m "feat: link blog from homepage nav and footer"
```

---

### Task 9: Authoring pipeline — docs, topic backlog, and slash command

The blog is written one post per day by an agent. This task makes that repeatable: the rules live in the repo, not in a chat transcript.

**Files:**
- Create: `docs/blog-authoring.md`
- Create: `docs/blog-topics.md`
- Create: `.claude/commands/blog-post.md`
- Test: `script/check-build.sh` (extend)

**Interfaces:**
- Consumes: the front matter contract from Task 2, the filename convention from the Global Constraints.
- Produces: `/blog-post <topic>` slash command in this repo.

- [ ] **Step 1: Write the failing test**

Add to `script/check-build.sh`, at the end of the blog checks (before the final `if [ "$failures" -eq 0 ]` block):

```bash
echo "== authoring pipeline docs =="
check_file docs/blog-authoring.md
check_file docs/blog-topics.md
check_file .claude/commands/blog-post.md
# The forbidden-content rule must be stated in both the doc and the command.
check_contains docs/blog-authoring.md "導入事例"
check_contains .claude/commands/blog-post.md "導入事例"
check_contains .claude/commands/blog-post.md "points.illumenza.dev"
check_contains docs/blog-authoring.md "/blog/feed.xml"
# docs/ and .claude/ are excluded from the build.
for leaked in _site/docs _site/.claude; do
  if [ -e "$leaked" ]; then fail "leaked into _site: $leaked"; else pass "not in _site: $leaked"; fi
done
```

- [ ] **Step 2: Run it to verify it fails**

```bash
script/check-build.sh
```

Expected: FAIL — `missing: docs/blog-authoring.md`.

- [ ] **Step 3: Write the docs**

Create `docs/blog-authoring.md`:

```markdown
# Blog authoring guide

The blog lives at `illumenza.dev/blog/`. Source is markdown in `_posts/`,
built by GitHub Pages' Jekyll on every push to the default branch. There is no
CMS and no database — git history is the edit log.

## Cadence and workflow

One post per day, written by an agent:

1. Pick a topic (see `docs/blog-topics.md`; delete the line you use).
2. Write `_posts/YYYY-MM-DD-<ascii-kebab-slug>.md` with complete front matter.
3. Run `script/check-build.sh` — it must print `ALL CHECKS PASSED`.
4. Commit and push. GitHub Pages publishes within a couple of minutes.

Use `/blog-post <topic>` in Claude Code to do all of this in one shot.

## Front matter contract

```yaml
---
title: "記事タイトル（30〜45文字を目安に）"
date: 2026-07-30 09:00:00 +0900
tags: [ポイント制度, ロイヤルティ]
description: "検索結果とメール配信に出る要約。70〜110文字。記事の結論を含める。"
ogImage: /images/points.webp
---
```

| Key | Required | Notes |
| --- | --- | --- |
| `title` | yes | Becomes `<h1>` and `<title>`. Do not repeat it as a heading in the body. |
| `date` | yes | Include `+0900`. Must match the filename date. Future dates are not published (`future: false`). |
| `tags` | yes | Japanese tags. Reuse existing ones — check `/blog/tags/` before inventing new. |
| `description` | yes | Used verbatim as the meta description, the OG description, and the RSS `<description>` the Mails app reads. Not optional. |
| `ogImage` | no | Root-relative path. Defaults to `/images/logo-full.png`. Use `/images/points.webp` for points-app topics. |

`layout` is set automatically by `_config.yml`. Do not set it per post.

Filename slug is ASCII kebab-case, not Japanese — it becomes the URL
(`_posts/2026-07-30-points-expiry-basics.md` → `/blog/points-expiry-basics/`).

## Content rules

**Never write these — absolute:**

- 導入事例, お客様の声, testimonials, case studies, customer quotes
- Any store, named or anonymous, presented as a real user
- Invented numbers attributed to real shops

There are no clients yet. Fabricating social proof is prohibited. Use
mechanics, arithmetic worked examples, screenshots, and how-to steps instead.
Neutral illustrative arithmetic ("粗利率30%のショップで1%還元の場合") is fine —
it is a calculation, not a claimed customer.

**Style:**

- Japanese, polite 敬体 (です/ます). Never だ/である.
- Audience: ColorMe (カラーミーショップ) store owners. Mostly non-technical,
  cannot edit DNS, run small shops. Gloss any technical term on first use.
- Match the homepage's calm, explanatory tone. No hype, no exclamation marks.
- 1,200–2,500 Japanese characters. Long enough to answer the question fully.
- Structure with `##` headings. Start at `##`, never `#` (the title is the h1).
- Tables and numbered lists are encouraged; they survive translation to email.
- Do not write a CTA — the post layout appends the points.illumenza.dev CTA
  automatically. A second CTA in the body is duplication.
- Do not add UTM parameters to any link. The Mails app appends them.

## What is generated for you

Do not hand-maintain these; they update from `site.posts` on build:

- `/blog/` — paginated list, 10 per page
- `/blog/page2/`, `/blog/page3/`… — later pages
- `/blog/tags/` — tag index with `#<slug>` anchors
- `/blog/feed.xml` — **RSS 2.0. Frozen URL.** The Illumenza Mails app polls this
  to draft biweekly digests. Never rename it, never drop `title`, `link`,
  `description`, or `pubDate` from an item.
- `/sitemap.xml` — posts are looped in. **New static (non-post) pages must be
  added to the hand-written list in `sitemap.xml` manually.**

## Local preview

```bash
bundle install --path vendor/bundle   # first time only
bundle exec jekyll serve --port 4000
# http://localhost:4000/blog/
```

If `bundle install` fails building a native gem, install a newer Ruby
(`mise use ruby@3.3`) and retry.

## Verification

`script/check-build.sh` builds the site and asserts on `_site/`. It checks that
every existing static page is byte-identical after the build, that the feed and
sitemap are well-formed XML, that the CTA is present, and that no forbidden
vocabulary or UTM parameter slipped in. Run it before every push.
```

Create `docs/blog-topics.md`:

```markdown
# Blog topic backlog

Pick from the top, delete the line you use, add new ideas at the bottom.
Every topic must be answerable without referencing a real customer.

## Points app how-to (ogImage: /images/points.webp)

- ミッション機能で「レビュー投稿」にポイントを付ける設定手順
- 会員ランクの区切り方 — 累計購入額のしきい値をどう決めるか
- 友達紹介の付与額を、紹介した側と された側でどう配分するか
- 誕生日ポイントの付与タイミングと、有効期限の合わせ方
- ポイント交換（redemption）の単位設計 — 1ポイント1円以外の選択肢
- ポイント失効通知のタイミング設定（30日前・7日前の2段構え）
- ポイント制度の規約ページに書くべき項目チェックリスト

## Loyalty / points education

- リピート率とポイント還元率の関係を、粗利から逆算する
- ポイント制度とクーポンの使い分け — 新規獲得か、再訪促進か
- 「ポイント原資」を会計上どう扱うか（引当の考え方の入口）
- 有効期限あり／なしのメリットとデメリット
- ポイント制度をやめる／変更するときの告知の作法

## EC marketing (ColorMe ecosystem)

- カラーミーショップで会員登録率を上げる導線の作り方
- メールマガジンとポイント制度を組み合わせる基本
- 商品レビューを集めるための無理のない依頼タイミング
- 送料無料ラインの決め方 — 平均注文額から考える
- カゴ落ち対策の基本 — 小規模ショップができる範囲

## Seasonal (write 3–4 weeks ahead of the event)

- 年末年始セールのポイント施策設計
- 母の日・父の日ギフト需要とポイント倍率キャンペーン
- 夏のセール期間中のポイント原資管理
- ブラックフライデー／サイバーマンデーを小規模ショップがどう扱うか
- 新年度（4月）の新規顧客をリピーターに変える初動
```

Create `.claude/commands/blog-post.md`:

```markdown
---
description: Write and publish one Illumenza blog post
---

Write one blog post for illumenza.dev/blog/ on this topic: $ARGUMENTS

If no topic was given, read `docs/blog-topics.md` and pick the first topic
that is not already covered by an existing file in `_posts/`.

Read `docs/blog-authoring.md` first and follow it exactly. Then:

1. Create `_posts/<today YYYY-MM-DD>-<ascii-kebab-slug>.md`. Get today's date
   from `date +%Y-%m-%d` — do not guess it. The date in the front matter must
   match the filename and end with `+0900`.
2. Fill every front matter key: `title`, `date`, `tags`, `description`,
   `ogImage`. Reuse existing tags — check `_posts/` for what is already in use
   rather than inventing near-duplicates.
3. Write 1,200–2,500 Japanese characters, polite 敬体, headings starting at
   `##`. Audience is カラーミーショップ store owners who are not technical.

ABSOLUTE CONTENT RULES:
- Never write 導入事例, お客様の声, testimonials, case studies, customer
  quotes, or any store presented as a real user. There are no clients yet;
  fabricating social proof is prohibited. Use mechanics, worked arithmetic,
  and how-to steps instead.
- Do not write a CTA. `_layouts/post.html` appends the
  https://points.illumenza.dev CTA to every post automatically.
- Do not put UTM parameters in any link.

4. Run `script/check-build.sh`. It must print `ALL CHECKS PASSED`. Fix anything
   it reports; do not proceed past a failure.
5. Remove the topic's line from `docs/blog-topics.md`.
6. Commit `_posts/<file>` and `docs/blog-topics.md` with
   `content: add blog post on <short topic>`, then push.

Report the published URL (`https://illumenza.dev/blog/<slug>/`) and note that
GitHub Pages takes a couple of minutes to build.
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
script/check-build.sh
```

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add docs/blog-authoring.md docs/blog-topics.md .claude/commands/blog-post.md script/check-build.sh
git commit -m "docs: add blog authoring guide, topic backlog and /blog-post command"
```

---

## Deploy verification

After the last task is merged and pushed, verify against the live site — a local build passing does not prove GitHub Pages built the same thing. GitHub Pages' Jekyll build failures arrive as an email and appear under the repo's Actions tab; check there first if anything below 404s.

- [ ] `curl -sS -o /dev/null -w '%{http_code}\n' https://illumenza.dev/blog/` → `200`
- [ ] `curl -sS -o /dev/null -w '%{http_code}\n' https://illumenza.dev/blog/colorme-points-5-decisions/` → `200`
- [ ] `curl -sS https://illumenza.dev/blog/feed.xml | head -20` → RSS 2.0 with one `<item>` and a `<pubDate>`
- [ ] `curl -sS https://illumenza.dev/sitemap.xml | grep -c '<loc>'` → 12 or more
- [ ] `curl -sS https://illumenza.dev/robots.txt` → sitemap line points at `illumenza.dev`
- [ ] `curl -sS -o /dev/null -w '%{http_code}\n' https://illumenza.dev/blog/tags/` → `200`
- [ ] Existing pages still live: `https://illumenza.dev/`, `/contact-us/`, `/points/contact-us/`, `/privacy/` all `200`, and the contact forms still submit (they are pure client-side JS posting to Discord — the build must not have touched `js/forms-config.js` or `js/form-renderer.js`)
- [ ] Paste a post URL into a Discord message and confirm the OG preview shows title, description, and image
- [ ] Submit the feed URL and sitemap to Google Search Console

---

## Known gaps, deliberately out of scope

Recorded so they are not mistaken for oversights:

- **`assets/og-image.png` referenced by `index.html` does not exist** in the repo (pre-existing; homepage OG previews have no image). Not fixed here — it is a homepage bug unrelated to the blog. Blog pages default to `/images/logo-full.png`, which does exist.
- **`index.html` structured data and OG tags still point at `thekinng96.github.io/illumenza-HP/`** rather than `illumenza.dev`. Pre-existing; out of scope to avoid touching the homepage beyond the two link insertions in Task 8. Worth a separate cleanup pass.
- **Existing pages are not converted to Jekyll layouts.** The nav and footer are now duplicated between `index.html` and `_layouts/default.html`. Converting them would mean adding front matter to existing pages, which the Global Constraints forbid for this change. A later dedicated task can do it with the byte-identical check relaxed deliberately.
- **The blog is Japanese-only.** No `lang-en` variants for posts; the homepage language toggle does not apply to blog pages.
- **No related-posts section.** Previous/next links only.
- **Mails app integration is not built** — this plan only guarantees the feed exists and its URL and fields are stable.
