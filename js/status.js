// ═══════════════════════════════════════════════════════════════
// SYD GES — status.js
// Five-tab Status Window. SYD voice throughout. Alive and animated.
//
// PASS 1 changes:
//   Tab structure: STATUS · DIRECTIVES · ENCOUNTER · PATH · SETTINGS
//   - Old OPERATIVE tab merged with old STATS tab → new STATUS tab
//   - ENCOUNTER is now a dedicated tab (was a card at bottom of DIRECTIVES)
//   - Encounter tab dot indicator when encounter is available and not done
//   - Header: name, rank badge, level — tappable. SIG moved into STATUS tab.
//   - Sound toggle removed from header — now lives inside SETTINGS tab.
//   - Rank badge, level badge, momentum bar, capacity bar all tappable
//     with inline drawer/overlay pattern (not a new screen).
//   - STATUS tab: identity block → XP bar → momentum bar → capacity bar
//     → stat bars (tappable with explainer, same logic as old STATS tab)
//     → trait signals section (Level 10+ unlock)
//   - DIRECTIVES tab: encounter card removed. Journal quick-access added at top.
//   - Header wiring: name → rename drawer, rank → rank explainer,
//     level → level progress drawer.
//   - PATH tab: rank clarification note added.
//   - SETTINGS tab: sound toggle added here.
//
// PASS 2 changes:
//   Question/answer visual fix:
//   - reimaginer-q: larger text, accent colour treatment
//   - reimaginer-hint: secondary text
//   - enc-option-btn selected state: cleared on question advance
//   - CSS transition class added for question fade
// ═══════════════════════════════════════════════════════════════

// ─── ACTIVE TAB STATE ────────────────────────────────────────
let activeStatusTab = 'status';

// ─── STATUS WINDOW ENTRY POINT ───────────────────────────────
function renderStatusWindow(animate) {
    renderStatusTab(activeStatusTab, animate);
    wireStatusTabs();
    wireStatusHeader();
    updateEncounterTabDot();
}

// ─── ENCOUNTER TAB DOT INDICATOR ─────────────────────────────
// Shows a dot on the ENCOUNTER tab when an encounter is
// available today and has not yet been completed.
function updateEncounterTabDot() {
    const dot = document.getElementById('encounter-tab-dot');
    if (!dot) return;
    const done = (typeof hasCompletedEncounterToday === 'function')
        && hasCompletedEncounterToday();
    // Show dot only if NOT done (encounter still available)
    dot.classList.toggle('hidden', done);
}

// ─── TAB WIRING ──────────────────────────────────────────────
function wireStatusTabs() {
    const tabs = ['status', 'directives', 'encounter', 'path', 'settings'];
    tabs.forEach(tabId => {
        const btn = document.getElementById('status-tab-' + tabId);
        if (btn && !btn.dataset.wired) {
            btn.dataset.wired = 'true';
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
    // Update dot whenever we switch tabs (encounter may have been completed)
    updateEncounterTabDot();
}

// ─── HEADER WIRING ───────────────────────────────────────────
// Tappable header elements: name → rename drawer,
// rank badge → rank explainer, level badge → level progress drawer.
function wireStatusHeader() {
    const nameEl  = document.getElementById('player-name');
    const rankEl  = document.getElementById('rank-badge');
    const levelEl = document.getElementById('header-level-badge');

    if (nameEl && !nameEl.dataset.wired) {
        nameEl.dataset.wired = 'true';
        nameEl.style.cursor = 'pointer';
        nameEl.addEventListener('click', () => {
            playUIClick();
            showHeaderDrawer('rename');
        });
    }
    if (rankEl && !rankEl.dataset.wired) {
        rankEl.dataset.wired = 'true';
        rankEl.style.cursor = 'pointer';
        rankEl.addEventListener('click', () => {
            playUIClick();
            showHeaderDrawer('rank');
        });
    }
    if (levelEl && !levelEl.dataset.wired) {
        levelEl.dataset.wired = 'true';
        levelEl.style.cursor = 'pointer';
        levelEl.addEventListener('click', () => {
            playUIClick();
            showHeaderDrawer('level');
        });
    }
}

// ─── HEADER DRAWER ───────────────────────────────────────────
// Small inline overlay drawn below the header.
// type: 'rename' | 'rank' | 'level'
function showHeaderDrawer(type) {
    // Remove any existing drawer first
    const existing = document.getElementById('header-drawer');
    if (existing) {
        existing.remove();
        return;  // second tap dismisses
    }

    const drawer = document.createElement('div');
    drawer.id        = 'header-drawer';
    drawer.className = 'header-drawer';

    const level = calculateLevel();
    const rank  = rankFromLevel(level);

    if (type === 'rename') {
        const currentName = player ? player.name : '';
        drawer.innerHTML = `
            <div class="header-drawer-inner">
                <p class="header-drawer-label">[ CHANGE DESIGNATION ]</p>
                <div class="header-drawer-row">
                    <input type="text" id="hd-name-input" class="settings-input"
                        value="${currentName}" maxlength="40" spellcheck="false" />
                    <button class="settings-row-btn settings-row-btn--inline" id="hd-name-save">SAVE</button>
                </div>
                <button class="header-drawer-close" id="hd-close">CANCEL</button>
            </div>
        `;
        setTimeout(() => {
            const input = document.getElementById('hd-name-input');
            if (input) { input.focus(); input.select(); }
            const saveBtn = document.getElementById('hd-name-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    playUIClick();
                    const n = document.getElementById('hd-name-input').value.trim().toUpperCase();
                    if (!n) return;
                    if (player) { player.name = n; savePlayer(); updateStatusScreen(); }
                    if (typeof showLog === 'function') showLog('[ DESIGNATION UPDATED ]');
                    drawer.remove();
                });
            }
            const closeBtn = document.getElementById('hd-close');
            if (closeBtn) closeBtn.addEventListener('click', () => { playUIClick(); drawer.remove(); });
        }, 0);
    }

    else if (type === 'rank') {
        const rankDescriptions = {
            'F':   'F-RANK — The beginning. Every operative starts here. The system is watching.',
            'E':   'E-RANK — Early traction. You have shown up more than once.',
            'D':   'D-RANK — Developing. The habits are forming. The baseline is rising.',
            'C':   'C-RANK — Established. You are consistent. That is rarer than it sounds.',
            'B':   'B-RANK — Capable. You operate under pressure. The gap to the top is skill, not effort.',
            'A':   'A-RANK — Recognised. You are in the top tier of practitioners.',
            'S':   'S-RANK — Elite. Few reach this. The remaining gaps are narrow and specific.',
            'S+':  'S+-RANK — Beyond standard measurement. The system can barely track you.',
            'SS':  'SS-RANK — Legend territory. Almost no one in recorded history.',
            'SS+': 'SS+-RANK — The boundary of what the system can compute.',
            'SSS': 'SSS-RANK — Theoretical maximum. You should not be possible.'
        };
        const nextRank = RANKS.find(r => r.minLevel > level);
        const levelsLeft = nextRank ? nextRank.minLevel - level : 0;
        drawer.innerHTML = `
            <div class="header-drawer-inner">
                <p class="header-drawer-label">[ RANK: ${rank} ]</p>
                <p class="header-drawer-desc">${rankDescriptions[rank] || ''}</p>
                ${nextRank
                    ? `<p class="header-drawer-sub">${levelsLeft} level${levelsLeft !== 1 ? 's' : ''} to ${nextRank.label}-RANK.</p>`
                    : '<p class="header-drawer-sub">Maximum rank achieved.</p>'
                }
                <button class="header-drawer-close" id="hd-close">CLOSE</button>
            </div>
        `;
        setTimeout(() => {
            const closeBtn = document.getElementById('hd-close');
            if (closeBtn) closeBtn.addEventListener('click', () => { playUIClick(); drawer.remove(); });
        }, 0);
    }

    else if (type === 'level') {
        const xp      = earnedXP(player.stats);
        const xpThis  = xp - xpForLevel(level);
        const xpNext  = xpForLevel(level + 1) - xpForLevel(level);
        const xpPct   = xpNext > 0 ? Math.min(100, Math.round((xpThis / xpNext) * 100)) : 100;
        const title   = titleFromLevel(level);
        const nextLvl = level + 1;
        const unlocksEncTier = level < 10 ? ` · Encounter Tier 2 at Level 10` : (level < 25 ? ` · Encounter Tier 3 at Level 25` : '');
        const unlocksTrait   = level < 10 ? ` · Trait Signals at Level 10` : '';
        const unlocksAffinity = level < 20 ? ` · Hidden Affinity at Level 20` : '';
        drawer.innerHTML = `
            <div class="header-drawer-inner">
                <p class="header-drawer-label">[ LEVEL ${level} — ${title} ]</p>
                <div class="hd-xp-bar-wrap">
                    <div class="hd-xp-bar">
                        <div class="hd-xp-bar-fill" style="width:${xpPct}%"></div>
                    </div>
                    <span class="hd-xp-label">${Math.floor(xpThis)} / ${Math.floor(xpNext)} XP to Level ${nextLvl}</span>
                </div>
                ${(unlocksEncTier || unlocksTrait || unlocksAffinity) ? `
                    <p class="header-drawer-sub">UPCOMING UNLOCKS${unlocksEncTier}${unlocksTrait}${unlocksAffinity}.</p>
                ` : '<p class="header-drawer-sub">All unlocks reached. Keep compounding.</p>'}
                <button class="header-drawer-close" id="hd-close">CLOSE</button>
            </div>
        `;
        setTimeout(() => {
            const closeBtn = document.getElementById('hd-close');
            if (closeBtn) closeBtn.addEventListener('click', () => { playUIClick(); drawer.remove(); });
        }, 0);
    }

    // Insert drawer directly after the header bar
    const header = document.getElementById('status-header');
    if (header && header.parentNode) {
        header.parentNode.insertBefore(drawer, header.nextSibling);
    }
    // Animate in
    requestAnimationFrame(() =>
        requestAnimationFrame(() => drawer.classList.add('header-drawer--visible'))
    );

    // Tap outside drawer to dismiss
    setTimeout(() => {
        document.addEventListener('click', function dismissDrawer(e) {
            if (!drawer.contains(e.target) && e.target !== document.getElementById('rank-badge')
                && e.target !== document.getElementById('player-name')
                && e.target !== document.getElementById('header-level-badge')
                && !document.getElementById('header-level-badge')?.contains(e.target)) {
                drawer.remove();
                document.removeEventListener('click', dismissDrawer);
            }
        });
    }, 100);
}

// ─── TAB DISPATCHER ──────────────────────────────────────────
function renderStatusTab(tabId, animate) {
    const content = document.getElementById('status-tab-content');
    if (!content) return;
    // Remove any open header drawer when switching tabs
    const existingDrawer = document.getElementById('header-drawer');
    if (existingDrawer) existingDrawer.remove();

    switch(tabId) {
        case 'status':     renderStatusMainTab(content, animate); break;
        case 'directives': renderDirectivesTab(content);          break;
        case 'encounter':  renderEncounterTab(content);            break;
        case 'path':       renderPathTab(content);                 break;
        case 'settings':   renderSettingsTab(content);             break;
        default:           renderStatusMainTab(content, animate);
    }
}

// ═══════════════════════════════════════════════════════════════
// TAB: STATUS (merged OPERATIVE + STATS)
// Identity block → XP bar → momentum bar → capacity bar →
// stat bars (tappable with explainer) → trait signals (Level 10+)
// ═══════════════════════════════════════════════════════════════

function renderStatusMainTab(container, animate) {
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
    const statShort = {
        strength: 'STR', intelligence: 'INT',
        agility: 'AGI', endurance: 'END', charisma: 'CHA'
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
        <div class="status-main-tab">

            <!-- Identity block -->
            <div class="sot-identity">
                <div class="sot-title">${capacity === 0
                    ? '[ CAPACITY CRITICAL ]'
                    : '[ ' + title + ' ]'
                }</div>
                <div class="sot-name">${player.name}</div>
                <div class="sot-badges">
                    <span class="rank-badge sot-rank-badge ${rankCssClass(rank)}">${rank}</span>
                    <span class="sot-level-badge">LVL ${level}</span>
                    <span class="sot-sig-badge">&#x2B21; ${sig} SIG</span>
                </div>
            </div>

            <div class="sot-divider"></div>

            <!-- XP bar -->
            <div class="sot-xp-block">
                <div class="sot-bar-label">XP &mdash; ${Math.floor(xpThis)} / ${Math.floor(xpNext)} (${xpPct}%)</div>
                <div class="sot-bar">
                    <div class="sot-bar-fill sot-bar-fill--xp" style="width:${xpPct}%"></div>
                </div>
            </div>

            <!-- Momentum bar — tappable -->
            <div class="sot-metric sot-metric--tappable" id="sot-momentum-row">
                <div class="sot-metric-header">
                    <div class="sot-metric-label">MOMENTUM <span class="sot-metric-hint">tap for read</span></div>
                    <div class="sot-metric-value">${momentum.toFixed(2)}&times;</div>
                </div>
                <div class="sot-bar">
                    <div class="sot-bar-fill sot-bar-fill--momentum" style="width:${mPct}%"></div>
                </div>
                <div class="sot-inline-explainer hidden" id="momentum-explainer">
                    <p class="sot-inline-explainer-text">${getMomentumExplainer(momentum)}</p>
                </div>
            </div>

            <!-- Capacity bar — tappable -->
            <div class="sot-metric sot-metric--tappable" id="sot-capacity-row">
                <div class="sot-metric-header">
                    <div class="sot-metric-label">CAPACITY <span class="sot-metric-hint">tap for read</span></div>
                    <div class="sot-metric-value">${capacity} / ${maxCap}</div>
                </div>
                <div class="sot-bar">
                    <div class="sot-bar-fill sot-bar-fill--capacity ${
                        capPct < 25 ? 'sot-bar-fill--critical' :
                        capPct < 50 ? 'sot-bar-fill--amber' : ''
                    }" style="width:${capPct}%"></div>
                </div>
                <div class="sot-inline-explainer hidden" id="capacity-explainer">
                    <p class="sot-inline-explainer-text">${getCapacityExplainer(capacity, maxCap)}</p>
                </div>
            </div>

            <div class="sot-divider"></div>

            <!-- Stat bars — tappable, each expands to SYD's read -->
            <p class="stats-section-label">[ STATS &mdash; TAP ANY ROW FOR SYD'S READ ]</p>
            <div class="stats-full-list">
                ${STAT_NAMES.map(stat => {
                    const val       = player.stats[stat] || STAT_FLOOR;
                    const bp        = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);
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

            <div class="sot-divider"></div>

            <!-- Trait signals section -->
            ${traitsSection}

            <div class="sot-nav-actions">
                <button class="btn btn--primary" id="sot-view-directives">[ VIEW TODAY'S DIRECTIVES ]</button>
                <button class="btn btn--secondary" id="sot-open-training">[ TRAINING FLOOR ]</button>
            </div>

        </div>
    `;

    // Wire quick-action buttons
    document.getElementById('sot-view-directives').addEventListener('click', () => {
        playUIClick(); switchStatusTab('directives');
    });
    document.getElementById('sot-open-training').addEventListener('click', () => {
        playUIClick(); navTo('screen-minigames');
    });

    // Wire momentum row toggle
    const momentumRow = document.getElementById('sot-momentum-row');
    if (momentumRow) {
        momentumRow.addEventListener('click', () => {
            playUIClick();
            const exp = document.getElementById('momentum-explainer');
            const capExp = document.getElementById('capacity-explainer');
            if (capExp) capExp.classList.add('hidden');
            if (exp) exp.classList.toggle('hidden');
        });
    }

    // Wire capacity row toggle
    const capacityRow = document.getElementById('sot-capacity-row');
    if (capacityRow) {
        capacityRow.addEventListener('click', () => {
            playUIClick();
            const exp = document.getElementById('capacity-explainer');
            const momExp = document.getElementById('momentum-explainer');
            if (momExp) momExp.classList.add('hidden');
            if (exp) exp.classList.toggle('hidden');
        });
    }

    // Wire stat rows — same logic as old STATS tab
    const allStatIds = [...STAT_NAMES, 'luck'];
    allStatIds.forEach(stat => {
        const row = document.getElementById('stats-row-' + stat);
        if (!row) return;
        row.addEventListener('click', () => {
            playUIClick();
            const exp       = document.getElementById('explainer-' + stat);
            const wasHidden = exp && exp.classList.contains('hidden');

            // Close all open explainers + metric drawers
            allStatIds.forEach(s => {
                const e = document.getElementById('explainer-' + s);
                if (e) e.classList.add('hidden');
            });

            if (wasHidden && exp) {
                exp.classList.remove('hidden');
                // Attempt personalised Gemini explainer upgrade on first open
                if (stat !== 'luck' && typeof getPersonalisedStatExplainer === 'function') {
                    const textEl   = exp.querySelector('.stats-explainer-text');
                    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
                    const scanTraits = (typeof loadScanTraits === 'function') ? loadScanTraits() : {};
                    const statVal  = player && player.stats ? (player.stats[stat] || STAT_FLOOR) : STAT_FLOOR;
                    if (textEl && !textEl.dataset.geminiDone) {
                        getPersonalisedStatExplainer(stat, statVal, pathData, scanTraits).then(result => {
                            if (result && result.geminiEnhanced && result.text) {
                                textEl.textContent        = result.text;
                                textEl.dataset.geminiDone = '1';
                            }
                        }).catch(() => { /* fallback already shown */ });
                    }
                }
            }
        });
    });

    // Animate stat numbers on initial render
    if (animate) {
        setTimeout(() => {
            STAT_NAMES.forEach(stat => {
                animateNumber('val-' + stat, 0, Math.floor(player.stats[stat] || STAT_FLOOR), 600);
            });
        }, 100);
    }
}

// ─── MOMENTUM EXPLAINER ───────────────────────────────────────
function getMomentumExplainer(momentum) {
    if (momentum >= 1.4) {
        return 'MOMENTUM at ' + momentum.toFixed(2) + '×. You are compounding. Consecutive days multiply the XP you earn from every directive. Breaking the chain now costs more than it did a week ago.';
    }
    if (momentum >= 1.2) {
        return 'MOMENTUM at ' + momentum.toFixed(2) + '×. Building. You are earning more XP per directive than when you started. The multiplier rises toward 1.5× asymptotically over 14 consecutive days.';
    }
    if (momentum >= 1.05) {
        return 'MOMENTUM at ' + momentum.toFixed(2) + '×. Early compounding. The effect is not visible yet, but the system is tracking it. Show up tomorrow.';
    }
    return 'MOMENTUM at ' + momentum.toFixed(2) + '×. Baseline. Missed days decay the multiplier. One consecutive day lifts it. The system resets on progress — not on punishment.';
}

// ─── CAPACITY EXPLAINER ──────────────────────────────────────
function getCapacityExplainer(capacity, maxCap) {
    const pct = Math.round((capacity / maxCap) * 100);
    if (pct >= 80) {
        return 'CAPACITY at ' + pct + '%. You are recovered. Capacity drops under sustained high-intensity effort and recovers through rest directives and consistent completion. You are in a position to push.';
    }
    if (pct >= 50) {
        return 'CAPACITY at ' + pct + '%. Functional. Complete your directives. Include a rest or recovery directive if one is available today.';
    }
    if (pct >= 25) {
        return 'CAPACITY at ' + pct + '%. Below midpoint. Your directives are your ceiling for today — not your floor. Finish them. Do not add to the load.';
    }
    return 'CAPACITY at ' + pct + '%. Low. This is a signal, not a punishment. Something has been draining it. Today\'s directives are your minimum viable session. Recovery compounds too.';
}

// ─── LOCAL STAT EXPLAINERS ────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// TAB: DIRECTIVES
// PASS 1 changes:
//   - Encounter card removed from bottom of tab
//   - Journal quick-access button added at top
//   - Encounter quick-access button added at top (switches to ENCOUNTER tab)
// ═══════════════════════════════════════════════════════════════

function renderDirectivesTab(container) {
    if (!player) return;

    const allDone = (dailyQuests || []).every(q => (player.completedToday || []).includes(q.id));

    container.innerHTML = `
        <div class="status-directives-tab">

            <!-- PASS 1: Quick-access bar at top of directives tab -->
            <div class="directives-quick-bar">
                <button class="dq-btn" id="dq-encounter-btn">
                    &#x25CB; TODAY'S ENCOUNTER
                </button>
                <button class="dq-btn" id="dq-journal-btn">
                    &#x2393; OPEN JOURNAL
                </button>
            </div>

            ${allDone ? `
                <div class="directives-all-done">
                    <p class="directives-done-msg">[ ALL DIRECTIVES EXECUTED ]</p>
                    <p class="directives-done-sub">Today's signal is clear.</p>
                </div>
            ` : ''}

            <div class="directives-list-wrap" id="quest-list"></div>

            <div class="journal-prompt-wrap" id="journal-prompt-wrap"></div>
        </div>
    `;

    if (typeof renderDirectives === 'function') {
        renderDirectives(dailyQuests || [], player.completedToday || []);
    }

    // Wire quick-access buttons
    const encBtn = document.getElementById('dq-encounter-btn');
    if (encBtn) {
        encBtn.addEventListener('click', () => {
            playUIClick();
            switchStatusTab('encounter');
        });
    }
    const journalBtn = document.getElementById('dq-journal-btn');
    if (journalBtn) {
        journalBtn.addEventListener('click', () => {
            playUIClick();
            // Scroll to journal section
            setTimeout(() => {
                const journalWrap = document.getElementById('journal-prompt-wrap');
                if (journalWrap) journalWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        });
    }

    renderJournalPrompt();
}

// ═══════════════════════════════════════════════════════════════
// TAB: ENCOUNTER
// PASS 1 — new dedicated tab.
// Renders encounter inline within the tab content area.
// Uses encounter.js logic but renders into status-tab-content
// instead of routing to screen-encounter.
// States: available → done → none loaded
// ═══════════════════════════════════════════════════════════════

function renderEncounterTab(container) {
    const done = (typeof hasCompletedEncounterToday === 'function')
        && hasCompletedEncounterToday();

    if (done) {
        container.innerHTML = `
            <div class="encounter-tab-wrap">
                <div class="enc-done-body enc-tab-done">
                    <div class="enc-done-icon">&#x2B21;</div>
                    <p class="enc-done-label">[ TODAY'S ENCOUNTER LOGGED ]</p>
                    <p class="enc-done-sub">Another transmission arrives tomorrow.</p>
                </div>
            </div>
        `;
        updateEncounterTabDot();
        return;
    }

    // Show loading state while pool initialises
    container.innerHTML = `
        <div class="encounter-tab-wrap">
            <div class="encounter-loading">
                <div class="enc-loading-icon">&#x2B21;</div>
                <p class="enc-loading-label">[ LOADING TRANSMISSION... ]</p>
            </div>
        </div>
    `;

    // Load encounter pool then render inline
    if (typeof loadEncounterPool === 'function') {
        loadEncounterPool().then(() => {
            const level     = (typeof calculateLevel === 'function') ? calculateLevel() : 1;
            const encounter = (typeof getTodaysEncounter === 'function')
                ? getTodaysEncounter(level)
                : null;

            if (!encounter) {
                container.innerHTML = `
                    <div class="encounter-tab-wrap">
                        <div class="enc-done-body enc-tab-done">
                            <div class="enc-done-icon">&#x2B21;</div>
                            <p class="enc-done-label">[ NO ENCOUNTER TODAY ]</p>
                            <p class="enc-done-sub">The system is standing by. Tomorrow a transmission will be queued.</p>
                        </div>
                    </div>
                `;
                updateEncounterTabDot();
                return;
            }

            // Render encounter situation inline (adapted from encounter.js)
            renderEncounterInTab(container, encounter);
        });
    }
}

// Renders encounter situation inside the STATUS tab content area.
// This mirrors renderEncounterSituation() in encounter.js but targets
// the tab container instead of screen-encounter.
function renderEncounterInTab(container, enc) {
    if (!container || !enc) return;

    // Store encounter in state so encounter.js evaluation functions can access it
    if (typeof encounterState !== 'undefined') {
        encounterState.encounter        = enc;
        encounterState.selectedOption   = null;
        encounterState.selectedReasoning = null;
        encounterState.freeText         = '';
    }

    container.innerHTML = `
        <div class="encounter-tab-wrap">
            <div class="encounter-tab-header">
                <span class="enc-label">[ TRANSMISSION INCOMING ]</span>
                <span class="enc-optional-note">Optional &mdash; no penalty for skipping</span>
            </div>
            <div class="encounter-situation">
                <p class="enc-situation-text">${enc.situation}</p>
            </div>
            <div class="enc-options" id="enc-options">
                ${(enc.options || []).map(opt => `
                    <button class="enc-option-btn" data-option-id="${opt.id}">
                        ${opt.text}
                    </button>
                `).join('')}
            </div>
            <div class="enc-free-text-wrap">
                <p class="enc-free-text-label">[ OPTIONAL — TYPE YOUR OWN RESPONSE ]</p>
                <textarea
                    id="enc-free-text"
                    class="enc-textarea"
                    placeholder="Your read on this situation..."
                    maxlength="500"
                ></textarea>
            </div>
            <div class="enc-footer-actions">
                <button class="enc-skip-btn" id="enc-tab-skip">SKIP TODAY</button>
                <button class="btn btn--primary enc-submit-btn" id="enc-tab-to-reasoning">
                    [ PICK YOUR REASONING ]
                </button>
            </div>
        </div>
    `;

    // Wire option selection
    document.querySelectorAll('.enc-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.enc-option-btn').forEach(b =>
                b.classList.remove('enc-option-btn--selected')
            );
            btn.classList.add('enc-option-btn--selected');
            if (typeof encounterState !== 'undefined') {
                encounterState.selectedOption = btn.dataset.optionId;
            }
        });
    });

    // Skip
    document.getElementById('enc-tab-skip').addEventListener('click', () => {
        playUIClick();
        if (typeof markEncounterSkipped === 'function') markEncounterSkipped();
        renderEncounterTab(container);
    });

    // Advance to reasoning
    document.getElementById('enc-tab-to-reasoning').addEventListener('click', () => {
        playUIClick();
        const freeTextEl = document.getElementById('enc-free-text');
        const freeText   = freeTextEl ? freeTextEl.value.trim() : '';
        if (typeof encounterState !== 'undefined') encounterState.freeText = freeText;

        const selectedOption = (typeof encounterState !== 'undefined')
            ? encounterState.selectedOption
            : null;

        if (!selectedOption && !freeText) {
            if (freeTextEl) freeTextEl.focus();
            if (typeof showLog === 'function') {
                showLog('[ PICK A RESPONSE OR TYPE YOUR READ BEFORE ADVANCING ]', 'system');
            }
            return;
        }

        // Render reasoning inside the tab
        renderEncounterReasoningInTab(container, enc);
    });
}

function renderEncounterReasoningInTab(container, enc) {
    if (!container || !enc) return;

    container.innerHTML = `
        <div class="encounter-tab-wrap">
            <div class="encounter-tab-header">
                <span class="enc-label">[ WHY THAT CALL? ]</span>
            </div>
            <div class="encounter-situation encounter-situation--reasoning">
                <p class="enc-situation-text enc-situation-text--small">${enc.situation}</p>
            </div>
            <div class="enc-options" id="enc-reasoning-options">
                ${(enc.reasonings || []).map(r => `
                    <button class="enc-option-btn enc-reasoning-btn" data-reasoning-id="${r.id}">
                        ${r.text}
                    </button>
                `).join('')}
            </div>
            <div class="enc-free-text-wrap">
                <p class="enc-free-text-label">[ ADD YOUR OWN REASONING — OPTIONAL ]</p>
                <textarea
                    id="enc-reasoning-text"
                    class="enc-textarea"
                    placeholder="The reason behind your choice..."
                    maxlength="500"
                >${(typeof encounterState !== 'undefined' && encounterState.freeText) ? encounterState.freeText : ''}</textarea>
            </div>
            <div class="enc-footer-actions">
                <button class="enc-skip-btn" id="enc-tab-skip-r">SKIP</button>
                <button class="btn btn--primary enc-submit-btn" id="enc-tab-submit">
                    [ SUBMIT ]
                </button>
            </div>
        </div>
    `;

    document.querySelectorAll('.enc-reasoning-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.enc-reasoning-btn').forEach(b =>
                b.classList.remove('enc-option-btn--selected')
            );
            btn.classList.add('enc-option-btn--selected');
            if (typeof encounterState !== 'undefined') {
                encounterState.selectedReasoning = btn.dataset.reasoningId;
            }
        });
    });

    document.getElementById('enc-tab-skip-r').addEventListener('click', () => {
        playUIClick();
        if (typeof markEncounterSkipped === 'function') markEncounterSkipped();
        renderEncounterTab(container);
    });

    document.getElementById('enc-tab-submit').addEventListener('click', () => {
        playUIClick();
        const reasoningTextEl = document.getElementById('enc-reasoning-text');
        const reasoningText   = reasoningTextEl ? reasoningTextEl.value.trim() : '';

        if (typeof encounterState !== 'undefined' && reasoningText) {
            encounterState.freeText = reasoningText;
        }

        const selectedReasoning = (typeof encounterState !== 'undefined')
            ? encounterState.selectedReasoning
            : null;

        if (!selectedReasoning && !reasoningText) {
            if (reasoningTextEl) reasoningTextEl.focus();
            if (typeof showLog === 'function') {
                showLog('[ PICK A REASONING OR TYPE YOUR OWN ]', 'system');
            }
            return;
        }

        // Submit — route to encounter evaluation (from encounter.js)
        // Type B (teaching) encounters skip Gemini evaluation
        if (enc.type === 'B' || enc.type === 'teaching') {
            if (typeof markEncounterComplete === 'function') markEncounterComplete();
            renderEncounterTeachingInTab(container, enc);
        } else {
            // Type A: evaluation
            renderEncounterEvaluatingInTab(container, enc);
        }
    });
}

function renderEncounterTeachingInTab(container, enc) {
    if (!container || !enc) return;
    updateEncounterTabDot();
    container.innerHTML = `
        <div class="encounter-tab-wrap">
            <div class="encounter-tab-header">
                <span class="enc-label">[ SYD — EXPERT THINKING ]</span>
            </div>
            <div class="enc-feedback enc-feedback--teaching">
                <p class="enc-feedback-text">${enc.teaching || ''}</p>
            </div>
            <div class="enc-footer-actions">
                <button class="btn btn--primary" id="enc-tab-done">[ ACKNOWLEDGED ]</button>
            </div>
        </div>
    `;
    document.getElementById('enc-tab-done').addEventListener('click', () => {
        playUIClick();
        renderEncounterTab(container);
    });
}

function renderEncounterEvaluatingInTab(container, enc) {
    container.innerHTML = `
        <div class="encounter-tab-wrap">
            <div class="encounter-loading">
                <div class="enc-loading-icon">&#x2B21;</div>
                <p class="enc-loading-label">[ SYD IS EVALUATING... ]</p>
            </div>
        </div>
    `;

    // Delegate to encounter.js evaluation
    if (typeof evaluateJudgmentEncounter === 'function') {
        const es = (typeof encounterState !== 'undefined') ? encounterState : {};
        evaluateJudgmentEncounter(enc, es.selectedOption, es.selectedReasoning, es.freeText)
            .then(result => {
                if (typeof markEncounterComplete === 'function') markEncounterComplete();
                updateEncounterTabDot();
                container.innerHTML = `
                    <div class="encounter-tab-wrap">
                        <div class="encounter-tab-header">
                            <span class="enc-label">[ SYD — EVALUATION ]</span>
                        </div>
                        <div class="enc-feedback ${result && result.verdict ? 'enc-feedback--' + result.verdict : ''}">
                            <p class="enc-feedback-text">${result ? result.feedback : 'Acknowledged.'}</p>
                        </div>
                        <div class="enc-footer-actions">
                            <button class="btn btn--primary" id="enc-tab-done">[ ACKNOWLEDGED ]</button>
                        </div>
                    </div>
                `;
                document.getElementById('enc-tab-done').addEventListener('click', () => {
                    playUIClick();
                    renderEncounterTab(container);
                });
            })
            .catch(() => {
                if (typeof markEncounterComplete === 'function') markEncounterComplete();
                updateEncounterTabDot();
                renderEncounterTab(container);
            });
    } else {
        if (typeof markEncounterComplete === 'function') markEncounterComplete();
        updateEncounterTabDot();
        renderEncounterTab(container);
    }
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
// PASS 1: Added rank clarification note distinguishing
// PATH rank from level-derived rank in the header.
// ═══════════════════════════════════════════════════════════════

// ─── LOCAL GAP READ ──────────────────────────────────────────
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

// ─── HIDDEN AFFINITY TEASER ──────────────────────────────────
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

                <!-- PASS 1: Rank clarification note -->
                <div class="path-rank-clarification">
                    <p class="path-rank-note">
                        Your PATH rank reflects where SYD placed you based on your record.
                        The rank in the header rises separately through XP and level.
                    </p>
                </div>

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
                        ? '<div class="path-tab-rank">PATH STARTING RANK: ' + pathData.confirmedRank + '</div>'
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

// ═══════════════════════════════════════════════════════════════
// TAB: SETTINGS
// PASS 1 changes:
//   - Sound toggle added here (removed from global header)
//   - Neural link and other settings unchanged
// ═══════════════════════════════════════════════════════════════

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

            <!-- PASS 1: Sound toggle moved here from header -->
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
        const btn = document.getElementById('settings-sound-toggle');
        if (btn) btn.textContent = 'SOUND: ' + (typeof soundEnabled !== 'undefined' && soundEnabled ? 'ON' : 'OFF');
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
            document.querySelectorAll('.settings-gear-btn').forEach(b =>
                b.classList.remove('settings-gear-btn--active')
            );
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