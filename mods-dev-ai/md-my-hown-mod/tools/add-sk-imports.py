"""One-off, ALREADY APPLIED: add the missing `sk` imports.

Run from the mod root:  python3 tools/add-sk-imports.py

`fix-imports.py` dropped the `host*` names from every `core/types.ts` import
while the call sites still read `hostGrid()`. The `sk` names therefore only
arrived when the call sites were rewritten, which was the next step — so the two
passes have to be read together. This adds `sk` to any file that calls it without
importing it, and is safe to re-run.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path("src/handler")
SKIP = {"test"}
BLOCK_RE = re.compile(r"import \{([^}]*)\} from (\"[^\"]*types\.ts\");")

changed = []
for path in sorted(ROOT.rglob("*.ts")):
    if any(part in SKIP for part in path.parts):
        continue
    src = path.read_text()
    if "sk()" not in src:
        continue

    match = BLOCK_RE.search(src)
    if match:
        names = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", match.group(1))
        if "sk" in names:
            continue
        kept = sorted(set(names) | {"sk"})
        one_line = "{ " + ", ".join(kept) + " }"
        if len(one_line) <= 76:
            replacement = f"import {one_line} from {match.group(2)};"
        else:
            body = "".join(f"    {n},\n" for n in kept)
            replacement = f"import {{\n{body}}} from {match.group(2)};"
        src = src[: match.start()] + replacement + src[match.end() :]
    else:
        # No *value* import yet (a file may only have `import type`). Add one,
        # placed before the first existing import so the block stays together.
        first = re.search(r"^import .*?;$", src, re.MULTILINE | re.DOTALL)
        if not first:
            print("no import anchor in", path)
            sys.exit(1)
        replacement = 'import { sk } from "./types.ts";\n'
        src = src[: first.start()] + replacement + src[first.start() :]

    path.write_text(src)
    changed.append(str(path))

print("added sk import to", len(changed), "file(s)")
for c in changed:
    print("  ", c)