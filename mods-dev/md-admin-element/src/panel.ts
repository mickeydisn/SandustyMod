/**
 * mdadmin — the injected panel.
 *
 * Lists every registered element with its owning mod. Rows belonging to a mod
 * registered in this session get a Remove button; removals are remembered in
 * mod storage (see `registry.ts`) so they do not come back on reload.
 */
import { h, React, toast } from "./api.ts";
import { TOGGLE_LABEL, VERSION } from "./constants.ts";
import {
    loadRemoved,
    modRegistry,
    reapplyRemovals,
    registeredRows,
    removeElement,
    saveRemoved,
} from "./registry.ts";
import { setRepaint, state } from "./state.ts";
import { COLORS, styles } from "./styles.ts";

export function MdAdminPanel(): unknown {
    // Local aliases: imported bindings are not narrowed inside callbacks, and the
    // panel is only mounted once the guard in init() passed.
    const react = React;
    const create = h;
    if (!react || !create) return null;

    const [, setBump] = react.useState(0);

    react.useEffect(() => {
        setRepaint(setBump);
        return () => setRepaint(null);
    }, []);

    if (!state.open) return null;

    // Scrub remembered removals before reading the registry. Safe to run in the
    // render phase: the delete is idempotent and touches only sandkit's map,
    // never React state.
    reapplyRemovals();

    const rows = registeredRows();
    const removableCount = rows.filter((r) => r.removable).length;
    const rememberedCount = loadRemoved().length;

    const remove = (id: string): void => {
        if (!removeElement(id)) return;
        toast(`Removed ${id}`);
        setBump((v) => v + 1);
    };
    const removeAll = (): void => {
        const registry = modRegistry();
        const ids = registry ? Object.keys(registry) : [];
        if (ids.length === 0) return;
        for (const id of ids) removeElement(id);
        toast(`Removed ${ids.length} mod element${ids.length === 1 ? "" : "s"}`);
        setBump((v) => v + 1);
    };
    const forgetAll = (): void => {
        const removed = loadRemoved();
        if (removed.length === 0) return;
        saveRemoved([]);
        toast(`Forgot ${removed.length} removal${removed.length === 1 ? "" : "s"}`);
        setBump((v) => v + 1);
    };

    return create(
        "div",
        { style: styles.panel },
        create(
            "div",
            { style: styles.header },
            create(
                "span",
                { style: { flex: 1 } },
                `MD ADMIN · ${rows.length} element${rows.length === 1 ? "" : "s"}`,
            ),
            create(
                "button",
                { style: styles.danger, disabled: removableCount === 0, onClick: removeAll },
                `Remove ${removableCount}`,
            ),
            create(
                "button",
                {
                    style: styles.button,
                    disabled: rememberedCount === 0,
                    onClick: forgetAll,
                    title: "Forget every remembered removal (restore)",
                },
                "Reset",
            ),
            create(
                "button",
                {
                    style: styles.button,
                    onClick: () => {
                        state.open = false;
                        setBump((v) => v + 1);
                    },
                },
                "×",
            ),
        ),
        create(
            "div",
            { style: styles.list },
            rows.map((r) =>
                create(
                    "div",
                    { key: r.id, style: styles.row },
                    create("div", { style: { ...styles.swatch, background: r.color } }),
                    create("span", { style: { color: COLORS.dim } }, String(r.type)),
                    create("span", { style: styles.grow }, r.name),
                    create("span", { style: { color: COLORS.dim } }, r.mod),
                    r.removable
                        ? create(
                            "button",
                            { style: styles.danger, onClick: () => remove(r.id) },
                            "Remove",
                        )
                        : null,
                )
            ),
        ),
        create(
            "div",
            { style: styles.footer },
            `${rememberedCount} remembered · ${TOGGLE_LABEL} toggles · v${VERSION}`,
        ),
    );
}
