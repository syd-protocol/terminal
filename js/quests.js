// ═══════════════════════════════════════════════════════════════
// SYD GES — quests.js
// Directive selection engine and card renderer.
// No frameworks. No bundlers. 4-space indentation.
// ═══════════════════════════════════════════════════════════════

// ─── TIER UNLOCK LEVELS ──────────────────────────────────────
// Tier 0: Days 1–7  — deterministic onboarding directives (5 per day)
// Tier 1: Level 1+  — foundational mental models
// Tier 2: Level 10+ — deeper frameworks (~5-6 months consistent play)
// Tier 3: Level 25+ — mastery level (~2 years consistent play)

function getCurrentTier(level) {
    if (level >= 25) return 3;
    if (level >= 10) return 2;
    return 1;
}

// ─── GEAR SYSTEM ─────────────────────────────────────────────
// Gear controls how many directives per stat are issued each day.
// More directives = more practice reps = faster real-world growth = faster XP.
// The XP acceleration is a consequence of genuine extra effort, not a cheat.
//
//   Gear 1 — Standard:      1 directive per stat  (5 total)
//   Gear 2 — Practice Mode: 2 directives per stat (10 total)
//   Gear 3 — Deep Practice: 3 directives per stat (15 total)
//             → Slot 3 always carries a field note reflection prompt
//
// Gear does NOT apply during Tier 0 (days 1–7). All Tier 0 runs at Gear 1.
// Gear unlocks after the operative completes all 7 Tier 0 days and enters Level 1.

// ─── TIER 0: OPERATIVE DAYS 1–7 ──────────────────────────────
// Deterministic day-matched directives for the first 7 operative days.
// Exactly 5 per day (one per stat). operatorDays is never decremented.
// After day 7, the standard tier pool takes over permanently.
//
// Graceful fallback: if the pool for a given stat/day is empty,
// SYD logs a warning and skips that slot rather than breaking silently.

function getTier0DayQuests(allQuests, operatorDays) {
    const stats   = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
    const daySlot = Math.min(Math.max(operatorDays, 1), 7);
    const result  = [];
    stats.forEach(stat => {
        const pool = allQuests.filter(q => q.stat === stat && q.tier === 0 && q.day === daySlot);
        if (pool.length > 0) {
            result.push(pool[0]);
        } else {
            // [GRACEFUL FALLBACK] Tier 0 pool missing for this stat/day.
            // Fall through to standard selection rather than breaking silently.
            console.warn('[SYD] Tier 0 pool empty for stat:', stat, 'day:', daySlot);
        }
    });
    return result;
}

// ─── DAILY DIRECTIVE SELECTION ───────────────────────────────
// Picks directives per stat per day, seeded by date for day-consistency.
// The same operative gets the same directives all day — refreshing does not reshuffle.
// Pool is filtered to directives at or below the current tier.
//
// Graceful tier fallback: if the current tier pool is empty for a stat,
// SYD falls back to the highest available lower tier and flags it.
// Never breaks silently.

function getDailyQuests(allQuests, level, gear, operatorDays) {

    // ── Tier 0: days 1–7 — deterministic day-matched directives ──
    // Gear is irrelevant here. Always 5 directives per day.
    if (typeof operatorDays === 'number' && operatorDays >= 1 && operatorDays <= 7) {
        const tier0 = getTier0DayQuests(allQuests, operatorDays);
        if (tier0.length > 0) return tier0;
        // If Tier 0 pool is entirely empty (data gap), fall through to standard selection.
        // This should never happen in production — all 35 Tier 0 directives will be written.
    }

    const todayStr  = new Date().toISOString().slice(0, 10);
    const dateNum   = dateToNumber(todayStr);
    const stats     = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
    const tier      = getCurrentTier(level || 1);
    const gearLevel = gear || 1;
    const daily     = [];

    stats.forEach((stat, statIndex) => {

        if (gearLevel === 1) {
            // ── Gear 1: single directive from full tier-filtered pool ──
            const pool = getPoolWithFallback(allQuests, stat, tier);
            if (!pool.length) return;
            const seed   = dateNum + statIndex;
            const picked = pool[seed % pool.length];
            if (picked) daily.push(picked);

        } else if (gearLevel === 2) {
            // ── Gear 2: two directives from full tier-filtered pool ──
            // Different seeds (offset by a prime) ensure different directives are picked.
            const pool = getPoolWithFallback(allQuests, stat, tier);
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
            // Slot 1: operative's highest unlocked tier
            // Slot 2: one tier below highest (min Tier 1)
            // Slot 3: Tier 1 always — foundational reinforcement + reflection prompt
            //
            // Example for a Tier 3 operative:
            //   Slot 1 → [Tier 3] deep mastery directive
            //   Slot 2 → [Tier 2] framework directive
            //   Slot 3 → [Tier 1] foundation directive  ← reflection prompt lives here

            const tier2 = Math.max(1, tier - 1);

            const pool1 = allQuests.filter(q => q.stat === stat && q.tier === tier);
            const pool2 = allQuests.filter(q => q.stat === stat && q.tier === tier2);
            const pool3 = allQuests.filter(q => q.stat === stat && q.tier === 1);

            const seed1 = dateNum + statIndex;
            const seed2 = dateNum + statIndex + 37;
            const seed3 = dateNum + statIndex + 71; // second prime offset

            const q1 = pool1.length ? pool1[seed1 % pool1.length] : null;
            const q2 = pool2.length ? pool2[seed2 % pool2.length] : null;
            const q3 = pool3.length ? pool3[seed3 % pool3.length] : null;

            // Deduplication — prevents showing the same directive twice in a day.
            // This can happen at Tier 1 where all three pools are identical.
            // Try the next candidate before giving up.
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
                return q; // last resort: accept duplicate only if pool is exhausted
            };

            const final1 = dedup(q1, pool1, seed1);
            const final2 = dedup(q2, pool2, seed2);
            let   final3 = dedup(q3, pool3, seed3);

            // Tag slot 3 — the card renderer uses this to show the reflection prompt
            // and lock the complete button until the operative has written a field note.
            if (final3) final3 = { ...final3, _requiresReflection: true };

            if (final1) daily.push(final1);
            if (final2) daily.push(final2);
            if (final3) daily.push(final3);
        }
    });

    return daily;
}

// ─── POOL WITH GRACEFUL FALLBACK ─────────────────────────────
// Returns the full directive pool for a stat at or below the target tier.
// If the current tier has no directives, falls back to the highest available
// lower tier and notifies SYD's log so the operative is never left with nothing.
//
// This is the core of the graceful tier fallback guarantee:
// the operative always gets directives, always knows why.

function getPoolWithFallback(allQuests, stat, targetTier) {
    // Try exact tier first
    let pool = allQuests.filter(q => q.stat === stat && q.tier === targetTier);
    if (pool.length > 0) return pool;

    // Tier is unlocked but pool is empty — fall back down the tiers
    for (let t = targetTier - 1; t >= 1; t--) {
        pool = allQuests.filter(q => q.stat === stat && q.tier === t);
        if (pool.length > 0) {
            // [GRACEFUL FALLBACK] Notify via log — never breaks silently
            if (typeof showLog === 'function') {
                showLog(`[ TIER ${targetTier} DIRECTIVES LOADING — OPERATING ON CURRENT BEST ]`, 'system');
            }
            return pool;
        }
    }

    // Nothing at all — return empty, caller handles gracefully
    console.warn('[SYD] No directives found for stat:', stat, 'tier:', targetTier);
    return [];
}

// ─── DATE SEED HELPER ────────────────────────────────────────
// Converts YYYY-MM-DD to a stable number for seeding daily selection.
// Same date always produces the same directives for the same operative.
function dateToNumber(dateStr) {
    return parseInt(dateStr.replace(/-/g, ''), 10);
}

// ─── DIRECTIVE CARD RENDERER ─────────────────────────────────
// Renders all daily directive cards into #quest-list.
// Called by showScreen('screen-directives') via app.js.

function renderDirectives(quests, completedToday) {
    const list = document.getElementById('quest-list');
    if (!list) return;
    list.innerHTML = '';

    if (!quests || quests.length === 0) {
        list.innerHTML = `
            <div class="directive-empty">
                <p class="directive-empty__msg">[ NO DIRECTIVES ISSUED — SYD IS RECALIBRATING ]</p>
            </div>
        `;
        return;
    }

    const statColour = {
        strength:     'var(--stat-str)',
        intelligence: 'var(--stat-int)',
        agility:      'var(--stat-agi)',
        endurance:    'var(--stat-end)',
        charisma:     'var(--stat-cha)'
    };

    const statLabel = {
        strength:     'STR',
        intelligence: 'INT',
        agility:      'AGI',
        endurance:    'END',
        charisma:     'CHA'
    };

    quests.forEach(quest => {
        const isComplete      = (completedToday || []).includes(quest.id);
        const colour          = statColour[quest.stat] || 'var(--accent)';
        const label           = statLabel[quest.stat]  || quest.stat.toUpperCase();
        const needsReflection = !!quest._requiresReflection;

        // Saved field note for this directive today
        const savedNote = (typeof loadFieldNote === 'function')
            ? loadFieldNote(quest.id)
            : '';

        // XP display — Sig rewards shown on card
        const xpLine = `+${quest.xp} XP · +${Math.floor(quest.xp / 2)} SIG`;

        const card = document.createElement('div');
        card.className = `directive-card${isComplete ? ' directive-card--complete' : ''}`;
        card.id        = `quest-card-${quest.id}`;
        card.style.setProperty('--card-stat-colour', colour);

        card.innerHTML = `
            <div class="dc-header">
                <span class="dc-stat-tag" style="color:${colour}">[ ${label} ]</span>
                <span class="dc-tier-tag">T${quest.tier}</span>
            </div>
            <h3 class="dc-title">${quest.title}</h3>
            <p class="dc-desc">${quest.desc}</p>

            ${quest.tactical_guide ? `
            <button class="dc-intel-btn" data-quest-id="${quest.id}">
                ⬡ TACTICAL INTEL
            </button>
            ` : ''}

            <div class="dc-footer">
                ${!isComplete ? `
                    ${needsReflection ? `
                        <div class="fn-wrap" id="fn-wrap-${quest.id}">
                            <p class="fn-label">[ FIELD NOTE REQUIRED — MINIMUM 10 CHARACTERS ]</p>
                            <textarea
                                id="fn-input-${quest.id}"
                                class="fn-textarea"
                                placeholder="What did you observe executing this directive..."
                                maxlength="280"
                            >${savedNote}</textarea>
                            <span class="fn-count" id="fn-count-${quest.id}">${savedNote.length} / 280</span>
                        </div>
                        <button
                            class="dc-complete-btn complete-btn"
                            id="complete-btn-${quest.id}"
                            data-id="${quest.id}"
                            data-stat="${quest.stat}"
                            data-xp="${quest.xp}"
                            disabled
                        >[ MARK EXECUTED ]</button>
                    ` : `
                        <div class="fn-wrap fn-wrap--hidden" id="fn-wrap-${quest.id}">
                            <textarea
                                id="fn-input-${quest.id}"
                                class="fn-textarea"
                                placeholder="Optional field note..."
                                maxlength="280"
                            >${savedNote}</textarea>
                            <span class="fn-count" id="fn-count-${quest.id}">${savedNote.length} / 280</span>
                        </div>
                        <div class="dc-action-row">
                            <button
                                class="dc-note-toggle"
                                id="fn-toggle-${quest.id}"
                                data-open="${savedNote ? 'true' : 'false'}"
                            >${savedNote ? '− NOTE' : '+ ADD NOTE'}</button>
                            <button
                                class="dc-complete-btn complete-btn"
                                id="complete-btn-${quest.id}"
                                data-id="${quest.id}"
                                data-stat="${quest.stat}"
                                data-xp="${quest.xp}"
                            >[ MARK EXECUTED ]</button>
                        </div>
                    `}
                ` : `
                    <div class="dc-complete-badge">[ EXECUTED ]</div>
                `}
                <div class="dc-xp-line">${xpLine}</div>
            </div>
        `;

        list.appendChild(card);

        // ── Wire Tactical Intel button ────────────────────────
        if (quest.tactical_guide) {
            const intelBtn = card.querySelector(`.dc-intel-btn[data-quest-id="${quest.id}"]`);
            if (intelBtn) {
                intelBtn.addEventListener('click', () => {
                    if (typeof showTacticalGuide === 'function') {
                        showTacticalGuide({
                            label:         `[ ${quest.tactical_guide.title} ]`,
                            enemy:         quest.tactical_guide.mechanic,
                            weapon:        quest.model || '',
                            tacticalGuide: quest.tactical_guide.logic
                        });
                    }
                });
            }
        }

        // ── Wire field note — reflection-gated (Gear 3 slot 3) ──
        // Complete button locked until 10+ characters written.
        if (needsReflection && !isComplete) {
            const textarea    = document.getElementById(`fn-input-${quest.id}`);
            const completeBtn = document.getElementById(`complete-btn-${quest.id}`);
            const countEl     = document.getElementById(`fn-count-${quest.id}`);

            if (textarea && savedNote.length >= 10) completeBtn.disabled = false;

            if (textarea) {
                textarea.addEventListener('input', () => {
                    const len = textarea.value.trim().length;
                    completeBtn.disabled = (len < 10);
                    if (countEl) countEl.textContent = `${textarea.value.length} / 280`;
                    if (typeof saveFieldNote === 'function') {
                        saveFieldNote(quest.id, textarea.value);
                    }
                });
            }
        }

        // ── Wire field note — optional toggle (Gear 1 and 2) ──
        else if (!isComplete) {
            const toggleBtn = document.getElementById(`fn-toggle-${quest.id}`);
            const wrap      = document.getElementById(`fn-wrap-${quest.id}`);
            const textarea  = document.getElementById(`fn-input-${quest.id}`);
            const countEl   = document.getElementById(`fn-count-${quest.id}`);

            // If a note already exists, show the wrap by default
            if (savedNote && wrap) {
                wrap.classList.remove('fn-wrap--hidden');
                if (toggleBtn) {
                    toggleBtn.textContent = '− NOTE';
                    toggleBtn.dataset.open = 'true';
                }
            }

            if (toggleBtn && wrap) {
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
            }

            if (textarea && countEl) {
                textarea.addEventListener('input', () => {
                    countEl.textContent = `${textarea.value.length} / 280`;
                    if (typeof saveFieldNote === 'function') {
                        saveFieldNote(quest.id, textarea.value);
                    }
                });
            }
        }
    });

    // ── Wire complete buttons ─────────────────────────────────
    // Reflection-gated buttons are handled above (disabled until note written).
    // This catches all standard non-gated complete buttons.
    document.querySelectorAll('.complete-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const { id, stat, xp } = btn.dataset;
            if (typeof completeQuest === 'function') {
                completeQuest(id, stat, parseInt(xp, 10));
            }
        });
    });
}