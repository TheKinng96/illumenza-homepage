#!/usr/bin/env python3
"""Reject a naturalized post that changed anything but the prose.

Usage: verify.py <original.md> <candidate.md>
Exits 0 and prints OK, or exits 1 and prints one line per violation.
"""
import re
import sys
from collections import Counter

# Terms the rewrite must not trade away for a synonym.
CANON = ["ショップマイル", "マイル", "会員ステージ", "マイルミッション",
         "特典", "カラーミーショップ"]
# Terms that must not appear if they were not there to begin with.
FORBIDDEN_NEW = ["ランク", "クエスト", "報酬ポイント", "会員ランク",
                 "ポイント制度", "スタンプ"]

FM = re.compile(r"\A---\n(.*?\n)---\n", re.S)


def split_front_matter(text, label, errors):
    m = FM.match(text)
    if not m:
        errors.append(f"{label}: front matter missing or malformed")
        return "", text
    return m.group(1), text[m.end():]


IMG = re.compile(r"<img\b[^>]*>", re.S)
ALT = re.compile(r'\s*alt="[^"]*"', re.S)


def img_shapes(body):
    """Every <img> tag with its alt text removed. Catches attribute injection
    (loading=, decoding=, ...) that a src-only comparison walks straight past."""
    return Counter(re.sub(r"\s+", " ", ALT.sub("", t)).strip() for t in IMG.findall(body))


def counts(body):
    return {
        "figure open": body.count("<figure"),
        "figure close": body.count("</figure>"),
        "img": body.count("<img"),
        "figcaption": body.count("<figcaption"),
        "table row": len([l for l in body.splitlines() if l.lstrip().startswith("|")]),
        "h2": len(re.findall(r"^## ", body, re.M)),
        "h3": len(re.findall(r"^### ", body, re.M)),
        "code fence": body.count("```"),
    }


def urls(body):
    return Counter(re.findall(r'(?:src|href)="([^"]*)"', body))


def main():
    orig_path, cand_path = sys.argv[1], sys.argv[2]
    orig = open(orig_path, encoding="utf-8").read()
    cand = open(cand_path, encoding="utf-8").read()
    errors = []

    o_fm, o_body = split_front_matter(orig, "original", errors)
    c_fm, c_body = split_front_matter(cand, "candidate", errors)
    if errors:
        print("\n".join(errors))
        return 1

    if o_fm != c_fm:
        o_keys = dict(re.findall(r"^(\w+):(.*)$", o_fm, re.M))
        c_keys = dict(re.findall(r"^(\w+):(.*)$", c_fm, re.M))
        for k in sorted(set(o_keys) | set(c_keys)):
            if o_keys.get(k) != c_keys.get(k):
                errors.append(f"front matter changed: {k}")
        if not errors:
            errors.append("front matter changed (whitespace or key order)")

    o_c, c_c = counts(o_body), counts(c_body)
    for k in o_c:
        if o_c[k] != c_c[k]:
            errors.append(f"{k} count {o_c[k]} -> {c_c[k]}")

    o_u, c_u = urls(o_body), urls(c_body)
    for u in sorted(set(o_u) | set(c_u)):
        if o_u[u] != c_u[u]:
            errors.append(f"url {u!r} appears {o_u[u]}x -> {c_u[u]}x")

    o_i, c_i = img_shapes(o_body), img_shapes(c_body)
    for t in sorted(set(o_i) | set(c_i)):
        if o_i[t] != c_i[t]:
            errors.append(f"img tag attributes changed: {t[:90]}")

    for term in CANON:
        o_n, c_n = o_body.count(term), c_body.count(term)
        if o_n and c_n < o_n * 0.7:
            errors.append(f"canonical term {term!r} dropped {o_n} -> {c_n}")

    for term in FORBIDDEN_NEW:
        if term not in o_body and term in c_body:
            errors.append(f"introduced forbidden term {term!r}")

    o_len, c_len = len(o_body), len(c_body)
    if not 0.75 * o_len <= c_len <= 1.25 * o_len:
        errors.append(f"body length {o_len} -> {c_len} (outside ±25%)")

    if errors:
        print("\n".join(errors))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
