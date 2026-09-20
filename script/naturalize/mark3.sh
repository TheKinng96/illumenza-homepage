#!/bin/bash
# mark3.sh <file> <note> — mark a post reviewed, then load the next one.
cd "$(dirname "$0")/../.." || exit 1
python3 - "$1" "$2" <<'PY'
import json, pathlib, sys
p = pathlib.Path("script/naturalize/queue3.json")
q = json.loads(p.read_text(encoding="utf-8"))
for a in q["articles"]:
    if a["file"] == sys.argv[1]:
        a["state"], a["note"] = "done", sys.argv[2]
        break
else:
    sys.exit(f"unknown: {sys.argv[1]}")
p.write_text(json.dumps(q, ensure_ascii=False, indent=2), encoding="utf-8")
PY
./script/naturalize/next3.sh
