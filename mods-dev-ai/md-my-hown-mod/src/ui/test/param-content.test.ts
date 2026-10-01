import { assert, assertEquals } from "https:
import { paramInput } from "../param-controls.ts";
import { type ContentKind, HANDLER_META } from "../../handler/core/handler-registry.ts";
import type { SelectorHandle } from "../definition/types.ts";




const fakeH = (
    _tag: string,
    _props: Record<string, unknown> | null,
    ..._children: unknown[]
): unknown => ({ tag: _tag, props: _props });


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
    
    
    
    const kinds = new Set(found.map((f) => f.content));
    assertEquals([...kinds].sort(), ["element", "structure", "terrain"]);
});

Deno.test("no content parameter is still a bare text box", () => {
    
    
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
    
    
    
    const param = HANDLER_META.flatMap((m) => m.params).find((p) => p.content)!;
    const out = paramInput(fakeH, param, "stone", () => {}) as { tag: string };
    assertEquals(out.tag, "input");
});
