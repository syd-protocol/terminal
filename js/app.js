// ═══════════════════════════════════════════════════════════════
// SYD GES — app.js
// Core engine. Refactored from Terminal for the Gamified Evolution System.
//
// PASS 1 changes:
//   - showScreen('screen-status') after relaunch → land on STATUS tab
//   - switchStatusTab calls updated from 'operative'/'stats' → 'status'
//   - Morning transmission dismiss → STATUS tab (not directives)
//   - First transmission dismiss → DIRECTIVES tab (first time only)
//   - Sound toggle button wiring updated (button now in SETTINGS tab)
//   - Header sig badge removed from updateStatusScreen()
//
// PASS 2 changes:
//   - startScan() now routes to renderScanReveal() after scan completes
//     instead of going straight to PATH Protocol
//   - renderScanReveal() — post-scan trait reveal screen
//   - renderNeuralKeyRequest() — one-time neural key screen in onboarding
//     (skipped if key already set via hasNeuralLink())
//   - startPATH() → after runPathSynthesis completes, shows synthesis
//     reveal screen before createPlayer()
//   - renderSynthesisReveal() — post-PATH synthesis reveal screen
//   - renderOrientationScreen() — app orientation screen before first tx
//   - runFirstTransmission() button updated: [ VIEW MY DIRECTIVES ]
//     routes to DIRECTIVES tab
// ═══════════════════════════════════════════════════════════════

// ─── STORAGE KEYS ────────────────────────────────────────────
const STORAGE_KEY         = 'syd_player';
const GEAR_KEY            = 'syd_gear';
const SYNC_OPTED_IN_KEY   = 'syd_sync_opted_in';
const SYNC_LAST_PUSH_KEY  = 'syd_sync_last_push';
const SYNC_COOLDOWN_MS    = 30 * 60 * 1000;
const NEURAL_KEY_KEY      = 'syd_neural_key';
const NEURAL_PROVIDER_KEY = 'syd_neural_provider';
const FIELD_NOTES_KEY     = 'syd_field_notes';
const AUDIO_MINUTES_KEY   = 'syd_audio_minutes';

// ─── FIREBASE ────────────────────────────────────────────────
const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyAkuEPtCAc5YWRgb08zClJwnr9IXlrN5nE',
    authDomain:        'syd-protocol.firebaseapp.com',
    projectId:         'syd-protocol',
    storageBucket:     'syd-protocol.firebasestorage.app',
    messagingSenderId: '6170479356',
    appId:             '1:6170479356:web:1f1127ba7c77f87a2ce579'
};

let db = null;
function getDB() {
    if (db) return db;
    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
    } catch(e) {
        console.warn('[SYD] Firebase unavailable:', e);
    }
    return db;
}

// ─── STAT DEFINITIONS ────────────────────────────────────────
const STAT_NAMES = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
const STAT_FLOOR = 10;

// [TUNING TARGET] Soft cap per level
const STAT_GROWTH_RATE = 2;

// ─── KEYWORD CLASSIFICATION ───────────────────────────────────
const STAT_KEYWORDS = {
    strength:     ['fitness','gym','health','weight','run','walk','exercise','body','eat','sleep','energy','strong','physical','diet','training','workout','sport'],
    intelligence: ['learn','study','read','skill','career','business','build','create','write','code','design','knowledge','degree','course','research','understand','develop'],
    agility:      ['adapt','change','flexible','anxiety','stress','fear','habit','routine','comfort','new','risk','decision','pivot','challenge','difficult'],
    endurance:    ['finish','complete','consistent','discipline','focus','distraction','procrastin','motivation','persist','follow','through','commit','goal','long','project','task'],
    charisma:     ['relationship','social','friend','network','communicate','speak','influence','connect','people','family','date','love','confident','presence','leader']
};

function classifyGoal(text) {
    const lower  = (text || '').toLowerCase();
    const counts = {};
    Object.keys(STAT_KEYWORDS).forEach(stat => {
        counts[stat] = STAT_KEYWORDS[stat].filter(kw => lower.includes(kw)).length;
    });
    const order  = ['strength', 'intelligence', 'endurance', 'agility', 'charisma'];
    const sorted = order.slice().sort((a, b) => counts[b] - counts[a]);
    return {
        primaryStat: sorted[0],
        linkedStats: [sorted[1], sorted[2]].filter(s => counts[s] > 0 || true)
    };
}

// ─── XP + LEVEL FORMULA ──────────────────────────────────────
function xpForLevel(n) {
    if (n <= 1) return 0;
    return Math.floor(25 * Math.pow(n - 1, 1.9));
}
function levelFromXP(xp) {
    let level = 1;
    while (xp >= xpForLevel(level + 1)) level++;
    return level;
}
function earnedXP(stats) {
    return STAT_NAMES.reduce((sum, s) => sum + Math.max(0, (stats[s] || 0) - STAT_FLOOR), 0);
}

// ─── RANK SYSTEM ─────────────────────────────────────────────
const RANKS = [
    { label: 'F',   minLevel: 1   }, { label: 'E',   minLevel: 16  },
    { label: 'D',   minLevel: 31  }, { label: 'C',   minLevel: 46  },
    { label: 'B',   minLevel: 61  }, { label: 'A',   minLevel: 76  },
    { label: 'S',   minLevel: 91  }, { label: 'S+',  minLevel: 101 },
    { label: 'SS',  minLevel: 121 }, { label: 'SS+', minLevel: 151 },
    { label: 'SSS', minLevel: 200 }
];
function rankFromLevel(level) {
    let rank = RANKS[0];
    for (const r of RANKS) { if (level >= r.minLevel) rank = r; }
    return rank.label;
}
function rankCssClass(rank) {
    const m = {
        'F':'rank-f', 'E':'rank-e', 'D':'rank-d', 'C':'rank-c', 'B':'rank-b', 'A':'rank-a',
        'S':'rank-s', 'S+':'rank-s', 'SS':'rank-s', 'SS+':'rank-s', 'SSS':'rank-s'
    };
    return m[rank] || 'rank-f';
}

// ─── TITLE SYSTEM ────────────────────────────────────────────
const TITLES = [
    { minLevel: 1,   label: 'THE BEGINNER'     }, { minLevel: 6,   label: 'THE MOTIVATED'    },
    { minLevel: 11,  label: 'THE CONSISTENT'   }, { minLevel: 16,  label: 'THE DEVELOPING'   },
    { minLevel: 21,  label: 'THE EMERGING'     }, { minLevel: 26,  label: 'THE GROUNDED'     },
    { minLevel: 31,  label: 'THE CAPABLE'      }, { minLevel: 36,  label: 'THE RELIABLE'     },
    { minLevel: 41,  label: 'THE FOCUSED'      }, { minLevel: 46,  label: 'THE DISCIPLINED'  },
    { minLevel: 51,  label: 'THE SKILLED'      }, { minLevel: 56,  label: 'THE ACCOMPLISHED' },
    { minLevel: 61,  label: 'THE EXCEPTIONAL'  }, { minLevel: 66,  label: 'THE RESPECTED'    },
    { minLevel: 71,  label: 'THE INFLUENTIAL'  }, { minLevel: 76,  label: 'THE ELITE'        },
    { minLevel: 81,  label: 'THE MASTERFUL'    }, { minLevel: 86,  label: 'THE RENOWNED'     },
    { minLevel: 91,  label: 'THE AWAKENED'     }, { minLevel: 96,  label: 'THE TRANSCENDENT' },
    { minLevel: 101, label: 'THE LEGEND'       }, { minLevel: 151, label: 'THE MYTH'         },
    { minLevel: 200, label: 'THE ETERNAL'      }
];
function titleFromLevel(level) {
    let title = TITLES[0];
    for (const t of TITLES) { if (level >= t.minLevel) title = t; }
    return title.label;
}

// ─── MOMENTUM ────────────────────────────────────────────────
function buildMomentum(consecutiveDays) {
    return parseFloat((1 + 0.5 * (1 - Math.exp(-consecutiveDays / 14))).toFixed(4));
}
function decayMomentum(current, missedDays) {
    if (missedDays <= 0) return current;
    if (missedDays === 1) return parseFloat((current * 0.95).toFixed(4));
    if (missedDays === 2) return parseFloat((current * 0.85).toFixed(4));
    if (missedDays === 3) return parseFloat((current * 0.75).toFixed(4));
    let m = current;
    for (let i = 0; i < missedDays - 3; i++) m = Math.max(1.0, m * 0.80);
    return parseFloat(m.toFixed(4));
}

// ─── CAPACITY ────────────────────────────────────────────────
function calcMaxCapacity(level) { return 100 + level * 5; }

function applyCapacityDecay(player, missedDays) {
    const maxCap = player.maxCapacity || calcMaxCapacity(calculateLevel ? calculateLevel() : 1);
    if (missedDays === 1) player.capacity = Math.max(0, (player.capacity ?? maxCap) - 5);
    else if (missedDays === 2) player.capacity = Math.max(0, (player.capacity ?? maxCap) - 12);
    else if (missedDays === 3) player.capacity = Math.max(0, (player.capacity ?? maxCap) - 22);
    else player.capacity = Math.max(0, (player.capacity ?? maxCap) - 35);
}

// ─── SOUND SYSTEM ────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx    = null;
let soundEnabled = true;

function getAudioCtx() { if (!audioCtx) audioCtx = new AudioCtx(); return audioCtx; }

function playTone(frequency, duration, type, volume) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type            = type || 'sine';
        osc.frequency.value = frequency;
        g.gain.setValueAtTime(volume || 0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

function playUIClick()       { playTone(880, 0.04, 'square', 0.08); }
function playQuestComplete() { playTone(440, 0.07, 'square', 0.12); setTimeout(() => playTone(660, 0.1, 'square', 0.1), 90); }
function playLevelUp()       { [330, 440, 550, 660].forEach((n, i) => setTimeout(() => playTone(n, 0.18, 'sawtooth', 0.15), i * 90)); }
function playRankUp()        { [220, 330, 440, 660, 880].forEach((n, i) => setTimeout(() => playTone(n, 0.2, 'sawtooth', 0.18), i * 80)); }

function loadSoundState()  { return localStorage.getItem('syd_sound') !== 'off'; }
function applySoundState(s) { soundEnabled = s; }
function cycleSoundState() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('syd_sound', soundEnabled ? 'on' : 'off');
    if (soundEnabled) playUIClick();
}

// ─── AUDIO ACCUMULATION ──────────────────────────────────────
const AUDIO_FADE_START_MINUTES = 20;
const AUDIO_FADE_END_MINUTES   = 40;

function getAudioMinutes()   { return parseFloat(localStorage.getItem(AUDIO_MINUTES_KEY) || '0'); }
function saveAudioMinutes(m) { localStorage.setItem(AUDIO_MINUTES_KEY, m.toFixed(2)); }
function getAudioGainMultiplier() {
    const m = getAudioMinutes();
    if (m < AUDIO_FADE_START_MINUTES) return 1.0;
    if (m > AUDIO_FADE_END_MINUTES)   return 0.0;
    return 1.0 - (m - AUDIO_FADE_START_MINUTES) / (AUDIO_FADE_END_MINUTES - AUDIO_FADE_START_MINUTES);
}
let audioAccumulationTimer = null;
function accumulateAudioMinutes() {
    if (audioAccumulationTimer) return;
    audioAccumulationTimer = setInterval(() => {
        saveAudioMinutes(getAudioMinutes() + (1 / 60));
    }, 1000);
}

// ─── AMBIENT AUDIO ───────────────────────────────────────────
let ambientOsc = null; let ambientGain = null;
function startStatusAmbient() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        ambientOsc  = ctx.createOscillator(); ambientGain = ctx.createGain();
        ambientOsc.connect(ambientGain); ambientGain.connect(ctx.destination);
        ambientOsc.type            = 'sine';
        ambientOsc.frequency.value = 110;
        const mult = getAudioGainMultiplier();
        ambientGain.gain.setValueAtTime(0, ctx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(0.03 * mult, ctx.currentTime + 2);
        ambientOsc.start();
        accumulateAudioMinutes();
    } catch(e) {}
}
function stopStatusAmbient() {
    if (!ambientOsc) return;
    try {
        const ctx = getAudioCtx();
        ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        ambientOsc.stop(ctx.currentTime + 0.6);
    } catch(e) {}
    ambientOsc = null; ambientGain = null;
    if (audioAccumulationTimer) { clearInterval(audioAccumulationTimer); audioAccumulationTimer = null; }
}

// ─── PLAYER STATE ────────────────────────────────────────────
let player      = null;
let dailyQuests = [];
let allQuests   = [];
let currentGear = 1;

// ─── PLAYER MANAGEMENT ───────────────────────────────────────
function loadPlayer() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);

    // Migration: gold → sig
    if (typeof p.gold === 'number' && typeof p.sig === 'undefined') {
        p.sig  = p.gold;
        delete p.gold;
    }
    if (typeof p.sig !== 'number') p.sig = 0;

    // Migration: HP → Capacity
    if (typeof p.hp === 'number' && typeof p.capacity === 'undefined') {
        p.capacity    = p.hp;
        p.maxCapacity = p.maxHp || calcMaxCapacity(1);
        delete p.hp;
        delete p.maxHp;
        delete p.corrupted;
    }
    if (typeof p.capacity === 'undefined') {
        const lvl     = levelFromXP(Math.max(0, earnedXP(p.stats || {})));
        p.maxCapacity = calcMaxCapacity(lvl);
        p.capacity    = p.maxCapacity;
    }

    if (typeof p.operatorDays === 'undefined') p.operatorDays = 999;
    if (typeof p.pathComplete === 'undefined') p.pathComplete = true;
    if (typeof p.scanComplete === 'undefined') p.scanComplete = true;

    return p;
}

function savePlayer() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}

function createPlayer(name, scanTraits, pathData) {
    console.log('[SYD] createPlayer:', name);
    const stats = {};
    STAT_NAMES.forEach(s => { stats[s] = STAT_FLOOR; });

    if (scanTraits && typeof seedStatsFromTraits === 'function') {
        const scanSeeds = seedStatsFromTraits(scanTraits);
        STAT_NAMES.forEach(s => {
            stats[s] = STAT_FLOOR + (scanSeeds[s] || 0);
        });
    }

    if (pathData && pathData.statSeeds) {
        STAT_NAMES.forEach(s => {
            stats[s] = (stats[s] || STAT_FLOOR) + (pathData.statSeeds[s] || 0);
        });
    }

    const maxCapacity = calcMaxCapacity(1);

    player = {
        name,
        stats,
        completedToday:  [],
        lastQuestDate:   today(),
        consecutiveDays: 1,
        operatorDays:    1,
        momentum:        1.0,
        lastActiveDate:  today(),
        capacity:        maxCapacity,
        maxCapacity,
        sig:             0,
        scanComplete:    true,
        pathComplete:    !!pathData,
        pathData:        pathData || null,
        hasSeenBriefing: false
    };

    if (pathData && typeof savePathData === 'function') {
        savePathData(pathData);
    }

    savePlayer();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear(), player.operatorDays);
    updateStatusScreen();
    // PASS 2: Route through orientation before first transmission
    showScreen('screen-status');
    // activeStatusTab is set to 'directives' after first transmission dismiss
    // so the landing here is fine — it will be set to status, then first tx shows,
    // then dismiss routes to directives.
    // Force status tab as default during creation (first tx will switch to directives on dismiss)
    if (typeof switchStatusTab === 'function') switchStatusTab('status');
    runFirstTransmission();
}

function effectiveGear() {
    return currentGear;
}

function calculateLevel() { return levelFromXP(Math.max(0, earnedXP(player.stats))); }
function calculateLuck()  {
    return parseFloat(
        (STAT_NAMES.reduce((s, n) => s + (player.stats[n] || STAT_FLOOR), 0) / STAT_NAMES.length).toFixed(1)
    );
}

// ─── FIRST TRANSMISSION ──────────────────────────────────────
// Fires once on first ever launch, after onboarding completes.
// PASS 1: Button now says [ VIEW MY DIRECTIVES ] and routes to DIRECTIVES tab.
const FIRST_TX_LINES = [
    'THIS IS YOUR TERMINAL.',
    'YOUR STATS ARE CONSEQUENCES OF YOUR REAL-WORLD ACTIONS — NOT SCORES.',
    'COMPLETE TODAY\'S DIRECTIVES AND THEY RISE.',
    'MOMENTUM TRACKS CONSISTENCY. CONSECUTIVE DAYS COMPOUND IT.',
    'SIG IS EARNED THROUGH EXECUTION. SPEND IT IN THE TRAINING FLOOR.',
    '[ DIRECTIVES HAVE BEEN ISSUED. ]'
];

function runFirstTransmission() {
    if (!player || player.hasSeenBriefing) return;
    const overlay = document.getElementById('overlay-briefing');
    const linesEl = document.getElementById('briefing-lines');
    const btn     = document.getElementById('briefing-directives-btn');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    linesEl.innerHTML = '';
    btn.classList.add('hidden');

    let idx = 0;
    function nextLine() {
        if (idx >= FIRST_TX_LINES.length) {
            setTimeout(() => {
                btn.classList.remove('hidden');
                requestAnimationFrame(() => requestAnimationFrame(() => btn.classList.add('briefing-btn--visible')));
            }, 400);
            return;
        }
        const el = document.createElement('div');
        el.className = 'briefing-line';
        if (idx === FIRST_TX_LINES.length - 1) el.classList.add('briefing-line--highlight');
        el.textContent = FIRST_TX_LINES[idx];
        linesEl.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('briefing-line--visible')));
        idx++;
        setTimeout(nextLine, 1000);
    }

    // PASS 1: dismiss routes to DIRECTIVES tab (first time only)
    btn.onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
        player.hasSeenBriefing = true;
        savePlayer();
        // Land on DIRECTIVES for first time — they need to see their directives
        if (typeof switchStatusTab === 'function') switchStatusTab('directives');
    };

    nextLine();
}

// ─── DAILY RESET ─────────────────────────────────────────────
function checkDailyReset() {
    const todayStr  = today();
    const lastDate  = player.lastQuestDate;
    if (!lastDate || lastDate === todayStr) return;

    const diffMs   = new Date(todayStr) - new Date(lastDate);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 1) {
        player.consecutiveDays = (player.consecutiveDays || 0) + 1;
        player.momentum        = buildMomentum(player.consecutiveDays);
        if ((player.completedToday || []).length >= (dailyQuests || []).length && dailyQuests.length > 0) {
            const maxCap     = player.maxCapacity || calcMaxCapacity(calculateLevel());
            player.capacity  = Math.min(maxCap, (player.capacity || maxCap) + 10);
        }
    } else {
        player.consecutiveDays = 1;
        player._prevMomentum   = player.momentum;
        player.momentum        = decayMomentum(player.momentum || 1.0, diffDays - 1);
        applyCapacityDecay(player, diffDays - 1);
    }

    player.completedToday  = [];
    player.lastQuestDate   = todayStr;
    player.lastActiveDate  = todayStr;
    player.operatorDays    = (player.operatorDays || 1) + 1;
    savePlayer();
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// ─── DIRECTIVE COMPLETION ────────────────────────────────────
function completeQuest(id, stat, baseXP) {
    if (!player) return;
    if ((player.completedToday || []).includes(id)) return;

    const momentum  = player.momentum || 1.0;
    const finalXP   = Math.round(baseXP * momentum);
    const statGain  = finalXP * 0.5;

    player.stats[stat] = parseFloat(((player.stats[stat] || STAT_FLOOR) + statGain).toFixed(2));

    // [TUNING TARGET] Sig reward per directive = baseXP / 2
    const sigReward = Math.floor(baseXP / 2);
    player.sig = (player.sig || 0) + sigReward;

    player.completedToday = player.completedToday || [];
    player.completedToday.push(id);
    player.lastActiveDate = today();

    // [TUNING TARGET] Capacity recovered per directive completion
    const maxCap    = player.maxCapacity || calcMaxCapacity(calculateLevel());
    player.capacity = Math.min(maxCap, (player.capacity || maxCap) + 2);

    savePlayer();
    playQuestComplete();
    showFloatingXP(id, finalXP, momentum > 1.3);

    const prevLevel = levelFromXP(Math.max(0, earnedXP(player.stats) - statGain));
    const newLevel  = calculateLevel();
    if (newLevel > prevLevel) {
        showLevelUpOverlay(newLevel);
        player.maxCapacity = calcMaxCapacity(newLevel);
        savePlayer();
    }

    updateStatusScreen();

    if (activeStatusTab === 'directives' && typeof renderDirectivesTab === 'function') {
        const container = document.getElementById('status-tab-content');
        if (container) renderDirectivesTab(container);
    }

    const allNowDone = (player.completedToday || []).length >= (dailyQuests || []).length && (dailyQuests || []).length > 0;
    if (allNowDone && typeof shouldShowCloseOfDay === 'function' && shouldShowCloseOfDay()) {
        setTimeout(() => { if (typeof triggerCloseOfDay === 'function') triggerCloseOfDay(); }, 1800);
    }

    maybeSyncToCloud();
}

// ─── STATUS SCREEN ────────────────────────────────────────────
// PASS 1: Header no longer includes sig badge (sig shown in STATUS tab identity block).
function updateStatusScreen(animate) {
    if (!player) return;

    const level  = calculateLevel();
    const rank   = rankFromLevel(level);
    const nameEl  = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const rankEl  = document.getElementById('rank-badge');

    // PASS 1: sig badge removed from header
    if (nameEl)  nameEl.textContent  = player.name;
    if (levelEl) levelEl.textContent = level;
    if (rankEl)  { rankEl.textContent = rank; rankEl.className = 'rank-badge ' + rankCssClass(rank); }

    if (typeof renderStatusWindow === 'function') {
        renderStatusWindow(animate);
    }
}

// ─── FLOATING XP INDICATOR ───────────────────────────────────
function showFloatingXP(questId, amount, isCritical) {
    const card = document.getElementById(`quest-card-${questId}`);
    if (!card) return;
    const rect  = card.getBoundingClientRect();
    const top   = rect.top + window.scrollY;
    const left  = rect.left + rect.width / 2 - 20;
    if (isCritical) {
        const c = document.createElement('div');
        c.className    = 'float-xp float-critical';
        c.textContent  = '[ MOMENTUM BONUS ]';
        c.style.left   = `${left}px`;
        c.style.top    = `${top - 24}px`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 1100);
    }
    const l = document.createElement('div');
    l.className   = 'float-xp';
    l.textContent = `+${amount} XP`;
    l.style.left  = `${left}px`;
    l.style.top   = `${top}px`;
    document.body.appendChild(l);
    setTimeout(() => l.remove(), 1000);
}

// ─── LEVEL UP OVERLAY ────────────────────────────────────────
function showLevelUpOverlay(level) {
    playLevelUp();
    spawnParticles('lu-particles', 20, 'var(--accent)');
    const tt  = titleFromLevel(level);
    const rt  = rankFromLevel(level);
    const sub = `${rt}-RANK · SHOW UP AGAIN TOMORROW`;
    document.getElementById('lu-level').textContent = level;
    document.getElementById('lu-title').textContent = tt;
    document.getElementById('lu-sub').textContent   = sub;
    const ov  = document.getElementById('overlay-levelup');
    ov.classList.remove('hidden');
    document.getElementById('lu-dismiss-btn').onclick = () => {
        playUIClick();
        ov.classList.add('hidden');
    };
}

// ─── ANIMATE NUMBER ──────────────────────────────────────────
function animateNumber(elId, from, to, dur) {
    const el = document.getElementById(elId);
    if (!el) return;
    const steps = 30;
    const step  = (to - from) / steps;
    const delay = dur / steps;
    let cur = from; let cnt = 0;
    const iv = setInterval(() => {
        cnt++; cur += step;
        el.textContent = Math.round(cnt >= steps ? to : cur);
        if (cnt >= steps) clearInterval(iv);
    }, delay);
}

// ─── PARTICLES ───────────────────────────────────────────────
function spawnParticles(cId, count, color) {
    const canvas = document.getElementById(cId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: count }, () => ({
        x: canvas.width / 2, y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
        alpha: 1, r: Math.random() * 4 + 2
    }));
    let frame;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.alpha -= 0.02; p.vy += 0.1;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle   = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        if (particles.some(p => p.alpha > 0)) frame = requestAnimationFrame(draw);
        else { ctx.clearRect(0, 0, canvas.width, canvas.height); cancelAnimationFrame(frame); }
    }
    draw();
}

// ─── LOG ─────────────────────────────────────────────────────
function showLog(msg, variant) {
    const el = document.getElementById('system-log');
    if (!el) return;
    el.textContent  = msg;
    el.className    = `system-log system-log--${variant || 'default'}`;
    el.style.opacity = '1';
    clearTimeout(el._fadeTimer);
    el._fadeTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ─── GEAR ────────────────────────────────────────────────────
function loadGear() {
    const s = parseInt(localStorage.getItem(GEAR_KEY), 10);
    return (s === 2 || s === 3) ? s : 1;
}
function saveGear(gear) {
    currentGear = gear;
    localStorage.setItem(GEAR_KEY, gear);
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear(), player?.operatorDays);
    updateStatusScreen();
    showLog(`[ GEAR ${gear} ENGAGED ]`);
}

// ─── RESET ───────────────────────────────────────────────────
function resetProfile() {
    localStorage.clear();
    window.location.reload();
}

// ─── FIELD NOTES ─────────────────────────────────────────────
function loadFieldNotes() {
    try { const raw = localStorage.getItem(FIELD_NOTES_KEY); return raw ? JSON.parse(raw) : {}; }
    catch(e) { return {}; }
}
function saveFieldNote(questId, text) {
    const notes = loadFieldNotes();
    const key   = `${questId}_${today()}`;
    notes[key]  = text;
    localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(notes));
}
function loadFieldNote(questId) {
    const notes = loadFieldNotes();
    return notes[`${questId}_${today()}`] || '';
}

// ─── NEURAL LINK ─────────────────────────────────────────────
function getNeuralKey()      { return localStorage.getItem(NEURAL_KEY_KEY) || null; }
function getNeuralProvider() { return localStorage.getItem(NEURAL_PROVIDER_KEY) || 'gemini'; }
function setNeuralKey(k, p) {
    if (k) { localStorage.setItem(NEURAL_KEY_KEY, k); localStorage.setItem(NEURAL_PROVIDER_KEY, p || 'gemini'); }
    else    { localStorage.removeItem(NEURAL_KEY_KEY); localStorage.removeItem(NEURAL_PROVIDER_KEY); }
}

// ─── CLOUD SYNC ───────────────────────────────────────────────
async function maybeSyncToCloud() {
    if (!player || !player.syncOptedIn) return;
    const lastPush = localStorage.getItem(SYNC_LAST_PUSH_KEY);
    if (lastPush && Date.now() - new Date(lastPush).getTime() < SYNC_COOLDOWN_MS) return;
    await pushToCloud();
}

async function pushToCloud(immediate) {
    const database = getDB();
    if (!database || !player) return;
    try {
        const uid = player.uid || generateUID();
        if (!player.uid) { player.uid = uid; savePlayer(); }
        const { sig, stats, momentum, capacity, maxCapacity, operatorDays,
                consecutiveDays, level, rank, name, pathData } = player;
        await database.collection('syd_operatives').doc(uid).set({
            name, stats, sig, momentum, capacity, maxCapacity,
            operatorDays, consecutiveDays, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        localStorage.setItem(SYNC_LAST_PUSH_KEY, new Date().toISOString());
    } catch(e) {
        console.warn('[SYD] Cloud sync failed:', e);
    }
}

function generateUID() {
    return 'syd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── QUEST LOADING ───────────────────────────────────────────
async function loadQuests() {
    try {
        const res  = await fetch('data/quests.json');
        const data = await res.json();
        return data.quests;
    } catch(e) {
        console.warn('[SYD] Could not load quests.json:', e);
        return [];
    }
}

// ─── NAV + HISTORY ───────────────────────────────────────────
const NAV_HISTORY = [];
const NAV_EXCLUDE = ['screen-scan', 'screen-scan-reveal', 'screen-neural-request',
    'screen-path', 'screen-path-chronicler', 'screen-path-reimaginer',
    'screen-path-loading', 'screen-synthesis-reveal', 'screen-orientation'];

function navTo(screenId) { playUIClick(); showScreen(screenId); }

function goBack() {
    playUIClick();
    const dest = NAV_HISTORY.pop() || 'screen-status';
    showScreen(dest, true);
}

// ─── RELAUNCH BOOT ───────────────────────────────────────────
// PASS 1: After boot, lands on STATUS tab (not directives).
function runRelaunchBoot() {
    return new Promise(resolve => {
        const overlay = document.getElementById('relaunch-boot');
        const linesEl = document.getElementById('relaunch-lines');
        if (!overlay) { resolve(); return; }
        overlay.classList.remove('hidden');
        linesEl.innerHTML = '';

        const cur   = player.momentum || 1.0;
        const prev  = player._prevMomentum || cur;
        const delta = parseFloat((cur - prev).toFixed(4));
        const dStr  = delta >= 0 ? `+${delta.toFixed(4)}` : delta.toFixed(4);

        const lines = [
            `> SYD_OS — SYNCHRONIZED YIELD DIRECTIVE`,
            `> OPERATIVE: ${player.name}`,
            `> MOMENTUM: ${cur.toFixed(4)} (${dStr})`,
            `> CAPACITY: ${player.capacity ?? player.maxCapacity} / ${player.maxCapacity}`,
            `> DIRECTIVES: ${(player.completedToday || []).length} / ${(dailyQuests || []).length} COMPLETE`,
            `> STANDING BY.`
        ];

        let idx = 0;
        function next() {
            if (idx >= lines.length) {
                setTimeout(() => {
                    overlay.classList.add('hidden');
                    linesEl.innerHTML = '';
                    resolve();
                }, 600);
                return;
            }
            const el = document.createElement('div');
            el.className   = 'relaunch-line';
            el.textContent = lines[idx];
            linesEl.appendChild(el);
            requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('relaunch-line--visible')));
            idx++;
            setTimeout(next, 280);
        }
        next();
    });
}

// ─── SHOW SCREEN ─────────────────────────────────────────────
function showScreen(id, isBack) {
    const prev = document.querySelector('.screen.active');
    const prevId = prev ? prev.id : null;

    if (!isBack && prevId && !NAV_EXCLUDE.includes(prevId) && prevId !== id) {
        NAV_HISTORY.push(prevId);
        if (NAV_HISTORY.length > 10) NAV_HISTORY.shift();
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const next = document.getElementById(id);
    if (next) next.classList.add('active');

    if (id === 'screen-status') {
        startStatusAmbient();
        updateStatusScreen();
    } else {
        stopStatusAmbient();
    }

    if (id === 'screen-minigames' && typeof renderMiniGameHub === 'function') {
        renderMiniGameHub(player ? player.sig : 0);
    }

    if (id === 'screen-neural') {
        wireNeuralScreen();
    }
}

// ─── NEURAL LINK SCREEN WIRING ───────────────────────────────
function wireNeuralScreen() {
    const backBtns = [
        document.getElementById('neural-header-back'),
        document.getElementById('neural-back-link')
    ];
    backBtns.forEach(btn => {
        if (btn && !btn.dataset.wired) {
            btn.dataset.wired = 'true';
            btn.addEventListener('click', () => { playUIClick(); goBack(); });
        }
    });

    const saveBtn   = document.getElementById('neural-key-save');
    const removeBtn = document.getElementById('neural-key-remove');
    const input     = document.getElementById('neural-key-input');

    if (input) {
        const existing = getNeuralKey();
        if (existing) {
            input.placeholder = 'Key saved — paste a new one to replace';
            input.value = '';
        }
    }

    if (saveBtn && !saveBtn.dataset.wired) {
        saveBtn.dataset.wired = 'true';
        saveBtn.addEventListener('click', () => {
            playUIClick();
            const key = input ? input.value.trim() : '';
            if (!key) { showLog('[ PASTE YOUR GEMINI KEY TO LINK ]', 'system'); return; }
            if (key.length < 8) { showLog('[ KEY TOO SHORT — CHECK YOU COPIED THE FULL KEY ]', 'system'); return; }
            setNeuralKey(key, 'gemini');
            if (input) { input.value = ''; input.placeholder = 'Key saved — paste a new one to replace'; }
            showLog('[ NEURAL LINK CONNECTED — AI FEATURES ACTIVE ]', 'accent');
            if (typeof updateStatusScreen === 'function') updateStatusScreen();
        });
    }

    if (removeBtn && !removeBtn.dataset.wired) {
        removeBtn.dataset.wired = 'true';
        removeBtn.addEventListener('click', () => {
            playUIClick();
            setNeuralKey(null);
            if (input) { input.value = ''; input.placeholder = 'AIza...'; }
            showLog('[ NEURAL LINK REMOVED — LOCAL MODE ONLY ]', 'system');
            if (typeof updateStatusScreen === 'function') updateStatusScreen();
        });
    }
}

// ─── PWA INSTALL ─────────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    setTimeout(() => showInstallPrompt(), 8000);
});

function showInstallPrompt() {
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.remove('hidden');
}
function acceptInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; });
    }
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('hidden');
}
function dismissInstall() {
    deferredInstallPrompt = null;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('hidden');
}

// ─── SERVICE WORKER ──────────────────────────────────────────
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => {
            navigator.serviceWorker.addEventListener('message', e => {
                if (e.data && e.data.type === 'SW_UPDATED') {
                    if (player) window.location.reload();
                }
            });
            if (reg.active && player) {
                reg.active.postMessage({
                    type:           'CHECK_NOTIFICATION',
                    lastActiveDate: player.lastActiveDate || player.lastQuestDate,
                    playerName:     player.name
                });
                reg.active.postMessage({
                    type:       'SCHEDULE_MORNING',
                    playerName: player.name,
                    momentum:   player.momentum || 1.0
                });
            }
        })
        .catch(e => console.warn('[SYD] SW registration failed:', e));
}

// ─── TYPE TEXT UTILITY ───────────────────────────────────────
function typeText(el, text, speed, onDone) {
    let i = 0;
    el.textContent = '';
    const iv = setInterval(() => {
        el.textContent += text[i]; i++;
        if (i >= text.length) { clearInterval(iv); if (onDone) onDone(); }
    }, speed);
    return () => clearInterval(iv);
}

// ═══════════════════════════════════════════════════════════════
// PASS 2 — ONBOARDING FLOW ADDITIONS
// ═══════════════════════════════════════════════════════════════

// ─── BRIDGE: NAME → SCAN ─────────────────────────────────────
function startScan(name) {
    window._pendingOperativeName = name;

    if (typeof runScan === 'function') {
        runScan(name, (scanTraits) => {
            // PASS 2: Show scan reveal before PATH
            renderScanReveal(scanTraits, () => {
                // After reveal, check if neural key request is needed
                renderNeuralKeyRequest(() => {
                    startPATH(name, scanTraits);
                });
            });
        });
    } else {
        startPATH(name, {});
    }
}

// ─── BRIDGE: SCAN → PATH ─────────────────────────────────────
function startPATH(name, scanTraits) {
    window._pendingScanTraits = scanTraits;

    if (typeof runPATH === 'function') {
        runPATH(scanTraits, (pathData) => {
            stopStatusAmbient();
            // PASS 2: Show synthesis reveal before createPlayer
            renderSynthesisReveal(pathData, () => {
                renderOrientationScreen(() => {
                    createPlayer(name, scanTraits, pathData);
                });
            });
        });
    } else {
        createPlayer(name, scanTraits, null);
    }
}

// ─── PASS 2: POST-SCAN REVEAL SCREEN ─────────────────────────
// Shows the seven trait scores as animated bars with SYD commentary.
// Fires after completeScan(), before PATH Protocol.
// onDone: callback to advance to neural key request.
function renderScanReveal(scanTraits, onDone) {
    showScreen('screen-scan-reveal');
    const container = document.getElementById('scan-reveal-content');
    if (!container) { if (onDone) onDone(); return; }

    const traits = scanTraits || {};

    // SYD's read — pick lines based on highest and lowest trait
    const sorted = Object.entries(traits).sort((a, b) => b[1] - a[1]);
    const highest = sorted[0] || null;
    const lowest  = sorted[sorted.length - 1] || null;

    const traitReadableNames = {
        patternRecognition:    'pattern recognition',
        cognitiveFlexibility:  'cognitive flexibility',
        persistence:           'persistence',
        executionSpeed:        'execution speed',
        executionAccuracy:     'execution accuracy',
        pressureStability:     'pressure stability',
        socialReading:         'social reading'
    };

    const sydLines = [];
    sydLines.push('Your scan is in. Here is what it found.');
    if (highest) {
        const highName = traitReadableNames[highest[0]] || highest[0];
        const highPct  = Math.round(highest[1] * 100);
        sydLines.push(`${highName.toUpperCase()} is your strongest signal at ${highPct}%. That is the engine. Everything else is downstream of that.`);
    }
    if (lowest && lowest[0] !== (highest && highest[0])) {
        const lowName = traitReadableNames[lowest[0]] || lowest[0];
        const lowPct  = Math.round(lowest[1] * 100);
        sydLines.push(`${lowName.toUpperCase()} at ${lowPct}% is the gap. Not a flaw — a calibration target. The directives are built to close it.`);
    }
    sydLines.push('These traits seed your starting stats. They are stored. They grow with use.');

    const traitOrder = [
        'patternRecognition', 'cognitiveFlexibility', 'persistence',
        'executionSpeed', 'executionAccuracy', 'pressureStability', 'socialReading'
    ];

    const traitDisplayNames = {
        patternRecognition:    'PATTERN RECOGNITION',
        cognitiveFlexibility:  'COGNITIVE FLEXIBILITY',
        persistence:           'PERSISTENCE',
        executionSpeed:        'EXECUTION SPEED',
        executionAccuracy:     'EXECUTION ACCURACY',
        pressureStability:     'PRESSURE STABILITY',
        socialReading:         'SOCIAL READING'
    };

    container.innerHTML = `
        <div class="scan-reveal-wrap">
            <div class="scan-reveal-header">
                <p class="scan-reveal-label">[ SIGNAL ACQUISITION — COMPLETE ]</p>
            </div>

            <div class="scan-reveal-syd">
                ${sydLines.map(l => `<p class="scan-reveal-syd-line">${l}</p>`).join('')}
            </div>

            <div class="scan-reveal-traits">
                ${traitOrder.map(key => {
                    const score  = traits[key] !== undefined ? traits[key] : null;
                    const pct    = score !== null ? Math.round(score * 100) : 0;
                    const name   = traitDisplayNames[key] || key.toUpperCase();
                    return `
                        <div class="srt-row">
                            <div class="srt-row-header">
                                <span class="srt-name">${name}</span>
                                <span class="srt-pct" id="srt-pct-${key}">${score !== null ? pct + '%' : '—'}</span>
                            </div>
                            <div class="srt-bar-wrap">
                                <div class="srt-bar" id="srt-bar-${key}" style="width:0%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <button class="btn btn--primary scan-reveal-proceed" id="scan-reveal-proceed">
                [ PROCEED TO CLASSIFICATION ]
            </button>
        </div>
    `;

    // Animate bars in sequence
    setTimeout(() => {
        traitOrder.forEach((key, i) => {
            const score = traits[key] !== undefined ? traits[key] : 0;
            const pct   = Math.round(score * 100);
            setTimeout(() => {
                const bar = document.getElementById('srt-bar-' + key);
                if (bar) bar.style.width = pct + '%';
            }, i * 120);
        });
    }, 300);

    document.getElementById('scan-reveal-proceed').addEventListener('click', () => {
        playUIClick();
        if (onDone) onDone();
    });
}

// ─── PASS 2: NEURAL KEY REQUEST SCREEN ──────────────────────
// One-time screen between scan reveal and PATH.
// Skipped if key is already set (hasNeuralLink() returns true).
// onDone: callback to advance.
function renderNeuralKeyRequest(onDone) {
    // Skip if key already connected
    if (typeof hasNeuralLink === 'function' && hasNeuralLink()) {
        if (onDone) onDone();
        return;
    }

    showScreen('screen-neural-request');
    const container = document.getElementById('neural-request-content');
    if (!container) { if (onDone) onDone(); return; }

    container.innerHTML = `
        <div class="neural-request-wrap">
            <div class="nr-header">
                <p class="nr-syd-line">Before I classify you, I need to ask something.</p>
                <p class="nr-syd-line">SYD can give you a personalised read. Your PATH analysis, stat explainers, and encounter evaluations can be specific to you — not generic.</p>
                <p class="nr-syd-line">To activate it, connect a free Gemini key. This takes about 60 seconds.</p>
            </div>

            <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener"
                class="btn btn--primary nr-get-key-btn"
            >
                [ GET YOUR FREE GEMINI KEY ]
            </a>

            <div class="nr-input-group">
                <input
                    type="password"
                    id="nr-key-input"
                    class="settings-input nr-key-input"
                    placeholder="Paste your key here — AIza..."
                    autocomplete="off"
                    spellcheck="false"
                />
                <button class="btn btn--primary" id="nr-link-btn">[ LINK ]</button>
            </div>

            <p class="nr-privacy-note">
                Your key is stored on this device only. Never transmitted to SYD servers.
            </p>

            <button class="nr-skip-btn" id="nr-skip-btn">
                I'll do this later — skip for now
            </button>
        </div>
    `;

    document.getElementById('nr-link-btn').addEventListener('click', () => {
        playUIClick();
        const input = document.getElementById('nr-key-input');
        const key   = input ? input.value.trim() : '';
        if (!key) {
            showLog('[ PASTE YOUR KEY FIRST, OR TAP SKIP ]', 'system');
            return;
        }
        if (key.length < 8) {
            showLog('[ KEY TOO SHORT — CHECK YOU COPIED THE FULL KEY ]', 'system');
            return;
        }
        if (typeof setNeuralKey === 'function') setNeuralKey(key, 'gemini');
        showLog('[ NEURAL LINK CONNECTED ]', 'accent');
        setTimeout(() => { if (onDone) onDone(); }, 600);
    });

    document.getElementById('nr-skip-btn').addEventListener('click', () => {
        playUIClick();
        if (onDone) onDone();
    });
}

// ─── PASS 2: POST-PATH SYNTHESIS REVEAL ──────────────────────
// Shows confirmed path, role, rank, top gap skills, hidden affinity hint.
// SYD speaks 2–3 lines. CONTINUE button. Fires before createPlayer().
// onDone: callback to advance to orientation.
function renderSynthesisReveal(pathData, onDone) {
    showScreen('screen-synthesis-reveal');
    const container = document.getElementById('synthesis-reveal-content');
    if (!container) { if (onDone) onDone(); return; }

    if (!pathData) {
        if (onDone) onDone();
        return;
    }

    const pathName    = (pathData.confirmedPath && pathData.confirmedPath.path_name) || 'UNCLASSIFIED';
    const role        = pathData.confirmedRole || pathName;
    const rank        = pathData.confirmedRank || 'F';
    const skills      = (pathData.gapAnalysis && pathData.gapAnalysis.skills) || [];
    const top3Skills  = skills.slice(0, 3);
    const affinity    = pathData.hiddenAffinity;

    // Rank plain-language context
    const rankContext = {
        'F': 'Starting position. The system clocked where you are — not where you will be.',
        'E': 'Early traction. You have real experience to build on.',
        'D': 'Developing. You are past beginner. The next phase is deliberate practice.',
        'C': 'Established. You know the terrain. The gap now is precision.',
        'B': 'Senior. You operate under pressure. The gap is influence.',
        'A': 'Recognised. Edge cases are what is left to master.',
        'S': 'Elite. Almost nothing left to close.'
    };

    const sydLines = [];
    sydLines.push(`Classification complete. You are confirmed on the ${pathName} path.`);
    if (role && role !== pathName) {
        sydLines.push(`Primary role: ${role}. That is where your record points.`);
    }
    if (top3Skills.length > 0) {
        sydLines.push(`Three gaps identified: ${top3Skills.join(', ')}. These are what the directives will target first.`);
    } else {
        sydLines.push('Your directives will target the highest-leverage gaps for your path and rank.');
    }

    container.innerHTML = `
        <div class="synthesis-reveal-wrap">
            <div class="sr-header">
                <p class="sr-label">[ CLASSIFICATION COMPLETE ]</p>
            </div>

            <div class="sr-path-block">
                <p class="sr-path-name">${pathName}</p>
                <p class="sr-role">${role !== pathName ? role : ''}</p>
                <div class="sr-rank-row">
                    <span class="rank-badge ${typeof rankCssClass === 'function' ? rankCssClass(rank) : ''}">${rank}</span>
                    <span class="sr-rank-context">${rankContext[rank] || rankContext['F']}</span>
                </div>
            </div>

            ${top3Skills.length > 0 ? `
                <div class="sr-gaps-block">
                    <p class="sr-section-label">[ GAP TARGETS ]</p>
                    <div class="path-skill-tags">
                        ${top3Skills.map(s => '<span class="path-skill-tag">' + s + '</span>').join('')}
                    </div>
                </div>
            ` : ''}

            ${affinity && affinity.stat ? `
                <div class="sr-affinity-block">
                    <p class="sr-section-label">[ HIDDEN AFFINITY — STORED ]</p>
                    <p class="sr-affinity-note">Something was flagged in your signal. It unlocks at Level 20. SYD is holding it.</p>
                </div>
            ` : ''}

            <div class="sr-syd-voice">
                ${sydLines.map(l => `<p class="sr-syd-line">${l}</p>`).join('')}
            </div>

            <button class="btn btn--primary" id="sr-continue-btn">[ CONTINUE ]</button>
        </div>
    `;

    document.getElementById('sr-continue-btn').addEventListener('click', () => {
        playUIClick();
        if (onDone) onDone();
    });
}

// ─── PASS 2: ORIENTATION SCREEN ──────────────────────────────
// Single screen explaining what the operative can do.
// Fires between synthesis reveal and first transmission.
// onDone: callback to advance to createPlayer → first transmission.
function renderOrientationScreen(onDone) {
    showScreen('screen-orientation');
    const container = document.getElementById('orientation-content');
    if (!container) { if (onDone) onDone(); return; }

    container.innerHTML = `
        <div class="orientation-wrap">
            <div class="or-header">
                <p class="or-label">[ SYD — ORIENTATION ]</p>
            </div>

            <div class="or-syd-voice">
                <p class="or-syd-line">Here is how this works.</p>
                <p class="or-syd-line">Every day you get <strong>directives</strong> — real-world tasks that build your stats. Complete them. That is the main thing.</p>
                <p class="or-syd-line">Each day you also get an <strong>encounter</strong> — a judgment call or a lesson. Optional. No penalty for skipping. But doing them sharpens something directives cannot.</p>
                <p class="or-syd-line">The <strong>Training Floor</strong> has five games that cost SIG to enter and train specific stats. SIG is earned by completing directives.</p>
                <p class="or-syd-line">Momentum tracks how many days in a row you show up. It multiplies your XP. The compounding starts slow. You will not feel it yet. Show up tomorrow anyway.</p>
            </div>

            <button class="btn btn--primary or-continue-btn" id="or-continue-btn">
                [ UNDERSTOOD — LET'S BEGIN ]
            </button>
        </div>
    `;

    document.getElementById('or-continue-btn').addEventListener('click', () => {
        playUIClick();
        if (onDone) onDone();
    });
}

// ─── NEW OPERATIVE FLOW ──────────────────────────────────────
function runNewOperativeFlow() {
    startStatusAmbient();
    renderNameEntry();
}

function renderNameEntry() {
    const container = document.getElementById('onboarding-content');
    if (!container) return;

    container.innerHTML = `
        <div class="onboarding-terminal">
            <div class="onboarding-lines" id="onboarding-lines"></div>
            <div class="onboarding-name-input hidden" id="onboarding-name-section">
                <span class="onboarding-prompt-label">OPERATIVE NAME:&nbsp;&nbsp;</span>
                <input
                    type="text"
                    id="onboarding-name-input"
                    class="onboarding-inline-input"
                    placeholder="type your name..."
                    autocomplete="off"
                    spellcheck="false"
                    maxlength="40"
                />
                <span class="boot-cursor-blink">▊</span>
            </div>
            <button class="btn btn--primary hidden" id="onboarding-name-btn">[ IDENTIFY ]</button>
        </div>
    `;

    const linesEl     = document.getElementById('onboarding-lines');
    const nameSection = document.getElementById('onboarding-name-section');
    const nameInput   = document.getElementById('onboarding-name-input');
    const nameBtn     = document.getElementById('onboarding-name-btn');

    const introLines = [
        '> SIGNAL DETECTED',
        '> LOCATING OPERATIVE...',
        '> CONNECTION ESTABLISHED',
        '',
        'The economy broke first. Then the systems. Then the people.',
        'Most are still waiting for someone to fix it.',
        'You stopped waiting.',
        '',
        'I am the System your future self deployed.',
        'I found you because you are still moving.',
        '',
        'Identify yourself.'
    ];

    let idx = 0;
    function nextLine() {
        if (idx >= introLines.length) {
            setTimeout(() => {
                nameSection.classList.remove('hidden');
                nameBtn.classList.remove('hidden');
                nameInput.focus();
            }, 400);
            return;
        }
        const line = introLines[idx];
        const el   = document.createElement('div');
        el.className   = line.startsWith('>')
            ? 'onboarding-line onboarding-line--signal'
            : (line === '' ? 'onboarding-line onboarding-line--spacer' : 'onboarding-line');
        el.textContent = line;
        linesEl.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('onboarding-line--visible')));
        idx++;
        setTimeout(nextLine, line === '' ? 200 : line.startsWith('>') ? 400 : 320);
    }

    linesEl.addEventListener('click', () => {
        introLines.slice(idx).forEach(line => {
            const el = document.createElement('div');
            el.className   = line.startsWith('>')
                ? 'onboarding-line onboarding-line--signal'
                : (line === '' ? 'onboarding-line onboarding-line--spacer' : 'onboarding-line');
            el.classList.add('onboarding-line--visible');
            el.textContent = line;
            linesEl.appendChild(el);
        });
        idx = introLines.length;
        nameSection.classList.remove('hidden');
        nameBtn.classList.remove('hidden');
        nameInput.focus();
    }, { once: true });

    nameInput.addEventListener('input', () => {
        nameBtn.classList.toggle('hidden', !nameInput.value.trim());
    });
    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && nameInput.value.trim()) submitName();
    });
    nameBtn.addEventListener('click', () => { playUIClick(); submitName(); });

    function submitName() {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        stopStatusAmbient();
        startScan(name.toUpperCase());
    }

    nextLine();
}

// ─── INIT ────────────────────────────────────────────────────
async function init() {
    applySoundState(loadSoundState());

    const questsPromise = loadQuests();
    player              = loadPlayer();
    currentGear         = loadGear();

    // Wire install banner
    const installConfirm  = document.getElementById('install-confirm-btn');
    const installDismiss  = document.getElementById('install-dismiss-btn');
    if (installConfirm)  installConfirm.addEventListener('click',  () => { playUIClick(); acceptInstall(); });
    if (installDismiss)  installDismiss.addEventListener('click',  () => { playUIClick(); dismissInstall(); });

    // PASS 1: Sound toggle stub — wiring moved to SETTINGS tab in status.js.
    // The #sound-toggle element in index.html is now hidden.
    // Legacy handler kept in case any code calls it directly.
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) soundToggle.addEventListener('click', cycleSoundState);

    // ── New operative — run scan → PATH → createPlayer ────────
    if (!player) {
        allQuests = await questsPromise;
        showScreen('screen-onboarding');
        runNewOperativeFlow();
        registerServiceWorker();
        return;
    }

    // ── Returning operative ───────────────────────────────────
    allQuests = await Promise.race([
        questsPromise,
        new Promise(r => setTimeout(() => r([]), 4000))
    ]);
    if (!allQuests.length) allQuests = await questsPromise;

    checkDailyReset();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear(), player?.operatorDays);
    await runRelaunchBoot();

    // PASS 1: Returning operative lands on STATUS tab (not directives)
    showScreen('screen-status');
    if (typeof switchStatusTab === 'function') switchStatusTab('status');

    registerServiceWorker();
    if (typeof initDailyLoop === 'function') initDailyLoop();
}

document.addEventListener('DOMContentLoaded', init);