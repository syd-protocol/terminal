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

    // Diagnostic: log CV length so we can confirm the CV is reaching the prompt.
    // Remove this log once CV pipeline is verified end-to-end.
    console.log('[SYD] JOB OPS Call A — cvText length:', cvText ? cvText.length : 0);
    const reimagine   = pathData.reimagineResponses || null;
    const role        = pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || 'their confirmed role';
    const rank        = pathData.confirmedRank || 'F';
    const rankLabel   = (typeof careerRankLabel === 'function') ? careerRankLabel(rank) : rank;
    const name        = player ? (player.name || 'Operative') : 'Operative';

    const isChronicler = track === 'chronicler';

    // Use extracted signal for Chronicler — much smaller than raw CV,
    // prevents token budget being consumed by the input before output starts.
    // Full CV text is still passed for experience/skills generation.
    const cvSignal = isChronicler && cvText && (typeof extractCVSignals === 'function')
        ? extractCVSignals(cvText)
        : null;
    const cvSignalText = cvSignal && (typeof formatSignalForPrompt === 'function')
        ? formatSignalForPrompt(cvSignal, cvSignal.evidenceLines)
        : null;

    const cvBlock = isChronicler
        ? `CV TEXT (full):\n---\n${cvText || 'Not available'}\n---\n\nEXTRACTED SIGNAL SUMMARY:\n${cvSignalText || 'Not available'}`
        : `OPERATIVE RESPONSES:\n1. ${(reimagine || [])[0] || ''}\n2. ${(reimagine || [])[1] || ''}\n3. ${(reimagine || [])[2] || ''}\n4. ${(reimagine || [])[3] || ''}`;

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

YOUR TASK:
Produce a structured JSON object with these fields:

${cvOutputBlock}

Also include:
"track": "${track || 'unknown'}"

Return ONLY valid JSON. No markdown fences. No preamble. No explanation.
`.trim();

    const result = await geminiGenerateLiteLarge(prompt, 0.3);

    if (!result.ok) {
        console.warn('[SYD] JOB OPS Call A failed:', result.error);
        return;
    }

    const parsed = (typeof extractJSON === 'function') ? extractJSON(result.text) : null;
    if (!parsed || typeof parsed !== 'object') {
        console.warn('[SYD] JOB OPS Call A JSON parse failed.');
        return;
    }

    // Validity check — discard if Gemini returned placeholder content.
    // current_bullets and reframe fields now come from sigKit, not Gemini,
    // so we only check the fields Gemini is responsible for.
    const cvTextLower      = (parsed.full_cv || '').toLowerCase();
    const summaryLower     = (parsed.summary || '').toLowerCase();
    const skillsLower      = (parsed.skills_section || '').toLowerCase();
    const hasRealCV        = !cvTextLower.includes('not available') && cvTextLower.length > 100;
    const hasRealSummary   = !summaryLower.includes('not available') && summaryLower.length > 40;
    const hasRealSkills    = !skillsLower.includes('not available') && skillsLower.length > 20;

    // For Re-imaginer, full_cv is always empty string — only check summary + skills.
    const isValid = isChronicler
        ? (hasRealCV && hasRealSummary && hasRealSkills)
        : (hasRealSummary && hasRealSkills);

    if (!isValid) {
        console.warn('[SYD] JOB OPS Call A validity check failed — discarding response, keeping existing state.');
        return;
    }

    // Merge sigKit reframe fields — these were not re-asked of Gemini.
    // Gemini output covers: full_cv, summary, skills_section, track.
    // sigKit covers: current_role, current_headline, current_bullets,
    //                target_role, target_headline, target_bullets, gap_note.
    if (sigKit) {
        parsed.current_role     = sigKit.current_role     || '';
        parsed.current_headline = sigKit.headline_current || '';
        parsed.current_bullets  = sigKit.current_bullets  || [];
        parsed.target_role      = sigKit.target_role      || '';
        parsed.target_headline  = sigKit.headline_target  || '';
        parsed.target_bullets   = sigKit.target_bullets   || [];
        parsed.gap_note         = sigKit.gap_note         || '';
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
        // Store raw text so MARKET READ panel can render it immediately
        // while Stage 2 synthesis runs. Cleared after Stage 2 succeeds.
        localStorage.setItem('syd_job_ops_market_raw', liveData);
        // If the player has MARKET READ open right now, re-render with raw signal state
        if (window._jobOpsPanel === 'market') {
            const content = document.getElementById('job-ops-panel-content');
            if (content) renderJobOpsMarketRead(content);
        }
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

"skill_shifts": [
    {
        "skill": "The specific skill moving into demand.",
        "why": "One sentence on why this skill is rising."
    }
]
Include exactly 2 skill shifts. Both must be specific — not generic soft skills.

"adjacent_opportunities": [
    {
        "role": "The specific adjacent role title.",
        "why": "One sentence on why it is worth watching."
    }
]
Include exactly 2 adjacent opportunities. Pick roles that are genuinely reachable from the operative's current position within 1-2 years.

"next_moves": [
    {
        "action": "One specific, concrete action the operative can take in the next 30 days.",
        "effort": "low" | "medium" | "high"
    }
]
Include exactly 3 next moves. Order by effort ascending (lowest first). Each must be specific to their path and rank — not generic career advice. Mix visibility, skill-building, and networking actions.

"communities": [
    {
        "name": "The real name of the community, Slack group, Discord, forum, or platform.",
        "where": "One word: Slack | Discord | LinkedIn | Forum | Conference | Newsletter",
        "why": "One sentence on why this specific community is worth joining for their role."
    }
]
Include exactly 3 communities. Real names only. Specific to their domain and role — not generic professional networks.

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

    const stage2Result = await geminiGenerateLiteLarge(stage2Prompt, 0.4);

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
    // Stage 2 succeeded — raw signal no longer needed
    localStorage.removeItem('syd_job_ops_market_raw');
    // If MARKET READ is open, upgrade from raw signal to structured view
    if (window._jobOpsPanel === 'market') {
        const content = document.getElementById('job-ops-panel-content');
        if (content) renderJobOpsMarketRead(content);
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

// ─── COUNTDOWN STATE ─────────────────────────────────────────
// Shown in PROFILE panel when scheduleJobOpsCalls() delay is still running.
// Renders a local skeleton alongside the countdown so the panel is never blank.
// When the countdown hits zero the panel switches to loading bar state
// (calls are now in flight).
function _joCountdownState(container, pathData, player) {
    const skeleton = (typeof buildLocalCVSkeleton === 'function')
        ? buildLocalCVSkeleton(pathData, player)
        : null;

    const msRemaining = (typeof _jobOpsPendingUntil !== 'undefined')
        ? Math.max(0, _jobOpsPendingUntil - Date.now())
        : 60000;
    const secsRemaining = Math.ceil(msRemaining / 1000);

    const skeletonHTML = skeleton ? _joSkeletonHTML(skeleton) : '';

    container.innerHTML = `
        <div class="jo-panel-inner">
            <p class="jo-section-label">[ PROFILE ]</p>
            <div class="jo-countdown-block">
                <p class="jo-countdown-msg">Finishing your setup — <span id="jo-countdown-secs">${secsRemaining}</span>s. Your profile and market read are being prepared.</p>
                <div class="jo-loading-bar"><div class="jo-loading-fill"></div></div>
            </div>
            ${skeletonHTML}
        </div>
    `;

    // Decrement each second. When zero, switch to live loading bar.
    let secs = secsRemaining;
    const tick = setInterval(() => {
        secs--;
        const el = document.getElementById('jo-countdown-secs');
        if (el) el.textContent = Math.max(0, secs);
        if (secs <= 0) {
            clearInterval(tick);
            // Calls are now in flight — show loading bar without countdown
            const content = document.getElementById('job-ops-panel-content');
            if (content) _joLoadingState(content, 'PROFILE', null, null);
        }
    }, 1000);
}

// ─── SKELETON STATE ──────────────────────────────────────────
// Shown when calls have fired but no Gemini cache exists yet.
// Displays the local CV skeleton with a loading bar above it.
function _joSkeletonState(container, skeleton, role) {
    container.innerHTML = `
        <div class="jo-panel-inner">
            <p class="jo-section-label">[ PROFILE ]</p>
            <div class="jo-countdown-block">
                <p class="jo-countdown-msg">SYD is building your AI-enhanced profile.</p>
                <div class="jo-loading-bar"><div class="jo-loading-fill"></div></div>
            </div>
            ${_joSkeletonHTML(skeleton)}
        </div>
    `;
}

// Shared HTML builder for skeleton content — used by both countdown and skeleton states.
function _joSkeletonHTML(skeleton) {
    if (!skeleton) return '';
    const isChronicler = skeleton.track === 'chronicler';

    const cvOrSummaryBlock = isChronicler
        ? `
            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--profile">CV Draft</p>
                <p class="jo-skeleton-label">[ LOCAL PROFILE — SYD is preparing an AI-enhanced version ]</p>
                <div class="jo-full-cv-block">${(skeleton.full_cv || '').replace(/\n/g, '<br>')}</div>
            </div>
        `
        : `
            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--profile">Career Summary</p>
                <p class="jo-skeleton-label">[ LOCAL PROFILE — SYD is preparing an AI-enhanced version ]</p>
                <p class="jo-text-block">${skeleton.summary || ''}</p>
            </div>
            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--profile">Skills</p>
                <p class="jo-text-block">${(skeleton.skills_section || '').replace(/\n/g, '<br>')}</p>
            </div>
        `;

    const currentBullets = (skeleton.current_bullets || []).map(b => `<li class="st-bullet">${b}</li>`).join('');
    const targetBullets  = (skeleton.target_bullets  || []).map(b => `<li class="st-bullet">${b}</li>`).join('');

    const reframesBlock = (skeleton.current_role || skeleton.target_role) ? `
        <div class="jo-sub-section">
            <p class="jo-section-heading jo-section-heading--profile">Role Reframes</p>
            <div class="jo-reframe-block">
                <p class="jo-reframe-tag">[ APPLY FOR THIS NOW ]</p>
                <p class="jo-reframe-role">${skeleton.current_role || ''}</p>
                ${skeleton.current_headline ? `<p class="jo-reframe-headline">${skeleton.current_headline}</p>` : ''}
                <ul class="st-bullets">${currentBullets}</ul>
            </div>
            <div class="jo-reframe-block jo-reframe-block--target">
                <p class="jo-reframe-tag">[ WHERE YOUR PATTERN LEADS ]</p>
                <p class="jo-reframe-role">${skeleton.target_role || ''}</p>
                ${skeleton.target_headline ? `<p class="jo-reframe-headline">${skeleton.target_headline}</p>` : ''}
                <ul class="st-bullets">${targetBullets}</ul>
            </div>
        </div>
    ` : '';

    return cvOrSummaryBlock + reframesBlock;
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
    _joLoadingState(container, panelLabel, roleLabel, 60000);
    Promise.all([fireJobOpsProfile(), fireJobOpsMarket()]).then(() => {
        recordManualRefresh();
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

    const pathData  = (typeof loadPathData === 'function') ? loadPathData() : null;
    const player    = (function() {
        try { return JSON.parse(localStorage.getItem('syd_player') || 'null'); }
        catch(_) { return null; }
    })();
    const role      = pathData
        ? (pathData.confirmedRole || (pathData.confirmedPath && pathData.confirmedPath.path_name) || '')
        : '';

    let profile = (typeof loadJobOpsProfile === 'function') ? loadJobOpsProfile() : null;

    // State B — calls still pending (scheduleJobOpsCalls delay not yet elapsed).
    // Show countdown + local skeleton simultaneously so the panel is never blank.
    const pending = (typeof _jobOpsPending !== 'undefined') && _jobOpsPending;
    if (!profile && pending) {
        _joCountdownState(container, pathData, player);
        return;
    }

    // State C — calls fired but no cache yet (e.g. returned player where
    // scheduleJobOpsCalls already ran, or call in flight from checkJobOpsRefresh).
    // Show local skeleton with a loading bar. No countdown — calls are live.
    if (!profile) {
        const skeleton = (typeof buildLocalCVSkeleton === 'function')
            ? buildLocalCVSkeleton(pathData, player)
            : null;
        if (skeleton) {
            _joSkeletonState(container, skeleton, role);
        } else {
            _joLoadingState(container, 'PROFILE', null, 60000);
        }
        return;
    }

    // State D — Gemini data available (profile.isSkeleton is falsy)
    const isChronicler = profile.track === 'chronicler';
    const aspiration   = pathData ? (pathData.aspirationGoal || null) : null;

    const aspirationBlock = aspiration ? `
        <div class="jo-sub-section jo-aspiration-block">
            <p class="jo-section-heading jo-section-heading--profile">Career Signal</p>
            <p class="jo-text-note">This feeds your market read. Update it if your direction has changed, then refresh.</p>
            <div class="jo-aspiration-row tappable" id="jo-asp-tap">
                <p class="jo-text-block" id="jo-asp-display">${aspiration.careerGoal || '&mdash;'}</p>
                <span class="jo-asp-edit-hint">tap to edit</span>
            </div>
            <div class="jo-aspiration-edit hidden" id="jo-asp-expand">
                <textarea id="jo-asp-career-input" class="fn-textarea"
                    placeholder="Your career direction..."
                    maxlength="200">${aspiration.careerGoal || ''}</textarea>
                <textarea id="jo-asp-life-input" class="fn-textarea"
                    placeholder="Your life direction..."
                    maxlength="200" style="margin-top:8px;">${aspiration.lifeGoal || ''}</textarea>
                <button class="jo-copy-btn" id="jo-asp-save">SAVE</button>
            </div>
        </div>
    ` : '';

    const cvOrSummaryBlock = isChronicler
        ? `
            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--profile">CV Draft</p>
                <div class="jo-full-cv-block" id="jo-full-cv">${(profile.full_cv || '').replace(/\n/g, '<br>')}</div>
                <button class="jo-copy-btn" id="jo-copy-cv">COPY  CV DRAFT →</button>
            </div>
        `
        : `
            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--profile">Career Summary</p>
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
            <p class="jo-panel-title">[ PROFILE ]</p>
            ${_joRefreshHeader(container, profile.cachedAt, null)}

            ${aspirationBlock}

            ${cvOrSummaryBlock}

            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--profile">Role Reframes</p>

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
                    <p class="jo-section-heading jo-section-heading--profile">What Is Still Missing</p>
                    <p class="jo-text-block">${profile.gap_note}</p>
                    <p class="jo-text-note">Your directives will target this directly.</p>
                </div>
            ` : ''}
        </div>
    `;

    // Wire refresh button
    // role is derived above from pathData — safe to reference here.
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

    // Wire aspiration edit
    const aspTap    = document.getElementById('jo-asp-tap');
    const aspExpand = document.getElementById('jo-asp-expand');
    if (aspTap && aspExpand) {
        aspTap.addEventListener('click', () => {
            playUIClick();
            aspExpand.classList.toggle('hidden');
        });
    }

    const aspSave = document.getElementById('jo-asp-save');
    if (aspSave) {
        aspSave.addEventListener('click', (e) => {
            e.stopPropagation();
            playUIClick();
            const pd          = (typeof loadPathData === 'function') ? loadPathData() : null;
            const careerInput = document.getElementById('jo-asp-career-input');
            const lifeInput   = document.getElementById('jo-asp-life-input');
            if (!pd) return;

            if (!pd.aspirationGoal) pd.aspirationGoal = {};
            pd.aspirationGoal.careerGoal = careerInput ? careerInput.value.trim() : '';
            pd.aspirationGoal.lifeGoal   = lifeInput   ? lifeInput.value.trim()   : '';

            if (typeof savePathData === 'function') savePathData(pd);

            const display = document.getElementById('jo-asp-display');
            if (display) display.textContent = pd.aspirationGoal.careerGoal || '—';
            if (aspExpand) aspExpand.classList.add('hidden');
            if (typeof showLog === 'function') showLog('[ CAREER SIGNAL UPDATED — REFRESH TO APPLY ]', 'accent');
        });
    }
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

    // Raw signal state — Stage 1 has landed, Stage 2 still running.
    const rawSignal = localStorage.getItem('syd_job_ops_market_raw');
    if (!market && rawSignal) {
        container.innerHTML = `
            <div class="jo-panel-inner">
                <p class="jo-section-label">[ MARKET READ ]</p>
                <div class="jo-countdown-block">
                    <p class="jo-countdown-msg">SYD is processing the signal.</p>
                    <div class="jo-loading-bar"><div class="jo-loading-fill"></div></div>
                </div>
                <div class="jo-sub-section">
                    <p class="jo-section-label">── RAW SIGNAL ───────────────────────────────</p>
                    <p class="jo-skeleton-label">[ RAW SIGNAL — SYD is processing ]</p>
                    <div class="jo-raw-signal-block">${rawSignal.replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `;
        return;
    }

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
            <p class="jo-panel-title">[ MARKET READ ]</p>
            ${_joRefreshHeader(container, market.cachedAt, market.live_data_used)}

            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--market">Demand</p>
                <p class="jo-demand-level ${levelClass}">${(demand.level || 'STABLE').toUpperCase()}</p>
                <p class="jo-text-block">${demand.summary || ''}</p>
                <p class="jo-text-note">${demand.driver || ''}</p>
            </div>

            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--market">Skill Shifts</p>
                ${(market.skill_shifts || (skillShift.skill ? [skillShift] : [])).map(s => `
                    <div class="jo-market-item">
                        <p class="jo-skill-name">${s.skill || ''}</p>
                        <p class="jo-text-block">${s.why || ''}</p>
                    </div>
                `).join('')}
            </div>

            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--market">Adjacent Opportunities</p>
                ${(market.adjacent_opportunities || (adjacent.role ? [adjacent] : [])).map(a => `
                    <div class="jo-market-item">
                        <p class="jo-skill-name">${a.role || ''}</p>
                        <p class="jo-text-block">${a.why || ''}</p>
                    </div>
                `).join('')}
            </div>

            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--market">Next Moves</p>
                ${(market.next_moves || (market.visibility_action ? [{ action: market.visibility_action, effort: 'medium' }] : [])).map(m => `
                    <div class="jo-next-move-item">
                        <span class="jo-effort-badge jo-effort-badge--${(m.effort || 'medium').toLowerCase()}">${(m.effort || 'MEDIUM').toUpperCase()}</span>
                        <p class="jo-text-block">${m.action || ''}</p>
                    </div>
                `).join('')}
            </div>

            ${(market.communities || []).length > 0 ? `
            <div class="jo-sub-section">
                <p class="jo-section-heading jo-section-heading--market">Where To Be Present</p>
                ${market.communities.map(c => `
                    <div class="jo-market-item">
                        <div class="jo-community-row">
                            <p class="jo-skill-name">${c.name || ''}</p>
                            <span class="jo-community-where">${c.where || ''}</span>
                        </div>
                        <p class="jo-text-block">${c.why || ''}</p>
                    </div>
                `).join('')}
            </div>
            ` : ''}
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
                <p class="jo-section-heading jo-section-heading--hunt">Job Search</p>
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
                <p class="jo-section-heading jo-section-heading--hunt">How To Be Found</p>
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
            <p class="jo-panel-title">[ JOB HUNT ]</p>
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