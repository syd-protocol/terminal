# SYD — Synchronized Yield Directive

> *"The economy broke first. Then the systems. Then the people. Most are still waiting for someone to fix it. You stopped waiting."*

**SYD** is a solo Progressive Web App that turns real-world habit execution into an RPG-style progression system. Complete daily directives across five attributes. Watch your stats compound. Reveal the world map. Run the protocol.

**Live terminal:** [syd-protocol.github.io/terminal](https://syd-protocol.github.io/terminal)

---

## What it is

SYD mirrors your real-world self. Your stats are not scores — they are consequences of how you invest your time and effort. Complete a Strength directive and your Strength rises. Permanently. Miss days and your Momentum decays. Your HP drops. At zero, the System enters a Corrupted state.

There is no cheat code. There is no catch-up mechanic. The only way to progress is to execute.

---

## The five attributes

| Attribute | What it tracks |
|---|---|
| **Strength** | Physical output — energy, fitness, the capacity to exert yourself |
| **Intelligence** | Learning, reasoning, deliberate intellectual effort |
| **Agility** | Adaptability under disruption, pattern-breaking, response over reaction |
| **Endurance** | Sustained effort — physical, mental, emotional |
| **Charisma** | Social presence, connection, the ability to move people |

**Luck** is derived — the average of all five. You cannot grind it directly. Build the others and it rises with them.

---

## Core systems

- **Directives** — Daily real-world tasks mapped to each attribute. Complete them to earn XP and Gold.
- **Level & Rank** — XP compounds into levels (formula: `25 × (n-1)^1.9`). Rank advances from F through SSS.
- **Momentum** — Consecutive-day streak multiplier (1.0× to 1.5×). Builds over 14 days. Decays on missed days.
- **HP** — System health. Drops when you miss days. Hits zero and the System corrupts: XP gain halved until you recover.
- **Gold** — Earned per directive. Spent in the Supply Cache on performance buffs.
- **World Map** — A radar-scan satellite map of five territory zones. Each zone unlocks as the corresponding stat grows. Fog of War clears with effort.
- **Supply Cache** — Five purchasable buffs: Focus Draught, Vitality Tonic, Sprint Scroll, Rest Sigil, Clarity Shards.
- **Save-State Transmissions** — Cloud persistence via an 8-character Save Frequency code. Ghost by default; syncing is a deliberate operator choice.
- **Sync-Link** — Co-op tether. Two operators share a Sync-ID. Complete directives simultaneously and trigger Resonance — XP doubled for that event.
- **Referral Network** — Share a referral link. When your recruit awakens, 50 Gold arrives automatically at next login.

---

## Technical stack

| Layer | Implementation |
|---|---|
| Framework | None — vanilla JS, HTML, CSS |
| Storage | `localStorage` (local) + Firebase Firestore (cloud, opt-in) |
| Audio | Web Audio API — four-layer ambient system + co-op heartbeat layer |
| Offline | Service Worker with network-first strategy for app shell |
| Install | PWA — installable on iOS, Android, desktop |
| Notifications | Push via Service Worker |
| Build tools | None |

No bundler. No accounts required. The terminal runs anywhere a browser runs.

---

## File structure

```
terminal/
├── index.html              # Single-page shell, all screens and overlays
├── manifest.json           # PWA manifest
├── service-worker.js       # Cache + notification + update broadcast worker
├── css/
│   └── style.css           # Full design system — all stage additions appended
├── js/
│   ├── app.js              # All game logic
│   └── quests.js           # Quest pool rendering and selection
├── data/
│   └── quests.json         # Daily directive pool (categorised by stat)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Development status

| Stage | Status | Description |
|---|---|---|
| Pre-1 | ✅ Complete | Bug fixes, tooltip refactor, service worker baseline |
| 1 | ✅ Complete | Core RPG system — stats, XP, level, rank, momentum, HP, onboarding |
| 2 | ✅ Complete | Gold economy, Supply Cache, active buffs |
| 3 | ✅ Complete | Atmospheric audio, relaunch boot, system log strip |
| 4 | ✅ Complete | World Map — fog of war, zone lore, directive filter, territory transmissions |
| 4.5 | ✅ Complete | First Transmission, PWA install prompt, referral stub, SYD rebrand |
| 5b | ✅ Complete | Sync-Link — cloud persistence, co-op tether, referral payout, Telegram comms |
| 5a | 🔲 In progress | Neural Link — AI processor, System Incursions, World Boss HP bars |

---

## Roadmap

### Stage 5a — The Neural Link Expansion *(next)*

A BYO-Key AI layer that translates the operator's real-world plans into structured game entities using the **SYD-Prompt architecture** — a four-step transformation chain that surfaces the underlying friction of any task, gamifies it into a named enemy entity, selects a tactical mental model as the counter-weapon, and produces a dense Tactical Guide the operator can read before executing.

Input: *"Big presentation at 2pm."*
Output: `[INCURSION: THE ARBITER — INTELLIGENCE — 45 XP — EXPIRES 14:00]` with a full Tactical Guide on tap.

The operator supplies their own API key (Gemini by default — free tier, no billing card). Stored locally only, never persisted, purged immediately after each translation (Ephemeral Protocol). The UI is elastic — Solo mode for daily directives, Combat mode when Incursions are active, War Room mode when a World Boss HP bar is in play.

### Beyond Stage 5

- World Boss Raids and Temporal Rifts (co-op encounters mapped to real-world events)
- Public bulletin board for shared Raids visible on the World Map
- Tightened Firestore security rules once an operator identity model is defined

---

## Running locally

SYD has no build step and no dependencies. Open the project in VS Code and use the **Live Server** extension (right-click `index.html` → *Open with Live Server*). This serves the files over `http://localhost`, which is all the browser needs to register the Service Worker and test PWA features.

Do not open `index.html` directly as a `file:///` path. Service Workers refuse to register outside a server context — audio, offline mode, and the install prompt will not work.

---

## Contributing

SYD is open to contributions, particularly in areas that make the game more engaging and accessible. If you want to help, the highest-value areas are:

- **Game design** — making directives, incursions, and world bosses feel more alive, varied, and genuinely fun to engage with
- **Performance** — keeping the app fast and smooth on low-end devices and slow mobile networks; no bloat, no unnecessary dependencies
- **Accessibility** — making sure the terminal works for as many operators as possible
- **Quest content** — well-written directives that fit the System voice and genuinely challenge real-world behaviour

If you're contributing code, please read the technical stack section first. SYD has no build tools and no framework by design — contributions must respect that constraint. Open a discussion before starting large changes so effort isn't wasted.

All contributions remain subject to the project licence below.

---

## Licence

Licensed under the **GNU Affero General Public Licence v3.0 (AGPL-3.0)**.

You are free to use, study, modify, and distribute this project, but any derivative work — including network-deployed services built on SYD — must be released under the same licence with full source code made publicly available. Commercial use without explicit written permission from the project owner is not permitted.

In plain terms: contribute freely, build on it freely, but you cannot take SYD, modify it, and profit from it without giving back to this project. Any revenue generated from a derivative must be directed back to the original project.

See the [AGPL-3.0 licence](https://www.gnu.org/licenses/agpl-3.0.en.html) for full terms.

---

*SYD does not gamify effort. It makes effort visible. The rest is on you.*