[h1]🎮 PLAYER STATISTIC — The Scoreboard You Deserve[/h1]

[i]You dig. You build. You shoot things. Now the game finally keeps score.[/i]

Wonder how many conveyors you actually demolished, or whether you walk more than you dig?
Equip [b]Player Statistic[/b] and every swing, shot, step and keypress gets counted — live, as you play.
No world scan. No refresh button. No lying.


[h1]🧰 THE TOOL[/h1]
[list]
[*] Equip [b]Player Statistic[/b] from your inventory — the overlay opens while it is selected
[*] [b]Lock[/b] the panel so it stays open when you switch back to your drill
[*] [b]Mini mode[/b] — compact card strip with live totals and the last-interval trend Δ
[*] Drag it anywhere; position, zoom and opacity are remembered per world
[/list]


[h1]📋 THE TABS[/h1]
[list]
[*] [b]Structures[/b] — placed, removed and moved, broken down by structure type
[*] [b]Items[/b] — every single use, per item. Built-in and modded tools both count
[*] [b]Shoot[/b] — projectile impacts and flamethrower-over-structure, per projectile type
[*] [b]Dig[/b] — terrain cells destroyed, by terrain name
[*] [b]Move[/b] — distance walked and collisions. Teleports do [i]not[/i] count. Cheaters stay on the leaderboard
[*] [b]Keys[/b] — key presses, per key. Hold one down and it counts [i]once[/i], not 400 times
[/list]


[h1]🏠 HOME CARDS[/h1]
[list]
[*] Ships with [b]Structures · Digging · Items · Shoot · Activity[/b] — and every card is yours to rewrite
[*] Any KPI can go on any card — [b]pickups[/b] and [b]resources collected[/b] included
[*] The first item on a card is [b]primary[/b]: it owns the big number and the card colour
[*] Each row gets a live sparkline plus the change since the last data point
[*] [b]Edit cards[/b] opens a full-screen editor — [b]+ New card[/b], reorder with ↑ ↓, [b]Reset defaults[/b], [b]Cancel[/b], [b]Save[/b]
[/list]


[h1]📈 HISTORY[/h1]
[list]
[*] One data point every [b]N minutes[/b] (1–1440, default 2) — each point holds every KPI
[*] Up to [b]2000[/b] stored points (default 120); when full the oldest is dropped, so storage never explodes
[*] Charts render the last [b]10–200[/b] points (default 30)
[*] [b]Diff / Total[/b] toggle on every graph — per-interval activity, or the raw running total
[*] Tick list rows to pick which series land on the chart; [b]◉[/b] plots one metric alone
[/list]


[h1]⚙️ SETTINGS[/h1]
[list]
[*] [b]Mod enabled[/b] — master switch. Off: tool, overlay, event listeners and mod storage are cleaned up
[*] [b]Persist session KPIs[/b] — keep this session's counters across game reloads
[*] ⚙️ tab: lock, zoom, opacity, sampling cadence, history sizes, card editor
[*] [b]Reset session[/b] zeroes the run and keeps lifetime totals · [b]Wipe all KPIs[/b] clears everything
[/list]


[h1]✨ DETAILS[/h1]
[list]
[*] [b]Exactly one count per action[/b] — the engine emits several events for one placement, and this mod listens to one
[*] [b]It only watches[/b] — the action hooks it taps can veto the engine, and it never does
[*] Built-ins show their real game name; modded tools resolve through their own registered name. An id the game does not know is shown as itself, not guessed
[*] Typing in the card editor is not logged as gameplay, and standing still is not logged as a collision
[*] Same panel engine as [b]World Statistic[/b] — [i]zero[/i] dependencies on anything else
[/list]


[h1]👤 CREDITS[/h1]
Made by [b]MickeyDisn[/b] — built for the Sandustry modding API.

[code]Pro tip: Lock the panel, drop into mini mode, and keep the totals on screen while you build.[/code]

[i]If your most-used block is something you deeply regret, post a screenshot. I wanna see that Items tab.[/i]