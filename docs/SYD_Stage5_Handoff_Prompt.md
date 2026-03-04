# SYD — Stage 5 Handoff Prompt

Paste this entire prompt at the start of the new chat, then attach the files listed at the bottom.

---

## Who you are and how we work

You are my development and design partner on a PWA called **SYD** (Synchronized Yield Directive). You know this codebase well. When I ask for changes you always:

- Make targeted edits using SEARCH FOR / REPLACE WITH style precision — never rewrite files unnecessarily
- Cross-check every change across all core files (app.js, index.html, style_additions.css, service-worker.js) before delivering
- Explain what you built and why each decision was made
- Deliver complete files every time — never truncated, never partial
- Use British English
- Match the **System voice**: cold, precise, monospace terminal aesthetic. No warmth, no motivational coach energy. The System observes. It does not cheer.

---

## What SYD is

**SYD — Synchronized Yield Directive** is a solo PWA that turns real-world habit execution into an RPG-style progression system. The player completes daily tasks ("directives") mapped to five stats: **Strength, Intelligence, Agility, Endurance, Charisma**. Completing directives earns XP (which raises stats and level), Gold (spendable in the Supply Cache), and builds Momentum (a streak multiplier, max 1.5×).

**Core philosophy:** The app mirrors the player's real self. Stats are consequences, not scores. The System does not gamify effort — it makes effort visible. Players are referred to as **Operators**. New unsynced players are **Unlinked Operators**.

**Tech stack:** Vanilla JS, CSS custom properties, Web Audio API, localStorage, Service Worker. No frameworks. No build tools.

**Deployed at:** `syd-protocol.github.io/terminal`

**localStorage key prefix:** `syd_` — all keys use this prefix (e.g. `syd_player`, `syd_gear`, `syd_sound_state`).

---

## Completed stages

### Pre-Stage 1
- Date bug fix, dead onboarding code removal, tooltip refactor, service worker baseline

### Stage 1 — Core RPG system
- Stats, XP formula (25 × (n-1)^1.9), level, rank (F→SSS), titles, momentum (exponential build, decay), HP system, corrupted state, daily reset, quest completion with critical hits, level-up and rank-up overlays with share cards, gear system (1–3 directives per stat), onboarding with typewriter terminal sequence, Awaken boot overlay

### Stage 2 — Gold + Supply Cache
- Gold earned per directive (1 gold per base XP), Supply Cache shop with five items: Focus Draught (INT+END ×2), Vitality Tonic (+20 HP), Sprint Scroll (gear +1), Rest Sigil (momentum protection 24h), Clarity Shards (+5 XP × 3 directives). Active buffs display panel.

### Stage 3 — Atmospheric immersion
- Relaunch boot sequence: opens with `SYD_OS [Version 1.0.0] — SYNCHRONIZED YIELD DIRECTIVE` and `STATUS: CONNECTED TO RESISTANCE_HUB` (highlighted in accent blue), followed by stat integrity check, momentum delta, and system status
- System log strip (bottom-left, sequential entries, auto-fades)
- Ambient audio: status/quests screens have noise floor + crackle only (drone tones removed as too intrusive); map screen has full four-layer soundscape (220Hz + 222Hz drone with breathing LFO, filtered noise, sonar ping every 6–10s)

### Stage 4 — World Map
- 3×3 CSS grid, five stat zones: Signal Grid (INT, top), Iron Peaks (STR, left), Convergence hub (centre), Social Forest (CHA, right), Dead Sea (END, bottom-centre), Ashfield (AGI, bottom-right)
- Fog of War by stat tier: 0 (floor 10) = uncharted, 1 (11–29) = signal faint, 2 (30–59) = partially mapped, 3 (60+) = fully scanned
- ASCII terrain textures per zone, radar sweep (160% oversized CSS conic-gradient, 8s rotation)
- Zone lore panel: slides up on tap, four tiers of System-voice lore per zone, hub lore varies by zones unlocked (0–5 states)
- Zone directive filter: tap "VIEW [STAT] DIRECTIVES" → quest screen filtered to that stat, with CLEAR button
- Territory transmissions: one-time gold-bordered log entries (7s linger) on tier 2 and tier 3 crossings, stored in `player.mapMilestones`

### Stage 4.5 — UX and infrastructure (completed before handoff)
- **First Transmission overlay**: fires once after Awaken for new players. Seven System briefing lines fade in sequentially. Final line highlighted: `[ STANDING BY. YOUR FIRST DIRECTIVES HAVE BEEN ISSUED. ]`. VIEW FIRST DIRECTIVES button is the only exit — tapping it goes to quests, back returns to status. `hasSeenBriefing` flag on player object; defaults `true` for existing players so it never re-fires.
- **Gold tooltip**: tapping ◈ GOLD on the status screen opens a tooltip in the same pattern as stat tooltips.
- **INVITE → button**: on the gold row. Generates a referral link (`?ref=REFID`) with a deterministic 6-char ID. Uses Web Share API, clipboard fallback.
- **Referral system (client-side stub only — backend required for full payout)**: `checkIncomingReferral()` reads `?ref=` on load. `recordReferralIfPresent()` fires on new player creation, stores `player.referredBy`. `REFERRAL_GOLD = 50` (TBD). Cross-device gold payout is deferred to Stage 5b — do not rebuild the stub, it exists.
- **Page Visibility audio pause**: `visibilitychange` event suspends/resumes the AudioContext when the app goes to background. Resolves user complaint about audio continuing after switching apps.
- **PWA install prompt**: `beforeinstallprompt` captured and held. In-character System overlay fires 8s after first status screen load — "ANCHOR THIS TERMINAL". `syd_install_dismissed` localStorage flag prevents re-showing after a decision.
- **SYD rebrand**: all code, keys, paths, UI copy, share cards, and service worker updated from LevelUp/levelup to SYD/syd/terminal. App title is `SYD — Synchronized Yield Directive`.

**Current service worker version:** `syd-v1`

---

## Player object structure

```js
{
  name: String,
  stats: { strength, intelligence, agility, endurance, charisma },  // floor 10, no ceiling
  completedToday: [],           // quest IDs completed today
  lastQuestDate: 'YYYY-MM-DD',
  consecutiveDays: Number,
  momentum: 1.0–1.5,
  _prevMomentum: Number,        // used in relaunch boot delta display
  lastActiveDate: 'YYYY-MM-DD',
  hp: Number,                   // current HP
  maxHp: Number,                // 100 + level×5
  corrupted: Boolean,           // true when HP hits 0
  gold: Number,
  buffs: {
    focusDraught: ISO string | null,
    sprintScroll: ISO string | null,
    restSigil: ISO string | null,
    clarityShards: Number
  },
  mapMilestones: {},            // e.g. { intelligence_2: true, strength_3: true }
  hasSeenBriefing: Boolean,     // first transmission overlay
  refId: String,                // 6-char deterministic referral ID
  referredBy: String | null     // ref ID of recruiter if applicable
}
```

---

## CSS file strategy

The `style_additions.css` development workflow is now retired. All staged additions have been concluded and appended to `css/style.css`. For the next chat:

- Share the **full `css/style.css`** file — this is the single source of truth for all styles
- The next chat should deliver any new Stage 5 CSS as a clearly labelled block to append to the bottom of `style.css`
- Do not share or reference `style_additions.css` — it no longer exists as a separate file

---

## File structure

```
terminal/
  index.html
  manifest.json           start_url and scope: /terminal/
  service-worker.js       cache: syd-v1
  README.md
  css/
    style.css             ← base design system (avoid touching directly)
  js/
    app.js                ← all game logic
    quests.js             ← getDailyQuests(), renderQuests()
  data/
    quests.json           ← directive pool
  icons/
    icon-192.png
    icon-512.png
```

`style_additions.css` is delivered separately in development and appended to `css/style.css` on deploy.

---

## What to build next — two parallel expansion tracks

---

### Track A: The Neural Link Expansion (Stage 5a)

**Source doc:** `Strategic Context - The Neural Link Expansion.md`

Three-layer content system:

**Layer I — Daily Directives (already built).** No changes needed.

**Layer II — System Incursions (Meteors).** Time-sensitive bounty quests generated from the player's real-world plans. Input: free text ("Big presentation at 2pm"). Output: a named game entity with a stat, XP reward, and time window. Requires the AI Processor layer.

**Layer III — World Bosses (Stars).** Long-term goals with persistent HP bars, damaged by completing relevant Dailies and Incursions. Example: "Launch the app" — takes weeks to defeat, HP moves only through real-world execution.

**The AI Processor Upgrade:** BYO-Key model. Player provides their own API key, stored in localStorage only — never transmitted anywhere except directly to the chosen AI provider. **Gemini is the default** because its free tier is generous enough for all Incursion and World Boss translation needs. The onboarding flow for the key should:
- Ask for the key in System voice
- Provide a direct deep-link to the Gemini API key page (aistudio.google.com/app/apikey)
- Include brief in-character steps so the player can get a free key and return quickly
- Also support Anthropic and OpenAI keys for players who already have them

The AI translates plan text into game entities then purges the input (Ephemeral Protocol — no plan text is stored). The UI is "Elastic":
- **Solo Flow** — daily directives only
- **Combat Flow** — adds `[ TEMPORAL BREACH ]` section for active Incursions
- **War Room Flow** — adds World Boss HP bar looming above everything

**What to bring to the new chat:**
- `Strategic Context - The Neural Link Expansion.md`
- `app.js`, `index.html`, `style_additions.css`, `quests.js`, `quests.json`

---

### Track B: The Co-op Sync-Link Protocol (Stage 5b)

**Source doc:** `Strategic Context - The Co-op Sync-Link Protocol.md`

Four systems:

**1. Save-State Transmissions (cloud persistence).** Player progress serialised to JSON and stored in Firebase/Supabase under a unique 8-char "Save Frequency" code (e.g. `S-992-X1`). Recovery = enter frequency code on any device → overwrite localStorage with cloud blob. No email, no password. Local by default; syncing to cloud is a deliberate operator choice.

**2. Co-op Sync-Link.** Two players share a 5-char Sync-ID (e.g. `TR-88`). Both apps poll a shared "Session Blob" every 30–60s (atmospheric "Satellite Delay"). If both complete tasks in the same window → `[RESONANCE]` fires, doubling XP and Luck gains. Anonymous; no accounts.

**3. World Boss Raids / Temporal Rifts.** Co-op encounters mapped to real-world events. Raids = large projects (weeks). Rifts = time-bound events (1–4 hours). Can be toggled Public to appear on the World Map Bulletin.

**4. Referral gold payout (backend completion).** The client-side stub exists — do not rebuild it. Stage 5b adds the server-side half: when a Recruit completes the Awaken sequence, the system records the handshake and awards `REFERRAL_GOLD` (50, TBD) to the Recruiter via the bulletin board sync at next login.

**Telegram Comms:** Each Raid generates a Mission Topic (thread) in a central Telegram Supergroup. The `[ ESTABLISH COMMS ]` button deep-links to that Topic ID. The next chat will need to guide setup of a Telegram bot and supergroup if this is in scope for the session.

**Audio:** When tethered to an ally, ambient audio gains a secondary "heartbeat" rhythm layer.

**Database guidance needed:** Osioke has not yet set up Firebase or Supabase. The next chat should walk through which to choose and how to configure the free tier before writing any integration code.

**What to bring to the new chat:**
- `Strategic Context - The Co-op Sync-Link Protocol.md`
- `app.js`, `index.html`, `style_additions.css`, `service-worker.js`
- Supabase or Firebase project URL + anon key (the next chat will help set this up from scratch)
- Telegram Bot token and Supergroup ID (only if Telegram comms are in scope for that session)

---

## How to start the new chat

Paste this entire document and attach the relevant files. Then say which track you want to work on first. The assistant will read the relevant context doc and ask clarifying questions before writing a line of code.

---

## Files to attach to the new chat

| File | Required for |
|---|---|
| `app.js` | Both tracks — essential |
| `index.html` | Both tracks — essential |
| `css/style.css` | Both tracks — essential (full file, all additions already appended) |
| `service-worker.js` | Both tracks — essential |
| `Strategic Context - The Neural Link Expansion.md` | Track A |
| `Strategic Context - The Co-op Sync-Link Protocol.md` | Track B |
| `quests.js` | Track A (touches quest rendering) |
| `quests.json` | Track A (may need new incursion quest types) |
