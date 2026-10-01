"""One-off migration, ALREADY APPLIED: the 14 per-namespace accessors -> one `sk()`.

Kept as the record of what changed mechanically. Run from the mod root:
    python3 tools/repoint-host-accessors.py

Why: `hostGrid()` existed only to resolve one string. A namespace is just a
property of `api`, so the honest form is `sk()?.grid` — one function in the whole
mod instead of fourteen, and a call site that reads as what it is: a reach into
the engine api.

The regex is the whole migration: `hostGrid()` -> `sk()?.grid`, leaving any
trailing `?.member` untouched, so `hostGrid()?.mutate?.(…)` becomes
`sk()?.grid?.mutate?.(…)`.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path("src/handler")
SKIP = {"test"}

ACCESSORS = {
    "Grid": "grid",
    "Elements": "elements",
    "Structures": "structures",
    "Terrains": "terrains",
    "Signals": "signals",
    "Energy": "energy",
    "Tech": "tech",
    "Player": "player",
    "Upgrades": "upgrades",
    "Projectiles": "projectiles",
    "Ui": "ui",
    "Effects": "effects",
    "Random": "random",
    "Input": "input",
}

NAMES = "|".join(ACCESSORS)
CALL_RE = re.compile(r"\bhost(" + NAMES + r")\(\)")
ANY_RE = re.compile(r"\bhost(?:" + NAMES + r")\b")

changed = []
for path in sorted(ROOT.rglob("*.ts")):
    if any(part in SKIP for part in path.parts):
        continue
    src = original = path.read_text()

    # 1. Call sites.
    src = CALL_RE.sub(lambda m: f"sk()?.{ACCESSORS[m.group(1)]}", src)

    # 2. Imports: drop the accessor names, add `sk` once.
    if "sk()" in src:
        out = []
        for line in src.split("\n"):
            if line.lstrip().startswith("import") and "/core/types.ts" in line:
                names = re.findall(
                    r"[A-Za-z_][A-Za-z0-9_]*", line.split("{")[1].split("}")[0]
                )
                names = sorted({n for n in names if not n.startswith("host")} | {"sk"})
                if len(names) <= 3:
                    line = re.sub(r"\{[^}]*\}", "{ " + ", ".join(names) + " }", line)
                else:
                    body = "".join(f"    {n},\n" for n in names)
                    line = re.sub(r"\{[^}]*\}", "{\n" + body + "}", line)
            out.append(line)
        src = "\n".join(out)

    if src != original:
        path.write_text(src)
        changed.append(str(path))

leftover = []
for path in sorted(ROOT.rglob("*.ts")):
    if any(part in SKIP for part in path.parts):
        continue
    for i, line in enumerate(path.read_text().splitlines(), 1):
        if line.lstrip().startswith(("*", "//", "/*")):
            continue
        if CALL_RE.search(line) or ANY_RE.search(line):
            leftover.append(f"{path}:{i}: {line.strip()[:90]}")

print("rewrote:", len(changed), "file(s)")
for c in changed:
    print("  ", c)
if leftover:
    print("LEFTOVER:")
    for l in leftover:
        print("  ", l)
    sys.exit(1)
print("no host* accessor left in handler code")