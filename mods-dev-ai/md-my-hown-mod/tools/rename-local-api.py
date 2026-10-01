"""One-off, ALREADY APPLIED: rename the local `const api = <namespace>` holders.

Run from the mod root:  python3 tools/rename-local-api.py

Why: the handler layer now imports the engine api as `api`, and several action
files already had a *local* `const api = <namespace>` meaning something else
entirely. A local `api` shadowing an imported one is legal TypeScript, but it
breaks in two ways that matter:

- a function that references the import *and* declares a local `api` hits TDZ —
  `const mutate = api?.grid?.mutate` above `const api = terrains()` throws
  "used before its declaration";
- `const api = api?.projectiles` cannot even parse as an initializer.

So every local becomes `ns`, which is unambiguous: it holds a namespace, not the
api. Indent-based rather than brace-parsing, because every one of these is a local
inside an `fn: (…) => { … }` action and the block ends at the first line dedented
to the declaration's own column.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path("src/handler")
DECL = re.compile(r"^(\s*)const api = ")

changed = []
for path in sorted(ROOT.rglob("*.ts")):
    if "test" in path.parts:
        continue
    lines = path.read_text().split("\n")
    out = list(lines)
    hit = False
    for i, line in enumerate(lines):
        m = DECL.match(line)
        if not m:
            continue
        hit = True
        indent = len(m.group(1))
        out[i] = line.replace("const api = ", "const ns = ", 1)
        # Walk the block: until a non-blank line dedented to <= the declaration.
        for j in range(i + 1, len(lines)):
            body = lines[j]
            if body.strip() and (len(body) - len(body.lstrip())) <= indent:
                break
            out[j] = re.sub(r"\bapi\.", "ns.", body)
            out[j] = re.sub(r"\bapi\?\.", "ns?.", out[j])
    if hit:
        path.write_text("\n".join(out))
        changed.append(str(path))

print("renamed local `api` in", len(changed), "file(s)")
for c in changed:
    print("  ", c)

left = []
for path in sorted(ROOT.rglob("*.ts")):
    if "test" in path.parts:
        continue
    for i, line in enumerate(path.read_text().split("\n"), 1):
        if re.search(r"\bapi\b", line) and not line.lstrip().startswith(("*", "//", "/*")):
            if "import" in line or "const ns" in line or "ns." in line:
                continue
            left.append(f"{path}:{i}: {line.strip()[:90]}")
if left:
    print("REVIEW (a bare `api` that may still mean a namespace):")
    for l in left:
        print("  ", l)
    sys.exit(1)
print("no bare local `api` left")