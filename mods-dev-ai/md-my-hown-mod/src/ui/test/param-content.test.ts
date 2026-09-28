import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { paramInput } from "../param-controls.ts";
import { type ContentKind, HANDLER_META } from "../../handler/core/handler-registry.ts";
import type { SelectorHandle } from "../definition/types.ts";

/**
 * Content parameters reach the **shared** selector, not a text box.
 *
 * This is the whole point of the change, so the test is the whole point too. Three
 * separate pieces have to line up and each can fail alone:
 *
 * 1. the parameter declares `content` (registry),
 * 2. `paramInput` asks the panel rather than drawing a box (widgets),
 * 3. the panel answers with the real catalogue lister (panel).
 *
 * A regression in any one of them is invisible — the field still renders, it just renders
 * as something the author has to type into. So the fake below asserts on the *request*,
 * which is the seam where all three meet.
 */

/** A `FieldContext`-shaped stub, only as much as `paramInput` reads. */
const fakeH = (
    _tag: string,
    _props: Record<string, unknown> | null,
    ..._children: unknown[]
): unknown => ({ tag: _tag, props: _props });

/** Every content parameter currently declared, and its kind. */
function contentParams(): { key: string; content: ContentKind }[] {
    const out: { key: string; content: ContentKind }[] = [];
    for (const meta of HANDLER_META) {
        for (const p of meta.params) {
            if (p.content) out.push({ key: p.key, content: p.content });
        }
    }
    return out;
}

Deno.test("every content parameter declares a kind, and all three are used", () => {
    const found = contentParams();
    assert(found.length > 0, "there are content parameters at all");
    // Exactly the three families. Adding a fourth `ContentKind` without wiring a lister
    // is a type error in the panel's `CONTENT_LISTERS`, and this fails if a kind is
    // declared but never used — the other half of that mistake.
    const kinds = new Set(found.map((f) => f.content));
    assertEquals([...kinds].sort(), ["element", "structure", "terrain"]);
});

Deno.test("no content parameter is still a bare text box", () => {
    // The regression this file exists to catch, stated directly. A `text` param whose key
    // is one of the content keys is the old behaviour under a new name.
    const CONTENT_KEYS = new Set(["element", "structure", "terrain"]);
    const strays = HANDLER_META.flatMap((m) =>
        m.params
            .filter((p) => p.kind === "text" && CONTENT_KEYS.has(p.key))
            .map((p) => `${m.key}.${p.key}`)
    );
    assertEquals(strays, [], "a content key left as a text param");
});

Deno.test("a content parameter is rendered by the panel's selector", () => {
    let asked: { content?: string; placeholder?: string } | null = null;
    const handle: SelectorHandle = {
        read: () => undefined,
        write: () => {},
        renderParam: (req) => {
            asked = { content: req.content, placeholder: req.placeholder };
            return { tag: "selector" };
        },
    };
    const param = HANDLER_META.flatMap((m) => m.params).find((p) => p.content)!;
    const out = paramInput(fakeH, param, "stone", () => {}, handle);
    assertEquals(out, { tag: "selector" });
    assertEquals(asked, { content: param.content, placeholder: "— select —" });
});

Deno.test("a fixed enum is still a native select, not the selector", () => {
    // The other half of the branch. `content` absent means the panel returns null, and the
    // widget must fall through to a `<select>` — routing enums through the content picker
    // would be a regression in the other direction.
    let asked = 0;
    const handle: SelectorHandle = {
        read: () => undefined,
        write: () => {},
        renderParam: () => {
            asked++;
            return null;
        },
    };
    const out = paramInput(
        fakeH,
        { key: "mode", label: "Mode", kind: "select", options: [{ value: "a", label: "A" }] },
        "a",
        () => {},
        handle,
    ) as { tag: string; props: Record<string, unknown> };
    assertEquals(out.tag, "select", "an enum is a plain select");
    assertEquals(asked, 1, "but it did ask, and was told no");
});

Deno.test("with no handle, a content parameter degrades to a text box", () => {
    // The contexts that have no panel — a projectile option screen rendered standalone, a
    // unit test. Losing the field entirely would be worse than a text box, and this is
    // what makes `selector` safe to leave optional on `PanelContext`.
    const param = HANDLER_META.flatMap((m) => m.params).find((p) => p.content)!;
    const out = paramInput(fakeH, param, "stone", () => {}) as { tag: string };
    assertEquals(out.tag, "input");
});
