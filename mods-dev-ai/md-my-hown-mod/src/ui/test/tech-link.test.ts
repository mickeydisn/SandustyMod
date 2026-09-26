// @ts-nocheck
/**
 * The structure ↔ tech-node relation.
 *   deno test -A src/ui/tech-link.test.ts
 *
 * The engine grants a node's `unlocks.structures` on purchase, pushing each id
 * into `player.buildings` (bundel.js 77135.js) — so a tech is a real second route
 * to the build menu. What is pinned here is the panel's own bookkeeping: which
 * side owns the link, what happens when a node is deleted, and that the generated
 * node is editable rather than a one-shot.
 */
import { assert, assertEquals } from "jsr:@std/assert";

globalThis.sandkit = {
    api: { storage: { ensure: () => {}, get: () => undefined, set: () => {}, remove: () => {} } },
};

const {
    DEFAULT_UNLOCK_NODE,
    allUnlockNodes,
    defaultUnlockNode,
    unlockNodeOf,
    isAlwaysUnlocked,
    structuresForNode,
    engineTechOf,
    techUnlockStructureIds,
    describeNode,
    unlockLine,
} = await import("../tech-link.ts");

/** One structure, no node set — which is the built-in default. */
const base = () => ({
    structures: [{ id: "me:a", name: "A" }],
    unlockNodes: [],
    techs: [],
});

/** Two structures gated by a node that builds its own tech. */
const gated = () => ({
    structures: [
        { id: "me:a", unlockNode: "me:u1" },
        { id: "me:b", unlockNode: "me:u1" },
        { id: "me:c" },
    ],
    unlockNodes: [{ id: "me:u1", name: "Tier 1", kind: "tech", cost: 50 }],
    techs: [],
});

Deno.test("a structure with no node is available from the start", () => {
    assertEquals(unlockNodeOf("me:a", base()).id, DEFAULT_UNLOCK_NODE);
    assertEquals(isAlwaysUnlocked("me:a", base()), true);
});

Deno.test("the default is a listed option, not an empty field", () => {
    // A structure always *names* something. A virtual default satisfies that
    // without every config carrying a literal entry for it.
    const nodes = allUnlockNodes(base());
    assertEquals(nodes[0].id, DEFAULT_UNLOCK_NODE);
    assertEquals(nodes[0].kind, "always");
    assertEquals(defaultUnlockNode().name, "Unlock by default");
});

Deno.test("a 'tech' node gates the structure", () => {
    assertEquals(unlockNodeOf("me:a", gated()).name, "Tier 1");
    assertEquals(isAlwaysUnlocked("me:a", gated()), false);
});

Deno.test("a dangling node gates nothing", () => {
    // The failure a strict "must name a node" reading would cause: the structure
    // would be in neither set — gone from a fresh game with nothing to say why.
    const cfg = { ...base(), structures: [{ id: "me:a", unlockNode: "me:gone" }] };
    assertEquals(isAlwaysUnlocked("me:a", cfg), true);
    assertEquals(unlockNodeOf("me:a", cfg).id, DEFAULT_UNLOCK_NODE);
});

Deno.test("one node holds back many structures", () => {
    assertEquals(structuresForNode("me:u1", gated()), ["me:a", "me:b"]);
    assertEquals(structuresForNode(DEFAULT_UNLOCK_NODE, gated()), ["me:c"]);
});

Deno.test("a 'tech' node builds the engine tech the engine will read", () => {
    // The point of the category: editing the node edits the real tech, so
    // `unlocks.structures` has to be filled in from the structures naming it —
    // the engine reads nothing else.
    const tech = engineTechOf({ id: "me:u1", kind: "tech", name: "T1", cost: 50 }, gated());
    assertEquals(tech.id, "me:u1");
    assertEquals(tech.cost, 50);
    assertEquals(tech.name, "T1");
    assertEquals(tech.unlocks.structures, ["me:a", "me:b"]);
});

Deno.test("an 'always' node builds no engine tech at all", () => {
    assertEquals(engineTechOf(defaultUnlockNode(), base()), undefined);
    assertEquals(engineTechOf({ id: "me:u", kind: "always" }, base()), undefined);
});

Deno.test("a node may borrow an engine tech instead of building one", () => {
    // The borrowed tech keeps its own definition — returning the stored entry is
    // what stops `apply.ts` overwriting a hand-written tech with the fields of
    // whichever node happens to point at it.
    //
    // `a` and `b` are gated by `u2`, the borrowing node, so their unlocks belong
    // on `t1`. Had they been left on `u1` they would ride on `u1`'s own tech and
    // never reach `t1` at all.
    const cfg = {
        structures: [{ id: "me:a", unlockNode: "me:u2" }, { id: "me:b", unlockNode: "me:u2" }],
        unlockNodes: [{ id: "me:u2", name: "Shared", kind: "tech", techId: "me:t1" }],
        techs: [{ id: "me:t1", name: "Existing", cost: 999, unlocks: { structures: ["me:z"] } }],
    };
    const node = { id: "me:u2", kind: "tech", techId: "me:t1" };
    assertEquals(engineTechOf(node, cfg).name, "Existing");
    assertEquals(engineTechOf(node, cfg).cost, 999);
    // The borrowed tech's own list, plus the borrowing node's structures.
    assertEquals(techUnlockStructureIds("me:t1", cfg).sort(), ["me:a", "me:b", "me:z"]);
});

Deno.test("borrowing a tech that does not exist yields nothing", () => {
    // No tech, and none invented: the structure stays gated rather than the panel
    // making up a definition the engine never agreed to.
    assertEquals(
        engineTechOf({ id: "me:u2", kind: "tech", techId: "me:gone" }, gated()),
        undefined,
    );
});

Deno.test("the engine's unlock list is a union, and grants a structure once", () => {
    const cfg = { ...gated(), techs: [{ id: "me:u1", unlocks: { structures: ["me:a", "me:z"] } }] };
    // `me:a` is named by the node *and* listed by the hand-written tech.
    assertEquals(techUnlockStructureIds("me:u1", cfg), ["me:a", "me:z", "me:b"]);
});

Deno.test("the node line says what the game will do", () => {
    const d = describeNode(defaultUnlockNode());
    assert(d.includes("Available from the start"), d);

    const t = describeNode({ id: "me:u1", name: "Tier 1", kind: "tech", cost: 50 });
    assert(t.includes("Tier 1"), t);
    assert(t.includes("50"), t);
    assert(t.includes("in-game tech node"), t);

    const b = describeNode({ id: "me:u2", name: "Shared", kind: "tech", techId: "me:t1" });
    assert(b.includes("me:t1"), b);
});

Deno.test("the node line for an unsaved structure matches its picker", () => {
    // A new form has no id to resolve through, so the line has to describe the
    // node the *picker* holds — otherwise the two disagree while typing.
    assertEquals(unlockLine({}, base()), describeNode(defaultUnlockNode()));
    assertEquals(
        unlockLine({ unlockNode: "me:u1" }, gated()),
        describeNode(gated().unlockNodes[0]),
    );

    // The dangling case: showing only the id would claim a link that does nothing,
    // because the game treats a dangling node as unlocked.
    const line = unlockLine({ unlockNode: "me:gone" }, base());
    assert(line.includes("no longer exists"), line);
    assert(line.includes("available from the start"), line);
});
