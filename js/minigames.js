// ═══════════════════════════════════════════════════════════════
// SYD GES — minigames.js
// Five mini-games. All train stats. All cost Sig to enter.
// Visual standard: visually yummy, pow, ka-blaam — effects that
// enhance not overwhelm.
//
//   CASCADE   — Intelligence + Agility
//   DRIFT     — Agility + Endurance
//   ECHO      — Intelligence + Strength
//   FLOW      — Strength + Endurance
//   RESONANCE — Charisma + Intelligence
//
// Scan game replays (Signal Breach, Precision Shooter, Final Transmission)
// route back to scan.js and also award stat gains + calibration refinement.
//
// BLOCK E changes:
//   - MG_FIRST_PLAY_KEY constant added — localStorage key prefix for
//     first-play prompt tracking per game.
//   - openMiniGame(gameId) added — entry point called by status.js
//     GAMES segment. Handles SIG check, first-play prompt, and
//     routes to the correct game. Replaces the stub in status.js.
//   - renderGamesHub() — new function rendering the GAMES segment
//     inside the OPS tab. Full cards: name, one-line desc, expandable
//     instructions (3–4 lines), stat tags, SIG cost, ENTER button.
//     Section header in SYD voice. SIG balance prominent at top.
//     Scan replay link at bottom (text link, not prominent cards).
//   - First-play SYD prompt system: first time an operative enters a
//     game, a one-line SYD prompt shows before the game starts.
//     Tracked in localStorage per game ID. Never shown again after
//     first play of that game.
//   - renderMiniGameHub() updated to match new card style.
//     (screen-minigames still used for individual active sessions.)
// ═══════════════════════════════════════════════════════════════

// ─── CONSTANTS ───────────────────────────────────────────────
// [TUNING TARGET] Sig cost per session
const MINIGAME_COSTS = {
    cascade: 5, drift: 5, echo: 5, flow: 5, resonance: 5
};

// [TUNING TARGET] First-play localStorage key prefix
// Appended with gameId: syd_game_firstplay_cascade, etc.
const MG_FIRST_PLAY_KEY = 'syd_game_firstplay_';
// [TUNING TARGET] Base XP awarded per completed session
const MINIGAME_XP = {
    cascade: 8, drift: 8, echo: 8, flow: 8, resonance: 8
};
// Stats trained per game (XP split equally between them)
const MINIGAME_STATS = {
    cascade:   ['intelligence', 'agility'],
    drift:     ['agility', 'endurance'],
    echo:      ['intelligence', 'strength'],
    flow:      ['strength', 'endurance'],
    resonance: ['charisma', 'intelligence']
};

const STAT_LABELS = {
    intelligence: 'INT', agility: 'AGI',
    strength: 'STR', endurance: 'END', charisma: 'CHA'
};

// ─── GAME METADATA ───────────────────────────────────────────
// Single source of truth for all game display data.
// Block E: expanded with instructions (one-liner + detail lines)
// and first-play SYD prompts.

const GAME_DATA = {
    cascade: {
        name:        'CASCADE',
        icon:        '⬡',
        stats:       ['intelligence', 'agility'],
        desc:        'Catch matching nodes before they fall. Pattern and speed.',
        instructions: [
            'Nodes fall in four columns. Each has a symbol.',
            'Tap a node to hold it. Then tap its matching symbol to clear the pair.',
            'Wrong tap wastes the node. Three waves — each faster than the last.',
            'Score = pairs cleared out of pairs available.'
        ],
        firstPlayPrompt: 'First time in CASCADE. Catch the nodes that share a symbol — hold one, tap its match. Speed and accuracy both count.'
    },
    drift: {
        name:        'DRIFT',
        icon:        '◈',
        stats:       ['agility', 'endurance'],
        desc:        'Hit the zone as it moves. Sustained precision under pressure.',
        instructions: [
            'A target zone moves across a bar. Tap when the marker is inside it.',
            'The zone shrinks across three rounds. Timing is everything.',
            'Sustained precision counts more than peak accuracy.',
            'Score = successful hits weighted by zone size at time of tap.'
        ],
        firstPlayPrompt: 'First time in DRIFT. The zone moves. Hit it while it is open. It gets smaller each round.'
    },
    echo: {
        name:        'ECHO',
        icon:        '◎',
        stats:       ['intelligence', 'strength'],
        desc:        'Repeat the sequence SYD transmits. Memory under increasing load.',
        instructions: [
            'SYD shows a sequence of symbols. Then hides them.',
            'Repeat the sequence in the correct order by tapping.',
            'Each round adds one more symbol. Sequence length increases until you fail.',
            'Score = longest sequence completed without error.'
        ],
        firstPlayPrompt: 'First time in ECHO. SYD shows a sequence then hides it. Tap the symbols back in order. One more added each round.'
    },
    flow: {
        name:        'FLOW',
        icon:        '▣',
        stats:       ['strength', 'endurance'],
        desc:        'Keep the bar in the zone. Rhythmic strength over time.',
        instructions: [
            'A bar drifts continuously. Tap to push it up. Release to let it fall.',
            'Keep it inside the target zone for as long as possible.',
            'The zone narrows and shifts over three rounds.',
            'Score = time spent inside the zone / total time.'
        ],
        firstPlayPrompt: 'First time in FLOW. Tap to raise the bar, release to lower it. Keep it in the zone. Three rounds — the zone gets narrower.'
    },
    resonance: {
        name:        'RESONANCE',
        icon:        '◆',
        stats:       ['charisma', 'intelligence'],
        desc:        'Read what was actually meant. Social signal decoding.',
        instructions: [
            'SYD presents a short social situation and three possible readings.',
            'Pick the reading that captures what was actually communicated.',
            'Not the literal words — the meaning behind them.',
            'Five situations per session. Score = correct reads / total situations.'
        ],
        firstPlayPrompt: 'First time in RESONANCE. Read the situation. Pick what was actually meant — not what was said. There is no timer.'
    }
};

// ─── FIRST-PLAY PROMPT SYSTEM ────────────────────────────────
// Tracks whether the operative has seen the first-play prompt
// for each game. Checked before entering any game.

function hasSeenFirstPlay(gameId) {
    return localStorage.getItem(MG_FIRST_PLAY_KEY + gameId) === '1';
}

function markFirstPlaySeen(gameId) {
    localStorage.setItem(MG_FIRST_PLAY_KEY + gameId, '1');
}

// ─── OPEN MINI GAME (OPS SEGMENT ENTRY POINT) ────────────────
// Called by status.js GAMES segment when operative taps ENTER.
// Handles SIG check, first-play prompt, then routes to game.
// This replaces the stub openMiniGame() call in status.js Block A.
function openMiniGame(gameId) {
    const sig  = (typeof player !== 'undefined' && player) ? (player.sig || 0) : 0;
    const cost = MINIGAME_COSTS[gameId] || 5;

    if (sig < cost) {
        if (typeof showLog === 'function') {
            showLog('[ INSUFFICIENT SIG — COMPLETE DIRECTIVES TO EARN MORE ]', 'system');
        }
        return;
    }

    const gd = GAME_DATA[gameId];
    if (!gd) return;

    if (!hasSeenFirstPlay(gameId)) {
        // Show first-play prompt before launching — renders inline in screen-minigame
        markFirstPlaySeen(gameId);
        if (typeof showScreen === 'function') showScreen('screen-minigame');
        renderFirstPlayPrompt(gameId, gd.firstPlayPrompt || '', () => {
            enterMiniGame(gameId, sig);
        });
    } else {
        enterMiniGame(gameId, sig);
    }
}

// Renders a one-line SYD first-play prompt inside screen-minigame.
// Auto-advances after 3.5s or on tap.
function renderFirstPlayPrompt(gameId, promptText, onContinue) {
    const container = document.getElementById('minigame-active-content');
    if (!container) { onContinue(); return; }

    container.innerHTML = `
        <div class="mg-firstplay-wrap">
            <div class="mg-firstplay-icon">⬡</div>
            <p class="mg-firstplay-label">[ SYD ]</p>
            <p class="mg-firstplay-text">${promptText}</p>
            <button class="btn btn--primary mg-firstplay-btn" id="mg-firstplay-btn">
                [ UNDERSTOOD ]
            </button>
        </div>
    `;

    const btn = document.getElementById('mg-firstplay-btn');
    if (btn) btn.addEventListener('click', () => { playUIClick(); onContinue(); });

    // Auto-advance after 3.5 seconds
    const autoTimer = setTimeout(() => onContinue(), 3500);
    if (btn) btn.addEventListener('click', () => clearTimeout(autoTimer), { once: true });
}

// ─── GAMES HUB (OPS/GAMES SEGMENT) ───────────────────────────
// Called by status.js renderGamesSegment() to render the full GAMES
// section inside the OPS tab. Full card implementation with
// expandable instructions, SIG balance, scan replay link.
// Block A rendered placeholder cards — this is the full version.
function renderGamesHub(container, sig) {
    if (!container) return;

    const sigVal = typeof sig === 'number' ? sig :
        ((typeof player !== 'undefined' && player) ? (player.sig || 0) : 0);

    const gameIds  = ['cascade', 'drift', 'echo', 'flow', 'resonance'];

    container.innerHTML = `
        <div class="games-segment-wrap">

            <div class="games-segment-header">
                <p class="games-syd-line">These games train your stats. They cost SIG to enter. SIG comes from executing directives.</p>
            </div>

            <div class="games-sig-balance">
                <span class="games-sig-icon">&#x2B21;</span>
                <span class="games-sig-value">${sigVal}</span>
                <span class="games-sig-label">SIG AVAILABLE</span>
            </div>

            <div class="games-list">
                ${gameIds.map(id => buildGameCard(id, sigVal)).join('')}
            </div>

            <div class="games-scan-replay">
                <p class="games-scan-replay-label">
                    &#x25BA;
                    <button class="games-scan-replay-link" id="games-scan-replay-btn">
                        REPLAY SCAN GAMES &mdash; SIGNAL BREACH &middot; PRECISION SHOOTER &middot; FINAL TRANSMISSION
                    </button>
                </p>
                <p class="games-scan-replay-note">Free to play. Calibrate traits. No SIG required.</p>
            </div>

        </div>
    `;

    // Wire ENTER buttons
    gameIds.forEach(id => {
        const btn = document.getElementById('games-enter-' + id);
        if (btn && !btn.disabled) {
            btn.addEventListener('click', () => {
                playUIClick();
                openMiniGame(id);
            });
        }
    });

    // Wire instruction expand toggles
    gameIds.forEach(id => {
        const toggle = document.getElementById('games-instr-toggle-' + id);
        const panel  = document.getElementById('games-instr-panel-' + id);
        if (toggle && panel) {
            toggle.addEventListener('click', () => {
                playUIClick();
                const isOpen = !panel.classList.contains('hidden');
                panel.classList.toggle('hidden');
                toggle.textContent = isOpen ? '+ HOW TO PLAY' : '− LESS';
            });
        }
    });

    // Wire scan replay link
    const replayBtn = document.getElementById('games-scan-replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            playUIClick();
            renderScanReplayPicker();
        });
    }
}

function buildGameCard(id, sigVal) {
    const gd       = GAME_DATA[id];
    if (!gd) return '';
    const cost      = MINIGAME_COSTS[id] || 5;
    const canEnter  = sigVal >= cost;
    const stats     = (MINIGAME_STATS[id] || []).map(s => `<span class="game-card-stat-tag">${STAT_LABELS[s] || s}</span>`).join('');
    const instrHTML = (gd.instructions || []).map(l => `<p class="game-instr-line">${l}</p>`).join('');

    return `
        <div class="game-card" id="game-card-${id}">
            <div class="game-card-header">
                <span class="game-card-icon">${gd.icon}</span>
                <span class="game-card-name">[ ${gd.name} ]</span>
                <div class="game-card-stat-tags">${stats}</div>
            </div>
            <p class="game-card-desc">${gd.desc}</p>
            <button class="game-card-instr-toggle" id="games-instr-toggle-${id}">+ HOW TO PLAY</button>
            <div class="game-card-instr-panel hidden" id="games-instr-panel-${id}">
                ${instrHTML}
            </div>
            <div class="game-card-footer">
                <span class="game-card-cost">${cost} SIG</span>
                <button
                    class="game-card-enter-btn${canEnter ? '' : ' game-card-enter-btn--locked'}"
                    id="games-enter-${id}"
                    ${canEnter ? '' : 'disabled'}
                >${canEnter ? '[ ENTER ]' : '[ INSUFFICIENT SIG ]'}</button>
            </div>
        </div>
    `;
}

// Scan replay picker — small inline selector shown in screen-minigame
function renderScanReplayPicker() {
    if (typeof showScreen === 'function') showScreen('screen-minigame');
    const container = document.getElementById('minigame-active-content');
    if (!container) return;

    const scanGames = [
        { id: 'scan_signal_breach',      name: 'SIGNAL BREACH',      desc: 'Pattern recognition · Cognitive flexibility · Persistence' },
        { id: 'scan_precision_shooter',  name: 'PRECISION SHOOTER',  desc: 'Execution speed · Accuracy · Pressure stability' },
        { id: 'scan_final_transmission', name: 'FINAL TRANSMISSION', desc: 'Social reading' }
    ];

    container.innerHTML = `
        <div class="mg-replay-picker-wrap">
            <div class="mg-active-header">
                <button class="mg-back-btn" id="mg-replay-back">← BACK</button>
                <span class="mg-label">[ SCAN REPLAY ]</span>
            </div>
            <p class="mg-replay-intro">Replay any scan experience. Performance refines your calibration. Free to play.</p>
            <div class="mg-replay-list">
                ${scanGames.map(g => `
                    <div class="mg-replay-card">
                        <div class="mg-replay-name">[ ${g.name} ]</div>
                        <p class="mg-replay-desc">${g.desc}</p>
                        <button class="game-card-enter-btn" id="replay-btn-${g.id}">[ REPLAY ]</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('mg-replay-back').addEventListener('click', () => { playUIClick(); goBack(); });

    scanGames.forEach(g => {
        const btn = document.getElementById('replay-btn-' + g.id);
        if (btn) btn.addEventListener('click', () => { playUIClick(); enterScanReplay(g.id); });
    });
}

// ─── HUB (SCREEN-MINIGAMES — STANDALONE SCREEN) ──────────────
// Updated in Block E to use GAME_DATA and match the new card style.
// screen-minigames is still used for individual active game sessions.
// The primary hub is now renderGamesHub() inside the OPS segment.
function renderMiniGameHub(sigBalance) {
    const container = document.getElementById('minigames-content');
    if (!container) return;

    const sig     = typeof sigBalance === 'number' ? sigBalance :
        ((typeof player !== 'undefined' && player) ? (player.sig || 0) : 0);
    const gameIds = ['cascade', 'drift', 'echo', 'flow', 'resonance'];

    container.innerHTML = `
        <div class="minigames-wrap">
            <div class="minigames-header">
                <button class="mg-back-btn" id="mg-back">← BACK</button>
                <span class="mg-label">[ SYD TRAINING FLOOR ]</span>
                <span class="mg-sig-balance">&#x2B21; ${sig} SIG</span>
            </div>
            <p class="mg-intro-line">These games train your stats. They cost SIG to enter. SIG comes from executing directives.</p>
            <div class="minigames-grid" id="minigames-grid">
                ${gameIds.map(id => renderGameCard(GAME_DATA[id], sig, MINIGAME_COSTS[id])).join('')}
            </div>
            <div class="mg-scan-replay-row">
                <button class="games-scan-replay-link" id="mg-scan-replay-btn">
                    &#x25BA; REPLAY SCAN GAMES &mdash; SIGNAL BREACH &middot; PRECISION SHOOTER &middot; FINAL TRANSMISSION
                </button>
                <p class="games-scan-replay-note">Free. Calibrates traits.</p>
            </div>
        </div>
    `;

    document.getElementById('mg-back').addEventListener('click', () => { playUIClick(); goBack(); });

    gameIds.forEach(id => {
        const btn = document.getElementById('mg-btn-' + id);
        if (btn) btn.addEventListener('click', () => { playUIClick(); openMiniGame(id); });
    });

    const replayBtn = document.getElementById('mg-scan-replay-btn');
    if (replayBtn) replayBtn.addEventListener('click', () => { playUIClick(); renderScanReplayPicker(); });
}

function renderGameCard(game, sig, cost) {
    if (!game) return '';
    const stats     = (MINIGAME_STATS[game.id] || []);
    const canAfford = (sig || 0) >= cost;
    return `
        <div class="mg-card ${canAfford ? '' : 'mg-card--locked'}">
            <div class="mg-card-icon">${game.icon}</div>
            <h3 class="mg-card-name">${game.name}</h3>
            <p class="mg-card-desc">${game.desc}</p>
            <div class="mg-card-stats">
                ${stats.map(s => '<span class="mg-stat-tag">' + (STAT_LABELS[s] || s) + '</span>').join('')}
            </div>
            <div class="mg-card-footer">
                <span class="mg-cost">${cost} SIG</span>
                <button class="dc-complete-btn" id="mg-btn-${game.id}" ${canAfford ? '' : 'disabled'}>[ ENTER ]</button>
            </div>
        </div>
    `;
}

// ─── ENTRY ────────────────────────────────────────────────────
function enterMiniGame(gameId, sig) {
    const cost = MINIGAME_COSTS[gameId] || 0;
    if ((sig || 0) < cost) return;
    // Deduct Sig before playing
    if (player) { player.sig = Math.max(0, (player.sig || 0) - cost); savePlayer(); }
    showScreen('screen-minigame');
    switch(gameId) {
        case 'cascade':   runCascade();   break;
        case 'drift':     runDrift();     break;
        case 'echo':      runEcho();      break;
        case 'flow':      runFlow();      break;
        case 'resonance': runResonance(); break;
    }
}

function enterScanReplay(gameId) {
    showScreen('screen-minigame');
    renderScanReplayEntry(gameId);
}

// ─── SHARED GAME SHELL ────────────────────────────────────────
function getMGContainer() { return document.getElementById('minigame-active-content'); }

function renderMGHeader(name, statIds) {
    return `
        <div class="mg-active-header">
            <button class="mg-back-btn" id="mg-exit">← EXIT</button>
            <span class="mg-label">[ ${name} ]</span>
            <div class="mg-card-stats">
                ${statIds.map(s => '<span class="mg-stat-tag">' + (STAT_LABELS[s] || s) + '</span>').join('')}
            </div>
        </div>
    `;
}

function wireMGExit() {
    const btn = document.getElementById('mg-exit');
    if (btn) btn.addEventListener('click', () => {
        playUIClick();
        // Clean up any running timers via window flag
        if (window._mgCleanup) { window._mgCleanup(); window._mgCleanup = null; }
        goBack();
    });
}

// ─── SESSION COMPLETE ─────────────────────────────────────────
// Awards stat XP and shows result overlay inside the game screen.
// score: 0–1 float representing session performance.
// Multiplied against base XP to get final reward — skilled play earns more.
function completeMGSession(gameId, score) {
    const baseXP    = MINIGAME_XP[gameId] || 8;
    const finalXP   = Math.max(2, Math.round(baseXP * Math.max(0.25, score)));
    const stats     = MINIGAME_STATS[gameId] || [];
    const xpPerStat = finalXP / stats.length;
    const sigReward = Math.max(MINIGAME_COSTS[gameId] - 1, Math.floor(finalXP * 0.6));   // [TUNING TARGET] PASS 3: nearly self-sustaining — good score returns almost full cost

    if (player && typeof savePlayer === 'function') {
        stats.forEach(stat => {
            player.stats[stat] = parseFloat(((player.stats[stat] || 10) + xpPerStat * 0.5).toFixed(2));
        });
        player.sig = (player.sig || 0) + sigReward;
        savePlayer();
        if (typeof updateStatusScreen === 'function') updateStatusScreen();
    }

    renderMGResult(gameId, score, finalXP, sigReward, stats);
}

function renderMGResult(gameId, score, xp, sig, stats) {
    const container = getMGContainer();
    if (!container) return;

    const grade = score >= 0.8 ? 'S' : score >= 0.6 ? 'A' : score >= 0.4 ? 'B' : 'C';
    const gradeColour = { S: '#ffd54f', A: '#80cbc4', B: 'var(--accent)', C: 'var(--text-secondary)' }[grade];
    const names = { cascade: 'CASCADE', drift: 'DRIFT', echo: 'ECHO', flow: 'FLOW', resonance: 'RESONANCE' };

    container.innerHTML = `
        <div class="mg-result-wrap">
            <div class="mg-result-grade" style="color:${gradeColour}">${grade}</div>
            <p class="mg-result-name">[ ${names[gameId] || gameId.toUpperCase()} COMPLETE ]</p>
            <div class="mg-result-rewards">
                <div class="mg-result-row">
                    <span class="mg-result-label">XP DISTRIBUTED</span>
                    <span class="mg-result-val">+${xp}</span>
                </div>
                <div class="mg-result-row">
                    <span class="mg-result-label">SIG RETURNED</span>
                    <span class="mg-result-val" style="color:var(--sig-gold)">+${sig}</span>
                </div>
                <div class="mg-result-row">
                    <span class="mg-result-label">STATS TRAINED</span>
                    <span class="mg-result-val">
                        ${stats.map(s => STAT_LABELS[s] || s).join(' · ')}
                    </span>
                </div>
            </div>
            <button class="btn btn--primary mg-result-done" id="mg-result-done">[ ACKNOWLEDGED ]</button>
        </div>
    `;

    playTone(440, 0.08, 'square', 0.1);
    setTimeout(() => playTone(660, 0.12, 'square', 0.1), 90);

    document.getElementById('mg-result-done').addEventListener('click', () => {
        playUIClick(); goBack();
    });
}

// ═══════════════════════════════════════════════════════════════
// GAME 1 — CASCADE  (Intelligence + Agility)
//
// Nodes fall in 4 columns. Each node has a symbol (one of 4).
// Two matching nodes in adjacent columns = a pair. The operative
// taps the falling node to catch it and hold it, then taps its
// match to clear both. Wrong taps waste the node.
// Three waves: wave 1 (slow), wave 2 (faster, more symbols),
// wave 3 (fastest, symbols cycle mid-fall).
// Score = pairs cleared / total pairs available.
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Cascade timing
const CASCADE_WAVES        = 3;
const CASCADE_NODES_PER_W  = [8, 10, 12];  // total nodes per wave
const CASCADE_FALL_MS      = [2200, 1700, 1300]; // ms to fall full height per wave
const CASCADE_INTERVAL_MS  = [900,  700,  550];  // ms between node spawns per wave

const CASCADE_SYMBOLS = ['⬡', '◎', '◈', '▣'];

let cascadeState = null;

function runCascade() {
    const container = getMGContainer();
    if (!container) return;

    cascadeState = {
        wave: 0, score: 0,
        totalPairs: 0, clearedPairs: 0,
        held: null,       // { col, symbol, el }
        nodes: [],
        spawnTimer: null, waveTimeout: null, animFrames: []
    };

    container.innerHTML =
        renderMGHeader('CASCADE', ['intelligence', 'agility']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction" id="cas-instruction">
                Catch matching nodes. Tap to hold, tap its match to clear.
            </p>
            <div class="cas-arena" id="cas-arena">
                <div class="cas-cols" id="cas-cols">
                    ${[0,1,2,3].map(i => '<div class="cas-col" id="cas-col-' + i + '"></div>').join('')}
                </div>
                <div class="cas-held-slot" id="cas-held-slot">
                    <span class="cas-held-label">HOLDING</span>
                    <span class="cas-held-symbol" id="cas-held-symbol">—</span>
                </div>
            </div>
            <div class="mg-wave-label" id="cas-wave-label">WAVE 1 / ${CASCADE_WAVES}</div>
        </div>
    `;
    wireMGExit();
    startCascadeWave();
}

function startCascadeWave() {
    const w        = cascadeState.wave;
    const waveEl   = document.getElementById('cas-wave-label');
    const instrEl  = document.getElementById('cas-instruction');
    if (waveEl)  waveEl.textContent = 'WAVE ' + (w + 1) + ' / ' + CASCADE_WAVES;
    if (instrEl && w === 1) instrEl.textContent = '[ MORE SYMBOLS — SAME RULE ]';
    if (instrEl && w === 2) instrEl.textContent = '[ SYMBOLS CYCLE — STAY SHARP ]';

    const total = CASCADE_NODES_PER_W[w];
    cascadeState.totalPairs += Math.floor(total / 2);

    let spawned = 0;
    const symbolPool = w === 2
        ? [...CASCADE_SYMBOLS, ...CASCADE_SYMBOLS]   // wave 3: all 4 symbols doubled
        : CASCADE_SYMBOLS.slice(0, w + 2);           // wave 1: 2 symbols, wave 2: 3

    // Build paired spawn list: pairs of matching symbols + random fillers
    const spawnList = [];
    for (let i = 0; i < Math.floor(total / 2); i++) {
        const sym = symbolPool[i % symbolPool.length];
        spawnList.push(sym, sym);
    }
    if (total % 2 !== 0) spawnList.push(symbolPool[0]);
    // Shuffle
    for (let i = spawnList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spawnList[i], spawnList[j]] = [spawnList[j], spawnList[i]];
    }

    const interval = setInterval(() => {
        if (spawned >= spawnList.length) {
            clearInterval(interval);
            // After last node has time to fall, advance wave
            cascadeState.waveTimeout = setTimeout(() => advanceCascadeWave(), CASCADE_FALL_MS[w] + 400);
            return;
        }
        spawnCascadeNode(spawnList[spawned], w);
        spawned++;
    }, CASCADE_INTERVAL_MS[w]);

    cascadeState.spawnTimer = interval;
    window._mgCleanup = () => {
        clearInterval(interval);
        clearTimeout(cascadeState.waveTimeout);
        cascadeState.animFrames.forEach(af => cancelAnimationFrame(af));
    };
}

function spawnCascadeNode(symbol, wave) {
    const col    = Math.floor(Math.random() * 4);
    const colEl  = document.getElementById('cas-col-' + col);
    if (!colEl) return;

    const node = document.createElement('div');
    node.className   = 'cas-node';
    node.textContent = symbol;
    node.dataset.sym = symbol;
    node.dataset.col = col;
    colEl.appendChild(node);

    const fallMs = CASCADE_FALL_MS[wave];
    let startY   = 0;
    const arenaH = (document.getElementById('cas-arena') || {}).offsetHeight || 280;
    const start  = performance.now();

    function fall(now) {
        const elapsed  = now - start;
        const progress = Math.min(1, elapsed / fallMs);
        node.style.top = (progress * (arenaH - 40)) + 'px';
        if (progress < 1 && node.parentNode) {
            const af = requestAnimationFrame(fall);
            cascadeState.animFrames.push(af);
        } else if (node.parentNode) {
            // Missed — node exits
            node.remove();
        }
    }
    requestAnimationFrame(fall);

    node.addEventListener('click', () => {
        if (!node.parentNode) return;
        playUIClick();
        if (!cascadeState.held) {
            // Hold this node
            cascadeState.held = { sym: symbol, col, el: node };
            node.classList.add('cas-node--held');
            const heldEl = document.getElementById('cas-held-symbol');
            if (heldEl) heldEl.textContent = symbol;
        } else if (cascadeState.held.sym === symbol && cascadeState.held.el !== node) {
            // Match!
            cascadeState.clearedPairs++;
            playTone(660, 0.12, 'square', 0.1);
            setTimeout(() => playTone(880, 0.1, 'square', 0.08), 80);
            flashNodeClear(cascadeState.held.el);
            flashNodeClear(node);
            cascadeState.held = null;
            const heldEl = document.getElementById('cas-held-symbol');
            if (heldEl) heldEl.textContent = '—';
        } else {
            // Wrong match — drop held node
            cascadeState.held.el.classList.remove('cas-node--held');
            cascadeState.held.el.classList.add('cas-node--wrong');
            setTimeout(() => cascadeState.held && cascadeState.held.el && cascadeState.held.el.classList.remove('cas-node--wrong'), 300);
            cascadeState.held = null;
            const heldEl = document.getElementById('cas-held-symbol');
            if (heldEl) heldEl.textContent = '—';
            playTone(220, 0.08, 'sawtooth', 0.06);
        }
    });
}

function flashNodeClear(el) {
    if (!el) return;
    el.classList.add('cas-node--clear');
    setTimeout(() => el.remove(), 300);
}

function advanceCascadeWave() {
    cascadeState.animFrames = [];
    cascadeState.wave++;
    if (cascadeState.wave >= CASCADE_WAVES) {
        const score = cascadeState.totalPairs > 0
            ? cascadeState.clearedPairs / cascadeState.totalPairs
            : 0.3;
        completeMGSession('cascade', score);
    } else {
        // Brief wave break
        const instrEl = document.getElementById('cas-instruction');
        if (instrEl) instrEl.textContent = '[ WAVE ' + (cascadeState.wave + 1) + ' INCOMING ]';
        setTimeout(() => startCascadeWave(), 700);
    }
}

// ═══════════════════════════════════════════════════════════════
// GAME 2 — DRIFT  (Agility + Endurance)
//
// A dot moves along a sinusoidal path across the screen. Highlighted
// zones appear on the path. The operative taps the screen at the moment
// the dot passes through a highlighted zone. Three rounds, each faster.
// Missing a zone = no score for it. Hitting outside zones = no penalty,
// but tap count is tracked to catch button-mashing.
// Score = zones hit / total zones, adjusted for precision.
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Drift constants
const DRIFT_ROUNDS     = 3;
const DRIFT_ZONES      = 3;          // zones per round
const DRIFT_SPEED      = [0.8, 1.2, 1.7];   // multiplier on base animation speed
const DRIFT_ZONE_WIDTH = [0.12, 0.10, 0.08]; // zone width as fraction of path (easier → harder)

let driftState = null;

function runDrift() {
    const container = getMGContainer();
    if (!container) return;

    driftState = {
        round: 0, zonesHit: 0, totalZones: 0,
        tapCount: 0, rafId: null
    };

    container.innerHTML =
        renderMGHeader('DRIFT', ['agility', 'endurance']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction" id="drift-instruction">
                Tap when the dot enters the highlighted zone.
            </p>
            <canvas id="drift-canvas" class="drift-canvas"></canvas>
            <div class="mg-wave-label" id="drift-round-label">ROUND 1 / ${DRIFT_ROUNDS}</div>
        </div>
    `;
    wireMGExit();

    const canvas = document.getElementById('drift-canvas');
    if (canvas) {
        canvas.width  = canvas.offsetWidth  || 320;
        canvas.height = canvas.offsetHeight || 160;
        canvas.addEventListener('click',      () => onDriftTap());
        canvas.addEventListener('touchstart', () => onDriftTap(), { passive: true });
    }

    startDriftRound();
}

function startDriftRound() {
    const w      = driftState.round;
    const canvas = document.getElementById('drift-canvas');
    const label  = document.getElementById('drift-round-label');
    const instr  = document.getElementById('drift-instruction');
    if (!canvas) return;
    if (label) label.textContent = 'ROUND ' + (w + 1) + ' / ' + DRIFT_ROUNDS;
    if (instr && w === 1) instr.textContent = '[ DRIFT ACCELERATING ]';
    if (instr && w === 2) instr.textContent = '[ FINAL ROUND — HOLD YOUR TIMING ]';

    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const H      = canvas.height;
    const speed  = DRIFT_SPEED[w];
    const zoneW  = DRIFT_ZONE_WIDTH[w];

    // Build zone positions as t-values (0–1 across the round)
    driftState.totalZones += DRIFT_ZONES;
    const zones = [];
    for (let i = 0; i < DRIFT_ZONES; i++) {
        const t = 0.15 + i * (0.7 / (DRIFT_ZONES - 1 || 1));
        zones.push({ t, hit: false });
    }

    const roundDuration = 4000 / speed;
    let elapsed = 0;
    let last    = null;
    let tapped  = false;

    function frame(now) {
        if (!last) last = now;
        elapsed += (now - last) * speed;
        last = now;

        const t   = Math.min(1, elapsed / 4000);
        const x   = t * W;
        const y   = H / 2 + Math.sin(t * Math.PI * 3) * (H * 0.3);

        ctx.clearRect(0, 0, W, H);

        // Draw path
        ctx.strokeStyle = 'rgba(79,195,247,0.15)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
            const pt = i / 100;
            const px = pt * W;
            const py = H / 2 + Math.sin(pt * Math.PI * 3) * (H * 0.3);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Draw zones
        zones.forEach(zone => {
            const zx = zone.t * W;
            const zy = H / 2 + Math.sin(zone.t * Math.PI * 3) * (H * 0.3);
            const rad = zoneW * W / 2;
            ctx.fillStyle = zone.hit
                ? 'rgba(128,203,196,0.4)'
                : 'rgba(79,195,247,0.25)';
            ctx.beginPath();
            ctx.arc(zx, zy, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = zone.hit ? '#80cbc4' : 'var(--accent, #4fc3f7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // Draw dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        if (t < 1) {
            driftState.rafId = requestAnimationFrame(frame);
        } else {
            // Round over
            advanceDriftRound();
        }
    }

    driftState.rafId = requestAnimationFrame(frame);

    // Tap handler checks if dot is inside any zone at tap time
    driftState._onTap = () => {
        if (!last) return;
        driftState.tapCount++;
        const t = Math.min(1, elapsed / 4000);
        zones.forEach(zone => {
            if (!zone.hit && Math.abs(t - zone.t) <= zoneW / 2) {
                zone.hit = true;
                driftState.zonesHit++;
                playTone(660, 0.1, 'square', 0.09);
            }
        });
    };

    window._mgCleanup = () => cancelAnimationFrame(driftState.rafId);
}

function onDriftTap() {
    if (driftState && driftState._onTap) driftState._onTap();
}

function advanceDriftRound() {
    cancelAnimationFrame(driftState.rafId);
    driftState.round++;
    if (driftState.round >= DRIFT_ROUNDS) {
        const rawScore  = driftState.totalZones > 0 ? driftState.zonesHit / driftState.totalZones : 0;
        // Penalise button-mashing slightly — more than 2x taps vs zones = slight deduction
        const precision = driftState.tapCount > 0
            ? Math.min(1, (driftState.zonesHit * 2) / driftState.tapCount)
            : rawScore;
        const score     = (rawScore * 0.7 + precision * 0.3);
        completeMGSession('drift', Math.min(1, score));
    } else {
        setTimeout(() => startDriftRound(), 600);
    }
}

// ═══════════════════════════════════════════════════════════════
// GAME 3 — ECHO  (Intelligence + Strength)
//
// SYD flashes a sequence of nodes (4 positions in a 2x2 grid).
// The operative must repeat the sequence by tapping in order.
// Sequences grow by 1 each round. Four rounds total.
// Score = rounds completed without error / total rounds.
// Wrong tap ends the round (not the game) — operative gets partial credit.
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Echo sequence parameters
const ECHO_ROUNDS         = 4;
const ECHO_START_LENGTH   = 2;    // sequence length on round 1
const ECHO_FLASH_MS       = 500;  // ms each node stays lit during playback
const ECHO_FLASH_GAP_MS   = 200;  // gap between flashes

let echoState = null;

function runEcho() {
    const container = getMGContainer();
    if (!container) return;

    echoState = {
        round: 0, roundsCleared: 0,
        sequence: [], inputIdx: 0,
        accepting: false
    };

    container.innerHTML =
        renderMGHeader('ECHO', ['intelligence', 'strength']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction" id="echo-instruction">
                Watch SYD's sequence. Repeat it exactly.
            </p>
            <div class="echo-grid" id="echo-grid">
                ${[0,1,2,3].map(i => '<button class="echo-node" id="echo-node-' + i + '" data-idx="' + i + '" disabled></button>').join('')}
            </div>
            <div class="mg-wave-label" id="echo-round-label">ROUND 1 / ${ECHO_ROUNDS}</div>
            <p class="echo-feedback" id="echo-feedback">&nbsp;</p>
        </div>
    `;
    wireMGExit();

    [0,1,2,3].forEach(i => {
        const btn = document.getElementById('echo-node-' + i);
        if (btn) btn.addEventListener('click', () => onEchoTap(i));
    });

    setTimeout(() => startEchoRound(), 600);
}

function startEchoRound() {
    const w      = echoState.round;
    const label  = document.getElementById('echo-round-label');
    const fb     = document.getElementById('echo-feedback');
    if (label) label.textContent = 'ROUND ' + (w + 1) + ' / ' + ECHO_ROUNDS;
    if (fb)    fb.textContent    = 'WATCH...';

    // Build sequence: grow by 1 each round
    const seqLen = ECHO_START_LENGTH + w;
    const seq    = [];
    for (let i = 0; i < seqLen; i++) {
        seq.push(Math.floor(Math.random() * 4));
    }
    echoState.sequence  = seq;
    echoState.inputIdx  = 0;
    echoState.accepting = false;

    // Disable all nodes during playback
    [0,1,2,3].forEach(i => {
        const btn = document.getElementById('echo-node-' + i);
        if (btn) btn.disabled = true;
    });

    playbackEchoSequence(seq, 0, () => {
        // Sequence done — enable input
        echoState.accepting = true;
        if (fb) fb.textContent = 'YOUR TURN';
        [0,1,2,3].forEach(i => {
            const btn = document.getElementById('echo-node-' + i);
            if (btn) btn.disabled = false;
        });
    });
}

function playbackEchoSequence(seq, idx, onDone) {
    if (idx >= seq.length) { setTimeout(onDone, ECHO_FLASH_GAP_MS); return; }
    const nodeEl = document.getElementById('echo-node-' + seq[idx]);
    if (nodeEl) {
        nodeEl.classList.add('echo-node--flash');
        playTone(330 + seq[idx] * 110, 0.12, 'square', 0.08);
        setTimeout(() => {
            nodeEl.classList.remove('echo-node--flash');
            setTimeout(() => playbackEchoSequence(seq, idx + 1, onDone), ECHO_FLASH_GAP_MS);
        }, ECHO_FLASH_MS);
    } else {
        setTimeout(() => playbackEchoSequence(seq, idx + 1, onDone), ECHO_FLASH_MS + ECHO_FLASH_GAP_MS);
    }
}

function onEchoTap(idx) {
    if (!echoState || !echoState.accepting) return;
    const nodeEl = document.getElementById('echo-node-' + idx);
    const fb     = document.getElementById('echo-feedback');

    // Flash the tapped node
    if (nodeEl) {
        nodeEl.classList.add('echo-node--tap');
        playTone(330 + idx * 110, 0.08, 'square', 0.07);
        setTimeout(() => nodeEl.classList.remove('echo-node--tap'), 180);
    }

    if (idx === echoState.sequence[echoState.inputIdx]) {
        echoState.inputIdx++;
        if (echoState.inputIdx >= echoState.sequence.length) {
            // Correct round complete
            echoState.roundsCleared++;
            echoState.accepting = false;
            [0,1,2,3].forEach(i => { const b = document.getElementById('echo-node-' + i); if (b) b.disabled = true; });
            if (fb) fb.textContent = '[ SEQUENCE CONFIRMED ]';
            playTone(660, 0.12, 'square', 0.1);
            setTimeout(() => {
                echoState.round++;
                if (echoState.round >= ECHO_ROUNDS) {
                    completeMGSession('echo', echoState.roundsCleared / ECHO_ROUNDS);
                } else {
                    startEchoRound();
                }
            }, 800);
        }
    } else {
        // Wrong tap — end round
        echoState.accepting = false;
        [0,1,2,3].forEach(i => { const b = document.getElementById('echo-node-' + i); if (b) b.disabled = true; });
        if (nodeEl) nodeEl.classList.add('echo-node--wrong');
        if (fb) { fb.textContent = '[ SEQUENCE BROKEN ]'; }
        playTone(180, 0.1, 'sawtooth', 0.07);
        setTimeout(() => {
            if (nodeEl) nodeEl.classList.remove('echo-node--wrong');
            echoState.round++;
            if (echoState.round >= ECHO_ROUNDS) {
                completeMGSession('echo', echoState.roundsCleared / ECHO_ROUNDS);
            } else {
                startEchoRound();
            }
        }, 900);
    }
}

// ═══════════════════════════════════════════════════════════════
// GAME 4 — FLOW  (Strength + Endurance)
//
// A vertical bar must be kept in a green zone through rhythmic tapping.
// Each tap pushes the bar up. Gravity pulls it down continuously.
// Without tapping, the bar falls out of zone.
// Tap too fast and it overshoots the top.
// Three intervals of 8 seconds each. Zone narrows each interval.
// Score = total time-in-zone / total time.
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Flow physics
const FLOW_INTERVALS     = 3;
const FLOW_INTERVAL_MS   = 8000;  // 8 seconds per interval
const FLOW_GRAVITY       = 0.006; // units/ms downward pull (fraction of bar height)
const FLOW_TAP_BOOST     = 0.12;  // fraction of bar height per tap
const FLOW_ZONE_CENTRES  = [0.5, 0.5, 0.5];        // zone centre as fraction of bar height
const FLOW_ZONE_HEIGHTS  = [0.30, 0.22, 0.16];     // [TUNING TARGET] zone width narrows
const FLOW_CLAMP         = [0.02, 0.98];             // min/max position

let flowState = null;

function runFlow() {
    const container = getMGContainer();
    if (!container) return;

    flowState = {
        interval: 0,
        pos:      0.5,     // 0=bottom, 1=top
        timeInZone: 0,
        totalTime:  0,
        rafId:   null,
        tapped:  false
    };

    container.innerHTML =
        renderMGHeader('FLOW', ['strength', 'endurance']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction" id="flow-instruction">
                Tap rhythmically to keep the bar in the zone.
            </p>
            <div class="flow-arena" id="flow-arena">
                <div class="flow-track">
                    <div class="flow-zone" id="flow-zone"></div>
                    <div class="flow-bar" id="flow-bar"></div>
                </div>
                <button class="flow-tap-btn" id="flow-tap-btn">TAP</button>
            </div>
            <div class="mg-wave-label" id="flow-interval-label">INTERVAL 1 / ${FLOW_INTERVALS}</div>
        </div>
    `;
    wireMGExit();

    const tapBtn = document.getElementById('flow-tap-btn');
    if (tapBtn) {
        tapBtn.addEventListener('click',      () => onFlowTap());
        tapBtn.addEventListener('touchstart', () => onFlowTap(), { passive: true });
    }

    updateFlowZoneUI();
    startFlowInterval();
}

function updateFlowZoneUI() {
    const iv      = flowState.interval;
    const centre  = FLOW_ZONE_CENTRES[iv];
    const half    = FLOW_ZONE_HEIGHTS[iv] / 2;
    const zoneEl  = document.getElementById('flow-zone');
    if (zoneEl) {
        const bottom = (centre - half) * 100;
        const height = FLOW_ZONE_HEIGHTS[iv] * 100;
        zoneEl.style.bottom = bottom + '%';
        zoneEl.style.height = height + '%';
    }
}

function startFlowInterval() {
    const iv      = flowState.interval;
    const label   = document.getElementById('flow-interval-label');
    const instr   = document.getElementById('flow-instruction');
    if (label) label.textContent = 'INTERVAL ' + (iv + 1) + ' / ' + FLOW_INTERVALS;
    if (instr && iv === 1) instr.textContent = '[ ZONE NARROWING ]';
    if (instr && iv === 2) instr.textContent = '[ FINAL INTERVAL — HOLD IT ]';

    updateFlowZoneUI();
    flowState.pos = 0.5;  // reset position

    let last       = null;
    let elapsed    = 0;

    function frame(now) {
        if (!last) last = now;
        const dt   = now - last;
        last       = now;
        elapsed   += dt;
        flowState.totalTime += dt;

        // Apply gravity and clamp
        flowState.pos = Math.max(
            FLOW_CLAMP[0],
            Math.min(FLOW_CLAMP[1], flowState.pos - FLOW_GRAVITY * dt)
        );

        // Check if in zone
        const centre = FLOW_ZONE_CENTRES[iv];
        const half   = FLOW_ZONE_HEIGHTS[iv] / 2;
        const inZone = flowState.pos >= centre - half && flowState.pos <= centre + half;
        if (inZone) flowState.timeInZone += dt;

        // Update bar UI
        const barEl  = document.getElementById('flow-bar');
        const zoneEl = document.getElementById('flow-zone');
        if (barEl)  barEl.style.bottom = (flowState.pos * 100) + '%';
        if (zoneEl) zoneEl.className   = 'flow-zone' + (inZone ? ' flow-zone--active' : '');

        if (elapsed < FLOW_INTERVAL_MS) {
            flowState.rafId = requestAnimationFrame(frame);
        } else {
            advanceFlowInterval();
        }
    }

    flowState.rafId = requestAnimationFrame(frame);
    window._mgCleanup = () => cancelAnimationFrame(flowState.rafId);
}

function onFlowTap() {
    if (!flowState) return;
    flowState.pos = Math.min(FLOW_CLAMP[1], flowState.pos + FLOW_TAP_BOOST);
    playTone(440, 0.04, 'square', 0.06);
}

function advanceFlowInterval() {
    cancelAnimationFrame(flowState.rafId);
    flowState.interval++;
    if (flowState.interval >= FLOW_INTERVALS) {
        const score = flowState.totalTime > 0
            ? flowState.timeInZone / flowState.totalTime
            : 0.3;
        completeMGSession('flow', score);
    } else {
        setTimeout(() => startFlowInterval(), 500);
    }
}

// ═══════════════════════════════════════════════════════════════
// GAME 5 — RESONANCE  (Charisma + Intelligence)
//
// Short phrases appear one at a time. Each phrase is something someone
// might say in a professional or social context. The operative picks
// what the person actually meant — subtext reading, not surface reading.
// Five scenarios. Score based on quality of read, same 0/0.5/1 internal
// scoring as Final Transmission but with faster pacing.
// ═══════════════════════════════════════════════════════════════

const RESONANCE_SCENARIOS = [
    {
        said:    '"Let me know if you need any help with that."',
        options: [
            { text: 'They are offering genuine assistance.',                                    score: 0.5 },
            { text: 'They are signalling awareness without committing.',                        score: 1.0 },
            { text: 'They want you to say no so the offer is off the table.',                   score: 0.8 }
        ]
    },
    {
        said:    '"That is an interesting idea."',
        options: [
            { text: 'They find the idea genuinely interesting.',                                score: 0.3 },
            { text: 'They are buying time before responding.',                                  score: 0.8 },
            { text: 'They disagree but are not ready to say so directly.',                      score: 1.0 }
        ]
    },
    {
        said:    '"I just wanted to make sure we were aligned."',
        options: [
            { text: 'They want to confirm shared understanding.',                               score: 0.5 },
            { text: 'They suspect misalignment and are surfacing it carefully.',                score: 1.0 },
            { text: 'They need reassurance that their direction is correct.',                   score: 0.7 }
        ]
    },
    {
        said:    '"We should catch up sometime."',
        options: [
            { text: 'They genuinely want to meet.',                                             score: 0.3 },
            { text: 'They are being polite with no specific intent.',                           score: 0.8 },
            { text: 'The strength of the intent depends entirely on who says it next.',         score: 1.0 }
        ]
    },
    {
        said:    '"Happy to take a look at that if you want."',
        options: [
            { text: 'They want to be involved in the work.',                                    score: 0.5 },
            { text: 'They have concerns about the work and want to manage it.',                 score: 0.8 },
            { text: 'They are signalling they have capacity and would welcome the ask.',        score: 1.0 }
        ]
    }
];

let resonanceState = null;

function runResonance() {
    const container = getMGContainer();
    if (!container) return;

    resonanceState = { idx: 0, totalScore: 0 };

    container.innerHTML =
        renderMGHeader('RESONANCE', ['charisma', 'intelligence']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction">Read what was actually meant.</p>
            <div id="resonance-scenario-wrap"></div>
            <div class="mg-wave-label" id="resonance-progress">1 / ${RESONANCE_SCENARIOS.length}</div>
        </div>
    `;
    wireMGExit();
    renderResonanceScenario();
}

function renderResonanceScenario() {
    const wrap    = document.getElementById('resonance-scenario-wrap');
    const progEl  = document.getElementById('resonance-progress');
    if (!wrap) return;

    const sc  = RESONANCE_SCENARIOS[resonanceState.idx];
    const pct = Math.round((resonanceState.idx / RESONANCE_SCENARIOS.length) * 100);
    if (progEl) progEl.textContent = (resonanceState.idx + 1) + ' / ' + RESONANCE_SCENARIOS.length;

    wrap.innerHTML = `
        <div class="resonance-scene">
            <div class="resonance-progress-bar-wrap">
                <div class="resonance-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="resonance-said">${sc.said}</p>
            <p class="resonance-prompt">What did they actually mean?</p>
            <div class="resonance-options">
                ${sc.options.map((opt, i) =>
                    '<button class="resonance-opt" data-opt-idx="' + i + '">' + opt.text + '</button>'
                ).join('')}
            </div>
        </div>
    `;

    document.querySelectorAll('.resonance-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.resonance-opt').forEach(b => b.disabled = true);
            btn.classList.add('resonance-opt--selected');
            const idx = parseInt(btn.dataset.optIdx, 10);
            resonanceState.totalScore += sc.options[idx].score;
            setTimeout(() => {
                resonanceState.idx++;
                if (resonanceState.idx >= RESONANCE_SCENARIOS.length) {
                    const score = resonanceState.totalScore / RESONANCE_SCENARIOS.length;
                    completeMGSession('resonance', score);
                } else {
                    renderResonanceScenario();
                }
            }, 550);
        });
    });
}

// ─── SCAN REPLAY ROUTING ─────────────────────────────────────
// Routes back to scan.js experiences for replay.
// Awards calibration refinement + fixed XP.
function renderScanReplayEntry(gameId) {
    const container = getMGContainer();
    if (!container) return;

    const names = {
        scan_signal_breach:      'SIGNAL BREACH',
        scan_precision_shooter:  'PRECISION SHOOTER',
        scan_final_transmission: 'FINAL TRANSMISSION'
    };

    // Wire a replay callback — after scan experience, return to hub
    const originalOnComplete = scanState ? scanState.onComplete : null;

    // For replay, route the appropriate scan experience
    // and award XP on completion
    container.innerHTML =
        renderMGHeader(names[gameId] || gameId, []) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction">
                Replay this scan experience. Your performance refines your calibration.
            </p>
            <p class="scan-placeholder-sub" style="text-align:center;">
                [ Loading experience... ]
            </p>
        </div>
    `;
    wireMGExit();

    // Temporarily redirect scan completion to award XP and return
    if (typeof scanState !== 'undefined') {
        scanState.onComplete = (traits) => {
            // Save updated traits
            if (typeof saveScanTraits === 'function') saveScanTraits(traits);
            // Award small fixed XP
            completeScanReplayXP();
        };
    }

    // Route to correct scan experience
    setTimeout(() => {
        if (gameId === 'scan_signal_breach'      && typeof runSignalBreach === 'function')      runSignalBreach();
        if (gameId === 'scan_precision_shooter'  && typeof runPrecisionShooter === 'function')  runPrecisionShooter();
        if (gameId === 'scan_final_transmission' && typeof runFinalTransmission === 'function') runFinalTransmission();
    }, 400);
}

function completeScanReplayXP() {
    // [TUNING TARGET] Scan replay XP — small, across all stats scan touches
    const replayXP = 3;
    if (player && typeof savePlayer === 'function') {
        ['intelligence', 'agility', 'strength', 'endurance', 'charisma'].forEach(stat => {
            player.stats[stat] = parseFloat(((player.stats[stat] || 10) + replayXP * 0.1).toFixed(2));
        });
        savePlayer();
        if (typeof updateStatusScreen === 'function') updateStatusScreen();
    }
    if (typeof showLog === 'function') {
        showLog('[ SCAN REPLAY LOGGED — CALIBRATION REFINED ]', 'accent');
    }
    setTimeout(() => goBack(), 600);
}