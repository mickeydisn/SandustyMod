/**
 * Buffer Controls — connects a JsonBuffer record to placeable structures.
 *
 * Every path in the jsonBuffer record becomes a catalogue item (a
 * "BuildingList" like the sandustry-icons mod), grouped in categories:
 *   - "variables" — one structure per path, drawn with its kind icon
 *     (assets/types/*.png) plus the record path as text,
 *   - "value" — one structure per path, drawn with the kind icon plus the
 *     CURRENT value of that buffer path (refreshed live on every buffer update),
 *   - "action" — clickable buttons: +1 / -1 for number paths, toggle for bool
 *     paths. Clicking activates the action and writes the buffer (committed +
 *     published, so the value structures refresh).
 * A single unlocked menu entry (assets/other/display.png) opens the picker,
 * a custom overlay that lists the paths (icon + text) with category tabs.
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/dev";
import { loadSpriteMap } from "@sandmd/assets";
import { createBuildList } from "@sandmd/catalogue";
import type { BuildList, CatalogueCategory, CatalogueItem } from "@sandmd/catalogue";
import { JsonBuffer } from "@sandmd/buffer";

import {
    EXPOSED_KINDS,
    KIND_SPRITE_KEY,
    type PathCatalogueItem,
    registerPathStructures,
} from "./structure/register.ts";
import { formatBufferValue, registerValueStructures } from "./structure/valueRegister.ts";
import {
    ACTION_LABEL,
    registerActionStructures,
    type ActionCatalogueItem,
    type ActionOp,
} from "./structure/actionRegister.ts";
import { resolveBindingPath } from "./structure/shared.ts";
import { createVariablePicker } from "./picker.ts";

const MOD_ID = "buffer-controls";
const MENU_ID = "buffer-controls";
const VARIABLE_CATEGORY = "variables";
const VALUE_CATEGORY = "value";
const ACTION_CATEGORY = "action";
/** Prefixes so value/action item ids never collide with the path items. */
const VALUE_PREFIX = "value:";
const ACTION_PREFIX = "action:";
const BUFFER_ID = `${MOD_ID}:gameConfig`;

interface GameConfig {
    volume: number;
    muted: boolean;
    label: string;
    players: { name: string; score: number }[];
}

/** Sprites: one per FieldKind under assets/types/, the menu entry, + actions. */
const SPRITE_FILES = [
    { id: "number", filePath: "assets/types/number.png" },
    { id: "bolean", filePath: "assets/types/bolean.png" },
    { id: "string", filePath: "assets/types/string.png" },
    { id: "menu", filePath: "assets/other/display.png" },
    { id: "actionPlus", filePath: "assets/other/plus.png" },
    { id: "actionMinus", filePath: "assets/other/minus.png" },
    { id: "actionToggle", filePath: "assets/other/toggle-on.png" },
];

const ACTION_SPRITE_ID: Record<ActionOp, string> = {
    inc: "actionPlus",
    dec: "actionMinus",
    toggle: "actionToggle",
};

const CELL = 16;
/** Variable/value structures are 1 cell wide × 6 cells tall (6 × 15px). */
const STRUCT_H = 6 * 15;

async function main() {
    const api = sandkit.api;

    // -- 1. The jsonBuffer record we expose to the player --------------------
    const buffer = new JsonBuffer<GameConfig>(MOD_ID, BUFFER_ID, {
        volume: 1,
        muted: false,
        label: "hello",
        players: [{ name: "Bob", score: 0 }],
    });

    const readBuffer = (path: string): unknown => buffer.getPath(path);
    const writeBuffer = (path: string, value: unknown): void => {
        buffer.setPath(path, value);
        buffer.commit(); // encode + bump version + notify subscribers
    };

    // -- 2. Sprites ----------------------------------------------------------
    const spriteIds = await loadSpriteMap(MOD_ID, SPRITE_FILES);
    const kindSpriteId = (kind: string): string | undefined =>
        spriteIds[KIND_SPRITE_KEY[kind as keyof typeof KIND_SPRITE_KEY] ?? "string"];
    const spriteFor = (item: CatalogueItem): string | undefined => {
        if (item.id === MENU_ID) return spriteIds["menu"];
        const action = (item as ActionCatalogueItem).action;
        if (action) return spriteIds[ACTION_SPRITE_ID[action]];
        return kindSpriteId((item as PathCatalogueItem).kind ?? "string");
    };

    // -- 3. BuildingList: one item per scalar path in the record -------------
    // Only bool / number / string paths are exposed. `listPaths` reports array
    // leaves as "[]" templates (getPath("a[].x") reads `a.x` → undefined), so we
    // resolve them to index 0 — that is what makes "players[0].name" = "Bob"
    // display and write correctly (see resolveBindingPath).
    const bound = buffer.listPaths()
        .filter((field) => EXPOSED_KINDS.includes(field.kind))
        .map((field) => ({ ...field, path: resolveBindingPath(field.path) }));

    const actionItems = (
        field: { path: string; kind: PathCatalogueItem["kind"] },
    ): ActionCatalogueItem[] => {
        if (field.kind === "number") {
            const make = (op: ActionOp): ActionCatalogueItem => ({
                id: `${ACTION_PREFIX}${field.path}:${op}`,
                action: op,
                path: field.path,
                kind: field.kind,
                label: `${field.path} ${ACTION_LABEL[op]}`,
                description: `${ACTION_LABEL[op]} — writes jsonBuffer path "${field.path}" then commits.`,
                category: ACTION_CATEGORY,
                width: CELL,
                height: CELL,
                filePath: "assets/other/plus.png",
            });
            return [make("inc"), make("dec")];
        }
        if (field.kind === "bool") {
            return [{
                id: `${ACTION_PREFIX}${field.path}:toggle`,
                action: "toggle",
                path: field.path,
                kind: field.kind,
                label: `${field.path} ${ACTION_LABEL["toggle"]}`,
                description: `toggle — writes jsonBuffer path "${field.path}" then commits.`,
                category: ACTION_CATEGORY,
                width: CELL,
                height: CELL,
                filePath: "assets/other/toggle-on.png",
            } as ActionCatalogueItem];
        }
        return [];
    };

    const items: (PathCatalogueItem | ActionCatalogueItem)[] = [
        {
            id: MENU_ID,
            label: "Buffer Controls",
            description: "Buffer Controls — opens the variable picker.",
            category: VARIABLE_CATEGORY,
            width: CELL,
            height: CELL,
            filePath: "assets/other/display.png",
        },
        ...bound.map((field) => ({
            id: field.path,
            path: field.path,
            label: field.path,
            description: `${field.kind} — linked to jsonBuffer path "${field.path}".`,
            category: VARIABLE_CATEGORY,
            width: CELL,
            height: STRUCT_H,
            filePath: "assets/types/string.png",
            kind: field.kind,
        })),
        ...bound.map((field) => ({
            id: `${VALUE_PREFIX}${field.path}`,
            path: field.path,
            label: field.path,
            description: `${field.kind} — live value for jsonBuffer path "${field.path}".`,
            category: VALUE_CATEGORY,
            width: CELL,
            height: STRUCT_H,
            filePath: "assets/types/string.png",
            kind: field.kind,
        })),
        ...bound.flatMap(actionItems),
    ];

    const categories: CatalogueCategory[] = [
        { id: VARIABLE_CATEGORY, label: "Variables" },
        { id: VALUE_CATEGORY, label: "Value" },
        { id: ACTION_CATEGORY, label: "Action" },
    ];

    const list: BuildList = createBuildList({
        modId: MOD_ID,
        menuId: MENU_ID,
        menuLabel: "Buffer Controls",
        categories,
        catalogueItems: items as CatalogueItem[],
        selectedId: bound[0]?.path,
    });
// -- 4. Structures (menu entry unlocked + one per path, per category) ----
    registerPathStructures(list, spriteFor);
    const valueEntries = registerValueStructures(list, spriteFor, readBuffer);
    registerActionStructures(list, spriteFor, readBuffer, writeBuffer);

    // -- 5. Keep every placed value structure in sync with the buffer --------
    // The value structure's draw only reads structure.data.dataValue. Whenever
    // the buffer updates, look at all placed value structures (forEachOfType
    // walks the live world) and setData the current value of their path, so the
    // draw always shows the LAST buffer value.
    const refreshValueStructures = () => {
        for (const entry of valueEntries) {
            const value = readBuffer(entry.path);
            const next = formatBufferValue(value, entry.kind);
            sandkit.api.structures.forEachOfType(entry.typeId, (structure) => {
                if (String(structure.data?.dataValue) === next) return;
                sandkit.api.structures.setData(structure, { dataValue: next }, {
                    propagateToWorkers: true,
                });
            });
        }
    };

    // React to local commits (including action clicks) AND to changes another
    // side wrote: pull() is a cheap version-compare and fires the subscription
    // only on a real change.
    buffer.subscribe(() => refreshValueStructures());
    setInterval(() => {
        buffer.pull();
    }, 500);
    // Refresh once so value structures placed in an earlier session pick up the
    // current buffer value immediately.
    refreshValueStructures();
    // And refresh a freshly-placed value structure right away, so it shows the
    // current buffer value instead of the value baked at register time.
    sandkit.api.events?.on?.("building:placed", () => refreshValueStructures());

    // -- 6. Custom picker: icon + path rows, category tabs, no sizes ---------
    createVariablePicker({
        list,
        title: "Buffer controls",
        spriteFor,
    });

    api.ui?.toast?.(`Buffer Controls — ${bound.length} paths loaded`, {});
    console.log(`[${MOD_ID}] loaded ${bound.length} jsonBuffer paths`);
}

try {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);
    console.log("==== STATE STORE === ", sandkit.state?.store);
    void main();
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    console.error(e);
}