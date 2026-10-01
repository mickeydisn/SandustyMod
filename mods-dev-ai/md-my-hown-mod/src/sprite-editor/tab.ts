/**
 * sprite-editor / tab — the "draw" section of the configurator panel.
 *
 *  - lists every sprite created with the editor (thumbnail, id, size, frames)
 *  - New sprite · Import PNG · load an existing asset from the `sprites`
 *    collection / any mod path into the editor
 *  - Edit / Duplicate / Delete
 *  - hosts the editor window (ONE sprite at a time)
 *
 * The open EditSession lives at module level: switching tab, minimising the
 * panel or deselecting the tool never loses pixels or undo history.
 */
import { React as HostReact, toast } from "../api.ts";
import { api as skApi } from "../packages/mysandkit.ts";
import { addOrUpdateSprite } from "../config/store.ts";
import { MOD_ID, type SpriteConfig } from "../constants.ts";
import * as S from "../ui/styles.ts";
import { fileToDoc, loadUrlToDoc } from "./codec.ts";
import { createDoc, type EditSession, newSession } from "./engine.ts";
import { getSpriteEditor } from "./editor.ts";
import { registerDataUrlSprite } from "./register.ts";
import {
    deleteSprite,
    type DrawnSprite,
    listDrawn,
    listFileSprites,
    normalizeSpriteId,
    saveSession,
    uniqueSpriteId,
} from "./store.ts";

// ── session that survives UI unmounts ────────────────────────────────────
let currentSession: EditSession | null = null;
export function getCurrentSession(): EditSession | null {
    return currentSession;
}
export function setCurrentSession(s: EditSession | null): void {
    currentSession = s;
}

const SIZES = [16, 32, 48, 64, 96, 128];

const thumbBg = "repeating-conic-gradient(#2a2a33 0% 25%, #20202a 0% 50%) 0 0 / 8px 8px";
const thumb = {
    height: 32,
    maxWidth: 96,
    minWidth: 32,
    objectFit: "contain",
    imageRendering: "pixelated",
    background: thumbBg,
    border: "1px solid rgba(80,95,130,0.5)",
    flexShrink: 0,
} as Record<string, string | number>;

function baseName(path: string): string {
    const f = path.split(/[\\/]/).pop() || path;
    return f.replace(/\.[A-Za-z0-9]+$/, "");
}

let _Tab: any = null;

/** Memoised component (stable identity → stable hooks). */
export function getDrawTab(): (props: { onChange?: () => void }) => any {
    if (_Tab) return _Tab;
    const React: any = HostReact;
    if (!React) return (_Tab = () => null);
    const h = React.createElement.bind(React);
    const { useState, useRef } = React;
    const Editor = getSpriteEditor();

    function DrawTab(props: { onChange?: () => void }) {
        const [list, setList] = useState(() => listDrawn());
        const [files, setFiles] = useState(() => listFileSprites());
        const [session, setSession] = useState(() => getCurrentSession() as EditSession | null);
        const [sessionKey, setSessionKey] = useState(0);
        const [newOpen, setNewOpen] = useState(false);
        const [newName, setNewName] = useState("");
        const [newW, setNewW] = useState("16");
        const [newH, setNewH] = useState("16");
        const [pathIn, setPathIn] = useState("assets/");
        const [msg, setMsg] = useState("");
        const [confirmDel, setConfirmDel] = useState("");
        const fileRef = useRef(null as any);

        const refresh = () => {
            setList(listDrawn());
            setFiles(listFileSprites());
            props.onChange?.();
        };
        const say = (m: string, toastIt = false) => {
            setMsg(m);
            if (toastIt) toast(m);
        };

        const canOpen = (): boolean => {
            const cur = getCurrentSession();
            if (cur && cur.dirty) {
                say(`"${cur.id}" has unsaved changes — save or discard it first.`);
                return false;
            }
            return true;
        };
        const open = (s: EditSession) => {
            setCurrentSession(s);
            setSession(s);
            setSessionKey((k: number) => k + 1);
            setMsg("");
        };
        const closeEditor = () => {
            setCurrentSession(null);
            setSession(null);
            refresh();
        };

        // ── creators ─────────────────────────────────────────────────────
        const createNew = () => {
            if (!canOpen()) return;
            const id = normalizeSpriteId(newName);
            if (!id) return say("Give the sprite a name (letters, digits, - _ .)");
            if (
                listDrawn().some((s) => s.id === id) || listFileSprites().some((s) => s.id === id)
            ) {
                return say(`Id already used: ${id}`);
            }
            const w = Math.max(1, Number(newW) || 16), hh = Math.max(1, Number(newH) || 16);
            open(newSession(id, createDoc(w, hh), { origin: "new" }));
            setNewOpen(false);
            setNewName("");
        };

        const editDrawn = async (e: DrawnSprite) => {
            if (!canOpen()) return;
            try {
                const doc = await loadUrlToDoc(e.source);
                open(newSession(e.id, doc, { isNew: false, origin: "saved sprite" }));
            } catch (err) {
                say("Cannot open sprite: " + (err as Error).message, true);
            }
        };

        /** Load any image URL into the editor as a NEW (not yet saved) sprite. */
        const openFromUrl = async (url: string, id: string, origin: string, replaces?: string) => {
            if (!canOpen()) return;
            try {
                const doc = await loadUrlToDoc(url);
                open(newSession(id, doc, { origin, replaces }));
                say(`Loaded ${origin} (${doc.width}×${doc.height}). Save to keep it as an editable sprite.`);
            } catch (err) {
                say(
                    `Cannot load ${origin}: ${(err as Error).message}. Try “Import PNG…” instead.`,
                    true,
                );
            }
        };

        const importFile = async (file: File) => {
            if (!canOpen()) return;
            try {
                const doc = await fileToDoc(file);
                open(newSession(uniqueSpriteId(baseName(file.name)), doc, { origin: file.name }));
            } catch (err) {
                say("Cannot read PNG: " + (err as Error).message, true);
            }
        };

        /** Edit an entry of the existing (file-based) asset collection. */
        const editFileSprite = (e: SpriteConfig) => {
            const url = e.source
                ? String(e.source)
                : skApi.assets.getUrl(String(e.path)) ?? String(e.path);
            // same id + replaces => saving converts the file entry into an editable drawn one
            void openFromUrl(url, e.id, `asset ${e.path ?? e.id}`, e.id);
        };

        const loadFromPath = () => {
            const p = pathIn.trim();
            if (!p) return;
            const url = skApi.assets.getUrl(p) ?? p;
            void openFromUrl(url, uniqueSpriteId(baseName(p)), p);
        };

        // ── row actions ──────────────────────────────────────────────────
        const duplicate = (e: DrawnSprite) => {
            const id = uniqueSpriteId(`${e.id}-copy`);
            const copy: DrawnSprite = { ...e, id, updatedAt: Date.now() };
            addOrUpdateSprite(copy);
            void registerDataUrlSprite(
                id,
                copy.source,
                copy.options as Record<string, unknown> | undefined,
            );
            say(`Duplicated → ${id}`);
            refresh();
        };
        const remove = (id: string) => {
            if (confirmDel !== id) {
                setConfirmDel(id);
                return;
            }
            setConfirmDel("");
            deleteSprite(id);
            const cur = getCurrentSession();
            if (cur && !cur.isNew && cur.id === id) closeEditor();
            say(`Deleted ${id}. (The game keeps the texture until the next restart.)`);
            refresh();
        };

        // ── save handed to the editor ────────────────────────────────────
        const onSave = async (s: EditSession): Promise<boolean> => {
            const r = await saveSession(s);
            if (!r.ok) {
                say(r.error ?? "Save failed", true);
                return false;
            }
            const size = Math.round((r.entry!.source.length * 3) / 4 / 1024 * 10) / 10;
            say(
                r.registered
                    ? `Saved ${s.id} (${size} KB) and registered in game.`
                    : `Saved ${s.id} (${size} KB) to storage — the game did not accept it live (see console); it is retried on Apply / next boot.`,
            );
            toast(`Sprite saved: ${s.id}`);
            refresh();
            return true;
        };

        // ── UI ───────────────────────────────────────────────────────────
        const row = (e: DrawnSprite) =>
            h(
                "div",
                {
                    key: e.id,
                    style: { ...S.row, opacity: session && session.id === e.id ? 0.6 : 1 },
                },
                h("img", { src: e.source, alt: "", style: thumb, draggable: false }),
                h(
                    "div",
                    { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" } },
                    h("span", { style: S.rowId, title: e.id }, e.id),
                    h(
                        "span",
                        { style: S.hint },
                        `${e.width}×${e.height} · ${e.frames} frame${e.frames === 1 ? "" : "s"}`,
                    ),
                ),
                h("button", {
                    type: "button",
                    style: S.btnPrimary,
                    onClick: () => {
                        void editDrawn(e);
                    },
                }, "Edit"),
                h("button", {
                    type: "button",
                    style: S.btn,
                    title: "Duplicate",
                    onClick: () => duplicate(e),
                }, "⧉"),
                h("button", {
                    type: "button",
                    style: S.btnDanger,
                    onClick: () => remove(e.id),
                    title: confirmDel === e.id ? "Click again to delete" : "Delete",
                }, confirmDel === e.id ? "Sure?" : "Del"),
            );

        const fileRow = (e: SpriteConfig) =>
            h(
                "div",
                { key: e.id, style: S.row },
                h("span", { style: S.rowId, title: `${e.id}  ←  ${e.path ?? "source"}` }, e.id),
                h("span", { style: S.hint }, String(e.path ?? "")),
                h("button", {
                    type: "button",
                    style: S.btn,
                    title:
                        "Load this asset into the editor (saving under the same id turns it into an editable sprite)",
                    onClick: () => editFileSprite(e),
                }, "Edit"),
            );

        return h(
            "div",
            null,
            h(
                "div",
                { style: S.hint },
                "Draw sprites here. They are stored as base64 PNG inside the JSON config (sprites category) and registered in the game on Apply / boot — use the id in items, structures and projectiles.",
            ),
            h(
                "div",
                { style: { ...S.toolbar, marginTop: 8 } },
                h("button", {
                    type: "button",
                    style: S.btnPrimary,
                    onClick: () => setNewOpen(!newOpen),
                }, "+ New sprite"),
                h("button", {
                    type: "button",
                    style: S.btn,
                    onClick: () => fileRef.current?.click(),
                }, "Import PNG…"),
                session
                    ? h("button", {
                        type: "button",
                        style: S.btn,
                        title: "Bring the editor window back",
                        onClick: () => setSessionKey((k: number) => k + 1),
                    }, "Show editor")
                    : null,
            ),
            h("input", {
                ref: fileRef,
                type: "file",
                accept: "image/png,.png",
                style: { display: "none" },
                onChange: (e: any) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void importFile(f);
                },
            }),
            newOpen
                ? h(
                    "div",
                    {
                        style: {
                            ...S.form,
                            marginBottom: 10,
                            padding: 8,
                            background: "rgba(30,34,48,0.85)",
                            borderRadius: 6,
                        },
                    },
                    h(
                        "label",
                        { style: S.label },
                        "Name",
                        h("input", {
                            style: S.input,
                            value: newName,
                            placeholder: "crate",
                            spellCheck: false,
                            onChange: (e: any) => setNewName(e.target.value),
                        }),
                        h(
                            "span",
                            { style: S.hint },
                            `Full id → ${normalizeSpriteId(newName) ?? `${MOD_ID}:…`}`,
                        ),
                    ),
                    h(
                        "div",
                        { style: { display: "flex", gap: 8 } },
                        h(
                            "label",
                            { style: { ...S.label, flex: 1 } },
                            "Width",
                            h(
                                "select",
                                {
                                    style: S.select,
                                    value: newW,
                                    onChange: (e: any) => setNewW(e.target.value),
                                },
                                ...SIZES.map((n) =>
                                    h(
                                        "option",
                                        { key: n, value: String(n) },
                                        `${n} px (${n / 16} tile${n === 16 ? "" : "s"})`,
                                    )
                                ),
                            ),
                        ),
                        h(
                            "label",
                            { style: { ...S.label, flex: 1 } },
                            "Height",
                            h(
                                "select",
                                {
                                    style: S.select,
                                    value: newH,
                                    onChange: (e: any) => setNewH(e.target.value),
                                },
                                ...SIZES.map((n) =>
                                    h("option", { key: n, value: String(n) }, `${n} px`)
                                ),
                            ),
                        ),
                    ),
                    h(
                        "div",
                        { style: S.toolbar },
                        h(
                            "button",
                            { type: "button", style: S.btnPrimary, onClick: createNew },
                            "Create & edit",
                        ),
                        h("button", {
                            type: "button",
                            style: S.btn,
                            onClick: () => setNewOpen(false),
                        }, "Cancel"),
                    ),
                )
                : null,
            msg ? h("div", { style: { ...S.hint, color: "#ffd9a0", marginBottom: 6 } }, msg) : null,
            h(
                "div",
                { style: { ...S.hint, marginTop: 4, marginBottom: 4 } },
                `Drawn sprites (${list.length})`,
            ),
            h(
                "div",
                { style: S.list },
                list.length === 0
                    ? h("div", { style: S.hint }, "None yet — create one with “+ New sprite”.")
                    : list.map(row),
            ),
            files.length
                ? h(
                    "div",
                    null,
                    h(
                        "div",
                        { style: { ...S.hint, marginTop: 12, marginBottom: 4 } },
                        `Existing asset collection (${files.length}) — load into the editor`,
                    ),
                    h("div", { style: S.list }, files.map(fileRow)),
                )
                : null,
            h(
                "div",
                { style: { ...S.hint, marginTop: 12, marginBottom: 4 } },
                "Load any file from the mod folder",
            ),
            h(
                "div",
                { style: { display: "flex", gap: 6 } },
                h("input", {
                    style: { ...S.input, flex: 1 },
                    value: pathIn,
                    placeholder: "assets/icon.png",
                    spellCheck: false,
                    onChange: (e: any) => setPathIn(e.target.value),
                }),
                h("button", { type: "button", style: S.btn, onClick: loadFromPath }, "Load"),
            ),
            session ? h(Editor, { key: sessionKey, session, onSave, onClose: closeEditor }) : null,
        );
    }

    _Tab = DrawTab;
    return _Tab;
}
