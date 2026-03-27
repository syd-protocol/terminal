// ═══════════════════════════════════════════════════════════════
// SYD GES — status.js
// Five-tab Status Window. SYD voice throughout. Alive and animated.
//
// Tabs:
//   OPERATIVE  — name, level, rank, title, capacity, momentum, Sig, stat preview
//   STATS      — full bars, SYD explainers, tap for read, traits revealed progressively
//   DIRECTIVES — today's directives, completion, encounter card, journal prompt
//   PATH       — goal, gap, career track, life track, hidden affinity when unlocked
//   SETTINGS   — neural link, sync, sound, install, danger zone
//
// This module renders all five tabs and handles tab switching.
// It does NOT contain business logic — it reads from player/pathData and renders.
// ═══════════════════════════════════════════════════════════════

// ─── ACTIVE TAB STATE ────────────────────────────────────────
let activeStatusTab = 'operative';

// ─── STATUS WINDOW ENTRY POINT ───────────────────────────────
// Called from showScreen('screen-status') via app.js.
function renderStatusWindow(animate) {
    renderStatusTab(activeStatusTab, animate);
    wireStatusTabs();
}

// ─── TAB WIRING ──────────────────────────────────────────────
function wireStatusTabs() {
    const tabs = ['operative', 'stats', 'directives', 'path', 'settings'];
    tabs.forEach(tabId => {
        const btn = document.getElementById(`status-tab-${tabId}`);
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

    // Update tab button states
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
// Name, level, rank, title, capacity, momentum, Sig balance, stat preview.
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
                <div class="sot-title">${(player.capacity === 0) ? '[ CAPACITY CRITICAL — OPERATIVE DEGRADED ]' : '[ ' + title + ' ]'}</div>
                <div class="sot-name">${player.name}</div>
                <div class="sot-badges">
                    <span class="rank-badge ${rankCssClass(rank)}">${rank}</span>
                    <span class="sot-level-badge">LVL ${level}</span>
                    <span class="sot-sig-badge">⬡ ${sig} SIG</span>
                </div>
            </div>

            <div class="sot-xp-block">
                <div class="sot-bar-label">XP — ${Math.floor(xpThis)} / ${Math.floor(xpNext)} (${xpPct}%)</div>
                <div class="sot-bar"><div class="sot-bar-fill sot-bar-fill--xp" id="xp-bar" style="width:${xpPct}%"></div></div>
            </div>

            <div class="sot-metrics">
                <div class="sot-metric">
                    <div class="sot-metric-label">MOMENTUM</div>
                    <div class="sot-bar"><div class="sot-bar-fill sot-bar-fill--momentum" id="momentum-bar" style="width:${mPct}%"></div></div>
                    <div class="sot-metric-value" id="momentum-value">${momentum.toFixed(2)}×</div>
                </div>
                <div class="sot-metric">
                    <div class="sot-metric-label">CAPACITY</div>
                    <div class="sot-bar"><div class="sot-bar-fill sot-bar-fill--capacity ${capPct < 25 ? 'sot-bar-fill--critical' : capPct < 50 ? 'sot-bar-fill--amber' : ''}" id="capacity-bar" style="width:${capPct}%"></div></div>
                    <div class="sot-metric-value" id="capacity-value">${capacity} / ${maxCap}</div>
                </div>
            </div>

            <div class="sot-stat-preview">
                <div class="sot-stat-preview-label">OPERATIVE STATS</div>
                <div class="sot-stat-rows">
                    ${STAT_NAMES.map(stat => {
                        const val = player.stats[stat] || STAT_FLOOR;
                        const bp  = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);
                        const labels = { strength: 'STR', intelligence: 'INT', agility: 'AGI', endurance: 'END', charisma: 'CHA' };
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
        playUIClick();
        switchStatusTab('directives');
    });

    document.getElementById('sot-open-training').addEventListener('click', () => {
        playUIClick();
        navTo('screen-minigames');
    });

    if (animate) {
        setTimeout(() => {
            STAT_NAMES.forEach(stat => {
                const val = player.stats[stat] || STAT_FLOOR;
                animateNumber(`val-${stat}`, 0, Math.floor(val), 600);
            });
            animateNumber('val-luck', 0, Math.floor(calculateLuck()), 700);
        }, 100);
    }
}

// ─── TAB: STATS ───────────────────────────────────────────────
// Full bars with SYD explainers. Tap any stat to hear SYD's read.
// Trait reveals are unlocked progressively through levelling.
function renderStatsTab(container, animate) {
    if (!player) return;

    const level = calculateLevel();

    const statMeta = {
        strength:     { label: 'STRENGTH',     short: 'STR', colour: 'var(--stat-str)', desc: 'Physical output, delivery, follow-through, capacity to exert.' },
        intelligence: { label: 'INTELLIGENCE', short: 'INT', colour: 'var(--stat-int)', desc: 'Learning, reasoning, reading situations, deliberate intellectual effort.' },
        agility:      { label: 'AGILITY',      short: 'AGI', colour: 'var(--stat-agi)', desc: 'Adaptability under disruption, pattern-breaking, response over reaction.' },
        endurance:    { label: 'ENDURANCE',    short: 'END', colour: 'var(--stat-end)', desc: 'Sustained effort — physical, mental, emotional.' },
        charisma:     { label: 'CHARISMA',     short: 'CHA', colour: 'var(--stat-cha)', desc: 'Social presence, connection, the ability to move people.' }
    };

    container.innerHTML = `
        <div class="status-stats-tab">
            <p class="stats-tab-syd-voice">
                [ Tap any stat for SYD's read. Your traits are revealed as you level up. ]
            </p>
            <div class="stats-full-list">
                ${STAT_NAMES.map(stat => {
                    const meta = statMeta[stat];
                    const val  = player.stats[stat] || STAT_FLOOR;
                    const bp   = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);
                    return `
                        <div class="stats-row tappable" data-stat="${stat}" id="stats-row-${stat}">
                            <div class="stats-row-header">
                                <span class="stats-row-label" style="color:${meta.colour}">${meta.label}</span>
                                <span class="stats-row-val" id="stat-val-${stat}">${Math.floor(val)}</span>
                            </div>
                            <div class="sot-bar">
                                <div
                                    class="sot-bar-fill"
                                    id="stat-bar-${stat}"
                                    style="width:${bp}%;background:${meta.colour}"
                                ></div>
                            </div>
                            <p class="stats-row-desc">${meta.desc}</p>
                            <div class="stats-explainer hidden" id="explainer-${stat}">
                                <p class="stats-explainer-text" id="explainer-text-${stat}">
                                    [ TAP TO LOAD SYD'S READ — GEMINI PHASE ]
                                </p>
                            </div>
                        </div>
                    `;
                }).join('')}

                <div class="stats-row stats-row--luck">
                    <div class="stats-row-header">
                        <span class="stats-row-label" style="color:var(--stat-luck)">LUCK</span>
                        <span class="stats-row-val">${Math.floor(calculateLuck())}</span>
                    </div>
                    <div class="sot-bar">
                        <div class="sot-bar-fill" style="width:${Math.min(100, ((calculateLuck() - STAT_FLOOR) / 90) * 100)}%;background:var(--stat-luck)"></div>
                    </div>
                    <p class="stats-row-desc">Derived — average of all five. Cannot be trained directly. Build the others and it rises.</p>
                </div>
            </div>

            ${level >= 10 ? `
                <div class="stats-traits-block">
                    <p class="stats-tab-syd-voice">[ TRAIT SIGNALS — UNLOCKED AT LEVEL 10 ]</p>
                    <div class="stats-traits-placeholder">
                        Trait reveal UI — build phase 2.
                    </div>
                </div>
            ` : `
                <p class="stats-trait-locked">
                    [ TRAIT SIGNALS LOCKED — REACH LEVEL 10 TO UNLOCK ]
                </p>
            `}
        </div>
    `;

    // Wire stat tap → explainer toggle
    STAT_NAMES.forEach(stat => {
        const row = document.getElementById(`stats-row-${stat}`);
        if (row) {
            row.addEventListener('click', () => {
                const explainer = document.getElementById(`explainer-${stat}`);
                if (explainer) {
                    explainer.classList.toggle('hidden');
                }
            });
        }
    });
}

// ─── TAB: DIRECTIVES ─────────────────────────────────────────
// Today's directives + encounter card + journal prompt.
// Delegates to renderDirectives() in quests.js for directive cards.
function renderDirectivesTab(container) {
    if (!player) return;

    const allDone      = (dailyQuests || []).every(q => (player.completedToday || []).includes(q.id));
    const encounterDone = hasCompletedEncounterToday ? hasCompletedEncounterToday() : false;

    container.innerHTML = `
        <div class="status-directives-tab">

            ${allDone ? `
                <div class="directives-all-done">
                    <p class="directives-done-msg">[ ALL DIRECTIVES EXECUTED — WELL DONE. ]</p>
                    ${!encounterDone ? `
                        <p class="directives-done-sub">One encounter remains. SYD has a transmission queued.</p>
                    ` : `
                        <p class="directives-done-sub">Today's signal is clear.</p>
                    `}
                </div>
            ` : ''}

            <div class="directives-list-wrap" id="quest-list"></div>

            <div class="encounter-card-wrap">
                <div class="encounter-card ${encounterDone ? 'encounter-card--done' : ''}">
                    <span class="encounter-card-label">[ DAILY ENCOUNTER ]</span>
                    <p class="encounter-card-desc">
                        ${encounterDone
                            ? 'Today\'s transmission acknowledged.'
                            : 'A transmission is queued. One encounter. Optional. No penalty for skipping.'
                        }
                    </p>
                    ${!encounterDone ? `
                        <button class="dc-complete-btn" id="open-encounter-btn">[ OPEN TRANSMISSION ]</button>
                    ` : ''}
                </div>
            </div>

            <div class="journal-prompt-wrap" id="journal-prompt-wrap">
                <!-- Journal prompt rendered by renderJournalPrompt() -->
            </div>
        </div>
    `;

    // Render directive cards via quests.js
    if (typeof renderDirectives === 'function') {
        renderDirectives(dailyQuests || [], player.completedToday || []);
    }

    const encBtn = document.getElementById('open-encounter-btn');
    if (encBtn) {
        encBtn.addEventListener('click', () => {
            playUIClick();
            if (typeof openEncounter === 'function') {
                openEncounter(calculateLevel());
            }
        });
    }

    renderJournalPrompt();
}

// ─── JOURNAL PROMPT ───────────────────────────────────────────
// SYD prompts specifically based on that day's directives.
// At Gemini phase, prompt is generated from directive completions.
// Stub: shows a fixed placeholder prompt.
function renderJournalPrompt() {
    const wrap = document.getElementById('journal-prompt-wrap');
    if (!wrap) return;

    const savedJournal = loadTodaysJournal();

    wrap.innerHTML = `
        <div class="journal-wrap">
            <div class="journal-header">
                <span class="journal-label">[ END OF DAY — SYD JOURNAL ]</span>
            </div>
            <p class="journal-syd-prompt">
                What actually happened today? Not the ideal version — the real one.
                One thing that went exactly as planned. One thing that did not.
            </p>
            <textarea
                id="journal-input"
                class="fn-textarea"
                placeholder="Today I..."
                maxlength="600"
            >${savedJournal}</textarea>
            <div class="journal-footer">
                <span class="fn-count" id="journal-count">${savedJournal.length} / 600</span>
                <button class="dc-complete-btn" id="journal-save-btn">[ SAVE LOG ]</button>
            </div>
        </div>
    `;

    const textarea  = document.getElementById('journal-input');
    const countEl   = document.getElementById('journal-count');
    const saveBtn   = document.getElementById('journal-save-btn');

    if (textarea && countEl) {
        textarea.addEventListener('input', () => {
            countEl.textContent = `${textarea.value.length} / 600`;
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            playUIClick();
            saveTodaysJournal(textarea ? textarea.value : '');
            if (typeof showLog === 'function') {
                showLog('[ JOURNAL ENTRY LOGGED ]', 'accent');
            }
        });
    }
}

const JOURNAL_KEY_PREFIX = 'syd_journal_';
function loadTodaysJournal() {
    const key = JOURNAL_KEY_PREFIX + new Date().toISOString().slice(0, 10);
    return localStorage.getItem(key) || '';
}
function saveTodaysJournal(text) {
    const key = JOURNAL_KEY_PREFIX + new Date().toISOString().slice(0, 10);
    localStorage.setItem(key, text);
}

// ─── TAB: PATH ────────────────────────────────────────────────
// Goal, gap, career track, life track, hidden affinity when unlocked.
function renderPathTab(container) {
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    const level    = calculateLevel();

    container.innerHTML = `
        <div class="status-path-tab">
            ${pathData ? `
                <div class="path-tab-block">
                    <div class="path-tab-label">[ OPERATIVE CLASSIFICATION ]</div>
                    <div class="path-tab-value">${pathData.confirmedRole || pathData.confirmedPath?.path_name || 'UNCLASSIFIED'}</div>
                    ${pathData.confirmedSpec ? `<div class="path-tab-spec">${pathData.confirmedSpec}</div>` : ''}
                </div>

                ${pathData.aspirationGoal ? `
                    <div class="path-tab-block">
                        <div class="path-tab-label">[ CAREER SIGNAL ]</div>
                        <p class="path-tab-value path-tab-value--text">${pathData.aspirationGoal.careerGoal || '—'}</p>
                    </div>
                    <div class="path-tab-block">
                        <div class="path-tab-label">[ LIFE SIGNAL ]</div>
                        <p class="path-tab-value path-tab-value--text">${pathData.aspirationGoal.lifeGoal || '—'}</p>
                    </div>
                ` : ''}

                ${pathData.gapAnalysis ? `
                    <div class="path-tab-block">
                        <div class="path-tab-label">[ GAP ANALYSIS ]</div>
                        <p class="path-tab-value path-tab-value--text">
                            ${pathData.gapAnalysis.primaryGap || 'Gap analysis — Gemini phase.'}
                        </p>
                        ${(pathData.gapAnalysis.skills || []).length > 0 ? `
                            <div class="path-skill-tags">
                                ${pathData.gapAnalysis.skills.map(s => `<span class="path-skill-tag">${s}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${level >= 20 ? `
                    <div class="path-tab-block path-affinity-block">
                        <div class="path-tab-label">[ HIDDEN AFFINITY — UNLOCKED ]</div>
                        <p class="path-tab-value path-tab-value--text">
                            [ Hidden affinity reveal — Gemini phase. Unlocked at Level 20. ]
                        </p>
                    </div>
                ` : `
                    <div class="path-affinity-locked">
                        [ HIDDEN AFFINITY LOCKED — REACH LEVEL 20 TO UNLOCK ]
                    </div>
                `}
            ` : `
                <div class="path-tab-empty">
                    <p class="path-tab-empty-msg">
                        [ PATH PROTOCOL NOT YET RUN ]
                    </p>
                    <p class="path-tab-empty-sub">
                        Complete onboarding to see your career track, gap analysis, and hidden affinity.
                    </p>
                </div>
            `}
        </div>
    `;
}

// ─── TAB: SETTINGS ────────────────────────────────────────────
// Neural link key, cloud sync, sound, install, danger zone.
// Delegates to existing renderNeuralSettings() in app.js for neural section.
function renderSettingsTab(container) {
    container.innerHTML = `
        <div class="status-settings-tab">

            <div class="settings-section">
                <div class="settings-section-label">[ NEURAL LINK ]</div>
                <div id="settings-neural-content">
                    <!-- wired by renderNeuralSettingsInline() -->
                </div>
                <button class="settings-row-btn" id="settings-neural-btn">
                    ${getNeuralKey ? (getNeuralKey() ? '✓ NEURAL LINK ACTIVE' : 'CONNECT NEURAL LINK') : 'CONNECT NEURAL LINK'}
                </button>
            </div>

            <div class="settings-section">
                <div class="settings-section-label">[ CLOUD SYNC ]</div>
                <div class="settings-sync-status" id="settings-sync-status">
                    ${player && player.syncOptedIn
                        ? '[ SYNC ACTIVE — DATA BACKED UP ]'
                        : '[ LOCAL MODE — DATA ON THIS DEVICE ONLY ]'
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
                    <input
                        type="text"
                        id="settings-name-input"
                        class="settings-input"
                        value="${player ? player.name : ''}"
                        maxlength="40"
                        spellcheck="false"
                    />
                    <button class="settings-row-btn settings-row-btn--inline" id="settings-name-save">SAVE</button>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-label">[ GEAR — DIRECTIVES PER DAY ]</div>
                <div class="settings-gear-row">
                    <button class="settings-gear-btn ${currentGear === 1 ? 'settings-gear-btn--active' : ''}" data-gear="1">GEAR 1 — STANDARD</button>
                    <button class="settings-gear-btn ${currentGear === 2 ? 'settings-gear-btn--active' : ''}" data-gear="2">GEAR 2 — PRACTICE</button>
                    <button class="settings-gear-btn ${currentGear === 3 ? 'settings-gear-btn--active' : ''}" data-gear="3">GEAR 3 — DEEP PRACTICE</button>
                </div>
                <p class="settings-gear-note">
                    GEAR 1: 5 directives/day · GEAR 2: 10 directives/day · GEAR 3: 15 directives/day + reflection prompts.
                    ${typeof player !== 'undefined' && player && (player.operatorDays || 1) <= 7
                        ? '[ GEAR UNLOCKS AFTER YOUR FIRST 7 DAYS ]'
                        : ''}
                </p>
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

    // ── Neural link button ────────────────────────────────────
    document.getElementById('settings-neural-btn').addEventListener('click', () => {
        playUIClick();
        navTo('screen-neural');
    });

    // ── Sound toggle ──────────────────────────────────────────
    document.getElementById('settings-sound-toggle').addEventListener('click', () => {
        if (typeof cycleSoundState === 'function') cycleSoundState();
        document.getElementById('settings-sound-toggle').textContent =
            `SOUND: ${typeof soundEnabled !== 'undefined' && soundEnabled ? 'ON' : 'OFF'}`;
    });

    // ── Name save ─────────────────────────────────────────────
    document.getElementById('settings-name-save').addEventListener('click', () => {
        playUIClick();
        const n = document.getElementById('settings-name-input').value.trim().toUpperCase();
        if (!n) return;
        if (player) { player.name = n; savePlayer(); updateStatusScreen(); }
        if (typeof showLog === 'function') showLog('[ DESIGNATION UPDATED ]');
    });

    // ── Gear selection ────────────────────────────────────────
    document.querySelectorAll('.settings-gear-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            const gear = parseInt(btn.dataset.gear, 10);
            if (typeof player !== 'undefined' && player && (player.operatorDays || 1) <= 7) {
                if (typeof showLog === 'function') {
                    showLog('[ GEAR UNLOCKS AFTER YOUR FIRST 7 DAYS ]', 'system');
                }
                return;
            }
            if (typeof saveGear === 'function') saveGear(gear);
            document.querySelectorAll('.settings-gear-btn').forEach(b => b.classList.remove('settings-gear-btn--active'));
            btn.classList.add('settings-gear-btn--active');
        });
    });

    // ── Reset ─────────────────────────────────────────────────
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
