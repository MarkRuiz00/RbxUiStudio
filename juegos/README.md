# What the top Roblox games actually do

Teardowns of the interfaces of the most played Roblox experiences, written from real gameplay screenshots (reviewed 2026-10-08).
Use them to answer "make it look like a real hit game" with **patterns**, not copies.

> **How to read these files.** Everything here is *observed*, not documented by Roblox. Colors were sampled from compressed
> screenshots (JPEG, in-game lighting, post-processing), so treat hex values as **±10 % approximations**. Fonts are named by
> what they look like plus the closest Roblox family — **⚠️ the real font of each game is not confirmed**. No game art is
> included in this repo; the sources list where the screenshots were seen.

## Why these games

Concurrent-player snapshots from 2026 (they swing 2–3× during a day, so the order is approximate):
Brookhaven RP ~497K, Adopt Me! ~324K, 99 Nights in the Forest ~285K, RIVALS ~222K, Blox Fruits ~218K, Murder Mystery 2 ~199K,
Steal a Brainrot ~151K, Fish It! ~143K (June 2026, [Rowatcher](https://rowatcher.com/news/the-most-popular-roblox-games-right-now-ranked-by-live-players));
Murder Mystery 2 545.9K, Brookhaven 525.9K, Grow a Garden 2 505.3K (July 29 2026, [StudioKrew](https://studiokrew.com/blog/top-roblox-games-july-2026/)).
Grow a Garden peaked at 22.3 M concurrent players in August 2025 and Steal a Brainrot at 25 M+ in September 2025
([ExitLag](https://www.exitlag.com/blog/roblox-game-genres-and-popularity/), [Noping](https://noping.com/blog/how-many-people-play-roblox)).
Pet Simulator 99, Bee Swarm Simulator, DOORS, BedWars, Dress to Impress, Blade Ball, Anime Vanguards and The Strongest Battlegrounds
are included as genre references.

## The games

| Game | Genre | Style family | The one thing to learn | File |
|---|---|---|---|---|
| Grow a Garden | farming sim | stud (classic) | Restock timer + stock count make a shop feel alive | [grow-a-garden.md](grow-a-garden.md) |
| Steal a Brainrot | tycoon / steal | stud (2025 trend) | Put the info in the world (BillboardGui), keep the HUD tiny | [steal-a-brainrot.md](steal-a-brainrot.md) |
| Pet Simulator 99 | collection sim | simulator (clean white) | No panels behind HUD numbers; icons break out of windows | [pet-simulator-99.md](pet-simulator-99.md) |
| Bee Swarm Simulator | collection sim | classic functional | Labeled meters for the two numbers that matter | [bee-swarm.md](bee-swarm.md) |
| Adopt Me! | roleplay / pets | cartoony (paper cards) | Stacked "paper" windows and value tags on bundles | [adopt-me.md](adopt-me.md) |
| Brookhaven RP | roleplay | minimal light | Icons over words for the youngest players | [brookhaven.md](brookhaven.md) |
| Dress to Impress | fashion / social | cartoony (brand shapes) | The close button is a heart: shape = brand | [dress-to-impress.md](dress-to-impress.md) |
| Blox Fruits | action RPG | flat functional | Color-coded stats and big bars, zero decoration | [blox-fruits.md](blox-fruits.md) |
| Anime Vanguards / TDS | tower defense | neon dark / slate | Gacha banner screen and the unit hotbar with prices | [tower-defense.md](tower-defense.md) |
| Fisch / Fish It! | fishing RPG | minimal / dark index | Silhouette "??" collection index with progress | [fishing.md](fishing.md) |
| 99 Nights in the Forest | survival | dark minimal | Crafting tree with locked tiers and one CRAFT button | [99-nights.md](99-nights.md) |
| DOORS | horror | diegetic minimal | Almost no HUD: the fear is the interface | [doors.md](doors.md) |
| RIVALS | FPS | esports clean | Ammo bottom-right, HP bottom-left, mode cards | [rivals.md](rivals.md) |
| Blade Ball | arena | skewed energetic | Everything leans (skew) and each window owns a color | [blade-ball.md](blade-ball.md) |
| BedWars | PvP | desktop-app slate | Filterable, searchable catalog with a details pane | [bedwars.md](bedwars.md) |
| Murder Mystery 2 | social deduction | classic dark grid | Rarity name bar under every item | [murder-mystery-2.md](murder-mystery-2.md) |
| Battlegrounds (TSB, JJS) | fighting | topbar-native | Extend Roblox's own top bar instead of fighting it | [battlegrounds.md](battlegrounds.md) |

## 16 conventions almost every hit shares

1. **HUD numbers have no box.** Currency = icon + big outlined number (Pet Sim 99, Grow a Garden, Steal a Brainrot, Blox Fruits).
   Panels are for windows, not for the always-on HUD.
2. **One "home edge" for menus.** Left column (Steal a Brainrot, Blade Ball, TDS, Anime Vanguards), bottom-center bar
   (Pet Sim 99, RIVALS lobby) or right column (Brookhaven, Adopt Me, Dress to Impress). Pick one; never scatter buttons.
3. **Top-center is for "where am I / how long".** Teleport tabs (Grow a Garden `SEEDS · GARDEN · SELL`, Fisch `Menu · Shop`),
   round timers (RIVALS, Dress to Impress), day counters (99 Nights).
4. **Bottom-center belongs to the hotbar.** Default Roblox backpack (Grow a Garden, Fisch) or a custom numbered bar
   (DOORS, Battlegrounds, Anime Vanguards). Leave that strip free.
5. **Close is red and top-right.** Square in stud games, rounded square in simulators, a heart in Dress to Impress — always red-ish,
   always top-right (Grow a Garden, Pet Sim 99, Adopt Me, 99 Nights, Fish It!, Blade Ball, Brookhaven).
6. **Window titles are loud.** Big title + an icon that overlaps the frame edge (Pet Sim 99 "Inventory!", Fish It! "Fish Index",
   Adopt Me "BACKPACK"). Exclamation marks are common in kid-focused games.
7. **The same rarity ladder everywhere.** Common gray → Uncommon green → Rare blue → Epic purple → Legendary gold/orange →
   Mythic pink/red → Divine / Secret / Exclusive special. Players read it before they read text ([palette below](#rarity-colors-seen)).
8. **Robux buttons are green with the Robux glyph**, often with a **gift button** next to them (Grow a Garden, Anime Vanguards).
9. **Anchor prices.** Strikethrough old price (Grow a Garden Limited Shop), "GOOD VALUE / GREAT VALUE / BEST DEAL!" (Adopt Me bucks),
   "% OFF" tags (TDS starter bundle), luck percentages per item in a pack (Grow a Garden eggs, Anime Vanguards).
10. **Timers create urgency.** Restock countdowns ("New seeds in 4:49"), limited offers (`14:01:24`), event endings ("10 days"),
    "Next reward: 05m 30s" (Blade Ball). Every shop screen has at least one clock.
11. **Red count badges** on menu buttons pull players to new things (Pet Sim 99, RIVALS, Blox Fruits "Stats 6").
12. **Undiscovered = silhouette + "??".** Collection screens show what you don't have yet, with a progress count
    (Fish It! "All Fish: 162/284", 99 Nights "?", Pet Sim 99 "???").
13. **Show the key.** PC games print keybinds on buttons (`[Z] [X] [C]` in Blox Fruits, `F`/`Q` badges in Blade Ball, `M` Leave in RIVALS);
    on touch the same actions become big round buttons on the right.
14. **Feedback is text in the world.** "You just caught a Translucent Phantom Ray at 5.8kg!" (Fisch), kill banners top-center
    (Blade Ball, RIVALS), floating `+60xp`. Short, colored by rarity, gone in seconds.
15. **Info lives where it belongs.** Steal a Brainrot and Grow a Garden put prices, rates and timers on BillboardGuis above
    the objects, so the screen stays clean.
16. **Color = destination.** Each window/teleport has its own color and keeps it everywhere: Grow a Garden (Seeds blue, Sell red,
    Garden brown), Blade Ball (Shop red, Rewards green, Stats blue, Quests orange).

## Screen maps by genre

```
Simulator / collection          Competitive (FPS, arena)         Roleplay / social
┌─────────────────────────┐     ┌─────────────────────────┐      ┌─────────────────────────┐
│▣     [tab][tab][tab]   ⏱│     │▣   killfeed  ⏱3:53  ▤▤▤ │      │▣    Theme · 00:55     ◯│
│● 7.59k                 Q│     │tasks                    │      │◯                      ◯│
│◆ 73,748         quests→ │     │                         │      │◯       (avatar)       ◯│
│[S][I]                   │     │                         │      │◯                      ◯│
│[R][⚙]                  │     │▬▬▬ HP 150     20/100 🔫 │      │★ 221   ♥ 526           │
│     [▣][▣][▣][▣][▣]     │     │        [1][2][3][4]     │      │      (default hotbar)   │
└─────────────────────────┘     └─────────────────────────┘      └─────────────────────────┘
```

## Rarity colors seen

Sampled from screenshots (approximate). Use them as a starting point and keep your own ladder consistent.

| Tier | Grow a Garden | Murder Mystery 2 | Pet Sim 99 / others | Suggested base |
|---|---|---|---|---|
| Common | gray tag | gray | gray | `#B9C0CC` |
| Uncommon | green tag | — | green | `#5BD15B` |
| Rare | blue tag | — | blue | `#3BA1FF` |
| Epic | — | — | purple | `#B04BFF` |
| Legendary | gold tag | — | gold | `#FFB020` |
| Mythical | `#A05BD8` | — | pink/red | `#FF3B6B` |
| Divine / Godly | `#E95718` | Godly `#F507B1` | — | special (gradient) |

## What NOT to copy

- Logos, mascots, item art, names and exact layouts of these games are their owners' property. Learn the **pattern**
  (where, why, how big), then make your own art and palette. The [examples](../ejemplos/README.md) inspired by these
  games use original placeholder art.
- Fan "UI kit" redesigns of famous games circulate widely (DevForum, Figma Community, BuiltByBit). They are useful trend
  references but are **not** what the games ship — the files here note which screenshots were real gameplay.

## Method (so you can redo it)

1. Search images for `<game> roblox <screen> ui` and keep only real gameplay captures (with the Roblox top bar and chat),
   not thumbnails or fan redesigns.
2. Note *where* each element sits (edge, size relative to the screen short side), *what shape* it has, and *what it says*.
3. Sample colors from flat areas (not gradients or text edges) and round them.
4. Write the pattern, then build an original screen with it and run the [checklist](../checklist.md).
