# SYD — Feature Planning & Session Handoff
*April 2026*

---

## 01. Project Context

SYD is a browser-based PWA career RPG. The player scans their CV or does a re-imaginer flow, receives a career path classification and rank, and then executes daily directives, encounters, and job ops tasks to build real skills and market presence. The app is vanilla JS, HTML, CSS — no framework. Gemini is the AI layer behind Neural Link features. Cloud sync is available as an optional feature.

### Codebase file map

| File | Responsibility |
|---|---|
| `app.js` | Main app shell, screen routing, player state |
| `path.js` | Onboarding, CV signal extraction, Gemini Call 2 (path bundle), role mapping, synthesis |
| `encounter.js` | Daily encounter logic, Gemini Call 3 (judgment evaluation), teaching encounters |
| `job-ops.js` | Job Ops segment: Profile, Market Read, Job Hunt panels |
| `status.js` | STATUS screen rendering and stat display |
| `scan.js` | Psychometric scan game logic |
| `minigames.js` | Mini-games |
| `dailyloop.js` | Daily loop logic |
| `quests.js` | Directive/quest system |
| `gemini.js` | All Gemini API call wrappers |
| `style.css` | Monolithic stylesheet — currently 10,847 lines |
| `games-enhanced.css` | Visual enhancement layer for mini-games |
| `service-worker.js` | Caching, push notifications |

---

## 02. Completed Work

The following changes were designed and confirmed in the previous session. The updated files `encounter.js`, `path.js`, and `style.css` were provided. `service-worker.js` was bumped to `syd-v77`.

### 2.1 Encounter UX Improvements

**Commit:** `fix(encounter): clarify two-step flow — step labels, anchor, and button text`

- Screen 1 header changed from `[ TRANSMISSION INCOMING ]` to `[ STEP 1 OF 2 — READ THE SITUATION ]`
- Submit button changed from `[ PICK YOUR REASONING ]` to `[ CONTINUE → ]`
- Screen 2 header changed from `[ WHAT IS DRIVING THAT RESPONSE? ]` to `[ STEP 2 OF 2 — WHY THAT CALL? ]`
- Screen 2 now shows the user's selected answer before the reasoning options — the `enc-reasoning-anchor` block with `enc-reasoning-anchor-label`, `enc-reasoning-anchor-text`, and `enc-reasoning-prompt` CSS classes
- CSS for reasoning anchor added to `style.css`

### 2.2 Role Mapping Card Redesign

**Commit:** `fix(path): remove NOW/DIRECTION split — lead with path name, add From: note`

- Round 0 cards no longer show the NOW/DIRECTION split-row layout
- Cards now lead with `path_name` as the headline (`role-card-name`)
- `current_role_match` shown as a small muted "From: X" note (`role-card-from` class)
- Pills (`target_roles`) remain at the bottom — unchanged, as these were identified as the most useful element on the card
- CSS for `role-card-from` added to `style.css`

### 2.3 Teaching Encounter Gemini Integration

**Commits:**
- `feat(encounter): call Gemini on teaching encounters when free text present`
- `feat(encounter): renderTeachingFeedback accepts optional Gemini acknowledgement`
- `style(encounter): add enc-feedback-teaching-ack for teaching ack text`

**Background:** Teaching encounters previously always bypassed Gemini entirely. The issue is that the player can enter free text even on a teaching encounter, and that was being ignored.

**What changed:**
- If free text is present AND neural link is active, `evaluateTeachingEncounter()` now fires
- `evaluateTeachingEncounter()` sends the situation, the operative's free text, and the pre-written teaching text to Gemini
- Gemini writes 1–2 sentences acknowledging the operative's thinking before the teaching reveal — not evaluating, just acknowledging
- `renderTeachingFeedback()` updated to accept optional `geminiAck` parameter
- Acknowledgement displays above the teaching text, styled as `enc-feedback-teaching-ack` — muted, italic, separated by a border

---

## 03. CLO Classification Fix — Needs Verification

This fix was designed and the exact code was provided but has not yet been confirmed applied. Verify before starting new feature work.

### 3.1 Root Cause

The seniority tier logic in `extractCVSignals()` in `path.js` was classifying any founder with 4+ years of total experience as `director` tier, regardless of whether they had evidence of managing a team. This mapped to B rank, which caused Gemini Call 2 to generate C-suite and VP-level `target_roles` (e.g. "Chief Learning Officer") calibrated to a director-level operative.

A bootstrapped founder of a small operation without a team should not be classified at the same seniority tier as a corporate director. The fix requires team evidence before escalating a founder to director tier.

### 3.2 Seniority Tier Fix

**Commit:** `fix(path): tighten founder seniority — require team evidence for director tier`

Search for:
```
    else if (hasFounder && yearsTotal >= 4)                           seniorityTier = 'director';
    else if (hasFounder && yearsTotal >= 2)                           seniorityTier = 'manager';
```

Replace with:
```
    else if (hasFounder && hasTeam && yearsTotal >= 4)                seniorityTier = 'director';
    else if (hasFounder && yearsTotal >= 4)                           seniorityTier = 'manager';
    else if (hasFounder && yearsTotal >= 2)                           seniorityTier = 'senior_ic';
```

### 3.3 Prompt Rule 12 — Block C-Suite Titles from target_roles

**Commit:** `fix(path): block C-suite titles from target_roles in Call 2 prompt (rule 12)`

Search for:
```
11. current_role_match must be a role the operative could send a CV to tomorrow and be a plausible applicant based on their actual record. If uncertain, default to the more junior version of the role. target_roles must be real job titles that appear on job boards today — reachable within 2–4 years of deliberate work. No invented, compound, or fantasy titles in target_roles.
```

Replace with:
```
11. current_role_match must be a role the operative could send a CV to tomorrow and be a plausible applicant based on their actual record. If uncertain, default to the more junior version of the role. target_roles must be real job titles that appear on job boards today — reachable within 2–4 years of deliberate work. No invented, compound, or fantasy titles in target_roles.
12. target_roles must NOT include any C-suite, executive, or VP-level titles (no CEO, COO, CTO, CLO, CPO, CMO, CXO, VP of anything, or equivalent). These are not reachable within 2–4 years for any operative below A rank. If you feel the record warrants a senior title, name the manager or specialist equivalent instead — "Learning & Development Manager" not "Chief Learning Officer", "Community Programs Manager" not "VP of Community".
```

---

## 04. CSS File Splitting — Planned

`style.css` is currently 10,847 lines. The games layer is already split into `games-enhanced.css`. The plan is to split further so each CSS file mirrors its JS module — when you touch `encounter.js` you open `encounter.css`.

### Proposed structure

| File | What goes in it |
|---|---|
| `style.css` | Design tokens (CSS variables), reset, global layout, typography, shared utility classes, buttons, keyframes. The foundation everything else depends on. |
| `encounter.css` | All `enc-*` classes — reasoning anchor, teaching ack, feedback screens, done state, domain tag, loading states. |
| `path.css` | All `path-*`, `role-card-*`, `sr-*` (synthesis reveal), `ms-*` (market signal on cards), scan bridge, rank confirmation, re-imaginer hints, orientation screen. |
| `job-ops.css` | All `jo-*` classes — Market Read, Profile, Job Hunt panels, countdown, skeleton, raw signal states. |
| `status.css` | All `sot-*` classes — STATUS main tab, identity row, stats, trait signals, career skills, path inline blocks, header drawer. |
| `games-enhanced.css` | Already exists. Stays as-is. |

### Process

1. Audit `style.css` — identify which classes are truly shared (stay in `style.css`) versus module-specific (move to their file)
2. Move classes in batches by module, one file at a time, test after each move
3. Update `service-worker.js` PRECACHE_ASSETS to include each new CSS file
4. Update `index.html` `<link>` tags in the correct load order: `style.css` first, then module files, then `games-enhanced.css` last

> `CACHE_NAME` in `service-worker.js` must be bumped on every deploy that adds or modifies CSS files. Currently at `syd-v77`.

---

## 05. Best Path Signal in Role Mapping — Planned

Currently SYD presents three paths in round 0 as equals. The data to rank them is already in the system. The fix surfaces the highest-confidence path with a clear signal so the player knows which one has the most evidence behind it.

### Ranking signals

Three signals, all computable from data already present at round 0:

1. **Evidence density** — how many specific, concrete CV items point to each path. The path where `extractCVSignals()` produced the most evidence lines for that domain scores highest.
2. **Stat alignment** — which path's required skills most closely match the player's scan trait scores from the psychometric games.
3. **Market demand** — if market signal has been fetched, which path has the highest current hiring activity.

The path scoring highest across all three gets a visual badge. The round 0 voice line changes to explicitly name it — something like: *"Three paths detected. The record is densest for [path name]. That is where the signal points — but you pick."*

### Files affected

- `path.js` — `runRoleMapping()` round 0 display, `voiceLines[0]`, `renderCards()` for round 0, and the scoring function
- `style.css` / `path.css` — badge styles for the top-ranked card

---

## 06. Exposure Stat & Market Directives — Planned

A full new feature. A parallel directive system oriented outward toward the market, building an **Exposure** stat that measures how findable and legible the player is in their confirmed path's domain.

### Core concept

Career directives build capability inward. Market directives build visibility outward. Both feed different stats. Both generate new items as old ones are completed.

The existing Job Ops sections — **Next Moves** and **Where To Be Present** — become the source pool for this system rather than static readable lists. Completing items generates new ones via Gemini, calibrated to the confirmed path and current market signal.

### The Exposure stat

- **Name:** Exposure
- **What it measures:** the player's market surface area — how findable they are in their confirmed path's domain
- **How it's built:** completing Market Directives adds Exposure points, weighted by action tier
- **Decay:** Exposure decays slowly if the player goes quiet — presence requires maintenance
- **Display:** visible on STATUS screen, parallel to career stats
- **No gating:** Exposure is informational and motivational only — nothing is locked behind it

### Market directive tiers

| Tier | Example actions |
|---|---|
| Tier 1 — Low signal | Update LinkedIn headline or bio, follow relevant accounts, join a community SYD identified |
| Tier 2 — Medium signal | Post in a relevant community, make a specific connection in the target role, comment on a piece of content in the field |
| Tier 3 — High signal | Publish a piece of content, attend or speak at an event, initiate a conversation with someone doing the role you are targeting |

### Relationship to existing Job Ops sections

- "Next Moves" becomes a live queue of completable Tier 1 and Tier 2 market directives — not a static read
- "Where To Be Present" becomes completable Tier 2 items — each community or platform is a directive to actually show up in, not just read about
- The Market Read section remains as the intelligence layer — it informs what directives appear

### Files affected

- `job-ops.js` — Next Moves and Where To Be Present rendering, completion tracking, Exposure point accumulation
- `status.js` — Exposure stat display on STATUS screen
- `app.js` — Exposure stat storage in player object
- `style.css` / `job-ops.css` — Market Directive card styles, Exposure bar, completion states
- A new data structure in localStorage: `syd_exposure` tracking points, completed actions, last active date

---

## 07. Fitness Protocol — Planned

An optional add-on that scans the player's physical baseline through indirect questioning, assigns a Fitness Rank, and generates pre-authored physical directives calibrated to that rank. Runs alongside the existing mental and career systems. No Gemini needed for the scan or directives — pure JS logic and static JSON.

### Opt-in placement

- **New users:** after the orientation screen and `createPlayer()`, before the player reaches STATUS for the first time. SYD surfaces it as a missing signal: *"One signal is missing from your profile. The system reads career and mind. It does not read body. That is an option."*
- **Returning users:** accessible in the OPS tab as a Fitness panel showing "Not activated" with an opt-in button. One place, always findable.

### The scan

6–8 questions. Indirect, specific, SYD-voiced. Concrete questions produce honest answers; self-evaluative ones produce aspirational ones.

- Activity frequency: *"How many times a week do you do something that raises your heart rate for 20+ minutes?"*
- Cardio proxy: *"Can you walk up 3 flights of stairs without stopping to catch your breath?"*
- Strength proxy: *"How many push-ups can you do before stopping?"*
- Mobility proxy: *"Do you sit for most of the day?"* + *"Do you have regular back or joint pain?"*
- Recovery indicator: *"How often do you feel physically fatigued during normal daily activities?"*
- Context filter: *"Does your typical day involve mostly sitting, mostly moving, or a mix?"* — distinguishes circumstantially sedentary from genuinely inactive
- Recency anchor: *"What physical activity did you do most recently, and when?"*

### Fitness Rank

F through A, same system as career rank. Derived by mapping the intersection of the signal responses to a tier.

### Directive structure (pre-authored, static JSON)

| Tier | Content |
|---|---|
| Tier 0 (F/E rank) | Walking cadences, bodyweight holds (wall sits, static holds), basic mobility flows, breathing exercises. No equipment. Full form descriptions. |
| Tier 1 (D/C rank) | Push-up progressions (knee, incline, standard), bodyweight squats, lunges, plank progressions. Form descriptions include what correct and incorrect look like. |
| Tier 2 (B/A rank) | Complex movement combinations, endurance benchmarks, loaded movements with bodyweight alternatives always provided. |

### Stats integration

Fitness directives map to existing stats — Endurance, Strength, Agility — rather than creating new ones. This keeps STATUS coherent: one stat, multiple input sources.

### Web Speech API

`speechSynthesis` is available in all major browsers, free, no server, no library. SYD reads directive form descriptions aloud with a single JS call. The use case is the player reading the description while in position doing the exercise. Build this in from the start.

### What needs designing before building

- The exact scan questions and their signal mapping table
- The Fitness Rank derivation logic
- The Tier 0 directive library — minimum 10–15 pre-authored directives to launch
- The form description template so every directive reads consistently
- Where Fitness Rank and fitness progress display on the STATUS screen

---

## 08. Recommended Build Sequence

Ordered by impact-to-effort ratio and dependency chain.

| Step | Task | Notes |
|---|---|---|
| 1 | CSS splitting | Split `style.css` into module files. No functional change — purely organisational. Update `service-worker.js` and `index.html`. Do in one batch. |
| 2 | Best path signal | Add evidence-density ranking to `runRoleMapping()` round 0. Surface the top path with a badge and updated voice line. Self-contained change to `path.js` and CSS. |
| 3 | Exposure stat + Market Directives | Redesign Job Ops Next Moves and Where To Be Present as completable directive queues. Add Exposure stat to player object and STATUS display. Largest of the planned features. |
| 5 | Fitness Protocol | Independent of all above. Can be specced and built in parallel once scan questions and directive library are ready. The OPS opt-in panel can be stubbed early. |

---

## 09. Handoff Prompt

Copy this verbatim into the first message of a new session. Share the files listed at the end.

---

You are continuing work on SYD, a browser-based career RPG PWA. The codebase is vanilla JS, HTML, CSS — no framework. Gemini is the AI layer. Cloud sync is available as an optional feature.

**Collaboration rules — read these before anything else:**

- When giving code changes, use search and replace format. The code to search for goes in one code block alone — nothing else in that block. The replacement goes in the next code block alone. No labels inside the code blocks. This lets me copy each block cleanly.
- Before giving any code change, read the actual uploaded file to find the exact string. Do not assume or paraphrase from memory. If you have not read the file in this session, read it first.
- Batch changes together — aim for 3–6 meaningful changes per response. Each batch gets one GitHub commit message and one continuation block summarising what was done, what is left, and key context for the next batch.
- Continuation block format: `[ DONE ]` list, `[ REMAINING ]` list, `[ KEY CONTEXT ]` for anything the next batch needs to know.
- I will share my collaboration document at the start of the session — read it before starting work.

**Current state:**

- Encounter UX improvements: DONE
- Role mapping card redesign: DONE
- Teaching encounter Gemini integration: DONE
- CLO seniority fix: DESIGNED, needs verification — see Section 03 of the planning document for exact search/replace strings
- CSS splitting: PLANNED — see Section 04
- Best path signal: PLANNED — see Section 05
- Exposure stat + Market Directives: PLANNED — see Section 06
- Fitness Protocol: PLANNED — see Section 07

**First task for this session:**

Start with the CSS splitting, that may be the most tasking. I removed the CLO fix check as a task as that has been implemented, you can check the code, but that is not as important as the others.

**Files to share in the new session:**

- `path.js` — for CLO fix verification and best path signal work
- `job-ops.js` — for Exposure stat and Market Directives work
- `status.js` — for Exposure stat display
- `app.js` — for player object changes
- `style.css` — for CSS splitting and new feature styles
- `index.html` — for CSS link tag updates
- `service-worker.js` — for PRECACHE_ASSETS updates
- `games-enhanced.css` — reference only
- This planning document — for context

---

## 10. Quick Reference — Key Decisions

| Decision | Detail |
|---|---|
| Feature name: Fitness (but make suggestion's using SYD's voice/lore) | Not "Body Protocol" — rejected as sounding off |
| Stat name: Exposure or Job Luck still not sure | "Market Presence" were considered |
| No gating on Exposure | Informational and motivational only |
| Fitness → existing stats | Directives map to Endurance, Strength, Agility rather than new stats |
| Market directives are directives | Next Moves and Where To Be Present become completable queues, not static reads |
| Best path signal = evidence density primary | Evidence density is the primary ranking signal; market demand and stat alignment are secondary |
| Search/replace format | Code to search in one block. Replacement in the next. Nothing else in the blocks. |
| Batch size | 3–6 changes per batch. Each batch has a commit message and a continuation block. |
| service-worker CACHE_NAME | Currently `syd-v77`. Bump on every deploy that changes JS or CSS files. |
