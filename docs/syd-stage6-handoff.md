# HANDOFF PROMPT — SYD Product Work (Stage 6)

## What SYD is

SYD — Synchronized Yield Directive is a solo PWA that gamifies real-world habit execution as an RPG progression system. Vanilla JS, no framework, no build tools. Lives at syd-protocol.github.io/terminal. GitHub repo: syd-protocol/terminal.

**Read the README first.** It is the ground truth for what is built and what the system does.

---

## Working preferences — read these before writing any code

- Complete file outputs only. No search-and-replace instructions, no diffs, no snippets.
- Read uploaded files before writing any code. Do not assume file contents.
- One change at a time. No side effects.
- Discuss before coding on any architectural question.
- SYD's voice is clipped and authoritative — bracket headers in ALL CAPS, no em dashes, dry System voice throughout.
- Files live at: `js/app.js`, `css/style.css`, `index.html`, `service-worker.js`, `data/quests.json`

---

## Current state of the codebase

All the following are complete and shipped:

- Full RPG system: stats, XP, level, rank, momentum, HP, onboarding awaken sequence
- Gold economy and Supply Cache
- Atmospheric Web Audio API system (four layers)
- Directive Upload screen (formerly Neural Link) — AI processor, BYO key, Gemini default
- System Incursions and World Boss HP bars with three-tier stat-weighted damage:
  - Directives: primary 1.0× / linked 0.6× / unrelated 0.1×
  - Incursions: primary 1.5× / linked 0.9× / unrelated 0.15×
- Sync-Link co-op tether with Firestore
- Base Map: 3×3 facility grid, operator avatar (◈) with dot trail between nodes, command post absence glyph (◇), nav delay before screen transition, return walk animation
- Behavioral Trace: 30-day rolling log of completed directives by stat
- Log Archive with notification glow on status screen button and map tile
- OG share image and full SEO/social meta tags
- AGPL-3.0 licence, contributions open

**Terminology note:** "Neural Link" was renamed "Directive Upload" across all user-facing surfaces. Internal IDs (screen-neural, neural-link-btn etc.) were left unchanged. Settings section title remains "NEURAL LINK" intentionally — it refers to the AI engine config, not the feature.

---

## This session's work — Stage 6: Onboarding Overhaul + World Boss Personalisation

### 1. Reword world boss tooltip

The inline tooltip on "WORLD BOSS" currently reads:
> "A persistent enemy entity representing a long-term obstacle. It has an HP bar that depletes as you execute relevant directives."

Rewrite it in this voice — the System catching itself using jargon and being terse about the correction:
> "A persistent enemy entity representing a long-term obstacle — or in terms your current understanding can process: a goal. [ LINGUA MISMATCH DETECTED — SIMPLIFICATION LOGGED — TERMINATING AUXILIARY DESCRIPTION ]"

Find every surface where "World Boss" has a tooltip or explainer and apply consistently.

---

### 2. Beginner quest audit (quests.json)

Go through the full `quests.json` and identify every directive that is **day-one safe** — meaning it requires zero prior habit, zero assumed context, zero prior week's activity to complete.

Criteria for day-one safe:
- Does not reference "last week", "your log", "your routine", "previous session", or similar
- Does not assume the operator already drinks 2L water, exercises, meditates, etc.
- Could be completed by someone who has done nothing deliberately productive before
- The bar for completion is low enough that a complete beginner would not feel defeated

Output:
- List every day-one safe directive by ID and title
- Flag every stat that has fewer than 2 day-one safe directives (these need new content)
- Do not write new quests yet — bring the list for operator review first

---

### 3. Tutorial directives as onboarding flow

Replace the static onboarding screens with a sequence of tutorial directives that serve as setup. These appear before the main daily directive pool unlocks (days 1-3).

**Tutorial Directive 1 — The Goal (World Boss seed)**

Prompt: *"The System requires a primary objective to initialise threat mapping. What is the one thing you most want to accomplish — the obstacle that stands between you where you are and where you need to be?"*

- Free text input field inline in the directive card
- On submit: System creates a World Boss from this input using keyword-to-stat mapping (see point 4 below)
- Lore framing: the System names it, assigns it HP, surfaces it on the status screen
- Plain language bridge: the input prompt uses "goal" and "obstacle" — the World Boss label appears after submission with the tooltip from point 1 explaining the terminology

**Tutorial Directive 2 — The Neural Link confiscation**

Prompt: *"This System's predictive capacity is degraded. A temporary cognitive interface is required. The nearest compatible unit has been identified. Help this System confiscate it."*

- Inline API key input + provider selector (same fields as current settings Neural Link section)
- Link to Gemini free key in lore voice: *"Compatible unit detected at aistudio.google.com/app/apikey — no credentials required for acquisition."*
- On save: confirms connection in system voice, Neural Link badge updates
- Also includes a plain "this is the AI feature, it lives in Settings > Neural Link too" note below the lore text

**Tutorial Directive 3 — Operator Profile**

Prompt: *"Critical operator data was lost in transmission. Reconstruction required. Describe your current state — your routines, your constraints, your context. The System will extract what it needs."*

- Free text area, no character limit
- Saves to player object as `player.operatorProfile` (raw text)
- Syncs via Firestore with everything else
- When AI is connected: this text is injected into every AI prompt call as operator context
- When AI is not connected: stored for future use, nothing breaks

---

### 4. Keyword-to-stat mapping for World Boss goal input

Build a stat dictionary for parsing the goal text from Tutorial Directive 1. No AI required — pure keyword matching.

Structure: each stat has an array of trigger keywords. The goal text is lowercased and checked against all arrays. The stat with the most keyword matches becomes the `primaryStat`. The second highest becomes the first entry in `linkedStats`. If tied, default priority order: strength → intelligence → endurance → agility → charisma.

Seed dictionary (expand as needed):

```javascript
const STAT_KEYWORDS = {
    strength:     ['fitness', 'gym', 'health', 'weight', 'run', 'walk', 'exercise', 'body', 'eat', 'sleep', 'energy', 'strong', 'physical', 'diet', 'training', 'workout', 'sport'],
    intelligence: ['learn', 'study', 'read', 'skill', 'career', 'business', 'build', 'create', 'write', 'code', 'design', 'knowledge', 'degree', 'course', 'research', 'understand', 'develop'],
    agility:      ['adapt', 'change', 'flexible', 'anxiety', 'stress', 'fear', 'habit', 'routine', 'comfort', 'new', 'risk', 'decision', 'pivot', 'challenge', 'difficult'],
    endurance:    ['finish', 'complete', 'consistent', 'discipline', 'focus', 'distraction', 'procrastin', 'motivation', 'persist', 'follow', 'through', 'commit', 'goal', 'long', 'project', 'task'],
    charisma:     ['relationship', 'social', 'friend', 'network', 'communicate', 'speak', 'influence', 'connect', 'people', 'family', 'date', 'love', 'confident', 'presence', 'leader']
};
```

The generated World Boss gets:
- `label`: System-voiced name derived from the goal (use a lookup of dramatic entity names or a simple template: `[ WORLD BOSS: THE [NOUN] ]`)
- `stat`: primaryStat from keyword match
- `linkedStats`: second and third highest matching stats
- `maxHp` / `currentHp`: 500 (standard)
- `enemy`: a name extracted or templated from the goal text
- No AI required for this — it is a functional approximation until AI is connected

---

### 5. Guaranteed world boss directive slot

When a world boss is active, the daily directive selection must guarantee at least one directive matching the boss's `primaryStat`. 

Current directive selection logic is in `app.js` — find it, read it, then modify to:
- Check if any active world boss exists
- If yes, ensure at least one of today's selected directives matches `boss.stat`
- If the random selection already includes one, no change needed
- If not, replace the last selected directive with a random one from the matching stat pool

---

### 6. Suggested strikes on status screen

When a world boss is active and no incursions are active, surface a **"SUGGESTED STRIKES"** section on the status screen between the world boss bar and the directives.

Shows 2 directives from the boss's primary stat pool, labelled:
`[ ⚔ STRIKES: {BOSS_LABEL} ]`

These are not new directives — they are pulled from the existing daily directive pool. They just get this additional label when they match an active boss's primary stat.

When AI is connected and no incursions are active, show a prompt: *"[ NEURAL LINK AVAILABLE — GENERATE INCURSION TO STRIKE {BOSS_LABEL} DIRECTLY ]"* — tapping this opens the Directive Upload screen on the incursion tab.

---

### 7. Settings page restructure — tabs

The settings screen is getting long. Restructure into tabbed sections:

| Tab | Contents |
|---|---|
| SYSTEM | Sound, theme, profile name, reset |
| NEURAL LINK | AI provider, API key, test connection, operator profile field |
| SYNC | Sync-Link, save frequency, cloud status |
| DANGER ZONE | Wipe profile |

The operator profile field (from Tutorial Directive 3) lives permanently in the NEURAL LINK tab after onboarding.

---

### 8. Attempt tracking — deferred

Do not build this now. Noted for a future session.

---

## Files you will need

Request these from the operator at the start of the session:
- `js/app.js` (current, post-Stage-5.5)
- `css/style.css` (current)
- `index.html` (current)
- `data/quests.json` (current)

Do not assume their contents. Read before writing.

---

## Sequence recommendation

Do these in order — each depends on the previous:

1. World boss tooltip reword (small, no dependencies)
2. Beginner quest audit — list only, no new content yet
3. Keyword-to-stat dictionary (pure JS, no UI)
4. Tutorial directive flow — HTML + JS
5. Guaranteed directive slot logic
6. Suggested strikes section
7. Settings tabs restructure

---

## What good looks like when this is done

A new operator opens SYD for the first time. They awaken. They are given three tutorial directives before the main pool unlocks. The first asks for their biggest goal in plain language — when they submit it, a World Boss appears on their status screen named after that obstacle. The second walks them through connecting the AI brain in lore voice. The third asks them to describe themselves so SYD can know them.

From that point, every day they open SYD, at least one directive is guaranteed to strike their world boss. If no incursion is active, the system suggests how to strike it directly. Their stats compound. Their world boss HP decays. Their luck rises.

That is the loop. Build toward it.
