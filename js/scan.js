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
// ═══════════════════════════════════════════════════════════════

// ─── TRAIT DEFINITIONS ───────────────────────────────────────
const SCAN_TRAITS_KEY = 'syd_scan_traits';

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
    return configs[Math.min(round, configs.length - 1)];
}

function renderSBRound() {
    const config   = getSBRoundConfig(sbState.round);
    const roundEl  = document.getElementById('sb-round-label');
    const ruleEl   = document.getElementById('sb-rule-text');
    const grid     = document.getElementById('sb-grid');
    const feedback = document.getElementById('sb-feedback');
    if (!grid) return;

    if (roundEl)  roundEl.textContent  = `ROUND ${sbState.round + 1} / ${SB_ROUNDS}`;
    if (ruleEl)   ruleEl.textContent   = config.rule;
    if (feedback) feedback.textContent = '\u00a0';

    grid.innerHTML = '';
    const total = SB_GRID_SIZE * SB_GRID_SIZE;
    for (let i = 0; i < total; i++) {
        const node = document.createElement('button');
        node.className   = 'sb-node';
        node.dataset.idx = i;
        if (config.lit.includes(i))    node.classList.add('sb-node--lit');
        if (config.decoys.includes(i)) node.classList.add('sb-node--decoy');
        node.addEventListener('click', () => onSBNodeTap(i, config));
        grid.appendChild(node);
    }

    // Start countdown timer
    clearInterval(sbState.timer);
    sbState.timeLeft = SB_ROUND_DURATION_MS;
    const timerBar   = document.getElementById('sb-timer-bar');
    sbState.timer = setInterval(() => {
        sbState.timeLeft -= 50;
        const pct = Math.max(0, sbState.timeLeft / SB_ROUND_DURATION_MS * 100);
        if (timerBar) {
            timerBar.style.width = pct + '%';
            timerBar.className   = 'sb-timer-bar' + (pct < 30 ? ' sb-timer-bar--critical' : '');
        }
        if (sbState.timeLeft <= 0) {
            clearInterval(sbState.timer);
            onSBTimeout(config);
        }
    }, 50);
}

function onSBNodeTap(idx, config) {
    clearInterval(sbState.timer);
    // Disable all nodes immediately to prevent double-tap
    document.querySelectorAll('.sb-node').forEach(n => n.disabled = true);

    sbState.attempted++;

    const feedback   = document.getElementById('sb-feedback');
    const tappedNode = document.querySelector('.sb-node[data-idx="' + idx + '"]');

    if (idx === config.correct) {
        sbState.correct++;
        if (sbState.round >= 1) { sbState.flexCorrect++; sbState.flexRounds++; }
        if (tappedNode) tappedNode.classList.add('sb-node--correct');
        playTone(660, 0.12, 'square', 0.1);
        if (feedback) { feedback.textContent = '[ SIGNAL LOCKED ]'; feedback.className = 'sb-feedback sb-feedback--correct'; }
    } else {
        if (sbState.round >= 1) sbState.flexRounds++;
        const correctNode = document.querySelector('.sb-node[data-idx="' + config.correct + '"]');
        if (tappedNode)  tappedNode.classList.add('sb-node--wrong');
        if (correctNode) correctNode.classList.add('sb-node--correct');
        playTone(220, 0.1, 'sawtooth', 0.08);
        if (feedback) { feedback.textContent = '[ INCORRECT — PATTERN REVEALED ]'; feedback.className = 'sb-feedback sb-feedback--wrong'; }
    }

    setTimeout(() => advanceSBRound(), 900);
}

function onSBTimeout(config) {
    document.querySelectorAll('.sb-node').forEach(n => n.disabled = true);
    sbState.attempted++;
    if (sbState.round >= 1) sbState.flexRounds++;

    const correctNode = document.querySelector('.sb-node[data-idx="' + config.correct + '"]');
    if (correctNode) correctNode.classList.add('sb-node--correct');

    const feedback = document.getElementById('sb-feedback');
    if (feedback) { feedback.textContent = '[ TIME EXPIRED ]'; feedback.className = 'sb-feedback sb-feedback--wrong'; }

    setTimeout(() => advanceSBRound(), 900);
}

function advanceSBRound() {
    sbState.round++;
    if (sbState.round >= SB_ROUNDS) {
        completeSB();
    } else {
        renderSBRound();
    }
}

function completeSB() {
    const pr   = sbState.attempted > 0 ? sbState.correct / SB_ROUNDS : 0.3;
    const cf   = sbState.flexRounds > 0 ? sbState.flexCorrect / sbState.flexRounds : 0.3;
    const pers = Math.min(1, sbState.attempted / SB_ROUNDS);

    scanState.traits.patternRecognition   = parseFloat(pr.toFixed(2));
    scanState.traits.cognitiveFlexibility = parseFloat(cf.toFixed(2));
    scanState.traits.persistence          = parseFloat(pers.toFixed(2));

    showScanBridge('SIGNAL BREACH COMPLETE', runPrecisionShooter);
}

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE 2 — PRECISION SHOOTER
// Measures: Execution Speed, Execution Accuracy, Pressure Stability
//
// Canvas-based. Targets appear one at a time at random positions.
// Tap to hit. Pressure increases: targets shrink and expire faster
// each wave. Three waves of five targets each.
//
// executionSpeed    = hits / total targets (responded in time)
// executionAccuracy = hits / tap attempts  (hit vs mis-tap)
// pressureStability = wave 3 accuracy relative to wave 1
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Precision Shooter wave parameters
const PS_WAVES            = 3;
const PS_TARGETS_PER_WAVE = 5;
const PS_TARGET_DURATIONS = [1800, 1300, 950];  // ms a target stays visible per wave
const PS_TARGET_SIZES     = [56,   44,   32];   // px diameter per wave

let psState = null;

function runPrecisionShooter() {
    updateScanProgress(2, 3, 'PRECISION SHOOTER — READING EXECUTION ENGINE');
    scanState.phase = 'precision_shooter';

    psState = {
        wave:         0,
        targetIdx:    0,
        hits:         0,
        attempts:     0,
        waveHits:     [0, 0, 0],
        waveAttempts: [0, 0, 0],
        activeTimer:  null,
        animFrame:    null,
        totalTargets: PS_WAVES * PS_TARGETS_PER_WAVE
    };

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-game scan-game--precision-shooter" id="ps-game">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ PRECISION SHOOTER ]</span>
                <span class="ps-wave-label" id="ps-wave-label">WAVE 1 / ${PS_WAVES}</span>
            </div>
            <p class="ps-instruction" id="ps-instruction">Tap targets as they appear. Accurate wins — not fastest.</p>
            <div class="ps-arena" id="ps-arena">
                <canvas id="ps-canvas" class="ps-canvas"></canvas>
            </div>
            <div class="ps-score-row">
                <span class="ps-score-label">HITS:&nbsp;</span>
                <span class="ps-score-val" id="ps-hits">0</span>
                <span class="ps-score-label">&nbsp;/ ${psState.totalTargets}</span>
            </div>
        </div>
    `;

    // Size canvas once layout settles
    const arena  = document.getElementById('ps-arena');
    const canvas = document.getElementById('ps-canvas');
    requestAnimationFrame(() => {
        canvas.width  = arena.offsetWidth  || 320;
        canvas.height = arena.offsetHeight || 260;
        startPSWave();
    });
}

function startPSWave() {
    const waveLabel = document.getElementById('ps-wave-label');
    if (waveLabel) waveLabel.textContent = 'WAVE ' + (psState.wave + 1) + ' / ' + PS_WAVES;
    const instr = document.getElementById('ps-instruction');
    if (instr) {
        if (psState.wave === 1) instr.textContent = '[ PRESSURE INCREASING ]';
        if (psState.wave === 2) instr.textContent = '[ FINAL WAVE — HOLD STEADY ]';
    }
    psState.targetIdx = 0;
    showPSTarget();
}

function showPSTarget() {
    const canvas = document.getElementById('ps-canvas');
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const size = PS_TARGET_SIZES[psState.wave];
    const dur  = PS_TARGET_DURATIONS[psState.wave];

    const pad = size / 2 + 10;
    const x   = pad + Math.random() * (canvas.width  - pad * 2);
    const y   = pad + Math.random() * (canvas.height - pad * 2);

    const startTime = Date.now();

    function drawTarget(scale, alpha) {
        const r = (size / 2) * scale;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.55, y); ctx.lineTo(x + r * 0.55, y);
        ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x, y + r * 0.55);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function animate() {
        const elapsed  = Date.now() - startTime;
        const progress = Math.min(1, elapsed / dur);
        drawTarget(1 - progress * 0.25, 1 - progress * 0.5);
        if (progress < 1) {
            psState.animFrame = requestAnimationFrame(animate);
        }
    }
    psState.animFrame = requestAnimationFrame(animate);

    function onTap(e) {
        e.preventDefault();
        const rect   = canvas.getBoundingClientRect();
        const touch  = e.touches ? e.touches[0] : e;
        const cx     = touch.clientX - rect.left;
        const cy     = touch.clientY - rect.top;
        const dist   = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
        const hitR   = size / 2 + 10;

        cancelAnimationFrame(psState.animFrame);
        clearTimeout(psState.activeTimer);
        canvas.removeEventListener('click',      onTap);
        canvas.removeEventListener('touchstart', onTap);

        psState.attempts++;
        psState.waveAttempts[psState.wave]++;

        if (dist <= hitR) {
            psState.hits++;
            psState.waveHits[psState.wave]++;
            playTone(660, 0.1, 'square', 0.09);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 0.6;
            ctx.fillStyle   = '#80cbc4';
            ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            playTone(180, 0.08, 'sawtooth', 0.06);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 0.35;
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

    setTimeout(() => {
        if (typeof scanState.onComplete === 'function') {
            scanState.onComplete(scanState.traits);
        }
    }, 1400);
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