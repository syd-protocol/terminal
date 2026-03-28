// ═══════════════════════════════════════════════════════════════
// SYD GES — app.js
// Core engine. Refactored from Terminal for the Gamified Evolution System.
//
// What changed from Terminal:
//   • Onboarding:  old lore boot → Scan + PATH Protocol
//   • Currency:    gold → Sig
//   • Resource:    HP/corrupted → Capacity (resource to manage, not punishment)
//   • Status:      single screen → five-tab Status Window (status.js)
//   • Screens:     screen-scan, screen-path-select, screen-path-chronicler,
//                  screen-path-reimaginer, screen-path-loading,
//                  screen-encounter, screen-minigames, screen-minigame added
//   • Directives:  all selection logic in quests.js
//   • Modules:     scan.js, path.js, encounter.js, minigames.js, status.js
//
// What kept from Terminal (unchanged or minimally extended):
//   • Firebase config + getDB()
//   • STAT_NAMES, STAT_FLOOR, STAT_KEYWORDS, classifyGoal()
//   • xpForLevel(), levelFromXP(), earnedXP()
//   • RANKS, rankFromLevel(), TITLES, titleFromLevel()
//   • buildMomentum(), decayMomentum()
//   • showScreen(), navTo(), goBack(), NAV history
//   • Web Audio API sound system (all playTone variants)
//   • PWA install prompt
//   • Service Worker registration + SW_UPDATED reload
//   • Firestore push/pull sync
//   • Field notes (loadFieldNote, saveFieldNote)
//   • checkDailyReset(), today()
//   • loadQuests() — fetches /data/quests.json
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
// Compat SDK loaded via <script> in index.html.
// Existing Terminal project — do not create a new Firebase project.
// GES extends the existing Firestore schema to store:
//   syd_operatives/{uid}/profile   — name, stats, level, rank, momentum, capacity, sig
//   syd_operatives/{uid}/path      — PATH Protocol output
//   syd_operatives/{uid}/directives/{date} — completions, field notes
//   syd_operatives/{uid}/encounters/{date} — response, verdict
//   syd_operatives/{uid}/journal/{date}    — end-of-day entry
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

// [TUNING TARGET] Soft cap per level: STAT_FLOOR + (level * STAT_GROWTH_RATE)
// Cap rises as the operative levels up. Stats never look full or empty disproportionately.
const STAT_GROWTH_RATE = 2;

// ─── KEYWORD CLASSIFICATION ───────────────────────────────────
// Local fallback for PATH track selection and goal-to-stat mapping.
// Used by path.js getLocalFallbackInference() and by classifyGoal() directly.
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
// [RESEARCH] Source: Game design literature on progression curves.
// Finding: polynomial curves produce achievable early levels and demanding higher ones.
// Applied: Terminal formula retained exactly.
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
// [RESEARCH] Source: Solo Leveling wiki and novel.
// Finding: stats accumulate continuously, never reset. Applied: confirmed.
// buildMomentum: approaches 1.5× asymptotically over 14 consecutive days.
// decayMomentum: graceful — 1 day missed = 95%, 2 = 85%, 3 = 75%, 4+ = exponential.
function buildMomentum(consecutiveDays) {
    return parseFloat((1 + 0.5 * (1 - Math.exp(-consecutiveDays / 14))).toFixed(4));
}
function decayMomentum(current, missedDays) {
    if (missedDays <= 0) return current;
    if (missedDays === 1) return parseFloat((current * 0.95).toFixed(4));
    if (missedDays === 2) return parseFloat((current * 0.85).toFixed(4));
    if (missedDays === 3) return parseFloat((current * 0.75).toFixed(4));
    // 4+ days: exponential decay toward floor of 1.0
    let m = current;
    for (let i = 0; i < missedDays - 3; i++) m = Math.max(1.0, m * 0.80);
    return parseFloat(m.toFixed(4));
}

// ─── CAPACITY (replaces HP) ───────────────────────────────────
// Capacity is the operative's current resource. Not a punishment — a signal.
// Drops under sustained high-intensity effort without recovery.
// Recovers through rest-based directives.
// Nothing catastrophic at zero — SYD reflects honestly.
//
// [TUNING TARGET] Base capacity and per-level growth
function calcMaxCapacity(level) { return 100 + level * 5; }

// Capacity drop per missed day — gentler than Terminal's HP system.
// [TUNING TARGET] Capacity decay values
function applyCapacityDecay(player, missedDays) {
    const maxCap = player.maxCapacity || calcMaxCapacity(calculateLevel ? calculateLevel() : 1);
    if (missedDays === 1) player.capacity = Math.max(0, (player.capacity ?? maxCap) - 5);
    else if (missedDays === 2) player.capacity = Math.max(0, (player.capacity ?? maxCap) - 12);
    else if (missedDays === 3) player.capacity = Math.max(0, (player.capacity ?? maxCap) - 22);
    else player.capacity = Math.max(0, (player.capacity ?? maxCap) - 35);
}

// ─── SOUND SYSTEM ────────────────────────────────────────────
// Web Audio API synthesis only — no audio files.
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
// Tracks total audio minutes for habituation fade — kept from Terminal.
// [TUNING TARGET] Audio fade threshold in minutes
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
// Status screen ambient — kept from Terminal, simplified.
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

    // Migration: existing players predate operatorDays — set high to skip Tier 0
    if (typeof p.operatorDays === 'undefined') p.operatorDays = 999;

    // Migration: existing players predate PATH data
    if (typeof p.pathComplete === 'undefined') p.pathComplete = true;

    // Migration: existing players predate scan
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

    // Apply scan trait seeds on top of floor
    if (scanTraits && typeof seedStatsFromTraits === 'function') {
        const scanSeeds = seedStatsFromTraits(scanTraits);
        STAT_NAMES.forEach(s => {
            stats[s] = STAT_FLOOR + (scanSeeds[s] || 0);
        });
    }

    // Apply PATH data seeds on top of scan seeds
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

    // Save PATH data separately for the PATH tab
    if (pathData && typeof savePathData === 'function') {
        savePathData(pathData);
    }

    savePlayer();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear(), player.operatorDays);
    updateStatusScreen();
    showScreen('screen-status');
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
// SYD's voice. Brief. Specific. No tutorial announcement.
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

    btn.onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
        player.hasSeenBriefing = true;
        savePlayer();
        switchStatusTab('directives');
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
        // Consecutive day
        player.consecutiveDays = (player.consecutiveDays || 0) + 1;
        player.momentum        = buildMomentum(player.consecutiveDays);
        // Full-completion bonus: restore 10 capacity
        if ((player.completedToday || []).length >= (dailyQuests || []).length && dailyQuests.length > 0) {
            const maxCap     = player.maxCapacity || calcMaxCapacity(calculateLevel());
            player.capacity  = Math.min(maxCap, (player.capacity || maxCap) + 10);
        }
    } else {
        // Missed days
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

    // Momentum multiplier on XP
    const momentum  = player.momentum || 1.0;
    const finalXP   = Math.round(baseXP * momentum);
    const statGain  = finalXP * 0.5;

    // Apply stat gain
    player.stats[stat] = parseFloat(((player.stats[stat] || STAT_FLOOR) + statGain).toFixed(2));

    // Award Sig
    // [TUNING TARGET] Sig reward per directive = baseXP / 2
    const sigReward = Math.floor(baseXP / 2);
    player.sig = (player.sig || 0) + sigReward;

    // Mark complete
    player.completedToday = player.completedToday || [];
    player.completedToday.push(id);
    player.lastActiveDate = today();

    // Capacity recovery from completing a directive (small, not full)
    // [TUNING TARGET] Capacity recovered per directive completion
    const maxCap    = player.maxCapacity || calcMaxCapacity(calculateLevel());
    player.capacity = Math.min(maxCap, (player.capacity || maxCap) + 2);

    savePlayer();
    playQuestComplete();
    showFloatingXP(id, finalXP, momentum > 1.3);

    // Check level up
    const prevLevel = levelFromXP(Math.max(0, earnedXP(player.stats) - statGain));
    const newLevel  = calculateLevel();
    if (newLevel > prevLevel) {
        showLevelUpOverlay(newLevel);
        // Update max capacity on level up
        player.maxCapacity = calcMaxCapacity(newLevel);
        savePlayer();
    }

    updateStatusScreen();

    // Re-render directives tab if active
    if (activeStatusTab === 'directives' && typeof renderDirectivesTab === 'function') {
        const container = document.getElementById('status-tab-content');
        if (container) renderDirectivesTab(container);
    }

    // If all directives are now complete, offer close-of-day after a short pause
    const allNowDone = (player.completedToday || []).length >= (dailyQuests || []).length && (dailyQuests || []).length > 0;
    if (allNowDone && typeof shouldShowCloseOfDay === 'function' && shouldShowCloseOfDay()) {
        setTimeout(() => { if (typeof triggerCloseOfDay === 'function') triggerCloseOfDay(); }, 1800);
    }

    // Attempt background cloud sync
    maybeSyncToCloud();
}

// ─── STATUS SCREEN ────────────────────────────────────────────
// updateStatusScreen is the top-level function called throughout the app.
// Updates the sticky header bar elements, then delegates tab content to status.js.
function updateStatusScreen(animate) {
    if (!player) return;

    // Update sticky header bar (outside tab content, always visible on screen-status)
    const level  = calculateLevel();
    const rank   = rankFromLevel(level);
    const nameEl  = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const rankEl  = document.getElementById('rank-badge');
    const sigEl   = document.getElementById('sig-value');
    if (nameEl)  nameEl.textContent  = player.name;
    if (levelEl) levelEl.textContent = level;
    if (rankEl)  { rankEl.textContent = rank; rankEl.className = 'rank-badge ' + rankCssClass(rank); }
    if (sigEl)   sigEl.textContent   = player.sig || 0;

    // Delegate tab content to status.js renderStatusWindow()
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

// ─── NEURAL LINK (Gemini API key) ────────────────────────────
function getNeuralKey()      { return localStorage.getItem(NEURAL_KEY_KEY) || null; }
function getNeuralProvider() { return localStorage.getItem(NEURAL_PROVIDER_KEY) || 'gemini'; }
function setNeuralKey(k, p) {
    if (k) { localStorage.setItem(NEURAL_KEY_KEY, k); localStorage.setItem(NEURAL_PROVIDER_KEY, p || 'gemini'); }
    else    { localStorage.removeItem(NEURAL_KEY_KEY); localStorage.removeItem(NEURAL_PROVIDER_KEY); }
}

// ─── CLOUD SYNC ───────────────────────────────────────────────
// Opt-in. Player data pushed to Firestore only with explicit consent.
// All AI keys stored locally only — never synced.
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
        // Never sync API keys
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
        const res  = await fetch('/data/quests.json');
        const data = await res.json();
        return data.quests;
    } catch(e) {
        console.warn('[SYD] Could not load quests.json:', e);
        return [];
    }
}

// ─── NAV + HISTORY ───────────────────────────────────────────
const NAV_HISTORY = [];
const NAV_EXCLUDE = ['screen-scan', 'screen-path', 'screen-path-chronicler', 'screen-path-reimaginer', 'screen-path-loading'];

function navTo(screenId) { playUIClick(); showScreen(screenId); }

function goBack() {
    playUIClick();
    const dest = NAV_HISTORY.pop() || 'screen-status';
    showScreen(dest, true);
}

// ─── RELAUNCH BOOT ───────────────────────────────────────────
// Shown when an existing operative relaunches the app.
// Short terminal sequence with momentum delta.
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

    // Screen-specific hooks
    if (id === 'screen-status') {
        startStatusAmbient();
        updateStatusScreen();
    } else {
        stopStatusAmbient();
    }

    if (id === 'screen-minigames' && typeof renderMiniGameHub === 'function') {
        renderMiniGameHub(player ? player.sig : 0);
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
    navigator.serviceWorker.register('/service-worker.js')
        .then(reg => {
            navigator.serviceWorker.addEventListener('message', e => {
                if (e.data && e.data.type === 'SW_UPDATED') {
                    // Only reload if a player already exists — never mid-onboarding
                    if (player) window.location.reload();
                }
            });
            // Send re-engagement check
            if (reg.active && player) {
                reg.active.postMessage({
                    type:           'CHECK_NOTIFICATION',
                    lastActiveDate: player.lastActiveDate || player.lastQuestDate,
                    playerName:     player.name
                });
                // Schedule tomorrow's morning notification
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
// Used by scan.js intro and relaunch boot. Returns a cancel function.
function typeText(el, text, speed, onDone) {
    let i = 0;
    el.textContent = '';
    const iv = setInterval(() => {
        el.textContent += text[i]; i++;
        if (i >= text.length) { clearInterval(iv); if (onDone) onDone(); }
    }, speed);
    return () => clearInterval(iv);
}

// ─── INIT ────────────────────────────────────────────────────
async function init() {
    applySoundState(loadSoundState());

    const questsPromise = loadQuests();
    player              = loadPlayer();
    currentGear         = loadGear();

    // ── Wire global buttons ───────────────────────────────────
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) soundToggle.addEventListener('click', cycleSoundState);

    const installConfirm  = document.getElementById('install-confirm-btn');
    const installDismiss  = document.getElementById('install-dismiss-btn');
    if (installConfirm)  installConfirm.addEventListener('click',  () => { playUIClick(); acceptInstall(); });
    if (installDismiss)  installDismiss.addEventListener('click',  () => { playUIClick(); dismissInstall(); });

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
    showScreen('screen-status');
    registerServiceWorker();
    // Initialise daily loop — morning transmission, mid-day nudge, midnight close check
    if (typeof initDailyLoop === 'function') initDailyLoop();
}

// ─── NEW OPERATIVE FLOW ──────────────────────────────────────
// The full onboarding sequence for a new operative:
//   1. Name entry (terminal screen)
//   2. Scan (scan.js — three experiences)
//   3. PATH Protocol (path.js — Chronicler or Re-imaginer)
//   4. createPlayer() with trait seeds + PATH seeds
//   5. First Transmission overlay
//   6. Status Window (OPERATIVE tab)

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

    const linesEl    = document.getElementById('onboarding-lines');
    const nameSection = document.getElementById('onboarding-name-section');
    const nameInput  = document.getElementById('onboarding-name-input');
    const nameBtn    = document.getElementById('onboarding-name-btn');

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

    // Tap anywhere on the terminal to skip typing
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

// ─── BRIDGE: NAME → SCAN ─────────────────────────────────────
function startScan(name) {
    // Stash name temporarily until createPlayer is called
    window._pendingOperativeName = name;

    if (typeof runScan === 'function') {
        runScan(name, (scanTraits) => {
            // Scan complete — move to PATH Protocol
            startPATH(name, scanTraits);
        });
    } else {
        // scan.js not loaded — skip to PATH with no traits
        startPATH(name, {});
    }
}

// ─── BRIDGE: SCAN → PATH ─────────────────────────────────────
function startPATH(name, scanTraits) {
    window._pendingScanTraits = scanTraits;

    if (typeof runPATH === 'function') {
        runPATH(scanTraits, (pathData) => {
            // PATH complete — create operative
            stopStatusAmbient();
            createPlayer(name, scanTraits, pathData);
        });
    } else {
        // path.js not loaded — create player with scan traits only
        createPlayer(name, scanTraits, null);
    }
}

document.addEventListener('DOMContentLoaded', init);