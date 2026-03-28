// ═══════════════════════════════════════════════════════════════
// SYD GES — path.js  (Batch 6 — Gemini integration)
// PATH Protocol — both tracks feed into the same shared flow.
//
// Track A — The Chronicler:
//   CV paste → Gemini/local classification → skill calibration →
//   role mapping (3 rounds) → specialisation → rank confirmation →
//   aspiration probe → synthesis (gap analysis + hidden affinity)
//
// Track B — The Re-imaginer:
//   4 conversational exchanges → same shared flow from skill
//   calibration onward
//
// Gemini calls (Batch 6):
//   1. analyseCV()         — CV analysis → 3 paths, stat seeds, gap hints
//   2. buildGapAnalysis()  — gap analysis per confirmed path + rank
//   3. detectHiddenAffinity() — hidden affinity from trait scores + CV
//   4. upgradeStatExplainer() — personalised stat explainer (called by status.js)
//
// Each call has a genuinely good local fallback.
// Local fallbacks ran the app cleanly through Batches 1–5.
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
    onComplete:         null
};

// [TUNING TARGET] Maximum stat bonus PATH data can seed above scan baseline
const PATH_SEED_MAX_PER_STAT = 8;

// ─── PATH ENTRY POINT ────────────────────────────────────────
// Called from app.js startPATH() after scan completes.
function runPATH(scanTraits, onComplete) {
    pathState = {
        track: null, cvText: null, reimagineResponses: [],
        inference: null, confirmedPath: null, confirmedRole: null,
        confirmedSpec: null, confirmedRank: null, aspirationGoal: null,
        gapAnalysis: null, hiddenAffinity: null, statSeeds: null, onComplete
    };
    // Store scan traits so Gemini can read them at synthesis time
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
// CV paste → Gemini analysis → shared flow
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
            <button class="btn btn--primary" id="cv-submit-btn">[ TRANSMIT RECORD ]</button>
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
        runSkillCalibration();
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
        runSkillCalibration();
    } else {
        renderReImaginerQuestion(currentIdx + 1);
    }
}

// ─── SHARED FLOW: SKILL CALIBRATION ──────────────────────────
// Entry point for both tracks into the shared flow.
// Tries Gemini first (analyseCV), falls back to local classification.
function runSkillCalibration() {
    showScreen('screen-path-loading');
    renderPathLoading('SKILL CALIBRATION — ANALYSING YOUR SIGNAL');

    analyseCV().then(inference => {
        pathState.inference = inference;
        runRoleMapping(0);
    });
}

// ─── GEMINI CALL 1: CV ANALYSIS ───────────────────────────────
// Sends the CV (Chronicler) or Re-imaginer answers to Gemini.
// Returns { paths: [...], offlineMode: bool, statSeeds: {...} }
//
// Gemini returns the same shape as the local fallback:
//   paths[0..2] = { path_name, narrative, target_roles[], mapped_skills[] }
//
// Extended from the master design doc prompt to include:
//   - stat seeding hints per path
//   - gap hints (skills the operative currently lacks for each path)
//   - hidden affinity signal (where trait energy is actually strongest)
//
// Local fallback: getLocalFallbackInference() — keyword classification.

async function analyseCV() {
    if (!hasNeuralLink()) return getLocalFallbackInference();

    const inputText = pathState.cvText || pathState.reimagineResponses.join('\n\n');
    const isCV      = pathState.track === 'chronicler';

    // [RESEARCH] Source: Anthropic prompting docs — prompt engineering overview.
    // Finding: explicit JSON-only instruction + schema reduces hallucination rate.
    // Applied: STRICT JSON instruction, schema inline, no markdown.
    const prompt = `
You are an elite Career Strategist and Executive Talent Mapper. Analyse the provided ${isCV ? 'CV/Resume' : 'career self-assessment responses'} and identify exactly THREE distinct, high-impact career paths the individual is uniquely positioned for.

Do not just read the job titles. Analyse the systems and impact the person has created to uncover their true professional DNA.

Also identify:
1. STAT SEEDS — which of the five stats (strength, intelligence, agility, endurance, charisma) each path primarily develops. Use only these five stat names. Provide a number from 1 to ${PATH_SEED_MAX_PER_STAT} for each stat that this path develops (omit stats with 0 contribution).
2. GAP SKILLS — 3 to 5 specific skills the person does NOT currently demonstrate but which this path requires. Be honest and specific. These are the gaps they need to close.
3. HIDDEN AFFINITY SIGNAL — across all three paths, which single stat shows the strongest underlying energy in this person's record, independent of what they said they wanted? One word only — the stat name.

Output ONLY valid JSON. No markdown. No preamble. No explanation outside the JSON.

{
  "paths": [
    {
      "path_name": "Strategic name of Path 1",
      "narrative": "2 to 3 sentence strategic explanation referencing specific evidence from their record.",
      "target_roles": ["Role 1", "Role 2", "Role 3"],
      "mapped_skills": ["Skill 1", "Skill 2", "Skill 3"],
      "stat_seeds": { "intelligence": 6, "agility": 4 },
      "gap_skills": ["Gap skill 1", "Gap skill 2", "Gap skill 3"]
    },
    { "path_name": "...", "narrative": "...", "target_roles": [], "mapped_skills": [], "stat_seeds": {}, "gap_skills": [] },
    { "path_name": "...", "narrative": "...", "target_roles": [], "mapped_skills": [], "stat_seeds": {}, "gap_skills": [] }
  ],
  "hidden_affinity_stat": "intelligence"
}

${isCV ? 'CV TO ANALYSE' : 'SELF-ASSESSMENT RESPONSES'}:
${inputText}
`.trim();

    const result = await geminiClassify(prompt);

    if (!result.ok) {
        console.warn('[SYD] CV analysis fell back to local:', result.error);
        return getLocalFallbackInference();
    }

    const parsed = extractJSON(result.text);
    if (!parsed || !Array.isArray(parsed.paths) || parsed.paths.length < 2) {
        console.warn('[SYD] CV analysis JSON parse failed — falling back to local.');
        return getLocalFallbackInference();
    }

    // Store hidden affinity stat for synthesis
    pathState._geminiHiddenAffinityStat = parsed.hidden_affinity_stat || null;

    return {
        paths:       parsed.paths,
        offlineMode: false
    };
}

// ─── LOCAL FALLBACK: INFERENCE ────────────────────────────────
// Produces three path objects from keyword classification.
// The Gemini call returns the same shape with richer content.
function getLocalFallbackInference() {
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

    return { paths: [primary, linked1, linked2], offlineMode: true };
}

// ─── SHARED FLOW: ROLE MAPPING (3 ROUNDS) ────────────────────
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
// Runs Gemini gap analysis and hidden affinity in parallel.
// Falls back gracefully if either call fails.
// Fires onComplete with the full pathData object.
function runPathSynthesis() {
    showScreen('screen-path-loading');
    renderPathLoading('SYNTHESIS — BUILDING YOUR OPERATIVE PROFILE');

    Promise.all([
        buildGapAnalysis(),
        detectHiddenAffinity()
    ]).then(([gapAnalysis, hiddenAffinity]) => {
        pathState.gapAnalysis   = gapAnalysis;
        pathState.hiddenAffinity = hiddenAffinity;

        // Stat seeding: use Gemini stat_seeds from the confirmed path if available,
        // otherwise fall back to the local stat seed map.
        let statSeeds = null;
        if (pathState.confirmedPath && pathState.confirmedPath.stat_seeds) {
            statSeeds = pathState.confirmedPath.stat_seeds;
        } else {
            // [TUNING TARGET] PATH stat seeding per confirmed path name (local fallback)
            const statSeedMap = {
                'Execution and Delivery':    { strength: 6, endurance: 4 },
                'Strategy and Knowledge':    { intelligence: 6, agility: 4 },
                'Adaptation and Innovation': { agility: 6, intelligence: 4 },
                'Consistency and Systems':   { endurance: 6, strength: 4 },
                'Influence and Community':   { charisma: 8 }
            };
            const pathName = pathState.confirmedPath ? pathState.confirmedPath.path_name : '';
            statSeeds = statSeedMap[pathName]
                || { intelligence: 3, agility: 3, strength: 2, endurance: 2, charisma: 2 };
        }

        pathState.statSeeds = statSeeds;

        const pathData = {
            track:          pathState.track,
            confirmedPath:  pathState.confirmedPath,
            confirmedRole:  pathState.confirmedRole,
            confirmedSpec:  pathState.confirmedSpec,
            confirmedRank:  pathState.confirmedRank,
            aspirationGoal: pathState.aspirationGoal,
            gapAnalysis:    pathState.gapAnalysis,
            hiddenAffinity: pathState.hiddenAffinity,
            statSeeds:      pathState.statSeeds,
            inference:      pathState.inference
        };

        if (typeof pathState.onComplete === 'function') {
            pathState.onComplete(pathData);
        }
    });
}

// ─── GEMINI CALL 2: GAP ANALYSIS ─────────────────────────────
// Generates a personalised gap read for the confirmed path and rank.
// Tells the operative specifically what they lack for the path they chose.
//
// Returns { primaryGap, skills[], geminiEnhanced: bool }
// Local fallback: rank-aware text from getRankGapRead() + skills from path.

async function buildGapAnalysis() {
    const path = pathState.confirmedPath;
    const rank = pathState.confirmedRank || 'F';

    // If Gemini already returned gap_skills in the CV analysis, use those
    // as the skills list. Gap analysis Gemini call adds the personalised prose.
    const existingGapSkills = (path && path.gap_skills) || [];

    if (!hasNeuralLink()) {
        return buildLocalGapAnalysis(path, rank, existingGapSkills);
    }

    const pathName    = path ? path.path_name : 'unknown';
    const confirmedRole = pathState.confirmedRole || pathName;
    const inputText   = pathState.cvText || pathState.reimagineResponses.join('\n\n');

    // [RESEARCH] Source: SYD master design doc — gap analysis spec.
    // Finding: gap reads must be honest, specific, and rank-calibrated.
    // Applied: rank and role injected into prompt; vague feedback blocked by instruction.
    const prompt = `
You are SYD — a direct, honest career intelligence system. Write a gap analysis for an operative.

OPERATIVE PROFILE:
- Confirmed path: ${pathName}
- Confirmed role: ${confirmedRole}
- Confirmed rank: ${rank} (rank scale: F = early career, E = some experience, D = developing, C = established, B = senior, A = recognised, S = elite)
- Gaps already identified from record: ${existingGapSkills.join(', ') || 'none identified yet'}

Based on the above, write a gap analysis in SYD's voice. Rules:
- 2 to 3 sentences maximum
- Specific to this path and rank — not generic career advice
- Honest about the distance between where they are and where this path leads
- Do not use the word "journey" or "passion" or "potential" — too soft
- SYD speaks in short, declarative sentences. No fluff
- Output ONLY the gap analysis text. No JSON. No labels. No preamble.

OPERATIVE RECORD (for context):
${inputText.slice(0, 1500)}
`.trim();

    const result = await geminiGenerate(prompt);

    if (!result.ok) {
        console.warn('[SYD] Gap analysis fell back to local:', result.error);
        return buildLocalGapAnalysis(path, rank, existingGapSkills);
    }

    const text = result.text.trim();
    if (!text || text.length < 20) {
        return buildLocalGapAnalysis(path, rank, existingGapSkills);
    }

    return {
        primaryGap:      text,
        skills:          existingGapSkills.length > 0
                             ? existingGapSkills
                             : (path ? (path.mapped_skills || []) : []),
        geminiEnhanced:  true
    };
}

// Local fallback: builds a gap analysis from rank context and path skills.
function buildLocalGapAnalysis(path, rank, existingGapSkills) {
    // Rank-aware gap prose (same strings rendered in status.js PATH tab)
    const rankGap = {
        'F': 'You are early. The gap between where you are and expert practice in this path is large — and entirely closeable. The directives are calibrated to that distance.',
        'E': 'You have real experience. The gap now is about deliberate practice rather than exposure. You have seen enough to know what you do not know yet.',
        'D': 'You are developing. The gap at this stage is mostly about application — converting understanding into repeatable, pressure-tested execution.',
        'C': 'You are established. The gap is precision. The difference between your current practice and expert practice is not knowledge — it is the consistency of applying what you already know.',
        'B': 'You are capable in senior contexts. The gap now is influence and system-level thinking — moving from doing well yourself to making others do well.',
        'A': 'You are recognised. The remaining gap is in edge cases — the situations that do not fit the patterns you have already mastered.',
        'S': 'You operate at a level most practitioners never reach. The remaining gaps are narrow, specific, and hard to name without direct observation.'
    };

    const skills = existingGapSkills.length > 0
        ? existingGapSkills
        : (path ? (path.mapped_skills || []) : []);

    return {
        primaryGap:     rankGap[rank] || rankGap['F'],
        skills,
        geminiEnhanced: false
    };
}

// ─── GEMINI CALL 3: HIDDEN AFFINITY ──────────────────────────
// Surfaces where the operative's trait energy is actually strongest,
// independent of what they said they wanted.
//
// Unlocked at Level 20 in the Status Window (status.js checks level).
// Stored in pathData.hiddenAffinity from day one — just revealed later.
//
// Returns { stat, read, geminiEnhanced: bool }
// Local fallback: dominant trait score from scan, plain text read.

async function detectHiddenAffinity() {
    const traits     = pathState._scanTraits || {};
    const path       = pathState.confirmedPath;
    const inputText  = pathState.cvText || pathState.reimagineResponses.join('\n\n');

    // If Gemini already flagged the hidden affinity stat during CV analysis, use it
    // as the primary signal. The call here adds the personalised prose explanation.
    const geminiAffinityStat = pathState._geminiHiddenAffinityStat || null;

    if (!hasNeuralLink()) {
        return buildLocalHiddenAffinity(traits, geminiAffinityStat);
    }

    const traitSummary = Object.entries(traits)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

    // [RESEARCH] Source: SYD master design doc — hidden affinity spec.
    // Finding: affinity is where trait energy is strongest independent of stated goal.
    // Applied: explicitly contrasted against the confirmed path to find the divergence.
    const prompt = `
You are SYD — a direct, honest career intelligence system. Identify an operative's hidden affinity.

HIDDEN AFFINITY means: the stat domain where this person's underlying signals are strongest, independent of what they said they wanted. It may match their confirmed path — or it may point somewhere they have not looked yet.

OPERATIVE DATA:
- Confirmed path: ${path ? path.path_name : 'unconfirmed'}
- Scan trait scores: ${traitSummary || 'not available'}
- Strongest stat suggested by AI CV analysis: ${geminiAffinityStat || 'not identified'}

The five stats are: strength, intelligence, agility, endurance, charisma.

Write a hidden affinity read in SYD's voice. Rules:
- Name the hidden affinity stat on the first line in uppercase only (e.g. INTELLIGENCE)
- Then write 2 to 3 sentences explaining what this means for this operative specifically
- Be direct. Specific. Reference the stat. Reference the confirmed path if the affinity diverges from it
- Do not use the word "journey" or "passion" — too soft
- Output ONLY the stat name on line 1, then the read. No JSON. No labels. No preamble.

OPERATIVE RECORD (for context):
${inputText.slice(0, 1200)}
`.trim();

    const result = await geminiGenerate(prompt);

    if (!result.ok) {
        console.warn('[SYD] Hidden affinity fell back to local:', result.error);
        return buildLocalHiddenAffinity(traits, geminiAffinityStat);
    }

    const lines = result.text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
        return buildLocalHiddenAffinity(traits, geminiAffinityStat);
    }

    const stat = lines[0].trim().toLowerCase().replace(/[^a-z]/g, '');
    const read = lines.slice(1).join(' ').trim();

    // Validate the stat is one of the five
    const validStats = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
    if (!validStats.includes(stat)) {
        return buildLocalHiddenAffinity(traits, geminiAffinityStat);
    }

    return { stat, read, geminiEnhanced: true };
}

// Local fallback: uses scan trait scores or the CV-analysis stat flag
// to determine affinity, then produces a plain-text read.
function buildLocalHiddenAffinity(traits, geminiAffinityStat) {
    // Trait → stat mapping (from master design doc)
    const TRAIT_TO_STAT = {
        patternRecognition:  'intelligence',
        cognitiveFlexibility:'agility',
        executionSpeed:      'agility',
        executionAccuracy:   'strength',
        pressureStability:   'endurance',
        persistence:         'strength',
        socialReading:       'charisma'
    };

    // Find the dominant trait from scan scores
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

// ─── GEMINI CALL 4: PERSONALISED STAT EXPLAINER ──────────────
// Called by status.js when an operative taps a stat bar.
// Generates a personalised read combining trait scores and PATH data.
// Caches result in localStorage so it does not re-call on every tab open.
//
// Returns { text, geminiEnhanced: bool } via Promise.
// Local fallback: the static STAT_EXPLAINERS from status.js.

const STAT_EXPLAINER_CACHE_KEY = 'syd_stat_explainer_cache';

async function getPersonalisedStatExplainer(stat, statValue, pathData, scanTraits) {
    if (!hasNeuralLink()) return { text: null, geminiEnhanced: false };

    // Check cache first — explainers do not change unless PATH is re-run
    try {
        const cached = JSON.parse(localStorage.getItem(STAT_EXPLAINER_CACHE_KEY) || '{}');
        if (cached[stat]) return { text: cached[stat], geminiEnhanced: true };
    } catch (e) { /* ignore */ }

    const pathName     = pathData && pathData.confirmedPath ? pathData.confirmedPath.path_name : 'unknown';
    const confirmedRole = pathData ? (pathData.confirmedRole || pathName) : 'unknown';
    const rank          = pathData ? (pathData.confirmedRank || 'F') : 'F';

    // Build trait context for this specific stat
    // [RESEARCH] Source: SYD master design doc — trait-to-stat mapping.
    // Finding: traits are the hidden engine, stats the dashboard.
    // Applied: relevant traits injected so Gemini can personalise to actual scan data.
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

    // [RESEARCH] Source: SYD master design doc — stat explainer example.
    // Finding: explainers must combine trait signals AND career data in one voice.
    // Applied: prompt explicitly requests both; register example included.
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

    // Cache it
    try {
        const cached = JSON.parse(localStorage.getItem(STAT_EXPLAINER_CACHE_KEY) || '{}');
        cached[stat] = text;
        localStorage.setItem(STAT_EXPLAINER_CACHE_KEY, JSON.stringify(cached));
    } catch (e) { /* ignore */ }

    return { text, geminiEnhanced: true };
}

// Called by app.js or status.js when PATH is re-run — wipes the explainer cache
// so Gemini regenerates them for the new profile.
function clearStatExplainerCache() {
    try { localStorage.removeItem(STAT_EXPLAINER_CACHE_KEY); } catch (e) { /* ignore */ }
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
const PATH_DATA_KEY = 'syd_path_data';

function savePathData(pathData) {
    try { localStorage.setItem(PATH_DATA_KEY, JSON.stringify(pathData)); }
    catch(e) { console.warn('[SYD] Could not save PATH data:', e); }
}
function loadPathData() {
    try { const r = localStorage.getItem(PATH_DATA_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
}