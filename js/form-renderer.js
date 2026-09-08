/* Illumenza contact forms — renderer + submitter.
 *
 * Reads <div id="form-root" data-form="<id>">, looks the form up in
 * ILLUMENZA_FORMS (forms-config.js), renders it, validates on submit, and
 * posts the raw field values to the forms Worker at FORMS_ENDPOINT.
 *
 * The Worker owns everything Discord-facing — which webhook a submission
 * reaches, the forum post title, the embed, the applied tags — because this
 * file and forms-config.js are public static JS that anyone can read or fork.
 * The validation and file checks here are for UX only; worker/src/index.js
 * re-runs all of them, and its copy is the one that decides.
 *
 * Every submission carries a Cloudflare Turnstile token. That is what stops a
 * script from POSTing to the Worker directly.
 */
(function () {
    "use strict";

    var I18N = {
        ja: {
            submit: "送信する",
            submitting: "送信中…",
            required: "この項目は必須です",
            emailInvalid: "有効なメールアドレスを入力してください",
            successTitle: "送信完了",
            successBody: "お問い合わせありがとうございます。内容を確認のうえ、ご返信いたします。",
            errorBanner: "送信に失敗しました。時間をおいて再度お試しください。",
            rateLimited: "送信が集中しています。しばらく時間をおいてから再度お試しください。",
            captchaPending: "認証が完了するまで少しお待ちください。",
            fileTooBig: "ファイルが大きすぎます（最大8MB）",
            fileType: "画像ファイルのみアップロードできます",
            uploadPrompt: "クリックして画像を選択（最大8MB・10枚まで）",
            remove: "削除",
            anon: "匿名",
            note: "パスワードなどの機密情報は送信しないでください。",
            placeholder: "回答を入力",
        },
        en: {
            submit: "Submit",
            submitting: "Submitting…",
            required: "This field is required",
            emailInvalid: "Please enter a valid email address",
            successTitle: "Submitted",
            successBody: "Thanks for reaching out. We'll review your message and get back to you.",
            errorBanner: "Submission failed. Please try again in a moment.",
            rateLimited: "Too many submissions right now. Please wait a moment and try again.",
            captchaPending: "Please wait for the verification check to finish.",
            fileTooBig: "File too large (max 8MB)",
            fileType: "Only image files can be uploaded",
            uploadPrompt: "Click to choose images (max 8MB, up to 10)",
            remove: "Remove",
            anon: "Anonymous",
            note: "Never submit sensitive personal information, like passwords.",
            placeholder: "Your answer",
        },
    };

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var MAX_FILES = 10;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    /* --- Turnstile -------------------------------------------------------
       Loaded once, explicitly rendered so it works no matter whether the
       script arrives before or after the form mounts. */

    var turnstilePending = [];

    window.illumenzaTurnstileReady = function () {
        turnstilePending.splice(0).forEach(function (fn) { fn(); });
    };

    function loadTurnstile() {
        if (document.getElementById("turnstile-script")) return;
        var sc = document.createElement("script");
        sc.id = "turnstile-script";
        sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js" +
            "?render=explicit&onload=illumenzaTurnstileReady";
        sc.async = true;
        sc.defer = true;
        document.head.appendChild(sc);
    }

    /* Returns a handle whose token() is "" until the visitor passes the check;
       submit refuses to fire until it isn't. */
    function mountTurnstile(container, lang) {
        var state = { id: null };
        function render() {
            try {
                state.id = window.turnstile.render(container, {
                    sitekey: TURNSTILE_SITE_KEY,
                    language: lang === "ja" ? "ja" : "en",
                });
            } catch (err) {
                /* Bad site key, or Turnstile unreachable. Deliberately fails
                   closed: token() keeps returning "" and submit stays blocked,
                   because the Worker would reject the submission anyway. */
                console.error("Turnstile failed to render:", err);
            }
        }
        if (window.turnstile) render(); else turnstilePending.push(render);
        loadTurnstile();
        return {
            token: function () {
                if (state.id == null || !window.turnstile) return "";
                return window.turnstile.getResponse(state.id) || "";
            },
            /* Turnstile tokens are single-use — after a rejected submit the old
               one is spent and the widget needs a fresh challenge. */
            reset: function () {
                if (state.id != null && window.turnstile) window.turnstile.reset(state.id);
            },
        };
    }

    /* --- submit ----------------------------------------------------------- */

    function currentParams(cfg) {
        var out = {};
        if (!cfg.hiddenParams) return out;
        var params = new URLSearchParams(window.location.search);
        cfg.hiddenParams.forEach(function (p) {
            var key = p.param || p;
            var v = params.get(key);
            if (v) out[key] = v;
        });
        return out;
    }

    function postToProxy(formId, cfg, values, files, token) {
        var fd = new FormData();
        fd.append("formId", formId);
        fd.append("values", JSON.stringify(values));
        fd.append("params", JSON.stringify(currentParams(cfg)));
        fd.append("cf-turnstile-response", token);
        files.forEach(function (f) { fd.append("files[]", f, f.name); });
        return fetch(FORMS_ENDPOINT, { method: "POST", body: fd });
    }

    /* --- field rendering ------------------------------------------------- */

    function labelEl(f) {
        var l = el("label", "field-label", f.label);
        if (f.required) { var r = el("span", "req", "*"); l.appendChild(r); }
        return l;
    }

    function renderField(f, t, fileState) {
        var wrap = el("div", "field");
        wrap.dataset.name = f.name;
        wrap.appendChild(labelEl(f));
        if (f.desc) wrap.appendChild(el("div", "field-desc", f.desc));

        if (f.type === "textarea") {
            var ta = el("textarea", "field-textarea");
            ta.placeholder = t.placeholder;
            if (f.maxLength) ta.maxLength = f.maxLength;
            wrap.appendChild(ta);
        } else if (f.type === "radio" || f.type === "checkbox-group") {
            var list = el("div", "opt-list");
            f.options.forEach(function (opt) {
                var card = el("label", "opt-card");
                var inp = document.createElement("input");
                inp.type = f.type === "radio" ? "radio" : "checkbox";
                inp.name = f.name;
                inp.value = opt;
                inp.addEventListener("change", function () {
                    if (f.type === "radio") {
                        list.querySelectorAll(".opt-card").forEach(function (c) { c.classList.remove("selected"); });
                    }
                    card.classList.toggle("selected", inp.checked);
                });
                card.appendChild(inp);
                card.appendChild(el("span", null, opt));
                list.appendChild(card);
            });
            wrap.appendChild(list);
        } else if (f.type === "file") {
            renderFileField(wrap, f, t, fileState);
        } else {
            var inp2 = document.createElement("input");
            inp2.className = "field-input";
            inp2.type = f.type === "email" ? "email" : "text";
            inp2.placeholder = t.placeholder;
            if (f.maxLength) inp2.maxLength = f.maxLength;
            if (f.prefillParam) {
                var pv = new URLSearchParams(window.location.search).get(f.prefillParam);
                if (pv) inp2.value = pv;
            }
            wrap.appendChild(inp2);
        }

        wrap.appendChild(el("div", "field-error", t.required));
        return wrap;
    }

    function renderFileField(wrap, f, t, fileState) {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = f.accept || "image/*";
        input.multiple = true;
        input.style.display = "none";

        var drop = el("div", "file-drop");
        drop.innerHTML = "<strong>＋</strong> " + t.uploadPrompt;
        drop.addEventListener("click", function () { input.click(); });

        var list = el("div", "file-list");

        function refresh() {
            list.innerHTML = "";
            fileState.files.forEach(function (file, i) {
                var chip = el("div", "file-chip");
                chip.appendChild(el("span", null, file.name + " (" + Math.round(file.size / 1024) + " KB)"));
                var rm = el("button", null, "×");
                rm.type = "button";
                rm.title = t.remove;
                rm.addEventListener("click", function () {
                    fileState.files.splice(i, 1);
                    refresh();
                });
                chip.appendChild(rm);
                list.appendChild(chip);
            });
        }

        input.addEventListener("change", function () {
            Array.prototype.forEach.call(input.files, function (file) {
                if (fileState.files.length >= MAX_FILES) return;
                if (!file.type.startsWith("image/")) { alert(t.fileType); return; }
                if (file.size > MAX_FILE_BYTES) { alert(t.fileTooBig); return; }
                fileState.files.push(file);
            });
            input.value = "";
            refresh();
        });

        wrap.appendChild(input);
        wrap.appendChild(drop);
        wrap.appendChild(list);
    }

    /* --- collect + validate ---------------------------------------------- */

    function collect(cfg, root, fileState) {
        var values = {};
        cfg.fields.forEach(function (f) {
            var w = root.querySelector('.field[data-name="' + f.name + '"]');
            if (f.type === "textarea") {
                values[f.name] = w.querySelector("textarea").value.trim();
            } else if (f.type === "radio") {
                var sel = w.querySelector("input:checked");
                values[f.name] = sel ? sel.value : "";
            } else if (f.type === "checkbox-group") {
                values[f.name] = Array.prototype.map.call(
                    w.querySelectorAll("input:checked"), function (i) { return i.value; });
            } else if (f.type === "file") {
                /* Skipped: the Worker reports the real upload count. */
            } else {
                values[f.name] = w.querySelector("input").value.trim();
            }
        });
        return values;
    }

    function validate(cfg, root, values, t) {
        var firstBad = null;
        cfg.fields.forEach(function (f) {
            var w = root.querySelector('.field[data-name="' + f.name + '"]');
            var errEl = w.querySelector(".field-error");
            var bad = false, msg = t.required;

            var v = values[f.name];
            var empty = f.type === "checkbox-group" ? !(v && v.length) : !(v && String(v).trim());

            if (f.required && f.type !== "file" && empty) {
                bad = true;
            } else if (f.type === "email" && v && !EMAIL_RE.test(v)) {
                bad = true; msg = t.emailInvalid;
            }

            errEl.textContent = msg;
            w.classList.toggle("has-error", bad);
            if (bad && !firstBad) firstBad = w;
        });
        return firstBad;
    }

    /* --- mount ----------------------------------------------------------- */

    function mount(root) {
        var id = root.dataset.form;
        var cfg = (typeof ILLUMENZA_FORMS !== "undefined") && ILLUMENZA_FORMS[id];
        if (!cfg) { root.textContent = "Form not found: " + id; return; }
        var t = I18N[cfg.lang] || I18N.en;
        // Only take over the page language on dedicated form pages, not when
        // embedded into another page (e.g. the bilingual homepage).
        if (document.body.classList.contains("form-page")) {
            document.documentElement.setAttribute("lang", cfg.lang);
        }
        var fileState = { files: [] };

        var card = el("div", "form-card");
        if (root.dataset.bare !== "true") {
            card.appendChild(el("div", "form-icon", cfg.icon));
            card.appendChild(el("h1", "form-title", cfg.title));
            if (cfg.intro) card.appendChild(el("p", "form-intro", cfg.intro));
        }

        var banner = el("div", "form-banner");
        card.appendChild(banner);

        var form = el("form");
        form.noValidate = true;

        // honeypot
        var hp = el("div", "hp-field");
        var hpInput = document.createElement("input");
        hpInput.type = "text";
        hpInput.name = "website_url2";
        hpInput.tabIndex = -1;
        hpInput.autocomplete = "off";
        hp.appendChild(hpInput);
        form.appendChild(hp);

        cfg.fields.forEach(function (f) { form.appendChild(renderField(f, t, fileState)); });

        var captchaBox = el("div", "form-captcha");
        form.appendChild(captchaBox);
        var captcha = mountTurnstile(captchaBox, cfg.lang);

        var submit = el("button", "form-submit", t.submit);
        submit.type = "submit";
        form.appendChild(submit);
        form.appendChild(el("p", "form-note", t.note));

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            banner.className = "form-banner";

            if (hpInput.value) { showSuccess(card, t); return; } // bot

            var values = collect(cfg, form, fileState);
            var firstBad = validate(cfg, form, values, t);
            if (firstBad) { firstBad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

            /* Turnstile usually solves itself in the background, so an empty
               token here means it simply hasn't finished yet. */
            var token = captcha.token();
            if (!token) {
                banner.textContent = t.captchaPending;
                banner.className = "form-banner error";
                captchaBox.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
            }

            submit.disabled = true;
            submit.textContent = t.submitting;

            postToProxy(id, cfg, values, fileState.files, token)
                .then(function (res) {
                    if (res.ok) { showSuccess(card, t); return; }
                    var err = new Error("HTTP " + res.status);
                    err.status = res.status;
                    throw err;
                })
                .catch(function (err) {
                    console.error("Form submit failed:", err);
                    banner.textContent = err.status === 429 ? t.rateLimited : t.errorBanner;
                    banner.className = "form-banner error";
                    submit.disabled = false;
                    submit.textContent = t.submit;
                    captcha.reset();
                });
        });

        card.appendChild(form);
        root.innerHTML = "";
        root.appendChild(card);
    }

    function showSuccess(card, t) {
        var s = el("div", "form-success");
        s.appendChild(el("div", "check", "✓"));
        s.appendChild(el("h2", null, t.successTitle));
        s.appendChild(el("p", null, t.successBody));
        card.innerHTML = "";
        card.appendChild(s);
        card.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var root = document.getElementById("form-root");
        if (root) mount(root);
    });
})();
