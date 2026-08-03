# Cover image prompts

One prompt per published article, 44 in total.

Today every post carries `ogImage: /images/points.webp` or `/images/coupon.png`,
so all 26 Points articles share one social card and all 18 Coupon articles share
another. The list page shows no card image at all, because it reads `thumbnail`
then `heroImage` and no post sets either. These prompts exist to fix both.

## What to generate

**One 1200×630 render per article.** The square thumbnail is cropped from it, so
there is one generation per article rather than two.

Every subject below is written to sit **dead centre**, inside the middle
630×630 of the frame, with the left and right thirds left as quiet ground. That
is what makes the centre crop work. If you change a subject, keep that rule.

```
images/blog/<slug>/cover.webp         1200×630 — ogImage
images/blog/<slug>/cover-square.webp   800×800 — thumbnail
```

`images/blog/<slug>/` already exists for the articles that carry screenshots;
create it for the rest.

### Deriving the square and converting

```sh
# from a generated cover.png, in the article's image folder
magick cover.png -gravity center -crop 630x630+0+0 +repage \
       -resize 800x800 cover-square.png
cwebp -lossless -z 9 cover.png        -o cover.webp
cwebp -lossless -z 9 cover-square.png -o cover-square.webp
rm cover.png cover-square.png
```

Lossless because these are flat vector-style illustrations — large areas of
single colour, which is the case WebP lossless handles best. Check the result;
if a file lands over ~150 KB, `cwebp -q 90` will be far smaller and visually
identical on this kind of art.

### Front matter

```yaml
ogImage: /images/blog/<slug>/cover.webp
thumbnail: /images/blog/<slug>/cover-square.webp
```

**Deliberately not `heroImage`.** That would put the illustration at the top of
every article, pushing the first paragraph below the fold on a phone, on pages
that were just stripped back to a plain white reading surface. `heroImage` stays
available if you want it on a specific article; if you use it, set `heroAlt` too
rather than letting it fall back to the title, which only repeats the `<h1>` to
a screen reader.

## The style block

Paste this ahead of every subject line, unchanged. Consistency across 44 covers
comes from this block being identical every time.

> Flat vector editorial illustration, minimal and calm. Near-white background
> (#F7F9FC). One accent colour only: brand blue #0066CC, supported by pale blue
> fills (#E6F2FF) and muted slate grey. Thin uniform strokes, gentle rounded
> geometry, soft long shadows, no gradients beyond a single subtle tint. Generous
> negative space; the subject occupies the centre square of the frame with the
> left and right thirds left quiet. Composed for a 1200×630 frame that will also
> be centre-cropped to a square. Soft, even lighting. No text of any kind.

### Negative prompt

> text, letters, words, numbers, kanji, kana, captions, watermarks, logos,
> brand marks, UI screenshots, realistic dashboards, browser chrome, photographs,
> photorealism, 3D render, human faces, hands, busy detail, clutter, heavy
> drop shadows, neon, dark background

**No text, in any language.** Image models garble Japanese, and a cover with
malformed kana is worse than a cover with none. **No realistic admin UI** either
— a rendered fake screen would read as a screenshot of the product, and the
articles carry real screenshots inside them. Keep the visuals abstract.

---

## Points — 26

### はじめる前に

| Slug | Subject |
| --- | --- |
| `colorme-points-5-decisions` | Five smooth discs arranged in a shallow arc on a clean surface, each a slightly different tint of blue, the fifth still hovering just above its place — a set of decisions being made in order before anything starts. |

### ポイントの貯め方

| Slug | Subject |
| --- | --- |
| `points-mission-types-basics` | A single coin at the centre with five slender paths converging into it from different directions; only one of those paths begins at a shopping bag. |
| `points-mission-audience` | A wide funnel narrowing to a small cluster of simple rounded figures, while the remaining figures drift past outside the funnel's mouth. |
| `points-mission-completion-mode` | A path forking in two: one branch runs straight to a coin, the other passes through a small gate stamped with a check mark before reaching it. |

### ポイントの使い方

| Slug | Subject |
| --- | --- |
| `points-redemption-design` | A balance scale, a loose pile of coins on one pan and a small gift box on the other, tipping only slightly toward the box. |
| `points-coupon-types` | Three ticket shapes side by side — one a plain solid rectangle, one cut through by a diagonal wedge, one carrying a small delivery box. |
| `points-coupon-issuance` | A single ticket emerging from a narrow slot with a distinctive perforated edge, a small padlock clicking shut behind it. |
| `points-shop-point-rate` | Two stacks of coins of unequal height joined by a curved conversion arrow, with a faint warning ring where the two stacks overlap. |
| `points-product-exchange` | A coin travelling along an arrow and resolving into a single boxed product, with a small ticket taped to that box and no other. |
| `points-product-exchange-pricing` | A price tag hanging from a product with a clock face overlapping it, the tag's value drawn as a shifting bar rather than a figure. |
| `points-custom-reward-ideas` | A small hand-wrapped parcel raised on a low pedestal and lit, beside a flat stack of identical, unremarkable discount tickets. |
| `points-custom-reward-flow` | A coin suspended inside a translucent frozen block, with an arrow leading from it to a speech bubble and on to a check mark. |

### 会員ランク

| Slug | Subject |
| --- | --- |
| `points-rank-period` | Three concentric rings resting on a faint grid, each ring a different span, the middle one picked out in the accent colour. |
| `points-rank-based-rate` | A staircase of three platforms with a conversion arrow rising from each; the arrow on the top step is noticeably steeper. |

### 友達紹介

| Slug | Subject |
| --- | --- |
| `points-referral-timing` | Two linked rounded figures with a coin suspended in the space between them, held back by three sequential gates. |

### 日々の運用

| Slug | Subject |
| --- | --- |
| `points-approvals-queue` | A single shallow tray holding three differently shaped slips, one of them being lifted clear off the top. |
| `points-activity-log` | A vertical ribbon of timeline with small markers down its length, a simple lens hovering over one segment. |
| `points-member-detail` | One card in sharp focus with small stat chips arranged around it; two of those chips are ringed in a warning tone. |
| `points-member-list-csv` | A row of identical cards fading in opacity from left to right, the faintest few gathered inside a soft circle. |

### 表示設定

| Slug | Subject |
| --- | --- |
| `points-panel-items` | A vertical panel of stacked rounded blocks with one block lifted out of the stack by a drag handle. |
| `points-panel-visitor` | Two tabs above a single panel outline — the left tab marked with an outlined figure, the right with a filled one. |
| `points-trigger-button` | A floating round button near the corner of a phone-shaped outline, with a measured gap drawn between it and the screen edge. |
| `points-nudge-types` | Five cards stacked front to back, only the topmost fully visible, the rest receding and dimming behind it. |
| `points-nudge-copy` | A speech-bubble card with blank slots in its body being filled by small tokens lifted from a tray at its side. |

### 通知メール

| Slug | Subject |
| --- | --- |
| `points-notification-emails` | An envelope splitting into two paths — one leading to a storefront awning, the other to a single rounded figure. |
| `points-email-variables` | An envelope with three blank chips set into its face, and a small tray of interchangeable tokens beside it. |

## Coupon — 18

### キャンペーン設計

| Slug | Subject |
| --- | --- |
| `coupon-campaign-templates` | Three folder cards fanned out, each carrying one distinct mark — a rising arrow, an envelope, and a returning loop. |
| `coupon-campaign-status` | Four pills spaced along a horizontal rail, the third glowing in the accent colour, a calendar bracket spanning beneath them. |
| `coupon-display-rules` | A page outline with four small dials set at its corners, each dial turned to a different position. |
| `coupon-duplicate` | One settings card with an identical copy sliding out from behind it; three rows on the copy are marked for review. |
| `coupon-thanks-page` | A receipt-shaped page with a prize wheel rising above it while a form panel dissolves away at its side. |

### クーポンと当選確率

| Slug | Subject |
| --- | --- |
| `coupon-win-rate` | An eight-segment wheel seen flat from above, its segments visibly unequal in weight, a neat stack of tickets resting beside it. |

### 不正防止

| Slug | Subject |
| --- | --- |
| `coupon-spin-limits` | Three overlapping filter rings marked with an envelope, a handset and a network node, narrowing a stream of small dots passing through. |
| `coupon-reset-period` | A circular arrow looping around a small calendar disc, with a shopping bag marking one fixed point on the circle. |
| `coupon-limit-messages` | Three speech bubbles of different sizes queued behind a closed barrier. |

### フォームとメッセージ

| Slug | Subject |
| --- | --- |
| `coupon-form-fields` | A form panel showing three fields, with a descending flight of steps receding behind it. |
| `coupon-consent` | A check box beside a ribbon of blank underline, one short stretch of that underline picked out in the accent colour. |
| `coupon-messages` | A wheel at rest with three cards arranged after it — a burst, a muted circle, and a small bell. |
| `coupon-bars` | A wheel with a thin band above it and a thin band below; the lower band carries a small hourglass. |

### 表示設定

| Slug | Subject |
| --- | --- |
| `coupon-themes` | A wheel at centre with eleven small seasonal motifs orbiting it — pine, blossom, fireworks, a pumpkin, a snowflake and others — kept simple and evenly spaced. |
| `coupon-colors` | An eight-segment wheel being painted one segment at a time from a small palette; roughly half the segments are still uncoloured. |

### 参加者データ

| Slug | Subject |
| --- | --- |
| `coupon-csv-export` | A table-shaped page with four arrows leaving it in different directions, one of them terminating at an envelope. |
| `coupon-csv-rows` | A table where several rows repeat the same avatar shape, with a lens gathering those duplicates into one. |

### 数字を読む

| Slug | Subject |
| --- | --- |
| `coupon-metrics` | Four stacked bands descending in a funnel, each band narrower than the one above it. |

---

## Before publishing

Run `make check`. The gate asserts the first post's `og:image` resolves to
`https://illumenza.dev/images/points.webp`; changing that post's `ogImage` will
fail the check until the assertion is updated to match.
