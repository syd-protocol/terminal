// ═══════════════════════════════════════════════════════════════
// SYD GES — path.js
// PATH Protocol — both tracks feed into the same shared flow.
//
// Track A — The Chronicler:
//   CV paste → Call 2 fires → PATH loading screen absorbs wait →
//   role mapping → rank confirmation → aspiration probe → synthesis reveal
//
// Track B — The Re-imaginer:
//   4 questions → Call 2 fires on TRANSMIT → PATH loading screen →
//   role mapping → rank confirmation → aspiration probe → synthesis reveal
//
// BLOCK C changes (supersedes Batch 6 Gemini calls):
//   Old model: 3 separate Gemini calls (analyseCV, buildGapAnalysis,
//              detectHiddenAffinity) fired at different points.
//   New model: 1 bundled Call 2 fires when operative taps ANALYSE
//              (Chronicler) or TRANSMIT on final Re-imaginer question.
//              PATH loading screen absorbs the wait.
//              One JSON response parsed once and distributed to:
//                - Three path cards for role mapping (paths[])
//                - Gap analysis (gap_analysis_prose, gap skills)
//                - Hidden affinity (hidden_affinity_stat, hidden_affinity_read)
//                - Career skill tracks (career_skill_tracks[]) → syd_career_skills
//                - Stat explainers (stat_explainers{}) → syd_stat_explainer_cache
//                - Synthesis SYD lines (synthesis_syd_lines[])
//                - Orientation closing line (orientation_closing_line)
//                - Initial career directives (initial_career_directives[]) → syd_career_directives
//                - Initial career encounters (initial_career_encounters[]) → syd_career_encounters
//
//   getPersonalisedStatExplainer() updated: checks cache first (seeded
//   by Call 2), falls back to individual Gemini call only if cache miss.
//
//   Local fallback: getLocalFallbackBundle() returns the same shape as
//   Call 2. Every field has a genuinely good local version. The experience
//   runs fully without AI.
//
//   Storage keys added:
//     syd_call2_bundle    — full parsed Call 2 response (for synthesis screen)
//     syd_career_encounters — initial career encounters from Call 2
// ═══════════════════════════════════════════════════════════════

// ─── PATH STATE ──────────────────────────────────────────────
let pathState = {
    track:              null,     // 'chronicler' | 'reimaginer'
    cvText:             null,
    reimagineResponses: [],
    inference:          null,     // { paths: [...], offlineMode: bool }
    confirmedPath:      null,
    confirmedRole:      null,
    confirmedSpec:      null,
    confirmedRank:      null,     // operative's self-confirmed starting rank
    aspirationGoal:     null,     // { careerGoal, lifeGoal, domain, targetRole }
    gapAnalysis:        null,     // { primaryGap, skills, geminiEnhanced: bool }
    hiddenAffinity:     null,     // { stat, read, geminiEnhanced: bool }
    statSeeds:          null,
    call2Bundle:        null,     // BLOCK C: full parsed Call 2 response
    onComplete:         null
};

// [TUNING TARGET] Maximum stat bonus PATH data can seed above scan baseline
const PATH_SEED_MAX_PER_STAT = 8;

// ─── STORAGE KEYS ────────────────────────────────────────────
const PATH_DATA_KEY            = 'syd_path_data';
const CALL2_BUNDLE_KEY         = 'syd_call2_bundle';
const CAREER_ENCOUNTERS_KEY    = 'syd_career_encounters';
const STAT_EXPLAINER_CACHE_KEY = 'syd_stat_explainer_cache';

// ─── PATH ENTRY POINT ────────────────────────────────────────
// Called from app.js startPATH() after scan completes.
function runPATH(scanTraits, onComplete) {
    pathState = {
        track: null, cvText: null, reimagineResponses: [],
        inference: null, confirmedPath: null, confirmedRole: null,
        confirmedSpec: null, confirmedRank: null, aspirationGoal: null,
        gapAnalysis: null, hiddenAffinity: null, statSeeds: null,
        call2Bundle: null, onComplete
    };
    pathState._scanTraits = scanTraits || {};
    showScreen('screen-path');
    renderPathSelect();
}

// ─── TRACK SELECTION ─────────────────────────────────────────
function renderPathSelect() {
    const container = document.getElementById('path-content');
    if (!container) return;

    container.innerHTML = `
        <div class="path-select">
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">Good. Now I need your history.</p>
                <p class="path-voice-line path-voice-line--visible">
                    Has your career already started, or are you still finding the signal?
                </p>
            </div>
            <div class="path-track-choices">
                <button class="path-track-btn" id="btn-chronicler">
                    <span class="path-track-tag">TRACK A — THE CHRONICLER</span>
                    <span class="path-track-label">I have work experience</span>
                    <span class="path-track-sub">
                        Paste your career record. SYD maps what the surface never told you.
                    </span>
                </button>
                <button class="path-track-btn" id="btn-reimaginer">
                    <span class="path-track-tag">TRACK B — THE RE-IMAGINER</span>
                    <span class="path-track-label">I am just starting out</span>
                    <span class="path-track-sub">
                        No record required. SYD reads what you have already built without knowing it.
                    </span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-chronicler').addEventListener('click', () => {
        playUIClick(); pathState.track = 'chronicler'; runChronicler();
    });
    document.getElementById('btn-reimaginer').addEventListener('click', () => {
        playUIClick(); pathState.track = 'reimaginer'; runReImaginer();
    });
}

// ─── TRACK A: THE CHRONICLER ──────────────────────────────────
// BLOCK C: Call 2 fires when operative taps ANALYSE.
// PATH loading screen is shown immediately — Call 2 resolves behind it.
function runChronicler() {
    showScreen('screen-path-chronicler');
    const container = document.getElementById('chronicler-content');
    if (!container) return;

    container.innerHTML = `
        <div class="chronicler-wrap">
            <button class="path-back-btn" id="chronicler-back">← BACK</button>
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    Paste your full CV. Not a shortened version.
                </p>
                <p class="path-voice-line path-voice-line--visible">
                    I read what you actually did — not what your title suggested you did.
                </p>
            </div>
            <div class="path-input-group">
                <label class="path-input-label">CAREER RECORD</label>
                <textarea
                    id="cv-input"
                    class="path-textarea"
                    placeholder="Paste the full text of your CV here..."
                    spellcheck="false"
                ></textarea>
            </div>
            <button class="btn btn--primary" id="cv-submit-btn">[ ANALYSE ]</button>
            <p class="path-privacy-note">
                [ Processed on-device. Nothing leaves until you opt in to cloud sync. ]
            </p>
        </div>
    `;

    document.getElementById('chronicler-back').addEventListener('click', () => {
        playUIClick(); renderPathSelect(); showScreen('screen-path');
    });

    document.getElementById('cv-submit-btn').addEventListener('click', () => {
        playUIClick();
        const cvText = document.getElementById('cv-input').value.trim();
        if (!cvText) { document.getElementById('cv-input').focus(); return; }
        pathState.cvText = cvText;
        // BLOCK C: Show loading screen immediately, fire Call 2 behind it
        showScreen('screen-path-loading');
        renderPathLoading('ANALYSING YOUR SIGNAL — STANDING BY');
        fireCall2Bundle().then(bundle => {
            applyCall2Bundle(bundle);
            runRoleMapping(0);
        });
    });
}

// ─── TRACK B: THE RE-IMAGINER ─────────────────────────────────
const REIMAGINER_QUESTIONS = [
    {
        q:    'What have you figured out on your own that most people around you have not?',
        hint: 'A skill, a way of thinking, a system you built. Anything you know that did not come from a classroom.'
    },
    {
        q:    'When people come to you for help — not officially, just because they trust you — what is it usually for?',
        hint: 'Could be anyone. The subject does not matter — what matters is why they come to you specifically.'
    },
    {
        q:    'What do you do when you have completely free time and no obligation?',
        hint: 'Not what you think you should do. What you actually do.'
    },
    {
        q:    'What could you teach someone right now, with no preparation needed?',
        hint: 'Not what you are trained in. What you genuinely know.'
    }
];

function runReImaginer() {
    pathState.reimagineResponses = [];
    showScreen('screen-path-reimaginer');
    renderReImaginerQuestion(0);
}

function renderReImaginerQuestion(idx) {
    const container = document.getElementById('reimaginer-content');
    if (!container) return;

    const total  = REIMAGINER_QUESTIONS.length;
    const pct    = Math.round((idx / total) * 100);
    const isLast = idx === total - 1;
    const qData  = REIMAGINER_QUESTIONS[idx];

    container.innerHTML = `
        <div class="reimaginer-wrap">
            ${idx === 0 ? '<button class="path-back-btn" id="reimaginer-back">← BACK</button>' : ''}
            <div class="path-progress-bar">
                <div class="path-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="path-progress-label">QUESTION ${idx + 1} OF ${total}</p>
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible reimaginer-q">${qData.q}</p>
                <p class="path-voice-line path-voice-line--visible reimaginer-hint">${qData.hint}</p>
            </div>
            <div class="path-input-group">
                <textarea
                    id="reimaginer-input"
                    class="path-textarea"
                    placeholder="Take your time..."
                    spellcheck="false"
                ></textarea>
            </div>
            <div class="path-action-row">
                <button class="path-skip-btn" id="reimaginer-skip">SKIP</button>
                <button class="btn btn--primary" id="reimaginer-next">
                    ${isLast ? '[ TRANSMIT ]' : '[ NEXT ]'}
                </button>
            </div>
        </div>
    `;

    if (idx === 0) {
        document.getElementById('reimaginer-back').addEventListener('click', () => {
            playUIClick(); renderPathSelect(); showScreen('screen-path');
        });
    }

    const textarea = document.getElementById('reimaginer-input');
    if (textarea) setTimeout(() => textarea.focus(), 200);

    document.getElementById('reimaginer-skip').addEventListener('click', () => {
        playUIClick();
        pathState.reimagineResponses.push('');
        advanceReImaginer(idx, total);
    });

    document.getElementById('reimaginer-next').addEventListener('click', () => {
        playUIClick();
        const val = document.getElementById('reimaginer-input').value.trim();
        pathState.reimagineResponses.push(val);
        advanceReImaginer(idx, total);
    });
}

function advanceReImaginer(currentIdx, total) {
    if (currentIdx + 1 >= total) {
        // BLOCK C: Final question — fire Call 2 now. Show loading screen immediately.
        showScreen('screen-path-loading');
        renderPathLoading('ANALYSING YOUR SIGNAL — STANDING BY');
        fireCall2Bundle().then(bundle => {
            applyCall2Bundle(bundle);
            runRoleMapping(0);
        });
    } else {
        renderReImaginerQuestion(currentIdx + 1);
    }
}

// ═══════════════════════════════════════════════════════════════
// BLOCK C: CALL 2 — PATH + CAREER INTELLIGENCE BUNDLE
//
// Single call. One parse. Distributes to all downstream systems.
// Fires immediately on ANALYSE (Chronicler) or TRANSMIT (Re-imaginer).
// PATH loading screen absorbs the wait. No perceived delay.
//
// Output JSON shape (see respec for full spec):
// {
//   paths[], hidden_affinity_stat, hidden_affinity_read,
//   gap_analysis_prose, career_skill_tracks[], synthesis_syd_lines[],
//   orientation_closing_line, stat_explainers{}, initial_career_directives[],
//   initial_career_encounters[]
// }
//
// [RESEARCH] Source: SYD Respec v2 — Call 2 spec.
// Finding: bundling all synthesis data in one call prevents multiple
//          round-trips and allows the loading screen to absorb all AI latency.
// Applied: single large call, full JSON parsed once, all fields distributed.
// ═══════════════════════════════════════════════════════════════

// ─── CV SIGNAL STRIPPER ───────────────────────────────────────
// Reduces a full CV to signal-rich lines only before sending to Gemini.
// Removes: bio paragraph, key skills headers, pure responsibility bullets.
// Keeps: role/company/date lines, bullets with numbers or outcomes,
//        talks, frameworks, personal projects.
// Goal: force Gemini to read evidence, not self-description.
function stripCVToSignal(cvText) {
    if (!cvText || cvText.length < 200) return cvText;

    const lines = cvText.split('\n');
    const kept  = [];
    let skipMode = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { kept.push(''); continue; }

        // Skip the bio paragraph and KEY SKILLS section entirely
        if (/^#{1,3}\s*(BIO|KEY SKILLS)/i.test(trimmed)) { skipMode = true; continue; }
        // Resume capturing at WORK EXPERIENCE or any new major section
        if (/^#{1,3}\s*(WORK|EDUCATION|TALKS|PERSONAL|HOBBIES)/i.test(trimmed)) { skipMode = false; }
        if (skipMode) continue;

        // Always keep headings (role/company lines)
        if (/^#{1,6}\s/.test(trimmed)) { kept.push(trimmed); continue; }

        // Keep date lines
        if (/\d{4}/.test(trimmed) && trimmed.length < 80) { kept.push(trimmed); continue; }

        // Keep bullets — but only those with evidence (numbers, outcomes, named things)
        if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
            const hasEvidence = /\d|%|\$|USD|partnership|launched|built|grew|secured|led|designed|closed|reduced|increased|founded|created|managed|negotiated/i.test(trimmed);
            if (hasEvidence) kept.push(trimmed);
            continue;
        }

        // Keep everything in TALKS, PERSONAL PROJECTS (all signal)
        kept.push(trimmed);
    }

    const stripped = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    // Safety: if stripping removed too much, return original
    return stripped.length > 300 ? stripped : cvText;
}

async function fireCall2Bundle() {
    if (!hasNeuralLink()) {
        return getLocalFallbackBundle();
    }

    const rawInput     = pathState.cvText || pathState.reimagineResponses.join('\n\n');
    const inputText    = pathState.track === 'chronicler'
        ? stripCVToSignal(rawInput)
        : rawInput;
    const isCV         = pathState.track === 'chronicler';
    const traits       = pathState._scanTraits || {};
    const traitSummary = Object.entries(traits).map(([k, v]) => `${k}: ${v}`).join(', ') || 'not available';

    // [RESEARCH] Source: SYD Respec v2 — Call 2 prompt spec.
    // Finding: one large prompt with explicit JSON schema prevents Gemini
    //          from producing partial responses across multiple calls.
    // Applied: full schema inline, all fields required, STRICT JSON only.
    const prompt = `
You are SYD — an elite career intelligence system. Your job is NOT to summarise what the operative already knows about themselves. Your job is to read beneath the surface and identify the patterns they cannot see from inside their own record.

OPERATIVE SCAN TRAITS (psychometric game scores, 0.0–1.0):
${traitSummary}

ANALYSIS RULES — follow these strictly:
1. The three paths must be DISTINCT in type, not variations of the same theme. If two paths feel similar, you have not dug deep enough.
2. path_name must be a role archetype the operative has NOT explicitly stated on their CV — infer from the pattern of what they actually built, not what they called themselves.
3. narrative must cite SPECIFIC evidence (a named project, a number, a dated event) and connect it to a non-obvious pattern. Never restate the operative's own job title or bio language.
4. gap_skills must be things genuinely absent from the record — not polish on existing skills.
5. hidden_affinity_stat must reflect the scan traits AND the record pattern — not just the highest stat.
6. gap_analysis_prose must be honest and specific. Name the actual gap. Do not soften it.
7. synthesis_syd_lines must sound like intelligence analysis, not LinkedIn endorsements.
8. career_skill_tracks must be named after what the operative actually does, not generic skill categories.
9. initial_career_directives must be REAL actions with REAL professional consequences — not study tasks or research exercises.

Your output will seed multiple downstream systems. Every field is required. Do not omit any.

Output ONLY valid JSON. No markdown fences. No preamble. No explanation outside the JSON.

Required JSON shape:
{
  "paths": [
    {
      "path_name": "Strategic name for this career path",
      "narrative": "2–3 sentences referencing specific evidence from their record. Be specific.",
      "target_roles": ["Role 1", "Role 2", "Role 3"],
      "mapped_skills": ["Skill 1", "Skill 2", "Skill 3"],
      "stat_seeds": { "intelligence": 6, "agility": 4 },
      "gap_skills": ["Gap skill 1", "Gap skill 2", "Gap skill 3"]
    },
    { "path_name": "...", "narrative": "...", "target_roles": [], "mapped_skills": [], "stat_seeds": {}, "gap_skills": [] },
    { "path_name": "...", "narrative": "...", "target_roles": [], "mapped_skills": [], "stat_seeds": {}, "gap_skills": [] }
  ],
  "hidden_affinity_stat": "intelligence",
  "hidden_affinity_read": "2–3 sentences. Stored now, revealed at Level 20. Specific to this person.",
  "gap_analysis_prose": "2–3 sentences in SYD voice. Rank-aware. Honest about the distance.",
  "career_skill_tracks": [
    {
      "name": "Skill name specific to this operative and path",
      "stat": "intelligence",
      "description": "What this skill is and why it matters for this path."
    }
  ],
  "synthesis_syd_lines": [
    "Line 1 — specific to this operative. References something from their record.",
    "Line 2 — forward-looking. What this path means for them.",
    "Line 3 — honest about the distance and what is required."
  ],
  "orientation_closing_line": "One personalised line ending the orientation screen.",
  "stat_explainers": {
    "strength": "Personalised 2–3 sentence read for this operative's STR in context of their path.",
    "intelligence": "...",
    "agility": "...",
    "endurance": "...",
    "charisma": "..."
  },
  "initial_career_directives": [
    {
      "id": "cd_001",
      "title": "Directive title — active verb, specific outcome",
      "desc": "What the operative actually does. Real action, real professional consequence.",
      "intel": "Mental model name — one sentence on what it is. One sentence on why it matters for this path at this rank.",
      "stat": "intelligence",
      "career_skill": "Matching name from career_skill_tracks",
      "xp": 12,
      "tier": 1
    }
  ],
  "initial_career_encounters": [
    {
      "id": "ce_001",
      "type": "A",
      "situation": "Encounter situation — specific, domain-grounded, realistic",
      "options": [
        { "id": "o1", "text": "Option text" },
        { "id": "o2", "text": "Option text" }
      ],
      "reasonings": [
        { "id": "r1", "text": "Reasoning text" },
        { "id": "r2", "text": "Reasoning text" }
      ],
      "domain": "Path name",
      "tier": 1
    }
  ]
}

Rules for career directives:
- Generate 7–10 directives
- Each must be a real-world action with real professional consequences — NOT "read about X" or "study Y"
- Outcome-oriented. What the operative does AND what it changes.
- The intel field explains the professional leverage — why this specific action matters at their current rank.

Rules for career encounters:
- Generate 2–3 encounters
- Domain-grounded to the confirmed path
- Realistic professional judgment calls

${isCV ? 'CV TO ANALYSE' : 'SELF-ASSESSMENT RESPONSES'}:
${inputText}
`.trim();

    const result = await geminiGenerateLarge(prompt);

    if (!result.ok) {
        console.warn('[SYD] Call 2 failed — using local fallback bundle.');
        return getLocalFallbackBundle();
    }

    const parsed = extractJSON(result.text);
    if (!parsed || !Array.isArray(parsed.paths) || parsed.paths.length < 2) {
        console.warn('[SYD] Call 2 JSON parse failed — using local fallback bundle.');
        return getLocalFallbackBundle();
    }

    // Store hidden affinity stat so synthesis can reference it
    pathState._geminiHiddenAffinityStat = parsed.hidden_affinity_stat || null;

    return { ...parsed, geminiEnhanced: true };
}

// ─── APPLY CALL 2 BUNDLE ─────────────────────────────────────
// Parses the full Call 2 response (or local fallback) and distributes
// all fields to their respective storage and pathState locations.
// Called once immediately after fireCall2Bundle() resolves.
function applyCall2Bundle(bundle) {
    if (!bundle) bundle = getLocalFallbackBundle();

    pathState.call2Bundle = bundle;
    pathState.inference   = {
        paths:       bundle.paths || [],
        offlineMode: !bundle.geminiEnhanced
    };

    // ── Store full bundle for synthesis screen ────────────────
    try { localStorage.setItem(CALL2_BUNDLE_KEY, JSON.stringify(bundle)); }
    catch(e) { /* non-critical */ }

    // ── Seed career skill tracks ──────────────────────────────
    // Only seed if Call 2 returned career_skill_tracks AND Block B
    // has not already built tracks from local data.
    // Call 2 tracks are richer (Gemini-named, Gemini-described).
    if (bundle.career_skill_tracks && bundle.career_skill_tracks.length > 0
        && typeof loadCareerSkills === 'function') {

        const rank    = typeof rankFromLevel === 'function'
            // Guard: calculateLevel() requires player to be non-null.
            // During onboarding, player does not exist yet — use level 1 (F-rank).
            ? rankFromLevel(typeof calculateLevel === 'function' && typeof player !== 'undefined' && player
                ? calculateLevel()
                : 1)
            : 'F';
        const softCap = typeof getCareerSkillSoftCap === 'function'
            ? getCareerSkillSoftCap(rank)
            : 40;
        const pathName = (bundle.paths && bundle.paths[0]) ? bundle.paths[0].path_name : '';

        const geminiTracks = bundle.career_skill_tracks.slice(0, 5).map((t, i) => ({
            id:             'cs_' + String(i + 1).padStart(3, '0'),
            name:           t.name || ('Career Skill ' + (i + 1)),
            stat:           t.stat || 'intelligence',
            score:          0,
            softCap,
            pathName,
            description:    t.description || '',
            geminiEnhanced: true
        }));

        // Merge with any existing tracks (preserve scores if tracks already existed)
        const existing = loadCareerSkills();
        const merged   = geminiTracks.map(gt => {
            const prior = existing.find(e => e.name === gt.name);
            return prior ? { ...gt, score: prior.score, softCap: prior.softCap } : gt;
        });

        if (typeof saveCareerSkills === 'function') saveCareerSkills(merged);
    }

    // ── Cache stat explainers ─────────────────────────────────
    if (bundle.stat_explainers && typeof bundle.stat_explainers === 'object') {
        try {
            localStorage.setItem(STAT_EXPLAINER_CACHE_KEY, JSON.stringify(bundle.stat_explainers));
        } catch(e) { /* non-critical */ }
    }

    // ── Cache initial career directives ──────────────────────
    if (bundle.initial_career_directives && bundle.initial_career_directives.length > 0) {
        try {
            // Tag each as a career directive for quests.js
            const tagged = bundle.initial_career_directives.map(d => ({
                ...d, _isCareerDirective: true
            }));
            localStorage.setItem('syd_career_directives', JSON.stringify(tagged));
        } catch(e) { /* non-critical */ }
    }

    // ── Cache initial career encounters ──────────────────────
    if (bundle.initial_career_encounters && bundle.initial_career_encounters.length > 0) {
        try {
            localStorage.setItem(CAREER_ENCOUNTERS_KEY, JSON.stringify(bundle.initial_career_encounters));
        } catch(e) { /* non-critical */ }
    }

    // ── Store synthesis lines and orientation line for screens ─
    // These are read by app.js renderSynthesisReveal() and renderOrientationScreen()
    if (bundle.synthesis_syd_lines) {
        try { localStorage.setItem('syd_synthesis_lines', JSON.stringify(bundle.synthesis_syd_lines)); }
        catch(e) {}
    }
    if (bundle.orientation_closing_line) {
        try { localStorage.setItem('syd_orientation_closing', bundle.orientation_closing_line); }
        catch(e) {}
    }

    // ── Store hidden affinity for synthesis ──────────────────
    if (bundle.hidden_affinity_stat) {
        pathState._geminiHiddenAffinityStat = bundle.hidden_affinity_stat;
    }
}

// ─── LOCAL FALLBACK BUNDLE ───────────────────────────────────
// Returns the same shape as Call 2 with genuinely good local content.
// Used when Neural Link is not connected, or Call 2 fails.
// Every field is populated — no empty arrays, no null values.
// The experience runs fully without AI.
function getLocalFallbackBundle() {
    const inputText = pathState.cvText || pathState.reimagineResponses.join(' ');
    const result    = (typeof classifyGoal === 'function')
        ? classifyGoal(inputText)
        : { primaryStat: 'intelligence', linkedStats: ['agility', 'endurance'] };

    const statToPath = {
        strength:     {
            path_name:    'Execution and Delivery',
            narrative:    'Your pattern shows strong delivery focus and a consistent bias toward getting things done rather than theorising about them.',
            target_roles: ['Operations Manager', 'Project Lead', 'Programme Director'],
            mapped_skills: ['Delivery', 'Operational Coordination', 'Physical Execution'],
            stat_seeds:   { strength: 6, endurance: 4 },
            gap_skills:   ['Strategic influence', 'Stakeholder communication', 'Systems thinking']
        },
        intelligence: {
            path_name:    'Strategy and Knowledge',
            narrative:    'Your pattern shows strong analytical focus and a drive to understand the underlying system before acting on it.',
            target_roles: ['Strategy Lead', 'Product Manager', 'Research Lead'],
            mapped_skills: ['Analysis', 'Systems Thinking', 'Knowledge Architecture'],
            stat_seeds:   { intelligence: 6, agility: 4 },
            gap_skills:   ['Executive presence', 'Stakeholder influence', 'Commercial acumen']
        },
        agility:      {
            path_name:    'Adaptation and Innovation',
            narrative:    'Your pattern shows strong pivot capacity and a comfort with ambiguity that most people avoid.',
            target_roles: ['Innovation Lead', 'Consultant', 'Product Designer'],
            mapped_skills: ['Adaptability', 'Problem Framing', 'Creative Pivots'],
            stat_seeds:   { agility: 6, intelligence: 4 },
            gap_skills:   ['Sustained execution', 'Process discipline', 'Long-horizon planning']
        },
        endurance:    {
            path_name:    'Consistency and Systems',
            narrative:    'Your pattern shows sustained effort and a systems-building orientation over long time horizons.',
            target_roles: ['Systems Architect', 'Programme Manager', 'Operations Lead'],
            mapped_skills: ['Sustained Effort', 'Process Design', 'Long-term Discipline'],
            stat_seeds:   { endurance: 6, strength: 4 },
            gap_skills:   ['Creative flexibility', 'Stakeholder influence', 'Rapid pivoting']
        },
        charisma:     {
            path_name:    'Influence and Community',
            narrative:    'Your pattern shows strong social reading and a demonstrated capacity to move people and build trust.',
            target_roles: ['Community Lead', 'Business Development', 'Head of Growth'],
            mapped_skills: ['Relationship Building', 'Influence', 'Communication'],
            stat_seeds:   { charisma: 8 },
            gap_skills:   ['Analytical depth', 'Process discipline', 'Technical credibility']
        }
    };

    const primary = statToPath[result.primaryStat]    || statToPath.intelligence;
    const linked1 = statToPath[result.linkedStats[0]] || statToPath.agility;
    const linked2 = statToPath[result.linkedStats[1]] || statToPath.endurance;
    const paths   = [primary, linked1, linked2];

    const gapSkills = primary.gap_skills || [];

    // Local career skill tracks — derived from gap skills
    const careerTracks = gapSkills.slice(0, 3).map((skill, i) => ({
        name:        skill,
        stat:        guessStatFromSkillNameLocal(skill),
        description: `${skill} is a key professional capability for the ${primary.path_name} path. Closing this gap early creates compounding returns.`
    }));

    // Local synthesis lines
    const synthLines = [
        `Classification complete. You are confirmed on the ${primary.path_name} path.`,
        `Your record points to ${(primary.target_roles || [])[0] || 'this direction'}. That is where the signal is strongest.`,
        `Three gaps have been identified: ${gapSkills.slice(0, 3).join(', ')}. The directives will target these first.`
    ];

    // Local stat explainers — brief and rank-neutral (Gemini upgrades these)
    const statExplainers = {
        strength:     `STRENGTH maps to your execution and delivery capacity. It rises as you complete what you start, under pressure and without motivation as a prerequisite.`,
        intelligence: `INTELLIGENCE maps to how sharply you read systems and make calls with incomplete information. It rises through deliberate analysis, not just exposure.`,
        agility:      `AGILITY maps to how quickly you adapt when the situation changes under you. It rises through exposure to novelty and practice at switching frames.`,
        endurance:    `ENDURANCE maps to how long you sustain effort before your output degrades. It rises through consistent action over time — not intensity.`,
        charisma:     `CHARISMA maps to how accurately you read and move people. It rises through deliberate practice at the gap between what is said and what is meant.`
    };

    // Local career directives — 3 generic outcome-oriented directives
    const localDirs = gapSkills.slice(0, 3).map((skill, i) => ({
        id:           'cd_local_' + String(i + 1).padStart(3, '0'),
        title:        `Apply ${skill} in a real context this week`,
        desc:         `Identify one situation in your current work where ${skill.toLowerCase()} is the constraint. Address it directly — not in theory. Make a visible, documented change.`,
        intel:        `${skill} — the gap between knowing and applying. At your rank, closing this gap requires action under real conditions, not preparation.`,
        stat:         guessStatFromSkillNameLocal(skill),
        career_skill: skill,
        xp:           10,
        tier:         1,
        _isCareerDirective: true
    }));

    // Local career encounter — one generic professional judgment scenario
    const localEnc = [{
        id:        'ce_local_001',
        type:      'A',
        situation: `You are in a meeting where a senior colleague proposes a direction that you know from experience is likely to fail. They are well-respected. The room is deferring to them.`,
        options: [
            { id: 'o1', text: 'Say nothing — raise it privately with them afterwards.' },
            { id: 'o2', text: 'Disagree directly in the room with your reasoning.' },
            { id: 'o3', text: 'Ask a clarifying question that surfaces the issue without confronting.' }
        ],
        reasonings: [
            { id: 'r1', text: 'Avoiding conflict preserves relationships but lets a bad decision go unchallenged.' },
            { id: 'r2', text: 'Direct disagreement is honest but risks the relationship if done without care.' },
            { id: 'r3', text: 'A good question moves the conversation without making it about you.' }
        ],
        domain: primary.path_name,
        tier:   1
    }];

    return {
        paths,
        hidden_affinity_stat:     result.primaryStat,
        hidden_affinity_read:     `Your underlying signal is ${result.primaryStat.toUpperCase()} — this runs through your record whether you named it or not. The directives here build from that foundation.`,
        gap_analysis_prose:       `You are early. The gap between where you are and expert practice on the ${primary.path_name} path is large — and entirely closeable. The directives are calibrated to that distance.`,
        career_skill_tracks:      careerTracks,
        synthesis_syd_lines:      synthLines,
        orientation_closing_line: `Show up tomorrow. That is the whole thing.`,
        stat_explainers:          statExplainers,
        initial_career_directives: localDirs,
        initial_career_encounters: localEnc,
        geminiEnhanced:           false
    };
}

// Local stat-from-skill-name mapping (mirrors app.js guessStatFromSkillName)
function guessStatFromSkillNameLocal(skillName) {
    const lower = (skillName || '').toLowerCase();
    if (/communicat|stakeholder|influence|relationship|network|present|lead|trust|persuad|negotiat|social|people/.test(lower)) return 'charisma';
    if (/strateg|analys|research|data|system|architect|think|model|knowledge|learn|problem/.test(lower)) return 'intelligence';
    if (/adapt|pivot|change|flexible|agile|creative|innovate|experiment|risk/.test(lower)) return 'agility';
    if (/deliver|execut|operati|manage|project|timeline|output|consistent|follow/.test(lower)) return 'endurance';
    if (/physical|health|energy|strength|resilience|endure|sustain|pressure/.test(lower)) return 'strength';
    return 'intelligence';
}

// ─── SHARED FLOW: ROLE MAPPING (3 ROUNDS) ────────────────────
// Unchanged from Batch 6. Uses pathState.inference.paths seeded by
// applyCall2Bundle() above.
function runRoleMapping(round) {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) return;

    const paths  = (pathState.inference && pathState.inference.paths) || [];
    const isLast = round === 2;
    const pct    = Math.round(((round + 1) / 3) * 100);

    const voiceLines = [
        'Three paths emerged from your signal. Which feels closest to your real direction?',
        'Confirmed. Which of these roles do you actually see yourself in?',
        'One more. Pick the specialisation that fits.'
    ];

    let cardData = paths;
    if (round === 1 && pathState.confirmedPath) {
        const roles = pathState.confirmedPath.target_roles || [];
        cardData = roles.map(r => ({ path_name: r, narrative: '', target_roles: [], mapped_skills: [] }));
        if (paths[1]) cardData.push({ path_name: (paths[1].target_roles || [])[0] || paths[1].path_name, narrative: '', target_roles: [], mapped_skills: [] });
        if (paths[2]) cardData.push({ path_name: (paths[2].target_roles || [])[0] || paths[2].path_name, narrative: '', target_roles: [], mapped_skills: [] });
    }
    if (round === 2 && pathState.confirmedPath) {
        const skills = pathState.confirmedPath.mapped_skills || [];
        cardData = skills.map(s => ({ path_name: s, narrative: '', target_roles: [], mapped_skills: [] }));
    }

    container.innerHTML = `
        <div class="role-mapping-wrap">
            <div class="path-progress-bar">
                <div class="path-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="path-progress-label">ROLE MAPPING — ROUND ${round + 1} OF 3</p>
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">${voiceLines[round]}</p>
            </div>
            <div class="role-card-stack">
                ${cardData.map((p, i) => `
                    <button class="role-card" data-path-index="${i}">
                        <span class="role-card-name">${p.path_name || 'PATH ' + (i + 1)}</span>
                        ${p.narrative ? '<p class="role-card-narrative">' + p.narrative + '</p>' : ''}
                        ${(p.target_roles || []).length > 0 ? `
                            <div class="role-card-roles">
                                ${p.target_roles.map(r => '<span class="role-tag">' + r + '</span>').join('')}
                            </div>
                        ` : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.querySelectorAll('.role-card').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            const picked = cardData[parseInt(btn.dataset.pathIndex, 10)];

            if (round === 0) pathState.confirmedPath = paths[parseInt(btn.dataset.pathIndex, 10)];
            if (round === 1) pathState.confirmedRole = picked.path_name;
            if (round === 2) pathState.confirmedSpec  = picked.path_name;

            if (isLast) {
                runRankConfirmation();
            } else {
                runRoleMapping(round + 1);
            }
        });
    });
}

// ─── SHARED FLOW: STARTING RANK CONFIRMATION ─────────────────
function runRankConfirmation() {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) return;

    const inferredRank = inferStartingRank();
    const rankContext  = getRankContext(inferredRank);

    container.innerHTML = `
        <div class="rank-confirm-wrap">
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    Based on what I have read, I am placing you at rank ${inferredRank}.
                </p>
                <p class="path-voice-line path-voice-line--visible">
                    ${rankContext}
                </p>
                <p class="path-voice-line path-voice-line--visible">
                    You know yourself better than I do. Is this accurate?
                </p>
            </div>

            <div class="rank-confirm-options">
                <button class="rank-confirm-btn rank-confirm-btn--accept" id="rc-accept">
                    <span class="rank-confirm-label">[ ${inferredRank}-RANK ]</span>
                    <span class="rank-confirm-sub">This is accurate</span>
                </button>
                <button class="rank-confirm-btn" id="rc-lower">
                    <span class="rank-confirm-label">[ LOWER RANK ]</span>
                    <span class="rank-confirm-sub">I am earlier than this suggests</span>
                </button>
                <button class="rank-confirm-btn" id="rc-higher">
                    <span class="rank-confirm-label">[ HIGHER RANK ]</span>
                    <span class="rank-confirm-sub">I have more experience than this suggests</span>
                </button>
            </div>
            <p class="rank-confirm-note">
                This affects where your daily encounters start and how quickly they scale.
                It does not gate any content permanently.
            </p>
        </div>
    `;

    document.getElementById('rc-accept').addEventListener('click', () => {
        playUIClick(); pathState.confirmedRank = inferredRank; runAspirationProbe();
    });
    document.getElementById('rc-lower').addEventListener('click', () => {
        playUIClick(); pathState.confirmedRank = adjustRank(inferredRank, -1); runAspirationProbe();
    });
    document.getElementById('rc-higher').addEventListener('click', () => {
        playUIClick(); pathState.confirmedRank = adjustRank(inferredRank, +1); runAspirationProbe();
    });
}

function inferStartingRank() {
    if (pathState.track === 'reimaginer') return 'F';

    const text    = pathState.cvText || '';
    const words   = text.split(/\s+/).length;
    const hasYears = /\d{4}/.test(text);
    const hasMgmt  = /manag|lead|head|director|vp|chief|founder/i.test(text);

    if (!hasYears || words < 100) return 'F';
    if (hasMgmt && words > 400)   return 'C';
    if (words > 250)              return 'E';
    return 'F';
}

function getRankContext(rank) {
    const contexts = {
        'F': 'You are early in your career. Your directives and encounters will build from fundamentals.',
        'E': 'You have some real-world experience. You will encounter frameworks quickly.',
        'D': 'You are developing. Your path shows consistent progression across more than one context.',
        'C': 'You are established. The gap between where you are and expert practice is visible and closeable.',
        'B': 'You are capable and have demonstrated it in senior contexts.',
        'A': 'You are recognised in your field. The work now is precision, not breadth.'
    };
    return contexts[rank] || contexts['F'];
}

const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
function adjustRank(rank, delta) {
    const idx    = RANK_ORDER.indexOf(rank);
    const newIdx = Math.max(0, Math.min(RANK_ORDER.length - 1, idx + delta));
    return RANK_ORDER[newIdx];
}

// ─── SHARED FLOW: ASPIRATION PROBE ───────────────────────────
function runAspirationProbe() {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) return;

    container.innerHTML = `
        <div class="aspiration-wrap">
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    If you could not fail — what is the one thing you would want to be doing every single day?
                </p>
            </div>
            <div class="path-input-group">
                <label class="path-input-label">CAREER GOAL</label>
                <textarea
                    id="aspiration-career"
                    class="path-textarea path-textarea--short"
                    placeholder="The work you would do..."
                    maxlength="280"
                ></textarea>
            </div>
            <div class="path-input-group">
                <label class="path-input-label">LIFE GOAL</label>
                <textarea
                    id="aspiration-life"
                    class="path-textarea path-textarea--short"
                    placeholder="The life you would live..."
                    maxlength="280"
                ></textarea>
            </div>
            <div class="path-action-row">
                <button class="path-skip-btn" id="aspiration-skip">SKIP</button>
                <button class="btn btn--primary" id="aspiration-submit">[ CONFIRM SIGNAL ]</button>
            </div>
        </div>
    `;

    setTimeout(() => { const t = document.getElementById('aspiration-career'); if (t) t.focus(); }, 150);

    document.getElementById('aspiration-skip').addEventListener('click', () => {
        playUIClick(); pathState.aspirationGoal = null; runPathSynthesis();
    });
    document.getElementById('aspiration-submit').addEventListener('click', () => {
        playUIClick();
        const careerGoal = document.getElementById('aspiration-career').value.trim();
        const lifeGoal   = document.getElementById('aspiration-life').value.trim();
        pathState.aspirationGoal = {
            careerGoal,
            lifeGoal,
            domain:     pathState.confirmedPath ? pathState.confirmedPath.path_name : '',
            targetRole: pathState.confirmedRole || ''
        };
        runPathSynthesis();
    });
}

// ─── SHARED FLOW: SYNTHESIS ───────────────────────────────────
// BLOCK C: runPathSynthesis() no longer fires Gemini calls.
// All synthesis data already arrived via Call 2 (fireCall2Bundle).
// Assembles pathData from pathState and the stored call2Bundle,
// then fires onComplete.
function runPathSynthesis() {
    const bundle    = pathState.call2Bundle || getLocalFallbackBundle();
    const confirmedPath = pathState.confirmedPath;

    // Gap analysis — use bundle's gap data tied to the confirmed path
    const gapSkills = (confirmedPath && confirmedPath.gap_skills && confirmedPath.gap_skills.length > 0)
        ? confirmedPath.gap_skills
        : (bundle.initial_career_directives || [])
            .map(d => d.career_skill)
            .filter(Boolean)
            .slice(0, 5);

    const gapAnalysis = {
        primaryGap:     bundle.gap_analysis_prose || buildLocalGapRead(confirmedPath, pathState.confirmedRank),
        skills:         gapSkills,
        geminiEnhanced: !!bundle.geminiEnhanced
    };

    // Hidden affinity — from bundle, or local fallback
    const hiddenAffinity = (bundle.hidden_affinity_stat && bundle.hidden_affinity_read)
        ? {
            stat:           bundle.hidden_affinity_stat,
            read:           bundle.hidden_affinity_read,
            geminiEnhanced: !!bundle.geminiEnhanced
          }
        : buildLocalHiddenAffinity(pathState._scanTraits || {}, pathState._geminiHiddenAffinityStat);

    // Stat seeds
    let statSeeds = null;
    if (confirmedPath && confirmedPath.stat_seeds) {
        statSeeds = confirmedPath.stat_seeds;
    } else {
        const statSeedMap = {
            'Execution and Delivery':    { strength: 6, endurance: 4 },
            'Strategy and Knowledge':    { intelligence: 6, agility: 4 },
            'Adaptation and Innovation': { agility: 6, intelligence: 4 },
            'Consistency and Systems':   { endurance: 6, strength: 4 },
            'Influence and Community':   { charisma: 8 }
        };
        const pathName = confirmedPath ? confirmedPath.path_name : '';
        statSeeds = statSeedMap[pathName]
            || { intelligence: 3, agility: 3, strength: 2, endurance: 2, charisma: 2 };
    }

    pathState.gapAnalysis    = gapAnalysis;
    pathState.hiddenAffinity = hiddenAffinity;
    pathState.statSeeds      = statSeeds;

    // Attach synthesis lines and orientation closing line to pathData
    // so app.js renderSynthesisReveal() and renderOrientationScreen() can use them
    const pathData = {
        track:               pathState.track,
        confirmedPath:       pathState.confirmedPath,
        confirmedRole:       pathState.confirmedRole,
        confirmedSpec:       pathState.confirmedSpec,
        confirmedRank:       pathState.confirmedRank,
        aspirationGoal:      pathState.aspirationGoal,
        gapAnalysis:         pathState.gapAnalysis,
        hiddenAffinity:      pathState.hiddenAffinity,
        statSeeds:           pathState.statSeeds,
        inference:           pathState.inference,
        synthesisSydLines:   bundle.synthesis_syd_lines || [],
        orientationClosing:  bundle.orientation_closing_line || null,
        geminiEnhanced:      !!bundle.geminiEnhanced
    };

    if (typeof pathState.onComplete === 'function') {
        pathState.onComplete(pathData);
    }
}

// ─── LOCAL GAP READ ──────────────────────────────────────────
function buildLocalGapRead(confirmedPath, rank) {
    const r = rank || 'F';
    const reads = {
        'F': 'You are early. The gap between where you are and expert practice in this path is large — and entirely closeable. The directives are calibrated to that distance.',
        'E': 'You have real experience. The gap now is about deliberate practice rather than exposure.',
        'D': 'You are developing. The gap at this stage is mostly about application — converting understanding into repeatable, pressure-tested execution.',
        'C': 'You are established. The gap is precision. The difference between your current practice and expert practice is not knowledge — it is the consistency of applying what you already know.',
        'B': 'You are capable in senior contexts. The gap now is influence and system-level thinking.',
        'A': 'You are recognised. The remaining gap is in edge cases — the situations that do not fit the patterns you have already mastered.',
        'S': 'You operate at a level most practitioners never reach. The remaining gaps are narrow, specific, and hard to name without direct observation.'
    };
    return reads[r] || reads['F'];
}

// ─── LOCAL HIDDEN AFFINITY ───────────────────────────────────
function buildLocalHiddenAffinity(traits, geminiAffinityStat) {
    const TRAIT_TO_STAT = {
        patternRecognition:  'intelligence',
        cognitiveFlexibility:'agility',
        executionSpeed:      'agility',
        executionAccuracy:   'strength',
        pressureStability:   'endurance',
        persistence:         'strength',
        socialReading:       'charisma'
    };

    let dominantStat = geminiAffinityStat || null;

    if (!dominantStat && traits && Object.keys(traits).length > 0) {
        let maxScore = -1;
        let maxTrait = null;
        Object.entries(traits).forEach(([trait, score]) => {
            if (score > maxScore) { maxScore = score; maxTrait = trait; }
        });
        dominantStat = TRAIT_TO_STAT[maxTrait] || 'intelligence';
    }

    if (!dominantStat) dominantStat = 'intelligence';

    const reads = {
        strength:     'Your underlying signal is STRENGTH — delivery, follow-through, physical and operational execution. The scan picked this up independent of what you said you wanted. Build from here.',
        intelligence: 'Your underlying signal is INTELLIGENCE — analytical depth, pattern reading, deliberate reasoning. This runs through everything in your record, whether you named it or not.',
        agility:      'Your underlying signal is AGILITY — adaptation, pivot capacity, comfort with ambiguity. This is the trait that shows up when everything else is under pressure.',
        endurance:    'Your underlying signal is ENDURANCE — sustained effort, system-building, long-horizon consistency. This is quieter than the others but it is what makes the other stats stick.',
        charisma:     'Your underlying signal is CHARISMA — social reading, trust-building, the ability to move people. This runs deeper in your record than you may have credited it.'
    };

    return {
        stat:           dominantStat,
        read:           reads[dominantStat] || reads.intelligence,
        geminiEnhanced: false
    };
}

// ─── PERSONALISED STAT EXPLAINER ─────────────────────────────
// BLOCK C: Checks the stat explainer cache first (seeded by Call 2).
// If cache miss, falls back to individual Gemini call (Batch 6 behaviour).
// This means most operatives with Neural Link will never trigger the
// individual call — Call 2 pre-populated everything.
//
// Returns { text, geminiEnhanced: bool } via Promise.

async function getPersonalisedStatExplainer(stat, statValue, pathData, scanTraits) {
    // Check Call 2 cache first
    try {
        const cached = JSON.parse(localStorage.getItem(STAT_EXPLAINER_CACHE_KEY) || '{}');
        if (cached[stat] && cached[stat].length > 10) {
            return { text: cached[stat], geminiEnhanced: true };
        }
    } catch(e) { /* fall through to Gemini call */ }

    if (!hasNeuralLink()) return { text: null, geminiEnhanced: false };

    const pathName      = pathData && pathData.confirmedPath ? pathData.confirmedPath.path_name : 'unknown';
    const confirmedRole = pathData ? (pathData.confirmedRole || pathName) : 'unknown';
    const rank          = pathData ? (pathData.confirmedRank || 'F') : 'F';

    const STAT_TRAITS = {
        strength:     ['executionAccuracy', 'persistence', 'pressureStability'],
        intelligence: ['patternRecognition', 'cognitiveFlexibility'],
        agility:      ['cognitiveFlexibility', 'executionSpeed', 'patternRecognition'],
        endurance:    ['persistence', 'pressureStability'],
        charisma:     ['socialReading']
    };

    const relevantTraits = STAT_TRAITS[stat] || [];
    const traitContext   = relevantTraits
        .map(t => `${t}: ${(scanTraits && scanTraits[t] != null) ? scanTraits[t] : 'not measured'}`)
        .join(', ');

    const prompt = `
You are SYD — a direct, honest career intelligence system. Write a stat explainer for one operative.

OPERATIVE:
- Stat being explained: ${stat.toUpperCase()}
- Current stat value: ${statValue}
- Confirmed career path: ${pathName}
- Confirmed role: ${confirmedRole}
- Starting rank: ${rank}
- Relevant scan traits for this stat: ${traitContext || 'not available'}

Write the explainer in SYD's voice. Rules:
- 2 to 3 sentences maximum
- Combine what the scan showed (traits) and what the career record shows (path, role)
- Be specific — this is for THIS operative, not a generic type
- Honest. No flattery. No filler.
- Register example: "Your INT is built from how sharply you read patterns under pressure... and three years running product where you had to make calls with incomplete information. You are not slow. You just want to be sure."
- Match that register. Adapt the content.
- Output ONLY the explainer text. No labels. No JSON. No preamble.
`.trim();

    const result = await geminiGenerate(prompt);

    if (!result.ok || !result.text || result.text.trim().length < 20) {
        return { text: null, geminiEnhanced: false };
    }

    const text = result.text.trim();

    // Cache it for future taps
    try {
        const cached = JSON.parse(localStorage.getItem(STAT_EXPLAINER_CACHE_KEY) || '{}');
        cached[stat] = text;
        localStorage.setItem(STAT_EXPLAINER_CACHE_KEY, JSON.stringify(cached));
    } catch(e) {}

    return { text, geminiEnhanced: true };
}

// Called if PATH is re-run — wipes explainer cache so Call 2 regenerates them
function clearStatExplainerCache() {
    try { localStorage.removeItem(STAT_EXPLAINER_CACHE_KEY); } catch(e) {}
}

// ─── LOADING SCREEN ───────────────────────────────────────────
function renderPathLoading(label) {
    const container = document.getElementById('path-loading-content');
    if (!container) return;

    container.innerHTML = `
        <div class="path-loading">
            <div class="path-loading-icon">⬡</div>
            <p class="path-loading-label">${label}</p>
            <div class="path-loading-bar">
                <div class="path-loading-fill" id="path-loading-fill"></div>
            </div>
            <p class="path-loading-sub">[ DO NOT CLOSE — SIGNAL PROCESSING ]</p>
        </div>
    `;

    let pct = 0;
    const fill = document.getElementById('path-loading-fill');
    const iv = setInterval(() => {
        pct = Math.min(92, pct + Math.random() * 9);
        if (fill) fill.style.width = pct + '%';
        if (pct >= 92) clearInterval(iv);
    }, 180);
}

// ─── PATH DATA SAVE / LOAD ────────────────────────────────────
function savePathData(pathData) {
    try { localStorage.setItem(PATH_DATA_KEY, JSON.stringify(pathData)); }
    catch(e) { console.warn('[SYD] Could not save PATH data:', e); }
}
function loadPathData() {
    try { const r = localStorage.getItem(PATH_DATA_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
}

// ─── CAREER ENCOUNTERS LOAD ───────────────────────────────────
// Called by encounter.js to check for career encounters seeded by Call 2.
function loadCareerEncounters() {
    try {
        const raw = localStorage.getItem(CAREER_ENCOUNTERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

// ─── CALL 4: CAREER REFRESH ──────────────────────────────────
// Fires in the background when the career directive cache is low.
async function fireCall4() {
    if (!hasNeuralLink()) return;
    
    const bundle = loadPathData();
    if (!bundle || !bundle.aspirationGoal) return;

    const prompt = `Refresh career directives for a ${bundle.confirmedRole} (${bundle.confirmedSpec}) aiming for ${bundle.aspirationGoal.targetRole}. Return 10 new directives in JSON format.`;
    
    const result = await geminiSilentCall(prompt, 0.2);
    if (result.ok && result.data) {
        const newDirectives = extractJSON(result.data);
        if (newDirectives) {
            localStorage.setItem('syd_career_directives', JSON.stringify(newDirectives));
            console.log('[SYD] Call 4 successful: Career cache refreshed.');
        }
    }
}