// ═══════════════════════════════════════════════════════════════
// SYD GES — status.js
// Two-tab Status Window — RESPEC build.
//
// PASS 1 changes (preserved):
//   - Rank badge, level badge, momentum bar, capacity bar all tappable
//   - Header: name, rank badge, level — tappable with inline drawers
//   - Stat rows tappable with SYD's read
//   - Trait signals section (Level 10+ unlock)
//   - Journal quick-access in directives view
//
// PASS 2 changes (preserved):
//   - Encounter flow fully inline
//   - Reimaginer UI improvements
//
// RESPEC changes:
//   - TWO TABS: OPS and STATUS only. No PATH tab. No SETTINGS tab. No DIRECTIVES/ENCOUNTER tabs.
//   - OPS tab has three SEGMENTS: DIRECTIVES · ENCOUNTER · GAMES
//   - Segments switch instantly via segment button bar at top of OPS content
//   - STATUS tab is a single scrollable view:
//       1. Identity (tappable elements)
//       2. Base Stats (tappable with SYD read)
//       3. Trait Signals (Level 10+ unlock)
//       4. Career Skills (placeholder — seeded in Block C)
//       5. PATH (all elements tappable — Block A wires inline drawers)
//       6. Settings (inline, no separate screen — Neural Link manage → screen-neural)
//   - Encounter dot indicator moved from ENCOUNTER tab to OPS tab
//   - activeOpsSegment variable tracks current OPS segment
//   - switchStatusTab() handles 'ops' and 'status' only
//   - switchOpsSegment() handles 'directives', 'encounter', 'games'
//   - renderDirectivesSegment() replaces renderDirectivesTab() (kept as alias)
//   - renderEncounterSegment() replaces renderEncounterTab() (kept as alias)
//   - renderGamesSegment() — new, placeholder (full implementation Block E)
//   - STATUS tab: renderStatusMainContent() (single scroll with all sections)
//   - Settings in STATUS: renderSettingsSection() (inline at scroll bottom)
//   - PATH in STATUS: renderPathSection() (all elements tappable)
//
// BLOCK B changes:
//   - Career Skills section in STATUS tab — live implementation replaces placeholder.
//   - buildCareerSkillsSection() renders tracks loaded from syd_career_skills.
//   - Each track shows: name, score, progress bar with soft cap marker,
//     stat mapping tag. Tappable to expand description inline.
//   - If no tracks exist: shows contextual empty state based on whether PATH
//     has been run and whether Neural Link is connected.
//   - wireCareerSkillsSection() wires tap handlers after render.
//   - renderStatusMainContent() updated to call live career skills builder.
// ═══════════════════════════════════════════════════════════════

// ─── ACTIVE STATE ────────────────────────────────────────────
let activeStatusTab  = 'status';   // 'ops' | 'status'
let activeOpsSegment = 'directives'; // 'directives' | 'encounter' | 'games'

// ─── STATUS WINDOW ENTRY POINT ───────────────────────────────
function renderStatusWindow(animate) {
    renderStatusTab(activeStatusTab, animate);
    wireStatusTabs();
    wireStatusHeader();
    updateEncounterTabDot();
}

// ─── ENCOUNTER DOT INDICATOR ─────────────────────────────────
// Shows a dot on the OPS tab when an encounter is available
// and has not yet been completed today.
function updateEncounterTabDot() {
    const dot = document.getElementById('encounter-tab-dot');
    if (!dot) return;
    const done = (typeof hasCompletedEncounterToday === 'function')
        && hasCompletedEncounterToday();
    // Show dot only if NOT done (encounter still pending)
    dot.classList.toggle('hidden', done);
}

// ─── TAB WIRING ──────────────────────────────────────────────
// RESPEC: Two tabs only — 'ops' and 'status'.
function wireStatusTabs() {
    const tabs = ['ops', 'status'];
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

// ─── SWITCH TAB ──────────────────────────────────────────────
// RESPEC: Accepts 'ops' or 'status'.
// For backward compatibility, any unknown tabId falls back to 'ops'.
function switchStatusTab(tabId) {
    // Map legacy tab names to new structure
    const legacyMap = {
        'directives': 'ops',
        'encounter':  'ops',
        'path':       'status',
        'settings':   'status'
    };
    const resolvedTab = legacyMap[tabId] || (tabId === 'ops' || tabId === 'status' ? tabId : 'ops');
    activeStatusTab = resolvedTab;

    document.querySelectorAll('.status-tab-btn').forEach(btn => {
        btn.classList.toggle('status-tab-btn--active', btn.dataset.tab === resolvedTab);
    });
    renderStatusTab(resolvedTab, false);
    updateEncounterTabDot();
}

// ─── SWITCH OPS SEGMENT ──────────────────────────────────────
// RESPEC: Switches between DIRECTIVES, ENCOUNTER, GAMES within OPS tab.
// Ensures OPS tab is active first.
function switchOpsSegment(segmentId) {
    if (activeStatusTab !== 'ops') {
        switchStatusTab('ops');
    }
    activeOpsSegment = segmentId;
    renderOpsSegment(segmentId);
    updateOpsSegmentButtons(segmentId);
    updateEncounterTabDot();
}

// ─── UPDATE OPS SEGMENT BUTTONS ──────────────────────────────
function updateOpsSegmentButtons(segmentId) {
    document.querySelectorAll('.ops-segment-btn').forEach(btn => {
        btn.classList.toggle('ops-segment-btn--active', btn.dataset.segment === segmentId);
    });
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
        const nextRank    = RANKS.find(r => r.minLevel > level);
        const levelsLeft  = nextRank ? nextRank.minLevel - level : 0;
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
        const unlocksEncTier  = level < 10 ? ` · Encounter Tier 2 at Level 10` : (level < 25 ? ` · Encounter Tier 3 at Level 25` : '');
        const unlocksTrait    = level < 10 ? ` · Trait Signals at Level 10` : '';
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
// RESPEC: Routes to 'ops' or 'status'.
function renderStatusTab(tabId, animate) {
    const content = document.getElementById('status-tab-content');
    if (!content) return;

    // Remove any open header drawer when switching tabs
    const existingDrawer = document.getElementById('header-drawer');
    if (existingDrawer) existingDrawer.remove();

    if (tabId === 'ops') {
        renderOpsTab(content);
    } else {
        renderStatusMainContent(content, animate);
    }
}

// ═══════════════════════════════════════════════════════════════
// TAB: OPS
// Contains segment button bar + active segment content.
// RESPEC: This replaces the old DIRECTIVES, ENCOUNTER, and
// mini-game hub navigation.
// ═══════════════════════════════════════════════════════════════

function renderOpsTab(container) {
    // Build the shell: segment button bar + content area for the active segment
    container.innerHTML = `
        <div class="ops-tab-wrap">
            <div class="ops-segment-bar" id="ops-segment-bar">
                <button class="ops-segment-btn ${activeOpsSegment === 'directives' ? 'ops-segment-btn--active' : ''}"
                    data-segment="directives">DIRECTIVES</button>
                <button class="ops-segment-btn ${activeOpsSegment === 'encounter' ? 'ops-segment-btn--active' : ''}"
                    data-segment="encounter">ENCOUNTER</button>
                <button class="ops-segment-btn ${activeOpsSegment === 'games' ? 'ops-segment-btn--active' : ''}"
                    data-segment="games">GAMES</button>
                <button class="ops-segment-btn ${activeOpsSegment === 'signal' ? 'ops-segment-btn--active' : ''}"
                    data-segment="signal">CV REFRAME</button>
            </div>
            <div class="ops-segment-content" id="ops-segment-content"></div>
        </div>
    `;

    // Wire segment buttons
    document.querySelectorAll('.ops-segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            switchOpsSegment(btn.dataset.segment);
        });
    });

    // Render the currently active segment
    renderOpsSegment(activeOpsSegment);
}

// ─── OPS SEGMENT DISPATCHER ──────────────────────────────────
function renderOpsSegment(segmentId) {
    const content = document.getElementById('ops-segment-content');
    if (!content) return;

    switch(segmentId) {
        case 'directives': renderDirectivesSegment(content); break;
        case 'encounter':  renderEncounterSegment(content);  break;
        case 'games':      renderGamesSegment(content);      break;
        case 'signal':     renderSignalSegment(content);     break;
        default:           renderDirectivesSegment(content);
    }
}

// ═══════════════════════════════════════════════════════════════
// SEGMENT: DIRECTIVES
// All directive card logic preserved from old DIRECTIVES tab.
// Journal quick-access at bottom preserved.
// RESPEC: Encounter shortcut routes to ENCOUNTER segment (not a tab).
// ═══════════════════════════════════════════════════════════════

function renderDirectivesSegment(container) {
    if (!player) return;

    const allDone = (dailyQuests || []).every(q => (player.completedToday || []).includes(q.id));

    container.innerHTML = `
        <div class="status-directives-tab">

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

    // RESPEC: Encounter shortcut → ENCOUNTER segment (not a tab)
    const encBtn = document.getElementById('dq-encounter-btn');
    if (encBtn) {
        encBtn.addEventListener('click', () => {
            playUIClick();
            switchOpsSegment('encounter');
        });
    }

    const journalBtn = document.getElementById('dq-journal-btn');
    if (journalBtn) {
        journalBtn.addEventListener('click', () => {
            playUIClick();
            setTimeout(() => {
                const journalWrap = document.getElementById('journal-prompt-wrap');
                if (journalWrap) journalWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        });
    }

    renderJournalPrompt();
}

// ═══════════════════════════════════════════════════════════════
// SEGMENT: SIGNAL TRANSLATION
// Shows the Role Translation Kit generated by Call 2B.
// Operative can copy current-role and target-role bullet reframes.
// Falls back gracefully if Call 2B hasn't fired or has no data.
// ═══════════════════════════════════════════════════════════════

function renderSignalSegment(container) {
    if (!container) return;

    // Check if path data exists at all — signal translation requires PATH completion
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    if (!pathData) {
        container.innerHTML = `
            <div class="signal-translation-wrap">
                <p class="st-label">[ SIGNAL TRANSLATION ]</p>
                <p class="st-sub">Complete the PATH protocol to unlock signal translation.</p>
            </div>
        `;
        return;
    }

    const kit = (typeof loadSignalTranslation === 'function') ? loadSignalTranslation() : null;

    if (kit && kit.current_bullets && kit.current_bullets.length > 0) {
        container.innerHTML = `
            <div class="signal-translation-wrap">
                <div class="st-header">
                    <p class="st-label">[ SIGNAL TRANSLATION ]</p>
                    <p class="st-sub">Your record reframed in the language of the roles your pattern points to.</p>
                </div>

                <div class="st-role-block">
                    <div class="st-role-section">
                        <p class="st-role-tag">APPLY FOR THIS NOW</p>
                        <p class="st-role-name">${kit.current_role || 'Current Match'}</p>
                        ${kit.headline_current ? `<p class="st-headline">${kit.headline_current}</p>` : ''}
                        <ul class="st-bullets">
                            ${(kit.current_bullets || []).map(b => `<li class="st-bullet">${b}</li>`).join('')}
                        </ul>
                        <div class="st-role-section-header">
                            <div>
                                <p class="st-role-tag">APPLY FOR THIS NOW</p>
                                <p class="st-role-name">${kit.current_role || 'Current Match'}</p>
                                ${kit.headline_current ? `<p class="st-headline">${kit.headline_current}</p>` : ''}
                            </div>
                            <button class="st-copy-btn st-copy-btn--inline" id="st-copy-now-ops">COPY TO CV →</button>
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
                            <button class="st-copy-btn st-copy-btn--inline" id="st-copy-target-ops">COPY TO CV →</button>
                        </div>
                        <ul class="st-bullets">
                            ${(kit.target_bullets || []).map(b => `<li class="st-bullet">${b}</li>`).join('')}
                        </ul>
                </div>

                ${kit.gap_note ? `
                    <div class="st-gap-block">
                        <p class="st-gap-label">[ GAP TO CLOSE ]</p>
                        <p class="st-gap-note">${kit.gap_note}</p>
                    </div>
                ` : ''}

                <p class="st-footer-note">Copy these bullets. Use them. The directives are built to close the gap above.</p>
            </div>
        `;

        // Wire copy buttons
        const copyNow = document.getElementById('st-copy-now-ops');
        if (copyNow) {
            copyNow.addEventListener('click', () => {
                playUIClick();
                const text = (kit.headline_current ? kit.headline_current + '\n\n' : '')
                    + (kit.current_bullets || []).map(b => '• ' + b).join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    copyNow.textContent = '[ COPIED ]';
                    setTimeout(() => { copyNow.textContent = '[ COPY BULLETS ]'; }, 2000);
                }).catch(() => {});
            });
        }

        const copyTarget = document.getElementById('st-copy-target-ops');
        if (copyTarget) {
            copyTarget.addEventListener('click', () => {
                playUIClick();
                const text = (kit.headline_target ? kit.headline_target + '\n\n' : '')
                    + (kit.target_bullets || []).map(b => '• ' + b).join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    copyTarget.textContent = '[ COPIED ]';
                    setTimeout(() => { copyTarget.textContent = '[ COPY BULLETS ]'; }, 2000);
                }).catch(() => {});
            });
        }

    } else {
        // Kit not yet available — show placeholder
        container.innerHTML = `
            <div class="signal-translation-wrap signal-translation-wrap--loading">
                <p class="st-label">[ SIGNAL TRANSLATION ]</p>
                <p class="st-loading-line">Translation is processing. Check back shortly.</p>
                <p class="st-sub" style="margin-top:0.5rem;">If this persists, your Neural Link may not have been connected during onboarding. Re-run PATH with a connected key to generate your translation.</p>
            </div>
        `;
    }
}

// Alias for backward compatibility — any code calling renderDirectivesTab() still works.
function renderDirectivesTab(container) {
    renderDirectivesSegment(container || document.getElementById('ops-segment-content'));
}

// ═══════════════════════════════════════════════════════════════
// SEGMENT: ENCOUNTER
// Inline encounter flow preserved exactly from old ENCOUNTER tab.
// RESPEC: Renders inside ops-segment-content instead of status-tab-content.
// ═══════════════════════════════════════════════════════════════

function renderEncounterSegment(container) {
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

    container.innerHTML = `
        <div class="encounter-tab-wrap">
            <div class="encounter-loading">
                <div class="enc-loading-icon">&#x2B21;</div>
                <p class="enc-loading-label">[ LOADING TRANSMISSION... ]</p>
            </div>
        </div>
    `;

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

            renderEncounterInTab(container, encounter);
        });
    }
}

// Alias for backward compatibility
function renderEncounterTab(container) {
    renderEncounterSegment(container || document.getElementById('ops-segment-content'));
}

// Renders encounter situation inline.
// Preserved exactly from Pass 1 — only the target container changes.
function renderEncounterInTab(container, enc) {
    if (!container || !enc) return;

    if (typeof encounterState !== 'undefined') {
        encounterState.encounter         = enc;
        encounterState.selectedOption    = null;
        encounterState.selectedReasoning = null;
        encounterState.freeText          = '';
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

    document.getElementById('enc-tab-skip').addEventListener('click', () => {
        playUIClick();
        if (typeof markEncounterSkipped === 'function') markEncounterSkipped();
        renderEncounterSegment(container);
    });

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
        renderEncounterSegment(container);
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

        if (enc.type === 'B' || enc.type === 'teaching') {
            if (typeof markEncounterComplete === 'function') markEncounterComplete();
            renderEncounterTeachingInTab(container, enc);
        } else {
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
        renderEncounterSegment(container);
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
                    renderEncounterSegment(container);
                });
            })
            .catch(() => {
                if (typeof markEncounterComplete === 'function') markEncounterComplete();
                updateEncounterTabDot();
                renderEncounterSegment(container);
            });
    } else {
        if (typeof markEncounterComplete === 'function') markEncounterComplete();
        updateEncounterTabDot();
        renderEncounterSegment(container);
    }
}

// ═══════════════════════════════════════════════════════════════
// SEGMENT: GAMES
// RESPEC Block E: Full implementation. Delegates to minigames.js
// renderGamesHub() which renders full game cards with instructions,
// first-play SYD prompts (localStorage tracked), and scan replay link.
// Block A had placeholder cards here — this replaces them entirely.
// ═══════════════════════════════════════════════════════════════

function renderGamesSegment(container) {
    const sig = (typeof player !== 'undefined' && player) ? (player.sig || 0) : 0;

    // Delegate to minigames.js — full implementation lives there.
    if (typeof renderGamesHub === 'function') {
        renderGamesHub(container, sig);
    } else {
        // Fallback if minigames.js not yet loaded
        container.innerHTML = `
            <div class="games-segment-wrap">
                <p class="games-syd-line">[ TRAINING FLOOR LOADING... ]</p>
            </div>
        `;
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
// TAB: STATUS
// RESPEC: Single scrollable view. All sections rendered inline.
// Sections: Identity → Base Stats → Trait Signals → Career Skills
//           (placeholder) → PATH (tappable) → Settings (inline)
// ═══════════════════════════════════════════════════════════════

function renderStatusMainContent(container, animate) {
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

    const traitOrder = [
        'patternRecognition', 'cognitiveFlexibility', 'persistence',
        'executionSpeed', 'executionAccuracy', 'pressureStability', 'socialReading'
    ];

    // ── Trait signals section ──────────────────────────────────
    const traitsSection = level >= 10
        ? `
            <div class="stats-traits-block">
                <p class="status-section-label">[ TRAIT SIGNALS ]</p>
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

    // ── Career Skills — live implementation (Block B) ─────────
    const careerSkillsSection = buildCareerSkillsSection();

    // ── PATH section ──────────────────────────────────────────
    const pathSection = buildPathSection(level);

    // ── Settings section ──────────────────────────────────────
    const settingsSection = buildSettingsSection();

    container.innerHTML = `
        <div class="status-main-scroll">

            <!-- ── 1. IDENTITY ─────────────────────────────── -->
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
                    <button class="sot-settings-shortcut" id="sot-settings-shortcut" title="Settings">&#x2699;</button>
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

            <!-- ── 2. BASE STATS ───────────────────────────── -->
            <p class="status-section-label">[ BASE STATS &mdash; TAP ANY ROW FOR SYD'S READ ]</p>
            <div class="stats-full-list">
                ${STAT_NAMES.map(stat => {
                    const val       = player.stats[stat] || STAT_FLOOR;
                    const bp        = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);
                    const explainer = getStatExplainer(stat, val);
                    return `
                        <div class="stats-row tappable" id="stats-row-${stat}">
                            <div class="stats-row-header">
                                <span class="stats-row-label" style="color:${statColour[stat]}">${statLabel[stat]}</span>
                                <span class="stats-row-val" id="val-${stat}">${Math.floor(val)}</span>
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

                <!-- Luck row — derived, always last -->
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

            <!-- ── 3. TRAIT SIGNALS ───────────────────────── -->
            ${traitsSection}

            <div class="sot-divider"></div>

            <!-- ── 4. CAREER SKILLS (placeholder) ─────────── -->
            ${careerSkillsSection}

            <div class="sot-divider"></div>

            <!-- ── 5. PATH ────────────────────────────────── -->
            ${pathSection}

            <div class="sot-divider"></div>

            <!-- ── 6. SETTINGS (inline) ──────────────────── -->
            ${settingsSection}

            <!-- Quick action: view directives -->
            <div class="sot-nav-actions">
                <button class="btn btn--primary" id="sot-view-directives">[ VIEW TODAY'S DIRECTIVES ]</button>
            </div>

        </div>
    `;

    // ── Wire quick-action button ──────────────────────────────
    document.getElementById('sot-view-directives').addEventListener('click', () => {
        playUIClick();
        switchStatusTab('ops');
        switchOpsSegment('directives');
    });

    // ── Wire momentum row toggle ──────────────────────────────
    const momentumRow = document.getElementById('sot-momentum-row');
    if (momentumRow) {
        momentumRow.addEventListener('click', () => {
            playUIClick();
            const exp    = document.getElementById('momentum-explainer');
            const capExp = document.getElementById('capacity-explainer');
            if (capExp) capExp.classList.add('hidden');
            if (exp) exp.classList.toggle('hidden');
        });
    }

    // ── Wire capacity row toggle ──────────────────────────────
    const capacityRow = document.getElementById('sot-capacity-row');
    if (capacityRow) {
        capacityRow.addEventListener('click', () => {
            playUIClick();
            const exp    = document.getElementById('capacity-explainer');
            const momExp = document.getElementById('momentum-explainer');
            if (momExp) momExp.classList.add('hidden');
            if (exp) exp.classList.toggle('hidden');
        });
    }

    // ── Wire stat rows ────────────────────────────────────────
    const allStatIds = [...STAT_NAMES, 'luck'];
    allStatIds.forEach(stat => {
        const row = document.getElementById('stats-row-' + stat);
        if (!row) return;
        row.addEventListener('click', () => {
            playUIClick();
            const exp       = document.getElementById('explainer-' + stat);
            const wasHidden = exp && exp.classList.contains('hidden');

            allStatIds.forEach(s => {
                const e = document.getElementById('explainer-' + s);
                if (e) e.classList.add('hidden');
            });

            if (wasHidden && exp) {
                exp.classList.remove('hidden');
                // Attempt personalised Gemini explainer upgrade on first open
                if (stat !== 'luck' && typeof getPersonalisedStatExplainer === 'function') {
                    const textEl     = exp.querySelector('.stats-explainer-text');
                    const pathData   = (typeof loadPathData === 'function') ? loadPathData() : null;
                    const scanTraits = (typeof loadScanTraits === 'function') ? loadScanTraits() : {};
                    const statVal    = player && player.stats ? (player.stats[stat] || STAT_FLOOR) : STAT_FLOOR;
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

    // ── Wire PATH tappable elements ───────────────────────────
    wirePathTappableElements();

    // ── Wire Settings section ─────────────────────────────────
    wireSettingsSection();

    // ── Wire career skills tappable rows ─────────────────────
    wireCareerSkillsSection();

    // ── Wire settings cogwheel shortcut ──────────────────────
    const settingsShortcut = document.getElementById('sot-settings-shortcut');
    if (settingsShortcut) {
        settingsShortcut.addEventListener('click', () => {
            playUIClick();
            const anchor = document.getElementById('status-settings-anchor');
            if (anchor) {
                anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // ── Animate stat numbers on initial render ────────────────
    if (animate) {
        setTimeout(() => {
            STAT_NAMES.forEach(stat => {
                animateNumber('val-' + stat, 0, Math.floor(player.stats[stat] || STAT_FLOOR), 600);
            });
        }, 100);
    }
}

// Backward compatibility alias
function renderStatusMainTab(container, animate) {
    renderStatusMainContent(container, animate);
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
// CAREER SKILLS SECTION — inline in STATUS tab
// BLOCK B: Live implementation. Loaded from syd_career_skills in
// localStorage. Each track shows name, score, progress bar with
// soft cap marker, and stat mapping tag. Tappable to expand
// description inline.
// ═══════════════════════════════════════════════════════════════

// Maps stat name to its short label for the mapping tag.
const CAREER_STAT_LABELS = {
    strength:     'STR',
    intelligence: 'INT',
    agility:      'AGI',
    endurance:    'END',
    charisma:     'CHA'
};

// Maps stat name to its CSS colour variable.
const CAREER_STAT_COLOURS = {
    strength:     'var(--stat-str)',
    intelligence: 'var(--stat-int)',
    agility:      'var(--stat-agi)',
    endurance:    'var(--stat-end)',
    charisma:     'var(--stat-cha)'
};

function buildCareerSkillsSection() {
    // Load tracks from app.js's loadCareerSkills() if available,
    // otherwise read directly from localStorage as a safe fallback.
    let tracks = [];
    if (typeof loadCareerSkills === 'function') {
        tracks = loadCareerSkills();
    } else {
        try {
            const raw = localStorage.getItem('syd_career_skills');
            tracks = raw ? JSON.parse(raw) : [];
        } catch(e) { tracks = []; }
    }

    const keyActive  = (typeof getNeuralKey === 'function') && !!getNeuralKey();
    const pathData   = (typeof loadPathData === 'function') ? loadPathData() : null;
    const pathRun    = !!(pathData && pathData.confirmedPath);

    // ── Empty state — contextual messaging ───────────────────
    if (!tracks || tracks.length === 0) {
        let emptyMsg = '';
        if (!pathRun) {
            emptyMsg = `
                <p class="career-skills-empty-msg">
                    Career skill tracks generate when you run PATH Protocol.
                    They measure the specific professional capabilities your path requires.
                </p>
            `;
        } else if (!keyActive) {
            emptyMsg = `
                <p class="career-skills-empty-msg">
                    PATH has been run. Connect Neural Link in Settings to generate
                    personalised career skill tracks from your confirmed path and record.
                </p>
                <p class="career-skills-neural-note">[ Connect Neural Link to generate personalised skill tracks ]</p>
            `;
        } else {
            emptyMsg = `
                <p class="career-skills-empty-msg">
                    Career skill tracks are generating. They will appear here once SYD
                    has analysed your PATH data.
                </p>
            `;
        }

        return `
            <div class="status-section status-section--career-skills">
                <p class="status-section-label">[ CAREER SKILLS ]</p>
                <div class="career-skills-empty" id="career-skills-content">
                    ${emptyMsg}
                </div>
            </div>
        `;
    }

    // ── Live tracks ──────────────────────────────────────────
    const tracksHTML = tracks.map((track, i) => {
        const score      = track.score || 0;
        const softCap    = track.softCap || 40;
        const statLabel  = CAREER_STAT_LABELS[track.stat]  || (track.stat || '').toUpperCase().slice(0, 3);
        const statColour = CAREER_STAT_COLOURS[track.stat] || 'var(--accent)';

        // Score as percentage of 100 (the absolute max, not the soft cap)
        const scorePct   = Math.min(100, parseFloat(score.toFixed(1)));
        // Soft cap marker position as a percentage of the bar width
        const capPct     = Math.min(100, softCap);

        // Gemini-enhanced badge — shown when Block C has upgraded the track
        const enhanced   = track.geminiEnhanced ? `<span class="cs-enhanced-badge">&#x2605;</span>` : '';

        return `
            <div class="career-skill-row tappable" id="cs-row-${i}" data-cs-index="${i}">
                <div class="cs-row-header">
                    <div class="cs-name-wrap">
                        <span class="cs-name">${track.name}</span>
                        ${enhanced}
                    </div>
                    <div class="cs-meta">
                        <span class="cs-stat-tag" style="color:${statColour};">${statLabel}</span>
                        <span class="cs-score">${score.toFixed(1)}</span>
                    </div>
                </div>
                <div class="cs-bar-wrap">
                    <div class="cs-bar-track">
                        <div class="cs-bar-fill" style="width:${scorePct}%;background:${statColour};"></div>
                        <div class="cs-softcap-marker" style="left:${capPct}%;" title="Soft cap at ${softCap}"></div>
                    </div>
                    <span class="cs-softcap-label">${softCap}</span>
                </div>
                <div class="cs-description hidden" id="cs-desc-${i}">
                    <p class="cs-description-text">${track.description || ''}</p>
                    ${!track.geminiEnhanced ? `
                        <p class="cs-description-note">[ Connect Neural Link for a personalised read on this skill ]</p>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    const neuralNote = !keyActive
        ? `<p class="career-skills-neural-note">[ Connect Neural Link to generate personalised skill tracks ]</p>`
        : '';

    return `
        <div class="status-section status-section--career-skills">
            <p class="status-section-label">[ CAREER SKILLS ]</p>
            ${neuralNote}
            <div class="career-skills-list" id="career-skills-content">
                ${tracksHTML}
            </div>
        </div>
    `;
}

// ─── WIRE CAREER SKILLS SECTION ──────────────────────────────
// Called after STATUS tab renders. Wires tap handlers for each
// career skill row to expand/collapse the description inline.
// One row open at a time — tapping a second row closes the first.
function wireCareerSkillsSection() {
    const tracks = (typeof loadCareerSkills === 'function') ? loadCareerSkills() : [];
    if (!tracks || tracks.length === 0) return;

    let openIndex = null;

    tracks.forEach((track, i) => {
        const row  = document.getElementById('cs-row-' + i);
        const desc = document.getElementById('cs-desc-' + i);
        if (!row || !desc) return;

        row.addEventListener('click', () => {
            playUIClick();
            const isOpen = !desc.classList.contains('hidden');

            // Close all open descriptions first
            tracks.forEach((_, j) => {
                const d = document.getElementById('cs-desc-' + j);
                const r = document.getElementById('cs-row-'  + j);
                if (d) d.classList.add('hidden');
                if (r) r.classList.remove('career-skill-row--open');
            });
            openIndex = null;

            // Open this one if it was previously closed
            if (!isOpen) {
                desc.classList.remove('hidden');
                row.classList.add('career-skill-row--open');
                openIndex = i;
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// PATH SECTION — inline in STATUS tab
// RESPEC: All elements are tappable with inline drawers.
// Path name, role, rank badge, gap skills, aspiration, hidden affinity.
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

// Builds PATH section HTML string — injected into STATUS scroll.
function buildPathSection(level) {
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;
    const gapRead  = buildLocalGapRead(pathData);
    const skills   = (pathData && pathData.gapAnalysis && pathData.gapAnalysis.skills) || [];

    if (!pathData) {
        return `
            <div class="status-section status-section--path">
                <p class="status-section-label">[ PATH ]</p>
                <div class="path-tab-empty">
                    <p class="path-tab-empty-msg">[ PATH PROTOCOL NOT YET RUN ]</p>
                    <p class="path-tab-empty-sub">Complete onboarding to see your career track, gap analysis, and hidden affinity.</p>
                </div>
            </div>
        `;
    }

    const pathName = (pathData.confirmedPath && pathData.confirmedPath.path_name) || 'UNCLASSIFIED';
    const role     = pathData.confirmedRole || pathName;
    const rank     = pathData.confirmedRank || 'F';

    return `
        <div class="status-section status-section--path">
            <p class="status-section-label">[ PATH ]</p>

            <!-- Rank clarification note -->
            <p class="path-rank-note">
                Your PATH rank reflects where SYD placed you based on your record.
                The rank in the header rises separately through XP and level.
            </p>

            <!-- Path name — tappable -->
            <div class="path-inline-block path-name-block tappable" id="path-tap-name">
                <div class="path-inline-label">CONFIRMED PATH</div>
                <div class="path-inline-value">${pathName}</div>
                <div class="path-inline-expand hidden" id="path-expand-name">
                    <p class="path-expand-text">
                        This is the path SYD mapped from your record and scan data.
                        It reflects where your accumulated experience and traits point — not just what you said you wanted.
                    </p>
                </div>
            </div>

            <!-- Role — tappable -->
            ${role !== pathName ? `
                <div class="path-inline-block tappable" id="path-tap-role">
                    <div class="path-inline-label">PRIMARY ROLE</div>
                    <div class="path-inline-value">${role}</div>
                    <div class="path-inline-expand hidden" id="path-expand-role">
                        <p class="path-expand-text">
                            Your primary role is where SYD sees the highest leverage point for your path.
                            This affects which directive types are weighted toward you at higher gear levels.
                        </p>
                    </div>
                </div>
            ` : ''}

            <!-- PATH rank badge — tappable -->
            ${rank ? `
                <div class="path-inline-block tappable" id="path-tap-rank">
                    <div class="path-inline-label">PATH STARTING RANK</div>
                    <div class="path-rank-row">
                        <span class="rank-badge ${rankCssClass(rank)}">${rank}</span>
                    </div>
                    <div class="path-inline-expand hidden" id="path-expand-rank">
                        <p class="path-expand-text">${buildLocalGapRead(pathData) || ''}</p>
                    </div>
                </div>
            ` : ''}

            <!-- Gap skills — each pill tappable -->
            ${skills.length > 0 ? `
                <div class="path-inline-block">
                    <div class="path-inline-label">GAP ANALYSIS</div>
                    ${gapRead ? `<p class="path-gap-prose">${gapRead}</p>` : ''}
                    <p class="path-gap-skills-label">CAPABILITIES THIS PATH REQUIRES</p>
                    <div class="path-skill-tags" id="path-gap-skills-wrap">
                        ${skills.map((s, i) => `
                            <span class="path-skill-tag path-skill-tag--tappable" data-skill-idx="${i}" id="path-skill-${i}">
                                ${s}
                            </span>
                        `).join('')}
                    </div>
                    <div class="path-skill-expand hidden" id="path-skill-expand">
                        <p class="path-skill-expand-text" id="path-skill-expand-text"></p>
                    </div>
                    ${!(pathData.gapAnalysis && pathData.gapAnalysis.geminiEnhanced) ? `
                        <p class="path-gap-gemini-note">
                            [ Personalised gap analysis activates when Neural Link is connected ]
                        </p>
                    ` : ''}
                </div>
            ` : ''}

            <!-- Aspiration goal — tappable to edit -->
            ${pathData.aspirationGoal && (pathData.aspirationGoal.careerGoal || pathData.aspirationGoal.lifeGoal) ? `
                <div class="path-inline-block tappable" id="path-tap-aspiration">
                    <div class="path-inline-label">CAREER SIGNAL</div>
                    <p class="path-inline-value path-inline-value--text">${pathData.aspirationGoal.careerGoal || '&mdash;'}</p>
                    <div class="path-inline-expand hidden" id="path-expand-aspiration">
                        <div class="path-aspiration-edit">
                            <p class="path-expand-label">[ EDIT CAREER SIGNAL ]</p>
                            <textarea id="path-aspiration-input" class="fn-textarea"
                                placeholder="Your career direction..."
                                maxlength="200">${pathData.aspirationGoal.careerGoal || ''}</textarea>
                            <button class="settings-row-btn settings-row-btn--inline" id="path-aspiration-save">SAVE</button>
                        </div>
                    </div>
                </div>
                <div class="path-inline-block tappable" id="path-tap-lifegoal">
                    <div class="path-inline-label">LIFE SIGNAL</div>
                    <p class="path-inline-value path-inline-value--text">${pathData.aspirationGoal.lifeGoal || '&mdash;'}</p>
                    <div class="path-inline-expand hidden" id="path-expand-lifegoal">
                        <div class="path-aspiration-edit">
                            <p class="path-expand-label">[ EDIT LIFE SIGNAL ]</p>
                            <textarea id="path-lifegoal-input" class="fn-textarea"
                                placeholder="Your life direction..."
                                maxlength="200">${pathData.aspirationGoal.lifeGoal || ''}</textarea>
                            <button class="settings-row-btn settings-row-btn--inline" id="path-lifegoal-save">SAVE</button>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Hidden affinity -->
            ${level >= 20 ? `
                <div class="path-inline-block path-affinity-block">
                    <div class="path-inline-label">[ HIDDEN AFFINITY &mdash; UNLOCKED ]</div>
                    ${(pathData.hiddenAffinity && pathData.hiddenAffinity.read) ? `
                        <p class="path-affinity-stat">${pathData.hiddenAffinity.stat ? pathData.hiddenAffinity.stat.toUpperCase() : ''}</p>
                        <p class="path-inline-value path-inline-value--text">${pathData.hiddenAffinity.read}</p>
                    ` : `
                        <p class="path-inline-value path-inline-value--text">
                            Connect Neural Link in Settings to surface your hidden affinity read.
                        </p>
                    `}
                </div>
            ` : `
                <div class="path-inline-block path-affinity-locked-block">
                    <div class="path-inline-label">[ HIDDEN AFFINITY ]</div>
                    <p class="path-affinity-teaser">${HIDDEN_AFFINITY_TEASER}</p>
                    <div class="path-affinity-level-row">
                        <span class="path-affinity-level-label">LEVEL ${level} / 20</span>
                        <div class="path-affinity-bar-wrap">
                            <div class="path-affinity-bar" style="width:${Math.min(100, (level / 20) * 100)}%"></div>
                        </div>
                    </div>
                </div>
            `}

        </div>
    `;
}

// ─── WIRE PATH TAPPABLE ELEMENTS ─────────────────────────────
// Called after STATUS tab renders. Wires inline expand/collapse
// for all tappable PATH elements.
function wirePathTappableElements() {
    const pathData = (typeof loadPathData === 'function') ? loadPathData() : null;

    // Generic expand/collapse for single-expand blocks
    const expandPairs = [
        { rowId: 'path-tap-name',        expandId: 'path-expand-name' },
        { rowId: 'path-tap-role',        expandId: 'path-expand-role' },
        { rowId: 'path-tap-rank',        expandId: 'path-expand-rank' },
        { rowId: 'path-tap-aspiration',  expandId: 'path-expand-aspiration' },
        { rowId: 'path-tap-lifegoal',    expandId: 'path-expand-lifegoal' }
    ];

    expandPairs.forEach(({ rowId, expandId }) => {
        const row    = document.getElementById(rowId);
        const expand = document.getElementById(expandId);
        if (!row || !expand) return;
        row.addEventListener('click', () => {
            playUIClick();
            expand.classList.toggle('hidden');
        });
    });

    // Aspiration save buttons
    const aspirationSave = document.getElementById('path-aspiration-save');
    if (aspirationSave && pathData) {
        aspirationSave.addEventListener('click', (e) => {
            e.stopPropagation();
            playUIClick();
            const input = document.getElementById('path-aspiration-input');
            if (!input || !pathData.aspirationGoal) return;
            pathData.aspirationGoal.careerGoal = input.value.trim();
            if (typeof savePathData === 'function') savePathData(pathData);
            if (player) { player.pathData = pathData; savePlayer(); }
            const block = document.getElementById('path-tap-aspiration');
            if (block) {
                const valueEl = block.querySelector('.path-inline-value--text');
                if (valueEl) valueEl.textContent = pathData.aspirationGoal.careerGoal || '—';
            }
            document.getElementById('path-expand-aspiration').classList.add('hidden');
            if (typeof showLog === 'function') showLog('[ CAREER SIGNAL UPDATED ]', 'accent');
        });
    }

    const lifeGoalSave = document.getElementById('path-lifegoal-save');
    if (lifeGoalSave && pathData) {
        lifeGoalSave.addEventListener('click', (e) => {
            e.stopPropagation();
            playUIClick();
            const input = document.getElementById('path-lifegoal-input');
            if (!input || !pathData.aspirationGoal) return;
            pathData.aspirationGoal.lifeGoal = input.value.trim();
            if (typeof savePathData === 'function') savePathData(pathData);
            if (player) { player.pathData = pathData; savePlayer(); }
            const block = document.getElementById('path-tap-lifegoal');
            if (block) {
                const valueEl = block.querySelector('.path-inline-value--text');
                if (valueEl) valueEl.textContent = pathData.aspirationGoal.lifeGoal || '—';
            }
            document.getElementById('path-expand-lifegoal').classList.add('hidden');
            if (typeof showLog === 'function') showLog('[ LIFE SIGNAL UPDATED ]', 'accent');
        });
    }

    // Gap skill pills — each tappable, shows expand below the pill row
    const skills = (pathData && pathData.gapAnalysis && pathData.gapAnalysis.skills) || [];
    skills.forEach((skill, i) => {
        const pill = document.getElementById('path-skill-' + i);
        if (!pill) return;
        pill.addEventListener('click', () => {
            playUIClick();
            const expandEl  = document.getElementById('path-skill-expand');
            const expandText = document.getElementById('path-skill-expand-text');
            const allPills  = document.querySelectorAll('.path-skill-tag--tappable');
            const isOpen    = !expandEl.classList.contains('hidden')
                && expandEl.dataset.activeSkill === String(i);

            // Toggle: close if already open for this skill
            if (isOpen) {
                expandEl.classList.add('hidden');
                allPills.forEach(p => p.classList.remove('path-skill-tag--active'));
                return;
            }

            allPills.forEach(p => p.classList.remove('path-skill-tag--active'));
            pill.classList.add('path-skill-tag--active');
            expandEl.dataset.activeSkill = String(i);

            // Build skill explanation — local for now, Gemini-enhanced in Block C
            const skillExplainer = buildGapSkillExplainer(skill, pathData);
            if (expandText) expandText.textContent = skillExplainer;
            expandEl.classList.remove('hidden');
        });
    });
}

// ─── GAP SKILL EXPLAINER ─────────────────────────────────────
// Local version — builds a short read on a gap skill.
// Block C will cache the Gemini version from Call 2.
function buildGapSkillExplainer(skill, pathData) {
    const rank = (pathData && pathData.confirmedRank) || 'F';
    const rankReads = {
        'F': 'This is a foundational gap at your current rank. Closing it early creates compounding returns.',
        'E': 'This gap matters now. Your experience has created the context to develop it deliberately.',
        'D': 'This is a precision gap. You understand the concept — the development target is consistent execution.',
        'C': 'At your rank, this gap is the difference between good and respected. It is mostly application now, not knowledge.',
        'B': 'This gap operates at the influence layer. Closing it moves you from doing well to making systems work better.'
    };
    const rankRead = rankReads[rank] || rankReads['F'];
    return `${skill} — a key capability gap for your confirmed path. ${rankRead}`;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS SECTION — inline at bottom of STATUS tab
// RESPEC: No separate SETTINGS tab or screen.
// Neural Link manage button routes to screen-neural.
// All other settings rendered inline.
// ═══════════════════════════════════════════════════════════════

function buildSettingsSection() {
    const keyActive = (typeof getNeuralKey === 'function') && !!getNeuralKey();

    // RESPEC: Gear labels reflect new totals after PATH is run.
    // Before PATH, shows life-stat counts only (5/10/15).
    // After PATH, shows totals including career directives (8/15/22).
    const pathData   = (typeof loadPathData === 'function') ? loadPathData() : null;
    const pathRun    = !!(pathData && pathData.confirmedPath);
    const gearLabels = pathRun
        ? {
            1: 'GEAR 1 &mdash; STANDARD (8/day)',
            2: 'GEAR 2 &mdash; PRACTICE (15/day)',
            3: 'GEAR 3 &mdash; DEEP PRACTICE (22/day)'
          }
        : {
            1: 'GEAR 1 &mdash; STANDARD (5/day)',
            2: 'GEAR 2 &mdash; PRACTICE (10/day)',
            3: 'GEAR 3 &mdash; DEEP PRACTICE (15/day)'
          };

    return `
        <div class="status-section status-section--settings" id="status-settings-anchor">
            <p class="status-section-label">[ SETTINGS ]</p>

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
                    <button class="settings-gear-btn ${currentGear === 1 ? 'settings-gear-btn--active' : ''}" data-gear="1">${gearLabels[1]}</button>
                    <button class="settings-gear-btn ${currentGear === 2 ? 'settings-gear-btn--active' : ''}" data-gear="2">${gearLabels[2]}</button>
                    <button class="settings-gear-btn ${currentGear === 3 ? 'settings-gear-btn--active' : ''}" data-gear="3">${gearLabels[3]}</button>
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
}

// ─── WIRE SETTINGS SECTION ────────────────────────────────────
// Called after STATUS tab renders. Wires all inline settings controls.
function wireSettingsSection() {
    const neuralBtn = document.getElementById('settings-neural-btn');
    if (neuralBtn) {
        neuralBtn.addEventListener('click', () => {
            playUIClick();
            navTo('screen-neural');
        });
    }

    const syncBtn = document.getElementById('settings-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            playUIClick();
            if (typeof player !== 'undefined' && player && player.syncOptedIn) {
                if (typeof showLog === 'function') {
                    showLog('[ CLOUD SYNC ACTIVE — DATA IS BACKED UP ]', 'accent');
                }
            } else {
                if (typeof renderCloudSyncOptIn === 'function') {
                    renderCloudSyncOptIn(() => {
                        showScreen('screen-status');
                        if (typeof renderStatusWindow === 'function') renderStatusWindow(false);
                    });
                }
            }
        });
    }

    const soundToggle = document.getElementById('settings-sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            if (typeof cycleSoundState === 'function') cycleSoundState();
            soundToggle.textContent = 'SOUND: ' + (typeof soundEnabled !== 'undefined' && soundEnabled ? 'ON' : 'OFF');
        });
    }

    const nameSave = document.getElementById('settings-name-save');
    if (nameSave) {
        nameSave.addEventListener('click', () => {
            playUIClick();
            const n = document.getElementById('settings-name-input').value.trim().toUpperCase();
            if (!n) return;
            if (player) { player.name = n; savePlayer(); updateStatusScreen(); }
            if (typeof showLog === 'function') showLog('[ DESIGNATION UPDATED ]');
        });
    }

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

    const resetBtn = document.getElementById('settings-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            playUIClick();
            document.getElementById('settings-confirm-reset').classList.remove('hidden');
        });
    }

    const confirmNo = document.getElementById('settings-confirm-no');
    if (confirmNo) {
        confirmNo.addEventListener('click', () => {
            playUIClick();
            document.getElementById('settings-confirm-reset').classList.add('hidden');
        });
    }

    const confirmYes = document.getElementById('settings-confirm-yes');
    if (confirmYes) {
        confirmYes.addEventListener('click', () => {
            playUIClick();
            if (typeof resetProfile === 'function') resetProfile();
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// BACKWARD-COMPAT EXPORTS
// Functions that other modules call by name — kept or aliased.
// ═══════════════════════════════════════════════════════════════

// renderPathTab — aliased to renderPathSection-in-STATUS.
// Any call to renderPathTab() from outside this file now routes
// to the STATUS tab render instead. This is safe because path.js
// only calls it from within the status context.
function renderPathTab(container) {
    // In the respec, PATH is a section inside STATUS, not its own tab.
    // If something calls this directly, re-render the STATUS tab.
    if (container) {
        // Build and inject path section into provided container
        const level = calculateLevel();
        container.innerHTML = buildPathSection(level);
        wirePathTappableElements();
    } else {
        switchStatusTab('status');
    }
}

// renderSettingsTab — aliased to settings section render.
function renderSettingsTab(container) {
    if (container) {
        container.innerHTML = buildSettingsSection();
        wireSettingsSection();
    } else {
        switchStatusTab('status');
    }
}