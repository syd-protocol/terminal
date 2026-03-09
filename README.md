# SYD — Synchronized Yield Directive

> *"The economy broke first. Then the systems. Then the people.*
> *Most are still waiting for someone to fix it. You stopped waiting."*

**SYD** is a real-world RPG. Not a game that simulates progress — a system that tracks it.

Complete daily directives. Build your stats. Survive the grind. The System doesn't care about your intentions. It only reads your execution.

**Live terminal:** [syd-protocol.github.io/terminal](https://syd-protocol.github.io/terminal)

---

## What SYD is

Most productivity apps ask you to plan. SYD asks you to move.

There are no reminders, no streaks for the sake of streaks, no rewards for checking a box. Every directive in SYD maps to a real-world behaviour — a walk, a deep work block, an uncomfortable conversation, a rest you actually took. When you complete it, your stats go up. Permanently. When you don't, your Momentum decays and your HP drops. Miss enough days and the System enters a Corrupted state: XP gain is halved, the log fills with warnings, and the only way out is to execute.

SYD is not a metaphor for effort. It is a mirror.

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

## Why it works — the philosophy

SYD is built on one premise: **identity follows behaviour, not the other way around.**

Most self-improvement systems ask you to believe in a future version of yourself first, then act. SYD inverts that. You act first. The stats update. The System reflects back a version of you that is measurably different from the one that logged in six weeks ago. Over time, the numbers become evidence — and evidence is harder to argue with than motivation.

There are three mechanisms doing the work:

**Externalisation.** SYD makes invisible effort visible. A day you ran, studied, and had a hard conversation looks exactly like a day you didn't — until the System logs it. Tracking forces recognition, and recognition compounds.

**The cost of inaction.** Most habit apps are frictionless to abandon. SYD has consequences. Missed days rot your HP. Corruption halves your XP. The System does not reset your streak with encouragement — it degrades your character until you return and claw it back. This asymmetry is intentional. Real life does not offer grace periods. SYD doesn't either.

**Long time horizons.** Tier 1 directives unlock at Level 1. Tier 2 at Level 10. Tier 3 at Level 25. The formula governing XP-to-level (`25 × (n-1)^1.9`) means the gap between levels widens as you rise. A Tier 3 unlock at Level 25 represents roughly two years of consistent daily execution. SYD is not designed to be completed. It is designed to be a companion for the long game — because that is the only game that matters.

The result is a system where the longer you play, the more the game resembles the life you are actually trying to build.

---

## What SYD can do

**Core progression**
- Five-attribute stat system that rises permanently with real-world execution
- XP, levels, and a rank ladder from F through SSS
- Momentum streak multiplier — builds over 14 days, decays on missed days
- HP system — drops on missed days, triggers Corruption at zero
- Gold economy — earned per directive, spent on performance buffs in the Supply Cache

**Directives**
- Three-tier quest pool with 110 directives across all five attributes
- Tier 0 initialisation track — a seven-day onboarding sequence that eases new operators into full Tier 1 behaviour
- Gear system — one, two, or three directives per stat per day, scaling with commitment
- Guaranteed world boss directive slot — when a World Boss is active, at least one daily directive always targets its primary stat

**World Boss system**
- Set a real-world goal. The System catalogues it as a World Boss — a persistent enemy entity representing a long-term obstacle
- Optional Neural Link upgrade: AI-generated threat name, enemy classification, tactical guidance, and stat weighting
- Damage dealt by completing directives that match the boss's primary and linked stats
- Suggested Strikes panel on the status screen — two boss-aligned directives surfaced daily

**Neural Link**
- Connect an AI processor key (Gemini, OpenAI, or Anthropic) to unlock generative features
- Incursion Seeds — paste a real-world plan and the System generates a structured mission with a timer, objective, and threat classification
- World Boss generation — AI translates a goal statement into a full threat profile
- Behavioural Trace — journal your day and the System identifies patterns, assesses stat alignment, and generates a follow-up directive
- All keys stored locally only — never transmitted to any SYD server

**Infrastructure**
- Cloud persistence via an 8-character Save Frequency code — ghost by default, syncing is a deliberate operator choice
- Sync-Link co-op tether — two operators share a Sync-ID; simultaneous directive completion triggers Resonance, doubling XP for that event
- Referral network — 50 Gold paid automatically when a recruit awakens
- PWA — installable on iOS, Android, and desktop; works offline
- Push notification re-engagement after three days of inactivity
- Service Worker with network-first strategy and auto-update broadcast to connected clients

**Settings**
- Tabbed settings screen: System (designation, operator profile, gear, sound), Neural Link (AI config), Sync (cloud and co-op), and Danger Zone (wipe profile)
- Operator profile field — contextual data the AI uses to personalise incursions and boss assessments

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
│   └── style.css           # Full design system
├── js/
│   ├── app.js              # All game logic
│   └── quests.js           # Quest pool rendering and selection
├── data/
│   └── quests.json         # Daily directive pool (110 directives across 3 tiers)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Future considerations — building toward a real-world OP levelling system

SYD currently lives in a browser. The long-term vision is something closer to an operating layer for real life — a system that meets you in the physical world, not just on a screen.

**Augmented Reality interface**
The natural next frontier is AR: an operator says "Status" and the System appears — overlaid on the world, not locked behind a phone. A heads-up display showing live stat bars, active directive count, Momentum decay rate, and World Boss HP. Wearables — smart glasses, AR headsets, or even future contact lens displays — could link to the SYD backend and surface the terminal without breaking the flow of physical activity. The goal is a system that is present during effort, not only consulted before or after it.

**VR integration**
For deep work and deliberate practice sessions, a VR environment could serve as a full System terminal — an immersive space for reviewing stats, setting World Bosses, reviewing Behavioural Trace output, and planning the next operational cycle. Less a game world, more a command centre.

**Biometric input**
Currently SYD tracks only self-reported execution. The next layer is hardware-verified execution: heart rate data confirming a run happened, sleep tracking feeding directly into Endurance and HP recovery, HRV data informing Momentum state. Wearable APIs (Garmin, Apple Watch, Whoop, Oura) could feed raw behavioural data into the System and remove self-reporting as the single point of trust.

**Persistent world layer**
World Bosses as shared social objects — not just personal goals, but publicly declared obstacles that allies can observe, contribute strikes toward, and celebrate the defeat of. A public bulletin board of active raids on the World Map. Real-world events (a marathon, a product launch, a public performance) as time-boxed Temporal Rifts with a countdown and shared directive pools.

**Operator network and factions**
Beyond Sync-Link's two-player tether — guilds, factions, and coordinated multi-operator operations. Faction leaderboards by aggregate XP, shared stat thresholds that unlock faction-level rewards, and asymmetric co-op roles where different operators contribute different stat types toward a shared objective.

**Adaptive directive generation**
As Neural Link matures, the AI layer could generate directives dynamically from the operator's Behavioural Trace, calendar data, or declared goals — replacing static quest pools with a personalised directive stream that evolves with the operator's level, current weaknesses, and active World Bosses.

**Offline-first physical artefacts**
Printed operator cards, stat sheets, or physical journals that sync via QR or NFC when brought near a device — for operators who want a tactile layer alongside the digital one. The System as object, not just interface.

---

## Running locally

SYD has no build step and no dependencies. Open the project in VS Code and use the **Live Server** extension (right-click `index.html` → *Open with Live Server*). This serves the files over `http://localhost`, which is all the browser needs to register the Service Worker and test PWA features.

Do not open `index.html` directly as a `file:///` path. Service Workers refuse to register outside a server context — audio, offline mode, and the install prompt will not work.

---

## Contributing

SYD is open to contributions, particularly in areas that make the system more engaging and genuinely useful.

The highest-value areas are:

- **Game design** — directives, incursions, and world bosses that feel more alive, varied, and genuinely challenging to real-world behaviour
- **Performance** — keeping the terminal fast on low-end devices and slow mobile networks; no bloat, no unnecessary dependencies
- **Accessibility** — making the terminal work for as many operators as possible
- **Quest content** — well-written directives that fit the System voice and target real behavioural change

If you're contributing code, please read the technical stack section first. SYD has no build tools and no framework by design — contributions must respect that constraint. Open a discussion before starting large changes so effort isn't wasted.

---

## Licence

Licensed under the **GNU Affero General Public Licence v3.0 (AGPL-3.0)**.

You are free to use, study, modify, and distribute this project, but any derivative work — including network-deployed services built on SYD — must be released under the same licence with full source code made publicly available. Commercial use without explicit written permission from the project owner is not permitted.

In plain terms: contribute freely, build on it freely, but you cannot take SYD, modify it, and profit from it without giving back to this project.

See the [AGPL-3.0 licence](https://www.gnu.org/licenses/agpl-3.0.en.html) for full terms.

---

*SYD does not gamify effort. It makes effort visible. The rest is on you.*