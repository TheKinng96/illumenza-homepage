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

echo
if [ "$failures" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
