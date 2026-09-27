/**
 * The panel's window behaviour: a full-screen overlay when open, a draggable
 * chip when minimised.
 *
 * The pure parts are tested directly. The wiring is asserted against the
 * source, because whether a drag handler is *attached* is the whole requirement
 * and there is no DOM here to click.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import { clampChip, DRAG_SLOP, exceedsSlop } from "../drag.ts";
import {
    body,
    listScroll,
    minimizedChip,
    overlayBox,
    panelChrome,
    screen,
    titleBar,
} from "../styles.ts";

const panel = Deno.readTextFileSync(
    new URL("../panel.ts", import.meta.url).pathname,
);

// ── the open panel is a 90vw/90vh overlay ─────────────────────────────────────

Deno.test("the overlay is 90vw by 90vh", () => {
    assertEquals(overlayBox.width, "90vw");
    assertEquals(overlayBox.height, "90vh");
});

Deno.test("the overlay is centred", () => {
    // 5% on every side of a 90% box is what centres it, and it holds for any
    // viewport — which matters, since the game window is resizable.
    assertEquals(overlayBox.left, "5vw");
    assertEquals(overlayBox.top, "5vh");
    assertEquals(overlayBox.right, "auto");
    assertEquals(overlayBox.bottom, "auto");
});

Deno.test("the overlay cannot be pushed off-screen", () => {
    assertEquals(overlayBox.maxWidth, "100vw");
    assertEquals(overlayBox.maxHeight, "100vh");
});

Deno.test("the open panel ignores the stored drag position", () => {
    // Otherwise reopening the panel would restore it to wherever the chip was
    // last parked, which is the exact opposite of an overlay.
    const body = /const posStyle = panel\.minimized([\s\S]*?): S\.overlayBox;/
        .exec(panel)?.[0];
    assert(body, "could not find posStyle");
    assert(
        body.includes("panel.x >= 0") && body.includes("panel.minimized"),
        "posStyle does not branch on minimized",
    );
});

// ── the scroll chain ─────────────────────────────────────────────────────────
//
// Every one of these was wrong at some point, and each one failed the *same*
// way: the overlay stayed 90vh while the content below it silently ran off the
// bottom with nothing to scroll. So the whole chain is asserted here rather than
// left to be eyeballed in the game, where a missing scrollbar looks the same as
// a list that is simply short.

Deno.test("the panel's height chain is unbroken from the overlay to the body", () => {
    // Each link is what gives the one below it a definite height to divide up.
    // `panelChrome` is the link that was missing: with no height of its own it
    // sized to its content, so `body`'s `flex: 1` had nothing to resolve against.
    assertEquals(overlayBox.height, "90vh", "the overlay is the root of the chain");
    assertEquals(panelChrome.height, "100%", "panelChrome must fill the overlay");
    assertEquals(panelChrome.display, "flex");
    assertEquals(panelChrome.flexDirection, "column");
    assertEquals(body.flex, 1, "body must take the space the nav rows leave");
    assertEquals(body.minHeight, 0, "body must be allowed to shrink below its content");
});

Deno.test("the body is the panel's only scroll container", () => {
    // A second scroller inside the body is a nested scroll area: the wheel moves
    // whichever one the cursor is over, and the list can reach its own end while
    // rows below it are still off screen.
    assertEquals(body.overflowY, "auto", "the body is where scrolling happens");
    for (const name of ["screen", "listScroll"] as const) {
        const s = name === "screen" ? screen : listScroll;
        assert(
            s.overflowY !== "auto" && s.overflow !== "auto",
            `${name} scrolls as well as the body — two nested scroll areas`,
        );
    }
});

Deno.test("the list is not capped at a fixed pixel height", () => {
    // It was `maxHeight: 150`, which made a screen-sized overlay show a strip
    // about 30 rows tall with the rest of the window wasted.
    assertEquals(listScroll.maxHeight, undefined, "the list must not have a fixed cap");
});

Deno.test("the list screen adds no scrollbar of its own", () => {
    // Scoped to the list screen, not the whole file. `panel.ts` legitimately owns
    // one other scroller — the `multiselect` chip picker, capped at 150px because
    // a field of two hundred tags must not push the form down — and a blanket
    // "no overflowY anywhere" rule would forbid a correct thing and be ignored.
    //
    // What matters is that the screen wrapping the *rows* is not a scroll area, so
    // the body's scroll is the only one the wheel can land in.
    const screenRoot = /return h\(\s*"div",\s*\/\/ A flex column[\s\S]*?\{ style: S\.screen \},/
        .exec(
            panel,
        )?.[0];
    assert(screenRoot, "could not find the list screen's root in panel.ts");
    assert(
        !/overflow/.test(screenRoot),
        "the list screen root must not scroll — body already does",
    );
});

// ── dragging belongs to the minimised chip only ──────────────────────────────

Deno.test("the open panel's title bar has no drag handlers", () => {
    const title = /style: S\.titleBar,([\s\S]*?)\},\s*\n\s*h\("span", \{ style: S\.titleText/
        .exec(panel)?.[1];
    assert(title !== undefined, "could not find the title bar");
    assert(
        !/onPointer/.test(title),
        `the open panel is draggable again: ${title.trim().slice(0, 80)}`,
    );
});
Deno.test("the title bar no longer offers a grab cursor", () => {
    assertEquals(titleBar.cursor, "default");
});

Deno.test("the minimised chip does take a drag", () => {
    const chip =
        /onPointerDown: onDragDown,[\s\S]*?onPointerCancel: onDragUp,[\s\S]*?style: S\.minimizedChip/
            .exec(panel)?.[0];
    assert(chip, "the minimised chip has no drag handlers");
    assertEquals(minimizedChip.cursor, "grab");
});

Deno.test("clicking the chip opens the panel, unless a drag just ended", () => {
    // The chip both drags and opens, so the two gestures have to be told apart.
    const fn = /const openFromChip = \(\) => \{([\s\S]*?)\n\s*\};/
        .exec(panel)?.[1];
    assert(fn, "could not find openFromChip");
    assert(
        fn.includes("suppressClick.current"),
        "openFromChip does not check whether a drag just ended",
    );
    assert(
        fn.includes("minimized: false"),
        "openFromChip does not actually open the panel",
    );
});

// ── the pure drag rules ──────────────────────────────────────────────────────

Deno.test("a press that does not move is a click, not a drag", () => {
    assert(!exceedsSlop(100, 100, 100, 100));
    assert(!exceedsSlop(100, 100, 102, 103), "a small wobble should still be a click");
});

Deno.test("a press that travels is a drag", () => {
    assert(exceedsSlop(100, 100, 100 + DRAG_SLOP + 1, 100));
    assert(exceedsSlop(100, 100, 100, 100 - DRAG_SLOP - 1));
    assert(exceedsSlop(100, 100, 400, 400));
});

Deno.test("the slop is the same in both axes", () => {
    // Asymmetric slop would make a diagonal drag feel different from a straight
    // one, which is the sort of thing nobody notices until it annoys them.
    const d = DRAG_SLOP;
    assertEquals(exceedsSlop(0, 0, d, 0), exceedsSlop(0, 0, 0, d));
});

Deno.test("a dragged chip is kept fully on screen", () => {
    // thrown right
    assertEquals(clampChip(9999, 9999, 1280, 720, 150, 40), { x: 1130, y: 680 });
    // thrown left and up
    assertEquals(clampChip(-500, -500, 1280, 720, 150, 40), { x: 0, y: 0 });
    // in the middle is untouched
    assertEquals(clampChip(400, 300, 1280, 720, 150, 40), { x: 400, y: 300 });
});

Deno.test("a zero-sized host window cannot flip the chip across the screen", () => {
    // `Math.min(-150, x)` would be negative, and the outer `Math.max` pins it to
    // 0 — but only if the range is not inverted, which is what this asserts.
    assertEquals(clampChip(10, 10, 0, 0, 150, 40), { x: 0, y: 0 });
});

Deno.test("a chip wider than the viewport is pinned to the left edge", () => {
    // The x range is inverted (100 - 150 < 0), so the chip cannot fit at all.
    // It must sit at 0 — not at a negative x, which would push it off-screen
    // and make it unfindable. Vertically it still fits, so y is left alone.
    assertEquals(clampChip(50, 50, 100, 80, 150, 40), { x: 0, y: 40 });
});

Deno.test("a chip bigger than the viewport on both axes is pinned to the origin", () => {
    assertEquals(clampChip(50, 50, 100, 40, 150, 60), { x: 0, y: 0 });
});
