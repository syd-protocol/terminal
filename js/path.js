// ═══════════════════════════════════════════════════════════════
// SYD GES — path.js  (Batch 2)
// PATH Protocol — both tracks feed into the same shared flow.
//
// Track A — The Chronicler:
//   CV paste → local/Gemini classification → skill calibration →
//   role mapping (3 rounds) → specialisation → rank confirmation →
//   aspiration probe → synthesis
//
// Track B — The Re-imaginer:
//   4 conversational exchanges, one at a time, progress fills →
//   same shared flow from skill calibration onward
//
// Shared flow:
//   Skill Calibration → Role Mapping (3 rounds) → Specialisation →
//   Starting Rank Confirmation → Aspiration Probe → Synthesis
//
// All Gemini calls are stubbed with a local fallback.
// Real Gemini integration is wired at the Gemini phase.
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
    gapAnalysis:        null,
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
        gapAnalysis: null, statSeeds: null, onComplete
    };
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
// CV paste → analysis → shared flow
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
// Four conversational exchanges, one at a time. Progress bar fills.
// Questions reveal natural competence without career framing.
// The fourth question sets up the aspiration probe beautifully.

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

    // Auto-focus the textarea
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
// Gemini call stub — replaced at Gemini integration phase.
// Local fallback: keyword classification via classifyGoal().
function runSkillCalibration() {
    showScreen('screen-path-loading');
    renderPathLoading('SKILL CALIBRATION — ANALYSING YOUR SIGNAL');

    setTimeout(() => {
        pathState.inference = getLocalFallbackInference();
        runRoleMapping(0);
    }, 1800);
}

// Local fallback: produces three path objects from keyword classification.
// The real Gemini call returns the same shape with richer content.
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
            mapped_skills: ['Delivery', 'Operational Coordination', 'Physical Execution']
        },
        intelligence: {
            path_name:    'Strategy and Knowledge',
            narrative:    'Your pattern shows strong analytical focus and a drive to understand the underlying system before acting on it.',
            target_roles: ['Strategy Lead', 'Product Manager', 'Research Lead'],
            mapped_skills: ['Analysis', 'Systems Thinking', 'Knowledge Architecture']
        },
        agility:      {
            path_name:    'Adaptation and Innovation',
            narrative:    'Your pattern shows strong pivot capacity and a comfort with ambiguity that most people avoid.',
            target_roles: ['Innovation Lead', 'Consultant', 'Product Designer'],
            mapped_skills: ['Adaptability', 'Problem Framing', 'Creative Pivots']
        },
        endurance:    {
            path_name:    'Consistency and Systems',
            narrative:    'Your pattern shows sustained effort and a systems-building orientation over long time horizons.',
            target_roles: ['Systems Architect', 'Programme Manager', 'Operations Lead'],
            mapped_skills: ['Sustained Effort', 'Process Design', 'Long-term Discipline']
        },
        charisma:     {
            path_name:    'Influence and Community',
            narrative:    'Your pattern shows strong social reading and a demonstrated capacity to move people and build trust.',
            target_roles: ['Community Lead', 'Business Development', 'Head of Growth'],
            mapped_skills: ['Relationship Building', 'Influence', 'Communication']
        }
    };

    const primary = statToPath[result.primaryStat]    || statToPath.intelligence;
    const linked1 = statToPath[result.linkedStats[0]] || statToPath.agility;
    const linked2 = statToPath[result.linkedStats[1]] || statToPath.endurance;

    return { paths: [primary, linked1, linked2], offlineMode: true };
}

// ─── SHARED FLOW: ROLE MAPPING (3 ROUNDS) ────────────────────
// Three rounds of selection, each narrowing the operative's path.
// Round 0: pick one of the three inferred career directions.
// Round 1: pick the specific role you see yourself in.
// Round 2: pick the specialisation that fits best.
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

    // Round 1: show roles as options, not full path cards
    // Round 2: show specialisations derived from the confirmed path
    let cardData = paths;
    if (round === 1 && pathState.confirmedPath) {
        const roles = pathState.confirmedPath.target_roles || [];
        cardData = roles.map(r => ({
            path_name:    r,
            narrative:    '',
            target_roles: [],
            mapped_skills: []
        }));
        // Add two alternatives from other paths
        if (paths[1]) cardData.push({ path_name: (paths[1].target_roles || [])[0] || paths[1].path_name, narrative: '', target_roles: [], mapped_skills: [] });
        if (paths[2]) cardData.push({ path_name: (paths[2].target_roles || [])[0] || paths[2].path_name, narrative: '', target_roles: [], mapped_skills: [] });
    }
    if (round === 2 && pathState.confirmedPath) {
        const skills = pathState.confirmedPath.mapped_skills || [];
        cardData = skills.map(s => ({
            path_name:    s,
            narrative:    '',
            target_roles: [],
            mapped_skills: []
        }));
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
// From the master design doc:
//   Starting rank is inferred from PATH data, presented with plain
//   language real-world context, confirmed by operative.
//   Collaboration between SYD's read and operative's self-knowledge.
//   High level + low rank = engaging but not translating to real world.
//   High rank + low level = came in already capable.
//
// SYD infers a rank from the confirmed path and any CV/response content.
// The operative can accept it or adjust it up or down.
// This is not a test — it is a calibration handshake.
function runRankConfirmation() {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) return;

    // Infer a starting rank from the operative's track and content
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

// Infer a starting rank from track and content depth.
// Local fallback — Gemini produces a richer inference at integration phase.
function inferStartingRank() {
    if (pathState.track === 'reimaginer') return 'F';   // no career record — start at floor

    // Chronicler: estimate from CV text length and keyword density as a proxy for experience
    const text    = pathState.cvText || '';
    const words   = text.split(/\s+/).length;
    const hasYears = /\d{4}/.test(text);    // any year mentioned = some experience
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
// Career goal and life goal defined separately.
// The probe question is the one from the master design doc verbatim.
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

    // Auto-focus career goal
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
// Combines all PATH data. Seeds stat bonuses on top of scan seeds.
// Fires onComplete with the full pathData object.
function runPathSynthesis() {
    showScreen('screen-path-loading');
    renderPathLoading('SYNTHESIS — BUILDING YOUR OPERATIVE PROFILE');

    setTimeout(() => {
        // [TUNING TARGET] PATH stat seeding per confirmed path name
        const statSeedMap = {
            'Execution and Delivery':    { strength: 6, endurance: 4 },
            'Strategy and Knowledge':    { intelligence: 6, agility: 4 },
            'Adaptation and Innovation': { agility: 6, intelligence: 4 },
            'Consistency and Systems':   { endurance: 6, strength: 4 },
            'Influence and Community':   { charisma: 8 }
        };

        const pathName = pathState.confirmedPath ? pathState.confirmedPath.path_name : '';
        pathState.statSeeds = statSeedMap[pathName]
            || { intelligence: 3, agility: 3, strength: 2, endurance: 2, charisma: 2 };

        pathState.gapAnalysis = {
            primaryGap: 'Gap analysis — Gemini integration phase.',
            skills:     pathState.confirmedPath ? (pathState.confirmedPath.mapped_skills || []) : []
        };

        const pathData = {
            track:          pathState.track,
            confirmedPath:  pathState.confirmedPath,
            confirmedRole:  pathState.confirmedRole,
            confirmedSpec:  pathState.confirmedSpec,
            confirmedRank:  pathState.confirmedRank,
            aspirationGoal: pathState.aspirationGoal,
            gapAnalysis:    pathState.gapAnalysis,
            statSeeds:      pathState.statSeeds,
            inference:      pathState.inference
        };

        if (typeof pathState.onComplete === 'function') {
            pathState.onComplete(pathData);
        }
    }, 2200);
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