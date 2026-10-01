"""One-off, ALREADY APPLIED: move the action suites onto the shared fake host.

Run from the mod root:  python3 tools/use-shared-fake-host.py

`src/host.ts` captures the host once at module load, so `g.sandkit = { api: … }`
after a static import no longer reaches the code under test — the capture already
happened. The suites therefore install one shared, mutable api (see
`test/fake-host.ts`) and assign namespaces onto it per test.

Three edits per file:
  1. import the fixture **first**, so ESM evaluates it before the actions;
  2. `g.sandkit = { … }`  ->  `setApi({ … })`, found by brace matching rather than
     by regex, because the object literal spans many lines;
  3. the teardown `g.sandkit = prev` / `delete g.sandkit` -> `clearApi()`.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path("src/handler/test")
ASSIGN = re.compile(r"^(\s*)(?:const\s+)?g\.sandkit\s*=\s*\{")
TEARDOWN = re.compile(r"^\s*if \(had\) g\.sandkit = prev;$")

changed = []
skipped = []

for path in sorted(ROOT.glob("*.test.ts")):
    src = path.read_text()
    if "fake-host.ts" in src:
        continue
    lines = src.split("\n")
    out = list(lines)
    touched = False

    for i, line in enumerate(lines):
        m = ASSIGN.match(line)
        if not m:
            continue
        indent = m.group(1)
        depth = line.count("{") - line.count("}")
        j = i
        while depth > 0 and j + 1 < len(lines):
            j += 1
            depth += lines[j].count("{") - lines[j].count("}")
        # Rewrite the assignment as a call: `setApi({ … })`.
        out[i] = f"{indent}setApi({{"
        out[j] = out[j].replace("};", "});", 1) if "};" in out[j] else out[j] + ")"
        for k in range(i + 1, j):
            if "g.sandkit" in out[k]:
                out[k] = out[k].replace("g.sandkit", "sharedApi")
        touched = True
        break

    if not touched:
        skipped.append(path.name)
        continue

    # Teardown -> clearApi().
    for k, line in enumerate(out):
        if TEARDOWN.match(line):
            out[k] = re.match(r"^(\s*)", line).group(1) + "clearApi();"
        elif re.match(r"^\s*else delete g\.sandkit;$", line):
            out[k] = None  # type: ignore[call-overload]
    out = [l for l in out if l is not None]

    body = "\n".join(out)
    body = re.sub(r'const g = globalThis[^\n]*\n', "", body)

    # The fixture import must come first: ESM evaluates in source order.
    lines2 = body.split("\n")
    first = next((k for k, l in enumerate(lines2) if l.startswith("import ")), 0)
    body = "\n".join(
        lines2[:first]
        + ['import { clearApi, setApi } from "./fake-host.ts";']
        + lines2[first:]
    )
    path.write_text(body)
    changed.append(path.name)

print("converted", len(changed), "file(s):")
for c in changed:
    print("  ", c)
if skipped:
    print("NO g.sandkit ASSIGNMENT FOUND (left alone):")
    for s in skipped:
        print("  ", s)
    sys.exit(1)