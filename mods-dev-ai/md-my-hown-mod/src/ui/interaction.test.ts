/**
 * The `ElementInteraction` union, split into form fields and put back together.
 *
 * The engine stores this object verbatim, so the two directions that matter are
 * "a kind only emits the fields it actually has" and "an object the form does
 * not model is never quietly rewritten". Both are checked here, because the
 * failure mode is silent: a re-composed object that dropped a field would still
 * register cleanly and just do less than the author asked for.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import {
    DATA_FIELD_MODES,
    INTERACTION_KINDS,
    TOOLTIP_KINDS,
    composeInteraction,
    splitInteraction,
} from "./interaction.ts";

const kinds = INTERACTION_KINDS.map((k) => k.kind);

Deno.test("every kind in the union is offered", () => {
    // The seven from `elements.d.ts`. A kind missing here is one the user
    // literally cannot create.
    assertEquals(kinds.sort(), [
        "custom",
        "destroyer",
        "entity",
        "flammable",
        "freezable",
        "meltable",
        "structure",
    ]);
});

Deno.test("every kind explains itself", () => {
    for (const k of INTERACTION_KINDS) {
        assert(k.label.length > 3, `${k.kind} has no label`);
        assert(k.blurb.length > 10, `${k.kind} has no explanation`);
    }
});

Deno.test("an empty form stores nothing", () => {
    // Otherwise a blank entry would gain `{ kind: "" }` and the engine would be
    // handed an object matching no union member.
    assertEquals(composeInteraction({}), undefined);
});

Deno.test("an unknown kind stores nothing rather than guessing", () => {
    assertEquals(composeInteraction({ interactionKind: "teleports" }), undefined);
});

Deno.test("a flag-only kind emits nothing but its discriminator", () => {
    for (const kind of ["flammable", "meltable", "freezable"]) {
        assertEquals(composeInteraction({ interactionKind: kind }), { kind });
    }
});

Deno.test("a flag-only kind ignores fields belonging to another kind", () => {
    // This is the whole point of the rebuild: no more "why is my tooltip asking
    // about items" because one flat box held everything.
    assertEquals(
        composeInteraction({
            interactionKind: "flammable",
            structures: "crusher",
            destroyerItems: "drill",
            tipTextKey: "mods|x|y",
        }),
        { kind: "flammable" },
    );

});

Deno.test("the structure kind emits structures", () => {
    assertEquals(
        composeInteraction({ interactionKind: "structure", structures: "crusher, press" }),
        { kind: "structure", structures: ["crusher", "press"] },
    );
});

Deno.test("an empty id list is omitted, not stored as []", () => {
    // `structures: []` would show an empty tooltip row in game.
    assertEquals(
        composeInteraction({ interactionKind: "structure", structures: "  ,  " }),
        { kind: "structure" },
    );
});

Deno.test("tooltip metadata is only built for kinds that use it", () => {
    for (const kind of TOOLTIP_KINDS) {
        const out = composeInteraction({
            interactionKind: kind,
            tipTextKey: "mods|acid|burns",
            tipVisibility: "visibleWhen",
            tipDataField: "2",
            tipDataFieldEquals: "1",
        }) as Record<string, unknown>;
        assertEquals(out.textKey, "mods|acid|burns", kind);
        assertEquals(out.visibleWhen, { dataField: 2, equals: 1 }, kind);
    }
    // And not for the others.
    assertEquals(
        composeInteraction({
            interactionKind: "destroyer",
            tipTextKey: "mods|x|y",
            tipVisibility: "visibleWhen",
            tipDataField: "1",
            tipDataFieldEquals: "1",
        }),
        { kind: "destroyer" },
    );
});

Deno.test("a half-filled visibility rule is not written", () => {
    // `{ visibleWhen: { dataField: NaN } }` would be worse than no rule.
    assertEquals(
        composeInteraction({
            interactionKind: "custom",
            tipVisibility: "visibleWhen",
            tipDataField: "",
            tipDataFieldEquals: "1",
        }),
        { kind: "custom" },
    );
});

Deno.test("onlyWhenTranslated round-trips", () => {
    const out = composeInteraction({
        interactionKind: "custom",
        tipOnlyWhenTranslated: "true",
    });
    assertEquals(out, { kind: "custom", onlyWhenTranslated: true });
    assertEquals(splitInteraction(out).fields.tipOnlyWhenTranslated, "true");
});

Deno.test("every kind survives a split/compose round trip", () => {
    const samples: Record<string, unknown>[] = [
        { kind: "flammable" },
        { kind: "meltable" },
        { kind: "freezable" },
        { kind: "destroyer", items: ["drill"] },
        { kind: "structure", structures: ["crusher"] },
        { kind: "entity", entities: ["enemy"] },
        { kind: "custom", textKey: "mods|x|y" },
        {
            kind: "structure",
            structures: ["crusher"],
            textKey: "mods|x|y",
            crossedOutWhen: { dataField: 3, equals: 0 },
            onlyWhenTranslated: true,
        },
    ];
    for (const s of samples) {
        const back = composeInteraction(splitInteraction(s).fields);
        assertEquals(back, s, JSON.stringify(s));
    }
});

Deno.test("an object the form does not model is flagged, not dropped", () => {
    const { unmodelled } = splitInteraction({
        kind: "custom",
        textKey: "mods|x|y",
        futureThing: 42,
    });
    assert(unmodelled, "an unknown key was not reported");
});

Deno.test("a fully modelled object is not flagged", () => {
    assertEquals(
        splitInteraction({ kind: "structure", structures: ["a"], textKey: "k" }).unmodelled,
        false,
    );
    assertEquals(splitInteraction({ kind: "flammable" }).unmodelled, false);
});

Deno.test("an unknown kind still round-trips its extra fields", () => {
    // The engine may add an eighth kind. The form must not rewrite it into
    // `{ kind: "custom" }` on the next save.
    const stored = { kind: "brandNewKind", payload: [1, 2, 3] };
    const { fields, unmodelled } = splitInteraction(stored);
    assertEquals(fields.interactionKind, "brandNewKind");
    assert(unmodelled);
    // compose declines, which is the signal to keep the original verbatim.
    assertEquals(composeInteraction(fields), undefined);
});

Deno.test("an empty or missing object splits to nothing", () => {
    assertEquals(splitInteraction(undefined).fields, {});
    assertEquals(splitInteraction(undefined).unmodelled, false);
});

Deno.test("the visibility modes cover exactly the two the engine reads", () => {
    // The interaction metadata uses visibleWhen / crossedOutWhen and nothing
    // else, so a fourth option would be invented.
    assertEquals(
        DATA_FIELD_MODES.map((m) => m.value),
        ["", "visibleWhen", "crossedOutWhen"],
    );
});
