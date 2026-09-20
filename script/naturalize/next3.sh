#!/bin/bash
# Print the next pending post and load it into the clipboard.
cd "$(dirname "$0")/../.." || exit 1
F=$(python3 - <<'PY'
import json, pathlib
q = json.loads(pathlib.Path("script/naturalize/queue3.json").read_text(encoding="utf-8"))
nxt = next((a["file"] for a in q["articles"] if a["state"] == "pending"), "")
print(nxt)
PY
)
[ -z "$F" ] && { echo "ALL DONE"; exit 0; }
pbcopy < "_posts/$F"
done_n=$(python3 -c "
import json,pathlib
q=json.loads(pathlib.Path('script/naturalize/queue3.json').read_text(encoding='utf-8'))
print(sum(1 for a in q['articles'] if a['state']!='pending'), len(q['articles']))
")
echo "$F   [$done_n]"
