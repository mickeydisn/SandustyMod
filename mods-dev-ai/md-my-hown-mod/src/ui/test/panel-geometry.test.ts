
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



Deno.test("the overlay is 90vw by 90vh", () => {
    assertEquals(overlayBox.width, "90vw");
    assertEquals(overlayBox.height, "90vh");
});

Deno.test("the overlay is centred", () => {
    
    
    assertEquals(overlayBox.left, "5vw");
    assertEquals(overlayBox.top, "5vh");
    assertEquals(overlayBox.right, "auto");
    assertEquals(overlayBox.bottom, "auto");
});

Deno.test("the overlay cannot be pushed off-screen", () => {
    assertEquals(overlayBox.maxWidth, "100vw");
    assertEquals(overlayBox.maxHeight, "100vh");
});



Deno.test("the panel no longer hides behind a hotbar selection", () => {
    
    
    
    
    
    assert(
        !panel.includes("isToolSelected"),
        "the panel is gated on a hotbar selection again",
    );
    
    assert(
        !panel.includes('from "../select.ts"'),
        "panel.ts still imports the selection gate",
    );
});

Deno.test("the panel renders unconditionally", () => {
    
    
    
    const body = panel.slice(panel.indexOf("export function ConfiguratorPanel"));
    const early = body.slice(0, body.indexOf("getPanelInstance("));
    const gates = early.match(/return null/g)?.length ?? 0;
    assertEquals(
        gates,
        1,
        "ConfiguratorPanel has a return null beyond the missing-React guard",
    );
    
    assert(
        /!React\?\.createElement/.test(early),
        "the early return is no longer the missing-React guard",
    );
});

Deno.test("the panel starts minimized", () => {
    
    
    
    
    assert(
        /export function createPanelComponent\(defaultMinimized = true\)/.test(panel),
        "the default is no longer 'start minimized'",
    );
});

Deno.test("no Alt+M expand hook is left polling", () => {
    
    
    
    assert(
        !panel.includes("__mdMyHownPanelExpand"),
        "the expand-request poll is back",
    );
    assert(!panel.includes("forceExpandPanel"), "forceExpandPanel is back");
});

Deno.test("the open panel ignores the stored drag position", () => {
    
    
    const body = /const posStyle = panel\.minimized([\s\S]*?): S\.overlayBox;/
        .exec(panel)?.[0];
    assert(body, "could not find posStyle");
    assert(
        body.includes("panel.x >= 0") && body.includes("panel.minimized"),
        "posStyle does not branch on minimized",
    );
});









Deno.test("the panel's height chain is unbroken from the overlay to the body", () => {
    
    
    
    assertEquals(overlayBox.height, "90vh", "the overlay is the root of the chain");
    assertEquals(panelChrome.height, "100%", "panelChrome must fill the overlay");
    assertEquals(panelChrome.display, "flex");
    assertEquals(panelChrome.flexDirection, "column");
    assertEquals(body.flex, 1, "body must take the space the nav rows leave");
    assertEquals(body.minHeight, 0, "body must be allowed to shrink below its content");
});

Deno.test("the body is the panel's only scroll container", () => {
    
    
    
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
    
    
    assertEquals(listScroll.maxHeight, undefined, "the list must not have a fixed cap");
});

Deno.test("the list screen adds no scrollbar of its own", () => {
    
    
    
    
    
    
    
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
    
    
    const d = DRAG_SLOP;
    assertEquals(exceedsSlop(0, 0, d, 0), exceedsSlop(0, 0, 0, d));
});

Deno.test("a dragged chip is kept fully on screen", () => {
    
    assertEquals(clampChip(9999, 9999, 1280, 720, 150, 40), { x: 1130, y: 680 });
    
    assertEquals(clampChip(-500, -500, 1280, 720, 150, 40), { x: 0, y: 0 });
    
    assertEquals(clampChip(400, 300, 1280, 720, 150, 40), { x: 400, y: 300 });
});

Deno.test("a zero-sized host window cannot flip the chip across the screen", () => {
    
    
    assertEquals(clampChip(10, 10, 0, 0, 150, 40), { x: 0, y: 0 });
});

Deno.test("a chip wider than the viewport is pinned to the left edge", () => {
    
    
    
    assertEquals(clampChip(50, 50, 100, 80, 150, 40), { x: 0, y: 40 });
});

Deno.test("a chip bigger than the viewport on both axes is pinned to the origin", () => {
    assertEquals(clampChip(50, 50, 100, 40, 150, 60), { x: 0, y: 0 });
});
