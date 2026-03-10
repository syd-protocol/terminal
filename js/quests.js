// ─── TIER UNLOCK LEVELS ──────────────────────────────────────
// Tier 1: Level 1+   — foundational mental models
// Tier 2: Level 10+  — deeper frameworks (~5-6 months consistent play)
// Tier 3: Level 25+  — mastery level (~2 years consistent play)

function getCurrentTier(level) {
    if (level >= 25) return 3;
    if (level >= 10) return 2;
    return 1;
}

// ─── GEAR SYSTEM ─────────────────────────────────────────────
// Gear controls how many directives per stat are issued each day.
// More directives = more practice reps = faster real-world learning = faster XP.
// The XP acceleration is a consequence of genuine extra effort, not a cheat.
//
//   Gear 1 — Standard:      1 directive per stat  (5 total)
//   Gear 2 — Practice Mode: 2 directives per stat (10 total)
//   Gear 3 — Deep Practice: 3 directives per stat (15 total) + reflection prompt on slot 3

// ─── DAILY QUEST SELECTION ───────────────────────────────────
// Picks directives per stat per day, seeded by date for consistency.
// Pool is filtered to quests at or below current tier.
//
// Gear 2: picks 2 from the full tier-filtered pool using offset seeds.
//
// Gear 3: picks 3 using varied-tier assignment:
//   Slot 1 — from the player's highest unlocked tier only
//   Slot 2 — from one tier below highest (min Tier 1)
//   Slot 3 — from Tier 1 (always foundational)
//   This prevents stacking multiple multi-day mastery tasks in the same day,
//   and gives each day a natural rhythm of depth: mastery → framework → foundation.

// ─── TIER 0: OPERATOR DAYS 1-7 ───────────────────────────────
// New operators are served deterministic day-matched Tier 0 directives
// for their first 7 operator days. Each day has exactly one Tier 0 quest
// per stat (35 total: 5 stats × 7 days). operatorDays is never decremented.
// After day 7, the standard tier pool takes over permanently.

function getTier0DayQuests(allQuests, operatorDays) {
    const stats   = ['strength','intelligence','agility','endurance','charisma'];
    const daySlot = Math.min(Math.max(operatorDays, 1), 7);
    const result  = [];
    stats.forEach(stat => {
        const pool = allQuests.filter(q => q.stat === stat && q.tier === 0 && q.day === daySlot);
        if (pool.length > 0) result.push(pool[0]);
    });
    return result;
}

function getDailyQuests(allQuests, level, gear, operatorDays) {
    // ── Tier 0: days 1-7 — deterministic day-matched beginner quests ──
    if (typeof operatorDays === 'number' && operatorDays <= 7) {
        const tier0 = getTier0DayQuests(allQuests, operatorDays);
        if (tier0.length > 0) return tier0;
        // If Tier 0 pool is empty for this day (data gap), fall through to standard selection
    }

    const today     = new Date().toISOString().slice(0, 10);
    const stats     = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
    const tier      = getCurrentTier(level || 1);
    const gearLevel = gear || 1;
    const daily     = [];
    const dateNum   = dateToNumber(today);

    stats.forEach((stat, statIndex) => {

        if (gearLevel === 1) {
            // ── Gear 1: single directive from full tier-filtered pool ──
            const pool = allQuests.filter(q => q.stat === stat && q.tier <= tier);
            if (!pool.length) return;
            const seed   = dateNum + statIndex;
            const picked = pool[seed % pool.length];
            if (picked) daily.push(picked);

        } else if (gearLevel === 2) {
            // ── Gear 2: two directives from full tier-filtered pool ──
            // Different seeds (offset by a prime) ensure different directives are picked.
            const pool = allQuests.filter(q => q.stat === stat && q.tier <= tier);
            if (!pool.length) return;

            const seed1 = dateNum + statIndex;
            const seed2 = dateNum + statIndex + 37; // prime offset avoids collision

            const q1   = pool[seed1 % pool.length];
            let   idx2 = seed2 % pool.length;

            // Ensure slot 2 differs from slot 1
            if (pool[idx2] && pool[idx2].id === q1.id && pool.length > 1) {
                idx2 = (idx2 + 1) % pool.length;
            }
            const q2 = pool[idx2];

            if (q1) daily.push(q1);
            if (q2) daily.push(q2);

        } else {
            // ── Gear 3: three directives, varied by tier ──
            // Slot 1: player's highest unlocked tier
            // Slot 2: one tier below highest (min Tier 1)
            // Slot 3: Tier 1 always — foundational reinforcement
            //
            // Example for a Tier 3 player:
            //   Slot 1 → [Tier 3] Design Your Environment
            //   Slot 2 → [Tier 2] Zone 2 Cardio
            //   Slot 3 → [Tier 1] Walk After Eating  ← reflection prompt lives here
            //
            // This gives each day a rhythm: one deep mastery task, one framework
            // task, one simple foundational habit. Varied cognitive load.

            const tier2 = Math.max(1, tier - 1);
            const tier3 = 1;

            const pool1 = allQuests.filter(q => q.stat === stat && q.tier === tier);
            const pool2 = allQuests.filter(q => q.stat === stat && q.tier === tier2);
            const pool3 = allQuests.filter(q => q.stat === stat && q.tier === tier3);

            const seed1 = dateNum + statIndex;
            const seed2 = dateNum + statIndex + 37;
            const seed3 = dateNum + statIndex + 71; // second prime offset

            const q1 = pool1.length ? pool1[seed1 % pool1.length] : null;
            const q2 = pool2.length ? pool2[seed2 % pool2.length] : null;
            const q3 = pool3.length ? pool3[seed3 % pool3.length] : null;

            // Deduplication — avoids showing the same directive twice in a day.
            // This can happen at Tier 1 where all three pools are identical.
            // We try the next candidate in the pool before giving up.
            const usedIds = [];
            const dedup = (q, pool, seed) => {
                if (!q) return null;
                if (!usedIds.includes(q.id)) {
                    usedIds.push(q.id);
                    return q;
                }
                for (let offset = 1; offset < pool.length; offset++) {
                    const candidate = pool[(seed + offset) % pool.length];
                    if (!usedIds.includes(candidate.id)) {
                        usedIds.push(candidate.id);
                        return candidate;
                    }
                }
                return q; // fallback: accept duplicate only if pool is exhausted
            };

            const final1 = dedup(q1, pool1, seed1);
            const final2 = dedup(q2, pool2, seed2);
            const final3 = dedup(q3, pool3, seed3);

            // Tag each slot number. Slot 3 carries _requiresReflection so
            // renderQuests knows to show the reflection prompt on that card.
            if (final1) daily.push({ ...final1, _slot: 1 });
            if (final2) daily.push({ ...final2, _slot: 2 });
            if (final3) daily.push({ ...final3, _slot: 3, _requiresReflection: true });
        }
    });

    // ── Item 5: Guaranteed World Boss directive slot ──────────────
    // If an active world boss exists and none of the selected directives
    // match its primary stat, replace the last directive in the list with
    // a random directive from the boss's stat pool (tier-filtered).
    // This ensures the operator always has at least one actionable strike
    // against their active boss every day.
    try {
        const bossRaw = localStorage.getItem('syd_world_bosses');
        const bosses  = bossRaw ? JSON.parse(bossRaw) : [];
        if (bosses.length > 0) {
            const boss     = bosses[0];
            const bossStat = boss.stat;
            const hasMatch = daily.some(q => q.stat === bossStat);
            if (!hasMatch && daily.length > 0) {
                const bossPool = allQuests.filter(q => q.stat === bossStat && q.tier <= tier);
                if (bossPool.length > 0) {
                    const seed        = dateToNumber(today) + 99;
                    const replacement = bossPool[seed % bossPool.length];
                    daily[daily.length - 1] = replacement;
                }
            }
        }
    } catch(e) { /* localStorage unavailable — skip silently */ }

    return daily;
}

function dateToNumber(dateStr) {
    return parseInt(dateStr.replace(/-/g, ''), 10);
}

// ─── QUEST RENDERING ─────────────────────────────────────────
function renderQuests(quests, completedIds, momentum) {
    const list   = document.getElementById('quest-list');
    const dateEl = document.getElementById('quest-date');
    list.innerHTML = '';
    dateEl.textContent = new Date().toDateString().toUpperCase();

    // Hide the RETURN back-link during tutorial — operator has no prior screen to go back to,
    // and seeing '← RETURN' would be confusing. Show it again once tutorial is complete.
    const backLink = document.getElementById('quests-back-link');
    if (backLink) {
        const isTutorialActive = quests.length === 1 && quests[0] && quests[0]._tutorial === true;
        backLink.classList.toggle('hidden', isTutorialActive);
    }

    quests.forEach(quest => {
        if (!quest) return;
        const isComplete  = completedIds.includes(quest.id);
        const effectiveXP = Math.round(quest.xp * (momentum || 1) * 10) / 10;

        const card     = document.createElement('div');
        const isTutorial = quest._tutorial === true;
        card.className = 'quest-card'
            + (isComplete   ? ' quest-card--done'     : '')
            + (isTutorial   ? ' quest-card--tutorial' : '');
        card.id        = 'quest-card-' + quest.id;

        // Show effective XP only if momentum bonus is active and directive not yet done
        const xpBonus = (!isComplete && momentum > 1)
            ? `<div class="quest-xp-effective">→ +${effectiveXP}</div>`
            : '';

        // Model section — always shown when model exists
        const modelSection = quest.model
            ? `<div class="qc-model">
                   <span class="qc-model-name">REF: ${quest.model}</span>
               </div>`
            : '';

        // Tactical Guide section — shown on all quests that have it (new schema)
        const tg = quest.tactical_guide;
        const tacticalSection = tg
            ? `<div class="qc-intel-strip">
                   <div class="qc-intel-meta">
                       <span class="qc-intel-mechanic">[ ${tg.mechanic.toUpperCase()} ]</span>
                       <span class="qc-intel-guide-title">${tg.title}</span>
                   </div>
                   <button class="qc-intel-btn" data-quest-id="${quest.id}">INTEL ›</button>
               </div>`
            : '';

        // Field Note — unified note input for all directive cards.
        // On _requiresReflection cards (Gear 3 slot 3): shown by default, required,
        // complete button locked until 10+ characters. Note is saved on complete.
        // On all other cards: hidden behind a toggle, optional, never gates completion.
        // Notes are stored in syd_field_notes keyed by questId_YYYY-MM-DD and sync
        // with the cloud sidecar.
        const savedNote     = (typeof loadFieldNote === 'function') ? loadFieldNote(quest.id) : '';
        const isRequired    = quest._requiresReflection && !isComplete;
        const isOptional    = !quest._requiresReflection && !isComplete;
        const showSaved     = isComplete && savedNote;

        const fieldNoteSection = isRequired
            ? `<div class="fn-wrap fn-wrap--required" id="fn-wrap-${quest.id}">
                   <div class="reflection-label">[ FIELD REPORT ]</div>
                   <div class="reflection-hint">
                       Log what you observed. Keep it short — one or two sentences.
                       Stored locally and synced with your terminal.
                   </div>
                   <textarea
                       class="reflection-input fn-input"
                       id="fn-input-${quest.id}"
                       placeholder="What did you notice, feel, or learn? (required to execute)"
                       rows="3"
                       maxlength="280"
                   >${savedNote}</textarea>
                   <div class="fn-char-count" id="fn-count-${quest.id}">0 / 280</div>
               </div>`
            : isOptional
            ? `<div class="fn-optional" id="fn-optional-${quest.id}">
                   <button class="fn-toggle" id="fn-toggle-${quest.id}" data-open="false">+ ADD NOTE</button>
                   <div class="fn-wrap fn-wrap--hidden" id="fn-wrap-${quest.id}">
                       <textarea
                           class="reflection-input fn-input"
                           id="fn-input-${quest.id}"
                           placeholder="Any thoughts on this directive — optional, not required."
                           rows="2"
                           maxlength="280"
                       >${savedNote}</textarea>
                       <div class="fn-char-count" id="fn-count-${quest.id}">0 / 280</div>
                   </div>
               </div>`
            : showSaved
            ? `<div class="fn-saved" id="fn-saved-${quest.id}">
                   <div class="reflection-label">[ FIELD NOTE ]</div>
                   <div class="fn-saved-text">${savedNote}</div>
               </div>`
            : '';

        const tierLabel  = quest.tier === 3 ? 'MASTERY' : quest.tier === 2 ? 'ADVANCED' : 'BASIC';
        const statColour = { strength:'var(--stat-str)', intelligence:'var(--stat-int)', agility:'var(--stat-agi)', endurance:'var(--stat-end)', charisma:'var(--stat-cha)' }[quest.stat] || 'var(--accent)';

        // Tutorial card header replaces stat/tier with the orientation protocol label
        const headerHtml = isTutorial
            ? `<div class="qc-header">
                   <span class="qc-tutorial-label">[ ORIENTATION PROTOCOL ]</span>
               </div>`
            : `<div class="qc-header">
                   <span class="qc-stat" style="color:${statColour}">[ ${quest.stat.toUpperCase()} ]</span>
                   <span class="qc-tier qc-tier--${quest.tier}">${tierLabel}</span>
               </div>`;

        // Tutorial card gets a VIEW STATUS button and nav hint instead of XP block.
        // The RETURN link is hidden via CSS class added to the back-link element.
        const tutorialNavSection = isTutorial && !isComplete
            ? `<div class="qc-tutorial-nav">
                   <button class="qc-tutorial-status-btn" onclick="navTo('screen-status')">
                       [ VIEW STATUS → ]
                   </button>
                   <div class="qc-tutorial-nav-hint">
                       Tap VIEW STATUS to see your attributes. Then tap
                       [ DIRECTIVES ] on the status screen to return here.
                   </div>
               </div>`
            : '';

        card.innerHTML = `
            ${headerHtml}
            <div class="qc-title">${quest.title}</div>
            <div class="qc-desc" style="white-space:pre-line">${quest.desc}</div>
            ${modelSection}
            ${tacticalSection}
            ${fieldNoteSection}
            ${tutorialNavSection}
            <div class="qc-footer">
                <button
                    class="complete-btn"
                    id="complete-btn-${quest.id}"
                    data-id="${quest.id}"
                    data-stat="${quest.stat}"
                    data-xp="${quest.xp}"
                    ${quest._requiresReflection ? 'data-requires-reflection="true"' : ''}
                    ${isComplete ? 'disabled' : ''}
                >
                    ${isComplete ? '[ ✓ EXECUTED ]' : '[ MARK EXECUTED ]'}
                </button>
                <div class="qc-xp-block">
                    ${!isTutorial ? `<div class="qc-xp">+${quest.xp} <span class="qc-xp-label">XP</span></div>${xpBonus}` : ''}
                </div>
            </div>
        `;
        list.appendChild(card);

        // Wire Tactical Intel button — opens the tactical guide overlay
        if (quest.tactical_guide) {
            const intelBtn = card.querySelector('.qc-intel-btn[data-quest-id="' + quest.id + '"]');
            if (intelBtn) {
                intelBtn.addEventListener('click', () => {
                    if (typeof showTacticalGuide === 'function') {
                        showTacticalGuide({
                            label:         '[ ' + quest.tactical_guide.title + ' ]',
                            enemy:         quest.tactical_guide.mechanic,
                            weapon:        quest.model || '',
                            tacticalGuide: quest.tactical_guide.logic
                        });
                    }
                });
            }
        }

        // ── Field note wiring ─────────────────────────────────────
        // Required (Gear 3 slot 3): complete button locked until 10+ chars
        // Optional (all others): toggle shows/hides the textarea
        if (quest._requiresReflection && !isComplete) {
            const textarea    = document.getElementById('fn-input-' + quest.id);
            const completeBtn = document.getElementById('complete-btn-' + quest.id);
            const countEl     = document.getElementById('fn-count-' + quest.id);
            completeBtn.disabled = true;

            if (textarea) {
                // Restore saved note into textarea and update count
                const existing = (typeof loadFieldNote === 'function') ? loadFieldNote(quest.id) : '';
                if (existing) textarea.value = existing;
                if (countEl) countEl.textContent = textarea.value.length + ' / 280';

                textarea.addEventListener('input', () => {
                    const len = textarea.value.trim().length;
                    completeBtn.disabled = len < 10;
                    if (countEl) countEl.textContent = textarea.value.length + ' / 280';
                });
            }
        } else if (!isComplete) {
            // Optional note toggle
            const toggleBtn = document.getElementById('fn-toggle-' + quest.id);
            const wrap      = document.getElementById('fn-wrap-' + quest.id);
            const textarea  = document.getElementById('fn-input-' + quest.id);
            const countEl   = document.getElementById('fn-count-' + quest.id);

            if (toggleBtn && wrap) {
                // If there's already a saved note, open the wrap by default
                const existing = (typeof loadFieldNote === 'function') ? loadFieldNote(quest.id) : '';
                if (existing && textarea) {
                    wrap.classList.remove('fn-wrap--hidden');
                    toggleBtn.textContent = '− NOTE';
                    toggleBtn.dataset.open = 'true';
                    if (countEl) countEl.textContent = textarea.value.length + ' / 280';
                }

                toggleBtn.addEventListener('click', () => {
                    const isOpen = toggleBtn.dataset.open === 'true';
                    if (isOpen) {
                        wrap.classList.add('fn-wrap--hidden');
                        toggleBtn.textContent = '+ ADD NOTE';
                        toggleBtn.dataset.open = 'false';
                    } else {
                        wrap.classList.remove('fn-wrap--hidden');
                        toggleBtn.textContent = '− NOTE';
                        toggleBtn.dataset.open = 'true';
                        if (textarea) textarea.focus();
                    }
                });

                if (textarea && countEl) {
                    textarea.addEventListener('input', () => {
                        countEl.textContent = textarea.value.length + ' / 280';
                    });
                }
            }
        }
    });

    // Attach complete button listeners (reflection-gated buttons are handled above;
    // this catches all non-reflection buttons that are enabled).
    // Tutorial quest routes to completeTutorialQuest() instead of completeQuest().
    document.querySelectorAll('.complete-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const { id, stat, xp } = btn.dataset;
            if (id === 'tutorial_orientation' && typeof completeTutorialQuest === 'function') {
                completeTutorialQuest();
            } else {
                completeQuest(id, stat, parseInt(xp));
            }
        });
    });
}