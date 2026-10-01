

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


const base = () => ({
    structures: [{ id: "me:a", name: "A" }],
    unlockNodes: [],
    techs: [],
});


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
    
    
    const cfg = { ...base(), structures: [{ id: "me:a", unlockNode: "me:gone" }] };
    assertEquals(isAlwaysUnlocked("me:a", cfg), true);
    assertEquals(unlockNodeOf("me:a", cfg).id, DEFAULT_UNLOCK_NODE);
});

Deno.test("one node holds back many structures", () => {
    assertEquals(structuresForNode("me:u1", gated()), ["me:a", "me:b"]);
    assertEquals(structuresForNode(DEFAULT_UNLOCK_NODE, gated()), ["me:c"]);
});

Deno.test("a 'tech' node builds the engine tech the engine will read", () => {
    
    
    
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
    
    
    
    
    
    
    
    const cfg = {
        structures: [{ id: "me:a", unlockNode: "me:u2" }, { id: "me:b", unlockNode: "me:u2" }],
        unlockNodes: [{ id: "me:u2", name: "Shared", kind: "tech", techId: "me:t1" }],
        techs: [{ id: "me:t1", name: "Existing", cost: 999, unlocks: { structures: ["me:z"] } }],
    };
    const node = { id: "me:u2", kind: "tech", techId: "me:t1" };
    assertEquals(engineTechOf(node, cfg).name, "Existing");
    assertEquals(engineTechOf(node, cfg).cost, 999);
    
    assertEquals(techUnlockStructureIds("me:t1", cfg).sort(), ["me:a", "me:b", "me:z"]);
});

Deno.test("borrowing a tech that does not exist yields nothing", () => {
    
    
    assertEquals(
        engineTechOf({ id: "me:u2", kind: "tech", techId: "me:gone" }, gated()),
        undefined,
    );
});

Deno.test("the engine's unlock list is a union, and grants a structure once", () => {
    const cfg = { ...gated(), techs: [{ id: "me:u1", unlocks: { structures: ["me:a", "me:z"] } }] };
    
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
    
    
    assertEquals(unlockLine({}, base()), describeNode(defaultUnlockNode()));
    assertEquals(
        unlockLine({ unlockNode: "me:u1" }, gated()),
        describeNode(gated().unlockNodes[0]),
    );

    
    
    const line = unlockLine({ unlockNode: "me:gone" }, base());
    assert(line.includes("no longer exists"), line);
    assert(line.includes("available from the start"), line);
});
