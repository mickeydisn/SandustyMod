/**
 * The `math` action, against nothing at all — it is pure arithmetic, so the fake
 * is the absence of one.
 *
 * The tests are mostly about the two decisions that are easy to get wrong and
 * impossible to see in the panel:
 *
 *   - **`div` rounds, it does not truncate.** The generator that charges at
 *     `round(cells / mult)` was the reason this action exists, and copper at
 *     `mult: 0.5` is the case that distinguishes the two. `Math.floor` there would
 *     make copper charge *twice* as fast as gold — the exact opposite of the rule,
 *     and invisible, because the generator still charges.
 *   - **`/ 0` answers the left operand.** `Infinity` would compare as "full"
 *     forever, so a generator would spawn every tick with nothing on screen to
 *     explain it.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import { decideActions } from "../actions/decide/index.ts";

const math = decideActions.math;

/**
 * Run the action and return what it answered, as a number.
 *
 * Typed `number` rather than left `unknown`: every branch of the action answers a
 * number, and a test that had to cast at each comparison would be a test where
 * `NaN` could slip through a `>` without failing loudly.
 */
function answer(options: Record<string, unknown>): number {
    return math.fn(undefined, undefined, options) as number;
}

Deno.test("math does the four operations", () => {
    assertEquals(answer({ left: "7", op: "add", right: "5" }), 12);
    assertEquals(answer({ left: "7", op: "sub", right: "5" }), 2);
    assertEquals(answer({ left: "7", op: "mul", right: "5" }), 35);
    assertEquals(answer({ left: "7", op: "div", right: "2" }), 4);
});

Deno.test("math rounds division rather than truncating it", () => {
    // The case the action was added for. `round(7 / 2)` is 4; `floor` would be 3.
    assertEquals(answer({ left: "7", op: "div", right: "2" }), 4);
    assertEquals(answer({ left: "5", op: "div", right: "2" }), 3, "2.5 rounds up to 3");
    // And the negative side, where `floor` and `round` disagree hardest:
    // `floor(-3.5)` is -4 and `round(-3.5)` is -3. Rounding is symmetric about
    // zero, truncation is not, and a charge meter that rounds the wrong way is a
    // different machine from the one the rule describes.
    //
    // Note that `Math.round` breaks a tie **upward** — `round(-3.5)` is -3, not
    // -4. That is the specified behaviour and it is what the source mod's
    // `Math.round(cells / mult)` does, so it is what belongs here. An earlier
    // draft of this test expected -4, which is `floor`, and would have passed
    // against the one implementation that is wrong.
    assertEquals(answer({ left: "-7", op: "div", right: "2" }), -3);
    // A non-tie negative, where the distinction cannot be argued about:
    // `round(-2.5)` is -2 and `floor` gives -3.
    assertEquals(answer({ left: "-5", op: "div", right: "2" }), -2);
});

Deno.test("math multiplies exactly, without rounding", () => {
    // `mul` is not rounded on purpose. The factors a config writes are whole, and
    // rounding would hide a real mistake: `0.5 * 3` should be a surprise, not 2.
    assertEquals(answer({ left: "6", op: "mul", right: "0.5" }), 3);
    assertEquals(answer({ left: "0.5", op: "mul", right: "3" }), 1.5);
});

Deno.test("math reads a stringified number, which is how a step receives it", () => {
    // Every value reaching an option has been through the engine, so it arrives as
    // a string. `Number()` is what makes `{{eaten}}` usable as an operand at all;
    // without it `"7" * "5"` would be 35 but `"7" + "5"` would be "75", and the
    // difference between arithmetic and concatenation is invisible in a config.
    assertEquals(answer({ left: "7", op: "add", right: "5" }), 12);
    assert(typeof answer({ left: "7", op: "add", right: "5" }) === "number");
});

Deno.test("math leaves the value alone when the right side is not a number", () => {
    // The identity answer, matching what `randomInt` does for a reversed range.
    // Throwing here would be a dead processor in the game rather than a visible
    // mistake, and the config that caused it would have no stack to read.
    assertEquals(answer({ left: "7", op: "div", right: "" }), 7);
    assertEquals(answer({ left: "7", op: "add", right: "abc" }), 7);
});

Deno.test("math answers 0 when the left side is not a number", () => {
    // There is no left operand to preserve here, so 0 rather than `NaN` — which
    // would poison every comparison downstream and make a generator charging at
    // `round(NaN / 5)` look like it had simply stopped.
    assertEquals(answer({ left: "abc", op: "add", right: "5" }), 0);
    assertEquals(answer({ left: "abc", op: "mul", right: "5" }), 0);
    // **But an empty left is 0, not a failure** — `Number("")` is 0 in
    // JavaScript, and that is the right answer rather than a leniency. A step
    // whose `as` never bound, or a buffer that was never written, *is* zero, and
    // treating that as an error would mean a generator fed nothing could not
    // charge at all. This is the same `Number()` the rest of the catalogue uses,
    // so an empty option means the same thing in every action.
    assertEquals(answer({ left: "", op: "add", right: "5" }), 5);
    assertEquals(answer({ left: "", op: "div", right: "5" }), 0);
});

Deno.test("math answers the left operand for division by zero", () => {
    // `Infinity` compares as "full" forever, so a threshold rule would fire every
    // tick — a generator spawning an artefact continuously, with nothing on screen
    // to say why.
    assertEquals(answer({ left: "50", op: "div", right: "0" }), 50);
    assert(Number.isFinite(answer({ left: "50", op: "div", right: "0" }) as number));
});

Deno.test("math answers the left operand for an unknown operator", () => {
    // A typo in `op` must not become a silently wrong number. This mirrors
    // `compare`, which answers 1 ("the condition held") rather than 0, on the same
    // principle: a mistake should look like something is happening.
    assertEquals(answer({ left: "7", op: "multiply", right: "5" }), 7);
    assertEquals(answer({ left: "7", op: "", right: "5" }), 7);
});

Deno.test("math reproduces the generator's three material rates", () => {
    // The end-to-end claim, written out: the source mod charges
    // `round(cells / mult)`, and with these multipliers the three materials are
    // genuinely different speeds. Before this action existed all three charged at
    // 1 per cell and `mult` was decoration on the tooltip.
    const rate = (cells: number, mult: number) =>
        answer({ left: String(cells), op: "div", right: String(mult) });
    // Gold: 1 cell = 1 charge. Copper: half a cell's worth, so a cell is 2.
    // Sand: five cells to the charge.
    assertEquals(rate(10, 1), 10);
    assertEquals(rate(10, 0.5), 20);
    assertEquals(rate(10, 5), 2);
    // The ordering is the rule, and it is what makes the three feel different:
    // copper fastest, gold in the middle, sand slowest.
    assert(rate(10, 0.5) > rate(10, 1), "copper should charge faster than gold");
    assert(rate(10, 1) > rate(10, 5), "gold should charge faster than sand");
});
