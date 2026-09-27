import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_CONFIG, type ModConfig } from "../../constants.ts";
import { joinedNetworkNames, unusedEnergyNetworks } from "./energy-network.ts";

function cfg(networks: string[], joinedBy: string[] = []): ModConfig {
    return {
        ...DEFAULT_CONFIG,
        energyNetworks: networks.map((id) => ({ id, name: id })),
        energyTypes: joinedBy.map((id, i) => ({
            id: `e${i}`,
            structureId: `s${i}`,
            type: "storage" as const,
            options: { energyType: id },
        })),
    };
}

Deno.test("every declared network is reported when nothing joins one", () => {
    const c = cfg(["busA", "busB"]);
    assertEquals(unusedEnergyNetworks(c, joinedNetworkNames(c)), ["busA", "busB"]);
});

Deno.test("unused networks are the declared ids nothing references", () => {
    const c = cfg(["busA", "busB"], ["busA"]);
    assertEquals(unusedEnergyNetworks(c, joinedNetworkNames(c)), ["busB"]);
});

Deno.test("a network joined by an energy entry is not unused", () => {
    const c = cfg(["busA"], ["busA"]);
    assertEquals(unusedEnergyNetworks(c, joinedNetworkNames(c)), []);
});

Deno.test("joined names are read from options.energyType", () => {
    assertEquals([...joinedNetworkNames(cfg([], ["busA", "busB"]))], ["busA", "busB"]);
});

Deno.test("a structure energyType also counts as joined", () => {
    const c = cfg(["busA"]);
    c.structures = [{ id: "s1", energyType: "busA" } as never];
    assertEquals(unusedEnergyNetworks(c, joinedNetworkNames(c)), []);
});

Deno.test("the engine's own default is not a declared entry", () => {
    // "power" is the engine default and lives in no config list, so declaring
    // nothing and joining "power" must not report anything.
    const c = cfg([], ["power"]);
    assertEquals(unusedEnergyNetworks(c, joinedNetworkNames(c)), []);
});
