/* Server-side routing for Illumenza forms — never shipped to the browser.
 *
 * Field definitions live in js/forms-config.js, which is shared with the
 * browser and copied in at build time (see build.sh). This file holds only the
 * parts a submitter must not be able to control: which Discord webhook a
 * submission reaches, which forum tags get applied, and the embed colour.
 *
 * `webhook` returns the name of a Worker secret, never a URL.
 */

const SUPPORT = "SUPPORT_WEBHOOK";
const POINTS_FEEDBACK = "POINTS_FEEDBACK_WEBHOOK";

/* points-issue splits by the "type" radio: bugs and questions go to the shared
 * support forum, feature requests and improvements to the feedback forum. */
function pointsIsBugish(values) {
    return values.type === "不具合報告" || values.type === "質問・その他";
}

const POINTS_AREA_TAGS = {
    "チケット設定": "1532145128213319722",
    "特典・交換": "1532145159029002392",
    "友達紹介": "1532145183112822865",
    "会員クラス": "1532145199810347100",
    "アクティビティ・ミッション": "1532145213177593926",
    "会員・分析": "1532145233519706313",
    "ウィジェット・デザイン": "1532145247155392663",
    "メール・通知": "1532145265434300437",
    "その他": "1532145285592125625",
};

const POINTS_TYPE_COLORS = {
    "機能要望": 5763719,
    "既存機能の改善": 3447003,
    "不具合報告": 15548997,
    "質問・その他": 9807270,
};

export const ROUTING = {
    "coupon-issue": {
        webhook: () => SUPPORT,
        tags: () => ["1517164238601322617"],
    },
    "coupon-uninstall": {
        webhook: () => SUPPORT,
        tags: () => ["1517164292221178057"],
    },
    "main-contact": {
        webhook: () => SUPPORT,
        tags: () => ["1517166748799991948"],
    },
    "mostra-contact": {
        webhook: () => SUPPORT,
        tags: () => ["1517164261539971072"],
    },
    "points-issue": {
        webhook: (values) => (pointsIsBugish(values) ? SUPPORT : POINTS_FEEDBACK),
        color: (values) => POINTS_TYPE_COLORS[values.type],
        tags: (values) => {
            if (pointsIsBugish(values)) return ["1517164358906413186"];
            const tagId = POINTS_AREA_TAGS[values.area];
            return tagId ? [tagId] : undefined;
        },
    },
};
