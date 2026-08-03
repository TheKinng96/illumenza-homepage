# Article images — what still needs one

44 articles. This tracks the ones with no image and says, for each, whether a
screenshot is possible or whether a generated illustration is the only option.

Separate from `docs/cover-image-prompts.md`, which covers social/list **cover**
images for all 44. This file is about the **in-body** figure — the thing that
shows a reader what the screen looks like.

Status as of 2026-08-03:

| | Count |
| --- | --- |
| Already has a figure | 17 |
| Screenshot taken today | 6 |
| **Needs a generated image** (section A) | **7** |
| Screenshot possible, currently blocked (section B) | 14 |

---

# A. Needs a generated image — 7

These cannot be screenshotted. Each row gives the **exact path to save to**, so
a returned file can be dropped straight in.

Every prompt takes the shared style block and negative prompt from
`docs/cover-image-prompts.md`. Same visual family; these are wider and simpler
because they sit inside the article rather than on a card.

**Aspect 16:9, landscape.** These render at ~680px wide in the article body.

## A1–A5: the PII wall

Five articles are about screens containing customer names and email addresses.
`CLAUDE.md` excludes customer PII permanently, and masking is not the house
practice — `points-member-list-csv`, `coupon-csv-export` and `coupon-csv-rows`
already ship **zero** figures between them for exactly this reason. A diagram
carries the point without publishing anyone's data.

| # | Article | Save to |
| --- | --- | --- |
| A1 | `points-activity-log` | `images/blog/points-activity-log/diagram.webp` |
| A2 | `points-member-list-csv` | `images/blog/points-member-list-csv/diagram.webp` |
| A3 | `points-member-detail` | `images/blog/points-member-detail/diagram.webp` |
| A4 | `coupon-csv-export` | `images/blog/coupon-csv-export/diagram.webp` |
| A5 | `coupon-csv-rows` | `images/blog/coupon-csv-rows/diagram.webp` |

**A1 — 活動履歴**
> A long vertical ledger ribbon of uniform rows, each row reduced to three
> abstract chips — a type marker, a small coin, and a route marker — with a
> lens hovering over one row and two filter funnels feeding in from the left.
> Rows carry no glyphs that could read as names or text.

**A2 — 会員一覧とCSV**
> A grid of identical member cards, each blank but for a small avatar circle and
> a short activity bar, the bars shortening left to right until the faintest
> cards at the right are enclosed in a soft dashed boundary. A spreadsheet page
> slides out from the grid's edge.

**A3 — 会員1人の画面**
> One card enlarged at centre with six small labelled panels fanned behind it in
> a shallow arc; two of the panels carry a warning ring. The centre card shows
> an avatar circle and two prominent number placeholders drawn as solid bars, no
> readable characters.

**A4 — 参加者CSVの4つの書き出し方**
> A single table-shaped page with four arrows leaving it in four directions —
> one short arrow to a small page icon, one longer arrow to a stack of pages,
> one arrow passing through a funnel first, and one ending at an envelope.

**A5 — CSVの行数は参加回数**
> A tall stack of identical rows where the same avatar shape repeats across
> several of them, and a lens gathering those repeats into a single larger
> avatar to one side. The contrast between many rows and few people is the whole
> subject.

## A6: no screen exists

| # | Article | Save to |
| --- | --- | --- |
| A6 | `colorme-points-5-decisions` | `images/blog/colorme-points-5-decisions/diagram.webp` |

This article is about five decisions taken **before** the app is installed.
There is no screen to show, by design.

> Five smooth discs laid in a shallow arc on a clean drafting surface, each a
> slightly different tint of blue, the fifth still hovering just above its place.
> A faint dotted outline of a sixth position sits beyond them, empty.

## A7: real production numbers

| # | Article | Save to |
| --- | --- | --- |
| A7 | `coupon-metrics` | `images/blog/coupon-metrics/diagram.webp` |

The Coupon dashboard shows live figures from a real shop. The article already
quotes aggregates with n stated, which is the agreed treatment; a screenshot
would publish raw production numbers with no such framing.

> Four horizontal bands stacked and descending in width like a funnel, each band
> narrower than the one above, with a thin drop-off arrow leaving the right edge
> of each band. The bands carry no numerals.

---

# B. Screenshot possible — blocked today, not a generation job

**Do not generate images for these.** They will be screenshotted once the
blocker clears. Listed so nothing silently falls off.

## B1 — Coupon admin needs a login (14 articles)

`localhost:5173/campaigns` redirects to login. Once signed in, all 14 are
straightforward captures:

`coupon-campaign-templates`, `coupon-display-rules`, `coupon-thanks-page`
(`/campaigns/[id]/setup`) · `coupon-form-fields`, `coupon-consent`,
`coupon-messages`, `coupon-bars` (`/campaigns/[id]/forms`) · `coupon-themes`,
`coupon-colors` (`/campaigns/[id]/appearance`) · `coupon-spin-limits`,
`coupon-reset-period`, `coupon-limit-messages` (`/campaigns/[id]/anti-cheat`) ·
`coupon-duplicate` (`/campaigns`)

**Blocked in a second way.** Campaign cards with no preview image render a
broken `<img>` pointing at a dead ngrok tunnel
(`74c8-…ngrok-free.app/images/default/image-placeholder.svg`). Five broken
images on `/campaigns` alone. Any capture containing a card thumbnail is
unusable until that asset URL is repointed — the `coupon-campaign-status` shot
had to be taken from the ordering modal for this reason. Worth checking whether
that URL can reach production data.

## B2 — `/points` returns HTTP 500 (1 article)

`points-mission-audience` needs `/points/[type]/[id]`.
`https://points.illumenza.dev/points` returns **500 Internal Error**,
reproducibly. This is a production fault, not a screenshot problem.

## B3 — done

`points-email-variables` and `coupon-campaign-status` are now captured.

---

# House rules for any screenshot taken here

- **Crop to `<main>`.** The sidebar carries the account holder's name and email
  in every screen of the Points admin. Confirmed: `<main>` contains no `@`.
- **Never full-page on `/dashboard`.** A member table with an email column
  renders below the chart.
- Dismiss the AI chat bubble (`button[aria-label="閉じる"]`) before shooting.
- Watch for a 未保存の変更があります banner — it persists across reloads on some
  screens and, in a screenshot, reads as though the reader left work unsaved.
- Lossless WebP: `cwebp -lossless -z 9 in.png -o out.webp`.
- Alt text describes what the screen shows. It must not repeat the heading.
