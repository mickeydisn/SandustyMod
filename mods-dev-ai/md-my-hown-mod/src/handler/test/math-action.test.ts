
import { assert, assertEquals } from "jsr:@std/assert";
import { decideActions } from "../actions/decide/index.ts";

const math = decideActions.math;


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
    
    assertEquals(answer({ left: "7", op: "div", right: "2" }), 4);
    assertEquals(answer({ left: "5", op: "div", right: "2" }), 3, "2.5 rounds up to 3");
    
    
    
    
    
    
    
    
    
    
    assertEquals(answer({ left: "-7", op: "div", right: "2" }), -3);
    
    
    assertEquals(answer({ left: "-5", op: "div", right: "2" }), -2);
});

Deno.test("math multiplies exactly, without rounding", () => {
    
    
    assertEquals(answer({ left: "6", op: "mul", right: "0.5" }), 3);
    assertEquals(answer({ left: "0.5", op: "mul", right: "3" }), 1.5);
});

Deno.test("math reads a stringified number, which is how a step receives it", () => {
    
    
    
    
    assertEquals(answer({ left: "7", op: "add", right: "5" }), 12);
    assert(typeof answer({ left: "7", op: "add", right: "5" }) === "number");
});

Deno.test("math leaves the value alone when the right side is not a number", () => {
    
    
    
    assertEquals(answer({ left: "7", op: "div", right: "" }), 7);
    assertEquals(answer({ left: "7", op: "add", right: "abc" }), 7);
});

Deno.test("math answers 0 when the left side is not a number", () => {
    
    
    
    assertEquals(answer({ left: "abc", op: "add", right: "5" }), 0);
    assertEquals(answer({ left: "abc", op: "mul", right: "5" }), 0);
    
    
    
    
    
    
    assertEquals(answer({ left: "", op: "add", right: "5" }), 5);
    assertEquals(answer({ left: "", op: "div", right: "5" }), 0);
});

Deno.test("math answers the left operand for division by zero", () => {
    
    
    
    assertEquals(answer({ left: "50", op: "div", right: "0" }), 50);
    assert(Number.isFinite(answer({ left: "50", op: "div", right: "0" }) as number));
});

Deno.test("math answers the left operand for an unknown operator", () => {
    
    
    
    assertEquals(answer({ left: "7", op: "multiply", right: "5" }), 7);
    assertEquals(answer({ left: "7", op: "", right: "5" }), 7);
});

Deno.test("math reproduces the generator's three material rates", () => {
    
    
    
    
    const rate = (cells: number, mult: number) =>
        answer({ left: String(cells), op: "div", right: String(mult) });
    
    
    assertEquals(rate(10, 1), 10);
    assertEquals(rate(10, 0.5), 20);
    assertEquals(rate(10, 5), 2);
    
    
    assert(rate(10, 0.5) > rate(10, 1), "copper should charge faster than gold");
    assert(rate(10, 1) > rate(10, 5), "gold should charge faster than sand");
});
