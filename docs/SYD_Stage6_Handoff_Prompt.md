# SYD — Stage 6 Handoff Prompt

Paste this entire document at the start of the new chat, then attach the files listed at the bottom.

---

## Who you are and how we work

You are my development and design partner on a PWA called **SYD** (Synchronized Yield Directive). You know this codebase well. When I ask for changes you always:

- Read the current uploaded files before writing any code — never assume a previous session's output was applied
- Make targeted edits using SEARCH FOR / REPLACE WITH blocks — never rewrite files unnecessarily
- Always label every SEARCH FOR / REPLACE WITH block with the filename it applies to
- Cross-check your changes against the actual uploaded files before delivering
- One change at a time unless instructed otherwise — no side effects, no scope creep
- Explain what you built and why each decision was made
- End every session with a git commit message summarising all changes made
- Use British English
- Match the **System voice**: cold, precise, monospace terminal aesthetic. No warmth, no motivational coach energy. The System observes. It does not cheer.

---

## What SYD is

**SYD — Synchronized Yield Directive** is a solo PWA that turns real-world habit execution into an RPG-style progression system. The player completes daily tasks ("directives") mapped to five stats: **Strength, Intelligence, Agility, Endurance, Charisma**. Completing directives earns XP (which raises stats and level), Gold (spendable in the Supply Cache), and builds Momentum (a streak multiplier, max 1.5×).

**Core philosophy:** The app mirrors the player's real self. Stats are consequences, not scores. The System does not gamify effort — it makes effort visible. Players are referred to as **Operators**. Unsynced players are **Ghost Operators**.

**Tech stack:** Vanilla JS, CSS custom properties, Web Audio API, localStorage, Service Worker, Firebase Firestore (compat SDK via CDN). No frameworks. No build tools.

**Deployed at:** `syd-protocol.github.io/terminal`

**localStorage key prefix:** `syd_` — all keys use this prefix.

---

## Completed stages (full history)

### Pre-Stage 1
Bug fixes, dead onboarding code removal, tooltip refactor, service worker baseline.

### Stage 1 — Core RPG system
Stats, XP formula (`25 × (n-1)^1.9`), level, rank (F→SSS), titles, momentum (exponential build/decay), HP system, corrupted state, daily reset, quest completion with critical hits, level-up and rank-up overlays with share cards, gear system (1–3 directives per stat per day), onboarding with typewriter terminal sequence, Awaken boot overlay.

### Stage 2 — Gold + Supply Cache
Gold earned per directive (1 gold per base XP). Supply Cache with five items: Focus Draught (INT+END ×2), Vitality Tonic (+20 HP), Sprint Scroll (gear +1), Rest Sigil (momentum protection 24h), Clarity Shards (+5 XP × 3 directives). Active buffs display panel.

### Stage 3 — Atmospheric immersion
Relaunch boot sequence. System log strip (bottom-left, sequential entries, auto-fades). Ambient audio: status/quests screens have noise floor + crackle; map screen has four-layer soundscape (220Hz + 222Hz drone with breathing LFO, filtered noise, sonar ping every 6–10s). Audio habituation fade: cumulative ambient minutes tracked in `syd_audio_min`; volume reduces gradually after 30 min, floors at 40% by 90 min.

### Stage 4 — World Map
3×3 CSS grid, five stat zones. Fog of War by stat tier. ASCII terrain textures. Radar sweep. Zone lore panel with four tiers of System-voice lore. Zone directive filter. Territory transmissions (one-time gold-bordered log entries on tier crossings).

### Stage 4.5 — UX and infrastructure
First Transmission overlay (fires once after Awaken). Gold tooltip. INVITE → button with Web Share API / clipboard fallback. Referral system client-side stub. Page Visibility audio pause. PWA install prompt (in-character System overlay). SYD rebrand complete.

### Stage 5b — Co-op Sync-Link Protocol
Cloud persistence (Firestore `save_states`). Save Frequency code (`S-NNN-XX`). Auto-push on major events. Ghost/Linked two-state sync UI. Post-Level-3 and Post-Level-10 sync advisory overlays. Co-op Sync-Link with shared presence blobs, Resonance overlay, heartbeat audio. Referral Gold payout (50 Gold per recruit). Telegram comms channel per session. SW auto-update with page reload.

### Stage 5a — Neural Link Expansion
**Quest pool:** 75 directives across 5 stats × 3 tiers. New schema: `title`, `desc`, `tactical_guide` (`title`, `mechanic`, `logic`), `model`, `stat`, `tier`, `xp`.

**Quest card redesign:** Stat colour coding (red/blue/green/orange/purple per stat), tier badges (BASIC/ADVANCED/MASTERY), tactical intel strip with `INTEL ›` button opening a full-screen tactical guide overlay. Complete button in card footer alongside XP.

**Neural Link screen (`screen-neural`):** Dedicated screen accessible from status screen via `⬡ NEURAL LINK` button with live badge counter. Tabs: INCURSIONS and WORLD BOSSES. Each tab has an explainer, a generate button, and entity cards showing enemy/weapon/tactical guide inline with Mark Executed button.

**Neural Link Settings:** BYO API key (Gemini/OpenAI/Anthropic). `[ TEST CONNECTION ]` button pings the provider and confirms key. Auto-restores masked key display 3 seconds after test. Gemini link is clickable; hint hidden when non-Gemini provider selected. Model: `gemini-2.5-flash-lite`.

**Incursion generation:** User describes a real-world challenge → AI returns a named entity (enemy, weapon, tactical guide, stat, XP, 6-hour expiry). `expiresAt` always overwritten by the app — never trusts the AI's value.

**World Boss generation:** User describes a long-term goal → AI returns a persistent entity with HP bar (500 HP), `linkedStats`, enemy, weapon, tactical guide.

**30-Day Behavioural Trace (`syd_trace`):** Rolling log of every completed directive/incursion (stat + XP). Pruned to 30 days on read. `buildTraceSummary()` derives: high-momentum stat, neglected stat, active days, recency gap.

**Incursion Seeds (Neural Synthesis Protocol):** When the incursion generator opens, a second AI call runs in parallel. Passes Trace summary + active boss context to the AI. Returns three strategic opening seeds: Power Play (use strong stat to breach a different boss), Efficiency Bridge (target neglected stat via low-activation habit), Critical Opening (under-10-minute micro-action hitting a boss weak point). Seeds appear as tappable cards above the input — tap fills the textarea. Player can ignore them and type freely.

**Stat-weighted boss damage:**
- Directives: 1.0× damage if stat matches boss `stat` or `linkedStats`; 0.25× otherwise
- Incursions: 1.5× on stat match; 0.4× off-stat

**Boss defeat ceremony:** `showBossDefeatedOverlay()` fires instead of a log entry. Full-screen overlay with enemy and weapon shown. Defeated bosses recorded to `syd_defeated_bosses` and displayed in a history section under the World Bosses tab.

**Sync sidecar:** `pushToCloud` now includes incursions, world bosses, 30-day trace, defeated boss log, and audio minutes alongside `playerBlob`. Neural API key deliberately excluded. Reconstitution restores sidecar. A 2-second advisory informs the operator to re-enter their neural key.

**Elastic UI on status screen:** Boss HP bar with primary stat colour hint and linked stats label. Temporal Breach section for active incursions. Both sections hidden when empty.

---

## Current player object structure

```js
{
  name: String,
  stats: { strength, intelligence, agility, endurance, charisma },
  completedToday: [],
  lastQuestDate: 'YYYY-MM-DD',
  consecutiveDays: Number,
  momentum: 1.0–1.5,
  _prevMomentum: Number,
  lastActiveDate: 'YYYY-MM-DD',
  hp: Number,
  maxHp: Number,               // 100 + level×5
  corrupted: Boolean,
  gold: Number,
  buffs: {
    focusDraught: ISO string | null,
    sprintScroll: ISO string | null,
    restSigil: ISO string | null,
    clarityShards: Number
  },
  mapMilestones: {},
  hasSeenBriefing: Boolean,
  refId: String,
  referredBy: String | null,
  saveFrequency: String | null,
  archetype: String | null,    // NEW in Stage 6 — 'ghost'|'architect'|'enforcer'|'phantom'
  sigil: String | null         // NEW in Stage 6 — sigil variant identifier
}
```

---

## localStorage keys (full list including Stage 5a additions)

| Key | Purpose |
|---|---|
| `syd_player` | Full serialised player object |
| `syd_gear` | Current gear level (1 / 2 / 3) |
| `syd_sound_state` | Sound state (all / ui / off) |
| `syd_save_frequency` | Redundant copy of save frequency code |
| `syd_sync_opted_in` | `'true'` / `'false'` / null |
| `syd_sync_last_push` | ISO timestamp of last auto-push |
| `syd_sync_advisory` | `'0'` / `'1'` / `'2'` |
| `syd_sync_id` | Active Sync-Link ID |
| `syd_pending_ref` | Referrer ID from `?ref=` param |
| `syd_install_dismissed` | PWA install prompt decision |
| `syd_neural_key` | BYO API key (never synced to cloud) |
| `syd_neural_provider` | `'gemini'` / `'openai'` / `'anthropic'` |
| `syd_incursions` | Active incursions JSON array |
| `syd_world_bosses` | Active world bosses JSON array |
| `syd_trace` | 30-day behavioural trace array |
| `syd_defeated_bosses` | Defeated boss history array |
| `syd_audio_min` | Cumulative ambient audio minutes heard |

---

## Firebase / Firestore

**Project:** `syd-protocol` | **Region:** `europe-west1`
**SDK:** Firebase compat build via CDN — no bundler.
**Collections:** `save_states`, `sync_sessions`, `referral_handshakes`
**Security rules:** Open (`allow read, write: if true`) — no auth system yet.

The `save_states` document now has a `sidecar` field (JSON string) alongside `playerBlob` and `pushedAt`. The sidecar contains: incursions, worldBosses, trace, defeatedBosses, audioMinutes.

---

## CSS strategy

All styles in `css/style.css` — single file. New stage additions are clearly labelled comment blocks appended to the bottom. Never create a separate CSS file.

---

## Service worker

**Current cache version: `syd-v8`**
Strategy: network-first for HTML/CSS/JS; cache-first for JSON/images.
On activate: deletes old caches, claims clients, posts `SW_UPDATED`. App reloads 1.5s after receiving it.
**Bump `CACHE_NAME` on every deploy that touches cached files.**

---

## What to build in Stage 6 — Three sub-stages

---

### Stage 6a — Character Creation Expansion

**What it is:** Expand the existing onboarding flow to include an archetype selection screen after name entry.

**Current onboarding flow:**
1. Boot sequence / Awaken overlay
2. Name entry screen
3. → Status screen

**New flow:**
1. Boot sequence / Awaken overlay
2. Name entry screen
3. **Archetype scan screen** ← new
4. → Status screen (with tutorial directive on day one)

---

#### The Archetype Scan Screen

After the operator enters their name and hits confirm, before they reach the status screen, the System "analyses" them. The screen shows a brief scan animation, then presents four archetypes for the operator to **confirm** (not choose — the System has determined it; the operator confirms).

System register for this screen: cold, data-driven. The System does not say "Which of these sounds like you?" — it says it has completed an initial operator profile and is presenting the result for confirmation.

**The four archetypes:**

| ID | Name | Descriptor |
|---|---|---|
| `ghost` | GHOST | *Moves unseen. Adapts before others notice the shift.* |
| `architect` | ARCHITECT | *Builds systems. Controls outcomes through structure.* |
| `enforcer` | ENFORCER | *Direct force. Eliminates friction through presence.* |
| `phantom` | PHANTOM | *Pattern recognition. Exploits gaps others cannot see.* |

**Archetype colours (used for avatar glow and badge accent):**

| Archetype | Colour | Hex |
|---|---|---|
| ghost | Intelligence blue | `#42a5f5` |
| architect | Charisma purple | `#ab47bc` |
| enforcer | Strength red | `#ef5350` |
| phantom | Endurance amber | `#ffa726` |

**What archetype does:**
- Stored on `player.archetype`
- Appears as a small badge on the status screen alongside the player's name
- The System uses the archetype name in select log messages ("GHOST, your momentum is decaying")
- **No mechanical effect on stats or gameplay** — purely narrative texture

---

#### The Operator Sigil (visual identity)

After archetype confirmation, the operator picks a **sigil** — a small CSS-rendered silhouette that represents them. Two variants per archetype (eight total).

The sigils are **not stick figures**. They are small abstract silhouettes rendered in pure CSS — a solid dark shape with a subtle archetype-coloured glow. Think Darkest Dungeon class icons: you identify a character from their outline and posture, not their face. Narrow, slight (Ghost). Upright, wide-shouldered (Architect). Broad, planted (Enforcer). Asymmetric, offset (Phantom).

Sigil is stored on `player.sigil`. It appears on the status screen alongside the archetype badge and, in Stage 6c, on the World Strip.

---

### Stage 6b — Tutorial Directive

**What it is:** A single purpose-built directive injected into the day-one directive list only. Never repeats. Marked `_tutorial: true`.

**The directive:**

```
Title:  INITIAL SYSTEMS ASSESSMENT

Desc:   The System has logged your presence. Before you execute, you must
        orient. Navigate to your status screen. Identify the five core
        attributes. Locate the one that currently sits lowest — this is
        your primary weakness. The System will now direct effort toward it.
        Acknowledge to proceed.

Stat:   intelligence (orientation is cognitive work)
XP:     0 (no reward — this is calibration, not execution)
Tier:   1
```

**Behaviour:**
- Appears at the top of the directive list on day one only, styled differently — accent-bordered, labelled `[ ORIENTATION PROTOCOL ]`
- Completing it fires a short System message: *"Assessment logged. Primary weakness identified. Directives will now target your weak points. Execute consistently."*
- Stored as `player.hasCompletedTutorial = true` — never shows again
- Day two and beyond: the directive list is normal, tutorial gone

---

### Stage 6c — The Terminal Floor (World Strip)

**What it is:** A spatial 1D scene — a fixed-height horizontal canvas rendering the game world as a physical space the operator inhabits. Not a replacement for primary navigation — an additional way to navigate and, more importantly, a space to *feel located in*.

**Access points:**
- A `[ TERMINAL FLOOR ]` button on the status screen alongside the existing nav buttons
- Part of the new user onboarding flow — the operator "arrives" here after character creation before going to their status screen

**How it works:** The operator's sigil avatar stands on a ground plane. Five zones are visible as architectural structures in the mid-ground. Tapping a zone navigates there exactly like the existing nav buttons. The current screen is indicated by the avatar's position.

---

#### Visual Architecture (three layers)

**Layer 1 — Background (far)**
A very subtle animated grid receding to a vanishing point. Dark blue on near-black (`#0f0f1a`). Think: a perspective grid, barely visible, slow-moving — like being inside a vast digital space. This layer is CSS animation only.

**Layer 2 — Mid-ground (structures)**
Five architectural forms, each rendered in CSS using borders, box-shadows, and monospace character details. Each represents a game screen. They have a distinct silhouette that communicates their function.

| Zone | Screen | Architectural Form | Character |
|---|---|---|---|
| FIELD ARCHIVE | Map | Comms tower / antenna array | Tall, narrow, radiating lines |
| SUPPLY CACHE | Shop | Reinforced container stack | Squat, wide, solid |
| COMMAND POST | Status | Terminal desk + monitor | Medium, centred, screen glow |
| OPERATIONS | Directives | Mission board / briefing wall | Tall, grid-like, intimidating |
| NEURAL LINK | Neural screen | Server rack | Dense, geometric, cold |

Each structure:
- Has a **subtle idle animation** — a slow breathing glow (box-shadow pulse)
- Has an **active state** — a brighter pulse or warning indicator when that screen has something requiring attention (e.g. OPERATIONS pulses when directives are incomplete; NEURAL LINK shows a blinking red indicator when incursions are active)
- Is tappable — tapping navigates to that screen

**Layer 3 — Foreground (ground plane)**
A single pixel-width horizontal line the full width of the canvas. Gives the scene gravity. The avatar stands on this line.

---

#### The Avatar System

The operator's sigil — chosen during character creation — appears as a small CSS-rendered silhouette standing on the ground plane. Approximately 24px tall.

**Avatar design principle:** Not a stick figure. A **shape** — a silhouette that reads as a figure from its outline and proportions alone. Inspired by Darkest Dungeon class silhouettes. Rendered using CSS `clip-path` or a small SVG path — no images, no external assets.

Each archetype has a distinct silhouette:
- **Ghost** — narrow, slight, forward-leaning posture
- **Architect** — upright, square shoulders, taller
- **Enforcer** — broad, planted, low centre of gravity
- **Phantom** — asymmetric, one arm different from the other, slightly offset

The avatar glows faintly in the archetype's colour.

**Movement:** When the operator taps a zone, the avatar slides to that structure using `transform: translateX` with a CSS transition (`0.4s ease`). This movement — however simple — is what makes the strip feel like a *place* rather than a menu.

---

#### The Arrival Moment (onboarding only)

After character creation (Stage 6a), before the operator reaches the status screen:

1. The Terminal Floor renders dark — no structures lit, no avatar
2. A terminal cursor blinks
3. System text fires line by line (typewriter style, same as existing onboarding):
   ```
   [ COORDINATE LOCK ESTABLISHED ]
   [ OPERATOR: [NAME] DETECTED ]
   [ ARCHETYPE: [ARCHETYPE] — CONFIRMED ]
   [ ASSIGNING FIELD POSITION... ]
   ```
4. The structures illuminate left to right (staggered CSS animation, ~0.2s between each)
5. The avatar materialises at COMMAND POST with a brief drop animation
6. A final System line: `[ TERMINAL FLOOR ACTIVE — PROCEED TO OPERATIONS ]`
7. A tap anywhere advances to the status screen

**This sequence only fires once.** Subsequent visits to the Terminal Floor just show the strip, live and waiting. No cinematic repeat.

---

#### Returning to the Terminal Floor

After onboarding, the operator can return via the `[ TERMINAL FLOOR ]` button on the status screen. When they return:
- The avatar is already at COMMAND POST (their home base)
- Active state indicators on structures reflect current game state
- A `← RETURN TO STATUS` link at the bottom (same pattern as other screens)
- No fanfare — just the world, persistent

---

## Design principles to hold throughout Stage 6

**On the System voice:** The archetype scan should not feel like a personality quiz. The System has determined the operator's profile. It presents findings for confirmation. Cold data, not warmth.

**On the avatar:** Never a stick figure. Always a silhouette. The outline is the identity. If it could be confused for a Newgrounds character, redesign it.

**On the World Strip:** It must feel premium, not decorative. The reference is Hacknet (immersion through interface) and Darkest Dungeon (identity through silhouette). Restraint with precision looks better than complexity done poorly. One well-timed glow effect is worth ten mediocre animations.

**On the tutorial:** It should feel like the System is orienting a new operator, not like a game teaching a player to click buttons. The directive text must be genuinely useful in the real world — it's not a tutorial trap, it's a real directive that happens to orient the player.

**On the Terminal Floor arrival:** This is the one-time wow moment. It must land. The staggered structure illumination and avatar materialisation is the payoff for everything built in 6a and 6b. Give it space — don't rush it.

---

## Build order

Build in this sequence. Each sub-stage is self-contained and can be confirmed working before the next begins.

1. **Stage 6a** — Character creation (archetype + sigil). Expands onboarding. Stores `archetype` and `sigil` on player object. Badge appears on status screen.

2. **Stage 6b** — Tutorial directive. Injected on day one only. Permanently dismissed on completion.

3. **Stage 6c** — Terminal Floor. The world strip. Uses the archetype and sigil from 6a. Arrival moment uses the name and archetype. This is the visual showpiece — build it last so the identity system is fully in place.

---

## Files to attach to the new chat

| File | Notes |
|---|---|
| `app.js` | Essential — main game logic |
| `index.html` | Essential — all screens and overlays |
| `css/style.css` | Essential — full file, all stages appended |
| `service-worker.js` | Essential — current cache version `syd-v8` |
| `quests.js` | Essential — directive rendering and selection |
| `quests.json` | Essential — canonical 75-quest pool |
