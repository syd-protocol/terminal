// ─── TIER UNLOCK LEVELS ──────────────────────────────────────
// Tier 1: Level 1+   — foundational mental models
// Tier 2: Level 10+  — deeper frameworks (~5-6 months consistent play)
// Tier 3: Level 25+  — mastery level (~2 years consistent play)

function getCurrentTier(level) {
    if (level >= 25) return 3;
    if (level >= 10) return 2;
    return 1;
}

// ─── DAILY QUEST SELECTION ───────────────────────────────────
// Picks one quest per stat per day, seeded by date for consistency.
// Pool is filtered to quests at or below current tier.

function getDailyQuests(allQuests, level) {
    const today = new Date().toISOString().slice(0, 10);
    const stats = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
    const tier  = getCurrentTier(level || 1);
    const daily = [];

    stats.forEach((stat, i) => {
        const pool = allQuests.filter(q => q.stat === stat && q.tier <= tier);
        const seed = dateToNumber(today) + i;
        daily.push(pool[seed % pool.length]);
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
        card.className = 'quest-card' + (isComplete ? ' completed' : '');
        card.id        = 'quest-card-' + quest.id;

        // Show effective XP only if momentum bonus is active and quest not yet done
        const xpBonus = (!isComplete && momentum > 1)
            ? `<div class="quest-xp-effective">→ +${effectiveXP}</div>`
            : '';

        // Model and why section — always shown
        const modelSection = (quest.model && quest.why)
            ? `<div class="quest-model">
                   <span class="quest-model-name">${quest.model}</span>
                   <span class="quest-model-why">"${quest.why}"</span>
               </div>`
            : '';

        card.innerHTML = `
            <div class="quest-card-left">
                <div class="quest-stat">[ ${quest.stat.toUpperCase()} ]</div>
                <div class="quest-title">${quest.title}</div>
                <div class="quest-desc">${quest.desc}</div>
                ${modelSection}
                <button
                    class="complete-btn"
                    data-id="${quest.id}"
                    data-stat="${quest.stat}"
                    data-xp="${quest.xp}"
                    ${isComplete ? 'disabled' : ''}
                >
                    ${isComplete ? '✓ COMPLETED' : 'COMPLETE QUEST'}
                </button>
            </div>
            <div class="quest-card-right">
                <div class="quest-xp">+${quest.xp} XP</div>
                ${xpBonus}
            </div>
        `;
        list.appendChild(card);
    });

    // Attach complete button listeners
    document.querySelectorAll('.complete-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const { id, stat, xp } = btn.dataset;
            completeQuest(id, stat, parseInt(xp));
        });
    });
}