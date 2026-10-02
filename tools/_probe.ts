// Ground truth: import the real modules and compare key sets.
import { ALL_ACTIONS } from "../mods-dev-ai/md-my-hown-mod/src/handler/actions/index.ts";
import {
    ACTION_APIS,
    ACTION_CLASSES,
    ACTION_DOMAINS,
    ACTION_EFFECTS,
} from "../mods-dev-ai/md-my-hown-mod/src/handler/core/action-class.ts";
import { HANDLER_META } from "../mods-dev-ai/md-my-hown-mod/src/handler/core/handler-registry.ts";

const C = Object.keys(ACTION_CLASSES);
const E = Object.keys(ACTION_EFFECTS);
const O = Object.keys(ACTION_DOMAINS);
const A = Object.keys(ACTION_APIS);
const D = HANDLER_META.map((m) => m.key);
const ACT = Object.keys(ALL_ACTIONS);

console.log("DECLARED_META (HANDLER_META):", D.length, "unique", new Set(D).size);
console.log("ACTION_CLASSES:", C.length);
console.log("ACTION_EFFECTS:", E.length);
console.log("ACTION_DOMAINS:", O.length);
console.log("ACTION_APIS   :", A.length);
console.log("ALL_ACTIONS   :", ACT.length);
console.log();

const s = (a: string[]) => new Set(a);
const SC = s(C), SD = s(D), SA = s(A), SACT = s(ACT);
const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).sort();

console.log("classes == effects        :", C.length === E.length && !diff(SC, s(E)).length);
console.log("classes == domains        :", C.length === O.length && !diff(SC, s(O)).length);
console.log("classes == DECLARED_META  :", !diff(SC, SD).length && !diff(SD, SC).length);
console.log("classes == ALL_ACTIONS    :", !diff(SC, SACT).length && !diff(SACT, SC).length);
console.log();
console.log("DECLARED_META keys not in classes:", diff(SD, SC));
console.log("class keys not in DECLARED_META   :", diff(SC, SD));
console.log("ALL_ACTIONS keys not in classes   :", diff(SACT, SC));
console.log("class keys not in ALL_ACTIONS     :", diff(SC, SACT));
console.log();
console.log("api-free count (classes - apis):", diff(SC, SA).length);
console.log("apis not in classes          :", diff(SA, SC));
console.log("api-free keys:", diff(SC, SA).join(" "));
