/* Illumenza contact forms — declarative config.
 *
 * Each submit creates a new Discord forum post. Submissions do NOT go to
 * Discord directly: they go to the Cloudflare Worker at FORMS_ENDPOINT, which
 * holds the webhook URLs as secrets and builds the Discord payload itself.
 * Webhook URLs, forum tag ids and embed colours therefore live in
 * worker/src/routing.js, not here — this file is public static JS, and a
 * webhook URL in it is a credential anyone can copy and abuse.
 *
 * The Worker reads this same file (copied in by worker/build.sh) for field
 * names, labels, roles and options, so the two sides cannot drift.
 *
 * Field shape: { name, type, label, desc?, required?, placeholder?, options?, role?, accept?, maxLength?, prefillParam? }
 *   type : 'text' | 'email' | 'textarea' | 'radio' | 'checkbox-group' | 'file'
 *   role : 'category' | 'summary' | 'who'  (used to build the forum post title)
 */

/* Cloudflare Worker that proxies submissions to Discord. See worker/README.md. */
const FORMS_ENDPOINT = "https://illumenza-forms.illumenza.workers.dev/submit";

/* Turnstile *site* key — public by design, the secret half lives in the
 * Worker as TURNSTILE_SECRET. */
const TURNSTILE_SITE_KEY = "0x4AAAAAAEsL3w6yH-pkikLe";

/* Max bytes per uploaded file (Discord non-boosted servers allow ~8MB).
 * Re-enforced server-side in worker/src/index.js — this copy is for UX. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ILLUMENZA_FORMS = {
    /* 1 — Coupon support / issue (JP) -------------------------------------- */
    "coupon-issue": {
        lang: "ja",
        app: "Coupon",
        defaultCategory: "サポート",
        icon: "📤",
        title: "お問い合わせ - Illumenza Coupon サポート",
        intro: "ご不明な点やお困りのことがございましたら、お気軽にお問い合わせください。1〜2営業日以内にご回答いたします。\n緊急の技術的問題については illumenza.dev@gmail.com まで直接ご連絡ください。",
        fields: [
            { name: "email", type: "email", label: "メールアドレス", required: true,
              desc: "返信用のメールアドレスをご入力ください。確実に受信できるアドレスをお使いください。" },
            { name: "name", type: "text", label: "名前", required: true, role: "who",
              desc: "お名前またはショップ名をご入力ください" },
            { name: "category", type: "radio", label: "お問い合わせ種別", required: true, role: "category",
              desc: "お問い合わせ内容に最も近いカテゴリをお選びください",
              options: [
                  "🔧 技術的な問題", "💰 料金・プランについて", "🎯 アプリの使い方",
                  "📊 データ・分析について", "🎁 クーポン・景品について", "📱 アカウント・ログイン",
                  "💡 機能要望・提案", "📄 その他",
              ] },
            { name: "message", type: "textarea", label: "問い合わせ内容", required: true, role: "summary",
              desc: "問題を迅速に解決するため、可能な限り詳細をお聞かせください。\nできるだけ詳しく状況をお聞かせください：\n- いつから問題が発生していますか？\n- どのような操作をした時に起こりますか？\n- エラーメッセージは表示されますか？\n- ご利用のブラウザは何ですか？" },
            { name: "screenshot", type: "file", label: "スクリーンショット", accept: "image/*",
              desc: "問題の画面があれば添付してください（JPG、PNG、最大8MB）\nエラー画面や期待する動作との違いを示す画像は問題解決に役立ちます" },
        ],
    },

    /* 2 — Coupon uninstall survey (JP) ------------------------------------- */
    "coupon-uninstall": {
        lang: "ja",
        app: "Coupon",
        defaultCategory: "アンインストール",
        icon: "📥",
        title: "Illumenza Coupon - アンインストールアンケート",
        intro: "ご利用いただきありがとうございました。今後のサービス改善のため、ぜひご意見をお聞かせください。（所要時間：約1分）",
        fields: [
            { name: "reasons", type: "checkbox-group", label: "アンインストールの理由は何ですか？（複数選択可）", role: "summary",
              desc: "（あてはまるものをすべてお選びください）",
              options: [
                  "機能が足りなかった", "使い方がわかりにくかった", "効果が感じられなかった",
                  "価格が高い", "他のツールに乗り換えた", "一時的な利用だった（季節キャンペーンなど）",
                  "ショップを閉店した", "その他",
              ] },
            { name: "other_detail", type: "textarea", label: "「その他」を選択された方、詳しく教えてください（自由記述・任意）" },
            { name: "wish_feature", type: "textarea", label: "どんな機能があれば使い続けていましたか？（自由記述・任意）" },
            { name: "notify", type: "radio", label: "ご要望の機能が実装されたらお知らせしてもよいですか？",
              options: ["はい、メールでお知らせください", "いいえ、不要です"] },
            { name: "email", type: "email", label: "メールアドレス", role: "who",
              desc: "返信用のメールアドレスをご入力ください。確実に受信できるアドレスをお使いください。" },
        ],
    },

    /* 3 — Illumenza main contact (JP) -------------------------------------- */
    "main-contact": {
        lang: "ja",
        app: "Illumenza",
        defaultCategory: "お問い合わせ",
        icon: "📤",
        title: "お問い合わせ - Illumenza",
        intro: "何かご質問やご相談がございましたら、こちらからお気軽にお声がけください。\n新しいプロジェクトのお話、技術的なご相談、ただの雑談まで、どんなことでも歓迎です。\nお返事は通常1日以内にお送りします。",
        fields: [
            { name: "name", type: "text", label: "名前", required: true, role: "who",
              desc: "お名前またはショップ名をご入力ください" },
            { name: "email", type: "email", label: "メールアドレス", required: true,
              desc: "返信用のメールアドレスをご入力ください。確実に受信できるアドレスをお使いください。" },
            { name: "company", type: "text", label: "会社名・組織名",
              desc: "所属されている会社名や組織名（任意）" },
            { name: "website", type: "text", label: "ウェブサイト",
              desc: "お持ちのウェブサイトやSNSアカウント" },
            { name: "category", type: "radio", label: "お問い合わせ種別", role: "category",
              desc: "お問い合わせ内容に最も近いものをお選びください",
              options: [
                  "🔧 業務依頼 - プロジェクトや開発のご依頼",
                  "🎯 協業・パートナーシップ - 事業提携のご相談",
                  "💡 技術相談 - 技術的なご質問やアドバイス",
                  "📄 その他 - 上記以外のご相談",
              ] },
            { name: "subject", type: "text", label: "件名", role: "summary",
              desc: "お問い合わせの件名を簡潔にご入力ください" },
            { name: "message", type: "textarea", label: "問い合わせ内容", required: true,
              desc: "具体的なお問い合わせ内容をご記入ください。\nプロジェクトの詳細、ご質問、ご要望など、お気軽にお書きください。\n- どのようなことでお困りですか？\n- どのようなプロジェクトをお考えですか？\n- 予算やスケジュールがあれば教えてください" },
        ],
    },

    /* 4 — Mostra contact (EN) ---------------------------------------------- */
    "mostra-contact": {
        lang: "en",
        app: "Mostra",
        defaultCategory: "Inquiry",
        icon: "📤",
        title: "Contact Form - Mostra",
        intro: "Have a question or concern about Mostra? Fill out the form below and we'll get back to you at the email you provide.\nFor urgent privacy or copyright matters, we aim to respond within 72 hours.",
        fields: [
            { name: "name", type: "text", label: "Name", required: true, role: "who", desc: "Your full name" },
            { name: "email", type: "email", label: "Email", required: true, desc: "We'll reply here" },
            { name: "subject", type: "radio", label: "Subject", role: "category", desc: "What's this about?",
              options: [
                  "Privacy / Data Request (access, deletion, correction)",
                  "Copyright / DMCA Takedown", "Account Issue", "Terms of Service Question",
                  "Bug Report", "General Inquiry", "Other",
              ] },
            { name: "message", type: "textarea", label: "Message", required: true, role: "summary",
              desc: "Describe your issue or question in detail" },
            { name: "username", type: "text", label: "Mostra username",
              desc: "Your @username on Mostra, if applicable" },
        ],
    },

    /* 5 — Points / loyalty: support + feature requests, one form ----------- */
    "points-issue": {
        lang: "ja",
        app: "Points",
        defaultCategory: "その他",
        icon: "💬",
        title: "ご意見・ご要望 - ショップミッション",
        intro: "機能のご要望、不具合報告、ご質問など、どんなことでもお聞かせください。内容を確認のうえ、ご入力いただいたメールアドレスにご返信いたします（1〜2営業日以内）。\n緊急の技術的問題については illumenza.dev@gmail.com まで直接ご連絡ください。",
        /* ?plan= query param (from the points-app sidebar link) — no input,
         * just appended to the embed when present. */
        hiddenParams: [{ param: "plan", label: "Plan" }],
        fields: [
            { name: "email", type: "email", label: "メールアドレス", required: true,
              desc: "返信用のメールアドレスをご入力ください。確実に受信できるアドレスをお使いください。" },
            { name: "shop", type: "text", label: "お名前・ショップ名", required: true, role: "who",
              prefillParam: "shop", desc: "お名前またはショップ名をご入力ください" },
            { name: "type", type: "radio", label: "種別", required: true, role: "category",
              desc: "お問い合わせの種類をお選びください",
              options: ["機能要望", "既存機能の改善", "不具合報告", "質問・その他"] },
            { name: "area", type: "radio", label: "対象エリア", required: true,
              desc: "関連する機能エリアをお選びください",
              options: [
                  "チケット設定", "特典・交換", "友達紹介", "会員クラス",
                  "アクティビティ・ミッション", "会員・分析", "ウィジェット・デザイン",
                  "メール・通知", "その他",
              ] },
            { name: "title", type: "text", label: "タイトル", required: true, role: "summary",
              maxLength: 100, desc: "内容を簡潔に表すタイトルをご入力ください（100文字まで）" },
            { name: "details", type: "textarea", label: "詳細", required: true,
              maxLength: 2000, desc: "できるだけ具体的にご記入ください（2000文字まで）\n- いつから発生していますか？\n- どのような操作をした時に起こりますか？\n- エラーメッセージは表示されますか？" },
            { name: "screenshot", type: "file", label: "スクリーンショット", accept: "image/*",
              desc: "問題の画面があれば添付してください（JPG、PNG、最大8MB・任意）" },
        ],
    },
};
