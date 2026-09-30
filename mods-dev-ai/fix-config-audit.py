"""Move the placement definition from the nested spot to the config root.

The registration loop in `src/register/the-rest.ts` iterates
`config.placementConfigs`, but the entry was attached to the generator
structure as `structures[...].placementConfigs`. The loop therefore never saw
it and `registerPlacementConfig` was never called -- a silent no-op that still
passed the tests, because the tests read the same nested location.

The engine keys placement configs off `structureId`, not off nesting, so the
entry keeps pointing at the generator from the root.

Idempotent: running it again on an already-correct file is a no-op.
"""
"""
Fix the three classes of config defect the panel audit turned up.

None of these are panel bugs. In every case the panel was refusing to save an
entry that the game itself accepts and runs:

  1. `artefact-emit` has no `scope`, and it is referenced from a `processing`
     entry. `processProblem` compares `p.scope !== slot`, so `undefined !==
     "processing"` and `compileCustomProcess` refused it -- the artefact emit
     tick never ran at all.

  2. The three `artefact-link-*-on` processes declare `scope: "signal"` but are
     referenced from BOTH a signal entry and a `processing` entry. The scope
     check is deliberately strict (`compile.ts`: a slot's context is seeded
     differently, so half the seeds would be permanently absent), so one
     process cannot serve both. The fix is a processing-scoped twin per
     material rather than loosening the rule.

     The twin drops `signalOutput`: emitting is the signal entry's job, and the
     signal still fires exactly as before.

Idempotent. Every change is asserted after it is made, so a step that quietly
does nothing (inserting a key next to a key this entry does not have, say)
fails loudly instead of printing a success line.
"""
import json

PATH = "__home/md-random-artefact/config/random-artefact.json"

cfg = json.load(open(PATH))
procs = cfg["processes"]
by_id = {p["id"]: p for p in procs}
removed = False

# 1. The emit tick runs in a processing slot; say so.
emit = by_id.get("artefact-emit")
if not emit:
    raise SystemExit("artefact-emit is missing from the config")
if emit.get("scope") != "processing":
    # Insert right after `id`, which every process has. (An earlier version
    # anchored on `name`; this entry spells it `label`, so the insert matched
    # nothing and the run still printed a success line.)
    ordered = {}
    for k, v in emit.items():
        ordered[k] = v
        if k == "id":
            ordered["scope"] = "processing"
    emit.clear()
    emit.update(ordered)
    assert emit.get("scope") == "processing", "scope insert did not take"
    print("artefact-emit: scope -> processing")
else:
    print("artefact-emit: already processing")

# 2. A processing twin for each shared link process.
for mat in ("gold", "copper", "sand"):
    src_id = f"artefact-link-{mat}-on"
    twin_id = f"artefact-link-{mat}-sync"
    src = by_id.get(src_id)
    if not src:
        raise SystemExit(f"{src_id} is missing from the config")
    if by_id.get(twin_id):
        print(f"{twin_id}: already present")
    else:
        twin = {
            "id": twin_id,
            "name": f"Artefact {mat.capitalize()} Link — per-tick sync",
            "scope": "processing",
            "steps": [s for s in src["steps"] if s["key"] != "signalOutput"],
        }
        assert "signalOutput" not in [s["key"] for s in twin["steps"]]
        procs.append(twin)
        by_id[twin_id] = twin
        print(f"{twin_id}: created ({len(twin['steps'])} steps, no signalOutput)")

    # Repoint the processing entry at the twin.
    moved = 0
    for pe in cfg["processing"]:
        if pe.get("processId") == src_id:
            pe["processId"] = twin_id
            moved += 1
    if moved:
        print(f"  processing x{moved}: processId -> {twin_id}")

    # The signal must keep the ORIGINAL, or the signal stops firing.
    for s in cfg.get("signals", []):
        if s.get("processId") == src_id:
            print(f"  signal {s['id']}: still on {s['processId']}")

# No process may be referenced from a slot its scope does not name.
scopes = {p["id"]: p.get("scope") for p in cfg["processes"]}
bad = []
for list_name, slot in (
    ("processing", "processing"),
    ("signals", "signal"),
    ("triggers", "trigger"),
):
    for e in cfg.get(list_name, []):
        pid = e.get("processId")
        if pid and scopes.get(pid) != slot:
            bad.append(f"{e['id']} -> {pid} (scope={scopes.get(pid)}, slot={slot})")

# 3. `removeStructure` was handed an option it does not declare.
#
#    `processProblem`'s scope check runs FIRST and, when it fires,
#    `compileCustomProcess` returns the `empty` stub — whose `unknownOptions` is
#    `[]`. So while `artefact-emit` was being refused for scope, this step was
#    never type-checked at all, and `generator-eat.test.ts`'s
#    "an option no action declares" assertion passed on a process that had not
#    been compiled. Fixing the scope exposed it.
#
#    `REGION_PARAMS` already defaults dx=0, dy=0, size=1 — "from my own cell" —
#    so a bare `removeStructure` *is* "delete myself". The option was never needed.
def prune(step):
    """Drop the stray option from this step and from every step nested in it."""
    global removed
    opts = step.get("options") or {}
    if step.get("key") == "removeStructure" and "structure" in opts:
        del opts["structure"]
        if not opts:
            del step["options"]
        removed = True
    for branch in ("then", "else"):
        for child in step.get(branch) or []:
            prune(child)


for p in cfg["processes"]:
    for step in p.get("steps") or []:
        prune(step)

if removed:
    print("stray removeStructure.structure option(s) removed "
          "(the default region — dx0/dy0/size1 — is already 'my own cell')")
else:
    print("no stray removeStructure.structure option")

out = json.dumps(cfg, indent=2, ensure_ascii=False) + "\n"
open(PATH, "w").write(out)

print("\n--- scopes ---")
for p in cfg["processes"]:
    print(f"  {p['id']:30} scope={p.get('scope')}")
print(f"\n--- mismatches remaining: {len(bad)} ---")
for b in bad:
    print(f"  {b}")
