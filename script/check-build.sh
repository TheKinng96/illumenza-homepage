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

# Used by blog checks added in later tasks.
# check_absent <file> <fixed-string>
check_absent() {
  if [ ! -f "$1" ]; then fail "missing: $1"; return; fi
  if grep -qF -- "$2" "$1"; then fail "$1 unexpectedly contains: $2"; else pass "$1 free of: $2"; fi
}

# check_no_file <path> — asserts a retired file has not come back.
check_no_file() {
  if [ -e "$1" ]; then fail "should not exist: $1"; else pass "absent: $1"; fi
}

echo "== building =="
bundle exec jekyll build --trace

echo "== existing pages pass through unchanged =="
# index.html is deliberately excluded: it carries front matter so it can list
# recent posts, and is checked separately below. Every other pre-existing page
# has no front matter, so Jekyll must copy it byte-for-byte.
for f in privacy/index.html tokushoho/index.html contact-us/index.html \
         coupon/contact-us/index.html coupon/uninstall/index.html \
         points/contact-us/index.html mostra/contact-us/index.html; do
  if diff -q "$f" "_site/$f" >/dev/null 2>&1; then
    pass "unchanged: $f"
  else
    fail "MODIFIED BY BUILD: $f"
  fi
done

echo "== homepage unchanged outside the blog section =="
# The homepage is Liquid-rendered, so it cannot be byte-identical. Everything
# outside the blog-section markers still must be: strip the front matter and
# the marked region from both sides, then diff the remainder.
strip_dynamic() {
  awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} fm {next} {print}' "$1" \
    | sed '/blog-section:start/,/blog-section:end/d'
}
if diff -q <(strip_dynamic index.html) <(strip_dynamic _site/index.html) >/dev/null 2>&1; then
  pass "index.html unchanged outside the blog section"
else
  fail "index.html CHANGED outside the blog section — Liquid altered static markup"
fi

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
for leaked in _site/Gemfile _site/Gemfile.lock _site/mise.toml _site/README.html _site/docs _site/script; do
  if [ -e "$leaked" ]; then fail "leaked into _site: $leaked"; else pass "not in _site: $leaked"; fi
done

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

echo "== /blog/ list page =="
LIST=_site/blog/index.html
check_file "$LIST"
# The list paginates at 10 per page, so asserting one specific slug appears on
# page 1 only held while fewer than ten posts existed. Assert the page is
# populated instead, and that the oldest post is reachable somewhere in the
# paginated set — which is the property that actually matters.
LIST_POSTS=$(grep -oE 'href="/blog/[a-z0-9-]+/"' "$LIST" | sort -u | wc -l | tr -d ' ')
if [ "$LIST_POSTS" -ge 1 ]; then
  pass "$LIST lists $LIST_POSTS post link(s)"
else
  fail "$LIST rendered no post links"
fi
if grep -rqF -- 'colorme-points-5-decisions' _site/blog/index.html _site/blog/page*/index.html 2>/dev/null; then
  pass "oldest post reachable from a /blog/ page"
else
  fail "oldest post missing from every /blog/ page"
fi
check_contains "$LIST" "ブログ"
check_contains "$LIST" 'rel="canonical" href="https://illumenza.dev/blog/"'
check_contains "$LIST" 'property="og:type" content="website"'
# paginator must be wired up, not just a plain post loop
if grep -qE 'data-paginator="[0-9]+"' "$LIST"; then
  pass "$LIST paginator active"
else
  fail "$LIST paginator inactive (jekyll-paginate did not run — check plugin + filename)"
fi

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

echo "== post navigation (section-scoped) =="
# Every post must declare a section, and its prev/next must stay inside it.
# Chronological neighbours are useless here — posts were published in bulk, so
# date order jumps between unrelated subjects.
nav_fail=0
for src in _posts/*.md; do
  slug=$(basename "$src" .md | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-//')
  sect=$(grep -m1 '^section: ' "$src" | sed 's/^section: //' | tr -d '\r')
  if [ -z "$sect" ]; then fail "$src has no section:"; nav_fail=1; continue; fi
  out="_site/blog/$slug/index.html"
  if [ ! -f "$out" ]; then fail "missing built post: $out"; nav_fail=1; continue; fi
  if ! grep -qF -- 'aria-label="同じテーマの記事"' "$out"; then
    fail "$slug rendered no section nav"; nav_fail=1; continue
  fi
  navhtml=$(awk '/aria-label="同じテーマの記事"/{f=1} f' "$out")
  for target in $(printf '%s' "$navhtml" | grep -oE 'href="/blog/[a-z0-9-]+/"' | sed -E 's|href="/blog/([a-z0-9-]+)/"|\1|' | sort -u); do
    if [ "$target" = "points-guide" ]; then continue; fi
    tsrc=$(ls _posts/*-"$target".md 2>/dev/null | head -1 || true)
    [ -z "$tsrc" ] && { fail "$slug links to unknown post $target"; nav_fail=1; continue; }
    tsect=$(grep -m1 '^section: ' "$tsrc" | sed 's/^section: //' | tr -d '\r')
    if [ "$tsect" != "$sect" ]; then
      fail "$slug ($sect) navigates to $target ($tsect) — nav must stay in section"
      nav_fail=1
    fi
  done
done
if [ "$nav_fail" -eq 0 ]; then pass "every post declares a section and navigates within it"; fi

echo "== section filter pages =="
# Derived from the posts themselves, not from _data/sections.yml: every
# (app, section) pair that actually has posts must have a filter page at
# /blog/<app>/<section>/ listing only those posts. Deriving it from posts means
# adding a section for one app does not demand an empty page for every other.
filter_fail=0
check_file _site/blog/points/index.html
pairs=$(for f in _posts/*.md; do
          a=$(sed -n 's/^app: //p' "$f" | head -1)
          s=$(sed -n 's/^section: //p' "$f" | head -1)
          if [ -n "$a" ] && [ -n "$s" ]; then printf '%s %s\n' "$a" "$s"; fi
        done | sort -u)
while read -r app sect; do
  if [ -z "$app" ]; then continue; fi
  page="_site/blog/$app/$sect/index.html"
  if [ ! -f "$page" ]; then
    fail "missing filter page for $app/$sect: $page"
    filter_fail=1
    continue
  fi
  for target in $(grep -oE 'href="/blog/[a-z0-9-]+/"' "$page" | sed -E 's|href="/blog/([a-z0-9-]+)/"|\1|' | sort -u); do
    tsrc=$(ls _posts/*-"$target".md 2>/dev/null | head -1 || true)
    if [ -z "$tsrc" ]; then continue; fi
    tsect=$(sed -n 's/^section: //p' "$tsrc" | head -1)
    tapp=$(sed -n 's/^app: //p' "$tsrc" | head -1)
    if [ "$tsect" != "$sect" ] || [ "$tapp" != "$app" ]; then
      fail "filter page $app/$sect lists $target ($tapp/$tsect)"
      filter_fail=1
    fi
  done
done <<< "$pairs"
# Points sections are also linked from the article guide.
for sect in $(printf '%s\n' "$pairs" | awk '$1=="points"{print $2}' | sort -u); do
  if ! grep -qF -- "/blog/points/$sect/" blog/points-guide/index.html; then
    fail "article guide does not link to /blog/points/$sect/"
    filter_fail=1
  fi
done
if [ "$filter_fail" -eq 0 ]; then
  pass "every app/section pair with posts has a filter page listing only its own posts"
fi

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
# Filter pages must be in the sitemap. They were silently absent once when a
# Liquid for-loop took a filter inline and rendered nothing.
SM_FILTERS=$(grep -cE '<loc>https://illumenza.dev/blog/(points|coupon)/[a-z-]+/</loc>' "$SM" || true)
if [ "$SM_FILTERS" -ge 1 ]; then
  pass "$SM lists $SM_FILTERS filter page(s)"
else
  fail "$SM lists no filter pages — check the sections loop"
fi
check_contains _site/robots.txt "Sitemap: https://illumenza.dev/sitemap.xml"
check_absent _site/robots.txt "thekinng96.github.io"
check_contains _site/robots.txt "Allow: /"

echo "== tag index =="
TAGS=_site/blog/tags/index.html
check_file "$TAGS"
check_contains "$TAGS" "ポイント制度"
check_contains "$TAGS" "ロイヤルティ"
check_contains "$TAGS" "カラーミーショップ"
check_contains "$TAGS" "colorme-points-5-decisions"
check_contains "$TAGS" 'rel="canonical" href="https://illumenza.dev/blog/tags/"'
# Anchors referenced from post/list pages must exist on this page.
check_contains "$TAGS" 'id="ポイント制度"'
check_contains "$TAGS" 'id="ロイヤルティ"'
check_contains "$TAGS" 'id="カラーミーショップ"'
DUPES=$(grep -oE '<section id="[^"]*"' "$TAGS" | sort | uniq -d)
if [ -z "$DUPES" ]; then pass "no duplicate tag anchor ids"; else fail "duplicate tag anchor ids: $DUPES"; fi

echo "== homepage links to blog =="
check_contains _site/index.html 'href="/blog/"'
# The homepage must stay bilingual.
check_contains _site/index.html 'lang-jp'
# Front matter must stay minimal: `layout: null` only. Any real layout would
# wrap this hand-written document inside another one.
check_contains index.html 'layout: null'
check_absent _site/index.html 'layout: null'
if head -1 index.html | grep -qF -- '---'; then
  pass "index.html front matter present (required to render recent posts)"
else
  fail "index.html lost its front matter — the blog section will not render"
fi

echo "== homepage blog section =="
HOME=_site/index.html
check_contains "$HOME" 'id="blog"'
# The section renders `site.posts limit: 3`, so asserting one specific slug
# only held while that post was among the newest three. Assert the section is
# populated instead — a gate that fails every time you publish is a gate people
# start ignoring.
HOME_POSTS=$(grep -oE 'href="/blog/[a-z0-9-]+/"' "$HOME" | sort -u | wc -l | tr -d ' ')
if [ "$HOME_POSTS" -ge 1 ]; then
  pass "$HOME lists $HOME_POSTS post link(s) in the blog section"
else
  fail "$HOME blog section rendered no post links"
fi
check_contains "$HOME" 'すべての記事を見る'
check_contains "$HOME" 'Read all articles'
# Whole card clickable, same technique as the /blog/ list.
check_contains "$HOME" "after:absolute after:inset-0"
# No unrendered Liquid may reach the published page.
check_absent "$HOME" '{{'
check_absent "$HOME" '{%'
# The pre-existing homepage must survive Liquid rendering intact.
check_contains "$HOME" 'G-PD4WWX28GL'
check_contains "$HOME" 'particle-canvas'
check_contains "$HOME" 'id="products"'
check_contains "$HOME" 'id="contact"'

echo "== blog list design =="
# Footer pinned to the viewport bottom on short pages: body is a full-height
# flex column and main takes the slack.
check_contains "$LIST" 'min-h-screen flex flex-col'
check_contains "$LIST" '<main class="flex-1'
# Whole card clickable: the title link's ::after stretches over the card.
check_contains "$LIST" "after:absolute after:inset-0"
# Tag links must stay above that overlay, or they become unclickable.
check_contains "$LIST" 'relative z-10 flex flex-wrap gap-2'
# Reading time is derived from body length.
check_contains "$LIST" '分で読めます'
check_contains "$POST" '分で読めます'
# Post body supports images: prose styling plus optional hero.
check_contains "$POST" 'prose-img:rounded-lg'
# The list thumbnail must not fall back to ogImage — a wide social card
# square-cropped mangles its subject.
check_absent blog/index.html 'post.ogImage'

# ---- Blog checks below are added by later tasks ----

echo "== authoring pipeline docs =="
check_file docs/blog-authoring.md
check_file .claude/commands/blog-post.md
# The backlog moved to the illumenza-brain vault, where each topic is a note
# carrying status and a link to its published post. Asserting absence rather
# than just deleting it stops the flat list being recreated here and quietly
# becoming a second, diverging source of truth.
check_no_file docs/blog-topics.md
# The forbidden-content rule must be stated in both the doc and the command.
check_contains docs/blog-authoring.md "導入事例"
check_contains .claude/commands/blog-post.md "導入事例"
check_contains .claude/commands/blog-post.md "points.illumenza.dev"
check_contains docs/blog-authoring.md "/blog/feed.xml"
# docs/ and .claude/ are excluded from the build.
for leaked in _site/docs _site/.claude; do
  if [ -e "$leaked" ]; then fail "leaked into _site: $leaked"; else pass "not in _site: $leaked"; fi
done

echo
if [ "$failures" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
