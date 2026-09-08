# Illumenza forms Worker

Proxies contact-form submissions to Discord so the webhook URLs stay secret.

## Why this exists

The webhook URLs used to be string literals in `js/forms-config.js`, which is
public static JS served to every visitor. A Discord webhook URL is a bearer
credential: anyone who reads it can POST to the channel forever, and someone
did. No client-side measure fixes that — a captcha, honeypot or rate limit in
the page is skipped entirely by an attacker who never loads the page.

The webhooks now exist only as Worker secrets. The browser posts field values
here, and the Worker builds the Discord payload itself.

## Gates

A submission has to clear all four before anything reaches Discord:

1. **Origin allowlist** — cheap, blocks casual scrapers. Spoofable on its own.
2. **Per-IP rate limit** — 5 per minute per IP, per Cloudflare location.
3. **Turnstile token** — the real gate. A script driving `curl` cannot mint one.
4. **Server-side revalidation** — the Worker builds the title, embed, tags and
   webhook choice from its own copy of the form spec. The caller supplies field
   *values* and nothing else.

Gate 4 is the one that matters most. Without it this would be the original hole
behind a redirect: a caller could still choose the target webhook, the forum
tags, the bot username and the embed body.

## Layout

| File | Role |
| --- | --- |
| `src/index.js` | The four gates, validation, Discord forwarding |
| `src/routing.js` | Webhook choice, forum tag ids, embed colours — **server-only** |
| `src/forms-config.generated.js` | Copied from `js/forms-config.js` by `build.sh`; gitignored |
| `test/gates.test.mjs` | Exercises every gate against a stubbed Discord + Turnstile |

Field definitions have one home: `js/forms-config.js` at the repo root, shared
by the browser and (via `build.sh`) the Worker, so the two cannot drift.
`build.sh` also fails the build if a Discord webhook URL ever reappears in that
public file.

## First-time setup

### 1. Turnstile

Cloudflare dashboard → **Turnstile** → **Add widget**.

- Domain: `illumenza.dev`
- Mode: **Managed** (invisible for nearly all visitors)

Copy the **site key** into `TURNSTILE_SITE_KEY` in `js/forms-config.js`
(it is public by design). Keep the **secret key** for step 3.

For local testing Cloudflare publishes dummy keys: site key
`1x00000000000000000000AA` and secret `1x0000000000000000000000000000000AA`
always pass; `2x00000000000000000000AB` / `2x0000000000000000000000000000000AA`
always fail.

### 2. Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Take the `https://illumenza-forms.<your-subdomain>.workers.dev` URL from the
output and put it — with `/submit` appended — into `FORMS_ENDPOINT` in
`js/forms-config.js`.

The Worker stays on `*.workers.dev` on purpose: routing it through
`illumenza.dev` would need that record proxied (orange cloud), and the apex is
deliberately DNS-only so GitHub Pages keeps issuing its own certificate.

### 3. Secrets

Create the two Discord webhooks (Server Settings → Integrations → Webhooks),
then:

```bash
npx wrangler secret put SUPPORT_WEBHOOK
npx wrangler secret put POINTS_FEEDBACK_WEBHOOK
npx wrangler secret put TURNSTILE_SECRET
```

Never put these in `wrangler.toml`, in `js/`, or in a commit.

## Everyday tasks

```bash
npm test                       # gate tests, no Cloudflare account needed
npx wrangler dev               # local run (needs the secrets in .dev.vars)
npx wrangler tail              # live logs — rejections log their reason
```

For `wrangler dev`, put the secrets in `worker/.dev.vars` (gitignored):

```
SUPPORT_WEBHOOK="https://discord.com/api/webhooks/..."
POINTS_FEEDBACK_WEBHOOK="https://discord.com/api/webhooks/..."
TURNSTILE_SECRET="1x0000000000000000000000000000000AA"
```

## Adding or changing a form

1. Edit `js/forms-config.js` for fields, labels and options.
2. Add a matching entry in `src/routing.js` for the webhook and tags — a form
   with no routing entry is rejected with a 500, by design.
3. `npm test`, then `npx wrangler deploy`.

## Rotating a webhook

Delete and recreate it in Discord, then `npx wrangler secret put <NAME>`. No
site deploy is needed, and the new URL never touches the repo.

## Responses

The Worker returns bare status codes and no body, so probing it reveals nothing
about which gate rejected a request. Reasons go to `wrangler tail` instead.

| Code | Meaning |
| --- | --- |
| 204 | Posted to Discord |
| 400 | Unknown form, malformed body, or a value that failed validation |
| 403 | Origin not allowed, or Turnstile rejected the token |
| 405 / 404 | Wrong method or path |
| 413 / 415 | Upload too large, too many, or not an image |
| 429 | Rate limited |
| 502 | Discord refused or was unreachable |
