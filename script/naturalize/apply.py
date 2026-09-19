#!/usr/bin/env python3
"""Take the last ChatGPT reply captured in out.json and apply it to a post.

  apply.py <post-filename>

Extracts the fenced markdown, runs verify.py against the current post, and
writes the file only if the guard passes. Parks the reply otherwise, so a bad
round trip costs the queue position and nothing else.
"""
import json
import pathlib
import subprocess
import sys

RAW = pathlib.Path(".playwright-mcp/out.json")
name = sys.argv[1]
post = pathlib.Path("_posts") / name

raw = RAW.read_text(encoding="utf-8")
try:
    txt = json.loads(raw)
except json.JSONDecodeError:
    txt = raw


def mark(state, note):
    subprocess.run([sys.executable, "script/naturalize/state.py", "mark", name, state, note],
                   check=False)


if txt.startswith("STILL STREAMING"):
    print("NOT READY:", txt[:80])
    sys.exit(2)

if txt.startswith("NO CODE BLOCK"):
    parked = pathlib.Path("script/naturalize/parked") / (name + ".txt")
    parked.write_text(txt, encoding="utf-8")
    mark("question", "ChatGPT asked instead of rewriting")
    print("PARKED (question) ->", parked)
    sys.exit(3)

cand = pathlib.Path(".playwright-mcp/cand.md")
cand.write_text(txt if txt.endswith("\n") else txt + "\n", encoding="utf-8")

res = subprocess.run([sys.executable, "script/naturalize/verify.py", str(post), str(cand)],
                     capture_output=True, text=True)
if res.returncode != 0:
    parked = pathlib.Path("script/naturalize/parked") / (name + ".rejected.md")
    parked.write_text(cand.read_text(encoding="utf-8"), encoding="utf-8")
    mark("failed", res.stdout.strip().replace("\n", "; ")[:200])
    print("GUARD REJECTED:\n" + res.stdout)
    sys.exit(1)

before = post.read_text(encoding="utf-8")
post.write_text(cand.read_text(encoding="utf-8"), encoding="utf-8")
changed = sum(1 for a, b in zip(before.splitlines(), cand.read_text(encoding="utf-8").splitlines()) if a != b)
mark("applied", f"{changed} lines changed")
print(f"APPLIED {name} ({changed} lines changed, {len(before)} -> {len(cand.read_text(encoding='utf-8'))} chars)")
