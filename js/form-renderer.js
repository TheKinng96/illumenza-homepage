/* Illumenza contact forms — renderer + Discord submitter.
 *
 * Reads <div id="form-root" data-form="<id>">, looks the form up in
 * ILLUMENZA_FORMS (forms-config.js), renders it, validates on submit, and
 * posts to the Discord forum webhook (creating one forum post per submission
 * with the form's source tag applied).
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

    /* Trim a category option down to a short, searchable token for the title.
       Strips leading emoji/symbols, then cuts at the first " - " / " (" / " （". */
    function shortCat(v) {
        var s = String(v || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
        var cuts = [" (", " （", " - ", " ー ", " / "];
        var idx = s.length;
        cuts.forEach(function (c) {
            var i = s.indexOf(c);
            if (i >= 0 && i < idx) idx = i;
        });
        return s.slice(0, idx).trim() || s;
    }

    function buildTitle(cfg, values, t) {
        var category = cfg.defaultCategory;
        var catField = cfg.fields.find(function (f) { return f.role === "category"; });
        if (catField) {
            var cv = values[catField.name];
            if (Array.isArray(cv)) cv = cv[0];
            if (cv) category = shortCat(cv);
        }

        var summary = "";
        var sumField = cfg.fields.find(function (f) { return f.role === "summary"; });
        if (sumField) {
            var sv = values[sumField.name];
            if (Array.isArray(sv)) sv = sv.join("、");
            summary = String(sv || "").replace(/\s+/g, " ").trim().slice(0, 40);
        }

        var who = "";
        var whoField = cfg.fields.find(function (f) { return f.role === "who"; });
        if (whoField) who = String(values[whoField.name] || "").trim();
        if (!who) who = t.anon;

        var title = "[" + cfg.app + "/" + category + "]" + (summary ? " " + summary : "") + " — " + who;
        if (title.length > 100) title = title.slice(0, 99) + "…";
        return title;
    }

    function buildEmbed(cfg, values) {
        var fields = [];
        var description = "";
        cfg.fields.forEach(function (f) {
            if (f.type === "file") return;
            var v = values[f.name];
            if (Array.isArray(v)) v = v.join("\n");
            if (v == null || String(v).trim() === "") return;
            v = String(v);
            if (f.type === "textarea") {
                description += (description ? "\n\n" : "") + "**" + f.label + "**\n" + v;
            } else {
                fields.push({ name: f.label, value: v.slice(0, 1024), inline: false });
            }
        });
        if (description.length > 4096) description = description.slice(0, 4093) + "…";
        var embed = {
            title: cfg.title,
            color: 0x0066cc,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: cfg.app + " • " + cfg.lang.toUpperCase() },
        };
        if (description) embed.description = description;
        return embed;
    }

    function postToDiscord(cfg, values, files) {
        var payload = {
            username: "Illumenza Forms",
            thread_name: buildTitle(cfg, values, I18N[cfg.lang]),
            embeds: [buildEmbed(cfg, values)],
        };
        if (cfg.tags && cfg.tags.length) payload.applied_tags = cfg.tags;

        if (files.length) {
            var fd = new FormData();
            fd.append("payload_json", JSON.stringify(payload));
            files.forEach(function (f, i) { fd.append("files[" + i + "]", f, f.name); });
            return fetch(DISCORD_WEBHOOK_URL, { method: "POST", body: fd });
        }
        return fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
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
                values[f.name] = fileState.files.length + " file(s)";
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

            submit.disabled = true;
            submit.textContent = t.submitting;

            postToDiscord(cfg, values, fileState.files)
                .then(function (res) {
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    showSuccess(card, t);
                })
                .catch(function (err) {
                    console.error("Form submit failed:", err);
                    banner.textContent = t.errorBanner;
                    banner.className = "form-banner error";
                    submit.disabled = false;
                    submit.textContent = t.submit;
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
