# SYD — Synchronized Yield Directive

> *"The economy broke first. Then the systems. Then the people.*
> *Most are still waiting for someone to fix it. You stopped waiting."*

**SYD** is a real-world career RPG. Not a game that simulates progress — a system that tracks it.

Complete daily directives. Build your stats. Run the PATH Protocol. Survive the grind. The System does not care about your intentions. It only reads your execution.

**Live terminal:** [syd-protocol.github.io/terminal](https://syd-protocol.github.io/terminal)

---

## What SYD is

Most productivity apps ask you to plan. SYD asks you to move.

There are no reminders, no streaks for the sake of streaks, no rewards for checking a box. Every directive maps to a real-world behaviour — a walk, a deep work block, an uncomfortable conversation, a rest you actually took. When you complete it, your stats go up. Permanently. When you don't, your Momentum decays and your Capacity drops. Miss enough days and the System degrades: XP gain drops, the log fills with warnings, and the only way out is to execute.

SYD is not a metaphor for effort. It is a mirror.

---

## The five base stats

| Attribute | What it tracks |
|---|---|
| **Strength** | Physical output — energy, fitness, the capacity to exert yourself |
| **Intelligence** | Learning, reasoning, deliberate intellectual effort |
| **Agility** | Adaptability under disruption, pattern-breaking, response over reaction |
| **Endurance** | Sustained effort — physical, mental, emotional |
| **Charisma** | Social presence, connection, the ability to move people |

**Luck** is derived — the average of all five. You cannot grind it directly. Build the others and it rises with them.

**Job Luck** is separate — it measures your market surface area. How findable you are. How legible. It is built through Exposure: completing Market Directives in the JOB OPS panel. It decays if you go quiet.

---

## Why it works — the philosophy

SYD is built on one premise: **identity follows behaviour, not the other way around.**

Most self-improvement systems ask you to believe in a future version of yourself first, then act. SYD inverts that. You act first. The stats update. The System reflects back a version of you that is measurably different from the one that logged in six weeks ago. Over time, the numbers become evidence — and evidence is harder to argue with than motivation.

There are three mechanisms doing the work:

**Externalisation.** SYD makes invisible effort visible. A day you ran, studied, and had a hard conversation looks exactly like a day you didn't — until the System logs it. Tracking forces recognition, and recognition compounds.

**The cost of inaction.** Most habit apps are frictionless to abandon. SYD has consequences. Missed days decay your Momentum. Capacity drops. The System does not reset your streak with encouragement — it degrades your character until you return and claw it back. This asymmetry is intentional. Real life does not offer grace periods. SYD doesn't either.

**Long time horizons.** Tier 1 directives unlock at Level 1. Tier 2 at Level 10. Tier 3 at Level 25. The formula governing XP-to-level (`25 × (n-1)^1.9`) means the gap between levels widens as you rise. A Tier 3 unlock at Level 25 represents roughly two years of consistent daily execution. SYD is not designed to be completed. It is designed to be a companion for the long game — because that is the only game that matters.

---

## What SYD can do

**Core progression**
- Five base stats that rise permanently with real-world execution
- Job Luck stat — built through market Exposure, decays with inactivity
- XP, levels, and a rank ladder from F through SSS
- Momentum streak multiplier — builds over 14 days, decays on missed days
- Capacity system — drops on missed days, recovers through consistent execution
- SIG economy — earned per directive, spent in GAMES to train specific stats

**Directives**
- Three-tier quest pool with 110 directives across all five base stats
- Tier 0 initialisation track — a seven-day onboarding sequence that eases new operatives into full Tier 1 behaviour
- Gear system — one, two, or three directives per stat per day, scaling with commitment
- Career directives — Gemini-generated, path-specific actions that build professional skills and career skill tracks simultaneously
- Market Directives — completable presence actions in JOB OPS; each completed action builds Exposure and raises Job Luck
- Field notes — attach a short note to any directive at completion; required on Gear 3 slot-3 directives, optional on all others

**PATH Protocol**
- Two tracks: The Chronicler (CV paste) and The Re-Imaginer (four guided questions)
- Gemini Call 2 fires on submission — one bundled call produces three career path cards, gap analysis, hidden affinity stat, career skill tracks, stat explainers, initial directives, and initial encounters
- Best Path Signal — evidence density scoring ranks the three paths; the highest-confidence path is badged and named in SYD's voice line
- Role mapping — three rounds of selection confirm the operative's path, target role, and specialisation
- Rank confirmation — SYD infers a starting rank from CV signals; the operative corrects it if needed
- Synthesis reveal — SYD's read on the operative's record, personalised to their confirmed path
- Signal Translation Kit — CV bullets reframed in the language of their current and target roles, ready to paste

**Career skills**
- Up to five named career skill tracks, seeded from Gemini Call 2
- Each track shows score, soft cap by rank, and stat mapping
- Tracks grow from career directives, career encounters, and passive stat-matched directives
- Soft cap rises when the operative crosses to the next rank tier

**Encounters**
- Daily professional judgment scenarios — domain-specific, calibrated to the operative's confirmed path
- Two types: judgment (Gemini evaluates the operative's reasoning) and teaching (pre-written expert read)
- Two-step flow: choose a response, then explain the reasoning behind it
- Neural Link active: Gemini evaluates judgment encounters and acknowledges free-text responses on teaching encounters

**Psychometric scan (GAMES)**
- Eight mini-games that measure seven cognitive and behavioural traits
- Traits feed directly into stat seeding at PATH completion
- Trait Signals visible on the STATUS screen from Level 1

**JOB OPS**
- Three panels: Profile, Market Read, and Job Hunt
- Profile: AI-generated CV draft, professional summary, role reframes for current and target roles
- Market Read: live demand signal, skill shifts, adjacent opportunities, Next Moves queue, Where To Be Present queue — both queues are completable Market Directives
- Job Hunt: intent toggle (Actively Hunting / Building Toward a Move / Growing in Place), search strings, LinkedIn headline formula, keywords, community recommendations
- All panels refresh on demand with a 1-hour rate limit

**Neural Link**
- Connect a Gemini, OpenAI, or Anthropic key to unlock generative features
- Powers PATH Protocol (Call 2), career encounters, market signal (Call 3), job ops profile and market (Calls A and B), and career content refresh (Call 4)
- Behavioural Trace — journal your day and the System identifies patterns, assesses stat alignment, and generates a follow-up directive
- All keys stored locally only — never transmitted to any SYD server

**Infrastructure**
- Cloud persistence via an 8-character Frequency code — ghost by default, syncing is a deliberate operative choice
- Automatic pull-on-foreground — when the app returns to focus, it checks for a newer cloud state and reloads silently if one exists
- Manual pull via Settings > Sync — recommended on iOS PWA where automatic sync may not trigger
- Sync-Link co-op tether — two operatives share a Sync-ID; simultaneous directive completion triggers Resonance, doubling XP for that event
- PWA — installable on iOS, Android, and desktop; works offline
- Push notification re-engagement after three days of inactivity
- Service Worker with network-first strategy for HTML, CSS, and JS; cache-first for static assets

**Settings**
- Tabbed settings: System (designation, gear, sound, install), Neural Link (AI config and operator profile), Sync (cloud and co-op), and Danger Zone (wipe profile)
- Operator profile field — contextual data the AI uses to personalise career content
- Install button — anchors the terminal to the device for offline access

---

## Technical stack

| Layer | Implementation |
|---|---|
| Framework | None — vanilla JS, HTML, CSS |
| Storage | `localStorage` (local) + Firebase Firestore (cloud, opt-in) |
| AI | Gemini API (primary) — OpenAI and Anthropic supported |
| Audio | Web Audio API — ambient system + co-op heartbeat layer |
| Offline | Service Worker with network-first strategy for app shell |
| Install | PWA — installable on iOS, Android, desktop |
| Notifications | Push via Service Worker |
| Build tools | None |

No bundler. No accounts required. The terminal runs anywhere a browser runs.

---

## File structure
terminal/
├── index.html                  # Single-page shell, all screens and overlays
├── manifest.json               # PWA manifest
├── service-worker.js           # Cache + notifications + update broadcast
├── css/
│   ├── style.css               # Design tokens, reset, global layout, shared utilities
│   ├── encounter.css           # Encounter screen styles (enc-)
│   ├── path.css                # PATH Protocol and onboarding styles (path-, role-, ms-)
│   ├── status.css              # STATUS screen styles (sot-, stats-, cs-, jl-)
│   ├── job-ops.css             # JOB OPS panel styles (jo-, jo-mdir-)
│   └── games-enhanced.css      # Mini-game visual enhancement layer
├── js/
│   ├── app.js                  # Core engine — player state, XP, stats, Exposure
│   ├── path.js                 # PATH Protocol — CV analysis, role mapping, Call 2
│   ├── encounter.js            # Encounter logic — judgment and teaching types
│   ├── job-ops.js              # JOB OPS — Profile, Market Read, Job Hunt panels
│   ├── status.js               # STATUS and OPS tab renderers
│   ├── scan.js                 # Psychometric scan game logic
│   ├── minigames.js            # Mini-games (CASCADE, ECHO, DRIFT, FLOW, RESONANCE)
│   ├── dailyloop.js            # Daily loop — morning transmission, close-of-day, decay
│   ├── quests.js               # Directive pool rendering and selection
│   └── gemini.js               # All Gemini API call wrappers
├── data/
│   ├── quests.json             # Daily directive pool (110 directives across 3 tiers)
│   └── encounters.json         # Encounter pool
└── icons/
├── icon-192.png
└── icon-512.png

---

## Future considerations

**Fitness Protocol**
An optional physical baseline scan — 6–8 indirect questions that assign a Fitness Rank (F through A). Generates pre-authored physical directives calibrated to that rank: walking cadences and static holds at F/E, push-up progressions and bodyweight work at D/C, complex movement combinations at B/A. Directives map to existing stats (Endurance, Strength, Agility) rather than creating new ones. Web Speech API reads form descriptions aloud so the operative can listen while in position. Opt-in placement after onboarding for new users, accessible from OPS for returning users.

**Augmented Reality interface**
An operator says "Status" and the System appears — overlaid on the world. A heads-up display showing live stat bars, active directive count, Momentum decay rate, and Job Luck tier. Wearables — smart glasses, AR headsets — link to the SYD backend and surface the terminal without breaking the flow of physical activity.

**Biometric input**
Hardware-verified execution: heart rate data confirming a run happened, sleep tracking feeding Endurance and Capacity recovery, HRV informing Momentum state. Wearable APIs (Garmin, Apple Watch, Whoop, Oura) feed raw behavioural data into the System and remove self-reporting as the single point of trust.

**Persistent world layer**
World Bosses as shared social objects — publicly declared obstacles that allies can observe and contribute strikes toward. Real-world events as time-boxed Temporal Rifts with a countdown and shared directive pools.

**Operator network and factions**
Beyond Sync-Link's two-player tether — guilds, factions, coordinated multi-operator operations. Faction leaderboards by aggregate XP, shared stat thresholds that unlock faction-level rewards.

**Adaptive directive generation**
Neural Link generates directives dynamically from the operative's Behavioural Trace, calendar data, and declared goals — replacing static quest pools with a personalised directive stream that evolves with the operator's level, current weaknesses, and active World Bosses.

**Telegram notification layer**
A Telegram bot acting as SYD's external comms channel — morning briefing and end-of-day check-in. The operative links their account with a single tap via a frequency-coded deep link. Escalating re-engagement if the operative goes dark. Built on the Telegram Bot API against a lightweight serverless backend reading from Firestore.

---

## Running locally

SYD has no build step and no dependencies. Open the project in VS Code and use the **Live Server** extension (right-click `index.html` → *Open with Live Server*). This serves the files over `http://localhost`, which is all the browser needs to register the Service Worker and test PWA features.

Do not open `index.html` directly as a `file:///` path. Service Workers refuse to register outside a server context — audio, offline mode, and the install prompt will not work.

---

## Contributing

SYD is open to contributions, particularly in areas that make the system more engaging and genuinely useful.

The highest-value areas are:

- **Directive and encounter content** — well-written directives and encounter scenarios that fit SYD's voice and target real behavioural change
- **Career domain coverage** — expanding the domain signals in `extractCVSignals()` and the local fallback path library in `path.js`
- **Performance** — keeping the terminal fast on low-end devices and slow mobile networks; no bloat, no unnecessary dependencies
- **Accessibility** — making the terminal work for as many operatives as possible

If you're contributing code, please read the technical stack section first. SYD has no build tools and no framework by design — contributions must respect that constraint. Open a discussion before starting large changes so effort is not wasted.

---

## Licence

Licensed under the **GNU Affero General Public Licence v3.0 (AGPL-3.0)**.

You are free to use, study, modify, and distribute this project, but any derivative work — including network-deployed services built on SYD — must be released under the same licence with full source code made publicly available. Commercial use without explicit written permission from the project owner is not permitted.

In plain terms: contribute freely, build on it freely, but you cannot take SYD, modify it, and profit from it without giving back to this project.

See the [AGPL-3.0 licence](https://www.gnu.org/licenses/agpl-3.0.en.html) for full terms.

---

*SYD does not gamify effort. It makes effort visible. The rest is on you.*