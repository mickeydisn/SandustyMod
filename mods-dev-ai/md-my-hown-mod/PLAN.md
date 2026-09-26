# PLAN

Reorganisation of the panel's menu, the reference pickers, and the graph.
Every item below is unchecked until it is done and verified.

## Ground rules that apply to every item

1. **No free id or type entry, anywhere.** If the config stores a reference, it
   is a `select` fed by a real list. The only exceptions are fields the engine
   itself accepts as free text (pass-throughs we deliberately do not model), and
   those are labelled as pass-through.
2. **A missing id is a bug in the list, never in the user's typing.** Every list
   reads the live game registry. If a list cannot be built, the field says so
   rather than silently falling back to a text box.
3. **Nothing is deleted without a home.** Moving a screen must not drop a
   feature; the removed Help sections get folded into the screens that own them.
4. The engine stays the reference. Any claim about a field's meaning is checked
   against the bundle or a shipped mod, not assumed.

---

## 1. Menu — the requested order

Ten groups, in this order, each with the screens listed in the order given.

- [x] **Content** — Terrain, Element, Structure, Item
- [x] **Extend** — Tooltips, Excavation profiles, Projectiles, Signals
- [x] **Production** — Contact reactions, Machine recipes
- [x] **Tech** — Unlock nodes, Tech nodes, Upgrade categories, Upgrades
- [x] **Actions** — Triggers, Input bindings, Processors, Hook modifiers
- [x] **Energy** — Energy networks, Energy interactions
- [x] **Assets** — Sprites, Custom draw
- [x] **Handlers** — grouped by what uses them (Any, Items, Processing, Signal…)

> **Status: the menu itself is done.** `MENU_GROUPS` is the ten groups above in
> that order, and `Systems` and `Hooks` are dissolved. The *screens* behind the
> three new tabs (`tooltips`, `networks`, `draws`) are typed and wired but still
> need their own bodies — that is the next chunk.

### Notes on the moves, and the judgement calls in them

- [x] `interactions` is **renamed to Tooltips and moved to Extend**, and the
      earlier decision to leave it alone is **reversed** — that was wrong.

      > **Correction.** A previous pass called these element *behaviours* rather
      > than tooltips, because `INTERACTION_KINDS` reads `structure | destroyer |
      > entity | flammable | meltable | freezable | custom`, and refused the move
      > on that basis. That looked at the *kind names* and stopped there. The
      > engine's own types say otherwise:
      >
      > - `terrains.d.ts`: `/** **Tooltip interactions** shown for this terrain. */`
      > - `elements.d.ts`: `/** Optional **tooltip metadata** on structure
      >   interactions. */` — and every field in it (`textKey`, `visibleWhen`,
      >   `crossedOutWhen`, `onlyWhenTranslated`) is about hover text.
      >
      > So the feature *is* the tooltip feature. `destroyer` means "this tooltip
      > says it eats drills"; `flammable` means "this tooltip says it burns".
      > They are rows in one hover panel, registered by one call. The old label,
      > "Element ↔ structure", named one of the seven kinds and so misdescribed
      > the other six — worse than describing none of them.

      Done:
      - `interactions` is labelled **Tooltips** and sits under **Extend**.
      - The separate view-only **Tooltips** tab is gone. Two screens with one
        name is worse than neither: whichever you meant, you had a fifty-fifty
        guess. The editor is the screen now.
      - **Terrain has the identical array** (`interactions?: readonly
        elements.Interaction[]`) and this mod still edits it as a raw JSON box.
        That is the real gap this exposed, and it is the next thing to do.
      - Energy interactions stays built from the energy config; there was never
        energy in `interactions`, so that part of the original brief still does
        not apply.
      - A **structure's** `tooltipHover` is still a raw JSON box
        (`tooltipHoverJson`) — a different engine type from the element's, not
        yet modelled field by field. Recorded in `doc/KNOWN-ISSUES.md`.

- [x] `energyTypes` is **split** into networks and interactions. A network is an
      id shared by several energy types; today it is a bare
      `options.energyType` string with nothing to validate against. Give it a
      screen, a list, and a stored default.
- [x] `behaviors` (conveyor/launcher behaviour) — **decided: Extend**, not beside
      Structures. The brief left it undecided, offering Handlers or Assets; both
      are wrong (it is not code a handler calls, and not an image), and the first
      answer here was Content, next to the structures it names. That answer was
      wrong in a way worth recording: it reasoned from what the feature
      *references* — `api.structureBehaviors` takes structure ids, a conveyor
      against one and a launcher against three — which is not the axis a menu
      should be arranged on. Arranged by what it *is*, a conveyor is an existing
      structure that now moves things, which is exactly "Add to what the game
      already does". Under Content it also cost a screen change: you read the
      definition, then went somewhere else to find out what it does.
      The structure ids stay pickers, so the link to the structure is still one
      click away in either direction.
- [x] `sprites` and `DRAW_FUNCTIONS` are separate concepts that both live under
      **Assets**. Custom draw is a *list of functions*; sprites are *images*. Do
      not merge them into one screen; they are listed separately for that reason.
- [x] **Handlers** stops being a single flat browser. It groups by *which object
      consumes the handler* (item actions, processing, signals, triggers, …), so
      "what can I wire this into?" is answerable by looking at one group. A
      handler with no consumer still appears, under **Any**.
- [x] The old **Systems** and **Hooks** groups are dissolved into the list
      above; no group keeps a name that was not asked for.

---

## 2. No free id input — lists everywhere

> **Status: the mechanism is in place.** Every `Opt` now carries a `source`
> ("game" or "mod"), every reference list sets it, and a native box renders
> under any `select`/`multiselect` whose options have one. The box is collapsed
> by default and always shows the count. Two decisions are pinned by tests:
> an entry we made stays marked "ours" even after it is in the game's registry
> (it comes back from *both* sources, and the mod's list is the more useful
> fact), and a hand-written option list gets **no** box rather than a box
> claiming "0 in the game".
>
> Also fixed here, and it was a real bug: **upgrade categories and input
> bindings could list, validate, and then swallow every save.** `saveForm`
> returns early when the dispatch table has no entry, and neither screen had
> one — the store functions simply did not exist. Invisible to the type system,
> because the fault is a *missing* table entry rather than a wrong one. There is
> now a test asserting every screen with a `configKey` can be both saved and
> deleted, in both directions.

- [x] Inventory every `select` whose `options` are hardcoded, ad hoc, or empty,
      and every field that is still a plain `text` box but names a game object.
      **Also now an invariant**: one test fails on any picker with an empty list,
      and another fails on a closed list that has been filled with mod ids —
      the two ways a picker goes stale. The second has a deliberate sanity
      floor (`live > 20`, `closed > 0`) so it cannot pass by finding nothing to
      check.
- [x] **A read-only "native" box on every reference field**, collapsed by default,
      showing what the game already has in that list (elements, structures,
      items, …). Click to expand and see the full list; the value itself is still
      chosen from the picker. This is the "detail/summary next to the field"
      requirement, and it is the answer to "how do I know what the ids are?".
- [x] The native box must show the *count* even when collapsed. A field that says
      "12 in the game" is useful; one that says nothing until clicked is not.
- [x] **Upgrade categories** — pick from the game's categories plus ours.
- [x] **Network ids** — pick from the networks the mod defines, seeded with the
      game's default network.
- [x] **Upgrade category ids** — `upgrades.categoryId` was a text box whose own
      hint said it "must match a category registered with
      `api.upgrades.registerCategory`", which is an instruction to go and look the
      id up somewhere else. It is a picker now. It cannot offer the game's
      categories — `registerCategory` is write-only, there is no list call — so it
      offers ours plus `tools` (the default) plus a labelled "custom" escape, and
      the escape hatch is never written into the config.
- [x] **Structure behaviour ids** — the four structure ids inside a conveyor or
      launcher's `definition` are pickers, merged in on save and lifted back out
      on load. The `relations.test.ts` invariant is what forced this: adding the
      pickers made it complain that four reference fields were missing from the
      graph.
- [x] Anything the engine accepts as a genuinely free string is either listed or
      explicitly labelled as free text with the reason. No silent third option.
      **This is now an invariant, not a sweep**: `ALLOWED_FREE_TEXT` in
      `pickers.test.ts` names every `text` field that may stay free and why, and
      a new unlisted text box fails the build. Verified by adding a fake
      `someNewRef` field and watching the audit name it.

---

## 3. Help — graph only

- [x] Delete the non-graph Help sections (how it works, the prose field
      reference, the wordy relation list). Fold what is still worth keeping into
      the screen that owns it: field docs stay with the fields, handler docs stay
      in **Handlers**.
- [x] No dead navigation links. Help becomes a single destination.
- [x] The "✓ No broken references" banner went too. A screen whose subject is
      what is broken should not open with reassurance; the header chip reads
      "N relations" when clean and "N broken" when not, and says nothing more.

---

## 4. Graph — depth, selection, filter

- [x] **Groups are rows, not columns.** One horizontal band per menu group,
      stacked top to bottom in the menu's own order, with the group name across
      the top of its band. The transpose also fixed something the column layout
      could not: a group's name had to fit in a strip one box high, and the
      longest label had nowhere to go.
- [x] **Arrows attach only to a box's top or bottom edge**, never its side. Depth
      puts the target to the left, so a link between two kinds in one group would
      otherwise have to run sideways along the row, skimming the boxes between it
      — and a head pointing at a box's flank is easy to mistake for belonging to
      its neighbour. Two shapes: a link across rows curves directly between the
      facing edges, bowed by the horizontal gap; a link between two kinds at the
      same height arcs *under* the whole group row, because no bow can help when
      both ends are in the same band.
- [x] **A crossing is hidden, not drawn over a label.** The arrows paint under
      the boxes, so a link from Production up to Content disappears behind the row
      it passes rather than over its labels. That is the cost of the top/bottom
      rule and it is the right trade: an ambiguous arrowhead is worse than a
      briefly hidden line. Asserted as the rule it is — both ends on a top or
      bottom edge — rather than as "nothing is crossed", which this layout cannot
      deliver and was never asked for.
- [x] **Arrows point both ways, and mean different things.** ↑ at the target —
      "this box is a *parameter of* that box". ↓ at the source — "that box is
      *used in* this one". One head would force a single point of view on a
      relationship that is genuinely asked from both.
- [x] **The filter re-lays the graph out, it does not just hide boxes.** The keep
      set goes *into* `buildGraph`, so the shown kinds have their depths
      re-derived and their rows re-packed. Filtering a finished graph left the
      gaps, so a five-kind neighbourhood sat in one corner of a diagram sized for
      sixteen. This does trade away stability — a node moves when you change the
      filter — which is worth it because the point of filtering is to look at a few
      kinds properly. Edges are cut to the same set, or the relation table would
      list links to boxes that are not on the picture.
- [x] **Groups are ordered by the shallowest box in each.** Sorted top to bottom
      by minimum depth, so the groups that only feed the graph come first and a
      group that purely consumes sits below what it consumes, so most arrows are
      short instead of criss-crossing. Ties keep the menu's own order.
- [x] **Every link is selectable**, and the relation table states it in words:
      holds, field, points at, in use, broken. The two counts are the point — a
      relation the engine declares and nothing uses looks identical to one you
      rely on unless something says otherwise.
- [x] **A filter row above the graph**, opening with `all` and `no links`, then
      every box in the graph by name, in the order the picture lays them out.
- [x] Choosing a box shows **only that box and its direct neighbours**, in and
      out. `no links` shows the boxes with no connections at all, which is how
      you find a kind that exists but is never referenced.
- [x] The filter is a *view*, not a mutation: `filterGraph` copies, keeps node
      positions fixed, and leaves the dangling report intact for what is still
      on screen.
- [x] Filtering to nothing says so rather than rendering an empty box.
- [x] Filter state lives in the panel, not the screen, so it survives the
      remount on every category switch.

---

## 4b. Unlock nodes — what a structure is gated behind

- [x] **Every structure must name a node.** The field is `required`, and the
      picker never offers an empty option: the built-in **"Unlock by default"**
      is a real, listed, virtual node that every new structure starts on. An
      empty field that quietly meant "always" is exactly the ambiguity this
      removes.
- [x] **A separate list from `techs`, deliberately.** A *node* is the thing a
      structure is gated behind; a *tech* is a step in a research tree that may
      do more than unlock (items, the map, vanilla ids). Merging them meant the
      question "what is this behind?" was answered on a different screen from
      "what does my tech tree look like?".
- [x] **A "tech"-kind node builds a real in-game tech node.** `apply.ts` calls
      `tech.registerDefinition` / `registerNode` from the node's own fields, so
      editing the node edits the actual research step. A node may instead
      *borrow* an existing engine tech by id, and the two modes are exclusive —
      a borrowed tech keeps its own definition, so a cost typed alongside a
      borrow would be a second, competing source for the same node.
- [x] **This retires `alwaysUnlocked`.** The engine reads that flag in exactly
      one place, iterating a `const` literal of the *vanilla* structures
      (bundel.js 5251.js, `Ue`), so it was inert on a mod structure. An
      "always" node says the same thing legibly, is shared between structures,
      and is editable. The old key stays in the type and in the passthrough so an
      existing config survives an edit; it just has no checkbox.
- [x] **A dangling node fails *open*.** A structure naming a deleted node is
      available from the start, and the picker says so in words. The stricter
      reading would hide the structure from every fresh game with nothing to
      indicate why. Deleting a node through the panel moves its structures to
      the default explicitly, so the common path never dangles at all.
- [x] **Gating is retractable without a reload.** `player.buildings.removeById`
      withdraws an unlock a previous apply handed out, so ticking a node off
      "Unlock by default" takes effect on Apply instead of looking ignored until
      the game restarts.
- [ ] **Verified in-game.** A "tech" node has never been rendered by the
      engine's own React, and no test can show whether `registerNode` places a
      mod-owned node in the grid where the author expects. The specific worry: a
      node with **no parent** is never placed in the grid, so it can never be
      researched and its unlocks never fire. The engine exposes no way to
      enumerate the vanilla tech tree, so there is no root to default to and
      none is invented — the field is simply flagged as required in effect.

## 5. Definition of done

- [x] `deno task check` clean.
- [x] Full test suite passes.
- [x] `deno task build:main` succeeds.
- [x] `deno run -A tools/gen-reference.ts` re-run; no undocumented field left.
      (The generator has its own test that fails on any unmapped field, so this
      cannot silently rot either — adding a field forces the map to be updated.)
- [x] The outcome of the **behaviours** decision is written down — see section 1
      and `MENU_GROUPS` in `schema.ts`.
- [ ] Every moved screen verified in-game. **This cannot be done from here**, and
      it is the one item left that genuinely matters. The two that worry me most:
      - the Graph is now 7 columns wide and scrolls; whether that reads at 90vw
        is a judgement only a person looking at it can make;
      - the native box and the filter row have never been rendered by the
        engine's own React, only by a test double.

- [x] **Help** — Graph only
- [x] **Store** — Map, JSON

