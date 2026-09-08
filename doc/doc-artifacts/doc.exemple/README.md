# Sandustry mod examples

Complex, multi-API scenarios. Technical details: [doc.api](../doc.api/README.md) · Guide: [doc.summary](../doc.summary/index.md)

## Examples

| # | Title | Focus |
|---|---|---|
| [01](01-signal-state-structure.md) | Signal State Pad | structures · interactables · events · lights |
| [02](02-network-battery-ui.md) | Network Battery HUD | energy · overlays · triggers · events |
| [03](03-reactor-processing-worker.md) | Overheat Reactor | main+worker · processing · elements · signals |
| [04](04-terraformer-tool.md) | Terraformer Tool | items · raycast · patterns · cooldown · sound |
| [05](05-contact-alchemy.md) | Contact Alchemy | reactions · elements · discoveries · interactables |
| [06](06-smart-conveyor-filter.md) | Smart Filter Conveyor | placementConfig · conveyors · processing · signals |
| [07](07-ops-dashboard.md) | Ops Dashboard | UI · storage · multi-event bus · camera |
| [08](08-tech-gated-drone.md) | Tech-Gated Drone | tech · entities · maps · triggers |
| [09](09-weather-hooks-buffer.md) | Weather System | shared.buffers · workers · hooks · random |
| [10](10-blueprints-copier-auth.md) | Secure Blueprint Copier | blueprints · authorization · building · storage |

## Interaction graph

```
01 State Pad ◄── signals / events ──► 03 Reactor
03 Reactor  ──surplus energy──────► 02 Battery
03 Reactor  ──overheat────────────► 07 Dashboard + camera
04 Terraformer ──energy──► 02/03   ──blast events──► 07
05 Alchemy dust ──belts──► 06 Filter  ──steam──► 03
05 produced ──► 07   09 rain ──water──► 03
07 listens to 01–06–09 events, persists stats
08 drone tech gated; 10 copies structures from 01/02/03/06 with auth
09 lever + SAB ──► workers shard weather; hooks block burn in rain
```

## Suggested load order

Enable **01 → 02 → 03 → 05 → 06 → 09 → 04 → 07 → 08 → 10** so events and resources exist before the dashboard and tools.

Each example is a **sketch** aligned with official Sandkit names; adjust entity position fields / overlay draw APIs to your exact game build.


---

## Must-have pack (wiki-native)

Inspired by [Buildings](https://wiki.hoodedhorse.com/Sandustry/Buildings), [Research](https://wiki.hoodedhorse.com/Sandustry/Research), and tools (Shovel, Gun, Flamethrower, Drill, Grabber scanner lore).

| # | Mod | Fills the gap |
|---|---|---|
| [11](11-gold-sieve-tower.md) | **Gold Sieve Tower** | Sort gold out of mixed piles near Shakers/Presses |
| [12](12-thermal-beacon.md) | **Thermal Beacon** | Visible heat + signal for burn lines / burner belts |
| [13](13-seed-nursery-projector.md) | **Seed Nursery** | Route seeds toward Planter Boxes with style |
| [14](14-prospectors-lens.md) | **Prospector's Lens** | Identify element/terrain/structure under the crosshair |
| [15](15-cascade-launcher-clock.md) | **Cascade Clock** | Timed signals for launcher elevators / press drops |
| [16](16-collector-resonance-plate.md) | **Resonance Plate** | Gold collector audiovisual feedback |
| [17](17-void-rift-drill.md) | **Rift Drill** | Late-game energy beam digger with upgrades |
| [18](18-factory-anthem-board.md) | **Anthem Plaque** | Celebrate Viability Tier milestones |

### Factory fantasy map

```
Shaker → Sieve(11) → belts → Collector + Resonance(16)
Residue → fire + Thermal Beacon(12) → Press → Seeds → Nursery(13) → Planter
Launch elevators paced by Clock(15)
Lens(14) teaches materials; Rift Drill(17) cracks late stone
Anthem(18) + Dashboard(07) track tiers
```


---

## Out-of-the-box pack (creative)

Not QoL — *stories* told with the API.

| # | Mod | The bit that bites |
|---|---|---|
| [19](19-echo-tomb.md) | **Echo Tomb** | Record an element stream, replay it as a ghost river |
| [20](20-schrodinger-gate.md) | **Schrödinger Gate** | Random allow/block until observed (lens collapses state) |
| [21](21-pixel-sommelier.md) | **Pixel Sommelier** | Age wet sand in barrels into vintage slurry |
| [22](22-wormhole-junction.md) | **Wormhole Junction** | Channel-paired element teleporters with overload rifts |
| [23](23-sandstorm-engine.md) | **Sandstorm Engine** | Signal-powered particle hurricane (yeets the player) |
| [24](24-last-will-demolisher.md) | **Last Will** | Demolish funerals — lights, seeds, epitaph log |
| [25](25-critic-oracle.md) | **The Critic** | Talking bust that roasts your factory rates |
| [26](26-mirror-foreman.md) | **Mirror Foreman** | Symmetry auto-build across an axis |
| [27](27-flux-prophecy.md) | **Flux Prophecy** | Energy-bid lottery cult between shrines |
| [28](28-blood-moon-director.md) | **Blood Moon Director** | Global cinematic event other mods can hook |

### Chaos wiring ideas

```
Prophecy(27) winner ──► chance Blood Moon(28)
Lens(14) scan ──► collapses Schrödinger(20)
Echo Tomb(19) records Sieve(11) output into a new base wing
Wormhole(22) + Clock(15) = terrifying logistics
Critic(25) reads Factory rates from Anthem(18) tiers
Sandstorm(23) powered by Thermal Beacon(12) signal
```
