// ═══════════════════════════════════════════════════════════════
// SYD GES — minigames.js
// Five mini-games. All train stats. All cost Sig to enter.
// Visual standard: visually yummy, pow, ka-blaam — effects that
// enhance not overwhelm.
//
// Scan games (Signal Breach, Precision Shooter, Final Transmission)
// are in scan.js. Replaying them after onboarding routes back here
// and contributes to both stat gains and calibration refinement.
//
// STUB — all game mechanics are placeholder.
// Screen layout, Sig entry cost, stat reward display, and nav are wired.
// Real game mechanics are built in Phase 3 (mini-games build).
// ═══════════════════════════════════════════════════════════════

// ─── SIG ENTRY COSTS ─────────────────────────────────────────
// [TUNING TARGET] Sig cost per game session — calibrate after first build
const MINIGAME_COSTS = {
    cascade:   5,
    drift:     5,
    echo:      5,
    flow:      5,
    resonance: 5
};

// ─── STAT REWARDS ────────────────────────────────────────────
// [TUNING TARGET] XP awarded per completed mini-game session
const MINIGAME_XP = {
    cascade:   8,
    drift:     8,
    echo:      8,
    flow:      8,
    resonance: 8
};

// Stats trained per game
const MINIGAME_STATS = {
    cascade:   ['intelligence', 'agility'],
    drift:     ['agility', 'endurance'],
    echo:      ['intelligence', 'strength'],
    flow:      ['strength', 'endurance'],
    resonance: ['charisma', 'intelligence']
};

// ─── MINI-GAME HUB ───────────────────────────────────────────
// Renders the mini-game selection screen.
// Shows Sig balance, game cards with costs and stat targets.

function renderMiniGameHub(sigBalance) {
    const container = document.getElementById('minigames-content');
    if (!container) return;

    const games = [
        { id: 'cascade',   name: 'CASCADE',   icon: '⬡', desc: 'Nodes cascade. Read the pattern before the signal breaks.' },
        { id: 'drift',     name: 'DRIFT',     icon: '◈', desc: 'Navigate the drift. Endurance under constant pressure.' },
        { id: 'echo',      name: 'ECHO',      icon: '◎', desc: 'The system speaks. Decode before the echo fades.' },
        { id: 'flow',      name: 'FLOW',      icon: '▣', desc: 'Push through. Strength compounds with endurance in the long game.' },
        { id: 'resonance', name: 'RESONANCE', icon: '◆', desc: 'Read the room. Social frequency calibration in real time.' }
    ];

    // Also include scan game replays — they contribute to stat gains and calibration
    const scanGames = [
        { id: 'scan_signal_breach',       name: 'SIGNAL BREACH',      icon: '⬡', desc: 'Replay the scan. Pattern recognition and cognitive flexibility.' },
        { id: 'scan_precision_shooter',   name: 'PRECISION SHOOTER',  icon: '◎', desc: 'Replay the scan. Execution speed, accuracy, pressure stability.' },
        { id: 'scan_final_transmission',  name: 'FINAL TRANSMISSION', icon: '◈', desc: 'Replay the scan. Social reading.' }
    ];

    container.innerHTML = `
        <div class="minigames-wrap">
            <div class="minigames-header">
                <button class="mg-back-btn" id="mg-back">← BACK</button>
                <span class="mg-label">[ SYD TRAINING FLOOR ]</span>
                <span class="mg-sig-balance">SIG: ${sigBalance || 0}</span>
            </div>
            <div class="minigames-grid" id="minigames-grid">
                ${games.map(g => renderGameCard(g, sigBalance, MINIGAME_COSTS[g.id])).join('')}
            </div>
            <div class="minigames-section-label">[ SCAN REPLAY — ALSO TRAINS STATS ]</div>
            <div class="minigames-grid minigames-grid--scan">
                ${scanGames.map(g => renderScanReplayCard(g)).join('')}
            </div>
        </div>
    `;

    document.getElementById('mg-back').addEventListener('click', () => {
        playUIClick();
        goBack();
    });

    games.forEach(g => {
        const btn = document.getElementById(`mg-btn-${g.id}`);
        if (btn) {
            btn.addEventListener('click', () => {
                playUIClick();
                enterMiniGame(g.id, sigBalance);
            });
        }
    });

    scanGames.forEach(g => {
        const btn = document.getElementById(`mg-btn-${g.id}`);
        if (btn) {
            btn.addEventListener('click', () => {
                playUIClick();
                enterScanReplay(g.id);
            });
        }
    });
}

function renderGameCard(game, sigBalance, cost) {
    const stats     = MINIGAME_STATS[game.id] || [];
    const canAfford = (sigBalance || 0) >= cost;
    const statLabels = { intelligence: 'INT', agility: 'AGI', strength: 'STR', endurance: 'END', charisma: 'CHA' };

    return `
        <div class="mg-card ${canAfford ? '' : 'mg-card--locked'}">
            <div class="mg-card-icon">${game.icon}</div>
            <h3 class="mg-card-name">${game.name}</h3>
            <p class="mg-card-desc">${game.desc}</p>
            <div class="mg-card-stats">
                ${stats.map(s => `<span class="mg-stat-tag">${statLabels[s] || s}</span>`).join('')}
            </div>
            <div class="mg-card-footer">
                <span class="mg-cost">${cost} SIG</span>
                <button
                    class="dc-complete-btn"
                    id="mg-btn-${game.id}"
                    ${canAfford ? '' : 'disabled'}
                >[ ENTER ]</button>
            </div>
        </div>
    `;
}

function renderScanReplayCard(game) {
    return `
        <div class="mg-card mg-card--scan-replay">
            <div class="mg-card-icon">${game.icon}</div>
            <h3 class="mg-card-name">${game.name}</h3>
            <p class="mg-card-desc">${game.desc}</p>
            <div class="mg-card-footer">
                <span class="mg-cost">FREE</span>
                <button class="dc-complete-btn" id="mg-btn-${game.id}">[ REPLAY ]</button>
            </div>
        </div>
    `;
}

// ─── GAME ENTRY ───────────────────────────────────────────────
function enterMiniGame(gameId, sigBalance) {
    const cost = MINIGAME_COSTS[gameId] || 0;
    if ((sigBalance || 0) < cost) return;

    showScreen('screen-minigame');
    renderMiniGamePlaceholder(gameId);
}

function enterScanReplay(gameId) {
    showScreen('screen-minigame');
    renderScanReplayPlaceholder(gameId);
}

// ─── GAME STUBS ───────────────────────────────────────────────
// Each game renders its placeholder until Phase 3 mechanics are built.

function renderMiniGamePlaceholder(gameId) {
    const container = document.getElementById('minigame-active-content');
    if (!container) return;

    const names = { cascade: 'CASCADE', drift: 'DRIFT', echo: 'ECHO', flow: 'FLOW', resonance: 'RESONANCE' };
    const stats = MINIGAME_STATS[gameId] || [];
    const statLabels = { intelligence: 'INT', agility: 'AGI', strength: 'STR', endurance: 'END', charisma: 'CHA' };

    container.innerHTML = `
        <div class="minigame-active-wrap">
            <div class="mg-active-header">
                <button class="mg-back-btn" id="mg-active-back">← EXIT</button>
                <span class="mg-label">[ ${names[gameId] || gameId.toUpperCase()} ]</span>
            </div>
            <div class="scan-placeholder">
                <div class="scan-placeholder-icon">⬡</div>
                <p class="scan-placeholder-label">${names[gameId] || gameId.toUpperCase()}</p>
                <div class="mg-card-stats" style="justify-content:center;margin:8px 0;">
                    ${stats.map(s => `<span class="mg-stat-tag">${statLabels[s] || s}</span>`).join('')}
                </div>
                <p class="scan-placeholder-dev">[ GAME MECHANIC — BUILD PHASE 3 ]</p>
                <button class="btn btn--primary" id="mg-dummy-complete">
                    [ DUMMY: COMPLETE SESSION ]
                </button>
            </div>
        </div>
    `;

    document.getElementById('mg-active-back').addEventListener('click', () => {
        playUIClick();
        goBack();
    });

    document.getElementById('mg-dummy-complete').addEventListener('click', () => {
        playUIClick();
        completeMiniGameSession(gameId);
    });
}

function renderScanReplayPlaceholder(gameId) {
    const container = document.getElementById('minigame-active-content');
    if (!container) return;

    const names = {
        scan_signal_breach:      'SIGNAL BREACH',
        scan_precision_shooter:  'PRECISION SHOOTER',
        scan_final_transmission: 'FINAL TRANSMISSION'
    };

    container.innerHTML = `
        <div class="minigame-active-wrap">
            <div class="mg-active-header">
                <button class="mg-back-btn" id="mg-active-back">← EXIT</button>
                <span class="mg-label">[ ${names[gameId] || gameId.toUpperCase()} — REPLAY ]</span>
            </div>
            <div class="scan-placeholder">
                <div class="scan-placeholder-icon">◈</div>
                <p class="scan-placeholder-label">${names[gameId] || gameId.toUpperCase()}</p>
                <p class="scan-placeholder-dev">[ SCAN REPLAY — BUILD PHASE 3 ]</p>
                <button class="btn btn--primary" id="mg-dummy-complete">
                    [ DUMMY: COMPLETE REPLAY ]
                </button>
            </div>
        </div>
    `;

    document.getElementById('mg-active-back').addEventListener('click', () => {
        playUIClick();
        goBack();
    });

    document.getElementById('mg-dummy-complete').addEventListener('click', () => {
        playUIClick();
        completeScanReplaySession(gameId);
    });
}

// ─── SESSION COMPLETION ───────────────────────────────────────
// Awards XP across both trained stats and the corresponding Sig.
// Called with real results at Phase 3.

function completeMiniGameSession(gameId) {
    const xpReward  = MINIGAME_XP[gameId] || 8;
    const stats     = MINIGAME_STATS[gameId] || [];
    const xpPerStat = Math.floor(xpReward / stats.length);

    // Award XP through app.js's existing mechanism
    if (typeof player !== 'undefined' && typeof savePlayer === 'function') {
        stats.forEach(stat => {
            if (typeof player.stats[stat] === 'number') {
                player.stats[stat] = parseFloat((player.stats[stat] + xpPerStat * 0.5).toFixed(1));
            }
        });
        // Award Sig
        const sigReward = Math.floor(xpReward / 2);
        player.sig = (player.sig || 0) + sigReward;
        savePlayer();
        if (typeof updateStatusScreen === 'function') updateStatusScreen();
    }

    if (typeof showLog === 'function') {
        showLog(`[ SESSION COMPLETE — +${xpReward} XP DISTRIBUTED ]`, 'accent');
    }

    setTimeout(() => goBack(), 800);
}

function completeScanReplaySession(gameId) {
    // Replay contributes to calibration refinement (handled at Phase 3)
    // and awards a small fixed XP across relevant scan traits
    if (typeof showLog === 'function') {
        showLog('[ SCAN REPLAY LOGGED — CALIBRATION UPDATED ]', 'accent');
    }
    setTimeout(() => goBack(), 800);
}
