/**
 * Named energy channels, and what a stored one actually does.
 *
 * **A network is not an engine object.** There is no `api.energy.registerNetwork`
 * — a scan of the bundle finds no such call, and no `"network"`, `"power"` or
 * `"energyType"` string literal in the energy module. What the engine offers is
 * `getNetwork(x, y)`, which **flood-fills from a tile**: it walks the connected
 * conductor/storage structures and returns that component. Network identity is
 * therefore geometry, not a declaration, and there is nothing to register.
 *
 * So why the tab? Because a mod still needs the two things a shared name buys:
 *
 *  - **a vocabulary.** "the 30 MW bus" is a string two energy entries can agree
 *    on, and a dropdown is a far better way to pick it than retyping it.
 *  - **a place to record intent.** What the user is really saying is "these
 *    structures belong together", and that is worth writing down even though the
 *    engine will discover the grouping on its own from how the tiles are laid.
 *
 * The id is the whole of the contract. `name` is display-only and the engine
 * never receives it, which is why the field is optional.
 *
 * **The failure this must not have.** A custom entry that no energy entry
 * references is dead config, and the engine gives no way to detect it — so this
 * module reports it at boot instead of leaving it to be noticed by a user who
 * wonders why their network does nothing. That is the only thing `registerTheRest`
 * needs from here.
 */
import { LOG, type ModConfig } from "../../constants.ts";
import { customIds } from "./index.ts";

/**
 * The network names that some stored entry actually joins.
 *
 * Read from `options.energyType` on each energy type, which is the only field
 * anywhere in the config that names a network — `EnergyTypeConfig.options` says
 * so, and the panel's "Network" picker writes exactly that key.
 *
 * A structure may also reach a network through the `energyNetwork` handler, whose
 * `energyType` option ends up on the structure's registration rather than on an
 * `energyTypes` entry. Those are included so an id joined that way is not
 * reported as unused.
 */
export function joinedNetworkNames(config: ModConfig): Set<string> {
    const out = new Set<string>();
    for (const e of config.energyTypes ?? []) {
        const name = e?.options?.energyType;
        if (typeof name === "string" && name) out.add(name);
    }
    for (const s of config.structures ?? []) {
        const name = (s as { energyType?: unknown } | null)?.energyType;
        if (typeof name === "string" && name) out.add(name);
    }
    return out;
}

/**
 * Every declared network that nothing joins.
 *
 * `joined` is the live set, not a stored one — see `joinedNetworkNames`.
 */
export function unusedEnergyNetworks(
    config: ModConfig,
    joined: ReadonlySet<string>,
): string[] {
    return [...customIds("energyNetworks", config)].filter((id) => !joined.has(id));
}

/**
 * Warn once at boot about networks nothing joins.
 *
 * Not an error — an unjoined network is legal, just inert — but it is the one
 * failure in this feature that is otherwise invisible. The engine reports
 * nothing: it finds a network by walking tiles, so a name nothing references
 * cannot influence the simulation and there is no state anywhere saying so.
 */
export function reportEnergyNetworks(
    config: ModConfig,
    joined: ReadonlySet<string>,
): void {
    const unused = unusedEnergyNetworks(config, joined);
    if (!unused.length) return;
    console.warn(
        `${LOG} energy networks declared but never joined: ${unused.join(", ")}. ` +
            `The engine finds a network by walking connected tiles, so a name nothing ` +
            `refers to cannot affect the simulation. Point some energy entries at it, ` +
            `or delete it.`,
    );
}
