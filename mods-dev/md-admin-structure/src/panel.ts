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
    const e = h;
    if (!react || !e) return null;

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

    return e(
        "div",
        { style: styles.panel },
        e(
            "div",
            { style: styles.header },
            e(
                "span",
                { style: { flex: 1 } },
                `STRUCTURES · ${shown.length}/${all.length}`,
            ),
            e(
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
        e(
            "div",
            { style: styles.filters },
            e("label", { style: { color: COLORS.dim } }, "Mod:"),
            e(
                "select",
                {
                    value: filterMod,
                    style: styles.select,
                    onChange: (e: Event) => setFilterMod((e.target as HTMLSelectElement).value),
                },
                e("option", { value: "" }, "All"),
                ...mods.map((m) => e("option", { value: m, key: m }, m)),
            ),
            e("label", { style: { color: COLORS.dim } }, "Menu:"),
            e(
                "select",
                {
                    value: filterMenu,
                    style: styles.select,
                    onChange: (e: Event) => setFilterMenu((e.target as HTMLSelectElement).value),
                },
                e("option", { value: "" }, "All"),
                e("option", { value: "hidden" }, "Hidden"),
                e("option", { value: "shown" }, "Shown"),
            ),
        ),
        e(
            "div",
            { style: styles.list },
            shown.map((r) =>
                e(
                    "div",
                    { key: r.id, style: styles.row },
                    e(
                        "span",
                        { style: { color: COLORS.dim } },
                        r.hidden ? ICON_HIDDEN : ICON_SHOWN,
                    ),
                    e("span", { style: styles.grow }, r.id),
                    e("span", { style: { color: COLORS.dim, flexShrink: 0 } }, r.category),
                    e(
                        "span",
                        { style: { color: COLORS.dim, width: "150px", flexShrink: 0 } },
                        r.mod,
                    ),
                    e(
                        "button",
                        {
                            style: r.unlocked ? styles.unlocked : styles.button,
                            onClick: () => unlock(r.id),
                        },
                        r.unlocked ? "Unlocked" : "Unlock",
                    ),
                    e(
                        "button",
                        { style: styles.lock, onClick: () => remove(r.id) },
                        "Remove",
                    ),
                )
            ),
        ),
        e("div", { style: styles.footer }, `${TOGGLE_LABEL} toggles · v${VERSION}`),
    );
}
