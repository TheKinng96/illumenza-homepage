---
description: Write and publish one Illumenza blog post
---

Write one blog post for illumenza.dev/blog/ on this topic: $ARGUMENTS

If no topic was given, read `docs/blog-topics.md` and pick the first topic
that is not already covered by an existing file in `_posts/`. If no topics
remain in the backlog, generate one yourself within the existing categories,
following all content rules below, and append 2–3 fresh ideas to
`docs/blog-topics.md` for future runs.

Read `docs/blog-authoring.md` first and follow it exactly. Then:

1. Create `_posts/<today YYYY-MM-DD>-<ascii-kebab-slug>.md`. Get today's date
   from `date +%Y-%m-%d` — do not guess it. The `date` key in the front matter
   must use the same calendar date plus a time and the `+0900` offset, e.g.
   `2026-07-30 09:00:00 +0900` — use `09:00:00` as the time unless told
   otherwise.
2. Fill every front matter key: `title`, `date`, `tags`, `description`,
   `ogImage`. Reuse existing tags — check `_posts/` (or `/blog/tags/`) for what
   is already in use rather than inventing near-duplicates. If a tag is
   Latin-script (English), match the exact casing already in use (prefer
   lowercase) — `Points` and `points` produce the same `id="points"` anchor on
   `/blog/tags/` and silently collide into an unreachable duplicate section.
   Japanese tags are unaffected.
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

4. Run `make check`. It must print `ALL CHECKS PASSED`. Fix anything
   it reports; do not proceed past a failure.
5. If the topic came from `docs/blog-topics.md`, remove its line.
6. Commit `_posts/<file>` and `docs/blog-topics.md` with
   `content: add blog post on <short topic>`, then push.

Report the published URL (`https://illumenza.dev/blog/<slug>/`) and note that
GitHub Pages takes a couple of minutes to build.
