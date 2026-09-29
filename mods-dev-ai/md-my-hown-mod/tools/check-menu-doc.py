"""Check MENU.md against the code that draws the menu.

Run from the mod root:  python3 tools/check-menu-doc.py
Every number and every path in MENU.md is derived here, so the doc cannot drift
from the tables it claims to be a view of without this failing.
"""
import re
import sys

SCHEMA = "src/ui/schema.ts"
ATTACH = "src/ui/panel/attach.ts"
DOC = "MENU.md"

# Tabs that are one screen rather than a list of entries.
SCREENS = {"draws", "help", "map", "json"}
# Lists whose contents are written in code: no entry to add, edit or delete.
FIXED = {"excavationOption", "projectileOption"}


def section(text, start, end="\n};"):
    return text[text.index(start):text.index(end, text.index(start))]


def main():
    s = open(SCHEMA, encoding="utf-8").read()
    meta = section(s, "export const CATEGORY_META")
    labels = dict(re.findall(r'(\w+): \{\s*\n?\s*label: "([^"]+)"', meta))
    labels.update(dict(re.findall(r'(\w+): \{ label: "([^"]+)"', meta)))

    grp = section(s, "export const MENU_GROUPS", "\n];")
    # Keyed by the group's *label*, because that is what a path in MENU.md names.
    glabels = {v: k for k, v in re.findall(r'key: "(\w+)",\s*label: "([^"]+)"', grp)}
    owner = {}
    for g, cats in re.findall(r'key: "(\w+)"[\s\S]*?categories: \[([^\]]*)\]', grp):
        for c in re.findall(r'"(\w+)"', cats):
            owner[c] = g

    att = section(open(ATTACH, encoding="utf-8").read(), "export const ATTACHED")
    amap = {}
    for k, v in re.findall(r'(\w+): \[([^\]]*)\]', att):
        for c in re.findall(r'"(\w+)"', v):
            amap[c] = k

    doc = open(DOC, encoding="utf-8").read()
    lines = [l for l in doc.splitlines()
             if re.match(r"^[A-Z][a-z]+:", l) and "Group:Tab" not in l]
    lists = [l.rstrip(":").split(":") for l in lines
             if l.count(":") == 2 and not l.endswith(":")]
    edits = {l[:-5] for l in lines if l.endswith(":Edit")}

    bad = []
    for g, tab, lst in lists:
        path = f"{g}:{tab}:{lst}"
        if g not in glabels:
            bad.append((path, "unknown group"))
            continue
        # Keyed by the *list's* label: the third segment is the list, the second
        # is the tab it is reached from.
        key = next((k for k, v in labels.items() if v == lst), None)
        if key is None:
            bad.append((path, f"unknown list label {lst!r}"))
            continue
        real = amap[key] if key in amap else key
        if owner.get(real) != glabels[g]:
            bad.append((path, f"code draws it in the {owner.get(real)!r} group"))
            continue
        if key in amap and labels[amap[key]] != tab:
            bad.append((path, f"code draws it under the {labels[amap[key]]!r} tab"))
            continue
        if key in FIXED and path in edits:
            bad.append((path, "is a fixed list but claims :Edit"))
        if key not in FIXED and path not in edits:
            bad.append((path, "has no :Edit path"))

    tabs = len(owner)
    attached = len(amap)
    # No fixed list has its own tab — both are attached — so the fixed ones are
    # subtracted from the attached column, not from the tab column.
    ownTab = tabs - len(SCREENS)
    total = ownTab + attached
    editable = ownTab + (attached - len(FIXED))

    print(f"paths in doc      : {len(lists)} lists, {len(edits)} :Edit")
    print(f"code tabs         : {tabs}  (screens {len(SCREENS)})")
    print(f"code attached     : {attached}  (fixed {len(FIXED)})")
    print(f"code totals       : {total} lists = {editable} editable "
          f"({ownTab} own tab + {attached - len(FIXED)} attached) + {len(FIXED)} fixed")

    # The totals table in the doc, read back so it is checked and not trusted.
    want = {
        "Groups": len(glabels),
        "Tabs": tabs,
        "Single screens": len(SCREENS),
        "Lists": total,
        "Editable": editable,
        "Fixed, no `Edit`": len(FIXED),
        "Editable, attached": attached - len(FIXED),
        "Editable, own tab": ownTab,
    }
    for name, n in want.items():
        m = re.search(rf"\|\s*{re.escape(name)}\s*\|\s*(\d+)", doc)
        if not m:
            bad.append((name, "row missing from the totals table"))
        elif int(m.group(1)) != n:
            bad.append((name, f"doc says {m.group(1)}, code says {n}"))

    if bad:
        print("\nMISMATCHES:")
        for what, why in bad:
            print(f"  - {what}: {why}")
        return 1
    print("\nMENU.md matches the code.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
