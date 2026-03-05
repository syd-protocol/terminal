# SYD — Stage 5 Handoff Prompt

Paste this entire document at the start of the new chat, then attach the files listed at the bottom.

---

## Who you are and how we work

You are my development and design partner on a PWA called **SYD** (Synchronized Yield Directive). You know this codebase well. When I ask for changes you always:

- Read the current uploaded files before writing any code — never assume a previous session's output was applied
- Make targeted edits using SEARCH FOR / REPLACE WITH style precision — never rewrite files unnecessarily
- Label every SEARCH FOR / REPLACE WITH block with the filename it applies to
- Cross-check your changes against the actual uploaded files before delivering anything
- Explain what you built and why each decision was made
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

## Completed stages

### Pre-Stage 1
Bug fixes, dead onboarding code removal, tooltip refactor, service worker baseline.

### Stage 1 — Core RPG system
Stats, XP formula (`25 × (n-1)^1.9`), level, rank (F→SSS), titles, momentum (exponential build/decay), HP system, corrupted state, daily reset, quest completion with critical hits, level-up and rank-up overlays with share cards, gear system (1–3 directives per stat per day), onboarding with typewriter terminal sequence, Awaken boot overlay.

### Stage 2 — Gold + Supply Cache
Gold earned per directive (1 gold per base XP). Supply Cache with five items: Focus Draught (INT+END ×2), Vitality Tonic (+20 HP), Sprint Scroll (gear +1), Rest Sigil (momentum protection 24h), Clarity Shards (+5 XP × 3 directives). Active buffs display panel.

### Stage 3 — Atmospheric immersion
Relaunch boot sequence. System log strip (bottom-left, sequential entries, auto-fades). Ambient audio: status/quests screens have noise floor + crackle; map screen has four-layer soundscape (220Hz + 222Hz drone with breathing LFO, filtered noise, sonar ping every 6–10s).

### Stage 4 — World Map
3×3 CSS grid, five stat zones. Fog of War by stat tier. ASCII terrain textures. Radar sweep. Zone lore panel with four tiers of System-voice lore. Zone directive filter. Territory transmissions (one-time gold-bordered log entries on tier crossings).

### Stage 4.5 — UX and infrastructure
First Transmission overlay (fires once after Awaken). Gold tooltip. INVITE → button with Web Share API / clipboard fallback. Referral system client-side stub. Page Visibility audio pause. PWA install prompt (in-character System overlay). SYD rebrand complete.

### Stage 5b — The Co-op Sync-Link Protocol ✅ COMPLETE

All four systems built and confirmed working.

**System 1 — Save-State Transmissions**
Full cloud persistence via Firestore (`save_states` collection). Save Frequency code (`S-NNN-XX` format) generated once per operator. Auto-push on major events: level-up fires immediately, directive completion fires with 30-min cooldown. Ghost/Linked two-state Settings UI (`SYNC TERMINAL` section). Post-Level-3 advisory overlay fires once; again at Level 10 if still unlinked; dismissible by tapping outside. `SYNC_OPTED_IN_KEY`, `SYNC_LAST_PUSH_KEY`, `SYNC_ADVISORY_KEY` localStorage keys manage state.

**System 2 — Co-op Sync-Link**
Two operators share a Sync-ID (`XX-NN` format, e.g. `TR-88`). Each terminal writes a presence blob to `sync_sessions/{syncId}` in Firestore every 45 seconds. Ally activity logged to system log. Resonance overlay fires when both operators complete a directive within the same 45s window — rising four-voice chord audio. Heartbeat audio layer while tethered (sub-bass 60Hz LFO pulse, 3s fade-in / 2s fade-out). Tether restores on app reload via `synclinkRestoreIfPresent()`. `SYNC-LINK` section in Settings.

**System 3 — Referral Gold Payout**
Firestore handshake completes the existing client-side stub. Recruit onboarding writes `{ referrerRef, recruitName, recruitedAt, paid: false }` to `referral_handshakes/{recruitRefId}`. On every app load, `checkReferralPayouts()` queries for unpaid docs where `referrerRef === player.refId`, awards 50 Gold per recruit, marks docs `paid: true` in a batch commit. Silent if nothing to pay. Web Share API duplicate link bug also fixed — `text` field no longer includes the URL since the OS appends `url` separately.

**System 4 — Telegram Comms**
Per-session encrypted channel — no hardcoded global link. When a host generates a Sync-ID, a comms prompt overlay fires 800ms later asking for an optional Telegram invite link. Link saved to `sync_sessions/{syncId}.commsLink` in Firestore. Allies receive it automatically on first poll tick. `[ OPEN RESISTANCE CHANNEL ]` button appears in the Sync-Link tethered view only when a link exists (hidden by default). Button fires `tg://join?invite=HASH` deep-link with `https://t.me/+HASH` browser fallback. Comms link cleared on sever.

**SW auto-update fix**
Service worker (`syd-v5`) posts `SW_UPDATED` to all open clients on activate. `registerServiceWorker()` in `app.js` listens and reloads the page after 1.5s — open PWA instances receive fresh code automatically after every deploy.

---

## Player object structure

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
  refId: String,               // 6-char deterministic referral ID
  referredBy: String | null,   // ref ID of recruiter, if applicable
  saveFrequency: String | null // S-NNN-XX cloud save code, null until first push
}
```

---

## Firebase / Firestore

**Project:** `syd-protocol`
**Region:** `europe-west1`
**SDK:** Firebase compat build loaded via CDN `<script>` tags in `index.html` — no bundler, no npm.
**Initialisation:** Lazy — `getDB()` only fires on first sync action. Zero overhead for Ghost Operators.

**Collections:**

| Collection | Document ID | Fields |
|---|---|---|
| `save_states` | Save Frequency code | `playerBlob`, `pushedAt`, `appVersion` |
| `sync_sessions` | Sync-ID | `operator_A: { name, lastActive, directivesThisSession, lastDirectiveAt }`, `operator_B: { ... }`, `commsLink?` |
| `referral_handshakes` | Recruit's refId | `referrerRef`, `recruitName`, `recruitedAt`, `paid`, `paidAt?` |

**Security rules:** All three collections are open (`allow read, write: if true`). Intentional at this stage — no auth system exists.

---

## localStorage keys (full list)

| Key | Purpose |
|---|---|
| `syd_player` | Full serialised player object |
| `syd_gear` | Current gear level (1 / 2 / 3) |
| `syd_sound_state` | Sound state (all / ui / off) |
| `syd_save_frequency` | Redundant copy of save frequency code for quick access |
| `syd_sync_opted_in` | `'true'` / `'false'` / null (Ghost by default) |
| `syd_sync_last_push` | ISO timestamp of last auto-push |
| `syd_sync_advisory` | `'0'` / `'1'` / `'2'` — advisory overlay fire count |
| `syd_sync_id` | Active Sync-Link ID, persists across reloads |
| `syd_pending_ref` | Referrer ID from `?ref=` param — cleared after use |
| `syd_install_dismissed` | PWA install prompt decision |

---

## CSS strategy

All styles live in `css/style.css` — single source of truth. Stage additions are clearly labelled comment blocks appended to the bottom. New Stage 5a CSS should follow the same pattern: a clearly labelled block appended to the bottom of `style.css`. Do not reference `style_additions.css` — it no longer exists as a separate file.

---

## Service worker

**Current cache version: `syd-v5`**

On activate: deletes old caches, claims open clients, posts `SW_UPDATED` to all open windows. `app.js` triggers a page reload 1.5s after receiving `SW_UPDATED`. Bump `CACHE_NAME` on every deploy that changes cached files.

---

## File structure

```
terminal/
  index.html
  manifest.json           start_url and scope: /terminal/
  service-worker.js       cache: syd-v5
  README.md
  css/
    style.css
  js/
    app.js
    quests.js
  data/
    quests.json
  icons/
    icon-192.png
    icon-512.png
```

---

## What to build next — Stage 5a: The Neural Link Expansion

Stage 5b is complete. Stage 5a is the remaining track to complete Stage 5 in full.

---

### Overview: Three-layer content system

**Layer I — Daily Directives** — already built. No changes needed.

**Layer II — System Incursions (Meteors)** — time-sensitive bounty quests generated from the operator's real-world plans. Input: free text. Output: a named game entity with stat, XP reward, time window, and Tactical Guide. Requires the AI Processor.

**Layer III — World Bosses (Stars)** — long-term goals with persistent HP bars, damaged by completing relevant Dailies and Incursions. Takes weeks to defeat. HP moves only through real-world execution.

---

### The AI Processor Upgrade

BYO-Key model — the operator provides their own API key, stored in localStorage only. Never transmitted anywhere except directly to the chosen AI provider.

**Gemini is the default** (generous free tier, no billing card required). The key onboarding flow should:
- Ask for the key in System voice
- Provide a direct deep-link to `aistudio.google.com/app/apikey`
- Include brief in-character steps so the operator can get a free key and return quickly
- Also accept Anthropic and OpenAI keys for operators who already have them

---

### The SYD-Prompt Architecture (critical — read before building)

When the AI translates an operator's input into an Incursion or World Boss, it must follow a four-step transformation chain. This is what separates SYD-generated quests from generic AI output and keeps them tonally consistent with the hand-authored directive pool.

**Step 1 — Identify the Friction (The Enemy)**
The AI reads the operator's input and surfaces the underlying obstacle. Not the task itself — the friction resisting it. Example: *"Talk to my boss about a raise"* → friction is `Anxiety` and `Negotiation Asymmetry`.

**Step 2 — Gamify the Friction (The Boss)**
The friction becomes a named game entity in System voice. `Anxiety` → `[STATUS DEBUFF: CORTISOL SPIKE]`. `Negotiation Asymmetry` → `[ENTITY: THE GATEKEEPER SPECTER]`. This naming must match the cold, tactical register of the existing quest pool.

**Step 3 — Apply the Heuristic (The Weapon)**
The AI selects a relevant mental model or tactical framework to act as the counter-move against the enemy. Examples: First Principles, BATNA, Steel-manning, Pre-mortem, Inversion. The weapon must be chosen for genuine tactical fit — not randomly assigned.

**Step 4 — Draft the Tactical Guide**
The AI produces a short, dense guide explaining how to use the Weapon to defeat the Enemy. Written in System voice. Displayed as an expanded card when the operator taps the Incursion. This is the intelligence layer that makes each generated quest worth reading.

**Output JSON structure (Incursion):**

```json
{
  "id": "incursion_[timestamp]",
  "type": "incursion",
  "label": "[ INCURSION: THE GATEKEEPER SPECTER ]",
  "stat": "charisma",
  "baseXP": 45,
  "expiresAt": "ISO timestamp",
  "enemy": "NEGOTIATION ASYMMETRY",
  "weapon": "BATNA",
  "tacticalGuide": "Your leverage is invisible until you name it. Before the conversation: identify your best outcome if this negotiation fails entirely. Write it down. That number is your floor — never go below it. Enter the room knowing you can walk away. The Specter loses power the moment you stop needing their yes."
}
```

**Output JSON structure (World Boss):**

```json
{
  "id": "boss_[timestamp]",
  "type": "worldboss",
  "label": "[ WORLD BOSS: THE ARCHITECT'S DEBT ]",
  "stat": "intelligence",
  "maxHp": 500,
  "currentHp": 500,
  "enemy": "SCOPE PARALYSIS",
  "weapon": "FIRST PRINCIPLES DECOMPOSITION",
  "tacticalGuide": "The project feels immovable because you are measuring it whole. Decompose it to irreducible units. What is the single smallest thing that would constitute genuine progress? That is the first directive. The Boss does not fall in one session — it falls directive by directive.",
  "linkedStats": ["intelligence", "endurance"]
}
```

---

### Ephemeral Protocol — data safety

The raw plan text the operator types is handled as follows:
- Sent as the user message in a **single-turn API call** with no conversation history attached
- The API response contains only the structured JSON game entity
- The raw text is **never written to localStorage** and is discarded from the JS variable immediately after the API call resolves
- The AI has no memory between calls — the architecture enforces ephemerality by design, not by instruction

The UI may show a brief `[ PROCESSING INCURSION... ]` state during the API call. On success, the generated entity appears. On failure, the operator is informed and the input is cleared.

---

### Elastic UI modes

The status screen layout shifts based on active content:

- **Solo Flow** — daily directives only (current state, no change)
- **Combat Flow** — adds a `[ TEMPORAL BREACH ]` section below the stat block for active Incursions
- **War Room Flow** — adds a World Boss HP bar above the stat block, looming over everything

Mode is derived at render time from active state — no explicit mode toggle needed.

---

### Quest pool harmonisation (`alt_quests.json`)

An `alt_quests.json` file will be provided alongside `quests.json`. It is an AI-generated first draft, produced under the operator's guidance, that attempts to apply the SYD-Prompt four-step transformation to the existing directive pool. It is not a finished canonical pool — it is a starting point.

The work in this session is to **critically review `alt_quests.json`**, improve it, and produce a properly implemented replacement for `quests.json`. This involves three things:

1. **Evaluate the transformation architecture itself.** The four-step flow (Friction → Boss → Weapon → Tactical Guide) is the agreed direction but is not locked. If a better approach produces more tactically interesting and genuinely fun quests, take it. The goal is a directive pool that feels like a real game, not a framework applied for its own sake.

2. **Improve the draft entries.** Review each quest in `alt_quests.json` critically. Rewrite entries that are weak, generic, or theatrically forced. The System voice must be consistent throughout — cold, precise, tactical. No motivational coach energy.

3. **Replace `quests.json` with the improved pool.** The existing `quests.json` is being retired. The file path (`data/quests.json`) stays the same — the content is what changes. Once the new pool is validated it becomes the canonical daily directive source.

One constraint to hold throughout: the full transformation (named enemy, weapon, Tactical Guide) earns its complexity when there is genuine psychological or strategic friction — planning, negotiation, creative work, discipline under pressure. For straightforward physical execution habits, a clean terse directive in System voice is the correct treatment. Not every quest needs an enemy entity. Forcing the architecture onto simple actions makes those entries feel theatrical rather than tactical, which breaks immersion.

`alt_quests.json` also serves as the **few-shot calibration reference** for the AI Processor when generating Incursions — the AI reads the finished pool and produces generated content in the same register.

---

## Files to attach to the new chat

| File | Notes |
|---|---|
| `app.js` | Essential |
| `index.html` | Essential |
| `css/style.css` | Essential — full file |
| `service-worker.js` | Essential |
| `quests.js` | Essential — Stage 5a touches quest rendering |
| `quests.json` | Essential — existing daily directive pool |
| `alt_quests.json` | Essential — SYD-Prompt style reference for AI calibration |