# Blog authoring guide

The blog lives at `illumenza.dev/blog/`. Source is markdown in `_posts/`,
built by GitHub Pages' Jekyll on every push to the default branch. There is no
CMS and no database — git history is the edit log.

## Cadence and workflow

One post per day, written by an agent:

1. Pick a topic from the `topics/` directory of the `illumenza-brain` vault and
   set that note's `status` to `drafting`. **Never delete the note** — it is the
   record of the article, and gains `post_url` when the post goes live.
2. Write `_posts/YYYY-MM-DD-<ascii-kebab-slug>.md` with complete front matter.
3. Run `make check` — it must print `ALL CHECKS PASSED`.
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
| `tags` | yes | Japanese tags. Reuse existing ones — check `/blog/tags/` (or `_posts/`) before inventing new. English/Latin-script tags must use one consistent casing (lowercase) — `slugify` lowercases the anchor id on `/blog/tags/`, so `Points` and `points` collide into the same `id="points"`, producing a duplicate section that no link can reach. Japanese tags are unaffected by this. |
| `description` | yes | Used verbatim as the meta description, the OG description, and the RSS `<description>` the Mails app reads. Not optional. |
| `ogImage` | no | Root-relative path. Defaults to `/images/logo-full.png`. Use `/images/points.webp` for points-app topics. Social-card only — never reused as the list thumbnail. |
| `heroImage` | no | Wide image shown above the body. Requires `heroAlt`. |
| `heroAlt` | with `heroImage` | Describes what the image shows, for screen readers and when it fails to load. A hero carries meaning, so this is not optional. |
| `heroCaption` | no | Caption under the hero. |
| `thumbnail` | no | Square-ish image for the `/blog/` list card. Falls back to `heroImage`. |
| `app` | yes | Which product the post is about — `points`, `coupon`, `mostra`, or `none`. Reserved for future filter pages. |
| `section` | yes | Which part of the app. Must be a key in `_data/sections.yml`: `getting-started`, `missions`, `redemption`, `ranks`, `referral`. Drives prev/next and, later, filtering. |

`layout` is set automatically by `_config.yml`'s `defaults:` block (scope:
`type: posts` → `layout: post`). Do not set it per post.

Filename slug is ASCII kebab-case, not Japanese — it becomes the URL via
`_config.yml`'s `permalink: /blog/:title/`
(`_posts/2026-07-30-points-expiry-basics.md` → `/blog/points-expiry-basics/`).

## Sections

Every post declares a `section`, defined in `_data/sections.yml`. Two things
depend on it:

**Prev/next navigation.** `_layouts/post.html` links to the previous and next
post *within the same section*, not the whole blog. Chronological neighbours
are useless here — posts have been published in bulk, so date order jumps
between unrelated subjects. A section with only one post falls back to a link
to the article guide.

**Future filtering.** The plan is filter pages such as `/blog/points/redemption/`.
`app` plus `section` is the pair those pages will group by, which is why both
are required now — retrofitting them across every post later is the expensive
part.

Adding a section means adding a key to `_data/sections.yml` with a `label` and
an `order`, then using that key in a post's front matter. `script/check-build.sh`
fails the build if a post has no `section`, or if its navigation points at a
post in a different one.

## Images

**Add an image only when it does work the text cannot** — a settings screen
the reader has to find, a step that is hard to describe in words, data worth
seeing. Do not add decorative or stock imagery to make a post look finished; a
text-only post is a perfectly good post here, and the list card is designed to
read well without a thumbnail.

Store images under `images/blog/<post-slug>/`, so an article's assets sit
together and are obvious to delete with it.

Inline images in the body use a figure with a caption:

```markdown
<figure>
  <img src="/images/blog/points-expiry-basics/expiry-setting.png"
       alt="ポイント有効期限の設定画面。「最終利用日から12か月」を選択した状態。"
       loading="lazy" decoding="async">
  <figcaption>有効期限は「最終利用日から延長」を選ぶと、購入のたびに期限が延びます。</figcaption>
</figure>
```

Rules:

- **`alt` is required and must describe what the image shows**, not restate the
  caption. A reader who cannot see it should still follow the article.
- Add `loading="lazy" decoding="async"` to inline images so they do not block
  first paint. The hero is exempt — it is above the fold.
- Prefer PNG for UI screenshots, WebP for photographs.
- Crop screenshots to the relevant area. A full-desktop screenshot shrunk to
  article width is unreadable on a phone.
- Never include a real customer's shop name, logo, or data in a screenshot —
  the same rule as the content rules below. Use your own test shop.

**If a screenshot would genuinely help but does not exist, say so in your
report rather than substituting a stand-in.** You cannot take screenshots of
the Points admin UI yourself, and a placeholder image is worse than none.

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
- Do not write a CTA — `_layouts/post.html` appends the points.illumenza.dev
  CTA automatically. A second CTA in the body is duplication.
- Do not add UTM parameters to any link. The Mails app appends them.

## What is generated for you

Do not hand-maintain these; they update from `site.posts` on build:

- `/blog/` — paginated list, 10 per page (`_config.yml`'s `paginate: 10`)
- `/blog/page2/`, `/blog/page3/`… — later pages
- `/blog/tags/` — tag index with `#<slug>` anchors
- `/blog/feed.xml` — **RSS 2.0. Frozen URL.** The Illumenza Mails app polls this
  to draft biweekly digests. Never rename it, never drop `title`, `link`,
  `description`, or `pubDate` from an item.
- `/sitemap.xml` — posts are looped in. **New static (non-post) pages must be
  added to the hand-written list in `sitemap.xml` manually.**

## Local preview

Ruby 3.x is required — the macOS system Ruby (2.6) cannot build this gemset
(the `ffi` native extension needs Ruby >= 3.0). `mise.toml` pins `ruby = "3.3"`.

```bash
make setup    # first time only (or after Gemfile changes)
make serve    # http://localhost:4000/blog/ — live reload
```

`make` on its own lists every target. Others worth knowing: `make check` runs
the full build gate, `make drafts` also renders future-dated posts, and
`make clean` clears `_site/` and the caches. Override the port with
`make serve PORT=4321`.

The Makefile just wraps these, if you'd rather run them directly:

```bash
mise install                            # installs Ruby 3.3
bundle config set path 'vendor/bundle'
bundle install
bundle exec jekyll serve --port 4000
```

`bundle install --path` was removed in Bundler 4 (this repo's
`Gemfile.lock` pins Bundler 4.0.17) — use `bundle config set path` instead, as
above.

## Verification

`make check` builds the site and asserts on `_site/`. It checks that every
existing static page is byte-identical after the build, that the feed and
sitemap are well-formed XML, that the CTA is present, and that no forbidden
vocabulary or UTM parameter slipped in. Run it before every push.

Use `make check`, not `script/check-build.sh` directly. Run bare, the script
picks up the macOS system Ruby (2.6) and dies with
`Could not find 'bundler' (4.0.17)` before running a single assertion. The
Makefile wraps it in `mise exec --` so it gets Ruby 3.3.
