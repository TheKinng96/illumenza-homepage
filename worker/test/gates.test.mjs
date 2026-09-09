/* Exercises the four gates in src/index.js against a stubbed Discord and
 * Turnstile, so the security-relevant behaviour is checked without deploying.
 *
 * Run: npm test   (from worker/)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { ILLUMENZA_FORMS } from "../src/forms-config.generated.js";

const SUPPORT = "https://discord.test/support";
const POINTS = "https://discord.test/points";
const ORIGIN = "https://illumenza.dev";
const GOOD_TOKEN = "good-token";

const ENV = {
    SUPPORT_WEBHOOK: SUPPORT,
    POINTS_FEEDBACK_WEBHOOK: POINTS,
    TURNSTILE_SECRET: "secret",
    /* No RATE_LIMITER binding: index.js treats it as optional so the tests and
     * `wrangler dev` both work without one. */
};

/* Captures what would have gone to Discord, and answers siteverify. */
let sent;
globalThis.fetch = async (url, init) => {
    if (String(url).includes("challenges.cloudflare.com")) {
        const ok = init.body.get("response") === GOOD_TOKEN;
        return new Response(JSON.stringify({ success: ok }), { status: 200 });
    }
    sent = { url: String(url), init };
    return new Response(null, { status: 204 });
};

async function discordPayload() {
    const body = sent.init.body;
    return JSON.parse(typeof body === "string" ? body : body.get("payload_json"));
}

function submit(fields, { origin = ORIGIN, token = GOOD_TOKEN, files = [] } = {}) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (token !== null) fd.append("cf-turnstile-response", token);
    for (const f of files) fd.append("files[]", f, f.name);
    const headers = { "CF-Connecting-IP": "203.0.113.1" };
    if (origin !== null) headers.Origin = origin;
    return worker.fetch(
        new Request("https://forms.test/submit", { method: "POST", body: fd, headers }),
        ENV
    );
}

const VALID_POINTS = {
    formId: "points-issue",
    values: JSON.stringify({
        email: "a@b.com", shop: "Test Shop", type: "不具合報告",
        area: "マイル設定", title: "T", details: "D",
    }),
    params: "{}",
};

/* --- gate 1: origin ----------------------------------------------------- */

test("rejects a foreign origin", async () => {
    const res = await submit(VALID_POINTS, { origin: "https://evil.test" });
    assert.equal(res.status, 403);
});

test("rejects a request with no origin at all", async () => {
    const res = await submit(VALID_POINTS, { origin: null });
    assert.equal(res.status, 403);
});

test("never echoes a foreign origin back in CORS headers", async () => {
    const res = await submit(VALID_POINTS, { origin: "https://evil.test" });
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

/* --- gate 3: turnstile -------------------------------------------------- */

test("rejects a missing Turnstile token", async () => {
    const res = await submit(VALID_POINTS, { token: null });
    assert.equal(res.status, 403);
});

test("rejects a Turnstile token siteverify does not accept", async () => {
    const res = await submit(VALID_POINTS, { token: "forged" });
    assert.equal(res.status, 403);
});

/* --- gate 4: the caller controls values, nothing else ------------------- */

test("accepts a valid submission and posts to the support webhook", async () => {
    sent = null;
    const res = await submit(VALID_POINTS);
    assert.equal(res.status, 204);
    assert.equal(sent.url, SUPPORT);
});

test("routes feature requests to the points feedback webhook", async () => {
    sent = null;
    const res = await submit({
        ...VALID_POINTS,
        values: JSON.stringify({
            email: "a@b.com", shop: "S", type: "機能要望",
            area: "特典・交換", title: "T", details: "D",
        }),
    });
    assert.equal(res.status, 204);
    assert.equal(sent.url, POINTS);
    const payload = await discordPayload();
    assert.deepEqual(payload.applied_tags, ["1532145159029002392"]);
});

test("ignores caller-supplied username, embeds and applied_tags", async () => {
    sent = null;
    await submit({
        ...VALID_POINTS,
        username: "Illumenza Staff",
        embeds: JSON.stringify([{ title: "spoofed" }]),
        applied_tags: JSON.stringify(["999"]),
    });
    const payload = await discordPayload();
    assert.equal(payload.username, "Illumenza Forms");
    assert.equal(payload.embeds.length, 1);
    assert.equal(payload.embeds[0].title, "ご意見・ご要望 - 会員ステージ");
    assert.deepEqual(payload.applied_tags, ["1517164358906413186"]);
});

test("rejects a radio value that is not one of the form's options", async () => {
    /* The whole point: `type` picks the webhook, so a made-up value must not
       reach the routing function. */
    const res = await submit({
        ...VALID_POINTS,
        values: JSON.stringify({
            email: "a@b.com", shop: "S", type: "../../admin",
            area: "マイル設定", title: "T", details: "D",
        }),
    });
    assert.equal(res.status, 400);
});

test("rejects an unknown form id", async () => {
    const res = await submit({ ...VALID_POINTS, formId: "nope" });
    assert.equal(res.status, 400);
});

test("rejects prototype-chain form ids", async () => {
    const res = await submit({ ...VALID_POINTS, formId: "constructor" });
    assert.equal(res.status, 400);
});

test("rejects a missing required field", async () => {
    const res = await submit({
        ...VALID_POINTS,
        values: JSON.stringify({ email: "a@b.com", shop: "S", type: "不具合報告", area: "マイル設定", title: "T" }),
    });
    assert.equal(res.status, 400);
});

test("rejects a malformed email", async () => {
    const res = await submit({
        ...VALID_POINTS,
        values: JSON.stringify({
            email: "not-an-email", shop: "S", type: "不具合報告",
            area: "マイル設定", title: "T", details: "D",
        }),
    });
    assert.equal(res.status, 400);
});

test("drops query params the form does not declare", async () => {
    sent = null;
    await submit({ ...VALID_POINTS, params: JSON.stringify({ plan: "pro", injected: "x" }) });
    const payload = await discordPayload();
    const names = payload.embeds[0].fields.map((f) => f.name);
    assert.ok(names.includes("Plan"));
    assert.ok(!names.includes("injected"));
});

test("truncates an over-long field instead of forwarding it", async () => {
    sent = null;
    await submit({
        ...VALID_POINTS,
        values: JSON.stringify({
            email: "a@b.com", shop: "S", type: "不具合報告",
            area: "マイル設定", title: "T", details: "x".repeat(9000),
        }),
    });
    const payload = await discordPayload();
    assert.ok(payload.embeds[0].description.length <= 4096);
});

/* --- uploads ------------------------------------------------------------ */

test("rejects a non-image upload", async () => {
    const bad = new File(["#!/bin/sh"], "x.sh", { type: "application/x-sh" });
    const res = await submit(VALID_POINTS, { files: [bad] });
    assert.equal(res.status, 415);
});

test("rejects an oversized upload", async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], "big.png", { type: "image/png" });
    const res = await submit(VALID_POINTS, { files: [big] });
    assert.equal(res.status, 413);
});

test("rejects more than ten uploads", async () => {
    const files = Array.from({ length: 11 }, (_, i) =>
        new File(["x"], `f${i}.png`, { type: "image/png" }));
    const res = await submit(VALID_POINTS, { files });
    assert.equal(res.status, 413);
});

test("rejects uploads to a form with no file field", async () => {
    const img = new File(["x"], "a.png", { type: "image/png" });
    const res = await submit({
        formId: "main-contact",
        values: JSON.stringify({ name: "N", email: "a@b.com", message: "M" }),
        params: "{}",
    }, { files: [img] });
    assert.equal(res.status, 400);
});

test("reports the real upload count, not a caller-supplied one", async () => {
    sent = null;
    const img = new File(["x"], "a.png", { type: "image/png" });
    await submit({
        ...VALID_POINTS,
        values: JSON.stringify({
            email: "a@b.com", shop: "S", type: "不具合報告", area: "マイル設定",
            title: "T", details: "D", screenshot: "9999 file(s)",
        }),
    }, { files: [img] });
    const payload = await discordPayload();
    const shot = payload.embeds[0].fields.find((f) => f.name === "スクリーンショット");
    assert.equal(shot.value, "1 file(s)");
});

/* --- method / path ------------------------------------------------------ */

test("answers CORS preflight", async () => {
    const res = await worker.fetch(
        new Request("https://forms.test/submit", { method: "OPTIONS", headers: { Origin: ORIGIN } }),
        ENV
    );
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("rejects GET", async () => {
    const res = await worker.fetch(
        new Request("https://forms.test/submit", { headers: { Origin: ORIGIN } }), ENV);
    assert.equal(res.status, 405);
});

test("rejects an unknown path", async () => {
    const res = await worker.fetch(
        new Request("https://forms.test/", { method: "POST", headers: { Origin: ORIGIN } }), ENV);
    assert.equal(res.status, 404);
});

/* --- 対象エリア routing keys -------------------------------------------- */

/* The `area` radio's options in js/forms-config.js double as the lookup keys
 * for POINTS_AREA_TAGS in src/routing.js. Rename one side without the other
 * and it fails silently, in two different ways: the validator rejects the
 * submission (index.js:198), or the tag lookup misses and the thread posts
 * untagged (routing.js). Neither logs an error and neither is visible to the
 * person who submitted, so assert every offered option still routes.
 *
 * `type` must be a non-bugish value here — 不具合報告 and 質問・その他
 * short-circuit to the support forum's fixed tag and never read the area map.
 *
 * The reverse direction (a POINTS_AREA_TAGS key the form no longer offers) is
 * dead config rather than a break, so it is deliberately not asserted. */
test("every 対象エリア option maps to a forum tag", async () => {
    const areas = ILLUMENZA_FORMS["points-issue"]
        .fields.find((f) => f.name === "area").options;
    assert.ok(areas.length, "the area field should offer options");

    for (const area of areas) {
        sent = null;
        const res = await submit({
            formId: "points-issue",
            values: JSON.stringify({
                email: "a@b.com", shop: "S", type: "機能要望",
                area, title: "T", details: "D",
            }),
            params: "{}",
        });
        assert.equal(res.status, 204,
            `"${area}" is offered by the form but the validator rejected it`);
        const payload = await discordPayload();
        assert.ok(payload.applied_tags && payload.applied_tags.length,
            `"${area}" is offered by the form but has no POINTS_AREA_TAGS entry`);
    }
});

/* --- rate limit --------------------------------------------------------- */

test("returns 429 when the rate limiter says no", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(VALID_POINTS)) fd.append(k, v);
    fd.append("cf-turnstile-response", GOOD_TOKEN);
    const res = await worker.fetch(
        new Request("https://forms.test/submit", {
            method: "POST", body: fd,
            headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.9" },
        }),
        { ...ENV, RATE_LIMITER: { limit: async () => ({ success: false }) } }
    );
    assert.equal(res.status, 429);
});
