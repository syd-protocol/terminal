// ═══════════════════════════════════════════════════════════════
// SYD GES — job-ops.js
// JOB OPS feature — Call A, Call B, all renderers.
// Loaded after path.js, before status.js.
// ═══════════════════════════════════════════════════════════════

// ─── CONSTANTS ────────────────────────────────────────────────
// Storage key constants duplicated here for local reference.
// The authoritative constants live in path.js.
const _JOB_OPS_PROFILE_KEY = 'syd_job_ops_profile';
const _JOB_OPS_MARKET_KEY  = 'syd_job_ops_market';
const _JOB_OPS_INTENT_KEY  = 'syd_job_intent';

// ─── MANUAL REFRESH RATE LIMIT ────────────────────────────────
function canManualRefresh() {
    const last = localStorage.getItem('syd_job_ops_last_manual_refresh');
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) > 60 * 60 * 1000;
}

function recordManualRefresh() {
    localStorage.setItem('syd_job_ops_last_manual_refresh', new Date().toISOString());
}

function minutesUntilRefresh() {
    const last = localStorage.getItem('syd_job_ops_last_manual_refresh');
    if (!last) return 0;
    const elapsed = Date.now() - new Date(last).getTime();
    return Math.max(0, Math.ceil((60 * 60 * 1000 - elapsed) / 60000));
}

// ─── CALL A: FIRE JOB OPS PROFILE ────────────────────────────
// Produces PROFILE panel content from existing PATH/CV data.
// No web search. One geminiGenerate() or geminiGenerateLarge() call.
// Fires from scheduleJobOpsCalls() after createPlayer().
async function fireJobOpsProfile() {
    if (!hasNeuralLink()) return;

    const pathData  = (typeof loadPathData === 'function') ? loadPathData() : null;
    const call2     = JSON.parse(localStorage.getItem('syd_call2_bundle') || 'null');
    const sigKit    = (typeof loadSignalTranslation === 'function') ? loadSignalTranslation() : null;
    const player    = (function() {
        try { return JSON.parse(localStorage.getItem('syd_player') || 'null'); }
        catch(_) { return null; }
    })();

    if (!pathData) return;

    const track       = pathData.track || null;
    const cvText      = pathData.cvText || null;
    const reimagine   = pathData.reimagineResponses || null;
    const role        = pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || 'their confirmed role';
    const rank        = pathData.confirmedRank || 'F';
    const rankLabel   = (typeof careerRankLabel === 'function') ? careerRankLabel(rank) : rank;
    const name        = player ? (player.name || 'Operative') : 'Operative';

    const isChronicler = track === 'chronicler';

    const cvBlock = isChronicler
        ? `CV TEXT:\n---\n${cvText || 'Not available'}\n---`
        : `OPERATIVE RESPONSES:\n1. ${(reimagine || [])[0] || ''}\n2. ${(reimagine || [])[1] || ''}\n3. ${(reimagine || [])[2] || ''}\n4. ${(reimagine || [])[3] || ''}`;

    const reframeBlock = sigKit ? `
EXISTING ROLE REFRAMES (already generated — reproduce these exactly, do not regenerate):
Current role: ${sigKit.current_role || ''}
Current headline: ${sigKit.headline_current || ''}
Current bullets: ${JSON.stringify(sigKit.current_bullets || [])}
Target role: ${sigKit.target_role || ''}
Target headline: ${sigKit.headline_target || ''}
Target bullets: ${JSON.stringify(sigKit.target_bullets || [])}
Gap note: ${sigKit.gap_note || ''}
` : `
EXISTING ROLE REFRAMES: Not available — use PATH data to reconstruct.
Current role: ${role}
Current headline: Generate from their record.
Current bullets: []
Target role: ${(pathData.confirmedPath && (pathData.confirmedPath.target_roles || [])[0]) || role}
Target headline: Generate from their record.
Target bullets: []
Gap note: ${(pathData.gapAnalysis && pathData.gapAnalysis.primaryGap) || 'Not available.'}
`;

    const cvOutputBlock = isChronicler ? `
"full_cv": A complete, professionally formatted CV for this operative.
Plain text, not markdown. Use this structure:
[NAME]
[EMAIL PLACEHOLDER] | [PHONE PLACEHOLDER] | [LOCATION PLACEHOLDER]

PROFESSIONAL SUMMARY
[3-4 sentence summary framing their record for their confirmed role]

EXPERIENCE
[Each role: title, company, dates on one line. Then 3-5 bullet points starting with action verbs. Reframe language to match their confirmed role direction.]

SKILLS
[Skills section organised by category, drawn from their actual record]

Do not invent any roles, companies, or dates. Use only what is in the CV.
Use [YEAR] placeholders for any dates not provided.

Also include: "summary": A condensed 3-4 sentence professional summary.
"skills_section": A skills section in plain text, organised by category.
` : `
"full_cv": "",
"summary": A 3-4 sentence professional summary built from their four responses. Positions them for their confirmed role direction.
"skills_section": A skills section in plain text listing what they demonstrably know from their responses, organised by category.
`;

    const prompt = `
You are SYD — an elite career intelligence system.

OPERATIVE: ${name}, ${rankLabel} ${role}
TRACK: ${track || 'unknown'}

${cvBlock}

${reframeBlock}

YOUR TASK:
Produce a structured JSON object with these fields:

${cvOutputBlock}

ALSO include for BOTH tracks (reproduce exactly from existing reframes above if available):
"current_role": the current role string
"current_headline": the current headline string
"current_bullets": array of current bullet strings
"target_role": the target role string
"target_headline": the target headline string
"target_bullets": array of target bullet strings
"gap_note": the gap note string
"track": "${track || 'unknown'}"

Return ONLY valid JSON. No markdown fences. No preamble. No explanation.
`.trim();

    const result = isChronicler && cvText && cvText.length > 1500
        ? await geminiGenerateLarge(prompt, 0.3)
        : await geminiGenerate(prompt);

    if (!result.ok) {
        console.warn('[SYD] JOB OPS Call A failed:', result.error);
        return;
    }

    const parsed = (typeof extractJSON === 'function') ? extractJSON(result.text) : null;
    if (!parsed || typeof parsed !== 'object') {
        console.warn('[SYD] JOB OPS Call A JSON parse failed.');
        return;
    }

    parsed.cachedAt = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);

    if (typeof saveJobOpsProfile === 'function') {
        saveJobOpsProfile(parsed);
    }
    console.log('[SYD] JOB OPS Call A complete — profile cached.');
}

// ─── CALL B: FIRE JOB OPS MARKET ─────────────────────────────
// Stage 1: geminiCallWithSearch() for live market data.
// Stage 2: geminiGenerate() to synthesise structured JSON.
// If Stage 1 fails, Stage 2 uses training data.
async function fireJobOpsMarket() {
    if (!hasNeuralLink()) return;

    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    if (!pathData) return;

    const player = (function() {
        try { return JSON.parse(localStorage.getItem('syd_player') || 'null'); }
        catch(_) { return null; }
    })();

    const role       = pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || 'their confirmed role';
    const domain     = (pathData.confirmedPath && pathData.confirmedPath.path_name) || role;
    const rank       = pathData.confirmedRank || 'F';
    const rankLabel  = (typeof careerRankLabel === 'function') ? careerRankLabel(rank) : rank;
    const name       = player ? (player.name || 'Operative') : 'Operative';
    const gapSkills  = (pathData.gapAnalysis && pathData.gapAnalysis.skills) || [];
    const aspiration = pathData.aspirationGoal || null;
    const jobIntent  = localStorage.getItem(_JOB_OPS_INTENT_KEY) || 'building';
    const todayStr   = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);

    // ── Stage 1: Live market search ───────────────────────────
    let liveData     = null;
    let liveDataUsed = false;

    const stage1Prompt = `Search for current information on the following:

1. Job market demand for ${role} in ${domain} — is it growing, stable, or declining? What is driving this?
2. What skills are employers starting to require for ${role} that were not required 2-3 years ago?
3. Which types of companies or sectors are actively hiring for ${role} right now?
4. What is one adjacent role to ${role} that is currently seeing higher demand?

Return a factual summary of what you find. No formatting. Plain text. Keep it under 600 words.`.trim();

    const stage1Result = await geminiCallWithSearch({
        prompt:      stage1Prompt,
        temperature: 0.2,
        maxTokens:   1024
    });

    if (stage1Result.ok && stage1Result.text) {
        liveData     = stage1Result.text;
        liveDataUsed = true;
        console.log('[SYD] JOB OPS Call B Stage 1 — live data acquired.');
    } else {
        console.warn('[SYD] JOB OPS Call B Stage 1 failed — falling back to training data.');
    }

    // ── Stage 2: Synthesis ────────────────────────────────────
    const liveBlock = liveDataUsed
        ? `LIVE MARKET DATA (sourced from web search — use this as your primary source for the market brief):\n---\n${liveData}\n---`
        : `NOTE: No live market data available. Use your training knowledge to produce the best possible market brief for this role and industry.`;

    const aspirationBlock = aspiration
        ? `Career goal: ${aspiration.careerGoal || 'Not provided'}`
        : 'Career goal: Not provided';

    const stage2Prompt = `
You are SYD — an elite career intelligence system.

OPERATIVE: ${name}, ${rankLabel} ${role}
JOB INTENT: ${jobIntent}

${liveBlock}

OPERATIVE PROFILE:
- Path: ${domain}
- Confirmed role: ${role}
- Career rank: ${rankLabel}
- Gap skills: ${gapSkills.join(', ') || 'Not specified'}
- ${aspirationBlock}

YOUR TASK:
Produce a structured JSON object with these fields:

"demand_signal": {
    "level": "growing" | "stable" | "declining",
    "summary": "One sentence. SYD's voice — direct, clipped, no fluff.",
    "driver": "One sentence explaining what is driving this."
}

"skill_shift": {
    "skill": "The specific skill that is moving into demand.",
    "why": "One sentence on why this skill is rising."
}

"adjacent_opportunity": {
    "role": "The specific adjacent role title.",
    "why": "One sentence on why it is worth watching."
}

"visibility_action": "One specific, concrete action the operative can take in the next 30 days to be more visible to employers hiring for their role. Not generic advice. Specific to their path and rank."

"search_strings": [
    {
        "label": "Short description of what this searches for.",
        "query": "The full search string, e.g. site:linkedin.com/jobs \"product manager\" Nigeria"
    }
]
Include 4-6 search strings. Mix: LinkedIn jobs, company career pages for 2-3 well-known companies in their industry, a remote-friendly board if their role suits remote. Tailor to their confirmed role and direction. Use specific job titles — not generic terms.

"visibility_strategy": {
    "headline_formula": "A LinkedIn headline formula for their role. Use [X] as a placeholder for specifics.",
    "keywords_to_add": ["3-5 specific keywords to add to their CV and LinkedIn based on current hiring language for their role"],
    "communities": ["2-3 specific communities, Slack groups, forums, or platforms where people in their role congregate. Real names."],
    "content_angle": "One sentence: what they should be writing or posting about publicly to attract the right attention."
}

"live_data_used": ${liveDataUsed}

Return ONLY valid JSON. No markdown fences. No preamble.
`.trim();

    const stage2Result = await geminiGenerate(stage2Prompt);

    if (!stage2Result.ok) {
        console.warn('[SYD] JOB OPS Call B Stage 2 failed:', stage2Result.error);
        return;
    }

    const parsed = (typeof extractJSON === 'function') ? extractJSON(stage2Result.text) : null;
    if (!parsed || typeof parsed !== 'object') {
        console.warn('[SYD] JOB OPS Call B Stage 2 JSON parse failed.');
        return;
    }

    parsed.cachedAt      = todayStr;
    parsed.live_data_used = liveDataUsed;

    if (typeof saveJobOpsMarket === 'function') {
        saveJobOpsMarket(parsed);
    }
    console.log('[SYD] JOB OPS Call B complete — market data cached. Live:', liveDataUsed);
}

// ═══════════════════════════════════════════════════════════════
// RENDERERS
// ═══════════════════════════════════════════════════════════════

// ─── TOP-LEVEL SEGMENT RENDERER ──────────────────────────────
function renderJobOpsSegment(container) {
    if (!container) return;

    const activePanel = window._jobOpsPanel || 'profile';

    container.innerHTML = `
        <div class="job-ops-wrap">
            <div class="job-ops-panel-bar">
                <button class="jo-panel-btn ${activePanel === 'profile' ? 'jo-panel-btn--active' : ''}"
                    data-panel="profile">PROFILE</button>
                <button class="jo-panel-btn ${activePanel === 'market' ? 'jo-panel-btn--active' : ''}"
                    data-panel="market">MARKET READ</button>
                <button class="jo-panel-btn ${activePanel === 'hunt' ? 'jo-panel-btn--active' : ''}"
                    data-panel="hunt">JOB HUNT</button>
            </div>
            <div class="job-ops-panel-content" id="job-ops-panel-content"></div>
        </div>
    `;

    document.querySelectorAll('.jo-panel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            window._jobOpsPanel = btn.dataset.panel;
            renderJobOpsPanel(btn.dataset.panel);
            document.querySelectorAll('.jo-panel-btn')
                .forEach(b => b.classList.toggle('jo-panel-btn--active',
                    b.dataset.panel === btn.dataset.panel));
        });
    });

    renderJobOpsPanel(activePanel);
}

function renderJobOpsPanel(panelId) {
    const content = document.getElementById('job-ops-panel-content');
    if (!content) return;
    switch(panelId) {
        case 'profile': renderJobOpsProfile(content); break;
        case 'market':  renderJobOpsMarketRead(content); break;
        case 'hunt':    renderJobOpsHunt(content); break;
        default:        renderJobOpsProfile(content);
    }
}

// ─── SHARED HELPERS ───────────────────────────────────────────
function _joNoKeyState(container, panelLabel) {
    container.innerHTML = `
        <div class="jo-state-wrap">
            <p class="jo-section-label">[ ${panelLabel} ]</p>
            <p class="jo-state-msg">To generate your ${panelLabel.toLowerCase()}, connect a free Gemini key via Settings → Neural Link.</p>
            <button class="jo-settings-link" id="jo-settings-link">[ GO TO SETTINGS ]</button>
        </div>
    `;
    const btn = document.getElementById('jo-settings-link');
    if (btn) {
        btn.addEventListener('click', () => {
            playUIClick();
            if (typeof navTo === 'function') navTo('screen-neural');
        });
    }
}

function _joLoadingState(container, panelLabel, roleLabel, showRefreshAfterMs) {
    container.innerHTML = `
        <div class="jo-state-wrap">
            <p class="jo-section-label">[ ${panelLabel} ]</p>
            <p class="jo-state-msg">SYD is ${panelLabel === 'PROFILE' ? 'building your career profile' : 'reading the market for ' + (roleLabel || 'your role')}.</p>
            ${panelLabel === 'PROFILE' ? '<p class="jo-state-sub">This takes about 30 seconds on first load.</p>' : ''}
            <div class="jo-loading-bar"><div class="jo-loading-fill"></div></div>
            <button class="jo-refresh-btn hidden" id="jo-loading-refresh">REFRESH →</button>
        </div>
    `;

    if (showRefreshAfterMs) {
        setTimeout(() => {
            const btn = document.getElementById('jo-loading-refresh');
            if (btn) btn.classList.remove('hidden');
        }, showRefreshAfterMs);
    }

    const refreshBtn = document.getElementById('jo-loading-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            playUIClick();
            _triggerManualRefresh(container, panelLabel, roleLabel);
        });
    }
}

function _joRefreshHeader(container, cachedAt, liveDataUsed) {
    const canRefresh = canManualRefresh();
    const mins       = minutesUntilRefresh();

    return `
        <div class="jo-header-row">
            <div class="jo-timestamp">
                ${liveDataUsed === true
                    ? '<span class="jo-live-badge">&#x2022; Live data</span>'
                    : liveDataUsed === false
                        ? '<span class="jo-stale-badge">&#x2022; Training data — refresh for live read</span>'
                        : ''
                }
                ${cachedAt ? `<span class="jo-date-note">${cachedAt}</span>` : ''}
            </div>
            <button class="jo-refresh-btn ${canRefresh ? '' : 'jo-refresh-btn--disabled'}"
                id="jo-panel-refresh" ${canRefresh ? '' : 'disabled'}>
                REFRESH →
            </button>
        </div>
        ${!canRefresh ? `<p class="jo-rate-limit-note">Signal already refreshed recently. Next pull available in ${mins} minute${mins !== 1 ? 's' : ''}.</p>` : ''}
    `;
}

function _triggerManualRefresh(container, panelLabel, roleLabel) {
    if (!canManualRefresh()) {
        const mins = minutesUntilRefresh();
        if (typeof showLog === 'function') {
            showLog(`[ Signal already refreshed recently. Next pull available in ${mins} minute${mins !== 1 ? 's' : ''}. ]`, 'system');
        }
        return;
    }
    recordManualRefresh();
    _joLoadingState(container, panelLabel, roleLabel, 60000);
    Promise.all([fireJobOpsProfile(), fireJobOpsMarket()]).then(() => {
        // Re-render active panel
        const activePanel = window._jobOpsPanel || 'profile';
        renderJobOpsPanel(activePanel);
    });
}

// ─── PROFILE PANEL ────────────────────────────────────────────
function renderJobOpsProfile(container) {
    if (!container) return;

    // State A — no key
    if (typeof hasNeuralLink === 'function' && !hasNeuralLink()) {
        _joNoKeyState(container, 'PROFILE');
        return;
    }

    const profile = (typeof loadJobOpsProfile === 'function') ? loadJobOpsProfile() : null;

    // State B — no data yet
    if (!profile) {
        _joLoadingState(container, 'PROFILE', null, 60000);
        return;
    }

    // State C — data available
    const isChronicler = profile.track === 'chronicler';
    const pathData     = (typeof loadPathData === 'function') ? loadPathData() : null;
    const role         = pathData ? (pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || '') : '';

    const cvOrSummaryBlock = isChronicler
        ? `
            <div class="jo-sub-section">
                <p class="jo-section-label">── FULL CV ──────────────────────────────────</p>
                <div class="jo-full-cv-block" id="jo-full-cv">${(profile.full_cv || '').replace(/\n/g, '<br>')}</div>
                <button class="jo-copy-btn" id="jo-copy-cv">COPY FULL CV →</button>
            </div>
        `
        : `
            <div class="jo-sub-section">
                <p class="jo-section-label">── CAREER SUMMARY ───────────────────────────</p>
                <p class="jo-text-block">${profile.summary || ''}</p>
                <button class="jo-copy-btn" id="jo-copy-summary">COPY SUMMARY →</button>
            </div>
            <div class="jo-sub-section">
                <p class="jo-section-label">── SKILLS ───────────────────────────────────</p>
                <p class="jo-text-block">${(profile.skills_section || '').replace(/\n/g, '<br>')}</p>
                <button class="jo-copy-btn" id="jo-copy-skills">COPY SKILLS →</button>
            </div>
        `;

    const currentBullets  = (profile.current_bullets  || []).map(b => `<li class="st-bullet">${b}</li>`).join('');
    const targetBullets   = (profile.target_bullets   || []).map(b => `<li class="st-bullet">${b}</li>`).join('');

    container.innerHTML = `
        <div class="jo-panel-inner">
            <p class="jo-section-label">[ PROFILE ]</p>
            ${_joRefreshHeader(container, profile.cachedAt, null)}

            ${cvOrSummaryBlock}

            <div class="jo-sub-section">
                <p class="jo-section-label">── ROLE REFRAMES ────────────────────────────</p>

                <div class="jo-reframe-block">
                    <p class="jo-reframe-tag">[ APPLY FOR THIS NOW ]</p>
                    <p class="jo-reframe-role">${profile.current_role || ''}</p>
                    ${profile.current_headline ? `<p class="jo-reframe-headline">${profile.current_headline}</p>` : ''}
                    <ul class="st-bullets">${currentBullets}</ul>
                    <button class="jo-copy-btn" id="jo-copy-current">COPY →</button>
                </div>

                <div class="jo-reframe-block jo-reframe-block--target">
                    <p class="jo-reframe-tag">[ WHERE YOUR PATTERN LEADS ]</p>
                    <p class="jo-reframe-role">${profile.target_role || ''}</p>
                    ${profile.target_headline ? `<p class="jo-reframe-headline">${profile.target_headline}</p>` : ''}
                    <ul class="st-bullets">${targetBullets}</ul>
                    <button class="jo-copy-btn" id="jo-copy-target">COPY →</button>
                </div>
            </div>

            ${profile.gap_note ? `
                <div class="jo-sub-section">
                    <p class="jo-section-label">── WHAT IS STILL MISSING ────────────────────</p>
                    <p class="jo-text-block">${profile.gap_note}</p>
                    <p class="jo-text-note">Your directives will target this directly.</p>
                </div>
            ` : ''}
        </div>
    `;

    // Wire refresh button
    const refreshBtn = document.getElementById('jo-panel-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            playUIClick();
            _triggerManualRefresh(container, 'PROFILE', role);
        });
    }

    // Wire copy buttons
    function wireCopy(btnId, text) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            playUIClick();
            navigator.clipboard.writeText(text).then(() => {
                const orig = btn.textContent;
                btn.textContent = '✓ COPIED';
                setTimeout(() => { btn.textContent = orig; }, 2500);
            }).catch(() => {});
        });
    }

    if (isChronicler) {
        wireCopy('jo-copy-cv', profile.full_cv || '');
    } else {
        wireCopy('jo-copy-summary', profile.summary || '');
        wireCopy('jo-copy-skills',  profile.skills_section || '');
    }

    const currentText = (profile.current_headline ? profile.current_headline + '\n\n' : '')
        + (profile.current_bullets || []).map(b => '• ' + b).join('\n');
    const targetText  = (profile.target_headline  ? profile.target_headline  + '\n\n' : '')
        + (profile.target_bullets  || []).map(b => '• ' + b).join('\n');

    wireCopy('jo-copy-current', currentText);
    wireCopy('jo-copy-target',  targetText);
}

// ─── MARKET READ PANEL ────────────────────────────────────────
function renderJobOpsMarketRead(container) {
    if (!container) return;

    if (typeof hasNeuralLink === 'function' && !hasNeuralLink()) {
        _joNoKeyState(container, 'MARKET READ');
        return;
    }

    const market   = (typeof loadJobOpsMarket === 'function') ? loadJobOpsMarket() : null;
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    const role     = pathData ? (pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || '') : '';

    if (!market) {
        _joLoadingState(container, 'MARKET READ', role, 60000);
        return;
    }

    const demand     = market.demand_signal     || {};
    const skillShift = market.skill_shift       || {};
    const adjacent   = market.adjacent_opportunity || {};
    const levelClass = `jo-demand-level--${(demand.level || 'stable').toLowerCase()}`;

    container.innerHTML = `
        <div class="jo-panel-inner">
            <p class="jo-section-label">[ MARKET READ ]</p>
            ${_joRefreshHeader(container, market.cachedAt, market.live_data_used)}

            <div class="jo-sub-section">
                <p class="jo-section-label">── DEMAND ───────────────────────────────────</p>
                <p class="jo-demand-level ${levelClass}">${(demand.level || 'STABLE').toUpperCase()}</p>
                <p class="jo-text-block">${demand.summary || ''}</p>
                <p class="jo-text-note">${demand.driver || ''}</p>
            </div>

            <div class="jo-sub-section">
                <p class="jo-section-label">── SKILL SHIFT ──────────────────────────────</p>
                <p class="jo-skill-name">${skillShift.skill || ''}</p>
                <p class="jo-text-block">${skillShift.why || ''}</p>
            </div>

            <div class="jo-sub-section">
                <p class="jo-section-label">── ADJACENT OPPORTUNITY ─────────────────────</p>
                <p class="jo-skill-name">${adjacent.role || ''}</p>
                <p class="jo-text-block">${adjacent.why || ''}</p>
            </div>

            <div class="jo-sub-section">
                <p class="jo-section-label">── YOUR NEXT MOVE ───────────────────────────</p>
                <p class="jo-text-block">${market.visibility_action || ''}</p>
            </div>
        </div>
    `;

    const refreshBtn = document.getElementById('jo-panel-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            playUIClick();
            _triggerManualRefresh(container, 'MARKET READ', role);
        });
    }
}

// ─── JOB HUNT PANEL ───────────────────────────────────────────
function renderJobOpsHunt(container) {
    if (!container) return;

    if (typeof hasNeuralLink === 'function' && !hasNeuralLink()) {
        _joNoKeyState(container, 'JOB HUNT');
        return;
    }

    const market   = (typeof loadJobOpsMarket === 'function') ? loadJobOpsMarket() : null;
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    const role     = pathData ? (pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || '') : '';
    const profile  = (typeof loadJobOpsProfile === 'function') ? loadJobOpsProfile() : null;

    const currentIntent = localStorage.getItem(_JOB_OPS_INTENT_KEY) || 'building';

    const intentLabels = {
        hunting:  'ACTIVELY HUNTING',
        building: 'BUILDING TOWARD A MOVE',
        growing:  'GROWING IN PLACE'
    };

    const intentBar = `
        <div class="jo-intent-bar">
            <p class="jo-section-label">WHERE ARE YOU RIGHT NOW?</p>
            <div class="jo-intent-options">
                ${['hunting', 'building', 'growing'].map(intent => `
                    <button class="jo-intent-btn ${currentIntent === intent ? 'jo-intent-btn--active' : ''}"
                        data-intent="${intent}">${intentLabels[intent]}</button>
                `).join('')}
            </div>
        </div>
    `;

    if (!market) {
        container.innerHTML = `
            <div class="jo-panel-inner">
                <p class="jo-section-label">[ JOB HUNT ]</p>
                ${intentBar}
                <div class="jo-loading-bar"><div class="jo-loading-fill"></div></div>
                <p class="jo-state-msg">SYD is preparing your hunt strategy.</p>
            </div>
        `;
        _wireIntentBar(container, role);
        return;
    }

    const strings   = market.search_strings     || [];
    const strategy  = market.visibility_strategy || {};
    const keywords  = strategy.keywords_to_add  || [];
    const communities = strategy.communities    || [];
    const gapNote   = profile ? (profile.gap_note || '') : '';

    let panelContent = '';

    if (currentIntent === 'hunting') {
        panelContent = `
            <div class="jo-sub-section">
                <p class="jo-section-label">── JOB SEARCH ───────────────────────────────</p>
                <p class="jo-text-note">Run these searches. Each opens the right jobs for your path.</p>
                ${strings.map((s, i) => `
                    <div class="jo-search-string-block">
                        <p class="jo-search-label">${s.label || ''}</p>
                        <p class="jo-search-query" id="jo-query-${i}">${s.query || ''}</p>
                        <button class="jo-copy-btn" data-copy-query="${i}">COPY →</button>
                    </div>
                `).join('')}
            </div>
            <div class="jo-sub-section">
                <p class="jo-section-label">── HOW TO BE FOUND ──────────────────────────</p>
                <p class="jo-text-note">LinkedIn headline formula:</p>
                <p class="jo-search-query" id="jo-headline-formula">${strategy.headline_formula || ''}</p>
                <button class="jo-copy-btn" id="jo-copy-headline">COPY →</button>
                ${keywords.length > 0 ? `
                    <p class="jo-text-note" style="margin-top:12px;">Add these keywords to your CV and profile:</p>
                    <div class="jo-keyword-tags">
                        ${keywords.map(k => `<span class="jo-keyword-tag">${k}</span>`).join('')}
                    </div>
                ` : ''}
                ${communities.length > 0 ? `
                    <p class="jo-text-note" style="margin-top:12px;">Where people in your field are:</p>
                    <ul class="jo-communities-list">
                        ${communities.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                ` : ''}
                ${strategy.content_angle ? `
                    <p class="jo-text-note" style="margin-top:12px;">What to publish publicly:</p>
                    <p class="jo-text-block">${strategy.content_angle}</p>
                ` : ''}
            </div>
        `;
    } else if (currentIntent === 'building') {
        panelContent = `
            <div class="jo-sub-section">
                <p class="jo-section-label">── POSITIONING ──────────────────────────────</p>
                <p class="jo-text-block">You are not hunting yet. Use this time.</p>
                <p class="jo-text-note">LinkedIn headline formula:</p>
                <p class="jo-search-query">${strategy.headline_formula || ''}</p>
                ${keywords.length > 0 ? `
                    <p class="jo-text-note" style="margin-top:12px;">Add these keywords to your CV and profile now, before you need them:</p>
                    <div class="jo-keyword-tags">
                        ${keywords.map(k => `<span class="jo-keyword-tag">${k}</span>`).join('')}
                    </div>
                ` : ''}
                ${communities.length > 0 ? `
                    <p class="jo-text-note" style="margin-top:12px;">Where to be visible:</p>
                    <ul class="jo-communities-list">
                        ${communities.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                ` : ''}
                ${strategy.content_angle ? `
                    <p class="jo-text-note" style="margin-top:12px;">What to write about:</p>
                    <p class="jo-text-block">${strategy.content_angle}</p>
                ` : ''}
            </div>
            <div class="jo-sub-section">
                <p class="jo-section-label">── WHEN YOU ARE READY ───────────────────────</p>
                <p class="jo-text-note">Your search strings will be here.</p>
                ${strings.map((s, i) => `
                    <div class="jo-search-string-block jo-dimmed-block">
                        <p class="jo-search-label">${s.label || ''}</p>
                        <p class="jo-search-query">${s.query || ''}</p>
                        <p class="jo-dimmed-note">Switch to Actively Hunting to copy these.</p>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // growing
        const demand = market.demand_signal || {};
        const skillShift = market.skill_shift || {};
        const levelClass = `jo-demand-level--${(demand.level || 'stable').toLowerCase()}`;

        panelContent = `
            <div class="jo-sub-section">
                <p class="jo-section-label">── MARKET AWARENESS ─────────────────────────</p>
                <p class="jo-text-block">You are not looking. But the market is moving.</p>
                <p class="jo-demand-level ${levelClass}">${(demand.level || 'STABLE').toUpperCase()}</p>
                <p class="jo-text-block">${demand.summary || ''}</p>
                ${skillShift.skill ? `
                    <p class="jo-skill-name" style="margin-top:12px;">${skillShift.skill}</p>
                    <p class="jo-text-block">${skillShift.why || ''}</p>
                ` : ''}
                ${gapNote ? `
                    <p class="jo-section-label" style="margin-top:16px;">── THE GAP ───────────────────────────────────</p>
                    <p class="jo-text-block">${gapNote}</p>
                ` : ''}
                <p class="jo-text-note" style="margin-top:12px;">Your directives are already targeting this.</p>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="jo-panel-inner">
            <p class="jo-section-label">[ JOB HUNT ]</p>
            ${_joRefreshHeader(container, market.cachedAt, market.live_data_used)}
            ${intentBar}
            <div id="jo-hunt-content">
                ${panelContent}
            </div>
        </div>
    `;

    // Wire refresh
    const refreshBtn = document.getElementById('jo-panel-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            playUIClick();
            _triggerManualRefresh(container, 'JOB HUNT', role);
        });
    }

    // Wire copy buttons for search strings
    document.querySelectorAll('[data-copy-query]').forEach(btn => {
        const idx = parseInt(btn.dataset.copyQuery, 10);
        const query = (strings[idx] || {}).query || '';
        btn.addEventListener('click', () => {
            playUIClick();
            navigator.clipboard.writeText(query).then(() => {
                btn.textContent = '✓ COPIED';
                setTimeout(() => { btn.textContent = 'COPY →'; }, 2500);
            }).catch(() => {});
        });
    });

    // Wire headline copy
    const headlineCopy = document.getElementById('jo-copy-headline');
    if (headlineCopy) {
        headlineCopy.addEventListener('click', () => {
            playUIClick();
            navigator.clipboard.writeText(strategy.headline_formula || '').then(() => {
                headlineCopy.textContent = '✓ COPIED';
                setTimeout(() => { headlineCopy.textContent = 'COPY →'; }, 2500);
            }).catch(() => {});
        });
    }

    _wireIntentBar(container, role);
}

// Wires intent toggle buttons — updates localStorage and re-renders hunt panel.
function _wireIntentBar(container, role) {
    document.querySelectorAll('.jo-intent-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            localStorage.setItem(_JOB_OPS_INTENT_KEY, btn.dataset.intent);
            window._jobOpsPanel = 'hunt';
            renderJobOpsHunt(container);
        });
    });
}