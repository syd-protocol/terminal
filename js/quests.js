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

function getDailyQuests(allQuests, level, gear) {
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

        // Reflection prompt — only on Gear 3 slot 3 directives, only when not yet complete.
        // The complete button stays locked until at least 10 characters are written.
        // The writing is the practice. Nothing is stored or transmitted.
        const reflectionSection = (quest._requiresReflection && !isComplete)
            ? `<div class="reflection-wrap">
                   <div class="reflection-label">[ FIELD REPORT ]</div>
                   <div class="reflection-hint">
                       Log what you observed. It does not need to be saved —
                       bringing the thought into form is the practice itself.
                   </div>
                   <textarea
                       class="reflection-input"
                       id="reflection-${quest.id}"
                       placeholder="What did you notice, feel, or learn?"
                       rows="3"
                   ></textarea>
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

        card.innerHTML = `
            ${headerHtml}
            <div class="qc-title">${quest.title}</div>
            <div class="qc-desc">${quest.desc}</div>
            ${modelSection}
            ${tacticalSection}
            ${reflectionSection}
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
                    <div class="qc-xp">+${quest.xp} <span class="qc-xp-label">XP</span></div>
                    ${xpBonus}
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

        // Wire reflection textarea — complete button locked until 10+ characters written.
        if (quest._requiresReflection && !isComplete) {
            const textarea    = document.getElementById('reflection-' + quest.id);
            const completeBtn = document.getElementById('complete-btn-' + quest.id);
            completeBtn.disabled = true;

            textarea.addEventListener('input', () => {
                completeBtn.disabled = textarea.value.trim().length < 10;
            });
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