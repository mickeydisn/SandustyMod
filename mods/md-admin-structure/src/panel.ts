/**
 * md-admin-structure — the injected panel.
 *
 * Filters the structure list by owning mod and by `hideFromBuildMenu`, and
 * exposes one-click Unlock / Remove per row.
 */
import { api, h, React, safe, toast } from "./api.ts";
import { ICON_HIDDEN, ICON_SHOWN, TOGGLE_LABEL, VERSION } from "./constants.ts";
import { structureRows } from "./data.ts";
import { setRepaint, state } from "./state.ts";
import { COLORS, styles } from "./styles.ts";

export function StructurePanel(): unknown {
    // Local aliases: imported bindings are not narrowed inside callbacks, and the
    // panel is only mounted once the guard in init() passed.
    const react = React;
    const create = h;
    if (!react || !create) return null;

    const [filterMod, setFilterMod] = react.useState<string>("");
    const [filterMenu, setFilterMenu] = react.useState<string>("");
    const [, setBump] = react.useState(0);

    react.useEffect(() => {
        setRepaint(setBump);
        return () => setRepaint(null);
    }, []);

    if (!state.open) return null;

    /** Repaint after the data sources (or a filter) changed. */
    const refresh = (): void => setBump((v) => v + 1);

    const unlock = (id: string): void => {
        safe(() => api.player.buildings.unlockById(id));
        toast(`Unlocked ${id}`);
        refresh();
    };
    const remove = (id: string): void => {
        safe(() => api.player.buildings.removeById(id));
        toast(`Removed ${id}`);
        refresh();
    };

    const all = structureRows();
    const mods = [...new Set(all.map((r) => r.mod))].sort();

    let shown = all;
    if (filterMod) shown = shown.filter((r) => r.mod === filterMod);
    if (filterMenu === "hidden") shown = shown.filter((r) => r.hidden);
    if (filterMenu === "shown") shown = shown.filter((r) => !r.hidden);

    return create(
        "div",
        { style: styles.panel },
        create(
            "div",
            { style: styles.header },
            create(
                "span",
                { style: { flex: 1 } },
                `STRUCTURES · ${shown.length}/${all.length}`,
            ),
            create(
                "button",
                {
                    style: styles.button,
                    onClick: () => {
                        state.open = false;
                        refresh();
                    },
                },
                "×",
            ),
        ),
        create(
            "div",
            { style: styles.filters },
            create("label", { style: { color: COLORS.dim } }, "Mod:"),
            create(
                "select",
                {
                    value: filterMod,
                    style: styles.select,
                    onChange: (e: Event) => setFilterMod((e.target as HTMLSelectElement).value),
                },
                create("option", { value: "" }, "All"),
                ...mods.map((m) => create("option", { value: m, key: m }, m)),
            ),
            create("label", { style: { color: COLORS.dim } }, "Menu:"),
            create(
                "select",
                {
                    value: filterMenu,
                    style: styles.select,
                    onChange: (e: Event) => setFilterMenu((e.target as HTMLSelectElement).value),
                },
                create("option", { value: "" }, "All"),
                create("option", { value: "hidden" }, "Hidden"),
                create("option", { value: "shown" }, "Shown"),
            ),
        ),
        create(
            "div",
            { style: styles.list },
            shown.map((r) =>
                create(
                    "div",
                    { key: r.id, style: styles.row },
                    create(
                        "span",
                        { style: { color: COLORS.dim } },
                        r.hidden ? ICON_HIDDEN : ICON_SHOWN,
                    ),
                    create("span", { style: styles.grow }, r.name),
                    create("span", { style: { color: COLORS.dim, flexShrink: 0 } }, r.category),
                    create(
                        "span",
                        { style: { color: COLORS.dim, width: "150px", flexShrink: 0 } },
                        r.mod,
                    ),
                    create(
                        "button",
                        {
                            style: r.unlocked ? styles.unlocked : styles.button,
                            onClick: () => unlock(r.id),
                        },
                        r.unlocked ? "Unlocked" : "Unlock",
                    ),
                    create(
                        "button",
                        { style: styles.lock, onClick: () => remove(r.id) },
                        "Remove",
                    ),
                )
            ),
        ),
        create("div", { style: styles.footer }, `${TOGGLE_LABEL} toggles · v${VERSION}`),
    );
}
