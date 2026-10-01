/**
 * Boot-time check that the host actually has what the actions need.
 *
 * ## Why this exists
 *
 * An action that cannot reach its namespace returns falsy, which is the same
 * value it returns when the thing it was asked to do simply did not apply. The
 * process therefore looks *idle* rather than *broken*, and nothing in the log
 * says so. That is not hypothetical: a `globalThis`-only host read made every
 * action in every role folder no-op exactly this way, and the unit tests could
 * not catch it because they supply a mocked api and so never ask whether the real
 * host was reachable.
 *
 * So this runs once at boot and names what is missing. After that the actions go
 * back to being quiet, because by then a missing namespace is either a real bug
 * someone has just been told about or a legitimately optional probe.
 *
 * ## Keeping the list honest
 *
 * `ACTION_NAMESPACES` is checked against the real `sk()?.<namespace>` call sites by
 * `handler/test/host-audit.test.ts`, so adding an action that uses a new
 * namespace fails the suite rather than quietly going un-audited. Run with:
 *
 * ```
 * deno test --allow-read --allow-env src/handler/test/host-audit.test.ts
 * ```
 *
 * @module
 */
import { hasNamespace, hostFound } from "../../host.ts";

/**
 * Every host namespace an action can reach, as a flat list of top-level names.
 *
 * Read from the `sk()?.<namespace>` call sites in `handler/**`. Duplicates are
 * fine — this is a set in effect, and keeping one entry per call site makes the
 * drift check a straight comparison rather than a judgement call.
 */
export const ACTION_NAMESPACES: readonly string[] = [
    "effects",
    "elements",
    "energy",
    "grid",
    "hooks",
    "input",
    "player",
    "projectiles",
    "random",
    "signals",
    "structures",
    "tech",
    "terrains",
    "ui",
    "upgrades",
];

export interface HostAudit {
    /** Namespaces the host answered for. */
    present: string[];
    /** Namespaces the host does not have. */
    missing: string[];
    /** False when the host itself could not be resolved at all. */
    hostFound: boolean;
}

/**
 * Ask the real host which of `namespaces` it has.
 *
 * Pure with respect to the host — it reads, never calls — so it is safe to run
 * from a test against a stub.
 */
export function auditHost(namespaces: readonly string[] = ACTION_NAMESPACES): HostAudit {
    const found = hostFound();
    const present: string[] = [];
    const missing: string[] = [];
    for (const name of namespaces) {
        (hasNamespace(name) ? present : missing).push(name);
    }
    return { present, missing, hostFound: found };
}

/**
 * Audit at boot and say so, loudly, only when something is actually wrong.
 *
 * Returns the audit so a caller (or a test) can inspect it; the logging is the
 * side effect. Two distinct messages, because they need different fixes:
 *
 * - **no host** — every action is dead, and the fix is the scope, not a namespace;
 * - **some namespaces** — the host is fine and specific calls will no-op.
 */
export function logHostAudit(audit: HostAudit = auditHost()): HostAudit {
    if (!audit.hostFound) {
        // `hostApi()` has already emitted the detailed diagnosis. Do not repeat it.
        console.error(
            `[md-my-hown-mod] host audit: no api — ${audit.missing.length} namespace(s) ` +
                `unreachable. See the host-resolution error above.`,
        );
    } else if (audit.missing.length > 0) {
        console.error(
            `[md-my-hown-mod] host audit: ${audit.missing.length} of ${
                audit.present.length +
                audit.missing.length
            } namespace(s) missing: ${audit.missing.join(", ")}.\n` +
                `  Actions using them will return "nothing happened" every tick. If this ` +
                `engine build simply lacks them, ignore this; otherwise the host read is wrong.`,
        );
    }
    return audit;
}
