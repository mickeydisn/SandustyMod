"""One-off, ALREADY APPLIED: normalise the handler imports to `sk`.

Run from the mod root:  python3 tools/fix-imports.py

Rewrites every `import { ... } from ".../types.ts"` block — single- or multi-line —
to drop the `host*` accessor names and carry `sk` instead, and does the same for
the re-export block in `core/types.ts`. Written as a script because the blocks
span lines and a hand edit per file is exactly the kind of drift this whole change
exists to remove.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path("src/handler")
SKIP = {"test"}
BLOCK_RE = re.compile(r"import \{([^}]*)\} from (\"[^\"]*types\.ts\");")
EXPORT_RE = re.compile(r"export \{([^}]*)\} from (\"[^\"]*host\.ts\");")

changed = []
for path in sorted(ROOT.rglob("*.ts")):
    if any(part in SKIP for part in path.parts):
        continue
    src = original = path.read_text()

    def fix(match: "re.Match[str]") -> str:
        names = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", match.group(1))
        kept = sorted({n for n in names if not n.startswith("host")})
        if "sk" not in kept and match.group(2).endswith("types.ts"):
            kept.append("sk")
        kept = sorted(set(kept))
        if not kept:
            return ""
        one_line = "{ " + ", ".join(kept) + " }"
        if len(one_line) <= 76:
            return f"import {one_line} from {match.group(2)};"
        body = "".join(f"    {n},\n" for n in kept)
        return f"import {{\n{body}}} from {match.group(2)};"

    src = BLOCK_RE.sub(fix, src)
    src = EXPORT_RE.sub(fix, src)
    src = re.sub(r"\n\n\n+", "\n\n", src)

    if src != original:
        path.write_text(src)
        changed.append(str(path))

print("rewrote:", len(changed), "file(s)")
for c in changed:
    print("  ", c)

leftover = []
for path in sorted(ROOT.rglob("*.ts")):
    if any(part in SKIP for part in path.parts):
        continue
    for i, line in enumerate(path.read_text().splitlines(), 1):
        if line.lstrip().startswith(("*", "//", "/*")):
            continue
        if re.search(r"\bhost(?:Grid|Elements|Structures|Terrains|Signals|Energy|Tech|Player|Upgrades|Projectiles|Ui|Effects|Random|Input|Ns)\b", line):
            leftover.append(f"{path}:{i}: {line.strip()[:90]}")

if leftover:
    print("LEFTOVER:")
    for l in leftover:
        print("  ", l)
    sys.exit(1)
print("imports normalised")