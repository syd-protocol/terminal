// ═══════════════════════════════════════════════════════════════
// SYD GES — status.js  (Batch 5)
// Five-tab Status Window. SYD voice throughout. Alive and animated.
//
// Batch 5 changes vs Batch 1:
//   STATS tab — stat explainers replaced with real local text.
//     Three score bands per stat (low/mid/high). Tap a stat to read.
//     Trait reveal section shows stored scan scores at Level 10+,
//     with a SYD-voiced description per trait per score band.
//     Luck row is also tappable.
//   PATH tab — gap analysis replaced with structured local display.
//     Confirmed path skills listed as capabilities required.
//     Rank-aware gap read. Hidden affinity teaser tells the operative
//     what hidden affinity IS, why it matters, what to expect.
//     Proper progress bar to Level 20 unlock.
//   SETTINGS tab — neural link shows active/inactive state clearly.
// ═══════════════════════════════════════════════════════════════

// ─── ACTIVE TAB STATE ────────────────────────────────────────
let activeStatusTab = 'operative';

// ─── STATUS WINDOW ENTRY POINT ───────────────────────────────
function renderStatusWindow(animate) {
    renderStatusTab(activeStatusTab, animate);
    wireStatusTabs();
}

// ─── TAB WIRING ──────────────────────────────────────────────
function wireStatusTabs() {
    const tabs = ['operative', 'stats', 'directives', 'path', 'settings'];
    tabs.forEach(tabId => {
        const btn = document.getElementById('status-tab-' + tabId);
        if (btn) {
            btn.addEventListener('click', () => {
                playUIClick();
                switchStatusTab(tabId);
            });
        }
    });
}

function switchStatusTab(tabId) {
    activeStatusTab = tabId;
    document.querySelectorAll('.status-tab-btn').forEach(btn => {
        btn.classList.toggle('status-tab-btn--active', btn.dataset.tab === tabId);
    });
    renderStatusTab(tabId, false);
}

// ─── TAB DISPATCHER ──────────────────────────────────────────
function renderStatusTab(tabId, animate) {
    const content = document.getElementById('status-tab-content');
    if (!content) return;
    switch(tabId) {
        case 'operative':  renderOperativeTab(content, animate); break;
        case 'stats':      renderStatsTab(content, animate);     break;
        case 'directives': renderDirectivesTab(content);         break;
        case 'path':       renderPathTab(content);               break;
        case 'settings':   renderSettingsTab(content);           break;
        default:           renderOperativeTab(content, animate);
    }
}

// ─── TAB: OPERATIVE ──────────────────────────────────────────
function renderOperativeTab(container, animate) {
    if (!player) return;

    const level    = calculateLevel();
    const rank     = rankFromLevel(level);
    const title    = titleFromLevel(level);
    const momentum = player.momentum || 1.0;
    const capacity = player.capacity ?? player.maxCapacity ?? calcMaxCapacity(level);
    const maxCap   = player.maxCapacity ?? calcMaxCapacity(level);
    const sig      = player.sig || 0;
    const xp       = earnedXP(player.stats);
    const xpThis   = xp - xpForLevel(level);
    const xpNext   = xpForLevel(level + 1) - xpForLevel(level);
    const xpPct    = xpNext > 0 ? Math.min(100, Math.round((xpThis / xpNext) * 100)) : 100;
    const mPct     = Math.round(((momentum - 1.0) / 0.5) * 100);
    const capPct   = Math.round((capacity / maxCap) * 100);

    container.innerHTML = `
        <div class="status-operative-tab">

            <div class="sot-identity">
                <div class="sot-title">${capacity === 0
                    ? '[ CAPACITY CRITICAL ]'
                    : '[ ' + title + ' ]'
                }</div>
                <div class="sot-name">${player.name}</div>
                <div class="sot-badges">
                    <span class="rank-badge ${rankCssClass(rank)}">${rank}</span>
                    <span class="sot-level-badge">LVL ${level}</span>
                    <span class="sot-sig-badge">&#x2B21; ${sig} SIG</span>
                </div>
            </div>

            <div class="sot-xp-block">
                <div class="sot-bar-label">XP &mdash; ${Math.floor(xpThis)} / ${Math.floor(xpNext)} (${xpPct}%)</div>
                <div class="sot-bar">
                    <div class="sot-bar-fill sot-bar-fill--xp" style="width:${xpPct}%"></div>
                </div>
            </div>

            <div class="sot-metrics">
                <div class="sot-metric">
                    <div class="sot-metric-label">MOMENTUM</div>
                    <div class="sot-bar">
                        <div class="sot-bar-fill sot-bar-fill--momentum" style="width:${mPct}%"></div>
                    </div>
                    <div class="sot-metric-value">${momentum.toFixed(2)}&times;</div>
                </div>
                <div class="sot-metric">
                    <div class="sot-metric-label">CAPACITY</div>
                    <div class="sot-bar">
                        <div class="sot-bar-fill sot-bar-fill--capacity ${
                            capPct < 25 ? 'sot-bar-fill--critical' :
                            capPct < 50 ? 'sot-bar-fill--amber' : ''
                        }" style="width:${capPct}%"></div>
                    </div>
                    <div class="sot-metric-value">${capacity} / ${maxCap}</div>
                </div>
            </div>

            <div class="sot-stat-preview">
                <div class="sot-stat-preview-label">OPERATIVE STATS</div>
                <div class="sot-stat-rows">
                    ${STAT_NAMES.map(stat => {
                        const val     = player.stats[stat] || STAT_FLOOR;
                        const bp      = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);
                        const labels  = { strength: 'STR', intelligence: 'INT', agility: 'AGI', endurance: 'END', charisma: 'CHA' };
                        const colours = { strength: 'var(--stat-str)', intelligence: 'var(--stat-int)', agility: 'var(--stat-agi)', endurance: 'var(--stat-end)', charisma: 'var(--stat-cha)' };
                        return `
                            <div class="sot-stat-row">
                                <span class="sot-stat-label" style="color:${colours[stat]}">${labels[stat]}</span>
                                <div class="sot-bar sot-bar--stat">
                                    <div class="sot-bar-fill" style="width:${bp}%;background:${colours[stat]}"></div>
                                </div>
                                <span class="sot-stat-val" id="val-${stat}">${Math.floor(val)}</span>
                            </div>
                        `;
                    }).join('')}
                    <div class="sot-stat-row">
                        <span class="sot-stat-label" style="color:var(--stat-luck)">LCK</span>
                        <div class="sot-bar sot-bar--stat">
                            <div class="sot-bar-fill" style="width:${Math.min(100, ((calculateLuck() - STAT_FLOOR) / 90) * 100)}%;background:var(--stat-luck)"></div>
                        </div>
                        <span class="sot-stat-val" id="val-luck">${Math.floor(calculateLuck())}</span>
                    </div>
                </div>
            </div>

            <div class="sot-nav-actions">
                <button class="btn btn--primary" id="sot-view-directives">[ VIEW TODAY'S DIRECTIVES ]</button>
                <button class="btn btn--secondary" id="sot-open-training">[ TRAINING FLOOR ]</button>
            </div>
        </div>
    `;

    document.getElementById('sot-view-directives').addEventListener('click', () => {
        playUIClick(); switchStatusTab('directives');
    });
    document.getElementById('sot-open-training').addEventListener('click', () => {
        playUIClick(); navTo('screen-minigames');
    });

    if (animate) {
        setTimeout(() => {
            STAT_NAMES.forEach(stat => {
                animateNumber('val-' + stat, 0, Math.floor(player.stats[stat] || STAT_FLOOR), 600);
            });
            animateNumber('val-luck', 0, Math.floor(calculateLuck()), 700);
        }, 100);
    }
}

// ═══════════════════════════════════════════════════════════════
// TAB: STATS
// ═══════════════════════════════════════════════════════════════

// ─── LOCAL STAT EXPLAINERS ────────────────────────────────────
// Three score bands per stat. SYD's voice — specific, honest, no fluff.
// At Gemini phase these are upgraded with personalised reads drawing
// on PATH data and scan traits. The local versions work standalone.
// [TUNING TARGET] Score band thresholds
const STAT_EXPLAINER_LOW  = 15;
const STAT_EXPLAINER_HIGH = 22;

const STAT_EXPLAINERS = {
    strength: {
        low:  'STRENGTH at the floor. You know what needs doing. The issue is follow-through. The directives in this stat are built to close that gap one completed action at a time.',
        mid:  'STRENGTH building. You are completing what you start more often than you used to. The next step is consistency under pressure — not just when it feels manageable.',
        high: 'STRENGTH confirmed. You deliver. That is rarer than most people admit. The risk at this level is overextension — taking on more than your other stats can currently support.'
    },
    intelligence: {
        low:  'INTELLIGENCE at the floor. You are capable of more deliberate thought than you are currently applying. The directives here are about slowing down enough to actually think before acting.',
        mid:  'INTELLIGENCE developing. You are reading situations more accurately. The gap is between understanding and applying — knowing the model versus using it when the pressure is real.',
        high: 'INTELLIGENCE confirmed. You read fast and you are usually right. The risk is pattern-matching too quickly — calling things known when they are only familiar.'
    },
    agility: {
        low:  'AGILITY at the floor. Change costs you more than it should. That is not a flaw — it is a calibration issue. The directives here are designed to lower the cost of adapting gradually.',
        mid:  'AGILITY developing. You are adapting more fluidly than when you started. You still prefer the familiar path, but you no longer freeze when it disappears.',
        high: 'AGILITY confirmed. You navigate disruption well. The risk at this level is mistaking novelty for progress — moving because something changed, not because a real signal appeared.'
    },
    endurance: {
        low:  'ENDURANCE at the floor. Sustained effort is costing you more energy than the work itself. The directives here build the habit of continuation, not the feeling of motivation.',
        mid:  'ENDURANCE building. You are finishing more than you used to. The inconsistency is still there but the trajectory is right. The compounding is starting — you cannot feel it yet.',
        high: 'ENDURANCE confirmed. You sustain effort across time. That is genuinely rare. The risk is confusing volume for progress — sustained effort in the wrong direction is still wasted effort.'
    },
    charisma: {
        low:  'CHARISMA at the floor. You are present in interactions but not fully reading them. The directives here are about noticing — what people say versus what they mean.',
        mid:  'CHARISMA developing. You are reading rooms more accurately. You are starting to notice the gap between what is said and what is meant. That gap is where useful information lives.',
        high: 'CHARISMA confirmed. You move people — not because you perform, but because you actually read them. The risk is using the skill asymmetrically: reading well but not always responding well.'
    }
};

function getStatExplainer(stat, val) {
    const explainers = STAT_EXPLAINERS[stat];
    if (!explainers) return '';
    if (val <= STAT_EXPLAINER_LOW)  return explainers.low;
    if (val <= STAT_EXPLAINER_HIGH) return explainers.mid;
    return explainers.high;
}

// ─── LOCAL TRAIT DESCRIPTIONS ─────────────────────────────────
// Shown at Level 10+. Score bands: low (0–0.39), mid (0.4–0.69), high (0.7+).
// Describes what the scan measured and what the score means in plain language.

const TRAIT_DESCRIPTIONS = {
    patternRecognition: {
        label: 'PATTERN RECOGNITION',
        low:   'You were working to read structure under pressure during the scan. This takes time to develop — the scan caught you early in the process.',
        mid:   'You read structure reasonably well. You noticed patterns before they were fully formed. That is the useful version of this skill.',
        high:  'You read structure quickly and accurately. Signal Breach confirmed a strong pattern engine. This feeds your INT and AGI directly.'
    },
    cognitiveFlexibility: {
        label: 'COGNITIVE FLEXIBILITY',
        low:   'The rule change in round 2 cost you. That is the most common pattern. Most people anchor to the first rule they learn. The directives here are built to loosen that anchor.',
        mid:   'You adapted to the rule change with some difficulty. The instinct is there — the fluency takes more practice under pressure.',
        high:  'You shifted rules cleanly when the pattern changed. That is cognitive flexibility confirmed — the ability to drop a framework when the situation no longer fits it.'
    },
    persistence: {
        label: 'PERSISTENCE',
        low:   'You attempted fewer rounds than were available during the scan. Stopping early is a pattern worth noticing — not judging. The directives here are about what happens after you want to stop.',
        mid:   'You stayed in across the scan experiences. Even when the pattern was unclear, you attempted. That is the foundation of persistence.',
        high:  'You attempted every round of every experience. Persistence under uncertainty confirmed — that is what separates practitioners from people who are almost practitioners.'
    },
    executionSpeed: {
        label: 'EXECUTION SPEED',
        low:   'You were measured and careful under time pressure. The risk is tipping into hesitation when the window is actually closing. Speed and accuracy in sequence is the development target.',
        mid:   'You responded at a functional pace across the waves. Not fastest — but consistent. Consistency at speed is more durable than speed alone.',
        high:  'You responded quickly and consistently across all three waves of pressure. Execution speed confirmed. Feeds directly into AGI.'
    },
    executionAccuracy: {
        label: 'EXECUTION ACCURACY',
        low:   'Speed won out over accuracy in this scan. That is a useful signal — knowing which way you default under pressure is more valuable than a clean number.',
        mid:   'You were accurate more often than not across the session. That is the right default. Accuracy under pressure compounds differently than speed under pressure.',
        high:  'Your accuracy held as pressure increased. That is the harder of the two to develop and the more valuable one to have. Execution accuracy confirmed.'
    },
    pressureStability: {
        label: 'PRESSURE STABILITY',
        low:   'Your accuracy dropped as pressure increased across the waves. That is the most common pattern the scan reveals. The directives here are calibrated specifically to close this gap.',
        mid:   'You held reasonably steady under increasing pressure. Some degradation — that is expected. The goal is narrowing the gap between wave 1 and wave 3 performance.',
        high:  'Your accuracy in the final wave was close to your accuracy in the first. Pressure stability confirmed. Most people degrade faster under the same conditions.'
    },
    socialReading: {
        label: 'SOCIAL READING',
        low:   'You read for surface content more than subtext during Final Transmission. This is where most professional communication training stops. The directives here go one layer deeper.',
        mid:   'You caught meaning behind phrasing more often than not. The gap is in edge cases — ambiguous situations where there is no clear signal and you have to decide what to do with the uncertainty.',
        high:  'You read what was actually meant, not just what was said. Social reading confirmed. It feeds CHA directly and affects every domain where people are involved — which is all of them.'
    }
};

function getTraitBand(score) {
    if (score <= 0.39) return 'low';
    if (score <= 0.69) return 'mid';
    return 'high';
}

// ─── RENDER STATS TAB ────────────────────────────────────────
function renderStatsTab(container, animate) {
    if (!player) return;

    const level  = calculateLevel();
    const traits = (typeof loadScanTraits === 'function') ? loadScanTraits() : null;

    const statColour = {
        strength: 'var(--stat-str)', intelligence: 'var(--stat-int)',
        agility:  'var(--stat-agi)', endurance:    'var(--stat-end)',
        charisma: 'var(--stat-cha)'
    };
    const statLabel = {
        strength: 'STRENGTH', intelligence: 'INTELLIGENCE',
        agility:  'AGILITY',  endurance:    'ENDURANCE',
        charisma: 'CHARISMA'
    };

    const traitOrder = [
        'patternRecognition', 'cognitiveFlexibility', 'persistence',
        'executionSpeed', 'executionAccuracy', 'pressureStability', 'socialReading'
    ];

    const traitsSection = level >= 10
        ? `
            <div class="stats-traits-block">
                <p class="stats-section-label">[ TRAIT SIGNALS ]</p>
                <p class="stats-traits-intro">
                    These are the seven traits measured during your scan.
                    They are the engine. The stats above are the dashboard.
                </p>
                ${traits
                    ? traitOrder.map(key => {
                        const desc  = TRAIT_DESCRIPTIONS[key];
                        if (!desc) return '';
                        const score = traits[key] || 0;
                        const band  = getTraitBand(score);
                        const pct   = Math.round(score * 100);
                        return `
                            <div class="trait-row">
                                <div class="trait-row-header">
                                    <span class="trait-label">${desc.label}</span>
                                    <span class="trait-score">${pct}%</span>
                                </div>
                                <div class="sot-bar sot-bar--trait">
                                    <div class="sot-bar-fill sot-bar-fill--trait" style="width:${pct}%"></div>
                                </div>
                                <p class="trait-desc">${desc[band]}</p>
                            </div>
                        `;
                    }).join('')
                    : '<p class="stats-traits-no-data">[ SCAN DATA NOT FOUND &mdash; COMPLETE ONBOARDING TO SEED TRAIT SIGNALS ]</p>'
                }
            </div>
        `
        : `
            <div class="stats-traits-locked-block">
                <div class="stats-traits-locked-icon">&#x2B21;</div>
                <p class="stats-traits-locked-label">[ TRAIT SIGNALS LOCKED ]</p>
                <p class="stats-traits-locked-sub">
                    Seven traits were measured during your scan. They are stored.
                    Reach Level 10 to access them.
                </p>
                <p class="stats-traits-locked-level">LEVEL ${level} / 10</p>
                <div class="stats-traits-locked-bar-wrap">
                    <div class="stats-traits-locked-bar" style="width:${Math.min(100, (level / 10) * 100)}%"></div>
                </div>
            </div>
        `;

    container.innerHTML = `
        <div class="status-stats-tab">
            <p class="stats-section-label">[ STATS &mdash; TAP ANY ROW FOR SYD'S READ ]</p>
            <div class="stats-full-list">
                ${STAT_NAMES.map(stat => {
                    const val      = player.stats[stat] || STAT_FLOOR;
                    const bp       = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);
                    const explainer = getStatExplainer(stat, val);
                    return `
                        <div class="stats-row tappable" id="stats-row-${stat}">
                            <div class="stats-row-header">
                                <span class="stats-row-label" style="color:${statColour[stat]}">${statLabel[stat]}</span>
                                <span class="stats-row-val">${Math.floor(val)}</span>
                            </div>
                            <div class="sot-bar">
                                <div class="sot-bar-fill" style="width:${bp}%;background:${statColour[stat]}"></div>
                            </div>
                            <div class="stats-explainer hidden" id="explainer-${stat}">
                                <p class="stats-explainer-text">${explainer}</p>
                            </div>
                        </div>
                    `;
                }).join('')}

                <div class="stats-row tappable" id="stats-row-luck">
                    <div class="stats-row-header">
                        <span class="stats-row-label" style="color:var(--stat-luck)">LUCK</span>
                        <span class="stats-row-val">${Math.floor(calculateLuck())}</span>
                    </div>
                    <div class="sot-bar">
                        <div class="sot-bar-fill" style="width:${Math.min(100, ((calculateLuck() - STAT_FLOOR) / 90) * 100)}%;background:var(--stat-luck)"></div>
                    </div>
                    <div class="stats-explainer hidden" id="explainer-luck">
                        <p class="stats-explainer-text">LUCK is derived &mdash; the average of all five stats. It cannot be trained directly. Build the others and it rises. It is a measure of how balanced your development is.</p>
                    </div>
                </div>
            </div>

            ${traitsSection}
        </div>
    `;

    // Wire all stat rows: tap opens explainer, closes others.
    // If Neural Link is connected and path.js provides getPersonalisedStatExplainer(),
    // the first tap triggers a Gemini call and upgrades the explainer text in place.
    // Subsequent taps use the cached result — no repeat calls.
    const allStatIds = [...STAT_NAMES, 'luck'];
    allStatIds.forEach(stat => {
        const row = document.getElementById('stats-row-' + stat);
        if (!row) return;
        row.addEventListener('click', () => {
            playUIClick();
            const exp       = document.getElementById('explainer-' + stat);
            const wasHidden = exp && exp.classList.contains('hidden');

            // Close all open explainers
            allStatIds.forEach(s => {
                const e = document.getElementById('explainer-' + s);
                if (e) e.classList.add('hidden');
            });

            // Open this one if it was closed
            if (wasHidden && exp) {
                exp.classList.remove('hidden');

                // Attempt personalised Gemini explainer upgrade on first open
                // Luck stat uses a fixed explainer — do not call Gemini for it
                if (stat !== 'luck' && typeof getPersonalisedStatExplainer === 'function') {
                    const textEl   = exp.querySelector('.stats-explainer-text');
                    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
                    const traits   = (typeof loadScanTraits === 'function') ? loadScanTraits() : {};
                    const statVal  = player && player.stats ? (player.stats[stat] || STAT_FLOOR) : STAT_FLOOR;

                    // Only call if not already Gemini-enhanced (check for the upgrade marker)
                    if (textEl && !textEl.dataset.geminiDone) {
                        getPersonalisedStatExplainer(stat, statVal, pathData, traits).then(result => {
                            if (result && result.geminiEnhanced && result.text) {
                                textEl.textContent     = result.text;
                                textEl.dataset.geminiDone = '1';
                            }
                        }).catch(() => { /* fallback already shown */ });
                    }
                }
            }
        });
    });
}

// ─── TAB: DIRECTIVES ─────────────────────────────────────────
function renderDirectivesTab(container) {
    if (!player) return;

    const allDone       = (dailyQuests || []).every(q => (player.completedToday || []).includes(q.id));
    const encounterDone = typeof hasCompletedEncounterToday === 'function' && hasCompletedEncounterToday();

    container.innerHTML = `
        <div class="status-directives-tab">
            ${allDone ? `
                <div class="directives-all-done">
                    <p class="directives-done-msg">[ ALL DIRECTIVES EXECUTED ]</p>
                    <p class="directives-done-sub">${!encounterDone
                        ? 'One encounter remains. SYD has a transmission queued.'
                        : 'Today\'s signal is clear.'
                    }</p>
                </div>
            ` : ''}
            <div class="directives-list-wrap" id="quest-list"></div>
            <div class="encounter-card-wrap">
                <div class="encounter-card ${encounterDone ? 'encounter-card--done' : ''}">
                    <span class="encounter-card-label">[ DAILY ENCOUNTER ]</span>
                    <p class="encounter-card-desc">${encounterDone
                        ? 'Today\'s transmission acknowledged.'
                        : 'A transmission is queued. Optional. No penalty for skipping.'
                    }</p>
                    ${!encounterDone
                        ? '<button class="dc-complete-btn" id="open-encounter-btn">[ OPEN TRANSMISSION ]</button>'
                        : ''
                    }
                </div>
            </div>
            <div class="journal-prompt-wrap" id="journal-prompt-wrap"></div>
        </div>
    `;

    if (typeof renderDirectives === 'function') {
        renderDirectives(dailyQuests || [], player.completedToday || []);
    }
    const encBtn = document.getElementById('open-encounter-btn');
    if (encBtn) {
        encBtn.addEventListener('click', () => {
            playUIClick();
            if (typeof openEncounter === 'function') openEncounter(calculateLevel());
        });
    }
    renderJournalPrompt();
}

// ─── JOURNAL PROMPT ───────────────────────────────────────────
function renderJournalPrompt() {
    const wrap = document.getElementById('journal-prompt-wrap');
    if (!wrap) return;

    const savedJournal  = loadTodaysJournal();
    const journalPrompt = (typeof getTodaysJournalPrompt === 'function')
        ? getTodaysJournalPrompt()
        : 'What actually happened today? Not the ideal version &mdash; the real one.';

    wrap.innerHTML = `
        <div class="journal-wrap">
            <div class="journal-header">
                <span class="journal-label">[ END OF DAY &mdash; SYD JOURNAL ]</span>
            </div>
            <p class="journal-syd-prompt">${journalPrompt}</p>
            <textarea id="journal-input" class="fn-textarea" placeholder="Today I..." maxlength="600">${savedJournal}</textarea>
            <div class="journal-footer">
                <span class="fn-count" id="journal-count">${savedJournal.length} / 600</span>
                <button class="dc-complete-btn" id="journal-save-btn">[ SAVE LOG ]</button>
            </div>
            <div class="journal-close-day-row">
                <button class="journal-close-day-btn" id="journal-close-day-btn">[ CLOSE TODAY'S SESSION ]</button>
            </div>
        </div>
    `;

    const textarea = document.getElementById('journal-input');
    const countEl  = document.getElementById('journal-count');
    if (textarea && countEl) {
        textarea.addEventListener('input', () => { countEl.textContent = textarea.value.length + ' / 600'; });
    }
    document.getElementById('journal-save-btn').addEventListener('click', () => {
        playUIClick();
        saveTodaysJournal(textarea ? textarea.value : '');
        if (typeof showLog === 'function') showLog('[ JOURNAL ENTRY LOGGED ]', 'accent');
    });
    document.getElementById('journal-close-day-btn').addEventListener('click', () => {
        playUIClick();
        if (textarea && textarea.value.trim()) saveTodaysJournal(textarea.value);
        if (typeof triggerCloseOfDay === 'function') triggerCloseOfDay();
    });
}

// Journal delegation to dailyloop.js
function loadTodaysJournal() {
    if (typeof window.loadTodaysJournal_dl === 'function') return window.loadTodaysJournal_dl();
    return localStorage.getItem('syd_journal_' + new Date().toISOString().slice(0, 10)) || '';
}
function saveTodaysJournal(text) {
    if (typeof window.saveTodaysJournal_dl === 'function') { window.saveTodaysJournal_dl(text); return; }
    localStorage.setItem('syd_journal_' + new Date().toISOString().slice(0, 10), text);
}

// ═══════════════════════════════════════════════════════════════
// TAB: PATH
// ═══════════════════════════════════════════════════════════════

// ─── LOCAL GAP READ ───────────────────────────────────────────
// Rank-aware. Honest. No fluff. At Gemini phase this is replaced
// with a personalised analysis drawing on CV, scan traits, and goals.
function buildLocalGapRead(pathData) {
    if (!pathData || !pathData.confirmedPath) return null;
    const rank = pathData.confirmedRank || 'F';
    const reads = {
        'F': 'You are early. The gap between where you are and expert practice in this path is large &mdash; and entirely closeable. That is the honest read. The directives are calibrated to that distance.',
        'E': 'You have real experience. The gap now is about deliberate practice rather than exposure. You have seen enough to know what you do not know yet.',
        'D': 'You are developing. The gap at this stage is mostly about application &mdash; converting understanding into repeatable, pressure-tested execution.',
        'C': 'You are established. The gap is precision. The difference between your current practice and expert practice is not knowledge &mdash; it is the consistency of applying what you already know.',
        'B': 'You are capable in senior contexts. The gap now is influence and system-level thinking &mdash; moving from doing well yourself to making others do well.',
        'A': 'You are recognised. The remaining gap is in edge cases &mdash; the situations that do not fit the patterns you have already mastered.',
        'S': 'You operate at a level most practitioners never reach. The remaining gaps are narrow, specific, and hard to name without direct observation.'
    };
    return reads[rank] || reads['F'];
}

// ─── HIDDEN AFFINITY TEASER ───────────────────────────────────
// What hidden affinity IS, why it matters, what the operative should expect.
// Clear and useful even without the actual Gemini-generated result.
const HIDDEN_AFFINITY_TEASER = [
    'Hidden affinity is where your strongest trait signals point &mdash; independent of what you said you wanted.',
    'Sometimes that direction matches your stated path. Sometimes it does not.',
    'When it does not, that is not a problem to fix. It is information to use.',
    'SYD reads the mismatch from your scan and your PATH data. The read is specific to you, not a generic type.',
    'Reach Level 20 to surface it.'
].join(' ');

function renderPathTab(container) {
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    const level    = calculateLevel();
    const gapRead  = buildLocalGapRead(pathData);
    const skills   = (pathData && pathData.gapAnalysis && pathData.gapAnalysis.skills) || [];

    container.innerHTML = `
        <div class="status-path-tab">
            ${pathData ? `

                <div class="path-tab-block">
                    <div class="path-tab-label">[ OPERATIVE CLASSIFICATION ]</div>
                    <div class="path-tab-value">${
                        pathData.confirmedRole ||
                        (pathData.confirmedPath && pathData.confirmedPath.path_name) ||
                        'UNCLASSIFIED'
                    }</div>
                    ${pathData.confirmedSpec
                        ? '<div class="path-tab-spec">' + pathData.confirmedSpec + '</div>'
                        : ''
                    }
                    ${pathData.confirmedRank
                        ? '<div class="path-tab-rank">STARTING RANK: ' + pathData.confirmedRank + '</div>'
                        : ''
                    }
                </div>

                ${pathData.aspirationGoal && (pathData.aspirationGoal.careerGoal || pathData.aspirationGoal.lifeGoal) ? `
                    <div class="path-tab-block">
                        <div class="path-tab-label">[ CAREER SIGNAL ]</div>
                        <p class="path-tab-value path-tab-value--text">${pathData.aspirationGoal.careerGoal || '&mdash;'}</p>
                    </div>
                    <div class="path-tab-block">
                        <div class="path-tab-label">[ LIFE SIGNAL ]</div>
                        <p class="path-tab-value path-tab-value--text">${pathData.aspirationGoal.lifeGoal || '&mdash;'}</p>
                    </div>
                ` : ''}

                <div class="path-tab-block">
                    <div class="path-tab-label">[ GAP ANALYSIS ]</div>
                    ${gapRead
                        ? '<p class="path-tab-value path-tab-value--text">' + gapRead + '</p>'
                        : ''
                    }
                    ${skills.length > 0 ? `
                        <p class="path-gap-skills-label">CAPABILITIES THIS PATH REQUIRES</p>
                        <div class="path-skill-tags">
                            ${skills.map(s => '<span class="path-skill-tag">' + s + '</span>').join('')}
                        </div>
                    ` : ''}
                    ${!(pathData.gapAnalysis && pathData.gapAnalysis.geminiEnhanced) ? `
                        <p class="path-gap-gemini-note">
                            [ Personalised gap analysis activates when Neural Link is connected ]
                        </p>
                    ` : ''}
                </div>

                ${level >= 20 ? `
                    <div class="path-tab-block path-affinity-block">
                        <div class="path-tab-label">[ HIDDEN AFFINITY &mdash; UNLOCKED ]</div>
                        ${(pathData.hiddenAffinity && pathData.hiddenAffinity.read) ? `
                            <p class="path-tab-value path-tab-value--text path-affinity-stat">
                                ${pathData.hiddenAffinity.stat ? pathData.hiddenAffinity.stat.toUpperCase() : ''}
                            </p>
                            <p class="path-tab-value path-tab-value--text">${pathData.hiddenAffinity.read}</p>
                            ${!pathData.hiddenAffinity.geminiEnhanced ? `
                                <p class="path-gap-gemini-note">
                                    [ Connect Neural Link for a deeper affinity read ]
                                </p>
                            ` : ''}
                        ` : `
                            <p class="path-tab-value path-tab-value--text">
                                Connect Neural Link in Settings to surface your hidden affinity read.
                            </p>
                        `}
                    </div>
                ` : `
                    <div class="path-tab-block path-affinity-locked-block">
                        <div class="path-tab-label">[ HIDDEN AFFINITY ]</div>
                        <p class="path-affinity-teaser">${HIDDEN_AFFINITY_TEASER}</p>
                        <div class="path-affinity-level-row">
                            <span class="path-affinity-level-label">LEVEL ${level} / 20</span>
                            <div class="path-affinity-bar-wrap">
                                <div class="path-affinity-bar" style="width:${Math.min(100, (level / 20) * 100)}%"></div>
                            </div>
                        </div>
                    </div>
                `}

            ` : `
                <div class="path-tab-empty">
                    <p class="path-tab-empty-msg">[ PATH PROTOCOL NOT YET RUN ]</p>
                    <p class="path-tab-empty-sub">Complete onboarding to see your career track, gap analysis, and hidden affinity.</p>
                </div>
            `}
        </div>
    `;
}

// ─── TAB: SETTINGS ────────────────────────────────────────────
function renderSettingsTab(container) {
    const keyActive = (typeof getNeuralKey === 'function') && !!getNeuralKey();

    container.innerHTML = `
        <div class="status-settings-tab">

            <div class="settings-section">
                <div class="settings-section-label">[ NEURAL LINK ]</div>
                <div class="settings-neural-status ${keyActive ? 'settings-neural-status--active' : ''}">
                    ${keyActive
                        ? '&#x2713; NEURAL LINK ACTIVE &mdash; AI FEATURES ENABLED'
                        : 'NOT CONNECTED &mdash; LOCAL MODE ONLY'
                    }
                </div>
                <button class="settings-row-btn" id="settings-neural-btn">
                    ${keyActive ? 'MANAGE NEURAL LINK' : 'CONNECT NEURAL LINK'}
                </button>
            </div>

            <div class="settings-section">
                <div class="settings-section-label">[ CLOUD SYNC ]</div>
                <div class="settings-sync-status">
                    ${player && player.syncOptedIn
                        ? '[ SYNC ACTIVE &mdash; DATA BACKED UP ]'
                        : '[ LOCAL MODE &mdash; DATA ON THIS DEVICE ONLY ]'
                    }
                </div>
                <button class="settings-row-btn" id="settings-sync-btn">
                    ${player && player.syncOptedIn ? 'MANAGE SYNC' : 'ENABLE CLOUD SYNC'}
                </button>
            </div>

            <div class="settings-section">
                <div class="settings-section-label">[ SOUND ]</div>
                <button class="settings-row-btn" id="settings-sound-toggle">
                    SOUND: ${typeof soundEnabled !== 'undefined' && soundEnabled ? 'ON' : 'OFF'}
                </button>
            </div>

            <div class="settings-section">
                <div class="settings-section-label">[ OPERATIVE DESIGNATION ]</div>
                <div class="settings-name-row">
                    <input type="text" id="settings-name-input" class="settings-input"
                        value="${player ? player.name : ''}" maxlength="40" spellcheck="false" />
                    <button class="settings-row-btn settings-row-btn--inline" id="settings-name-save">SAVE</button>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-label">[ GEAR &mdash; DIRECTIVES PER DAY ]</div>
                <div class="settings-gear-row">
                    <button class="settings-gear-btn ${currentGear === 1 ? 'settings-gear-btn--active' : ''}" data-gear="1">GEAR 1 &mdash; STANDARD (5/day)</button>
                    <button class="settings-gear-btn ${currentGear === 2 ? 'settings-gear-btn--active' : ''}" data-gear="2">GEAR 2 &mdash; PRACTICE (10/day)</button>
                    <button class="settings-gear-btn ${currentGear === 3 ? 'settings-gear-btn--active' : ''}" data-gear="3">GEAR 3 &mdash; DEEP PRACTICE (15/day)</button>
                </div>
                <p class="settings-gear-note">${
                    typeof player !== 'undefined' && player && (player.operatorDays || 1) <= 7
                        ? '[ GEAR UNLOCKS AFTER YOUR FIRST 7 DAYS ]'
                        : 'Gear 3 adds a required reflection prompt to the third directive slot each session.'
                }</p>
            </div>

            <div class="settings-section settings-section--danger">
                <div class="settings-section-label">[ DANGER ZONE ]</div>
                <button class="settings-row-btn settings-row-btn--danger" id="settings-reset-btn">
                    RESET OPERATIVE PROFILE
                </button>
                <div class="settings-confirm hidden" id="settings-confirm-reset">
                    <p class="settings-confirm-msg">This deletes all local progress. This cannot be undone.</p>
                    <button class="settings-row-btn settings-row-btn--danger" id="settings-confirm-yes">CONFIRM RESET</button>
                    <button class="settings-row-btn" id="settings-confirm-no">CANCEL</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('settings-neural-btn').addEventListener('click', () => {
        playUIClick(); navTo('screen-neural');
    });
    document.getElementById('settings-sync-btn').addEventListener('click', () => {
        playUIClick();
        if (typeof showLog === 'function') showLog('[ CLOUD SYNC &mdash; AVAILABLE AFTER NEURAL LINK CONNECTED ]', 'system');
    });
    document.getElementById('settings-sound-toggle').addEventListener('click', () => {
        if (typeof cycleSoundState === 'function') cycleSoundState();
        document.getElementById('settings-sound-toggle').textContent =
            'SOUND: ' + (typeof soundEnabled !== 'undefined' && soundEnabled ? 'ON' : 'OFF');
    });
    document.getElementById('settings-name-save').addEventListener('click', () => {
        playUIClick();
        const n = document.getElementById('settings-name-input').value.trim().toUpperCase();
        if (!n) return;
        if (player) { player.name = n; savePlayer(); updateStatusScreen(); }
        if (typeof showLog === 'function') showLog('[ DESIGNATION UPDATED ]');
    });
    document.querySelectorAll('.settings-gear-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            const gear = parseInt(btn.dataset.gear, 10);
            if (typeof player !== 'undefined' && player && (player.operatorDays || 1) <= 7) {
                if (typeof showLog === 'function') showLog('[ GEAR UNLOCKS AFTER YOUR FIRST 7 DAYS ]', 'system');
                return;
            }
            if (typeof saveGear === 'function') saveGear(gear);
            document.querySelectorAll('.settings-gear-btn').forEach(b => b.classList.remove('settings-gear-btn--active'));
            btn.classList.add('settings-gear-btn--active');
        });
    });
    document.getElementById('settings-reset-btn').addEventListener('click', () => {
        playUIClick();
        document.getElementById('settings-confirm-reset').classList.remove('hidden');
    });
    document.getElementById('settings-confirm-no').addEventListener('click', () => {
        playUIClick();
        document.getElementById('settings-confirm-reset').classList.add('hidden');
    });
    document.getElementById('settings-confirm-yes').addEventListener('click', () => {
        playUIClick();
        if (typeof resetProfile === 'function') resetProfile();
    });
}