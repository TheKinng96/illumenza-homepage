#!/usr/bin/env python3
"""Track which posts have been naturalized. Resumable across sessions.

  state.py next [n]      print the next n pending filenames
  state.py mark <file> <state> [note]
  state.py summary
"""
import json
import sys

Q = "script/naturalize/queue.json"


def load():
    return json.load(open(Q, encoding="utf-8"))


def save(q):
    json.dump(q, open(Q, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


cmd = sys.argv[1]
q = load()

if cmd == "next":
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    for a in [a for a in q["articles"] if a["state"] == "pending"][:n]:
        print(a["file"])
elif cmd == "mark":
    f, st = sys.argv[2], sys.argv[3]
    note = sys.argv[4] if len(sys.argv) > 4 else ""
    for a in q["articles"]:
        if a["file"] == f:
            a["state"], a["note"] = st, note
            break
    else:
        sys.exit(f"unknown file {f}")
    save(q)
    print(f"{f} -> {st}")
elif cmd == "summary":
    from collections import Counter
    c = Counter(a["state"] for a in q["articles"])
    print(" ".join(f"{k}={v}" for k, v in sorted(c.items())), f"total={len(q['articles'])}")
