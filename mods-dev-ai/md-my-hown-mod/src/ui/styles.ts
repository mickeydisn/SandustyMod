/**
 * Inline styles for the movable / minimizable config panel.
 * Self-contained so the mod does not depend on external CSS.
 */

/**
 * The one style type this module speaks.
 *
 * `React.CSSProperties` is ambient here (the `deno.window` lib supplies the
 * namespace), which is fine inside this file but not in a module that merely
 * *imports* these values — an ambient global is not re-exported by importing it.
 * Naming the type once lets a caller annotate a style without adding its own
 * React import, and keeps the two from drifting apart.
 */
export type Style = React.CSSProperties;

export const panelRoot: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 100000,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontSize: 13,
    color: "#e8e8e8",
    userSelect: "none",
    pointerEvents: "auto",
};

/**
 * Where the open panel sits: a near-fullscreen overlay, centred.
 *
 * `90vw`/`90vh` with `5vw`/`5vh` of margin on every side, so it is centred
 * whatever the viewport is. The open panel is deliberately *not* draggable — a
 * window that can be shoved to a screen corner is not an overlay, and at this
 * size dragging it could only ever put it somewhere useless. Dragging belongs
 * to the minimised chip, which is small and wants to be parked out of the way.
 */
export const overlayBox: React.CSSProperties = {
    width: "90vw",
    height: "90vh",
    left: "5vw",
    top: "5vh",
    right: "auto",
    bottom: "auto",
    maxWidth: "100vw",
    maxHeight: "100vh",
};

export const panelChrome: React.CSSProperties = {
    background: "rgba(18, 20, 28, 0.94)",
    border: "1px solid rgba(120, 140, 180, 0.45)",
    borderRadius: 8,
    boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
    overflow: "hidden",
    minWidth: 280,
    /**
     * Fill the 90vh overlay exactly.
     *
     * This is the link the whole scroll chain hangs off, and it was missing.
     * `panelRoot` carries the `90vh`; `panelChrome` is its only child, and
     * without a height of its own it sizes to its *content*. So the flex column
     * below had no definite height to divide up: `body`'s `flex: 1` resolved
     * against an auto-height parent, the list never got a bounded box, and the
     * list's own `overflowY: auto` had nothing to scroll inside — the bottom of
     * the list simply fell off the bottom of the panel with no way to reach it.
     *
     * `height: 100%` rather than `maxHeight`, so the chrome is exactly as tall as
     * the overlay and the title bar and nav stay pinned while only the body
     * scrolls. `overflow: hidden` above then clips nothing, because the content
     * is now sized to fit.
     */
    height: "100%",
    display: "flex",
    flexDirection: "column",
};

export const titleBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "linear-gradient(180deg, rgba(50,60,90,0.9), rgba(30,36,55,0.95))",
    // The open panel is a fixed overlay, so there is nothing to grab. Only the
    // minimised chip takes a drag, and it carries its own cursor.
    cursor: "default",
    borderBottom: "1px solid rgba(100,120,160,0.35)",
};

export const titleText: React.CSSProperties = {
    flex: 1,
    fontWeight: 600,
    letterSpacing: 0.3,
    fontSize: 13,
};

export const btn: React.CSSProperties = {
    background: "rgba(70, 90, 130, 0.7)",
    border: "1px solid rgba(140, 160, 200, 0.4)",
    color: "#eef",
    borderRadius: 4,
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: "18px",
};

export const btnDanger: React.CSSProperties = {
    ...btn,
    background: "rgba(140, 50, 50, 0.75)",
    border: "1px solid rgba(200, 100, 100, 0.45)",
};

export const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "rgba(50, 110, 90, 0.8)",
    border: "1px solid rgba(100, 180, 140, 0.45)",
};

export const body: React.CSSProperties = {
    padding: 10,
    overflow: "auto",
    /**
     * The scrolling body, and the *only* one.
     *
     * It takes the space the title bar and the two nav rows leave over
     * (`flex: 1` in the chrome's flex column) and scrolls what does not fit.
     * `minHeight: 0` is what lets it shrink below its content at all: a flex item
     * defaults to `min-height: auto`, which refuses to, so without it a long list
     * pushes the panel past 90vh instead of scrolling.
     *
     * Everything below this scrolls *with* it — the screen head, the filter bar
     * and the rows alike. The alternative (a fixed header and a separately
     * scrolling list) needs three nested scroll containers to get right, and two
     * of them would be reachable by the wheel at once.
     */
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
};

export const tabs: React.CSSProperties = {
    display: "flex",
    gap: 4,
    marginBottom: 10,
    flexWrap: "wrap",
};

export const tab: React.CSSProperties = {
    ...btn,
    background: "rgba(40, 48, 70, 0.8)",
};

export const list: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

export const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    background: "rgba(30, 34, 48, 0.85)",
    borderRadius: 6,
    border: "1px solid rgba(80, 95, 130, 0.35)",
};

/**
 * A strip of buttons above a form — `New`, `Import`, the sprite editor's own row.
 *
 * Wraps rather than scrolling: the row's width is the panel's width, and a
 * horizontally scrolling toolbar hides its right-hand buttons behind a gesture
 * the user has no reason to know they need.
 */
export const toolbar: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
};

export const rowId: React.CSSProperties = {
    flex: 1,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

/**
 * The list row's own line: swatch, title, id, origin tag.
 *
 * Separate from `row` (the row's *container*) because a row is now a two-level
 * thing — a clickable line and, under it, an expandable detail — and the line
 * has to be the part that grows while the detail hangs off it. `row` stays the
 * outer box so existing callers that style a flat row are unaffected.
 */
export const rowHead: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
};

/** An element's colour, as a small block. No border — it *is* the colour. */
export const rowSwatch: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 3,
    flexShrink: 0,
    boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
};

export const rowTitle: React.CSSProperties = {
    fontSize: 12.5,
    color: "#d7dded",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "45%",
};

/**
 * "yours" vs "game" — the origin tag on a list row.
 *
 * The one piece of information a row cannot get from its name, so it is always
 * drawn — but quietly, in the row's own corner, because it is context rather
 * than the content. The mod tag reuses the per-field native list's tint, so
 * "the blue ones are yours" is a rule the user learns once rather than twice.
 *
 * `rowTagMod` / `rowTagGame` are declared beside `nativeItem` /
 * `nativeItemMod` further down this file, because spreading a `const` declared
 * later is a use-before-assignment error rather than a style preference.
 */

/** The expanded detail, indented under its row line. */
export const rowDetail: React.CSSProperties = {
    marginTop: 6,
    paddingTop: 6,
    // Aligned with the object's *name*, not with the disclosure marker, so the
    // detail reads as more information about the same thing rather than as a
    // separate block that happens to be nearby.
    paddingLeft: 15,
    borderTop: "1px solid rgba(90, 105, 140, 0.25)",
    display: "flex",
    flexDirection: "column",
    gap: 3,
};

export const detailLine: React.CSSProperties = {
    display: "flex",
    gap: 8,
    fontSize: 11,
};

export const detailKey: React.CSSProperties = {
    color: "#7f8ca8",
    minWidth: 108,
    flexShrink: 0,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const detailVal: React.CSSProperties = {
    color: "#b8c0d0",
    wordBreak: "break-word",
};

/** A one-line note above a row's detail, saying whose values these are. */
export const detailNote: React.CSSProperties = {
    fontSize: 10,
    color: "#79829a",
    fontStyle: "italic",
    marginBottom: 2,
};

/**
 * The one fact a row leads with after its name — a matter type, a category, a
 * footprint size.
 *
 * A tag rather than free text: it sits inline in the row and must not reflow
 * the rest of the line, so it is capped and clipped.
 */
export const rowFact: React.CSSProperties = {
    fontSize: 10.5,
    color: "#9fb0c8",
    background: "rgba(90,120,190,0.14)",
    borderRadius: 3,
    padding: "0 5px",
    lineHeight: "15px",
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "22%",
};

/** A structure's footprint, laid out as a grid of cells. */
export const rowGrid: React.CSSProperties = {
    display: "grid",
    gridAutoFlow: "row",
    gap: 1,
    flexShrink: 0,
    padding: 1,
    borderRadius: 2,
    background: "rgba(0,0,0,0.25)",
};

export const gridCell: React.CSSProperties = {
    width: 4,
    height: 4,
    borderRadius: 1,
};

/**
 * The filter bar: the search box, then the owner chips and the hidden tick.
 *
 * Always rendered, even when a category has rows from a single owner and no
 * chips to show. It used to collapse in that case, which is not a cosmetic
 * saving — the hidden tick lives here, and a control that vanishes when the
 * list is empty is a control that vanishes exactly when it is needed to explain
 * an empty list.
 */
export const listFilterBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 0 2px 0",
    flexWrap: "wrap",
};

/** A read-only row, dimmed so it never looks actionable. */
export const rowReadOnly: React.CSSProperties = {
    ...row,
    opacity: 0.82,
};

/** The row's horizontal bar: the object line, then the row's buttons. */
export const rowBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
};

/**
 * A list row rendered as `<details>`.
 *
 * **`flexDirection: "column"` is the fix for the detail appearing in the wrong
 * place.** `S.row` is `display: flex` in the *row* direction — it predates the
 * details row and the handlers panel still uses it as a flat row — so a detail
 * element placed after the bar was laid out *beside* the bar rather than under
 * it, appearing as a narrow column to the right of the object's name.
 *
 * Overriding the direction here rather than editing `S.row` keeps those flat rows
 * untouched, and states the requirement where the details row is defined.
 */
export const rowDetails: React.CSSProperties = {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 0,
    // No pseudo-element rules here (`::-webkit-details-marker`, `::marker`): this
    // file's `Style` is `React.CSSProperties`, which does not model selectors, so
    // they would not typecheck. `listStyle: "none"` on the summary below removes
    // the native marker in both engines, which is all they were for.
};

/**
 * The clickable line: the object, then the row's buttons.
 *
 * `listStyle: none` removes the native marker's box so the custom `▸` sits at
 * the row's own left padding rather than wherever the browser put it. The `▸` is
 * kept and rotated rather than dropped, because the whole row being the control
 * is the point — an affordance is what tells the user that.
 */
export const rowSummary: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    cursor: "pointer",
    listStyle: "none",
    margin: 0,
    // A real hit area, not just the text's. This is the difference between "the
    // row opens" and "I have to hit the name exactly".
    padding: "2px 0",
    borderRadius: 4,
    userSelect: "none",
};

/** The disclosure marker, drawn in place of the native one. */
export const rowSummaryMark: React.CSSProperties = {
    fontSize: 9,
    color: "#7f8ca8",
    flexShrink: 0,
    width: 10,
    lineHeight: "16px",
    textAlign: "center",
};

export const form: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
};

export const label: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 12,
    color: "#b8c0d0",
};

export const input: React.CSSProperties = {
    background: "rgba(12, 14, 22, 0.9)",
    border: "1px solid rgba(100, 120, 160, 0.45)",
    borderRadius: 4,
    color: "#eef",
    padding: "5px 8px",
    fontSize: 13,
    outline: "none",
};

/**
 * The multi-line control, used for every JSON box and the full-config editor.
 *
 * `width: 100%` is the fix for the reported one: a `<textarea>` has an intrinsic
 * width of about 20 characters and does NOT stretch to its container the way an
 * `<input>` in the same grid cell does, so every JSON box came out roughly half
 * the width of the row beside it — and on a `wide` field, half the form.
 *
 * `boxSizing: border-box` is not optional alongside it. `input` above sets
 * `padding: "5px 8px"` and no box-sizing, so a `width: 100%` textarea would be
 * 16px wider than its grid cell and push its neighbour along, trading one layout
 * bug for a quieter one.
 */
export const textarea: React.CSSProperties = {
    ...input,
    width: "100%",
    boxSizing: "border-box",
    minHeight: 120,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    resize: "vertical",
};

export const hint: React.CSSProperties = {
    fontSize: 11,
    color: "#8890a8",
    marginTop: 4,
};

export const minimizedChip: React.CSSProperties = {
    ...panelChrome,
    padding: "8px 14px",
    // The one draggable thing in this panel, so it is the one thing with a
    // grab cursor. It both drags (to park it) and clicks (to open it).
    cursor: "grab",
    touchAction: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    background: "rgba(30, 60, 120, 0.95)",
    border: "1px solid rgba(120, 170, 255, 0.7)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
    fontSize: 13,
    fontWeight: 600,
    color: "#e8f0ff",
};

// React namespace for CSSProperties typing without importing React at runtime
declare namespace React {
    type CSSProperties = Record<string, string | number | undefined>;
}

export const select: React.CSSProperties = {
    ...input,
    cursor: "pointer",
};

// ── Grouped navigation & form chrome (v0.2 UI) ──────────────────────────────

export const groupNav: React.CSSProperties = {
    display: "flex",
    gap: 4,
    padding: "6px 8px 0 8px",
    flexWrap: "wrap",
};

export const chip: React.CSSProperties = {
    background: "rgba(32, 38, 56, 0.9)",
    border: "1px solid rgba(90, 105, 140, 0.45)",
    color: "#c8d2e6",
    borderRadius: 10,
    padding: "3px 10px",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: "16px",
};

export const chipActive: React.CSSProperties = {
    ...chip,
    background: "rgba(64, 96, 160, 0.95)",
    borderColor: "rgba(150, 185, 240, 0.75)",
    color: "#eef4ff",
    fontWeight: 600,
};

/**
 * A chip that also holds a checkbox — the "hidden objects" filter.
 *
 * Shaped like `chip` so it reads as one more filter beside the owner chips
 * rather than as a stray checkbox welded onto the search box. When it is on it
 * takes `chip`'s active tint, because that is the same signal every other chip
 * uses for "this filter is applied" and a second one would need a legend.
 */
export const chipCheck: React.CSSProperties = {
    ...chip,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    // A label, not a button, so the whole chip is a click target for the
    // checkbox. Without this only the 10px box is clickable.
    userSelect: "none",
};

export const chipCheckOn: React.CSSProperties = {
    ...chipCheck,
    background: "rgba(64, 96, 160, 0.95)",
    borderColor: "rgba(150, 185, 240, 0.75)",
    color: "#eef4ff",
    fontWeight: 600,
};

export const chipCount: React.CSSProperties = {
    marginLeft: 6,
    fontSize: 10,
    opacity: 0.75,
    fontVariantNumeric: "tabular-nums",
};

/**
 * The per-mod filter chips, tinted to match the row badges they select.
 *
 * A chip that filters to "otherA's objects" reads the same colour as otherA's row
 * badges, so the link between "this chip" and "these rows" is visible rather than
 * something the user learns by clicking. `chipGame` is the quietest of the three
 * for the same reason its badge is — the game's own objects are the baseline, not
 * the interesting case.
 */
export const chipOwn: React.CSSProperties = {
    ...chip,
    color: "#cfe0ff",
    background: "rgba(120,190,255,0.20)",
    borderColor: "rgba(120,190,255,0.40)",
};

export const chipGame: React.CSSProperties = {
    ...chip,
    color: "#a9b4c9",
    background: "rgba(90,120,190,0.10)",
};

export const chipOther: React.CSSProperties = {
    ...chip,
    color: "#c2b6e8",
    background: "rgba(150,120,220,0.18)",
    borderColor: "rgba(150,120,220,0.40)",
};

export const subNav: React.CSSProperties = {
    display: "flex",
    gap: 4,
    padding: "6px 8px",
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(90, 105, 140, 0.3)",
};

export const screenHead: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "8px 10px 0 10px",
};

/**
 * One screen's root: a flex column.
 *
 * No `flex`, no `minHeight: 0`, and above all no `overflow`. The screen sits
 * inside `body`, which is the panel's *one* scroll container, so anything this
 * style adds here is either redundant or a second scroll area competing with it.
 *
 * `minHeight: 100%` is the one non-obvious part: it makes a short screen (three
 * rows, or a form) fill the body's height, so the empty state and the filter bar
 * do not collapse to the top of a tall window. It is a *minimum*, not a bound —
 * a long screen still grows past it, and `body` scrolls.
 */
export const screen: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
};

export const screenTitle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.2,
};

/**
 * The one heading size for every list the reader can see.
 *
 * A screen's own title uses `screenTitle`. The lists drawn *under* it used to
 * use `sectionTitle` instead — 10px, uppercase, grey — so a screen with three
 * lists came out as one big title followed by three small ones, and the small
 * ones read as captions of the list above rather than as titles in their own
 * right. They are peers, so they are sized from this: `listHeadingRow` spreads
 * `screenTitle` rather than restating its numbers, so the two cannot drift.
 *
 * (`sectionTitle` stays for the collapsible field groups inside an edit form.
 * Those are a different thing — a disclosure, not a list — and should stay quiet.)
 */
export const listHeadingRow: React.CSSProperties = {
    ...screenTitle,
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
};

export const screenBlurb: React.CSSProperties = {
    fontSize: 11,
    color: "#8a93aa",
    flex: 1,
};

/**
 * A collapsible field group: the `<details>` shell the panel renders each
 * section into.
 *
 * A structure's form is twenty-six fields across a dozen groups, and it opened
 * flat, so the screen was several screens long with no way to tell which
 * question any row belonged to. Each group is now closed until asked for.
 *
 * `sectionBox` is kept as the name because `sectionTitle`/`fieldGrid` are
 * already looked up by it elsewhere; it is the `<details>` element itself.
 */
export const sectionBox: React.CSSProperties = {
    marginTop: 6,
    borderTop: "1px solid rgba(90, 105, 140, 0.3)",
};

/**
 * The clickable line. `<summary>` ships a disclosure triangle; it is kept,
 * because it is the affordance that says "this opens", but it is aligned and
 * sized to sit with the label rather than push it.
 */
export const sectionSummary: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 2px",
    cursor: "pointer",
    userSelect: "none",
    listStyle: "revert",
};

/** How many controls are folded away, right-aligned and quiet. */
export const sectionCount: React.CSSProperties = {
    fontSize: 10,
    color: "#5d6880",
    marginLeft: "auto",
    paddingRight: 2,
};

/** The structure's unlock relation, said in words next to the "Create" action. */
export const unlockRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(90, 105, 140, 0.3)",
};

export const unlockText: React.CSSProperties = {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 1.4,
    color: "#9fb0c8",
};

export const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#7f8ca8",
    marginBottom: 6,
};

export const fieldGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px 10px",
};

export const fieldCell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 12,
    color: "#b8c0d0",
    minWidth: 0,
};

export const fieldCellWide: React.CSSProperties = {
    ...fieldCell,
    gridColumn: "1 / -1",
};

export const inputError: React.CSSProperties = {
    ...input,
    borderColor: "rgba(230, 110, 110, 0.85)",
};

export const errorText: React.CSSProperties = {
    fontSize: 10,
    color: "#ff9b9b",
};

export const hintBelow: React.CSSProperties = {
    fontSize: 10,
    color: "#79829a",
};

/**
 * The native list under a reference field.
 *
 * Deliberately quiet: it is context for the picker above it, not a control the
 * eye should land on. The toggle reads as text until hovered, so a form full of
 * them does not turn into a row of competing buttons.
 */
export const nativeBox: React.CSSProperties = {
    marginTop: 3,
};

export const nativeToggle: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 10,
    color: "#6b788a",
    textAlign: "left",
};

export const nativeList: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
    maxHeight: 132,
    overflowY: "auto",
    marginTop: 4,
    padding: 5,
    border: "1px solid rgba(120,140,180,0.22)",
    borderRadius: 4,
    background: "rgba(12,16,26,0.5)",
};

export const nativeItem: React.CSSProperties = {
    fontSize: 10,
    color: "#a9b4c9",
    padding: "1px 4px",
    borderRadius: 3,
    background: "rgba(90,120,190,0.10)",
};

export const nativeItemMod: React.CSSProperties = {
    color: "#cfe0ff",
    background: "rgba(120,190,255,0.22)",
};

/** The list row's origin tag — yours, or the game's. See `rowTagMod` above. */
export const rowTagMod: React.CSSProperties = {
    ...nativeItemMod,
    fontSize: 9.5,
    lineHeight: "14px",
    padding: "0 5px",
    borderRadius: 7,
    flexShrink: 0,
    marginLeft: "auto",
};

export const rowTagGame: React.CSSProperties = {
    ...nativeItem,
    fontSize: 9.5,
    lineHeight: "14px",
    padding: "0 5px",
    borderRadius: 7,
    flexShrink: 0,
    marginLeft: "auto",
    opacity: 0.8,
};

/**
 * Another mod's object — neither yours nor the game's.
 *
 * A third tint, because that is a third thing. With only two tags, a screen
 * showing a built-in `Furnace` and `otherA.furnace` showed two identical "game"
 * badges, and the user had no way to tell the engine's from another mod's
 * without reading the id. This is deliberately the quietest of the three: it is
 * reference information, and the eye should land on the object's name.
 */
export const rowTagOther: React.CSSProperties = {
    ...nativeItem,
    color: "#c2b6e8",
    background: "rgba(150,120,220,0.18)",
    fontSize: 9.5,
    lineHeight: "14px",
    padding: "0 5px",
    borderRadius: 7,
    flexShrink: 0,
    marginLeft: "auto",
    opacity: 0.9,
};

export const footerBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid rgba(90, 105, 140, 0.3)",
};

export const footerStatus: React.CSSProperties = {
    flex: 1,
    fontSize: 11,
};

export const emptyState: React.CSSProperties = {
    padding: "14px 10px",
    fontSize: 12,
    color: "#8a93aa",
    background: "rgba(26, 30, 44, 0.7)",
    border: "1px dashed rgba(90, 105, 140, 0.5)",
    borderRadius: 6,
    textAlign: "center",
};

/**
 * The list of rows.
 *
 * Deliberately **not** a scroll container. `body` is the panel's one scroller, and
 * a second `overflowY: auto` here would be a nested scroll area: the wheel would
 * move whichever one the cursor happened to be over, and the list could be
 * scrolled to its end while the rows below it were still off screen — the exact
 * "I cannot see the bottom" symptom, just with a scrollbar that appears to work.
 *
 * So the list is a plain column that grows to fit its rows and lets `body` do the
 * scrolling. `flex: 1` is kept so a *short* list still fills the panel rather
 * than hugging the top; without it, three rows would sit at the top of a tall
 * window with a large gap under them.
 */
export const listScroll: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    paddingRight: 2,
};

export const outputsRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 84px 26px",
    gap: 6,
    marginBottom: 6,
};

export const requiredMark: React.CSSProperties = {
    color: "#ffb0b0",
    marginLeft: 2,
};

export const shapeGridBox: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    gap: 2,
    padding: 4,
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 6,
};

export const shapeRow: React.CSSProperties = {
    display: "flex",
    gap: 2,
};

export const shapeCellOn: React.CSSProperties = {
    width: 26,
    height: 26,
    padding: 0,
    cursor: "pointer",
    background: "rgba(120,190,255,0.92)",
    border: "1px solid rgba(180,220,255,0.9)",
    borderRadius: 3,
};

export const shapeCellOff: React.CSSProperties = {
    width: 26,
    height: 26,
    padding: 0,
    cursor: "pointer",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 3,
};

// ── Bundled asset library picker ──────────────────────────────────────────────

export const libSearch: React.CSSProperties = {
    ...input,
    marginBottom: 6,
};

export const libGrid: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    maxHeight: 190,
    overflowY: "auto",
    padding: 5,
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 6,
};

export const libTile: React.CSSProperties = {
    width: 62,
    padding: "3px 2px",
    cursor: "pointer",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 4,
    color: "#cfe0ff",
    font: "10px/1.25 system-ui,sans-serif",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

export const libTileActive: React.CSSProperties = {
    ...libTile,
    background: "rgba(120,190,255,0.28)",
    border: "1px solid rgba(180,220,255,0.95)",
    color: "#ffffff",
};

// ── Handlers tab ────────────────────────────────────────────────────────────

/** A boxed group of rows (one handler type, or the warning block). */
export const card: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    padding: 8,
    background: "rgba(18, 24, 40, 0.6)",
    border: "1px solid rgba(120, 160, 220, 0.25)",
    borderRadius: 4,
};

/**
 * "There is nothing here yet, and here is what to do about it."
 *
 * Used where a reference field has an empty option list, and by the advanced
 * box when an entry has no preserved fields. Deliberately informational rather
 * than alarming — nothing is wrong, there is just nothing to show.
 */
export const emptyBox: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: "17px",
    color: "rgba(220, 228, 245, 0.8)",
    background: "rgba(30, 38, 58, 0.5)",
    border: "1px dashed rgba(120, 160, 220, 0.35)",
    borderRadius: 4,
};

/** Small non-interactive label: scope, slot, usage counts. */
export const tagChip: React.CSSProperties = {
    display: "inline-block",
    padding: "1px 6px",
    fontSize: 10,
    lineHeight: "15px",
    color: "#cfe0ff",
    background: "rgba(90, 120, 190, 0.22)",
    border: "1px solid rgba(120, 160, 220, 0.3)",
    borderRadius: 3,
    whiteSpace: "nowrap",
};

/** Monospace identifier. */
export const codeKey: React.CSSProperties = {
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 12,
    color: "#ffe9a8",
};

/** Inset area holding a form or explanatory text. */
export const noteBox: React.CSSProperties = {
    padding: 8,
    background: "rgba(10, 14, 26, 0.55)",
    border: "1px solid rgba(120, 160, 220, 0.18)",
    borderRadius: 3,
};

/** Preformatted JSON snippet. */
export const codeBlock: React.CSSProperties = {
    margin: "6px 0 0 0",
    padding: 6,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 11,
    color: "#b8ffd0",
    background: "rgba(0, 0, 0, 0.35)",
    borderRadius: 3,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
};

// ── Asset preview ───────────────────────────────────────────────────────────

/**
 * Nearest-neighbour scaling.
 *
 * `image-rendering: pixelated` is the whole trick: without it a 16×16 sprite
 * scaled to 32px is bilinearly smoothed into a blur, and you cannot tell one
 * icon from another. `crisp-edges` is the older alias some engines still want.
 */
export const spritePixel: React.CSSProperties = {
    imageRendering: "pixelated",
    width: 32,
    height: 32,
    display: "block",
};

/** Icon name under a tile thumbnail. */
export const libTileName: React.CSSProperties = {
    marginTop: 2,
    fontSize: 9,
    color: "rgba(220, 230, 255, 0.75)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 68,
};

/** Row holding the magnified preview of the selected asset. */
export const spritePreviewRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    padding: 6,
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: 3,
    // A checkerboard makes transparency in the art visible instead of guessed.
    backgroundImage:
        "linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)",
    backgroundSize: "8px 8px",
    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
};
