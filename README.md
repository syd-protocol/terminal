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

---

## Technical stack

| Layer | Implementation |
|---|---|
| Framework | None — vanilla JS, HTML, CSS |
| Storage | `localStorage` — local by default |
| Audio | Web Audio API — four-layer ambient system |
| Offline | Service Worker with cache-first strategy |
| Install | PWA — installable on iOS, Android, desktop |
| Notifications | Push via Service Worker |
| Build tools | None |

No dependencies. No bundler. No accounts required. The terminal runs anywhere a browser runs.

---

## File structure

```
terminal/
├── index.html              # Single-page shell, all screens
├── manifest.json           # PWA manifest
├── service-worker.js       # Cache + notification worker
├── css/
│   └── style.css           # Base design system + Stage additions
├── js/
│   ├── app.js              # All game logic
│   └── quests.js           # Quest pool rendering and selection
├── data/
│   └── quests.json         # Directive pool (categorised by stat)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Development status

SYD is in active development. No production users. Breaking changes ship without migration paths until Stage 5 (cloud persistence) is complete.

| Stage | Status | Description |
|---|---|---|
| Pre-1 | ✅ Complete | Bug fixes, tooltip refactor, service worker baseline |
| 1 | ✅ Complete | Core RPG system — stats, XP, level, rank, momentum, HP, onboarding |
| 2 | ✅ Complete | Gold economy, Supply Cache, active buffs |
| 3 | ✅ Complete | Atmospheric audio, relaunch boot, system log strip |
| 4 | ✅ Complete | World Map — fog of war, zone lore, directive filter, territory transmissions |
| 5a | 🔲 Planned | Neural Link — AI processor, System Incursions, World Boss HP bars |
| 5b | 🔲 Planned | Sync-Link — Supabase persistence, co-op raids, referral rewards, Telegram comms |

---

## Roadmap (Stage 5 and beyond)

**Stage 5a — The Neural Link Expansion**

A BYO-Key AI layer that translates the player's real-world plans into game entities. Input: *"Big presentation at 2pm."* Output: `[BOSS ENCOUNTER: THE ARBITER]`. The UI becomes elastic — Solo mode, Combat mode (Incursions active), and War Room mode (World Boss HP bar looming). Player supplies their own API key. Stored locally. Purged after translation.

**Stage 5b — The Sync-Link Protocol**

Co-op without accounts. Two players share a 5-character Sync-ID and synchronise progress against shared encounters. Supabase handles the "Session Blob" — a JSON snapshot polled every 30–60 seconds. If both players complete tasks in the same window, `[RESONANCE]` fires: XP and Luck doubled for the session. Save-state transmissions let players back up and restore progress via an 8-character Save Frequency code.

---

## Running locally

SYD has no build step and no dependencies. Open the project in VS Code and use the **Live Server** extension (right-click `index.html` → *Open with Live Server*). This serves the files over `http://localhost` which is all the browser needs to register the Service Worker and test PWA features.

Do not open `index.html` directly as a file (`file:///...`). Service Workers refuse to register outside of a server context, so the app will load but audio, offline mode, and the install prompt will not work.

---

## Contributing

SYD is a solo dev project in active development. It is not currently open for external contributions. Watch the repo for Stage 5 updates.

---

## Licence

Private — all rights reserved. Not open source at this stage.

---

*SYD does not gamify effort. It makes effort visible. The rest is on you.*