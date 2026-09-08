/* Illumenza forms proxy.
 *
 * The Discord webhook URLs used to sit in js/forms-config.js, which is public
 * static JS — anyone could read them and POST straight to Discord, which is
 * exactly what happened. They now live only as Worker secrets, and the browser
 * talks to this Worker instead.
 *
 * A submission has to clear four gates before anything reaches Discord:
 *   1. Origin allowlist          — blocks casual scrapers (spoofable alone)
 *   2. Per-IP rate limit         — caps volume from one source
 *   3. Turnstile token           — the real gate; curl cannot mint one
 *   4. Server-side revalidation  — the Worker builds the Discord payload from
 *                                  its own form spec, so the caller controls
 *                                  only field *values*, never the embed,
 *                                  username, target webhook, or forum tags.
 *
 * Without gate 4 this would just be the original hole behind a redirect.
 */

import { ILLUMENZA_FORMS } from "./forms-config.generated.js";
import { ROUTING } from "./routing.js";

const ALLOWED_ORIGINS = [
    "https://illumenza.dev",
    "https://www.illumenza.dev",
];

const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_VALUE_CHARS = 4000;   /* hard ceiling for any single field */
const DEFAULT_COLOR = 0x0066cc;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANON = { ja: "匿名", en: "Anonymous" };

/* --- helpers ------------------------------------------------------------ */

function corsHeaders(origin) {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    };
}

/* Deliberately terse: an attacker probing the endpoint learns nothing about
 * which gate rejected them. Real causes go to the Worker log instead. */
function reject(status, origin, logLine) {
    if (logLine) console.log("reject " + status + ": " + logLine);
    return new Response(null, { status, headers: corsHeaders(origin) });
}

async function verifyTurnstile(token, ip, secret) {
    if (typeof token !== "string" || !token) return false;
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);
    const res = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
}

/* --- payload building (mirrors the old client-side logic) --------------- */

function shortCat(v) {
    const s = String(v || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
    const cuts = [" (", " （", " - ", " ー ", " / "];
    let idx = s.length;
    for (const c of cuts) {
        const i = s.indexOf(c);
        if (i >= 0 && i < idx) idx = i;
    }
    return s.slice(0, idx).trim() || s;
}

function fieldByRole(cfg, role) {
    return cfg.fields.find((f) => f.role === role);
}

function buildTitle(cfg, values) {
    let category = cfg.defaultCategory;
    const catField = fieldByRole(cfg, "category");
    if (catField) {
        let cv = values[catField.name];
        if (Array.isArray(cv)) cv = cv[0];
        if (cv) category = shortCat(cv);
    }

    let summary = "";
    const sumField = fieldByRole(cfg, "summary");
    if (sumField) {
        let sv = values[sumField.name];
        if (Array.isArray(sv)) sv = sv.join("、");
        summary = String(sv || "").replace(/\s+/g, " ").trim().slice(0, 40);
    }

    const whoField = fieldByRole(cfg, "who");
    let who = whoField ? String(values[whoField.name] || "").trim() : "";
    if (!who) who = ANON[cfg.lang] || ANON.en;

    let title = "[" + cfg.app + "/" + category + "]" +
        (summary ? " " + summary : "") + " — " + who;
    if (title.length > 100) title = title.slice(0, 99) + "…";
    return title;
}

/* Only params the form declares in hiddenParams are echoed into the embed —
 * an arbitrary ?anything= from the caller is dropped. */
function hiddenParamFields(cfg, params) {
    if (!cfg.hiddenParams || !cfg.hiddenParams.length) return [];
    const out = [];
    for (const p of cfg.hiddenParams) {
        const key = p.param || p;
        const v = params[key];
        if (v) out.push({ name: p.label || key, value: String(v).slice(0, 1024), inline: true });
    }
    return out;
}

function buildEmbed(cfg, routing, values, params, fileCount) {
    let fields = [];
    let description = "";

    for (const f of cfg.fields) {
        if (f.type === "file") continue;
        let v = values[f.name];
        if (Array.isArray(v)) v = v.join("\n");
        if (v == null || String(v).trim() === "") continue;
        v = String(v);
        if (f.type === "textarea") {
            description += (description ? "\n\n" : "") + "**" + f.label + "**\n" + v;
        } else {
            fields.push({ name: f.label, value: v.slice(0, 1024), inline: false });
        }
    }

    /* The old client sent "N file(s)" as a normal field value; the count is now
     * derived from the actual upload so it cannot be faked. */
    const fileField = cfg.fields.find((f) => f.type === "file");
    if (fileField && fileCount > 0) {
        fields.push({ name: fileField.label, value: fileCount + " file(s)", inline: false });
    }

    fields = fields.concat(hiddenParamFields(cfg, params));
    if (description.length > 4096) description = description.slice(0, 4093) + "…";

    let color = routing.color ? routing.color(values) : undefined;
    if (color == null) color = DEFAULT_COLOR;

    const embed = {
        title: cfg.title,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: cfg.app + " • " + cfg.lang.toUpperCase() },
    };
    if (description) embed.description = description;
    return embed;
}

/* --- input validation --------------------------------------------------- */

/* Rebuilds `values` from the form spec: unknown keys are dropped, types are
 * coerced to what the field declares, and required/length/email rules are
 * re-checked. The browser does the same for UX; this copy is the one that
 * counts. Returns { ok, values } or { ok: false, why }. */
function sanitizeValues(cfg, raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, why: "values not an object" };
    }
    const values = {};
    for (const f of cfg.fields) {
        if (f.type === "file") continue;
        const v = raw[f.name];

        if (f.type === "checkbox-group") {
            const list = Array.isArray(v) ? v : [];
            const allowed = list
                .map(String)
                .filter((x) => f.options.includes(x))
                .slice(0, f.options.length);
            if (f.required && !allowed.length) return { ok: false, why: f.name + " required" };
            values[f.name] = allowed;
            continue;
        }

        let s = v == null ? "" : String(v);
        if (f.type === "radio") {
            /* Only the options the form actually offers. This is what keeps a
             * caller from steering webhook/tag/colour routing with a made-up
             * value. */
            if (s && !f.options.includes(s)) return { ok: false, why: f.name + " not an option" };
        } else {
            s = s.trim().slice(0, Math.min(f.maxLength || MAX_VALUE_CHARS, MAX_VALUE_CHARS));
        }

        if (f.required && !s) return { ok: false, why: f.name + " required" };
        if (f.type === "email" && s && !EMAIL_RE.test(s)) return { ok: false, why: "bad email" };
        values[f.name] = s;
    }
    return { ok: true, values };
}

function sanitizeParams(cfg, raw) {
    const out = {};
    if (!cfg.hiddenParams || raw == null || typeof raw !== "object") return out;
    for (const p of cfg.hiddenParams) {
        const key = p.param || p;
        const v = raw[key];
        if (typeof v === "string" && v) out[key] = v.slice(0, 1024);
    }
    return out;
}

/* --- handler ------------------------------------------------------------ */

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";
        const allowed = ALLOWED_ORIGINS.includes(origin);
        /* CORS echoes only an allowlisted origin, never the caller's own. */
        const respOrigin = allowed ? origin : ALLOWED_ORIGINS[0];

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(respOrigin) });
        }
        if (request.method !== "POST") return reject(405, respOrigin);
        if (new URL(request.url).pathname !== "/submit") return reject(404, respOrigin);

        /* Gate 1 — origin. */
        if (!allowed) return reject(403, respOrigin, "origin " + origin);

        /* Gate 2 — per-IP rate limit. Counters are per Cloudflare location, so
         * this caps a single source rather than global volume; Turnstile is
         * what actually stops a distributed script. */
        const ip = request.headers.get("CF-Connecting-IP") || "";
        if (env.RATE_LIMITER) {
            const { success } = await env.RATE_LIMITER.limit({ key: ip || "unknown" });
            if (!success) return reject(429, respOrigin, "rate limit " + ip);
        }

        let form;
        try {
            form = await request.formData();
        } catch (err) {
            return reject(400, respOrigin, "bad multipart");
        }

        /* Gate 3 — Turnstile. */
        const token = form.get("cf-turnstile-response");
        if (!(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET))) {
            return reject(403, respOrigin, "turnstile failed");
        }

        /* Gate 4 — the caller supplies values only; everything else is ours. */
        const formId = String(form.get("formId") || "");
        const cfg = Object.prototype.hasOwnProperty.call(ILLUMENZA_FORMS, formId)
            ? ILLUMENZA_FORMS[formId]
            : null;
        if (!cfg) return reject(400, respOrigin, "unknown form " + formId);

        let rawValues, rawParams;
        try {
            rawValues = JSON.parse(form.get("values") || "{}");
            rawParams = JSON.parse(form.get("params") || "{}");
        } catch (err) {
            return reject(400, respOrigin, "bad json");
        }

        const clean = sanitizeValues(cfg, rawValues);
        if (!clean.ok) return reject(400, respOrigin, clean.why);
        const values = clean.values;
        const params = sanitizeParams(cfg, rawParams);

        /* Files: re-check count, size and type here — the browser's checks in
         * form-renderer.js are UX, not enforcement. */
        const files = form.getAll("files[]").filter((f) => typeof f === "object" && f.size != null);
        if (files.length > MAX_FILES) return reject(413, respOrigin, "too many files");
        if (!cfg.fields.some((f) => f.type === "file") && files.length) {
            return reject(400, respOrigin, "form takes no files");
        }
        for (const f of files) {
            if (f.size > MAX_FILE_BYTES) return reject(413, respOrigin, "file too big");
            if (!String(f.type || "").startsWith("image/")) {
                return reject(415, respOrigin, "file type " + f.type);
            }
        }

        const routing = ROUTING[formId];
        if (!routing) return reject(500, respOrigin, "no routing for " + formId);

        const webhookUrl = env[routing.webhook(values)];
        if (!webhookUrl) return reject(500, respOrigin, "missing webhook secret");

        const payload = {
            username: "Illumenza Forms",
            thread_name: buildTitle(cfg, values),
            embeds: [buildEmbed(cfg, routing, values, params, files.length)],
        };
        const tags = routing.tags ? routing.tags(values) : undefined;
        if (tags && tags.length) payload.applied_tags = tags;

        let discordRes;
        try {
            if (files.length) {
                const fd = new FormData();
                fd.append("payload_json", JSON.stringify(payload));
                files.forEach((f, i) => fd.append("files[" + i + "]", f, f.name));
                discordRes = await fetch(webhookUrl, { method: "POST", body: fd });
            } else {
                discordRes = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }
        } catch (err) {
            return reject(502, respOrigin, "discord fetch: " + err);
        }

        if (!discordRes.ok) {
            /* Log the body for debugging but never return it — it contains the
             * webhook id and Discord's own error detail. */
            console.log("discord " + discordRes.status + ": " + (await discordRes.text()).slice(0, 500));
            return reject(502, respOrigin);
        }

        return new Response(null, { status: 204, headers: corsHeaders(respOrigin) });
    },
};
