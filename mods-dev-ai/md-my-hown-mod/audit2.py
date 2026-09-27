"""Audit comment length: 50 words for a module header, 20 for everything else."""
import re
import sys
from pathlib import Path

MODULE_LIMIT = 50  # the module header may explain the file; nothing else may
OTHER_LIMIT = 20
ROOT = Path("src")

BLOCK = re.compile(r"/\*\*(.*?)\*/", re.S)
LINES = re.compile(r"(?:^[ \t]*//.*(?:\n|$))+", re.M)
FENCE = re.compile(r"```.*?```", re.S)


def words(text: str) -> int:
    body = FENCE.sub(" ", re.sub(r"^\s*\*", "", text, flags=re.M))
    body = re.sub(r"^\s*//", "", body, flags=re.M)
    return len(body.split())


def spans(src: str):
    """Every comment span, tagged as the module header or not."""
    code = re.sub(BLOCK, lambda m: " " * len(m.group(0)), src)
    code = re.sub(LINES, lambda m: " " * len(m.group(0)), code)
    first = len(src) - len(code.lstrip())
    for m in BLOCK.finditer(src):
        yield m.start(), m.end(), m.group(1), m.start() < first, m.group(0)
    for m in LINES.finditer(src):
        if m.start() >= first:
            continue  # already yielded as part of a leading block
        yield m.start(), m.end(), m.group(0), m.start() < first, m.group(0)


rows = []
only = [a for a in sys.argv[1:] if not a.startswith("--")]
for path in sorted(ROOT.rglob("*.ts")):
    if path.name.endswith(".d.ts"):
        continue  # generated
    if only and not any(path.name == o or str(path) == o for o in only):
        continue
    src = path.read_text()
    for start, _end, text, is_module, raw in spans(src):
        n = words(text)
        limit = MODULE_LIMIT if is_module else OTHER_LIMIT
        if n > limit:
            rows.append((n, limit, str(path), src[:start].count("\n") + 1, is_module, raw))

if "--dump" in sys.argv:
    for n, limit, path, line, is_module, raw in rows:
        print(f"===== {n}w /{limit}  {path}:{line} =====")
        print(raw)
    print(f"\n{len(rows)} over the limit")
else:
    for n, limit, path, line, is_module, _ in sorted(rows, reverse=True):
        tag = "MOD" if is_module else "   "
        print(f"{n:4d}w/{limit:<3d} {tag} {path}:{line}")
    print(f"\n{len(rows)} over the limit; "
          f"{sum(r[0] - r[1] for r in rows)} excess words")
