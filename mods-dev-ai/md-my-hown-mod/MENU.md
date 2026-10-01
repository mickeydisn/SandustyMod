# MENU

Every section in the mod's panel, as a path list.

```
Group:Tab:
Group:Tab:List
Group:Tab:List:Edit
```

A path is written the way it is reached. `Group:Tab:List:Edit` means: open **Group**, pick **Tab**,
then **List** holds entries, and opening one (or `+ New`) gives the **Edit** panel.

**Source of truth** — this file is a readable view of code, not the code:

| What                        | Where                                  |
| --------------------------- | -------------------------------------- |
| Groups and their tabs       | `MENU_GROUPS` in `src/ui/schema.ts`    |
| Tab labels and blurbs       | `CATEGORY_META` in `src/ui/schema.ts`  |
| Which lists sit under a tab | `ATTACHED` in `src/ui/panel/attach.ts` |

A tab with no `Edit` path has no entries of its own — it is a single screen.

---

## Content

> What the player sees in the world

```
Content:
Content:Terrains:
Content:Terrains:Terrains
Content:Terrains:Terrains:Edit
Content:Elements:
Content:Elements:Elements
Content:Elements:Elements:Edit
Content:Elements:Tooltips
Content:Elements:Tooltips:Edit
Content:Structures:
Content:Structures:Structures
Content:Structures:Structures:Edit
Content:Structures:Placement fields
Content:Structures:Placement fields:Edit
Content:Structures:Behaviours
Content:Structures:Behaviours:Edit
Content:Structures:Signals
Content:Structures:Signals:Edit
Content:Items:
Content:Items:Items
Content:Items:Items:Edit
Content:Items:Excavation profiles
Content:Items:Excavation profiles:Edit
Content:Items:Projectiles
Content:Items:Projectiles:Edit
Content:Items:Excavation options
Content:Items:Projectile options
Content:Buffer
Content:Buffer:Buffer
Content:Buffer:Buffer:Edit
```

`Tooltips`, `Placement fields`, `Behaviours`, `Signals`, `Excavation profiles` and `Projectiles` are
drawn **under** the list of the thing they qualify — a tooltip is not a peer of an element, it is
something an element has, and a placement field is not a peer of a structure but a widget the
structure puts in its hotbar. `Placement fields` used to be a **Content** chip in its own right,
which gave the path Content → Placement fields → Placement fields: a screen titled after itself,
with no visible sign that the two entries were one thing. It is now reached only through
**Structures**. `Excavation options` and `Projectile
options` are drawn here too, and are the
exception within this group: they are **fixed lists** whose contents are written in code, so there
is no `Edit` panel and nothing to add, remove or change. Each is a `details`/`summary` section —
open on arrival, so the list of options is shown — with the search box and `In use only` filter
inside. They are **sections of this screen, not screens of their own**: there is no `+ New` to press
and nowhere to navigate to, because the list is the content.

## Buffer

> Values every process in this mod can share

```
Content:Buffer
Content:Buffer:Buffer
Content:Buffer:Buffer:Edit
```

A tab of its own, because a slot belongs to the **mod** and to no entry. Every other Content list is
something a structure, an element or an item _has_; a buffer slot is not any one machine's memory,
it is the single value every process agrees on. There is nothing for it to hang off, which is the
same test that decides the group a list is read in.

Each slot is a `path`, a `type`, and a value to start from. A **number** also takes a `min` and a
`max`, and those two are required rather than optional: a number is an atomic counter and a counter
is _clamped_, so an unbounded number is not a generous range — it is a value the shared buffer
refuses to create.

Read and written from a process with `bufferRead`, `bufferWrite` and `bufferIncrement`, under
**Handlers → Actions → Remember**. `bufferRead` returns its value, so it is bound with `as:` like
any other step, and a write's `value` is usually a `{{…}}` reference to an earlier step.

A `path` no slot declares is a no-op on write and the type's zero on read. That asymmetry is
deliberate: a read has to give a process something to carry on with, while a write would otherwise
_create_ the slot — so a typo in `path` would look like it worked.

## Production

> How things transform

```
Production:
Production:Contact reactions:
Production:Contact reactions:Contact reactions
Production:Contact reactions:Contact reactions:Edit
Production:Machine recipes:
Production:Machine recipes:Machine recipes
Production:Machine recipes:Machine recipes:Edit
```

## Tech

> Research, progression & upgrades

```
Tech:
Tech:Tech nodes:
Tech:Tech nodes:Tech nodes
Tech:Tech nodes:Tech nodes:Edit
Tech:Tech nodes:Unlock nodes
Tech:Tech nodes:Unlock nodes:Edit
Tech:Upgrades:
Tech:Upgrades:Upgrades
Tech:Upgrades:Upgrades:Edit
Tech:Upgrades:Upgrade categories
Tech:Upgrades:Upgrade categories:Edit
Tech:Upgrades:Upgrade actions
Tech:Upgrades:Upgrade actions:Edit
```

`Unlock nodes` sits under the tech nodes they gate, and `Upgrade categories` and `Upgrade actions`
sit under the upgrades they belong to. All three qualify something that lives in this group, so none
of them earns a tab.

## Actions

> Reacting to the player and the clock

```
Actions:
Actions:Triggers:
Actions:Triggers:Triggers
Actions:Triggers:Triggers:Edit
Actions:Input bindings:
Actions:Input bindings:Input bindings
Actions:Input bindings:Input bindings:Edit
Actions:Processors:
Actions:Processors:Processors
Actions:Processors:Processors:Edit
Actions:Hook modifiers:
Actions:Hook modifiers:Hook modifiers
Actions:Hook modifiers:Hook modifiers:Edit
```

## Energy

> Power channels and the nodes on them

```
Energy:
Energy:Networks:
Energy:Networks:Networks
Energy:Networks:Networks:Edit
Energy:Interactions:
Energy:Interactions:Interactions
Energy:Interactions:Interactions:Edit
```

## Assets

> Images, and the code that paints them

```
Assets:
Assets:Sprites:
Assets:Sprites:Sprites
Assets:Sprites:Sprites:Edit
Assets:Sprite editor
Assets:Custom draw
```

`Sprite editor` and `Custom draw` are each one screen — there is nothing to add or edit in either.
They are unrelated despite the names: `Sprite editor` is a pixel editor that saves what it draws as
an entry of the `Sprites` list, and `Custom draw` reports what the engine's draw functions can do
and which of them this mod uses.

`Sprite editor` is a separate screen rather than a part of `Custom draw` for the same reason — the
names collide, and filing one under the other would read as a mode of it. A sprite it draws is a
normal `Sprites` entry, so it is exported with the config and registered by `applyConfig()`.

## Handlers

> What this mod can run, and what it can build

```
Handlers:
Handlers:Actions:
Handlers:Actions:Actions
Handlers:Actions:Actions:Edit
Handlers:Processes:
Handlers:Processes:Processes
Handlers:Processes:Processes:Edit
```

Handlers is now just the two things that are genuinely free-standing: the raw action vocabulary, and
the named processes built from it. `Projectile options`, `Excavation options` and `Upgrade actions`
all qualify a specific entry elsewhere, so they are drawn under it — a group that only qualifies
things, and whose members are reachable from the thing they configure, costs a click and explains
nothing.

## Graph

> What points at what

```
Graph
```

One screen. The graph, plus the relation table behind it.

## Data

> Raw JSON, and a map of what you have made

```
Data:
Data:Map
Data:JSON
```

Both are single screens: `Map` draws the entries and the links between them, `JSON` inspects,
exports and imports the whole config.

---

## Totals

|                    | Count                                                      |
| ------------------ | ---------------------------------------------------------- |
| Groups             | 9                                                          |
| Tabs               | 23                                                         |
| Single screens     | 5 — `Custom draw`, `Sprite editor`, `Graph`, `Map`, `JSON` |
| Lists              | 29                                                         |
| Editable           | 27 — each has an `Edit` panel                              |
| Fixed, no `Edit`   | 2 — `Excavation options`, `Projectile options`             |
| Editable, attached | 9 — drawn under another list                               |
| Editable, own tab  | 18 — reached from a tab                                    |

Every editable list is the same three things: the entries, `+ New`, and an `Edit` panel per entry.
Back returns to the list, and the sub-nav returns to the list a child list was reached from.

The two fixed lists are the exception. They hold presets written in code, compiled once and reused,
so there is no entry to create, add, remove, edit or delete. Each is a `<details>` whose `<summary>`
names the catalogue and says how many options it has, with the search box, the `In use only` filter
and the rows underneath. The section is **open on arrival** — the list is the whole point of the
section, and the summary is there to get it out of the way once read, not to hold it until asked.

Each is drawn **inline under Items**, in the same scroll as the lists it qualifies, rather than
behind a `+ New` button that navigated to a screen of its own. That button offered to create a
seventh projectile option, and behind it sat the list the author had actually come for. So there is
now no such button, and no such screen: `isInlineCatalogue` in `src/ui/panel/attach.ts` is what the
panel asks before drawing the generic attached-list frame, and `resolveCat` sends a stale tab name
back to its parent rather than to an empty list.
