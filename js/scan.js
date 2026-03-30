// ═══════════════════════════════════════════════════════════════
// SYD GES — scan.js  (Batch 2)
// The Scan: three experiences that read the operative before
// they read themselves.
//
//   Signal Breach      — pattern recognition, cognitive flexibility, persistence
//   Precision Shooter  — execution speed, execution accuracy, pressure stability
//   Final Transmission — social reading
//
// Trait scores are 0–1 floats, calculated from real performance.
// Never shown to the operative. Fed into stat seeding via seedStatsFromTraits().
// All three games available for replay after onboarding via minigames.js.
//
// BLOCK C changes:
//   - Call 1 (scan analysis) fires immediately after completeScan().
//     Result is stored in localStorage under syd_scan_commentary.
//   - renderScanReveal() in app.js already renders bars from local data
//     (instant). Call 1 result updates the SYD commentary lines in place
//     when the Gemini response arrives — no spinner, no blocking wait.
//   - fireScanAnalysis(traits) — fires Call 1, stores result, signals
//     app.js to update the reveal screen if it is still visible.
//   - getScanCommentary() — loads cached Call 1 result from localStorage.
//   - clearScanCommentary() — called if scan is replayed so stale
//     commentary is not shown for new scores.
//   - Local fallback: TRAIT_DESCRIPTIONS in status.js. If Call 1 has not
//     returned yet when the reveal screen renders, the local descriptions
//     are already showing and nothing changes.
// ═══════════════════════════════════════════════════════════════

// ─── TRAIT DEFINITIONS ───────────────────────────────────────
const SCAN_TRAITS_KEY      = 'syd_scan_traits';
const SCAN_COMMENTARY_KEY  = 'syd_scan_commentary';

const TRAIT_NAMES = [
    'executionSpeed',
    'executionAccuracy',
    'cognitiveFlexibility',
    'patternRecognition',
    'pressureStability',
    'persistence',
    'socialReading'
];

// [TUNING TARGET] Trait to stat weight distribution
const TRAIT_STAT_WEIGHTS = {
    executionSpeed:       { agility:      0.8,  strength:   0.2  },
    executionAccuracy:    { agility:      0.5,  strength:   0.5  },
    cognitiveFlexibility: { intelligence: 0.5,  agility:    0.5  },
    patternRecognition:   { intelligence: 0.6,  agility:    0.4  },
    pressureStability:    { strength:     0.5,  endurance:  0.5  },
    persistence:          { strength:     0.3,  endurance:  0.7  },
    socialReading:        { charisma:     1.0                     }
};

// [TUNING TARGET] Maximum stat points a scan can seed above STAT_FLOOR
const SCAN_SEED_MAX_PER_STAT = 5;

function saveScanTraits(traits) {
    localStorage.setItem(SCAN_TRAITS_KEY, JSON.stringify(traits));
}
function loadScanTraits() {
    try { const r = localStorage.getItem(SCAN_TRAITS_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
}

// ─── SCAN COMMENTARY CACHE ───────────────────────────────────
// Stores Call 1 result from Gemini so it survives page navigation.
// Shape: { highest_trait_read, lowest_trait_read, signal_summary, forward_line }
function saveScanCommentary(commentary) {
    try { localStorage.setItem(SCAN_COMMENTARY_KEY, JSON.stringify(commentary)); }
    catch(e) { /* ignore — commentary is enhancement, not essential */ }
}
function getScanCommentary() {
    try {
        const raw = localStorage.getItem(SCAN_COMMENTARY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}
function clearScanCommentary() {
    try { localStorage.removeItem(SCAN_COMMENTARY_KEY); } catch(e) {}
}

// Converts raw trait scores (0–1) into stat seed bonuses.
// Called by createPlayer() in app.js after scan completes.
function seedStatsFromTraits(traits) {
    const seeds = { strength: 0, intelligence: 0, agility: 0, endurance: 0, charisma: 0 };
    if (!traits) return seeds;
    TRAIT_NAMES.forEach(trait => {
        const score   = traits[trait] || 0;
        const weights = TRAIT_STAT_WEIGHTS[trait] || {};
        Object.entries(weights).forEach(([stat, weight]) => {
            seeds[stat] = (seeds[stat] || 0) + score * weight * SCAN_SEED_MAX_PER_STAT;
        });
    });
    Object.keys(seeds).forEach(stat => {
        seeds[stat] = Math.min(SCAN_SEED_MAX_PER_STAT * 2, Math.round(seeds[stat] * 10) / 10);
    });
    return seeds;
}

// ─── SCAN STATE ──────────────────────────────────────────────
let scanState = {
    phase:         null,
    traits:        {},
    operativeName: null,
    onComplete:    null
};

// ─── SCAN ENTRY POINT ────────────────────────────────────────
function runScan(name, onComplete) {
    scanState.operativeName = name;
    scanState.traits        = {};
    scanState.onComplete    = onComplete;
    // Clear any stale commentary from a previous scan session
    clearScanCommentary();
    showScreen('screen-scan');
    renderScanIntro();
}

// ─── SCAN INTRO ───────────────────────────────────────────────
function renderScanIntro() {
    updateScanProgress(0, 3, 'SIGNAL ACQUISITION PENDING');
    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-intro">
            <div class="scan-syd-voice" id="scan-syd-voice"></div>
            <div class="scan-action" id="scan-action" style="opacity:0;transition:opacity 0.4s ease;">
                <button class="btn btn--primary" id="scan-begin-btn">[ BEGIN SCAN ]</button>
            </div>
        </div>
    `;

    const lines = [
        'I need to read you before I can serve you.',
        'Three experiences. Short.',
        'You will not know what I am measuring.',
        'That is intentional.'
    ];

    const voiceEl = document.getElementById('scan-syd-voice');
    let idx = 0;
    function nextLine() {
        if (idx >= lines.length) {
            const action = document.getElementById('scan-action');
            if (action) action.style.opacity = '1';
            const btn = document.getElementById('scan-begin-btn');
            if (btn) btn.addEventListener('click', () => { playUIClick(); runSignalBreach(); });
            return;
        }
        const el = document.createElement('p');
        el.className   = 'scan-voice-line';
        el.textContent = lines[idx];
        voiceEl.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('scan-voice-line--visible')));
        idx++;
        setTimeout(nextLine, 850);
    }
    nextLine();
}

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE 1 — SIGNAL BREACH
// Measures: Pattern Recognition, Cognitive Flexibility, Persistence
//
// A 4x4 grid of nodes. Some are lit forming a partial pattern.
// The operative taps the one node that completes the pattern
// before the countdown closes the section. Three rounds.
// Round 2: the connection rule changes (horizontal -> diagonal).
// Round 3: two rules apply simultaneously.
//
// patternRecognition   = correct picks / total rounds
// cognitiveFlexibility = accuracy on rule-change rounds (2 and 3)
// persistence          = attempts made / rounds shown
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Signal Breach round duration
const SB_ROUND_DURATION_MS = 5000;
const SB_ROUNDS            = 3;
const SB_GRID_SIZE         = 4;

let sbState = null;

function runSignalBreach() {
    updateScanProgress(1, 3, 'SIGNAL BREACH — READING PATTERN ENGINE');
    scanState.phase = 'signal_breach';

    sbState = {
        round:       0,
        correct:     0,
        attempted:   0,
        flexCorrect: 0,
        flexRounds:  0,
        timer:       null,
        timeLeft:    SB_ROUND_DURATION_MS
    };

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-game scan-game--signal-breach" id="sb-game">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ SIGNAL BREACH ]</span>
                <span class="sb-round-label" id="sb-round-label">ROUND 1 / ${SB_ROUNDS}</span>
            </div>
            <p class="sb-rule-text" id="sb-rule-text">Complete the pattern. Tap the node that connects the sequence.</p>
            <div class="sb-timer-bar-wrap">
                <div class="sb-timer-bar" id="sb-timer-bar"></div>
            </div>
            <div class="sb-grid" id="sb-grid"></div>
            <p class="sb-feedback" id="sb-feedback">&nbsp;</p>
        </div>
    `;

    renderSBRound();
}

function getSBRoundConfig(round) {
    // Grid is 4x4 = 16 nodes (index 0–15, row-major).
    // lit: nodes already highlighted as part of the pattern.
    // correct: index of the one node that completes it.
    // decoys: visually adjacent but wrong nodes.
    const configs = [
        {
            rule:    'Complete the horizontal sequence.',
            lit:     [0, 1, 2],
            correct: 3,
            decoys:  [7, 11, 15]
        },
        {
            rule:    '[ RULE CHANGE ] The pattern has shifted. Complete the diagonal.',
            lit:     [0, 5, 10],
            correct: 15,
            decoys:  [3, 12, 11]
        },
        {
            rule:    '[ COMPOUND PATTERN ] Two rules are active. Complete the L-shape.',
            lit:     [0, 4, 8, 9, 10],
            correct: 11,
            decoys:  [3, 12, 7]
        }
    ];
    return configs[round] || configs[0];
}

function renderSBRound() {
    const config    = getSBRoundConfig(sbState.round);
    const roundEl   = document.getElementById('sb-round-label');
    const ruleEl    = document.getElementById('sb-rule-text');
    const feedEl    = document.getElementById('sb-feedback');
    const gridEl    = document.getElementById('sb-grid');
    const timerEl   = document.getElementById('sb-timer-bar');

    if (roundEl) roundEl.textContent = `ROUND ${sbState.round + 1} / ${SB_ROUNDS}`;
    if (ruleEl)  ruleEl.textContent  = config.rule;
    if (feedEl)  feedEl.textContent  = '\u00a0';

    if (!gridEl) return;
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${SB_GRID_SIZE}, 1fr)`;

    const totalNodes = SB_GRID_SIZE * SB_GRID_SIZE;
    const allTargets = new Set([...config.lit, config.correct, ...config.decoys]);

    for (let i = 0; i < totalNodes; i++) {
        const node = document.createElement('button');
        node.className    = 'sb-node';
        node.dataset.idx  = i;

        if (config.lit.includes(i))    node.classList.add('sb-node--lit');
        if (config.decoys.includes(i)) node.classList.add('sb-node--decoy');
        if (i === config.correct)      node.classList.add('sb-node--target');

        // Only tappable if it is a target or decoy (not a lit node or blank)
        if (i === config.correct || config.decoys.includes(i)) {
            node.addEventListener('click', () => handleSBTap(i, config));
        } else {
            node.disabled = true;
        }
        gridEl.appendChild(node);
    }

    // Start countdown timer
    sbState.timeLeft = SB_ROUND_DURATION_MS;
    if (sbState.timer) clearInterval(sbState.timer);
    const startTime = Date.now();
    sbState.timer = setInterval(() => {
        const elapsed  = Date.now() - startTime;
        const pct      = Math.max(0, 1 - elapsed / SB_ROUND_DURATION_MS);
        if (timerEl) timerEl.style.width = (pct * 100) + '%';
        if (pct <= 0) {
            clearInterval(sbState.timer);
            // Time expired — count as attempted, not correct
            sbState.attempted++;
            if (sbState.round >= 1) sbState.flexRounds++;
            advanceSBRound(false);
        }
    }, 80);
}

function handleSBTap(nodeIdx, config) {
    if (sbState.timer) clearInterval(sbState.timer);
    sbState.attempted++;

    const isCorrect = nodeIdx === config.correct;
    if (isCorrect) {
        sbState.correct++;
        if (sbState.round >= 1) {
            sbState.flexRounds++;
            sbState.flexCorrect++;
        }
    } else {
        if (sbState.round >= 1) sbState.flexRounds++;
    }

    const feedEl = document.getElementById('sb-feedback');
    if (feedEl) feedEl.textContent = isCorrect ? '[ CONFIRMED ]' : '[ INCORRECT ]';

    // Highlight result
    const nodes = document.querySelectorAll('.sb-node');
    nodes.forEach(n => { n.disabled = true; });
    const targetNode = document.querySelector(`.sb-node[data-idx="${config.correct}"]`);
    if (targetNode) targetNode.classList.add(isCorrect ? 'sb-node--success' : 'sb-node--revealed');
    if (!isCorrect) {
        const tappedNode = document.querySelector(`.sb-node[data-idx="${nodeIdx}"]`);
        if (tappedNode) tappedNode.classList.add('sb-node--wrong');
    }

    setTimeout(() => advanceSBRound(isCorrect), 900);
}

function advanceSBRound(wasCorrect) {
    sbState.round++;
    if (sbState.round >= SB_ROUNDS) {
        completeSB();
    } else {
        renderSBRound();
    }
}

function completeSB() {
    const total      = SB_ROUNDS;
    const pattern    = sbState.correct / total;
    const flex       = sbState.flexRounds > 0 ? sbState.flexCorrect / sbState.flexRounds : 0.3;
    const persist    = sbState.attempted / total;

    scanState.traits.patternRecognition   = parseFloat(Math.min(1, pattern).toFixed(2));
    scanState.traits.cognitiveFlexibility = parseFloat(Math.min(1, flex).toFixed(2));
    scanState.traits.persistence          = parseFloat(Math.min(1, persist).toFixed(2));

    showScanBridge('SIGNAL BREACH COMPLETE', runPrecisionShooter);
}

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE 2 — PRECISION SHOOTER
// Measures: Execution Speed, Execution Accuracy, Pressure Stability
//
// A canvas-based tapping game. Targets appear one at a time.
// Hit the target before it expires. Three waves of increasing speed.
// Wave 1: slow. Wave 2: medium. Wave 3: fast.
//
// executionSpeed    = hits / total targets (normalised)
// executionAccuracy = hits / attempts (normalised)
// pressureStability = wave 3 hit rate / wave 1 hit rate
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Precision Shooter parameters
const PS_WAVES           = 3;
const PS_TARGETS_PER_WAVE = 5;
const PS_DURATIONS_MS    = [2200, 1600, 1100];   // [TUNING TARGET] ms per wave
const PS_TARGET_SIZE_PX  = 52;                   // [TUNING TARGET] touch target size

let psState = null;

function runPrecisionShooter() {
    updateScanProgress(2, 3, 'PRECISION SHOOTER — READING EXECUTION ENGINE');
    scanState.phase = 'precision_shooter';

    psState = {
        wave:         0,
        targetIdx:    0,
        hits:         0,
        attempts:     0,
        totalTargets: PS_WAVES * PS_TARGETS_PER_WAVE,
        waveHits:     [0, 0, 0],
        waveAttempts: [0, 0, 0],
        animFrame:    null,
        activeTimer:  null
    };

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-game scan-game--precision-shooter" id="ps-game">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ PRECISION SHOOTER ]</span>
                <span class="ps-wave-label" id="ps-wave-label">WAVE 1 / ${PS_WAVES}</span>
            </div>
            <div class="ps-stats-bar">
                <span class="ps-stat">HITS: <strong id="ps-hits">0</strong></span>
            </div>
            <canvas id="ps-canvas" class="ps-canvas"></canvas>
            <p class="ps-cue" id="ps-cue">Tap the target before it closes.</p>
        </div>
    `;

    // Size canvas to match container
    const canvas = document.getElementById('ps-canvas');
    if (canvas) {
        canvas.width  = canvas.offsetWidth  || 320;
        canvas.height = canvas.offsetHeight || 320;
    }

    startPSWave();
}

function startPSWave() {
    const waveEl = document.getElementById('ps-wave-label');
    if (waveEl) waveEl.textContent = `WAVE ${psState.wave + 1} / ${PS_WAVES}`;
    psState.targetIdx = 0;
    showPSTarget();
}

function showPSTarget() {
    const canvas = document.getElementById('ps-canvas');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const dur    = PS_DURATIONS_MS[psState.wave] || PS_DURATIONS_MS[0];
    const size   = PS_TARGET_SIZE_PX;
    const margin = size / 2 + 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const x = margin + Math.random() * (canvas.width  - margin * 2);
    const y = margin + Math.random() * (canvas.height - margin * 2);

    // Animate target appearing
    let startTime = null;
    function drawTarget(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const scale   = Math.min(1, elapsed / 150);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = scale;
        ctx.fillStyle   = 'var(--accent)';
        ctx.beginPath();
        ctx.arc(x, y, (size / 2) * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (scale < 1) psState.animFrame = requestAnimationFrame(drawTarget);
    }
    psState.animFrame = requestAnimationFrame(drawTarget);

    function onTap(e) {
        e.preventDefault();
        const rect  = canvas.getBoundingClientRect();
        const tapX  = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const tapY  = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        const dist  = Math.hypot(tapX - x, tapY - y);
        const isHit = dist <= (size / 2) + 8; // 8px touch tolerance

        if (psState.activeTimer) { clearTimeout(psState.activeTimer); psState.activeTimer = null; }
        cancelAnimationFrame(psState.animFrame);

        psState.attempts++;
        psState.waveAttempts[psState.wave]++;

        if (isHit) {
            psState.hits++;
            psState.waveHits[psState.wave]++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'var(--accent)';
            ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#ff4d4d';
            ctx.lineWidth   = 1.5;
            ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }

        const hitsEl = document.getElementById('ps-hits');
        if (hitsEl) hitsEl.textContent = psState.hits;
        setTimeout(() => advancePSTarget(), 300);
    }

    canvas.addEventListener('click',      onTap);
    canvas.addEventListener('touchstart', onTap, { passive: false });

    psState.activeTimer = setTimeout(() => {
        cancelAnimationFrame(psState.animFrame);
        canvas.removeEventListener('click',      onTap);
        canvas.removeEventListener('touchstart', onTap);
        // Target expired — counts as missed attempt
        psState.attempts++;
        psState.waveAttempts[psState.wave]++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        setTimeout(() => advancePSTarget(), 250);
    }, dur);
}

function advancePSTarget() {
    psState.targetIdx++;
    if (psState.targetIdx >= PS_TARGETS_PER_WAVE) {
        psState.wave++;
        if (psState.wave >= PS_WAVES) {
            completePS();
        } else {
            const canvas = document.getElementById('ps-canvas');
            if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            setTimeout(() => startPSWave(), 500);
        }
    } else {
        showPSTarget();
    }
}

function completePS() {
    const speed    = psState.hits / psState.totalTargets;
    const accuracy = psState.attempts > 0 ? psState.hits / psState.attempts : 0.3;
    const w1Rate   = psState.waveHits[0] / PS_TARGETS_PER_WAVE;
    const w3Rate   = psState.waveHits[2] / PS_TARGETS_PER_WAVE;
    const stability = w1Rate > 0
        ? Math.min(1, w3Rate / w1Rate)
        : (w3Rate > 0 ? 0.65 : 0.3);

    scanState.traits.executionSpeed    = parseFloat(Math.min(1, speed).toFixed(2));
    scanState.traits.executionAccuracy = parseFloat(Math.min(1, accuracy).toFixed(2));
    scanState.traits.pressureStability = parseFloat(Math.min(1, stability).toFixed(2));

    showScanBridge('PRECISION SHOOTER COMPLETE', runFinalTransmission);
}

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE 3 — FINAL TRANSMISSION
// Measures: Social Reading
//
// Three short social scenarios. Each has three response options.
// The operative picks the one that reads the room best.
// No correct/incorrect feedback shown. SYD just acknowledges.
// Options are scored 0.0, 0.5, or 1.0 internally.
// Social reading score = average across three scenarios.
// ═══════════════════════════════════════════════════════════════

const FT_SCENARIOS = [
    {
        situation: 'A colleague messages you: "I think we should talk." Nothing else.',
        options: [
            { text: 'Reply immediately: "Sure, when are you free?"',                                      score: 0.5 },
            { text: 'Wait to see if they follow up with more context.',                                   score: 0.3 },
            { text: 'Reply: "Of course — do you want to find a time, or is this urgent?"',               score: 1.0 }
        ]
    },
    {
        situation: 'In a meeting you say something. The room goes quiet. Your manager gives a small nod but says nothing.',
        options: [
            { text: 'Keep talking — fill the silence with more detail.',                                  score: 0.3 },
            { text: 'Pause and let the silence sit. See what comes next.',                                score: 1.0 },
            { text: 'Ask immediately if anyone has questions.',                                           score: 0.5 }
        ]
    },
    {
        situation: 'Someone on your team delivers work that misses the brief. They seem proud of it.',
        options: [
            { text: 'Point out clearly what is missing so they can fix it.',                              score: 0.5 },
            { text: 'Acknowledge what worked first, then walk through what needs to shift.',              score: 1.0 },
            { text: 'Say it looks good and quietly revise it yourself later.',                            score: 0.0 }
        ]
    }
];

let ftState = null;

function runFinalTransmission() {
    updateScanProgress(3, 3, 'FINAL TRANSMISSION — READING SOCIAL ENGINE');
    scanState.phase = 'final_transmission';
    ftState = { scenario: 0, totalScore: 0 };
    renderFTScenario();
}

function renderFTScenario() {
    const container = document.getElementById('scan-content');
    if (!container) return;

    const sc  = FT_SCENARIOS[ftState.scenario];
    const pct = Math.round((ftState.scenario / FT_SCENARIOS.length) * 100);

    container.innerHTML = `
        <div class="scan-game scan-game--final-transmission">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ FINAL TRANSMISSION ]</span>
                <span class="ft-round-label">SCENARIO ${ftState.scenario + 1} / ${FT_SCENARIOS.length}</span>
            </div>
            <div class="ft-progress-wrap">
                <div class="ft-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="ft-situation">
                <p class="ft-situation-text">${sc.situation}</p>
            </div>
            <div class="ft-options" id="ft-options">
                ${sc.options.map((opt, i) => `
                    <button class="ft-option" data-opt-idx="${i}">${opt.text}</button>
                `).join('')}
            </div>
        </div>
    `;

    document.querySelectorAll('.ft-option').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.ft-option').forEach(b => b.disabled = true);
            btn.classList.add('ft-option--selected');
            const idx   = parseInt(btn.dataset.optIdx, 10);
            ftState.totalScore += sc.options[idx].score;
            setTimeout(() => {
                ftState.scenario++;
                if (ftState.scenario >= FT_SCENARIOS.length) {
                    completeFT();
                } else {
                    renderFTScenario();
                }
            }, 650);
        });
    });
}

function completeFT() {
    const avg = ftState.totalScore / FT_SCENARIOS.length;
    scanState.traits.socialReading = parseFloat(Math.min(1, avg).toFixed(2));
    completeScan();
}

// ─── SCAN COMPLETE ────────────────────────────────────────────
// BLOCK C: After saving traits, fires Call 1 (scan analysis) in the
// background. The reveal screen renders immediately from local data.
// When Call 1 resolves, it stores the result and updates the SYD
// commentary lines in place — if the reveal screen is still visible.
function completeScan() {
    updateScanProgress(3, 3, 'SIGNAL ACQUISITION COMPLETE');
    saveScanTraits(scanState.traits);

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-complete">
            <div class="scan-complete-icon">⬡</div>
            <p class="scan-complete-label">[ SCAN COMPLETE ]</p>
            <p class="scan-complete-sub">Profile seeded. Proceeding to classification.</p>
        </div>
    `;

    // BLOCK C: Fire Call 1 immediately — result will arrive while the
    // operative reads the scan reveal screen. No blocking wait here.
    fireScanAnalysis(scanState.traits);

    setTimeout(() => {
        if (typeof scanState.onComplete === 'function') {
            scanState.onComplete(scanState.traits);
        }
    }, 1400);
}

// ─── BLOCK C: CALL 1 — SCAN ANALYSIS ────────────────────────
// Fires after scan completes. Input: seven trait scores.
// Output: { highest_trait_read, lowest_trait_read, signal_summary, forward_line }
//
// Result stored in localStorage under syd_scan_commentary.
// The scan reveal screen in app.js polls this via getScanCommentary()
// and updates SYD commentary lines in place when it arrives.
//
// Silent failure: if no key, network error, or quota — local TRAIT_DESCRIPTIONS
// in status.js are already showing and nothing updates. No operative-visible failure.
//
// [RESEARCH] Source: SYD Respec v2 — Call 1 spec.
// Finding: scan reveal should update SYD commentary in place, not block on AI.
// Applied: fire-and-forget pattern with DOM update on resolve.

async function fireScanAnalysis(traits) {
    if (!hasNeuralLink()) return; // No key — local fallback already showing

    const traitSummary = Object.entries(traits)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

    // Find highest and lowest trait for focused commentary
    const sorted  = Object.entries(traits).sort((a, b) => b[1] - a[1]);
    const highest = sorted[0]  ? sorted[0][0]  : 'patternRecognition';
    const lowest  = sorted[sorted.length - 1] ? sorted[sorted.length - 1][0] : 'socialReading';

    const prompt = `
You are SYD — a direct, honest career intelligence system. Provide a scan analysis for an operative who just completed three psychometric games.

TRAIT SCORES (0.0 to 1.0, higher is stronger):
${traitSummary}

Highest trait: ${highest} (${traits[highest] !== undefined ? traits[highest] : 'n/a'})
Lowest trait:  ${lowest}  (${traits[lowest]  !== undefined ? traits[lowest]  : 'n/a'})

Write four fields in SYD's voice. Rules:
- Be specific about the actual scores — reference numbers where useful
- Do not use the word "journey" or "passion" — too soft
- Short, declarative sentences. SYD is not encouraging. SYD is precise.
- Output ONLY valid JSON with exactly these four keys. No markdown. No preamble.

{
  "highest_trait_read": "1–2 sentences specific to the highest score and what it signals about this operative.",
  "lowest_trait_read": "1–2 sentences specific to the lowest score and what to expect from the directives targeting it.",
  "signal_summary": "One line in SYD voice — the overarching read of this operative's signal profile.",
  "forward_line": "One personalised line for the scan reveal screen closing — what comes next for this specific profile."
}
`.trim();

    const result = await geminiClassify(prompt);

    if (!result.ok) return; // Silent fallback — local descriptions already showing

    const parsed = extractJSON(result.text);
    if (!parsed || !parsed.signal_summary) return; // Malformed — silent fallback

    saveScanCommentary(parsed);

    // If the scan reveal screen is currently visible, update the SYD lines in place.
    // This is the "updates in place" behaviour from the respec.
    updateScanRevealCommentary(parsed);
}

// ─── UPDATE SCAN REVEAL COMMENTARY ───────────────────────────
// Called by fireScanAnalysis() when Call 1 resolves.
// If the scan reveal screen is visible and the commentary elements exist,
// replaces the local SYD lines with the personalised Gemini versions.
// No-op if the operative has already advanced past the reveal screen.
function updateScanRevealCommentary(commentary) {
    if (!commentary) return;

    // The scan reveal SYD lines are in .scan-reveal-syd-line elements.
    // app.js renders them from local data — we replace their content here
    // if the screen is still active.
    const revealScreen = document.getElementById('screen-scan-reveal');
    if (!revealScreen || !revealScreen.classList.contains('active')) return;

    const sydLines = document.querySelectorAll('.scan-reveal-syd-line');
    if (!sydLines || sydLines.length === 0) return;

    // Replace lines in order: summary, highest read, lowest read, forward line.
    // app.js renders 3–4 lines; we map our four fields onto them.
    const replacements = [
        commentary.signal_summary,
        commentary.highest_trait_read,
        commentary.lowest_trait_read,
        commentary.forward_line
    ].filter(Boolean);

    replacements.forEach((text, i) => {
        if (sydLines[i]) {
            sydLines[i].textContent = text;
            // Subtle fade-in to signal the update
            sydLines[i].style.opacity = '0';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    sydLines[i].style.transition = 'opacity 0.4s ease';
                    sydLines[i].style.opacity    = '1';
                });
            });
        }
    });
}

// ─── BRIDGE SCREEN ────────────────────────────────────────────
// Brief pause between scan experiences. No skip.
function showScanBridge(label, onContinue) {
    const container = document.getElementById('scan-content');
    if (!container) { onContinue(); return; }
    container.innerHTML = `
        <div class="scan-bridge">
            <p class="scan-bridge-label">[ ${label} ]</p>
            <p class="scan-bridge-sub">Stand by.</p>
        </div>
    `;
    setTimeout(onContinue, 950);
}

// ─── PROGRESS BAR ────────────────────────────────────────────
function updateScanProgress(current, total, label) {
    const pct     = total > 0 ? Math.round((current / total) * 100) : 0;
    const fillEl  = document.getElementById('scan-progress-fill');
    const labelEl = document.getElementById('scan-progress-label');
    if (fillEl)  fillEl.style.width  = pct + '%';
    if (labelEl) labelEl.textContent = label + ' — ' + pct + '%';
}