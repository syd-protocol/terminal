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
const JOB_OPS_PROFILE_KEY      = 'syd_job_ops_profile';
const JOB_OPS_MARKET_KEY       = 'syd_job_ops_market';
const JOB_OPS_INTENT_KEY       = 'syd_job_intent';

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
            <button class="path-back-btn" id="path-select-back">← BACK</button>
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
    document.getElementById('path-select-back').addEventListener('click', () => {
        if (typeof onboardingBack === 'function') onboardingBack('track-select');
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

// ─── CALL 2 FAILURE SCREEN ───────────────────────────────────
// Shown when Call 2 fails or returns unparseable JSON.
// Gives the operative a plain-English reason and two options:
//   Retry  — reruns fireCall2Bundle() from scratch
//   Continue locally — returns the local fallback bundle immediately
// Returns a Promise that resolves to a bundle either way.

function showCall2FailureScreen(rawError, isQuota) {
    return new Promise(resolve => {
        showScreen('screen-path-loading');
        const container = document.getElementById('path-loading-content');
        if (!container) { resolve(getLocalFallbackBundle()); return; }

        let reason = 'Something went wrong reading the AI response.';
        if (isQuota) {
            reason = 'The Gemini API rate limit was hit — too many requests in a short window. Wait a minute before retrying.';
        } else if (rawError && rawError.includes('API key')) {
            reason = 'Your Neural Link key was rejected. Check it is correct in the Neural screen.';
        } else if (rawError && rawError.includes('Network')) {
            reason = 'A network error occurred. Check your connection.';
        } else if (rawError && rawError.toLowerCase().includes('could not be read')) {
            reason = 'The AI returned a response but it could not be parsed. This sometimes happens with very long CVs — try again.';
        }

        container.innerHTML = `
            <div class="call-failure-wrap">
                <p class="call-failure-label">[ SIGNAL INTERRUPTED ]</p>
                <p class="call-failure-reason">${reason}</p>
                <div class="call-failure-actions">
                    <button class="btn btn--primary" id="cf-retry-btn">[ RETRY WITH AI ]</button>
                    <button class="call-failure-local-btn" id="cf-local-btn">continue without AI →</button>
                </div>
            </div>
        `;

        document.getElementById('cf-retry-btn').addEventListener('click', () => {
            playUIClick();
            showScreen('screen-path-loading');
            renderPathLoading('ANALYSING YOUR SIGNAL — STANDING BY');
            fireCall2Bundle().then(resolve);
        });

        document.getElementById('cf-local-btn').addEventListener('click', () => {
            playUIClick();
            resolve(getLocalFallbackBundle());
        });
    });
}

// ─── CV SIGNAL EXTRACTOR ─────────────────────────────────────
// Runs locally on the raw CV or re-imaginer responses.
// Extracts structured signals used two ways:
//   1. Replaces full CV in the Gemini prompt (smaller, cleaner input)
//   2. Feeds the local fallback path picker (makes local useful)
//
// Returns a CVSignal object — see shape below.

function extractCVSignals(cvText) {
    if (!cvText || cvText.length < 50) {
        return {
            seniorityTier: 'ic', yearsTotal: 0, avgTenureYears: 0,
            domainPrimary: 'general', domainSecondary: null,
            evidenceLines: [], leadershipEvidence: false,
            founderEvidence: false, technicalEvidence: false,
            educationLevel: 'none', rawLength: 0
        };
    }

    const lower = cvText.toLowerCase();
    const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Evidence lines: bullets with quantified outcomes ─────
    const evidenceLines = lines.filter(l => {
        const isBullet = l.startsWith('*') || l.startsWith('-') || l.startsWith('•');
        const hasSignal = /\d|%|\$|USD|GBP|NGN|partnership|launched|built|grew|secured|led|designed|closed|reduced|increased|founded|created|managed|negotiated|delivered|deployed|raised|generated|saved|hired|trained|scaled/i.test(l);
        return isBullet && hasSignal;
    }).slice(0, 8);

    // ── Years and tenure ─────────────────────────────────────
    const yearMatches = cvText.match(/\b(20\d\d|19\d\d)\b/g) || [];
    const years = yearMatches.map(Number).filter(y => y >= 1990 && y <= new Date().getFullYear());
    const yearsTotal = years.length >= 2
        ? Math.max(...years) - Math.min(...years)
        : 0;

    // Average tenure: count role headings and divide span
    const roleHeadings = lines.filter(l => /^#{1,4}/.test(l) && l.length > 8).length;
    const avgTenureYears = roleHeadings > 0 && yearsTotal > 0
        ? parseFloat((yearsTotal / roleHeadings).toFixed(1))
        : 0;

    // ── Domain detection ─────────────────────────────────────
    const DOMAIN_SIGNALS = {
        community:   ['community', 'forum', 'discourse', 'engagement', 'members', 'moderat', 'ecosystem', 'community manager', 'community lead', 'community advocate', 'user group', 'online community'],
        product:     ['product manager', 'product management', 'product lead', 'product owner', 'roadmap', 'user story', 'backlog', 'sprint', 'mvp', 'product strategy', 'product development', 'product design'],
        engineering: ['engineer', 'developer', 'software', 'backend', 'frontend', 'full stack', 'fullstack', 'devops', 'coding', 'programming', 'infrastructure', 'web development', 'mobile development', 'codebase', 'deployment'],
        design:      ['user experience', 'user interface', 'ux design', 'ui design', 'figma', 'sketch', 'wireframe', 'prototype', 'design system', 'visual design', 'interaction design', 'product design', 'graphic design', 'brand design'],
        finance:     ['finance', 'financial', 'accounting', 'accountant', 'audit', 'tax', 'treasury', 'budgeting', 'p&l', 'profit and loss', 'revenue reporting', 'forecasting', 'investment', 'banking', 'financial analysis', 'cost management'],
        hr:          ['human resources', 'people operations', 'talent acquisition', 'recruitment', 'recruiter', 'hiring', 'onboarding', 'performance management', 'employee relations', 'compensation', 'hr manager', 'hr business partner', 'people manager', 'workforce planning'],
        operations:  ['operations', 'logistics', 'supply chain', 'procurement', 'process improvement', 'lean', 'six sigma', 'facilities management', 'vendor management', 'operational efficiency', 'business operations', 'ops manager'],
        learning:    ['learning and development', 'training', 'curriculum', 'instructional design', 'education', 'teaching', 'facilitation', 'talent development', 'l&d', 'capacity building', 'e-learning', 'learning program', 'upskilling', 'workshop design'],
        sales:       ['sales', 'account executive', 'account manager', 'business development', 'revenue target', 'quota', 'pipeline', 'client acquisition', 'closing deals', 'crm', 'b2b sales', 'enterprise sales', 'sales manager', 'commercial'],
        marketing:   ['marketing', 'seo', 'sem', 'content strategy', 'brand manager', 'campaign', 'social media', 'demand generation', 'copywriting', 'growth marketing', 'digital marketing', 'performance marketing', 'brand strategy', 'communications'],
        data:        ['data analyst', 'data scientist', 'data engineer', 'analytics', 'sql', 'tableau', 'power bi', 'machine learning', 'python', 'statistics', 'data analysis', 'data insights', 'business intelligence', 'reporting analyst'],
        legal:       ['legal', 'lawyer', 'attorney', 'solicitor', 'legal counsel', 'compliance', 'contract management', 'litigation', 'regulatory', 'intellectual property', 'corporate law', 'legal advisor', 'paralegal'],
        health:      ['healthcare', 'clinical', 'medical', 'nursing', 'hospital', 'patient care', 'pharmaceutical', 'public health', 'health system', 'doctor', 'physician', 'health program', 'health coordinator', 'global health']
    };

    const domainScores = {};
    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
        // Count distinct signal matches, not total occurrences — prevents
        // a CV that mentions "community" 10 times from scoring unfairly high
        domainScores[domain] = signals.filter(s => lower.includes(s)).length;
    }
    const sortedDomains = Object.entries(domainScores)
        .sort((a, b) => b[1] - a[1])
        .filter(([, score]) => score > 0);

    const domainPrimary   = sortedDomains[0]  ? sortedDomains[0][0]  : 'general';
    const domainSecondary = sortedDomains[1]  ? sortedDomains[1][0]  : null;

    // ── Seniority tier ───────────────────────────────────────
    const hasDirector  = /\bdirector\b|\bvp\b|\bvice president\b|\bhead of\b|\bchief\b|\bcxo\b|\bceo\b|\bcto\b|\bcoo\b|\bcmo\b/i.test(cvText);
    const hasManager   = /\bmanager\b|\bsenior manager\b|\blead\b|\bteam lead\b|\bprinciple\b/i.test(cvText);
    const hasSeniorIC  = /\bsenior\b|\bstaff\b|\bprincipal\b|\bspecialist\b|\bconsultant\b|\barchitect\b/i.test(cvText);
    const hasFounder   = /\bfounder\b|\bco-founder\b|\bco founder\b/i.test(cvText);
    const hasTeam      = /\bteam of\b|\bdirect report|\bmanag\w+ a team|\bmanag\w+ \d+ people|\bmanag\w+ \d+ staff/i.test(cvText);

    let seniorityTier = 'ic';
    // Title evidence takes priority — someone can reach Director in 4 years.
    // Years are a floor check, not the primary signal.
    if (hasDirector && (yearsTotal >= 5 || hasTeam))                  seniorityTier = 'director';
    else if (hasFounder && yearsTotal >= 4)                           seniorityTier = 'director';
    else if (hasFounder && yearsTotal >= 2)                           seniorityTier = 'manager';
    else if (hasManager && hasTeam && yearsTotal >= 4)                seniorityTier = 'senior_manager';
    else if (hasManager && yearsTotal >= 2)                           seniorityTier = 'manager';
    else if (hasSeniorIC && yearsTotal >= 1)                          seniorityTier = 'senior_ic';
    else if (yearsTotal >= 1)                                         seniorityTier = 'ic';

    // ── Other signals ────────────────────────────────────────
    const leadershipEvidence = hasManager || hasDirector || hasFounder || hasTeam;
    const founderEvidence    = hasFounder;
    const technicalEvidence  = domainScores.engineering > 0 || domainScores.data > 0
        || /\bjavascript\b|\bpython\b|\breact\b|\bnode\b|\bsql\b|\bgit\b|\baws\b|\bapi\b/i.test(cvText);
    const educationLevel     = /\bphd\b|\bdoctorate\b|\bmaster\b|\bmba\b/i.test(cvText) ? 'postgrad'
        : /\bbachelor\b|\bb\.sc\b|\bb\.a\b|\bdegree\b|\buniversity\b/i.test(cvText) ? 'degree'
        : /\bcertif|\bdiploma\b/i.test(cvText) ? 'cert'
        : 'none';

    return {
        seniorityTier,
        yearsTotal,
        avgTenureYears,
        domainPrimary,
        domainSecondary,
        evidenceLines,
        leadershipEvidence,
        founderEvidence,
        technicalEvidence,
        educationLevel,
        rawLength: cvText.length
    };
}

// ─── RE-IMAGINER SIGNAL EXTRACTOR ───────────────────────────
// Classifies four short-form Re-imaginer answers into domain and stat signals.
// Less precise than CV extraction — no dates, no titles — but gives a
// meaningful starting point for the local fallback path picker.

function extractReImaginerSignals(responses) {
    const text  = (Array.isArray(responses) ? responses.join(' ') : responses || '').toLowerCase();

    // Reuse domain signals from CV extractor but with looser single-word matches
    // that work for short conversational answers
    const REIMAGINER_DOMAIN_SIGNALS = {
        community:   ['community', 'people', 'group', 'network', 'connect', 'bring together', 'organis', 'facilitat', 'moderate', 'engage', 'platform'],
        product:     ['product', 'build', 'feature', 'roadmap', 'user', 'problem', 'solution', 'design thinking', 'prototype', 'test'],
        engineering: ['code', 'program', 'develop', 'build apps', 'software', 'script', 'automat', 'debug', 'deploy', 'technical'],
        design:      ['design', 'visual', 'interface', 'layout', 'creative', 'aesthetic', 'figma', 'illustration', 'branding', 'logo'],
        finance:     ['money', 'budget', 'finance', 'invest', 'accounting', 'numbers', 'financial', 'cost', 'revenue', 'profit', 'economics'],
        hr:          ['hiring', 'people', 'talent', 'recruit', 'culture', 'team building', 'performance', 'onboard', 'manage people'],
        operations:  ['process', 'systems', 'efficiency', 'workflow', 'logistics', 'operations', 'coordinate', 'streamline', 'organise'],
        learning:    ['teach', 'train', 'explain', 'mentor', 'coach', 'curriculum', 'learning', 'education', 'workshop', 'facilitate', 'skill', 'knowledge'],
        sales:       ['sell', 'pitch', 'negotiate', 'close', 'client', 'persuade', 'revenue', 'business development', 'partnership', 'deal'],
        marketing:   ['marketing', 'content', 'brand', 'audience', 'social media', 'write', 'communicate', 'storytell', 'campaign', 'messaging'],
        data:        ['data', 'analytics', 'insight', 'research', 'pattern', 'analyse', 'statistics', 'measure', 'metrics', 'evidence'],
        legal:       ['law', 'legal', 'compliance', 'contract', 'rights', 'regulation', 'policy', 'governance', 'risk'],
        health:      ['health', 'medical', 'care', 'clinical', 'wellness', 'patient', 'medicine', 'therapy', 'nursing', 'public health']
    };

    const domainScores = {};
    for (const [domain, signals] of Object.entries(REIMAGINER_DOMAIN_SIGNALS)) {
        domainScores[domain] = signals.filter(s => text.includes(s)).length;
    }
    const sortedDomains = Object.entries(domainScores)
        .sort((a, b) => b[1] - a[1])
        .filter(([, score]) => score > 0);

    return {
        seniorityTier:      'ic',   // Re-imaginer has no career history — always IC
        yearsTotal:         0,
        avgTenureYears:     0,
        domainPrimary:      sortedDomains[0] ? sortedDomains[0][0] : 'general',
        domainSecondary:    sortedDomains[1] ? sortedDomains[1][0] : null,
        evidenceLines:      [],
        leadershipEvidence: false,
        founderEvidence:    false,
        technicalEvidence:  /code|program|develop|build|technical|script|automat/i.test(text),
        educationLevel:     'none',
        rawLength:          text.length
    };
}

// Formats CVSignal into a compact structured string for Gemini
// Much smaller than the full CV, more reliable to reason about
function formatSignalForPrompt(signal, evidenceLines) {
    const tierLabels = {
        ic: 'Individual Contributor',
        senior_ic: 'Senior Individual Contributor',
        manager: 'Manager / Team Lead',
        senior_manager: 'Senior Manager',
        director: 'Director / Head of / VP'
    };
    return [
        `SENIORITY: ${tierLabels[signal.seniorityTier] || 'Individual Contributor'}`,
        `CAREER SPAN: ~${signal.yearsTotal} years`,
        `AVERAGE TENURE: ~${signal.avgTenureYears} years per role`,
        `PRIMARY DOMAIN: ${signal.domainPrimary}`,
        signal.domainSecondary ? `SECONDARY DOMAIN: ${signal.domainSecondary}` : null,
        `LEADERSHIP EVIDENCE: ${signal.leadershipEvidence ? 'yes' : 'no'}`,
        `FOUNDER EVIDENCE: ${signal.founderEvidence ? 'yes' : 'no'}`,
        `TECHNICAL EVIDENCE: ${signal.technicalEvidence ? 'yes' : 'no'}`,
        `EDUCATION: ${signal.educationLevel}`,
        '',
        'TOP EVIDENCE LINES (quantified outcomes from record):',
        ...(evidenceLines.length > 0 ? evidenceLines : ['— no quantified evidence detected']),
    ].filter(l => l !== null).join('\n');
}

// Maps seniorityTier from extractCVSignals() to a rank letter for prompt calibration.
// Used inside fireCall2Bundle() before the Gemini call — confirmedRank is not yet
// set at this point in the flow (it is set after role mapping).
function estimateRankFromSeniority(seniorityTier) {
    const map = {
        ic:             'F',
        senior_ic:      'D',
        manager:        'C',
        senior_manager: 'C',
        director:       'B'
    };
    return map[seniorityTier] || 'F';
}

async function fireCall2Bundle() {
    if (!hasNeuralLink()) {
        return getLocalFallbackBundle();
    }

    const rawInput  = pathState.cvText || pathState.reimagineResponses.join('\n\n');
    const isCV      = pathState.track === 'chronicler';
    const cvSignal  = isCV ? extractCVSignals(rawInput) : null;
    const inputText = isCV
        ? formatSignalForPrompt(cvSignal, cvSignal.evidenceLines)
        : rawInput;
    const operativeName = (function() {
        try {
            const p = JSON.parse(localStorage.getItem('syd_player') || '{}');
            const full = (p.name || '').trim();
            return full ? full.split(' ')[0] : 'the operative';
        } catch(_) { return 'the operative'; }
    })();
    const traits       = pathState._scanTraits || {};
    const traitSummary = Object.entries(traits).map(([k, v]) => `${k}: ${v}`).join(', ') || 'not available';

    // Derive estimated rank and re-imaginer context before building the prompt
    const estimatedRank = isCV && cvSignal
        ? estimateRankFromSeniority(cvSignal.seniorityTier)
        : 'F';

    const seniorityLabels = {
        ic:             'Individual Contributor',
        senior_ic:      'Senior Individual Contributor',
        manager:        'Manager / Team Lead',
        senior_manager: 'Senior Manager',
        director:       'Director / Head of / VP'
    };
    const seniorityLabel = isCV && cvSignal
        ? (seniorityLabels[cvSignal.seniorityTier] || 'Individual Contributor')
        : 'Entry Level (Re-imaginer)';

    const rankCalibrationBlock = isCV ? `
ESTIMATED STARTING RANK: ${estimatedRank}
SENIORITY CONTEXT: ${seniorityLabel}

Directive calibration by rank — apply strictly:
- F rank: build foundational capabilities. First-time execution. Ship tangible artefacts. Assume the operative has never done this professionally.
- D rank: improve deliberate execution. Consistency, speed, cross-functional communication. The operative can do the basics — make them reliable.
- C rank: expand influence. Stakeholder impact, driving decisions, managing complexity. The operative is competent — make them consequential.
- B/A rank: build leverage. Enabling others, designing systems, operating at strategic level. The operative is recognised — make them a force multiplier.
` : `
OPERATIVE TYPE: Career Re-imaginer. No professional record in the target domain.
STARTING RANK: F — directives must assume zero domain experience.
TRANSFERABLE SIGNALS (from self-assessment responses):
${pathState.reimagineResponses.filter(Boolean).join('\n')}

Directive calibration for Re-imaginer:
Directives must build real, demonstrable artefacts from scratch — not study tasks or reading lists. Outputs that exist in the world and can be shown to someone. The operative has strong transferable skills from outside the domain — reference patterns from their responses where visible in the output. The first directive should be completable within 48 hours with no domain experience required.
`;

    // [RESEARCH] Source: SYD Respec v2 — Call 2 prompt spec.
    // Finding: one large prompt with explicit JSON schema prevents Gemini
    //          from producing partial responses across multiple calls.
    // Applied: full schema inline, all fields required, STRICT JSON only.
    const prompt = `
You are SYD — an elite career intelligence system. The operative's name is ${operativeName}. You may address them by first name in synthesis_syd_lines and orientation_closing_line only. Do NOT use their name in narrative fields — refer to the record, not the person. Do not invent or assume any name not explicitly provided in this prompt. Your job is NOT to summarise what the operative already knows about themselves. Your job is to read beneath the surface and identify the patterns they cannot see from inside their own record.

OPERATIVE SCAN TRAITS (psychometric game scores, 0.0–1.0):
${traitSummary}

${rankCalibrationBlock}
ANALYSIS RULES — follow these strictly:
1. The three paths must be DISTINCT in type, not variations of the same theme. If two paths feel similar, you have not dug deep enough.
2. path_name must be a real, recognisable job title that exists on job boards — enough to represent a direction, grounded enough to be searchable. Examples: "Learning & Development Manager", "Systems Architect", "Program Manager". Do NOT invent compound titles or use words like "Ecosystem", "Synthesizer", "Facilitator", "Orchestrator", or "Strategist" as standalone labels.
3. narrative must cite SPECIFIC evidence (a named project, a number, a dated event) and connect it to a non-obvious pattern. Never restate the operative's own job title or bio language. Do not use the operative's name — refer only to the record and its patterns.
4. gap_skills must be things genuinely absent from the record — not polish on existing skills.
5. hidden_affinity_stat must reflect the scan traits AND the record pattern — not just the highest stat.
6. gap_analysis_prose must be honest and specific. Name the actual gap. Do not soften it.
7. synthesis_syd_lines must sound like intelligence analysis, not LinkedIn endorsements.
8. career_skill_tracks must be named after what the operative actually does, not generic skill categories.
9. initial_career_directives must be REAL actions with REAL professional consequences — not study tasks or research exercises.
10. current_role_match and target_roles must contain ONLY the role name — no seniority prefix of any kind. Do not use Senior, Junior, Associate, Head of, Lead, Director, VP, Chief, or Principal. The role name alone is correct: "Community Manager" not "Senior Community Manager", "Data Analyst" not "Head of Data". Seniority is communicated separately through the operative's rank — it must not appear in role titles.
11. current_role_match must be a role the operative could send a CV to tomorrow and be a plausible applicant based on their actual record. If uncertain, default to the more junior version of the role. target_roles must be real job titles that appear on job boards today — reachable within 2–4 years of deliberate work. No invented, compound, or fantasy titles in target_roles.

Your output will seed multiple downstream systems. Every field is required. Do not omit any.

Output ONLY valid JSON. No markdown fences. No preamble. No explanation outside the JSON.
CRITICAL: Every object in the paths array must be properly closed with } before the next object begins. Validate your bracket depth before outputting each path object.

Required JSON shape:
{
  "paths": [
    {
      "path_name": "Strategic name for this career path — a direction archetype, not a job title",
      "current_role_match": "The single most accurate real-world job title the operative could apply for TODAY based on their existing record. Hireable. Specific. Not aspirational.",
      "narrative": "2–3 sentences referencing specific evidence from their record. Be specific.",
      "target_roles": ["Role 1", "Role 2", "Role 3"],
      "mapped_skills": ["Skill 1", "Skill 2", "Skill 3"],
      "stat_seeds": { "intelligence": 6, "agility": 4 },
      "gap_skills": ["Gap skill 1", "Gap skill 2", "Gap skill 3"]
    },
    {
      "path_name": "...",
      "current_role_match": "...",
      "narrative": "...",
      "target_roles": [],
      "mapped_skills": [],
      "stat_seeds": {},
      "gap_skills": []
    },
    {
      "path_name": "...",
      "current_role_match": "...",
      "narrative": "...",
      "target_roles": [],
      "mapped_skills": [],
      "stat_seeds": {},
      "gap_skills": []
    }
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

${isCV ? 'STRUCTURED CAREER SIGNALS (extracted from CV)' : 'SELF-ASSESSMENT RESPONSES'}:
${inputText}
`.trim();

    const result = await geminiGenerateLarge(prompt, 0.3);

    if (!result.ok) {
        console.warn('[SYD] Call 2 failed — offering retry.');
        return await showCall2FailureScreen(result.error, result.quota);
    }

    const parsed = extractJSON(result.text);
    if (!parsed || !Array.isArray(parsed.paths) || parsed.paths.length < 2) {
        console.warn('[SYD] Call 2 JSON parse failed — offering retry.');
        return await showCall2FailureScreen('Response arrived but could not be read.', false);
    }

    // Store hidden affinity stat so synthesis can reference it
    pathState._geminiHiddenAffinityStat = parsed.hidden_affinity_stat || null;

    return { ...parsed, geminiEnhanced: true };
}

// ─── CALL 2B: SIGNAL TRANSLATION KIT ────────────────────────
// Fires silently after applyCall2Bundle() once the operative has
// confirmed their path and role. Uses the confirmed context that
// Call 2 did not have. Produces CV bullet reframes for the
// current_role_match and the top target role.
//
// Output stored under 'syd_signal_translation'.
// Shape: { current_role, target_role, current_bullets[], target_bullets[], geminiEnhanced }
//
// Fires from runPathSynthesis() after pathData is assembled.
// Does NOT block the onboarding flow — fires and stores silently.

const SIGNAL_TRANSLATION_KEY = 'syd_signal_translation';

async function fireCall2B(pathData) {
    if (!hasNeuralLink() || !pathData) return;

    const confirmedPath  = pathData.confirmedPath || {};
    const currentRole    = confirmedPath.current_role_match || pathData.confirmedRole || 'their confirmed role';
    const targetRole     = (confirmedPath.target_roles || [])[0] || confirmedPath.path_name || 'their target path';
    const operativeName  = (function() {
        try {
            const p = JSON.parse(localStorage.getItem('syd_player') || '{}');
            const full = (p.name || '').trim();
            return full ? full.split(' ')[0] : 'the operative';
        } catch(_) { return 'the operative'; }
    })();

    // Use stripped CV or reimaginer responses — same as Call 2
    const rawInput  = pathState.cvText || pathState.reimagineResponses.join('\n\n');
    const inputText = pathState.track === 'chronicler'
        ? formatSignalForPrompt(extractCVSignals(rawInput), extractCVSignals(rawInput).evidenceLines)
        : rawInput;

    const prompt = `
You are SYD — a career intelligence system. Your task is to produce a Signal Translation Kit for operative ${operativeName}.

You have already analysed their record. Now you must reframe their existing experience in the language of two specific roles — the role they could apply for TODAY, and the role their pattern is pointing toward.

CONFIRMED CURRENT ROLE MATCH: ${currentRole}
CONFIRMED TARGET ROLE DIRECTION: ${targetRole}
CONFIRMED PATH: ${confirmedPath.path_name || 'not specified'}

RULES:
1. Do not invent experience. Reframe only what exists in the record.
2. current_bullets: reframe the 4 strongest evidence points from their record in the language, framing, and register of a ${currentRole} at a mid-to-senior level. Active verbs. Outcome-oriented. No fluff.
3. target_bullets: reframe the same evidence points in the language of a ${targetRole}. Elevated framing. Show the strategic pattern, not just the task.
4. headline_current: a one-line professional headline for their CV as a ${currentRole}.
5. headline_target: a one-line professional headline for their CV as a ${targetRole}.
6. gap_note: one honest sentence naming what is genuinely missing from their record to make the target role claim airtight. Specific. No softening.

Output ONLY valid JSON. No markdown fences. No preamble.

{
  "current_role": "${currentRole}",
  "target_role": "${targetRole}",
  "headline_current": "...",
  "headline_target": "...",
  "current_bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "target_bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "gap_note": "..."
}

OPERATIVE RECORD:
${inputText}
`.trim();

    const result = await geminiGenerateLarge(prompt);
    if (!result.ok) return;

    const parsed = extractJSON(result.text);
    if (!parsed || !Array.isArray(parsed.current_bullets)) return;

    try {
        localStorage.setItem(SIGNAL_TRANSLATION_KEY, JSON.stringify({
            ...parsed, geminiEnhanced: true
        }));
        console.log('[SYD] Call 2B — Signal Translation Kit stored.');
    } catch(e) { /* non-critical */ }
}

function loadSignalTranslation() {
    try {
        const raw = localStorage.getItem(SIGNAL_TRANSLATION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

// ─── SIGNAL TRANSLATION SCREEN ──────────────────────────────
// Shown once during onboarding (after synthesis reveal).
// Also accessible from OPS via renderSignalTranslationOPS().
// Renders whatever is in SIGNAL_TRANSLATION_KEY — if Call 2B
// hasn't landed yet it shows a waiting state and polls.

function renderSignalTranslationScreen(onDone) {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) { if (onDone) onDone(); return; }

    function renderKit(kit) {
        const operativeName = (function() {
            try {
                const p = JSON.parse(localStorage.getItem('syd_player') || '{}');
                const full = (p.name || '').trim();
                return full ? full.split(' ')[0] : null;
            } catch(_) { return null; }
        })();
        const nameAddr = operativeName ? `${operativeName} — ` : '';

        container.innerHTML = `
            <div class="signal-translation-wrap">

                <div class="st-syd-intro">
                    <p class="st-syd-line">${nameAddr}your record already has the evidence for roles you have not been applying to.</p>
                    <p class="st-syd-line">Below are two versions of what you have built — one framed for a role you can apply for right now, one framed for where your pattern is pointing.</p>
                    <p class="st-syd-line">These are ready to paste into your CV or LinkedIn summary. Copy the version that fits where you are going.</p>
                </div>

                <div class="st-role-block">
                    <div class="st-role-section">
                        <div class="st-role-section-header">
                            <div>
                                <p class="st-role-tag">APPLY FOR THIS NOW</p>
                                <p class="st-role-name">${kit.current_role || 'Current Match'}</p>
                                ${kit.headline_current ? `<p class="st-headline">${kit.headline_current}</p>` : ''}
                            </div>
                            <button class="st-copy-btn st-copy-btn--inline" id="st-copy-now-btn">[ COPY ]</button>
                        </div>
                        <ul class="st-bullets">
                            ${(kit.current_bullets || []).map(b => `<li class="st-bullet">${b}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="st-role-section st-role-section--target">
                        <div class="st-role-section-header">
                            <div>
                                <p class="st-role-tag">WHERE YOUR PATTERN LEADS</p>
                                <p class="st-role-name">${kit.target_role || 'Target Direction'}</p>
                                ${kit.headline_target ? `<p class="st-headline">${kit.headline_target}</p>` : ''}
                            </div>
                            <button class="st-copy-btn st-copy-btn--inline" id="st-copy-target-btn">[ COPY ]</button>
                        </div>
                        <ul class="st-bullets">
                            ${(kit.target_bullets || []).map(b => `<li class="st-bullet">${b}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                ${kit.gap_note ? `
                    <div class="st-gap-block">
                        <p class="st-gap-label">[ WHAT IS STILL MISSING ]</p>
                        <p class="st-gap-note">${kit.gap_note}</p>
                        <p class="st-gap-sub">Your directives will target this directly.</p>
                    </div>
                ` : ''}

                <p class="st-persist-note">[ This is saved. You can return to it from your OPS dashboard after you complete setup. ]</p>

                ${onDone ? `<button class="btn btn--primary st-continue-main" id="st-continue-btn">[ BEGIN PROTOCOL ]</button>` : ''}
            </div>
        `;

        // Copy handlers — copy headline + bullets as plain text for CV paste
        document.getElementById('st-copy-now-btn').addEventListener('click', () => {
            playUIClick();
            const text = (kit.headline_current ? kit.headline_current + '\n\n' : '')
                + (kit.current_bullets || []).map(b => '• ' + b).join('\n');
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('st-copy-now-btn');
                if (btn) { btn.textContent = '✓ COPIED — READY TO PASTE'; setTimeout(() => { btn.textContent = '[ COPY ]'; }, 2500); }
            }).catch(() => {});
        });

        document.getElementById('st-copy-target-btn').addEventListener('click', () => {
            playUIClick();
            const text = (kit.headline_target ? kit.headline_target + '\n\n' : '')
                + (kit.target_bullets || []).map(b => '• ' + b).join('\n');
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('st-copy-target-btn');
                if (btn) { btn.textContent = '✓ COPIED — READY TO PASTE'; setTimeout(() => { btn.textContent = '[ COPY ]'; }, 2500); }
            }).catch(() => {});
        });

        if (onDone) {
            document.getElementById('st-continue-btn').addEventListener('click', () => {
                playUIClick();
                onDone();
            });
        }
    }

    function renderWaiting() {
        container.innerHTML = `
            <div class="signal-translation-wrap signal-translation-wrap--loading">
                <p class="st-label">[ SIGNAL TRANSLATION ]</p>
                <p class="st-loading-line">Translating your record into role-ready language...</p>
                <div class="st-loading-bar"><div class="st-loading-fill" id="st-loading-fill"></div></div>
                ${onDone ? `<button class="st-skip-small" id="st-skip-btn">skip for now →</button>` : ''}
            </div>
        `;
        // Animate the loading bar
        let pct = 0;
        const fill = document.getElementById('st-loading-fill');
        const iv = setInterval(() => {
            pct = Math.min(88, pct + Math.random() * 7);
            if (fill) fill.style.width = pct + '%';
            if (pct >= 88) clearInterval(iv);
        }, 200);

        if (onDone) {
            document.getElementById('st-skip-btn').addEventListener('click', () => {
                playUIClick();
                onDone();
            });
        }
    }

    // Poll for kit — Call 2B fires async, may not have landed yet
    const kit = loadSignalTranslation();
    if (kit && kit.current_bullets) {
        renderKit(kit);
    } else {
        renderWaiting();
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            const fresh = loadSignalTranslation();
            if (fresh && fresh.current_bullets) {
                clearInterval(poll);
                renderKit(fresh);
            } else if (attempts >= 20) {
                // 20 * 500ms = 10 seconds — give up gracefully
                clearInterval(poll);
                container.innerHTML = `
                    <div class="signal-translation-wrap">
                        <p class="st-label">[ SIGNAL TRANSLATION ]</p>
                        <p class="st-loading-line">Translation is still processing. It will be available in OPS when ready.</p>
                        ${onDone ? `<button class="btn btn--primary" id="st-continue-btn">[ CONTINUE ]</button>` : ''}
                    </div>
                `;
                if (onDone) {
                    const btn = document.getElementById('st-continue-btn');
                    if (btn) btn.addEventListener('click', () => { playUIClick(); onDone(); });
                }
            }
        }, 500);
    }
}

// OPS-accessible version — no onDone callback, used from STATUS/OPS tab
function renderSignalTranslationOPS() {
    renderSignalTranslationScreen(null);
}

// ─── APPLY CALL 2 BUNDLE ─────────────────────────────────────
// Parses the full Call 2 response (or local fallback) and distributes
// all fields to their respective storage and pathState locations.
// Called once immediately after fireCall2Bundle() resolves.
function applyCall2Bundle(bundle) {
    if (!bundle) bundle = getLocalFallbackBundle();

    // If the local model cannot support this domain, show the honest message
    // and stop the flow here — do not present a fabricated path.
    if (bundle._unsupportedDomain) {
        _renderUnsupportedDomainScreen();
        return;
    }

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

// ─── UNSUPPORTED DOMAIN BUNDLE ───────────────────────────────
// Returned when the operative's domain does not match local coverage
// or when domain matches but evidence lines are too thin to be confident.
// Honest about the limitation — never fabricates a path.
function _getUnsupportedDomainBundle() {
    return {
        paths: [{
            path_name:         'UNCLASSIFIED',
            current_role_match: 'Unknown',
            narrative:         '',
            target_roles:      [],
            mapped_skills:     [],
            stat_seeds:        {},
            gap_skills:        []
        }],
        _unsupportedDomain: true,
        geminiEnhanced: false
    };
}

// ─── UNSUPPORTED DOMAIN SCREEN ───────────────────────────────
// Shown when local data cannot support the operative's domain.
// Honest, not apologetic. Gives a clear path forward.
function _renderUnsupportedDomainScreen() {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) return;

    container.innerHTML = `
        <div class="path-select">
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    My local data does not have enough coverage for your field to give you an accurate read.
                </p>
                <p class="path-voice-line path-voice-line--visible">
                    A generic path would be inaccurate. I will not do that.
                </p>
                <p class="path-voice-line path-voice-line--visible">
                    Connect a Neural Link key — the AI read handles any domain — then restart PATH.
                </p>
            </div>
            <div class="path-track-choices">
                <button class="path-track-btn" id="ud-neural-btn">
                    <span class="path-track-tag">RECOMMENDED</span>
                    <span class="path-track-label">Connect Neural Link</span>
                    <span class="path-track-sub">Takes 60 seconds. Unlocks an accurate read for any field.</span>
                </button>
                <button class="path-track-btn" id="ud-restart-btn">
                    <span class="path-track-label">Restart PATH</span>
                    <span class="path-track-sub">Try the Re-imaginer track instead — no CV required.</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('ud-neural-btn').addEventListener('click', () => {
        playUIClick();
        navTo('screen-neural');
    });
    document.getElementById('ud-restart-btn').addEventListener('click', () => {
        playUIClick();
        if (typeof renderPathSelect === 'function') renderPathSelect();
    });
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
            path_name:         'Execution and Delivery',
            current_role_match:'Project Manager',
            narrative:    'Your pattern shows strong delivery focus and a consistent bias toward getting things done rather than theorising about them.',
            target_roles: ['Operations Manager', 'Project Lead', 'Programme Director'],
            mapped_skills: ['Delivery', 'Operational Coordination', 'Physical Execution'],
            stat_seeds:   { strength: 6, endurance: 4 },
            gap_skills:   ['Strategic influence', 'Stakeholder communication', 'Systems thinking']
        },
        intelligence: {
            path_name:         'Strategy and Knowledge',
            current_role_match:'Product Manager',
            narrative:    'Your pattern shows strong analytical focus and a drive to understand the underlying system before acting on it.',
            target_roles: ['Strategy Lead', 'Product Manager', 'Research Lead'],
            mapped_skills: ['Analysis', 'Systems Thinking', 'Knowledge Architecture'],
            stat_seeds:   { intelligence: 6, agility: 4 },
            gap_skills:   ['Executive presence', 'Stakeholder influence', 'Commercial acumen']
        },
        agility:      {
            path_name:         'Adaptation and Innovation',
            current_role_match:'Product Designer',
            narrative:    'Your pattern shows strong pivot capacity and a comfort with ambiguity that most people avoid.',
            target_roles: ['Innovation Lead', 'Consultant', 'Product Designer'],
            mapped_skills: ['Adaptability', 'Problem Framing', 'Creative Pivots'],
            stat_seeds:   { agility: 6, intelligence: 4 },
            gap_skills:   ['Sustained execution', 'Process discipline', 'Long-horizon planning']
        },
        endurance:    {
            path_name:         'Consistency and Systems',
            current_role_match:'Operations Coordinator',
            narrative:    'Your pattern shows sustained effort and a systems-building orientation over long time horizons.',
            target_roles: ['Programme Manager', 'Operations Manager', 'Systems Manager'],
            mapped_skills: ['Sustained Effort', 'Process Design', 'Long-term Discipline'],
            stat_seeds:   { endurance: 6, strength: 4 },
            gap_skills:   ['Creative flexibility', 'Stakeholder influence', 'Rapid pivoting']
        },
        charisma:     {
            path_name:         'Influence and Community',
            current_role_match:'Community Manager',
            narrative:    'Your pattern shows strong social reading and a demonstrated capacity to move people and build trust.',
            target_roles: ['Community Lead', 'Business Development', 'Head of Growth'],
            mapped_skills: ['Relationship Building', 'Influence', 'Communication'],
            stat_seeds:   { charisma: 8 },
            gap_skills:   ['Analytical depth', 'Process discipline', 'Technical credibility']
        }
    };

    // Domain-aware override: if CV signals are extractable, use them
    // to pick more accurate paths than pure keyword stat matching
    const rawInput  = pathState.cvText || pathState.reimagineResponses.join(' ');
    const isCV      = pathState.track === 'chronicler';
    const cvSignal  = isCV
        ? extractCVSignals(rawInput)
        : extractReImaginerSignals(pathState.reimagineResponses || []);

    const DOMAIN_TO_PATHS = {
        community: {
            path_name:          'Community and Ecosystem Building',
            current_role_match: 'Community Manager',
            narrative:          'Your record shows a consistent pattern of building and activating communities — growing membership, driving engagement, and converting community presence into strategic value.',
            target_roles:       ['Community Strategy Manager', 'Ecosystem Development Manager', 'Community Programme Manager'],
            mapped_skills:      ['Community Strategy', 'Stakeholder Engagement', 'Program Management'],
            stat_seeds:         { charisma: 7, intelligence: 4 },
            gap_skills:         ['Data-driven community health measurement', 'Community monetisation strategy', 'Crisis communications at scale']
        },
        product: {
            path_name:          'Product and Growth',
            current_role_match: 'Product Manager',
            narrative:          'Your record shows experience across product ideation, development and stakeholder management — with a pattern of translating user needs into product decisions.',
            target_roles:       ['Senior Product Manager', 'Group Product Manager', 'Head of Product'],
            mapped_skills:      ['Product Strategy', 'Roadmap Management', 'Stakeholder Alignment'],
            stat_seeds:         { intelligence: 7, agility: 4 },
            gap_skills:         ['Quantitative product analytics', 'Technical architecture fluency', 'P&L ownership']
        },
        engineering: {
            path_name:          'Engineering and Technical Delivery',
            current_role_match: 'Software Engineer',
            narrative:          'Your record demonstrates technical building capacity — writing, shipping, and maintaining software with clear delivery focus.',
            target_roles:       ['Senior Software Engineer', 'Tech Lead', 'Engineering Manager'],
            mapped_skills:      ['Technical Problem Solving', 'Code Quality', 'System Design'],
            stat_seeds:         { intelligence: 7, strength: 4 },
            gap_skills:         ['System architecture at scale', 'Cross-team technical leadership', 'Technical roadmap planning']
        },
        design: {
            path_name:          'Experience and Design',
            current_role_match: 'UX Designer',
            narrative:          'Your record shows experience translating user problems into designed solutions — research, wireframing, testing, and iteration.',
            target_roles:       ['Senior UX Designer', 'Product Designer', 'Design Lead'],
            mapped_skills:      ['User Research', 'Interaction Design', 'Design Systems'],
            stat_seeds:         { intelligence: 6, agility: 5 },
            gap_skills:         ['Design leadership and team management', 'Design strategy at org level', 'Quantitative usability measurement']
        },
        finance: {
            path_name:          'Finance and Commercial Analysis',
            current_role_match: 'Financial Analyst',
            narrative:          'Your record demonstrates financial analysis, reporting, and commercial decision support — with a pattern of translating numbers into business insights.',
            target_roles:       ['Senior Financial Analyst', 'Finance Manager', 'Finance Business Partner'],
            mapped_skills:      ['Financial Modelling', 'Budget Management', 'Commercial Analysis'],
            stat_seeds:         { intelligence: 7, endurance: 4 },
            gap_skills:         ['Executive-level financial storytelling', 'Treasury and cash flow management', 'M&A due diligence experience']
        },
        hr: {
            path_name:          'People and Talent Operations',
            current_role_match: 'HR Business Partner',
            narrative:          'Your record shows experience in talent operations — hiring, onboarding, performance management, and people processes across teams.',
            target_roles:       ['People Operations Manager', 'Talent Acquisition Manager', 'HR Programme Manager'],
            mapped_skills:      ['Talent Acquisition', 'Performance Management', 'People Analytics'],
            stat_seeds:         { charisma: 7, endurance: 4 },
            gap_skills:         ['Organisational design at scale', 'Compensation benchmarking', 'HRIS systems and automation']
        },
        operations: {
            path_name:          'Operations and Process Delivery',
            current_role_match: 'Operations Manager',
            narrative:          'Your record shows process management, operational delivery, and coordination across teams — with a pattern of improving efficiency and reliability.',
            target_roles:       ['Operations Programme Manager', 'Business Operations Manager', 'Regional Operations Manager'],
            mapped_skills:      ['Process Optimisation', 'Vendor Management', 'Operational Reporting'],
            stat_seeds:         { strength: 7, endurance: 5 },
            gap_skills:         ['Change management at scale', 'Lean or Six Sigma certification', 'Cross-functional budget ownership']
        },
        learning: {
            path_name:          'Learning Design and Talent Development',
            current_role_match: 'Learning and Development Manager',
            narrative:          'Your record shows experience designing and delivering learning programmes — curriculum development, facilitation, and talent incubation.',
            target_roles:       ['L&D Programme Manager', 'Learning Experience Designer', 'Curriculum Manager'],
            mapped_skills:      ['Instructional Design', 'Programme Management', 'Facilitation'],
            stat_seeds:         { intelligence: 7, charisma: 4 },
            gap_skills:         ['LMS platform ownership', 'Learning impact measurement and ROI', 'Large-scale digital learning deployment']
        },
        sales: {
            path_name:          'Sales and Revenue Growth',
            current_role_match: 'Account Executive',
            narrative:          'Your record shows experience in pipeline management, client acquisition, and revenue generation — with a pattern of closing deals and managing commercial relationships.',
            target_roles:       ['Sales Manager', 'Account Manager', 'Commercial Manager'],
            mapped_skills:      ['Pipeline Management', 'Client Relationship Management', 'Commercial Negotiation'],
            stat_seeds:         { charisma: 8, endurance: 3 },
            gap_skills:         ['Enterprise sales cycle management', 'Sales team leadership', 'Revenue forecasting and territory planning']
        },
        marketing: {
            path_name:          'Marketing and Brand Growth',
            current_role_match: 'Marketing Manager',
            narrative:          'Your record shows experience across marketing channels — content, campaigns, brand, and audience growth — with a pattern of connecting products to audiences.',
            target_roles:       ['Growth Marketing Manager', 'Brand Manager', 'Content Strategy Manager'],
            mapped_skills:      ['Campaign Strategy', 'Content Marketing', 'Growth Analytics'],
            stat_seeds:         { intelligence: 6, charisma: 5 },
            gap_skills:         ['Paid acquisition and performance marketing', 'Marketing attribution and analytics', 'Brand strategy at scale']
        },
        data: {
            path_name:          'Data and Analytics',
            current_role_match: 'Data Analyst',
            narrative:          'Your record shows experience working with data — analysis, visualisation, and generating insights that inform decisions.',
            target_roles:       ['Analytics Manager', 'Business Intelligence Analyst', 'Data Strategy Manager'],
            mapped_skills:      ['Data Analysis', 'SQL and Data Tooling', 'Insight Communication'],
            stat_seeds:         { intelligence: 8, agility: 3 },
            gap_skills:         ['Machine learning and predictive modelling', 'Data engineering and pipeline ownership', 'Executive data storytelling']
        },
        legal: {
            path_name:          'Legal and Compliance',
            current_role_match: 'Legal Counsel',
            narrative:          'Your record shows experience in legal analysis, contract management, and compliance — advising on risk and regulatory requirements.',
            target_roles:       ['Commercial Legal Counsel', 'Compliance Manager', 'Contract Manager'],
            mapped_skills:      ['Contract Drafting and Review', 'Regulatory Compliance', 'Risk Assessment'],
            stat_seeds:         { intelligence: 8, endurance: 3 },
            gap_skills:         ['Board-level governance experience', 'Cross-border legal jurisdiction', 'Litigation management at scale']
        },
        health: {
            path_name:          'Healthcare and Clinical Operations',
            current_role_match: 'Clinical Coordinator',
            narrative:          'Your record shows experience in healthcare delivery, clinical operations, or public health — with a pattern of improving care quality and operational efficiency.',
            target_roles:       ['Healthcare Programme Manager', 'Clinical Operations Manager', 'Public Health Manager'],
            mapped_skills:      ['Clinical Protocol Management', 'Healthcare Systems Navigation', 'Stakeholder Coordination'],
            stat_seeds:         { endurance: 7, charisma: 4 },
            gap_skills:         ['Healthcare technology implementation', 'Clinical research methodology', 'Health policy and regulatory navigation']
        }
    };

    // Pick primary path by domain signal if strong, fall back to stat classification.
    // seniority prefixes removed — rank badge communicates experience level instead.
    let primary, linked1, linked2;

    if (cvSignal && cvSignal.domainPrimary && DOMAIN_TO_PATHS[cvSignal.domainPrimary]) {
        primary = DOMAIN_TO_PATHS[cvSignal.domainPrimary];

        // If domain matches but evidence is too thin, tell the operative honestly
        // rather than presenting a low-confidence local read as accurate.
        const evidence = (cvSignal.evidenceLines || []).length;
        if (evidence < 2 && !cvSignal.leadershipEvidence) {
            return _getUnsupportedDomainBundle();
        }

        linked1 = (cvSignal.domainSecondary && DOMAIN_TO_PATHS[cvSignal.domainSecondary])
            ? DOMAIN_TO_PATHS[cvSignal.domainSecondary]
            : statToPath[result.linkedStats[0]] || statToPath.agility;
        linked2 = statToPath[result.linkedStats[1]] || statToPath.endurance;
    } else if (cvSignal && cvSignal.domainPrimary && !DOMAIN_TO_PATHS[cvSignal.domainPrimary]) {
        // Domain detected but not in our local coverage — honest fallback
        return _getUnsupportedDomainBundle();
    } else {
        // No domain match at all — fall back to stat classification
        primary = statToPath[result.primaryStat]    || statToPath.intelligence;
        linked1 = statToPath[result.linkedStats[0]] || statToPath.agility;
        linked2 = statToPath[result.linkedStats[1]] || statToPath.endurance;
    }

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

// ─── CALL 3: MARKET SIGNAL ────────────────────────────────────
// On-demand call. Fires only when operative taps [ GET MARKET SIGNAL ]
// on the round 0 role mapping screen. Uses Gemini with Google Search
// grounding to get live hiring signal for each current_role_match.
// Result stored on pathState.marketSignals (array matching paths order).
// Also written into pathData at synthesis so it reaches Firestore.
async function fireMarketSignalCall(paths) {
    if (!hasNeuralLink()) return null;

    const roles = paths.map(p => p.current_role_match).filter(Boolean);
    if (!roles.length) return null;

    const prompt = `Search current job market data for these roles: ${roles.join(', ')}.

For each role output a JSON object with: role (exact name), demand (high/moderate/emerging/low), trend (one sentence, max 15 words), who_is_hiring (one phrase, max 8 words), one_signal (one fact, max 12 words).

Output ONLY a JSON array. No markdown. No preamble. No explanation.

[{"role":"...","demand":"...","trend":"...","who_is_hiring":"...","one_signal":"..."}]`.trim();

    const result = await geminiCallWithSearch({ prompt, temperature: 0.2, maxTokens: 2048 });
    if (!result.ok) {
        console.warn('[SYD] Market signal call failed:', result.error);
        return null;
    }

    const parsed = extractJSON(result.text);
    if (!Array.isArray(parsed)) {
        console.warn('[SYD] Market signal parse failed.');
        return null;
    }

    // Map results back to path order by matching role name
    return paths.map(p => {
        const match = parsed.find(r =>
            r.role && p.current_role_match &&
            r.role.toLowerCase().trim() === p.current_role_match.toLowerCase().trim()
        ) || parsed[paths.indexOf(p)] || null;
        return match || null;
    });
}

const DEMAND_COLOURS = { high: '#66bb6a', moderate: '#4fc3f7', emerging: '#ffa726', low: '#888888' };

// ─── SHARED FLOW: ROLE MAPPING ───────────────────────────────
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
        'Your record points to three possible paths. The first column is where you are now. The second is where the pattern leads.',
        'Confirmed. Which of these roles do you actually see yourself in?',
        'Last one. Which of these focus areas fits how you want to work within that path?'
    ];

    let cardData = paths;
    if (round === 1 && pathState.confirmedPath) {
        const roles = pathState.confirmedPath.target_roles || [];
        cardData = roles.map(r => ({ path_name: r, narrative: '', target_roles: [], mapped_skills: [] }));
        const existingNames = new Set(cardData.map(c => c.path_name));
        if (paths[1]) {
            const r1 = (paths[1].target_roles || [])[0] || paths[1].path_name;
            if (!existingNames.has(r1)) cardData.push({ path_name: r1, narrative: '', target_roles: [], mapped_skills: [] });
        }
        if (paths[2]) {
            const r2 = (paths[2].target_roles || [])[0] || paths[2].path_name;
            if (!existingNames.has(r2)) cardData.push({ path_name: r2, narrative: '', target_roles: [], mapped_skills: [] });
        }
    }
    if (round === 2 && pathState.confirmedPath) {
        const skills = pathState.confirmedPath.mapped_skills || [];
        cardData = skills.map(s => ({ path_name: s, narrative: '', target_roles: [], mapped_skills: [] }));
        if (cardData.length === 0) {
            const roles = pathState.confirmedPath.target_roles || [];
            cardData = roles.map(r => ({ path_name: r, narrative: '', target_roles: [], mapped_skills: [] }));
        }
    }

    // Market signals — rehydrate from storage if not in memory (survives re-entry to screen)
    if (!pathState.marketSignals) {
        const stored = loadPathData();
        if (stored && stored.marketSignals) pathState.marketSignals = stored.marketSignals;
    }
    const signals = pathState.marketSignals || null;

    function buildMarketSignalBlock(signal) {
        if (!signal) return '';
        const colour = DEMAND_COLOURS[signal.demand] || '#888888';
        return `
            <div class="ms-block">
                <span class="ms-label">[ MARKET SIGNAL ]</span>
                <span class="ms-demand" style="color:${colour}">${(signal.demand || '').toUpperCase()} <span class="ms-trend-inline">— ${signal.trend || ''}</span></span>
                <p class="ms-who">Hiring: <span class="ms-who-value">${signal.who_is_hiring || ''}</span></p>
            </div>
        `;
    }

    function renderCards() {
        return cardData.map((p, i) => `
            <button class="role-card ${round === 0 ? 'role-card--split' : ''}" data-path-index="${i}">
                ${round === 0 && p.current_role_match ? `
                    <div class="role-card-split-row">
                        <div class="role-card-now">
                            <span class="role-card-split-label">NOW</span>
                            <span class="role-card-split-value">${p.current_role_match}</span>
                        </div>
                        <div class="role-card-direction">
                            <span class="role-card-split-label">DIRECTION</span>
                            <span class="role-card-split-value">${p.path_name || 'PATH ' + (i + 1)}</span>
                        </div>
                    </div>
                    ${p.narrative ? '<p class="role-card-narrative">' + p.narrative + '</p>' : ''}
                    ${buildMarketSignalBlock(signals ? signals[i] : null)}
                ` : `
                    <span class="role-card-name">${p.path_name || 'PATH ' + (i + 1)}</span>
                    ${p.narrative ? '<p class="role-card-narrative">' + p.narrative + '</p>' : ''}
                `}
                ${(p.target_roles || []).length > 0 ? `
                    <div class="role-card-roles">
                        ${p.target_roles.map(r => '<span class="role-tag">' + r + '</span>').join('')}
                    </div>
                ` : ''}
            </button>
        `).join('');
    }

    const hasLink   = round === 0 && (typeof hasNeuralLink === 'function') && hasNeuralLink();
    const showMSBtn = hasLink; // kept for legacy guard below

    container.innerHTML = `
        <div class="role-mapping-wrap">
            <button class="path-back-btn" id="role-map-back">← BACK</button>
            <div class="path-progress-bar">
                <div class="path-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="path-progress-label">ROLE MAPPING — ROUND ${round + 1} OF 3</p>
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">${voiceLines[round]}</p>
            </div>
            ${hasLink && !signals ? `
                <div class="ms-fetch-wrap" id="ms-fetch-wrap">
                    <button class="ms-fetch-btn" id="ms-fetch-btn">
                        &#x25BA; GET MARKET SIGNAL — see who is hiring for each path right now
                    </button>
                </div>
            ` : ''}
            ${hasLink && signals ? `
                <p class="ms-fetched-note">&#x2713; Market signal loaded. Data sourced via live search.</p>
            ` : ''}
            <div class="role-card-stack" id="role-card-stack">
                ${renderCards()}
            </div>
        </div>
    `;

    // Wire back button
    const roleMapBack = document.getElementById('role-map-back');
    if (roleMapBack) {
        roleMapBack.addEventListener('click', () => {
            playUIClick();
            if (round === 0) {
                if (typeof onboardingBack === 'function') onboardingBack('rank-confirm');
            } else {
                runRoleMapping(round - 1);
            }
        });
    }

    // Wire market signal fetch button
    const msFetchBtn = document.getElementById('ms-fetch-btn');
    const msFetchWrap = document.getElementById('ms-fetch-wrap');
    if (msFetchBtn && msFetchWrap) {
        msFetchBtn.addEventListener('click', () => {
            playUIClick();
            // Show loading state
            msFetchWrap.innerHTML = `
                <p class="ms-loading-text" id="ms-loading-text">[ READING MARKET — STANDING BY... ]</p>
                <div class="ms-loading-bar"><div class="ms-loading-bar-fill" id="ms-loading-bar-fill"></div></div>
            `;
            fireMarketSignalCall(paths).then(result => {
                if (result) {
                    pathState.marketSignals = result;
                    const existing = loadPathData();
                    if (existing) {
                        existing.marketSignals = result;
                        savePathData(existing);
                    }
                    // Show acquired state with VIEW button
                    msFetchWrap.innerHTML = `
                        <div class="ms-acquired-row">
                            <p class="ms-fetched-note">&#x2713; MARKET SIGNAL ACQUIRED</p>
                            <button class="ms-view-btn" id="ms-view-btn">[ VIEW ]</button>
                        </div>
                    `;
                    document.getElementById('ms-view-btn').addEventListener('click', () => {
                        playUIClick();
                        runRoleMapping(0);
                    });
                } else {
                    // Fail state — wrap becomes a retry button
                    msFetchWrap.innerHTML = `
                        <button class="ms-fetch-btn" id="ms-fetch-btn-retry">
                            [ SIGNAL UNAVAILABLE — tap to retry ]
                        </button>
                    `;
                    document.getElementById('ms-fetch-btn-retry').addEventListener('click', () => {
                        msFetchWrap.innerHTML = `<button class="ms-fetch-btn" id="ms-fetch-btn">&#x25BA; GET MARKET SIGNAL — see who is hiring for each path right now</button>`;
                        // Re-wire by re-triggering the outer block via a click simulation
                        const newBtn = document.getElementById('ms-fetch-btn');
                        if (newBtn) newBtn.click();
                    });
                    if (typeof showLog === 'function') showLog('[ MARKET SIGNAL UNAVAILABLE — CHECK CONNECTION ]', 'system');
                }
            });
        });
    }

    function wireRoleCards() {
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

    wireRoleCards();
}

// ─── SHARED FLOW: STARTING RANK CONFIRMATION ─────────────────
function runRankConfirmation() {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) return;

    const inferredRank = inferStartingRank();
    const rankContext  = getRankContext(inferredRank);

    const inferredLabel = careerRankLabel(inferredRank);

    container.innerHTML = `
        <div class="rank-confirm-wrap">
            <div class="path-syd-voice">
                <p class="path-voice-line path-voice-line--visible">
                    Based on what I have read, I am placing you at <strong>${inferredLabel}</strong>.
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
                    <span class="rank-confirm-label">[ ${inferredLabel.toUpperCase()} ]</span>
                    <span class="rank-confirm-sub">This is accurate</span>
                </button>
                <button class="rank-confirm-btn" id="rc-lower">
                    <span class="rank-confirm-label">[ EARLIER THAN THIS ]</span>
                    <span class="rank-confirm-sub">I am less experienced than this suggests</span>
                </button>
                <button class="rank-confirm-btn" id="rc-higher">
                    <span class="rank-confirm-label">[ FURTHER ALONG ]</span>
                    <span class="rank-confirm-sub">I have more experience than this suggests</span>
                </button>
            </div>
            <p class="rank-confirm-note">
                This affects where your encounters and directives start. It does not gate any content permanently.
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

// ─── CAREER RANK LABELS ───────────────────────────────────────
// Internal keys (F/E/D/C/B/A) are preserved for storage and comparison.
// These labels are what the operative sees — workplace-legible seniority.
const CAREER_RANK_LABELS = {
    'F': 'Intern',
    'E': 'Junior',
    'D': 'Mid-level',
    'C': 'Senior',
    'B': 'Lead',
    'A': 'Principal'
};
function careerRankLabel(rank) {
    return CAREER_RANK_LABELS[rank] || 'Intern';
}

function inferStartingRank() {
    if (pathState.track === 'reimaginer') return 'F';

    const text = pathState.cvText || '';
    if (!text || text.length < 100) return 'F';

    // Use the CV signal extractor — already available in this file
    const signal = extractCVSignals(text);
    const years  = signal.yearsTotal      || 0;
    const impact = signal.evidenceLines   ? signal.evidenceLines.length : 0;
    const hasLeadership = signal.leadershipEvidence || false;

    // Formula: years gives the floor, evidence lines confirm the ceiling.
    // Leadership evidence (managed a team, direct reports) adds one tier.
    // Re-imaginer track always starts at Intern (F).
    //
    // Intern    (F): 0–1 years, or no dateable record
    // Junior    (E): 1–3 years, thin evidence
    // Mid-level (D): 3–6 years, some outcomes, OR 1–3 years with 4+ evidence lines
    // Senior    (C): 5–8 years with 4+ evidence lines, OR leadership evidence + 4+ years
    // Lead      (B): 8+ years with leadership evidence and 6+ evidence lines
    // Principal (A): explicit organisational scope — reserved for exceptional records

    if (years < 1)                                          return 'F';
    if (years < 3 && impact < 4)                           return 'E';
    if (years < 3 && impact >= 4)                          return 'D';
    if (years < 5 && !hasLeadership)                       return 'D';
    if (years < 5 && hasLeadership && impact >= 3)         return 'C';
    if (years < 8 && impact >= 4)                          return 'C';
    if (years >= 8 && hasLeadership && impact >= 6)        return 'B';
    if (years >= 8 && impact >= 4)                         return 'C';
    if (years >= 5)                                        return 'D';
    return 'E';
}

function getRankContext(rank) {
    const contexts = {
        'F': 'No substantial record yet. Your directives build from fundamentals.',
        'E': 'You have some real experience. Frameworks will come quickly.',
        'D': 'Consistent track record. You are past beginner. The next phase is deliberate practice.',
        'C': 'Established. You know the terrain. The gap now is precision and leverage.',
        'B': 'You have led and delivered in serious contexts. The gap is influence at scale.',
        'A': 'Recognised depth. Edge cases are what is left to master.'
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
            <div class="path-input-group path-intent-group">
                <label class="path-input-label">WHERE ARE YOU RIGHT NOW?</label>
                <div class="path-intent-options" id="aspiration-intent-options">
                    <button class="path-intent-btn" data-intent="hunting">
                        <span class="path-intent-label">Actively looking for a job</span>
                    </button>
                    <button class="path-intent-btn" data-intent="building">
                        <span class="path-intent-label">Building toward a move — not yet</span>
                    </button>
                    <button class="path-intent-btn" data-intent="growing">
                        <span class="path-intent-label">Growing where I am</span>
                    </button>
                </div>
            </div>
            <div class="path-action-row">
                <button class="path-skip-btn" id="aspiration-skip">SKIP</button>
                <button class="btn btn--primary" id="aspiration-submit">[ CONFIRM SIGNAL ]</button>
            </div>
        </div>
    `;

    setTimeout(() => { const t = document.getElementById('aspiration-career'); if (t) t.focus(); }, 150);

    let selectedIntent = 'building'; // default

    document.querySelectorAll('.path-intent-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.path-intent-btn')
                .forEach(b => b.classList.remove('path-intent-btn--active'));
            btn.classList.add('path-intent-btn--active');
            selectedIntent = btn.dataset.intent;
        });
    });

    document.getElementById('aspiration-skip').addEventListener('click', () => {
        playUIClick();
        pathState.aspirationGoal = null;
        localStorage.setItem(JOB_OPS_INTENT_KEY, 'growing');
        runPathSynthesis();
    });

    document.getElementById('aspiration-submit').addEventListener('click', () => {
        playUIClick();
        const careerGoal = document.getElementById('aspiration-career').value.trim();
        const lifeGoal   = document.getElementById('aspiration-life').value.trim();
        localStorage.setItem(JOB_OPS_INTENT_KEY, selectedIntent);
        pathState.aspirationGoal = {
            careerGoal,
            lifeGoal,
            jobIntent:  selectedIntent,
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
        cvText:              pathState.cvText || null,
        reimagineResponses:  pathState.reimagineResponses || [],
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
        geminiEnhanced:      !!bundle.geminiEnhanced,
        marketSignals:       pathState.marketSignals || null
    };

    // Fire Call 2B silently — does not block onComplete
    // Stores result in SIGNAL_TRANSLATION_KEY for the translation screen to poll
    fireCall2B(pathData);

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

    const LOADING_TIPS = [
        'SYD reads patterns, not job titles. What you built matters more than what you called yourself.',
        'The scan traits you just completed are feeding into the classification right now.',
        'Most operatives underestimate their seniority. SYD reads the evidence, not the self-assessment.',
        'Three paths will emerge. They are not predictions — they are signals from your record.',
        'The gap analysis is the most useful part. It tells you exactly what to build next.',
        'Career paths are not linear. SYD is looking for the pattern beneath the sequence.',
        'You will be asked to confirm your starting rank. Be honest — it only affects where the directives begin.',
        'The longer this takes, the more thoroughly Gemini is reading your record.',
        'SYD does not tell you what you want to hear. It tells you what the data shows.',
        'Your hidden affinity stat is calculated now. It unlocks at Level 20.'
    ];

    container.innerHTML = `
        <div class="path-loading">
            <div class="path-loading-icon">⬡</div>
            <p class="path-loading-label">${label}</p>
            <div class="path-loading-bar">
                <div class="path-loading-fill" id="path-loading-fill"></div>
            </div>
            <p class="path-loading-sub">[ DO NOT CLOSE — SIGNAL PROCESSING ]</p>
            <p class="path-loading-tip" id="path-loading-tip"></p>
        </div>
    `;

    // Rotate tips every 4 seconds
    let tipIdx = Math.floor(Math.random() * LOADING_TIPS.length);
    const tipEl = document.getElementById('path-loading-tip');
    function showTip() {
        if (!tipEl) return;
        tipEl.style.opacity = '0';
        setTimeout(() => {
            tipEl.textContent = LOADING_TIPS[tipIdx % LOADING_TIPS.length];
            tipEl.style.opacity = '1';
            tipIdx++;
        }, 400);
    }
    showTip();
    const tipInterval = setInterval(showTip, 4000);
    // Store interval so it can be cleared if needed (stored on container)
    container._tipInterval = tipInterval;

    let pct = 0;
    const fill = document.getElementById('path-loading-fill');
    const iv = setInterval(() => {
        pct = Math.min(88, pct + Math.random() * 4);
        if (fill) fill.style.width = pct + '%';
        if (pct >= 88) clearInterval(iv);
    }, 400);
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

// ─── JOB OPS STORAGE HELPERS ─────────────────────────────────
function saveJobOpsProfile(data) {
    try { localStorage.setItem(JOB_OPS_PROFILE_KEY, JSON.stringify(data)); }
    catch(e) { console.warn('[SYD] Could not save JOB OPS profile:', e); }
}

function loadJobOpsProfile() {
    try {
        const raw = localStorage.getItem(JOB_OPS_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function saveJobOpsMarket(data) {
    try { localStorage.setItem(JOB_OPS_MARKET_KEY, JSON.stringify(data)); }
    catch(e) { console.warn('[SYD] Could not save JOB OPS market:', e); }
}

function loadJobOpsMarket() {
    try {
        const raw = localStorage.getItem(JOB_OPS_MARKET_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

// ─── CALL 4: CAREER REFRESH ──────────────────────────────────
// Fires in the background when the career directive cache is low.
async function fireCall4() {
    if (!hasNeuralLink()) return;

    const bundle = loadPathData();
    if (!bundle) return;

    const confirmedRole  = bundle.confirmedRole  || 'their confirmed role';
    const confirmedSpec  = bundle.confirmedSpec   || confirmedRole;
    const confirmedRank  = bundle.confirmedRank   || 'F';
    const confirmedPath  = (bundle.confirmedPath && bundle.confirmedPath.path_name) || 'their path';
    const aspiration     = bundle.aspirationGoal  || null;

    const aspirationBlock = aspiration
        ? `
ASPIRATION:
Career goal: ${aspiration.careerGoal || 'not specified'}
Life goal: ${aspiration.lifeGoal || 'not specified'}
Target direction: ${aspiration.targetRole || aspiration.domain || 'not specified'}
`
        : '';

    const prompt = `
You are SYD — a career intelligence system refreshing the directive cache for an operative.

OPERATIVE CONTEXT:
Confirmed role: ${confirmedRole}
Confirmed specialisation: ${confirmedSpec}
Path: ${confirmedPath}
Career rank: ${confirmedRank}
${aspirationBlock}
Generate 10 new career directives. Each must be a real-world action with real professional consequences — not study tasks or research exercises. Outcome-oriented. Calibrated to ${confirmedRank}-rank: ${
    confirmedRank === 'F' || confirmedRank === 'E'
        ? 'foundational execution, first-time shipping, building tangible artefacts'
        : confirmedRank === 'D' || confirmedRank === 'C'
        ? 'deliberate improvement, cross-functional impact, consistent delivery'
        : 'leverage, systems thinking, enabling others'
}.

Output ONLY valid JSON — an array of directive objects. No markdown fences. No preamble.

[
  {
    "id": "cd_r01",
    "title": "Directive title — active verb, specific outcome",
    "desc": "What the operative actually does. Real action, real professional consequence.",
    "intel": "Mental model name — one sentence on what it is. One sentence on why it matters.",
    "stat": "intelligence",
    "career_skill": "Matching career skill name",
    "xp": 12,
    "tier": 1
  }
]
`.trim();

    const result = await geminiGenerate(prompt);
    if (result.ok) {
        const newDirectives = extractJSON(result.text);
        if (Array.isArray(newDirectives) && newDirectives.length > 0) {
            localStorage.setItem('syd_career_directives', JSON.stringify(newDirectives));
            console.log('[SYD] Call 4 successful: Career cache refreshed with', newDirectives.length, 'directives.');
        }
    }
}