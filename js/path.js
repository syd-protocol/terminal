// ═══════════════════════════════════════════════════════════════
// SYD GES — path.js
// PATH Protocol — both tracks feed into the same shared flow.
//
// Track A — The Chronicler: CV paste → classification → role mapping
// Track B — The Re-imaginer: 4 conversational exchanges → same shared flow
//
// Shared flow: Skill Calibration → Role Mapping (3 rounds) →
//   Specialisation → Aspiration Probe → Synthesis and Gap Analysis
//
// STUB — all AI calls are placeholder. Screen transitions, SYD voice,
// progress indicators, and local fallback classification are fully wired.
// Real Gemini integration is built in the Gemini phase.
// ═══════════════════════════════════════════════════════════════

// ─── PATH STATE ──────────────────────────────────────────────
let pathState = {
    track:              null,    // 'chronicler' | 'reimaginer'
    cvText:             null,
    reimagineResponses: [],
    skillVerifyResults: null,
    inference:          null,    // { paths: [...] } from Gemini or local fallback
    confirmedPath:      null,
    confirmedRole:      null,
    confirmedSpec:      null,
    aspirationGoal:     null,    // { domain, targetRole, timeline, careerGoal, lifeGoal }
    gapAnalysis:        null,
    statSeeds:          null,    // stat bonuses from PATH data, stacked on top of scan seeds
    onComplete:         null     // callback(pathData) — fires when full PATH flow completes
};

// [TUNING TARGET] Maximum stat bonus PATH data can seed per stat above scan baseline.
const PATH_SEED_MAX_PER_STAT = 8;

// ─── PATH ENTRY POINT ────────────────────────────────────────
// Called after scan completes.
// scanTraits: the trait object from scan.js
// onComplete: callback(pathData) — pathData contains all PATH outputs

function runPATH(scanTraits, onComplete) {
    pathState.onComplete = onComplete;
    showScreen('screen-path-select');
    renderPathSelect();
}

// ─── TRACK SELECTION ─────────────────────────────────────────
function renderPathSelect() {
    const container = document.getElementById('path-content');
    if (!container) return;

    container.innerHTML = `
        <div class="path-select">
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    Good. Now I need your history.
                </p>
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
        playUIClick();
        pathState.track = 'chronicler';
        runChronicler();
    });

    document.getElementById('btn-reimaginer').addEventListener('click', () => {
        playUIClick();
        pathState.track = 'reimaginer';
        runReImaginer();
    });
}

// ─── TRACK A: THE CHRONICLER ──────────────────────────────────
// CV paste → AI analysis → skill calibration → shared flow
// Local fallback: keyword classification using classifyGoal() logic

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
                [ Your record is processed on-device. Nothing leaves until you opt in to cloud sync. ]
            </p>
        </div>
    `;

    document.getElementById('chronicler-back').addEventListener('click', () => {
        playUIClick();
        renderPathSelect();
        showScreen('screen-path-select');
    });

    document.getElementById('cv-submit-btn').addEventListener('click', () => {
        playUIClick();
        const cvText = document.getElementById('cv-input').value.trim();
        if (!cvText) {
            document.getElementById('cv-input').focus();
            return;
        }
        pathState.cvText = cvText;
        runSkillCalibration();
    });
}

// ─── TRACK B: THE RE-IMAGINER ─────────────────────────────────
// Four conversational exchanges, one at a time, progress indicator fills.
// Questions reveal natural competence without career framing.

const REIMAGINER_QUESTIONS = [
    'What have you figured out on your own that most people around you have not?',
    'When people come to you for help — not officially, just because they trust you — what is it usually for?',
    'What do you do when you have completely free time and no obligation?',
    'What could you teach someone right now, with no preparation needed?'
];

function runReImaginer() {
    pathState.reimagineResponses = [];
    showScreen('screen-path-reimaginer');
    renderReImaginerQuestion(0);
}

function renderReImaginerQuestion(idx) {
    const container = document.getElementById('reimaginer-content');
    if (!container) return;

    const total   = REIMAGINER_QUESTIONS.length;
    const pct     = Math.round((idx / total) * 100);
    const isLast  = idx === total - 1;

    container.innerHTML = `
        <div class="reimaginer-wrap">
            ${idx === 0 ? `<button class="path-back-btn" id="reimaginer-back">← BACK</button>` : ''}
            <div class="path-progress-bar">
                <div class="path-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="path-progress-label">QUESTION ${idx + 1} OF ${total}</p>
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    ${REIMAGINER_QUESTIONS[idx]}
                </p>
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
            playUIClick();
            renderPathSelect();
            showScreen('screen-path-select');
        });
    }

    document.getElementById('reimaginer-skip').addEventListener('click', () => {
        playUIClick();
        pathState.reimagineResponses.push('');
        advanceReImaginer(idx, total);
    });

    document.getElementById('reimaginer-next').addEventListener('click', () => {
        playUIClick();
        const response = document.getElementById('reimaginer-input').value.trim();
        pathState.reimagineResponses.push(response);
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
// Entry point into the shared flow for both tracks.
// Gemini analyses the operative's input and returns structured inference.
// Local fallback: keyword-based classification using classifyGoal() patterns.

function runSkillCalibration() {
    showScreen('screen-path-loading');
    renderPathLoading('SKILL CALIBRATION — ANALYSING YOUR SIGNAL');

    // [STUB] Simulate Gemini call with a timeout.
    // At Gemini integration phase, this becomes a real API call.
    // The local fallback runs immediately if Gemini is unavailable.
    setTimeout(() => {
        const inference = getLocalFallbackInference();
        pathState.inference = inference;
        runRoleMapping(0);
    }, 1800);
}

// Local fallback: keyword classification from CV text or Re-imaginer responses.
// Same logic as classifyGoal() in app.js, extended to produce a paths array.
function getLocalFallbackInference() {
    const inputText = pathState.cvText
        || pathState.reimagineResponses.join(' ');

    const result = (typeof classifyGoal === 'function')
        ? classifyGoal(inputText)
        : { primaryStat: 'intelligence', linkedStats: ['agility', 'endurance'] };

    // Build three plausible path objects from keyword classification
    const statToPath = {
        strength:     { path_name: 'Execution & Delivery',    narrative: 'Your pattern shows strong delivery focus and physical or operational drive.',    target_roles: ['Operations Manager', 'Project Lead', 'Programme Director'], mapped_skills: ['Delivery', 'Coordination', 'Physical Execution'] },
        intelligence: { path_name: 'Strategy & Knowledge',    narrative: 'Your pattern shows strong analytical and learning focus across domains.',        target_roles: ['Strategy Lead', 'Product Manager', 'Research Lead'],       mapped_skills: ['Analysis', 'Learning Systems', 'Strategic Thinking'] },
        agility:      { path_name: 'Adaptation & Innovation', narrative: 'Your pattern shows strong pivot capacity and pattern-breaking under pressure.',    target_roles: ['Innovation Lead', 'Consultant', 'Product Designer'],        mapped_skills: ['Adaptability', 'Problem Framing', 'Creative Pivots'] },
        endurance:    { path_name: 'Consistency & Systems',   narrative: 'Your pattern shows sustained effort and systems-building over long horizons.',     target_roles: ['Systems Architect', 'Programme Manager', 'Operations Lead'], mapped_skills: ['Sustained Effort', 'Process Building', 'Discipline'] },
        charisma:     { path_name: 'Influence & Community',   narrative: 'Your pattern shows strong social reading and people-movement capacity.',          target_roles: ['Community Lead', 'Business Development', 'Head of Growth'],  mapped_skills: ['Relationship Building', 'Influence', 'Communication'] }
    };

    const primary = statToPath[result.primaryStat]   || statToPath.intelligence;
    const linked1 = statToPath[result.linkedStats[0]] || statToPath.agility;
    const linked2 = statToPath[result.linkedStats[1]] || statToPath.endurance;

    return {
        paths:        [primary, linked1, linked2],
        offlineMode:  true
    };
}

// ─── SHARED FLOW: ROLE MAPPING (3 ROUNDS) ────────────────────
// Operative picks from three inferred career paths, one round at a time.
// Each round refines the picture. Round 3 locks in the confirmed path.

function runRoleMapping(round) {
    showScreen('screen-path-select');
    const pathContainer = document.getElementById('path-content');
    if (!pathContainer) return;

    const paths  = (pathState.inference && pathState.inference.paths) || [];
    const isLast = round === 2;
    const pct    = Math.round(((round + 1) / 3) * 100);

    pathContainer.innerHTML = `
        <div class="role-mapping-wrap">
            <div class="path-progress-bar">
                <div class="path-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="path-progress-label">ROLE MAPPING — ROUND ${round + 1} OF 3</p>
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    ${round === 0 ? 'Three paths emerged from your signal. Which feels closest to your real direction?' : ''}
                    ${round === 1 ? 'Confirmed. Now — which of these roles do you see yourself in?' : ''}
                    ${round === 2 ? 'One more. Pick the specialisation that fits.' : ''}
                </p>
            </div>
            <div class="role-card-stack" id="role-card-stack">
                ${paths.map((p, i) => `
                    <button class="role-card" data-path-index="${i}">
                        <span class="role-card-name">${p.path_name || `PATH ${i + 1}`}</span>
                        <p class="role-card-narrative">${p.narrative || ''}</p>
                        <div class="role-card-roles">
                            ${(p.target_roles || []).map(r => `<span class="role-tag">${r}</span>`).join('')}
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.querySelectorAll('.role-card').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            const picked = paths[parseInt(btn.dataset.pathIndex, 10)];

            if (round === 0) pathState.confirmedPath = picked;
            if (round === 1) pathState.confirmedRole = (picked.target_roles || [])[0] || picked.path_name;
            if (round === 2) pathState.confirmedSpec  = picked.path_name;

            if (isLast) {
                runAspirationProbe();
            } else {
                runRoleMapping(round + 1);
            }
        });
    });
}

// ─── SHARED FLOW: ASPIRATION PROBE ───────────────────────────
// One question that outputs structured goal object.
// Career goal and Life goal defined separately.

function runAspirationProbe() {
    showScreen('screen-path-select');
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
            <button class="btn btn--primary" id="aspiration-submit">[ CONFIRM SIGNAL ]</button>
        </div>
    `;

    document.getElementById('aspiration-submit').addEventListener('click', () => {
        playUIClick();
        const careerGoal = document.getElementById('aspiration-career').value.trim();
        const lifeGoal   = document.getElementById('aspiration-life').value.trim();

        pathState.aspirationGoal = {
            careerGoal,
            lifeGoal,
            domain:     pathState.confirmedPath ? pathState.confirmedPath.path_name : '',
            targetRole: pathState.confirmedRole || '',
            timeline:   null  // surfaced in PATH tab later, not captured here
        };

        runPathSynthesis();
    });
}

// ─── SHARED FLOW: SYNTHESIS AND GAP ANALYSIS ─────────────────
// Combines all PATH data into a structured output.
// Seeds stat bonuses on top of scan seeds.
// Fires onComplete with full pathData object.

function runPathSynthesis() {
    showScreen('screen-path-loading');
    renderPathLoading('SYNTHESIS — BUILDING YOUR OPERATIVE PROFILE');

    setTimeout(() => {
        // Derive stat seeds from PATH inference
        // [TUNING TARGET] PATH stat seeding weights per confirmed path
        const statSeedMap = {
            'Strategy & Knowledge':    { intelligence: 6, agility: 4 },
            'Execution & Delivery':    { strength: 6, endurance: 4 },
            'Adaptation & Innovation': { agility: 6, intelligence: 4 },
            'Consistency & Systems':   { endurance: 6, strength: 4 },
            'Influence & Community':   { charisma: 8 }
        };

        const pathName = pathState.confirmedPath ? pathState.confirmedPath.path_name : '';
        pathState.statSeeds = statSeedMap[pathName]
            || { intelligence: 3, agility: 3, strength: 2, endurance: 2, charisma: 2 };

        pathState.gapAnalysis = {
            primaryGap: 'Gap analysis — Gemini phase',
            skills:     pathState.confirmedPath ? (pathState.confirmedPath.mapped_skills || []) : []
        };

        const pathData = {
            track:              pathState.track,
            confirmedPath:      pathState.confirmedPath,
            confirmedRole:      pathState.confirmedRole,
            confirmedSpec:      pathState.confirmedSpec,
            aspirationGoal:     pathState.aspirationGoal,
            gapAnalysis:        pathState.gapAnalysis,
            statSeeds:          pathState.statSeeds,
            inference:          pathState.inference
        };

        if (typeof pathState.onComplete === 'function') {
            pathState.onComplete(pathData);
        }
    }, 2000);
}

// ─── LOADING SCREEN RENDERER ──────────────────────────────────
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

    // Animate the loading bar
    let pct = 0;
    const fill = document.getElementById('path-loading-fill');
    const iv = setInterval(() => {
        pct = Math.min(92, pct + Math.random() * 8);
        if (fill) fill.style.width = `${pct}%`;
        if (pct >= 92) clearInterval(iv);
    }, 180);
}

// ─── PATH DATA SAVE/LOAD ──────────────────────────────────────
const PATH_DATA_KEY = 'syd_path_data';

function savePathData(pathData) {
    try {
        localStorage.setItem(PATH_DATA_KEY, JSON.stringify(pathData));
    } catch(e) {
        console.warn('[SYD] Could not save PATH data:', e);
    }
}

function loadPathData() {
    try {
        const raw = localStorage.getItem(PATH_DATA_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) {
        return null;
    }
}
