// ═══════════════════════════════════════════════════════════════
// SYD GES — scan.js
// The Scan: three experiences that read the operative before
// they read themselves. Signal Breach, Precision Shooter,
// Final Transmission.
//
// STUB — all game logic is placeholder. Screen transitions,
// SYD voice, and trait recording interfaces are fully wired.
// Real game mechanics are built in the next phase.
// ═══════════════════════════════════════════════════════════════

// ─── TRAIT STORAGE ───────────────────────────────────────────
// Traits are the hidden engine. Stats are the dashboard.
// Traits are measured here, stored locally, fed into stat seeding.
// Never shown directly to the operative during onboarding.
// Revealed progressively through levelling — a progression mechanic.
//
// Seven traits measured:
//   1. Execution Speed       → Agility
//   2. Execution Accuracy    → Agility, Strength
//   3. Cognitive Flexibility → Intelligence, Agility
//   4. Pattern Recognition   → Intelligence, Agility
//   5. Pressure Stability    → Strength, Endurance
//   6. Persistence           → Strength, Endurance
//   7. Social Reading        → Charisma

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

// Trait-to-stat weight mapping.
// Used in stat seeding: seedStatsFromTraits() multiplies trait scores
// by these weights and distributes the result across relevant stats.
// All weights are named tuning targets — calibrate after first build.
const TRAIT_STAT_WEIGHTS = {
    // [TUNING TARGET] Trait stat weight distribution
    executionSpeed:       { agility:      0.8,  strength:   0.2  },
    executionAccuracy:    { agility:      0.5,  strength:   0.5  },
    cognitiveFlexibility: { intelligence: 0.5,  agility:    0.5  },
    patternRecognition:   { intelligence: 0.6,  agility:    0.4  },
    pressureStability:    { strength:     0.5,  endurance:  0.5  },
    persistence:          { strength:     0.3,  endurance:  0.7  },
    socialReading:        { charisma:     1.0                     }
};

// [TUNING TARGET] Maximum stat points a scan can seed per stat above STAT_FLOOR.
// The scan seeds floor to midpoint. PATH data adds midpoint toward ceiling.
const SCAN_SEED_MAX_PER_STAT = 5;

function saveScanTraits(traits) {
    localStorage.setItem(SCAN_TRAITS_KEY, JSON.stringify(traits));
}

function loadScanTraits() {
    try {
        const raw = localStorage.getItem(SCAN_TRAITS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) {
        return null;
    }
}

// Converts raw trait scores (0–1 floats) into stat seed bonuses.
// Returns an object keyed by stat name with float bonus values.
// Called by createPlayer() after scan completes.
function seedStatsFromTraits(traits) {
    const seeds = { strength: 0, intelligence: 0, agility: 0, endurance: 0, charisma: 0 };
    if (!traits) return seeds;

    TRAIT_NAMES.forEach(trait => {
        const score   = traits[trait] || 0;           // 0–1
        const weights = TRAIT_STAT_WEIGHTS[trait] || {};
        Object.entries(weights).forEach(([stat, weight]) => {
            seeds[stat] = (seeds[stat] || 0) + score * weight * SCAN_SEED_MAX_PER_STAT;
        });
    });

    // Round and cap
    Object.keys(seeds).forEach(stat => {
        seeds[stat] = Math.min(SCAN_SEED_MAX_PER_STAT * 2, Math.round(seeds[stat] * 10) / 10);
    });

    return seeds;
}

// ─── SCAN STATE ──────────────────────────────────────────────
let scanState = {
    phase:          null,    // 'signal_breach' | 'precision_shooter' | 'final_transmission'
    traits:         {},
    operativeName:  null,
    onComplete:     null     // callback(traits) — fired when all three experiences finish
};

// ─── SCAN ENTRY POINT ────────────────────────────────────────
// Called from init() when no player exists.
// name: the operative's name string
// onComplete: callback fired after all three scan experiences finish.
//   receives the completed traits object as its only argument.

function runScan(name, onComplete) {
    scanState.operativeName = name;
    scanState.traits        = {};
    scanState.onComplete    = onComplete;

    showScreen('screen-scan');
    renderScanIntro();
}

// ─── SCAN INTRO ───────────────────────────────────────────────
function renderScanIntro() {
    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-intro">
            <div class="scan-progress-bar">
                <div class="scan-progress-fill" id="scan-progress-fill" style="width:0%"></div>
            </div>
            <p class="scan-progress-label" id="scan-progress-label">SIGNAL ACQUISITION — 0%</p>
            <div class="scan-syd-voice" id="scan-syd-voice"></div>
            <div class="scan-action" id="scan-action">
                <button class="btn btn--primary scan-begin-btn" id="scan-begin-btn">
                    [ BEGIN SCAN ]
                </button>
            </div>
        </div>
    `;

    const lines = [
        'I need to read you before I can serve you.',
        'Three experiences. Short. You will not know what I am measuring.',
        'That is intentional.',
        'Let\'s begin.'
    ];

    const voiceEl = document.getElementById('scan-syd-voice');
    let idx = 0;

    function nextLine() {
        if (idx >= lines.length) {
            const btn = document.getElementById('scan-begin-btn');
            if (btn) {
                btn.style.opacity = '1';
                btn.addEventListener('click', () => {
                    playUIClick();
                    runSignalBreach();
                });
            }
            return;
        }
        const el = document.createElement('p');
        el.className = 'scan-voice-line';
        el.textContent = lines[idx];
        voiceEl.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('scan-voice-line--visible')));
        idx++;
        setTimeout(nextLine, 900);
    }

    nextLine();
}

// ─── EXPERIENCE 1: SIGNAL BREACH ─────────────────────────────
// Measures: Pattern Recognition, Cognitive Flexibility, Persistence
// Stub: shows placeholder UI, records dummy trait scores.
// Real game mechanic: nodes must be connected before sections close off.
// Rules shift between rounds. Rewards reading structure and adapting.

function runSignalBreach() {
    updateScanProgress(1, 3, 'SIGNAL BREACH — READING PATTERN ENGINE');
    setScanPhase('signal_breach');

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-game scan-game--signal-breach">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ EXPERIENCE 01 — SIGNAL BREACH ]</span>
            </div>
            <div class="scan-game-body" id="signal-breach-body">
                <div class="scan-placeholder">
                    <div class="scan-placeholder-icon">⬡</div>
                    <p class="scan-placeholder-label">SIGNAL BREACH</p>
                    <p class="scan-placeholder-sub">Connect nodes before sections close. Rules shift between rounds.</p>
                    <p class="scan-placeholder-dev">[ GAME MECHANIC — BUILD PHASE 2 ]</p>
                    <button class="btn btn--primary" id="sb-dummy-complete">
                        [ DUMMY: COMPLETE EXPERIENCE ]
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('sb-dummy-complete').addEventListener('click', () => {
        playUIClick();
        // Dummy trait scores — replace with real calculated values at build phase 2
        scanState.traits.patternRecognition   = 0.65;
        scanState.traits.cognitiveFlexibility = 0.60;
        scanState.traits.persistence          = 0.70;
        runPrecisionShooter();
    });
}

// ─── EXPERIENCE 2: PRECISION SHOOTER ─────────────────────────
// Measures: Execution Speed, Execution Accuracy, Pressure Stability
// Stub: shows placeholder UI, records dummy trait scores.
// Real game mechanic: targets appear, must be hit with timing and accuracy
// under increasing pressure. Accurate wins — not fastest.

function runPrecisionShooter() {
    updateScanProgress(2, 3, 'PRECISION SHOOTER — READING EXECUTION ENGINE');
    setScanPhase('precision_shooter');

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-game scan-game--precision-shooter">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ EXPERIENCE 02 — PRECISION SHOOTER ]</span>
            </div>
            <div class="scan-game-body" id="precision-shooter-body">
                <div class="scan-placeholder">
                    <div class="scan-placeholder-icon">◎</div>
                    <p class="scan-placeholder-label">PRECISION SHOOTER</p>
                    <p class="scan-placeholder-sub">Targets appear. Accurate wins — not fastest. Pressure increases.</p>
                    <p class="scan-placeholder-dev">[ GAME MECHANIC — BUILD PHASE 2 ]</p>
                    <button class="btn btn--primary" id="ps-dummy-complete">
                        [ DUMMY: COMPLETE EXPERIENCE ]
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('ps-dummy-complete').addEventListener('click', () => {
        playUIClick();
        // Dummy trait scores — replace with real calculated values at build phase 2
        scanState.traits.executionSpeed    = 0.55;
        scanState.traits.executionAccuracy = 0.72;
        scanState.traits.pressureStability = 0.60;
        runFinalTransmission();
    });
}

// ─── EXPERIENCE 3: FINAL TRANSMISSION ────────────────────────
// Measures: Social Reading
// Stub: shows placeholder UI, records dummy trait score.
// Real mechanic: scenario round — SYD presents a situation,
// operative picks the best response. Reads social instinct,
// not correctness. How the operative reads people and tone.

function runFinalTransmission() {
    updateScanProgress(3, 3, 'FINAL TRANSMISSION — READING SOCIAL ENGINE');
    setScanPhase('final_transmission');

    const container = document.getElementById('scan-content');
    if (!container) return;

    container.innerHTML = `
        <div class="scan-game scan-game--final-transmission">
            <div class="scan-game-header">
                <span class="scan-game-tag">[ EXPERIENCE 03 — FINAL TRANSMISSION ]</span>
            </div>
            <div class="scan-game-body" id="final-transmission-body">
                <div class="scan-placeholder">
                    <div class="scan-placeholder-icon">◈</div>
                    <p class="scan-placeholder-label">FINAL TRANSMISSION</p>
                    <p class="scan-placeholder-sub">A scenario. SYD reads how you read people and tone.</p>
                    <p class="scan-placeholder-dev">[ GAME MECHANIC — BUILD PHASE 2 ]</p>
                    <button class="btn btn--primary" id="ft-dummy-complete">
                        [ DUMMY: COMPLETE EXPERIENCE ]
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('ft-dummy-complete').addEventListener('click', () => {
        playUIClick();
        // Dummy trait score — replace with real calculated value at build phase 2
        scanState.traits.socialReading = 0.68;
        completeScan();
    });
}

// ─── SCAN COMPLETE ────────────────────────────────────────────
function completeScan() {
    updateScanProgress(3, 3, 'SIGNAL ACQUISITION — COMPLETE');
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

// ─── SCAN HELPERS ─────────────────────────────────────────────
function setScanPhase(phase) {
    scanState.phase = phase;
}

function updateScanProgress(current, total, label) {
    const pct     = Math.round((current / total) * 100);
    const fillEl  = document.getElementById('scan-progress-fill');
    const labelEl = document.getElementById('scan-progress-label');
    if (fillEl)  fillEl.style.width = `${pct}%`;
    if (labelEl) labelEl.textContent = `${label} — ${pct}%`;
}
