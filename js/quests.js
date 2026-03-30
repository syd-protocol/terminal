// ═══════════════════════════════════════════════════════════════
// SYD GES — quests.js
// Directive selection engine and card renderer.
// No frameworks. No bundlers. 4-space indentation.
//
// BLOCK B changes:
//   - getDailyQuests() updated to mix career directives from the
//     career cache (syd_career_directives in localStorage) at the
//     correct gear ratio (3/5/7 additional career directives).
//   - Tier 0 guard: career mixing skipped when operatorDays <= 7.
//   - Career cache empty: falls back silently to 100% static pool.
//   - Career directives tagged with _isCareerDirective: true so
//     completeQuest() in app.js can identify them for career skill
//     increment routing.
//   - getCareerDirectivesFromCache() — loads and date-seeds the
//     career pool for day-consistency. Same seed logic as static pool.
//   - renderDirectives() updated: career directive cards show a
//     secondary career skill tag beneath the stat badge.
//
// BLOCK D changes:
//   - tactical_guide fully deprecated. intel is now the sole field.
//   - Button always reads '⬡ INTEL' — no legacy 'TACTICAL INTEL' label.
//   - showIntelBtn: true only when quest.intel is present. Cards without
//     intel show no button (previously they showed the button using
//     tactical_guide as fallback — that path is removed).
//   - tactical_guide field references stripped from all rendering logic.
//   - intel field panel text: quest.intel only.
// ═══════════════════════════════════════════════════════════════

// ─── STORAGE KEYS ────────────────────────────────────────────
// These mirror the keys defined in app.js — quests.js reads from
// localStorage directly so it does not depend on app.js load order.
const CAREER_DIRECTIVES_CACHE_KEY = 'syd_career_directives';

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
// Gear controls how many life-stat directives per stat are issued each day.
// Career directives (Block B) are additive on top of these counts.
//
//   Gear 1 — Standard:      1 life-stat directive per stat  (5 total)  + 3 career
//   Gear 2 — Practice Mode: 2 life-stat directives per stat (10 total) + 5 career
//   Gear 3 — Deep Practice: 3 life-stat directives per stat (15 total) + 7 career
//             → Slot 3 of life-stat always carries a field note reflection prompt
//
// Gear does NOT apply during Tier 0 (days 1–7). All Tier 0 runs at Gear 1.
// Career directives are also skipped during Tier 0 — no mixing until Day 8.
// Gear unlocks after the operative completes all 7 Tier 0 days.

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

// ─── CAREER DIRECTIVE CACHE LOADER ───────────────────────────
// Loads career directives from localStorage (seeded by Gemini Call 2,
// refreshed by Call 4 in Block D). Returns an empty array if cache
// is absent or malformed — caller handles gracefully.
//
// Career directives are date-seeded to give day-consistency.
// The same operative sees the same career directives all day.
// Directives that have been completed today are filtered out first.
function getCareerDirectivesFromCache(count, completedToday) {
    try {
        const raw = localStorage.getItem(CAREER_DIRECTIVES_CACHE_KEY);
        if (!raw) return [];
        const pool = JSON.parse(raw);
        if (!Array.isArray(pool) || pool.length === 0) return [];

        // Filter out directives completed today
        const completed  = completedToday || [];
        const available  = pool.filter(d => !completed.includes(d.id));
        if (!available.length) return [];

        // Date-seed for day-consistency — same day = same selection
        const dateNum = dateToNumber(new Date().toISOString().slice(0, 10));
        const result  = [];
        const used    = new Set();

        for (let i = 0; i < count && i < available.length; i++) {
            const seed     = (dateNum + i * 37) % available.length; // prime step avoids collision
            let   idx      = seed;
            let   attempts = 0;

            // Walk forward until we find an unused directive
            while (used.has(idx) && attempts < available.length) {
                idx = (idx + 1) % available.length;
                attempts++;
            }

            if (!used.has(idx)) {
                // Tag as career directive so app.js can route the increment correctly
                result.push({ ...available[idx], _isCareerDirective: true });
                used.add(idx);
            }
        }

        return result;
    } catch(e) {
        console.warn('[SYD] Could not load career directive cache:', e);
        return [];
    }
}

// ─── DAILY DIRECTIVE SELECTION ───────────────────────────────
// Picks life-stat directives per stat per day, seeded by date.
// The same operative gets the same directives all day.
// Pool is filtered to directives at or below the current tier.
//
// BLOCK B: After life-stat selection, career directives are mixed in
// from the career cache at the gear-appropriate count (3/5/7).
// This only applies after Tier 0 and when the career cache is populated.
//
// Graceful tier fallback: if the current tier pool is empty for a stat,
// SYD falls back to the highest available lower tier and flags it.
// Never breaks silently.

function getDailyQuests(allQuests, level, gear, operatorDays) {

    // ── Tier 0: days 1–7 — deterministic, no career mixing ───────
    // Career directives are never mixed during Tier 0. The Tier 0
    // experience is deliberately controlled and cannot be disrupted
    // by an empty or partially-populated career cache.
    if (typeof operatorDays === 'number' && operatorDays >= 1 && operatorDays <= 7) {
        const tier0 = getTier0DayQuests(allQuests, operatorDays);
        if (tier0.length > 0) return tier0;
        // If Tier 0 pool is entirely empty (data gap), fall through to standard selection.
    }

    const todayStr  = new Date().toISOString().slice(0, 10);
    const dateNum   = dateToNumber(todayStr);
    const stats     = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
    const tier      = getCurrentTier(level || 1);
    const gearLevel = gear || 1;
    const daily     = [];

    // ── Life-stat selection (unchanged from original) ─────────────
    stats.forEach((stat, statIndex) => {

        if (gearLevel === 1) {
            const pool = getPoolWithFallback(allQuests, stat, tier);
            if (!pool.length) return;
            const seed   = dateNum + statIndex;
            const picked = pool[seed % pool.length];
            if (picked) daily.push(picked);

        } else if (gearLevel === 2) {
            const pool = getPoolWithFallback(allQuests, stat, tier);
            if (!pool.length) return;

            const seed1 = dateNum + statIndex;
            const seed2 = dateNum + statIndex + 37;

            const q1   = pool[seed1 % pool.length];
            let   idx2 = seed2 % pool.length;

            if (pool[idx2] && pool[idx2].id === q1.id && pool.length > 1) {
                idx2 = (idx2 + 1) % pool.length;
            }
            const q2 = pool[idx2];

            if (q1) daily.push(q1);
            if (q2) daily.push(q2);

        } else {
            // Gear 3: three directives, varied by tier
            const tier2 = Math.max(1, tier - 1);

            const pool1 = allQuests.filter(q => q.stat === stat && q.tier === tier);
            const pool2 = allQuests.filter(q => q.stat === stat && q.tier === tier2);
            const pool3 = allQuests.filter(q => q.stat === stat && q.tier === 1);

            const seed1 = dateNum + statIndex;
            const seed2 = dateNum + statIndex + 37;
            const seed3 = dateNum + statIndex + 71;

            const q1 = pool1.length ? pool1[seed1 % pool1.length] : null;
            const q2 = pool2.length ? pool2[seed2 % pool2.length] : null;
            const q3 = pool3.length ? pool3[seed3 % pool3.length] : null;

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
                return q;
            };

            const final1 = dedup(q1, pool1, seed1);
            const final2 = dedup(q2, pool2, seed2);
            let   final3 = dedup(q3, pool3, seed3);

            if (final3) final3 = { ...final3, _requiresReflection: true };

            if (final1) daily.push(final1);
            if (final2) daily.push(final2);
            if (final3) daily.push(final3);
        }
    });

    // ── BLOCK B: Career directive mixing ─────────────────────────
    // Career directives are appended after life-stat directives.
    // Count is determined by gear level: 3 / 5 / 7.
    // Skipped silently if cache is empty (no Gemini Call 2 yet,
    // Neural Link not connected, or first week of Tier 0 — already
    // handled above).
    //
    // The current player's completedToday is accessed via the global
    // `player` variable (set in app.js). If player is not yet defined,
    // this step is skipped gracefully.
    const careerCountByGear = { 1: 3, 2: 5, 3: 7 };
    const careerCount       = careerCountByGear[gearLevel] || 3;
    const completedIds      = (typeof player !== 'undefined' && player && player.completedToday)
        ? player.completedToday
        : [];

    const careerDirectives = getCareerDirectivesFromCache(careerCount, completedIds);

    if (careerDirectives.length > 0) {
        // Dedup against life-stat directives already selected (IDs should
        // not collide since career IDs use cd_ prefix, but check defensively)
        const existingIds = new Set(daily.map(d => d.id));
        careerDirectives.forEach(cd => {
            if (!existingIds.has(cd.id)) {
                daily.push(cd);
                existingIds.add(cd.id);
            }
        });
    }

    return daily;
}

// ─── POOL WITH GRACEFUL FALLBACK ─────────────────────────────
// Returns the full directive pool for a stat at or below the target tier.
// If the current tier has no directives, falls back to the highest available
// lower tier and notifies SYD's log so the operative is never left with nothing.

function getPoolWithFallback(allQuests, stat, targetTier) {
    let pool = allQuests.filter(q => q.stat === stat && q.tier === targetTier);
    if (pool.length > 0) return pool;

    for (let t = targetTier - 1; t >= 1; t--) {
        pool = allQuests.filter(q => q.stat === stat && q.tier === t);
        if (pool.length > 0) {
            if (typeof showLog === 'function') {
                showLog(`[ TIER ${targetTier} DIRECTIVES LOADING — OPERATING ON CURRENT BEST ]`, 'system');
            }
            return pool;
        }
    }

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
// Called by renderDirectivesSegment() in status.js.
//
// BLOCK B: Career directive cards show a secondary career skill tag
// beneath the stat badge. No structural changes to card HTML — the
// career_skill field is simply rendered as an additional badge row
// when present on the quest object.
//
// BLOCK D: tactical_guide fully removed. intel is the sole field.
// showIntelBtn: true only when quest.intel is present.
// Button always reads '⬡ INTEL'.
// Intel panel text: quest.intel only.

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
        const isCareer        = !!quest._isCareerDirective;
        const careerSkill     = quest.career_skill || null;

        const savedNote = (typeof loadFieldNote === 'function')
            ? loadFieldNote(quest.id)
            : '';

        // XP display — Sig rewards shown on card
        const xpLine = `+${quest.xp} XP · +${Math.floor(quest.xp / 2)} SIG`;

        // BLOCK D: intel field only. No tactical_guide fallback.
        // Button shown only when quest.intel exists.
        const hasIntel     = !!(quest.intel);
        const showIntelBtn = hasIntel;

        const card = document.createElement('div');
        card.className = `directive-card${isComplete ? ' directive-card--complete' : ''}${isCareer ? ' directive-card--career' : ''}`;
        card.id        = `quest-card-${quest.id}`;
        card.style.setProperty('--card-stat-colour', colour);

        card.innerHTML = `
            <div class="dc-header">
                <span class="dc-stat-tag" style="color:${colour}">[ ${label} ]</span>
                <span class="dc-tier-tag">T${quest.tier}</span>
            </div>
            ${isCareer && careerSkill ? `
                <div class="dc-career-tag">
                    <span class="dc-career-skill-label">${careerSkill}</span>
                </div>
            ` : ''}
            <h3 class="dc-title">${quest.title}</h3>
            <p class="dc-desc">${quest.desc}</p>

            ${showIntelBtn ? `
                <button class="dc-intel-btn" data-quest-id="${quest.id}">⬡ INTEL</button>
                <div class="dc-intel-panel hidden" id="intel-panel-${quest.id}">
                    <p class="dc-intel-text">${quest.intel}</p>
                </div>
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

        // ── Wire intel button — inline expand/collapse ────────────
        // BLOCK D: intel only. Panel shows quest.intel text.
        if (showIntelBtn) {
            const intelBtn   = card.querySelector(`.dc-intel-btn[data-quest-id="${quest.id}"]`);
            const intelPanel = document.getElementById(`intel-panel-${quest.id}`);
            if (intelBtn && intelPanel) {
                intelBtn.addEventListener('click', () => {
                    const isOpen = !intelPanel.classList.contains('hidden');
                    if (isOpen) {
                        intelPanel.classList.add('hidden');
                        intelBtn.textContent = '⬡ INTEL';
                    } else {
                        intelPanel.classList.remove('hidden');
                        intelBtn.textContent = '− CLOSE';
                    }
                });
            }
        }

        // ── Wire field note — reflection-gated (Gear 3 slot 3) ──
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

            if (savedNote && wrap) {
                wrap.classList.remove('fn-wrap--hidden');
                if (toggleBtn) {
                    toggleBtn.textContent  = '− NOTE';
                    toggleBtn.dataset.open = 'true';
                }
            }

            if (toggleBtn && wrap) {
                toggleBtn.addEventListener('click', () => {
                    const isOpen = toggleBtn.dataset.open === 'true';
                    if (isOpen) {
                        wrap.classList.add('fn-wrap--hidden');
                        toggleBtn.textContent  = '+ ADD NOTE';
                        toggleBtn.dataset.open = 'false';
                    } else {
                        wrap.classList.remove('fn-wrap--hidden');
                        toggleBtn.textContent  = '− NOTE';
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
    document.querySelectorAll('.complete-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const { id, stat, xp } = btn.dataset;
            if (typeof completeQuest === 'function') {
                completeQuest(id, stat, parseInt(xp, 10));
            }
        });
    });
}