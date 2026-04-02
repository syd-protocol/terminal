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
    cascade: 5, drift: 5, echo: 5, flow: 5, resonance: 5,
    scan_signal_breach: 3, scan_precision_shooter: 3, scan_final_transmission: 3
};

// ─── GRADE SYSTEM ────────────────────────────────────────────
// Seven grades: S/A/B/C/D/E/F
// SIG reward is grade-based, not formula-based.
// Voice lines cycle randomly — 3 per grade.

const GRADE_THRESHOLDS = [
    { grade: 'S', min: 0.85 },
    { grade: 'A', min: 0.70 },
    { grade: 'B', min: 0.55 },
    { grade: 'C', min: 0.40 },
    { grade: 'D', min: 0.25 },
    { grade: 'E', min: 0.10 },
    { grade: 'F', min: 0    }
];

const GRADE_SIG = { S: 8, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };

const GRADE_COLOURS = {
    S: '#ffd54f',
    A: '#80cbc4',
    B: '#4fc3f7',
    C: '#aaaaaa',
    D: '#888888',
    E: '#666666',
    F: '#444444'
};

const GRADE_VOICE_LINES = {
    S: [
        'Signal locked. That is what this system is for.',
        'Clean execution. The pattern held under pressure.',
        'Optimal. The data confirms what the score shows.'
    ],
    A: [
        'Strong read. One tier below peak — the gap is narrow.',
        'Solid. The fundamentals are there. Sharpen the edge.',
        'Above average signal. You know what to work on.'
    ],
    B: [
        'Adequate. Not yet consistent. That changes with reps.',
        'The pattern is forming. Keep going.',
        'Mid-range. The ceiling is visible from here.'
    ],
    C: [
        'Below the line. The session still counted.',
        'You got through it. That is the baseline.',
        'Partial signal. Show up again tomorrow.'
    ],
    D: [
        'The system read the attempt. Not much else yet.',
        'Low signal. The game is telling you something. Listen.',
        'That did not land well. The record is honest.'
    ],
    E: [
        'You played. That is what matters right now.',
        'Rough session. The pattern will click — it takes time.',
        'Not your round. Come back. It gets clearer.'
    ],
    F: [
        "That one didn't land. Every operator has a first run. Come back and the pattern will start to make sense.",
        "Not yet. The game recorded where you struggled. Play it again — it will feel different.",
        'First attempts are data, not verdicts. Try again.'
    ]
};

function getGrade(score) {
    for (const t of GRADE_THRESHOLDS) {
        if (score >= t.min) return t.grade;
    }
    return 'F';
}

function getGradeVoiceLine(grade) {
    const lines = GRADE_VOICE_LINES[grade] || GRADE_VOICE_LINES['F'];
    return lines[Math.floor(Math.random() * lines.length)];
}

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
    strength: 'STR', endurance: 'END', charisma: 'CHA',
    pat: 'PAT', cog: 'COG', per: 'PER',
    spd: 'SPD', acc: 'ACC', pst: 'PST', soc: 'SOC'
};

// ─── GAME METADATA ───────────────────────────────────────────
// Single source of truth for all game display data.
// Block E: expanded with instructions (one-liner + detail lines)
// and first-play SYD prompts.

const SCAN_GAME_IDS = ['scan_signal_breach', 'scan_precision_shooter', 'scan_final_transmission'];

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
    },
    scan_signal_breach: {
        name:        'SIGNAL BREACH',
        icon:        '⬡',
        stats:       ['pat', 'cog', 'per'],
        desc:        'Complete the pattern. Tap the node that connects the sequence.',
        instructions: [
            'A grid of nodes appears. Some are already lit — they form a partial sequence.',
            'Tap the one node that completes the pattern before time runs out.',
            'The rule changes across rounds. That is the point.',
            'Calibrates: pattern recognition, cognitive flexibility, persistence.'
        ],
        firstPlayPrompt: 'SIGNAL BREACH calibrates how you read patterns under pressure. The rule changes mid-game. Stay adaptive.'
    },
    scan_precision_shooter: {
        name:        'PRECISION SHOOTER',
        icon:        '◎',
        stats:       ['spd', 'acc', 'pst'],
        desc:        'Tap targets before they vanish. Speed and accuracy both count.',
        instructions: [
            'Targets appear one at a time on screen. Tap each one before it disappears.',
            'Speed matters. Accuracy matters. Both are being read.',
            'Three waves — each faster than the last.',
            'Calibrates: execution speed, accuracy, pressure stability.'
        ],
        firstPlayPrompt: 'PRECISION SHOOTER measures how fast and clean you execute under increasing pressure. Hit what you aim at.'
    },
    scan_final_transmission: {
        name:        'FINAL TRANSMISSION',
        icon:        '◆',
        stats:       ['soc'],
        desc:        'Read the social situation. Pick what was actually communicated.',
        instructions: [
            'Short social scenarios appear one at a time.',
            'Three response options. Pick the one that reads the subtext correctly.',
            'Not the literal words — what was actually meant.',
            'Calibrates: social reading.'
        ],
        firstPlayPrompt: 'FINAL TRANSMISSION reads how accurately you decode what people actually mean. There is no timer — read carefully.'
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

    const isScanGame = SCAN_GAME_IDS.includes(gameId);

    if (!hasSeenFirstPlay(gameId)) {
        markFirstPlaySeen(gameId);
        if (typeof showScreen === 'function') showScreen('screen-minigame');
        renderFirstPlayPrompt(gameId, gd.firstPlayPrompt || '', () => {
            if (isScanGame) {
                enterScanReplayPaid(gameId, sig);
            } else {
                enterMiniGame(gameId, sig);
            }
        });
    } else {
        if (isScanGame) {
            enterScanReplayPaid(gameId, sig);
        } else {
            enterMiniGame(gameId, sig);
        }
    }
}

// Renders a one-line SYD first-play prompt inside screen-minigame.
// Advances only on player tap — no auto-advance.
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
}

// ─── GAMES HUB (OPS/GAMES SEGMENT) ───────────────────────────
// Called by status.js renderGamesSegment() to render the full GAMES
// section inside the OPS tab. Full card implementation with
// expandable instructions, SIG balance, scan replay link.
// Block A rendered placeholder cards — this is the full version.
function renderGamesHub(container, sig) {
    if (!container) return;

    const sigVal  = typeof sig === 'number' ? sig :
        ((typeof player !== 'undefined' && player) ? (player.sig || 0) : 0);

    const allIds  = ['cascade', 'drift', 'echo', 'flow', 'resonance',
                     'scan_signal_breach', 'scan_precision_shooter', 'scan_final_transmission'];

    container.innerHTML = `
        <div class="games-segment-wrap">

            <div class="games-segment-header">
                <p class="games-syd-line">All games train something. They cost SIG to enter. SIG comes from executing directives.</p>
            </div>

            <div class="games-sig-balance">
                <span class="games-sig-icon">&#x2B21;</span>
                <span class="games-sig-value">${sigVal}</span>
                <span class="games-sig-label">SIG AVAILABLE</span>
            </div>

            <div class="games-list">
                ${allIds.map(id => buildGameCard(id, sigVal)).join('')}
            </div>

        </div>
    `;

    // Wire all ENTER buttons
    allIds.forEach(id => {
        const btn = document.getElementById('games-enter-' + id);
        if (btn && !btn.disabled) {
            btn.addEventListener('click', () => {
                playUIClick();
                openMiniGame(id);
            });
        }
    });

    // Wire instruction expand toggles
    allIds.forEach(id => {
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
}

function buildGameCard(id, sigVal) {
    const gd       = GAME_DATA[id];
    if (!gd) return '';
    const cost      = MINIGAME_COSTS[id] || 5;
    const canEnter  = sigVal >= cost;
    const stats     = (MINIGAME_STATS[id] || []).map(s => `<span class="game-card-stat-tag">${STAT_LABELS[s] || s}</span>`).join('');
    const instrHTML = (gd.instructions || []).map(l => `<p class="game-instr-line">${l}</p>`).join('');

    return `
        <div class="game-card" id="game-card-${id}" data-game-id="${id}">
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

// Paid scan replay — deducts SIG then routes to scan experience
function enterScanReplayPaid(gameId, sig) {
    const cost = MINIGAME_COSTS[gameId] || 3;
    if (player) { player.sig = Math.max(0, (player.sig || 0) - cost); savePlayer(); }
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
// Awards stat XP and shows result screen.
// score: 0–1 float. Grade drives SIG reward and voice line.
function completeMGSession(gameId, score) {
    const baseXP    = MINIGAME_XP[gameId] || 8;
    const finalXP   = Math.max(2, Math.round(baseXP * Math.max(0.1, score)));
    const stats     = MINIGAME_STATS[gameId] || [];
    const xpPerStat = finalXP / (stats.length || 1);
    const grade     = getGrade(score);
    const sigReward = GRADE_SIG[grade] || 1;

    if (player && typeof savePlayer === 'function') {
        stats.forEach(stat => {
            player.stats[stat] = parseFloat(((player.stats[stat] || 10) + xpPerStat * 0.5).toFixed(2));
        });
        player.sig = (player.sig || 0) + sigReward;
        savePlayer();
        if (typeof updateStatusScreen === 'function') updateStatusScreen();
    }

    renderMGResult(gameId, score, finalXP, sigReward, stats, grade);
}

function renderMGResult(gameId, score, xp, sig, stats, grade) {
    const container = getMGContainer();
    if (!container) return;

    // Resolve grade if not passed (backward compat)
    if (!grade) grade = getGrade(score);

    const gradeColour = GRADE_COLOURS[grade] || '#aaaaaa';
    const voiceLine   = getGradeVoiceLine(grade);
    const gameNames   = {
        cascade: 'CASCADE', drift: 'DRIFT', echo: 'ECHO',
        flow: 'FLOW', resonance: 'RESONANCE',
        scan_signal_breach: 'SIGNAL BREACH',
        scan_precision_shooter: 'PRECISION SHOOTER',
        scan_final_transmission: 'FINAL TRANSMISSION'
    };

    container.innerHTML = `
        <div class="mg-result-wrap">
            <div class="mg-result-grade mg-result-grade--animate" id="mg-result-grade" style="color:${gradeColour}">${grade}</div>
            <p class="mg-result-name">[ ${gameNames[gameId] || gameId.toUpperCase()} COMPLETE ]</p>
            <p class="mg-result-voice">${voiceLine}</p>
            <div class="mg-result-rewards mg-result-rewards--slide" id="mg-result-rewards">
                <div class="mg-result-row">
                    <span class="mg-result-label">GRADE</span>
                    <span class="mg-result-val" style="color:${gradeColour}">${grade}</span>
                </div>
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

    // Grade S/A get ascending tones, lower grades get a single muted tone
    if (grade === 'S') {
        [330, 440, 550, 660, 880].forEach((n, i) => setTimeout(() => playTone(n, 0.15, 'sine', 0.12), i * 70));
    } else if (grade === 'A') {
        playTone(440, 0.1, 'sine', 0.1);
        setTimeout(() => playTone(660, 0.12, 'sine', 0.1), 90);
    } else if (grade === 'B') {
        playTone(440, 0.08, 'square', 0.08);
        setTimeout(() => playTone(550, 0.1, 'square', 0.07), 90);
    } else {
        playTone(330, 0.1, 'square', 0.06);
    }

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
const CASCADE_FALL_MS      = [3500, 2600, 1900]; // ms to fall full height per wave — slowed for enjoyment
const CASCADE_INTERVAL_MS  = [1400, 1000,  700]; // ms between node spawns per wave

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
                <div class="cas-score-row">
                    <span class="cas-score-label">PAIRS</span>
                    <span class="cas-score" id="cas-score">0 / 0</span>
                    <span class="cas-wave-inline" id="cas-wave-label">WAVE 1 / ${CASCADE_WAVES}</span>
                </div>
                <div class="cas-cols" id="cas-cols">
                    ${[0,1,2,3].map(i => '<div class="cas-col" id="cas-col-' + i + '"></div>').join('')}
                </div>
                <div class="cas-held-slot" id="cas-held-slot">
                    <span class="cas-held-label">HOLDING</span>
                    <span class="cas-held-symbol" id="cas-held-symbol">—</span>
                </div>
            </div>
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
            playTone(660, 0.15, 'square', 0.12);
            setTimeout(() => playTone(880, 0.12, 'square', 0.1), 80);
            spawnFloatScore(node);
            flashNodeClear(cascadeState.held.el);
            flashNodeClear(node);
            cascadeState.held = null;
            const heldEl = document.getElementById('cas-held-symbol');
            if (heldEl) heldEl.textContent = '—';
            // Update score display
            const scoreEl = document.getElementById('cas-score');
            if (scoreEl) scoreEl.textContent = cascadeState.clearedPairs + ' / ' + cascadeState.totalPairs;
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
    el.classList.add('cas-node--burst');
    setTimeout(() => el.remove(), 400);
}

function spawnFloatScore(referenceEl) {
    if (!referenceEl) return;
    const rect    = referenceEl.getBoundingClientRect();
    const arena   = document.getElementById('cas-arena');
    if (!arena) return;
    const aRect   = arena.getBoundingClientRect();
    const floater = document.createElement('div');
    floater.className   = 'cas-float-score';
    floater.textContent = '+1';
    floater.style.left  = (rect.left - aRect.left + rect.width / 2) + 'px';
    floater.style.top   = (rect.top  - aRect.top) + 'px';
    arena.appendChild(floater);
    setTimeout(() => floater.remove(), 800);
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
const DRIFT_ROUNDS          = 3;
const DRIFT_ZONES_PER_ROUND = [6, 7, 8];    // zones per round — more to tap
const DRIFT_SPEED           = [0.6, 0.9, 1.3];  // multiplier on base speed — gentler ramp
const DRIFT_ZONE_RADIUS     = [0.22, 0.16, 0.10]; // zone radius as fraction of canvas width
const DRIFT_DOT_RADIUS      = 14;           // dot radius in px
const DRIFT_ROUND_DURATION  = 6000;         // ms per round (base, before speed multiplier)

let driftState = null;

function runDrift() {
    const container = getMGContainer();
    if (!container) return;

    driftState = {
        round: 0, zonesHit: 0, totalZones: 0,
        tapCount: 0, rafId: null,
        ripples: [],   // active hit ripples for canvas drawing
        _onTap: null
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
        canvas.height = canvas.offsetHeight || 380;
        canvas.addEventListener('click',      () => onDriftTap());
        canvas.addEventListener('touchstart', () => onDriftTap(), { passive: true });
    }

    startDriftRound();
}

function driftPathPoint(t, W, H) {
    // Vertical snake: dot travels downward, curving left and right.
    // t goes 0→1 across the full round duration.
    // y increases linearly; x oscillates sinusoidally.
    const segments = 4; // number of S-curves
    const y = t * H;
    const x = W / 2 + Math.sin(t * Math.PI * segments) * (W * 0.38);
    return { x, y };
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

    const ctx         = canvas.getContext('2d');
    const W           = canvas.width;
    const H           = canvas.height;
    const speed       = DRIFT_SPEED[w];
    const zoneCount   = DRIFT_ZONES_PER_ROUND[w];
    const zoneRad     = DRIFT_ZONE_RADIUS[w] * W;
    const roundDur    = DRIFT_ROUND_DURATION / speed;

    // Spread zones evenly across the path (t values)
    driftState.totalZones += zoneCount;
    const zones = [];
    for (let i = 0; i < zoneCount; i++) {
        const t = 0.08 + (i / (zoneCount - 1 || 1)) * 0.84;
        const pt = driftPathPoint(t, W, H);
        zones.push({ t, x: pt.x, y: pt.y, hit: false, rippleAge: 0 });
    }
    driftState._zones  = zones;
    driftState._getT   = () => Math.min(1, elapsed / DRIFT_ROUND_DURATION);
    driftState._W      = W;
    driftState._H      = H;

    let elapsed = 0;
    let last    = null;

    function frame(now) {
        if (!last) last = now;
        const dt = (now - last) * speed;
        elapsed += dt;
        last = now;

        const t   = Math.min(1, elapsed / DRIFT_ROUND_DURATION);
        const pos = driftPathPoint(t, W, H);

        ctx.clearRect(0, 0, W, H);

        // Draw full snake path (faint guide)
        ctx.strokeStyle = 'rgba(255,167,38,0.25)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
            const pt = i / 120;
            const p  = driftPathPoint(pt, W, H);
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Draw zones
        zones.forEach(zone => {
            if (zone.hit) {
                // Expanding ripple on hit
                zone.rippleAge += dt;
                const rippleR = zoneRad + zone.rippleAge * 0.08;
                const alpha   = Math.max(0, 0.6 - zone.rippleAge * 0.003);
                ctx.strokeStyle = `rgba(102,187,106,${alpha})`;
                ctx.lineWidth   = 2;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, rippleR, 0, Math.PI * 2);
                ctx.stroke();
                // Solid green fill (fading)
                ctx.fillStyle = `rgba(102,187,106,${alpha * 0.4})`;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zoneRad * 0.7, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Idle zone — amber circle
                const pulse = 0.25 + 0.1 * Math.sin(now / 400);
                ctx.fillStyle = `rgba(255,167,38,${pulse})`;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zoneRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,167,38,0.7)';
                ctx.lineWidth   = 1.5;
                ctx.stroke();
            }
        });

        // Draw dot with amber glow
        ctx.shadowColor = 'rgba(255,167,38,0.8)';
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = '#ffa726';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, DRIFT_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (t < 1) {
            driftState.rafId = requestAnimationFrame(frame);
        } else {
            advanceDriftRound();
        }
    }

    driftState.rafId = requestAnimationFrame(frame);

    // _getT and _zones are already set above — closure gives live elapsed value

    window._mgCleanup = () => cancelAnimationFrame(driftState.rafId);
}

function onDriftTap() {
    if (!driftState || !driftState._getT || !driftState._zones) return;
    driftState.tapCount++;
    const t     = driftState._getT();
    const w     = driftState.round;
    const zones = driftState._zones;
    zones.forEach(zone => {
        if (zone.hit) return;
        if (Math.abs(t - zone.t) <= DRIFT_ZONE_RADIUS[w] * 0.9) {
            zone.hit       = true;
            zone.rippleAge = 0;
            driftState.zonesHit++;
            playTone(880, 0.12, 'sine', 0.1);
        }
    });
}

function advanceDriftRound() {
    cancelAnimationFrame(driftState.rafId);
    driftState.round++;
    if (driftState.round >= DRIFT_ROUNDS) {
        const rawScore  = driftState.totalZones > 0 ? driftState.zonesHit / driftState.totalZones : 0;
        const precision = driftState.tapCount > 0
            ? Math.min(1, (driftState.zonesHit * 2) / driftState.tapCount)
            : rawScore;
        const score = (rawScore * 0.7 + precision * 0.3);
        completeMGSession('drift', Math.min(1, score));
    } else {
        setTimeout(() => startDriftRound(), 700);
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

    const ECHO_SYMBOLS = ['⬡', '◎', '◈', '▣'];

    container.innerHTML =
        renderMGHeader('ECHO', ['intelligence', 'strength']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction" id="echo-instruction">
                Watch SYD's sequence. Repeat it exactly.
            </p>
            <div class="echo-progress-dots" id="echo-progress-dots"></div>
            <div class="echo-grid" id="echo-grid">
                ${[0,1,2,3].map(i => `
                    <button class="echo-node" id="echo-node-${i}" data-idx="${i}" disabled>
                        <span class="echo-node-symbol">${ECHO_SYMBOLS[i]}</span>
                    </button>
                `).join('')}
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
    updateEchoProgressDots(0, seq.length);

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

function updateEchoProgressDots(filled, total) {
    const el = document.getElementById('echo-progress-dots');
    if (!el) return;
    el.innerHTML = Array.from({ length: total }, (_, i) =>
        `<span class="echo-dot ${i < filled ? 'echo-dot--filled' : ''}">${i < filled ? '●' : '○'}</span>`
    ).join('');
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
        updateEchoProgressDots(echoState.inputIdx, echoState.sequence.length);
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
        if (nodeEl) { nodeEl.classList.add('echo-node--wrong', 'echo-node--shake'); }
        if (fb) { fb.textContent = '[ SEQUENCE BROKEN ]'; }
        playTone(180, 0.1, 'sawtooth', 0.07);
        setTimeout(() => {
            if (nodeEl) nodeEl.classList.remove('echo-node--wrong', 'echo-node--shake');
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
// GAME 4 — FLOW  (Strength + Endurance) — REDESIGNED
//
// A glowing ball moves horizontally across the canvas, bouncing
// vertically via sine wave. A vertical zone band is marked on the
// canvas. The ball wraps from right edge back to left.
// Player taps when the ball is inside the zone.
// Three intervals — zone shifts position and narrows each round.
// Score = correct taps / total windows.
// ═══════════════════════════════════════════════════════════════

// [TUNING TARGET] Flow rhythm constants
const FLOW_INTERVALS       = 3;
const FLOW_INTERVAL_MS     = 9000;    // ms per interval
const FLOW_BALL_SPEED      = 0.00012; // horizontal fraction per ms (wraps at 1.0)
const FLOW_BOUNCE_FREQ     = 2.8;     // sine frequency for vertical bounce
const FLOW_TRAIL_LENGTH    = 8;       // number of trail positions
const FLOW_ZONE_POSITIONS  = [0.35, 0.60, 0.50]; // zone centre x as fraction of width
const FLOW_ZONE_WIDTHS     = [0.22, 0.16, 0.11]; // zone width as fraction of width
const FLOW_TAP_WINDOW      = 0.5;     // seconds — how long a "window" lasts after ball enters zone
const FLOW_WINDOWS_PER_INT = 4;       // windows available per interval

let flowState = null;

function runFlow() {
    const container = getMGContainer();
    if (!container) return;

    flowState = {
        interval:    0,
        ballX:       0.0,      // 0→1 horizontal position
        trail:       [],       // last N positions [{x,y}]
        hits:        0,
        totalWindows: 0,
        inWindow:    false,
        windowTapped: false,
        rafId:       null,
        beatTimer:   null,
        elapsed:     0
    };

    container.innerHTML =
        renderMGHeader('FLOW', ['strength', 'endurance']) + `
        <div class="mg-game-body">
            <p class="mg-game-instruction" id="flow-instruction">
                Tap when the ball passes through the zone.
            </p>
            <canvas id="flow-canvas" class="flow-canvas"></canvas>
            <button class="flow-tap-btn flow-tap-btn--wide" id="flow-tap-btn">TAP</button>
            <div class="mg-wave-label" id="flow-interval-label">INTERVAL 1 / ${FLOW_INTERVALS}</div>
        </div>
    `;
    wireMGExit();

    const tapBtn = document.getElementById('flow-tap-btn');
    if (tapBtn) {
        tapBtn.addEventListener('click',      () => onFlowTap());
        tapBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onFlowTap(); }, { passive: false });
    }

    const canvas = document.getElementById('flow-canvas');
    if (canvas) {
        canvas.width  = canvas.offsetWidth  || 320;
        canvas.height = canvas.offsetHeight || 180;
    }

    startFlowInterval();
    playFlowBeat();
}

function playFlowBeat() {
    if (!flowState) return;
    // Low rhythmic pulse matching the ball's horizontal cycle
    playTone(110, 0.4, 'sine', 0.035);
    // Schedule next beat aligned to ball wrap cycle
    const cycleMs = 1000 / FLOW_BALL_SPEED;
    flowState.beatTimer = setTimeout(playFlowBeat, cycleMs * 0.5);
}

function startFlowInterval() {
    const iv     = flowState.interval;
    const label  = document.getElementById('flow-interval-label');
    const instr  = document.getElementById('flow-instruction');
    if (label) label.textContent = 'INTERVAL ' + (iv + 1) + ' / ' + FLOW_INTERVALS;
    if (instr && iv === 1) instr.textContent = '[ ZONE SHIFTING — STAY WITH IT ]';
    if (instr && iv === 2) instr.textContent = '[ FINAL INTERVAL — FIND THE RHYTHM ]';

    flowState.ballX        = 0;
    flowState.trail        = [];
    flowState.inWindow     = false;
    flowState.windowTapped = false;
    flowState.totalWindows += FLOW_WINDOWS_PER_INT;

    const canvas = document.getElementById('flow-canvas');
    if (!canvas) { advanceFlowInterval(); return; }
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    const zoneCentreX = FLOW_ZONE_POSITIONS[iv] * W;
    const zoneHalfW   = FLOW_ZONE_WIDTHS[iv] * W / 2;
    const zoneLeft    = zoneCentreX - zoneHalfW;
    const zoneRight   = zoneCentreX + zoneHalfW;

    // Track which pass through the zone we're on for window counting
    let windowsThisInterval = 0;
    let wasInZone = false;
    let elapsed   = 0;
    let last      = null;

    function frame(now) {
        if (!last) last = now;
        const dt = now - last;
        last     = now;
        elapsed += dt;

        // Advance ball horizontally, wrapping at 1.0
        flowState.ballX = (flowState.ballX + FLOW_BALL_SPEED * dt) % 1.0;

        // Ball vertical position — sine bounce
        const ballXpx  = flowState.ballX * W;
        const ballYpx  = H / 2 + Math.sin(flowState.ballX * Math.PI * 2 * FLOW_BOUNCE_FREQ) * (H * 0.35);

        // Update trail
        flowState.trail.push({ x: ballXpx, y: ballYpx });
        if (flowState.trail.length > FLOW_TRAIL_LENGTH) flowState.trail.shift();

        // Zone detection
        const nowInZone = ballXpx >= zoneLeft && ballXpx <= zoneRight;

        // New entry into zone = new window
        if (nowInZone && !wasInZone && windowsThisInterval < FLOW_WINDOWS_PER_INT) {
            windowsThisInterval++;
            flowState.inWindow     = true;
            flowState.windowTapped = false;
            // Soft cue — ball entering zone
            playTone(330, 0.06, 'sine', 0.04);
        }
        if (!nowInZone && wasInZone) {
            flowState.inWindow = false;
        }
        wasInZone = nowInZone;

        // Draw
        ctx.clearRect(0, 0, W, H);

        // Zone band
        const zoneAlpha = nowInZone ? 0.35 : 0.18;
        ctx.fillStyle   = `rgba(102,187,106,${zoneAlpha})`;
        ctx.fillRect(zoneLeft, 0, zoneHalfW * 2, H);
        ctx.strokeStyle = `rgba(102,187,106,${nowInZone ? 0.9 : 0.45})`;
        ctx.lineWidth   = nowInZone ? 2 : 1;
        ctx.strokeRect(zoneLeft, 0, zoneHalfW * 2, H);

        // Trail (glow tail)
        flowState.trail.forEach((pt, i) => {
            const alpha = (i / flowState.trail.length) * 0.5;
            const r     = 4 + (i / flowState.trail.length) * 6;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#66bb6a';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Ball
        ctx.shadowColor = 'rgba(102,187,106,0.9)';
        ctx.shadowBlur  = 16;
        ctx.fillStyle   = '#66bb6a';
        ctx.beginPath();
        ctx.arc(ballXpx, ballYpx, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Tap button pulse when in window
        const tapBtn = document.getElementById('flow-tap-btn');
        if (tapBtn) {
            tapBtn.classList.toggle('flow-tap-btn--pulse', nowInZone && !flowState.windowTapped);
        }

        if (elapsed < FLOW_INTERVAL_MS) {
            flowState.rafId = requestAnimationFrame(frame);
        } else {
            advanceFlowInterval();
        }
    }

    flowState.rafId = requestAnimationFrame(frame);
    window._mgCleanup = () => {
        cancelAnimationFrame(flowState.rafId);
        if (flowState.beatTimer) clearTimeout(flowState.beatTimer);
    };
}

function onFlowTap() {
    if (!flowState) return;
    if (flowState.inWindow && !flowState.windowTapped) {
        flowState.hits++;
        flowState.windowTapped = true;
        // Musical correct tap — C5
        playTone(523, 0.15, 'sine', 0.12);
        // Visual feedback on tap button
        const tapBtn = document.getElementById('flow-tap-btn');
        if (tapBtn) {
            tapBtn.classList.add('flow-tap-btn--hit');
            setTimeout(() => tapBtn.classList.remove('flow-tap-btn--hit'), 200);
        }
    } else {
        // Miss tap — soft penalty tone
        playTone(220, 0.06, 'sine', 0.04);
    }
}

function advanceFlowInterval() {
    cancelAnimationFrame(flowState.rafId);
    if (flowState.beatTimer) { clearTimeout(flowState.beatTimer); flowState.beatTimer = null; }
    flowState.interval++;
    if (flowState.interval >= FLOW_INTERVALS) {
        const score = flowState.totalWindows > 0
            ? flowState.hits / flowState.totalWindows
            : 0;
        completeMGSession('flow', score);
    } else {
        setTimeout(() => {
            startFlowInterval();
            playFlowBeat();
        }, 600);
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
            btn.textContent = '✓ ' + btn.textContent;
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