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
//     routes to OPS tab → DIRECTIVES segment
//
// RESPEC changes:
//   - STARTING_SIG constant added (20 SIG on account creation)
//   - sig: STARTING_SIG in createPlayer() (was sig: 0)
//   - switchStatusTab now handles 'ops' and 'status' only (two tabs)
//   - First transmission dismiss → switchStatusTab('ops') +
//     switchOpsSegment('directives')
//   - Morning transmission dismiss → switchStatusTab('status')
//   - completeQuest() directive re-render guard updated to use
//     activeOpsSegment === 'directives' (not activeStatusTab)
//   - showScreen routing updated: screen-minigames and encounter
//     now route into OPS segments rather than standalone screens
//   - saveGear() updated: triggers renderStatusWindow re-render only
//
// BLOCK B changes:
//   - Career skill constants: CAREER_SKILL_SOFT_CAPS,
//     CAREER_SKILL_PASSIVE_INCREMENT, CAREER_SKILL_DIRECTIVE_INCREMENT,
//     CAREER_SKILL_ENCOUNTER_INCREMENT, CAREER_DIRECTIVES_PER_GEAR
//   - Career skill storage: loadCareerSkills(), saveCareerSkills()
//   - Career skill init: initCareerSkillsFromPath() — derives locally-
//     estimated tracks from PATH gap skills when Gemini not available.
//     Block C replaces with full Gemini-seeded tracks from Call 2.
//   - getCareerSkillSoftCap(rank) — returns soft cap for rank tier
//   - incrementCareerSkills(questId, stat, isCareerDirective) — called
//     from completeQuest() on every directive completion
//   - incrementCareerSkillsFromEncounter(careerSkillName) — called from
//     encounter completion (encounter.js calls this on submit)
//   - completeQuest() updated to call incrementCareerSkills()
//   - createPlayer() updated to call initCareerSkillsFromPath()
//   - pushToCloud() updated to include career skills in profile document
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

// ─── RESPEC CONSTANTS ─────────────────────────────────────────
// [TUNING TARGET] Starting SIG awarded to every new operative on account creation.
// Covers approximately 4 game sessions before any directive income arrives.
const STARTING_SIG = 20;

// ─── BLOCK B: CAREER SKILL CONSTANTS ─────────────────────────
// Soft cap on career skill score per rank tier.
// Score cannot exceed this value until operative crosses to the next rank.
// At A-rank and above, the cap is removed entirely.
// [TUNING TARGET] Soft cap values per rank label
const CAREER_SKILL_SOFT_CAPS = {
    'F':   40,
    'E':   60,
    'D':   75,
    'C':   88,
    'B':   94,
    'A':   100,
    'S':   100,
    'S+':  100,
    'SS':  100,
    'SS+': 100,
    'SSS': 100
};

// Increment per completion type.
// Passive: any static directive whose stat maps to the career skill's stat.
// Directive: a career directive tagged directly to this career skill.
// Encounter: a career encounter in this skill's domain.
// [TUNING TARGET] Career skill increment values
const CAREER_SKILL_PASSIVE_INCREMENT   = 0.2;
const CAREER_SKILL_DIRECTIVE_INCREMENT = 0.8;
const CAREER_SKILL_ENCOUNTER_INCREMENT = 1.5;

// Number of career directives mixed in per gear level.
// These are additive on top of the life-stat directives (5/10/15).
// Applied only after Tier 0 window (operatorDays > 7) and when career cache exists.
// [TUNING TARGET] Career directives per gear
const CAREER_DIRECTIVES_PER_GEAR = { 1: 3, 2: 5, 3: 7 };

// localStorage key for career skill tracks
const CAREER_SKILLS_KEY = 'syd_career_skills';

// localStorage key for career directive cache (seeded by Gemini Call 2, refreshed by Call 4)
const CAREER_DIRECTIVES_KEY = 'syd_career_directives';

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

// ─── CREATE PLAYER ───────────────────────────────────────────
// RESPEC: sig initialised to STARTING_SIG (was 0).
// BLOCK B: initCareerSkillsFromPath() called after player created.
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
        sig:             STARTING_SIG,   // RESPEC: 20 starting SIG (was 0)
        scanComplete:    true,
        pathComplete:    !!pathData,
        pathData:        pathData || null,
        hasSeenBriefing: false
    };

    if (pathData && typeof savePathData === 'function') {
        savePathData(pathData);
    }

    // BLOCK B: Initialise career skill tracks from PATH data.
    // Uses locally-estimated names from gap skills if Gemini not available.
    // Block C will overwrite these with Gemini-generated tracks from Call 2.
    initCareerSkillsFromPath(pathData);

    savePlayer();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear(), player.operatorDays);
    updateStatusScreen();

    // RESPEC: Route to screen-status → STATUS tab on creation.
    // First transmission will dismiss to OPS tab → DIRECTIVES segment.
    showScreen('screen-status');
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

// ═══════════════════════════════════════════════════════════════
// BLOCK B: CAREER SKILLS SYSTEM
// Storage, initialisation, increment, and soft cap enforcement.
// ═══════════════════════════════════════════════════════════════

// ─── STORAGE ─────────────────────────────────────────────────
function loadCareerSkills() {
    try {
        const raw = localStorage.getItem(CAREER_SKILLS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) {
        return [];
    }
}

function saveCareerSkills(tracks) {
    try {
        localStorage.setItem(CAREER_SKILLS_KEY, JSON.stringify(tracks));
    } catch(e) {
        console.warn('[SYD] Could not save career skills:', e);
    }
}

// ─── SOFT CAP LOOKUP ─────────────────────────────────────────
// Returns the soft cap for the operative's current rank.
function getCareerSkillSoftCap(rank) {
    return CAREER_SKILL_SOFT_CAPS[rank] || CAREER_SKILL_SOFT_CAPS['F'];
}

// ─── INITIALISE FROM PATH ────────────────────────────────────
// Called from createPlayer() after PATH data is stored.
// Derives locally-estimated career skill tracks from the gap skills
// already in the PATH data — no Gemini call needed.
//
// Each gap skill becomes a track. The stat for each track is mapped
// from the gap skill name using keyword matching on the stat keywords.
// Description is a generic placeholder that Block C replaces with
// Gemini's personalised description from Call 2.
//
// If career skills already exist in localStorage (e.g. Block C already
// seeded them), this function is a no-op to avoid overwriting richer data.
function initCareerSkillsFromPath(pathData) {
    // If tracks already exist and are non-empty, do not overwrite them.
    const existing = loadCareerSkills();
    if (existing && existing.length > 0) return;

    if (!pathData) {
        saveCareerSkills([]);
        return;
    }

    // Get gap skills from PATH data — these become the track names.
    // Priority: gapAnalysis.skills (from local fallback or Gemini Call 2 partial),
    // then confirmedPath.gap_skills, then confirmedPath.mapped_skills as last resort.
    const gapSkills = (pathData.gapAnalysis && pathData.gapAnalysis.skills && pathData.gapAnalysis.skills.length > 0)
        ? pathData.gapAnalysis.skills
        : ((pathData.confirmedPath && pathData.confirmedPath.gap_skills && pathData.confirmedPath.gap_skills.length > 0)
            ? pathData.confirmedPath.gap_skills
            : ((pathData.confirmedPath && pathData.confirmedPath.mapped_skills)
                ? pathData.confirmedPath.mapped_skills
                : []));

    if (!gapSkills || gapSkills.length === 0) {
        saveCareerSkills([]);
        return;
    }

    // Cap at 5 tracks — the respec specifies 3–5.
    const capped = gapSkills.slice(0, 5);

    const rank     = rankFromLevel(calculateLevel ? calculateLevel() : 1);
    const softCap  = getCareerSkillSoftCap(rank);
    const pathName = (pathData.confirmedPath && pathData.confirmedPath.path_name) || '';

    const tracks = capped.map((skillName, i) => {
        // Map skill to a life stat using keyword matching.
        const stat = guessStatFromSkillName(skillName);

        return {
            id:          'cs_' + String(i + 1).padStart(3, '0'),
            name:        skillName,
            stat,
            score:       0,
            softCap,
            pathName,
            // Generic description — replaced by Block C with Gemini version.
            description: `${skillName} is a key professional capability for the ${pathName || 'your confirmed'} path. ${getLocalSkillDescription(rank)}`,
            geminiEnhanced: false
        };
    });

    saveCareerSkills(tracks);
    console.log('[SYD] Career skill tracks initialised from PATH data:', tracks.map(t => t.name));
}

// Maps a skill name string to the most relevant life stat via keyword matching.
// Used as a local fallback when Gemini has not returned explicit stat mappings.
function guessStatFromSkillName(skillName) {
    const lower = (skillName || '').toLowerCase();
    if (/communicat|stakeholder|influence|relationship|network|present|lead|trust|persuad|negotiat|social|people/.test(lower)) return 'charisma';
    if (/strateg|analys|research|data|system|architect|think|model|knowledge|learn|problem/.test(lower)) return 'intelligence';
    if (/adapt|pivot|change|flexible|agile|creative|innovate|experiment|risk/.test(lower)) return 'agility';
    if (/deliver|execut|operati|manage|project|timeline|output|consistent|follow/.test(lower)) return 'endurance';
    if (/physical|health|energy|strength|resilience|endure|sustain|pressure/.test(lower)) return 'strength';
    return 'intelligence'; // default — intelligence is the most broadly applicable
}

// Brief local description per rank for the placeholder text.
function getLocalSkillDescription(rank) {
    const reads = {
        'F': 'Closing this gap early creates compounding returns. The directives here are calibrated to build it from the ground up.',
        'E': 'Your experience has created the context to develop this deliberately. The gap is ready to close.',
        'D': 'You understand the concept. The development target is consistent execution under real conditions.',
        'C': 'At your rank, this gap is the difference between good and respected. It is mostly application now.',
        'B': 'This operates at the influence layer. Closing it moves you from doing well to making systems work better.',
        'A': 'The remaining gap here is in edge cases — situations that do not fit the patterns you have already mastered.'
    };
    return reads[rank] || reads['F'];
}

// ─── INCREMENT CAREER SKILLS ─────────────────────────────────
// Called from completeQuest() on every directive completion.
// questId: the directive's id (used to look up career_skill tag if it exists)
// stat: the life stat trained by this directive
// isCareerDirective: true if this directive came from the career pool (has career_skill field)
// careerSkillName: the career_skill field value from the directive (Block C adds this)
function incrementCareerSkills(questId, stat, isCareerDirective, careerSkillName) {
    const tracks = loadCareerSkills();
    if (!tracks || tracks.length === 0) return;

    const rank    = rankFromLevel(calculateLevel ? calculateLevel() : 1);
    const softCap = getCareerSkillSoftCap(rank);
    let   changed = false;

    tracks.forEach(track => {
        let increment = 0;

        if (isCareerDirective && careerSkillName && track.name === careerSkillName) {
            // Direct career directive for this exact skill
            increment = CAREER_SKILL_DIRECTIVE_INCREMENT;
        } else if (!isCareerDirective && track.stat === stat) {
            // Passive accumulation — static directive whose stat maps to this skill's stat
            increment = CAREER_SKILL_PASSIVE_INCREMENT;
        }

        if (increment > 0) {
            // Apply soft cap — score cannot exceed the current rank's ceiling
            const effectiveCap = Math.min(softCap, track.softCap || softCap);
            const newScore     = Math.min(effectiveCap, parseFloat((track.score + increment).toFixed(2)));
            if (newScore !== track.score) {
                track.score = newScore;
                changed     = true;
            }
        }
    });

    if (changed) {
        // Update softCap on all tracks in case rank changed since last save
        tracks.forEach(t => { t.softCap = softCap; });
        saveCareerSkills(tracks);
    }
}

// ─── INCREMENT FROM ENCOUNTER ─────────────────────────────────
// Called by encounter.js when a career encounter is submitted.
// careerSkillName: the career skill domain of the encounter (matches track name).
// Falls back gracefully if name does not match any track — no error.
function incrementCareerSkillsFromEncounter(careerSkillName) {
    if (!careerSkillName) return;
    const tracks = loadCareerSkills();
    if (!tracks || tracks.length === 0) return;

    const rank    = rankFromLevel(calculateLevel ? calculateLevel() : 1);
    const softCap = getCareerSkillSoftCap(rank);
    let   changed = false;

    tracks.forEach(track => {
        if (track.name === careerSkillName) {
            const effectiveCap = Math.min(softCap, track.softCap || softCap);
            const newScore     = Math.min(effectiveCap, parseFloat((track.score + CAREER_SKILL_ENCOUNTER_INCREMENT).toFixed(2)));
            if (newScore !== track.score) {
                track.score = newScore;
                changed     = true;
            }
        }
    });

    if (changed) {
        tracks.forEach(t => { t.softCap = softCap; });
        saveCareerSkills(tracks);
        // Re-render STATUS if it is the active tab to reflect the update
        if (typeof activeStatusTab !== 'undefined' && activeStatusTab === 'status'
            && typeof renderStatusWindow === 'function') {
            renderStatusWindow(false);
        }
    }
}

// ─── SOFT CAP UPDATE ON RANK-UP ──────────────────────────────
// Called from the level-up check in completeQuest() when a rank boundary is crossed.
// Raises the softCap on all career skill tracks and notifies the operative.
function updateCareerSkillSoftCaps(newRank) {
    const tracks = loadCareerSkills();
    if (!tracks || tracks.length === 0) return;

    const newCap    = getCareerSkillSoftCap(newRank);
    let   raised    = false;

    tracks.forEach(track => {
        if ((track.softCap || 0) < newCap) {
            track.softCap = newCap;
            raised        = true;
        }
    });

    if (raised) {
        saveCareerSkills(tracks);
        if (typeof showLog === 'function') {
            showLog('[ CAREER SKILL CEILING RAISED — NEW RANGE UNLOCKED ]', 'accent');
        }
    }
}

// ─── FIRST TRANSMISSION ──────────────────────────────────────
// Fires once on first ever launch, after onboarding completes.
// RESPEC: Dismiss routes to OPS tab → DIRECTIVES segment.
const FIRST_TX_LINES = [
    'THIS IS YOUR TERMINAL.',
    'YOUR STATS ARE CONSEQUENCES OF YOUR REAL-WORLD ACTIONS — NOT SCORES.',
    'COMPLETE TODAY\'S DIRECTIVES AND THEY RISE.',
    'MOMENTUM TRACKS CONSISTENCY. CONSECUTIVE DAYS COMPOUND IT.',
    'SIG IS EARNED THROUGH EXECUTION. SPEND IT IN THE GAMES SECTION.',
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

    let idx = 0;
    function nextLine() {
        if (idx === FIRST_TX_LINES.length) {
            setTimeout(() => btn.classList.remove('hidden'), 600);
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

    // RESPEC: Dismiss → OPS tab → DIRECTIVES segment
    btn.onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
        player.hasSeenBriefing = true;
        savePlayer();
        // Land on OPS tab, DIRECTIVES segment — operative needs to see their directives
        if (typeof switchStatusTab === 'function') switchStatusTab('ops');
        if (typeof switchOpsSegment === 'function') switchOpsSegment('directives');
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
// RESPEC: Guard updated from activeStatusTab === 'directives' to
// activeOpsSegment === 'directives' (segment state, not tab state).
// BLOCK B: incrementCareerSkills() called after stat/sig/capacity updates.
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

    // ── BLOCK B: Career skill increment ──────────────────────
    // Look up the quest in dailyQuests to check if it is a career directive
    // and to get the career_skill name (populated by Block C).
    const questObj        = (dailyQuests || []).find(q => q.id === id);
    const isCareerDir     = !!(questObj && questObj._isCareerDirective);
    const careerSkillName = questObj ? (questObj.career_skill || null) : null;
    incrementCareerSkills(id, stat, isCareerDir, careerSkillName);

    // ── Level up check ───────────────────────────────────────
    const prevLevel = levelFromXP(Math.max(0, earnedXP(player.stats) - statGain));
    const newLevel  = calculateLevel();
    if (newLevel > prevLevel) {
        showLevelUpOverlay(newLevel);
        player.maxCapacity = calcMaxCapacity(newLevel);
        savePlayer();

        // BLOCK B: Check if rank crossed a tier boundary and update career skill caps
        const prevRank = rankFromLevel(prevLevel);
        const newRank  = rankFromLevel(newLevel);
        if (prevRank !== newRank) {
            updateCareerSkillSoftCaps(newRank);
        }
    }

    updateStatusScreen();

    // RESPEC: Re-render directives list only when DIRECTIVES segment is active
    if (typeof activeOpsSegment !== 'undefined' && activeOpsSegment === 'directives'
        && typeof renderDirectivesSegment === 'function') {
        const content = document.getElementById('ops-segment-content');
        if (content) renderDirectivesSegment(content);
    }

    const allNowDone = (player.completedToday || []).length >= (dailyQuests || []).length && (dailyQuests || []).length > 0;
    if (allNowDone && typeof shouldShowCloseOfDay === 'function' && shouldShowCloseOfDay()) {
        setTimeout(() => { if (typeof triggerCloseOfDay === 'function') triggerCloseOfDay(); }, 1800);
    }

    maybeSyncToCloud();
}

// ─── STATUS SCREEN ────────────────────────────────────────────
// RESPEC: Header no longer includes sig badge (sig shown in OPS/GAMES section).
function updateStatusScreen(animate) {
    if (!player) return;

    const level  = calculateLevel();
    const rank   = rankFromLevel(level);
    const nameEl  = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const rankEl  = document.getElementById('rank-badge');

    if (nameEl)  nameEl.textContent  = player.name;
    if (levelEl) levelEl.textContent = level;
    if (rankEl)  { rankEl.textContent = rank; rankEl.className = 'rank-badge ' + rankCssClass(rank); }
    const sigEl = document.getElementById('player-sig');
    if (sigEl)   sigEl.textContent = Math.floor(player.sig || 0);

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
// BLOCK B: pushToCloud() now includes career skill tracks in the profile document.
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
                consecutiveDays, name } = player;

        // Load all restorable localStorage keys
        const careerSkills    = loadCareerSkills();
        const pathData        = (typeof loadPathData === 'function')        ? loadPathData()        : null;
        const scanTraits      = (typeof loadScanTraits === 'function')      ? loadScanTraits()      : null;
        const scanCommentary  = localStorage.getItem('syd_scan_commentary') || null;
        const signalTrans     = localStorage.getItem('syd_signal_translation') || null;
        const careerDirs      = localStorage.getItem('syd_career_directives')  || null;
        const careerEncs      = localStorage.getItem('syd_career_encounters')  || null;
        const fieldNotes      = localStorage.getItem(FIELD_NOTES_KEY)          || null;
        const gear            = localStorage.getItem(GEAR_KEY)                 || '1';

        await database.collection('syd_operatives').doc(uid).set({
            name, stats, sig, momentum, capacity, maxCapacity,
            operatorDays, consecutiveDays,
            careerSkills,
            pathData,
            scanTraits,
            scanCommentary,
            signalTranslation: signalTrans,
            careerDirectives:  careerDirs,
            careerEncounters:  careerEncs,
            fieldNotes,
            gear,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        localStorage.setItem(SYNC_LAST_PUSH_KEY, new Date().toISOString());
    } catch(e) {
        console.warn('[SYD] Cloud sync failed:', e);
    }
}

function generateUID() {
    return 'syd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── PULL FROM CLOUD ─────────────────────────────────────────
// Reads a full operative record from Firestore by UID.
// Clears all local SYD data first (clean restore), then writes
// every restorable field back to localStorage.
// Returns { ok: true } on success, { ok: false, error } on failure.
async function pullFromCloud(uid) {
    const database = getDB();
    if (!database) return { ok: false, error: 'Database not available.' };
    try {
        const doc = await database.collection('syd_operatives').doc(uid.trim()).get();
        if (!doc.exists) return { ok: false, error: 'not_found' };

        const data = doc.data();
        if (!data || !data.name || !data.stats) return { ok: false, error: 'corrupt' };

        // ── Clear all SYD localStorage keys (clean slate) ────────
        const sydKeys = [
            STORAGE_KEY, GEAR_KEY, SYNC_OPTED_IN_KEY, SYNC_LAST_PUSH_KEY,
            NEURAL_KEY_KEY, NEURAL_PROVIDER_KEY, FIELD_NOTES_KEY, AUDIO_MINUTES_KEY,
            CAREER_SKILLS_KEY, CAREER_DIRECTIVES_KEY,
            'syd_path_data', 'syd_scan_traits', 'syd_scan_commentary',
            'syd_signal_translation', 'syd_career_directives', 'syd_career_encounters',
            'syd_game_firstplay_cascade', 'syd_game_firstplay_drift',
            'syd_game_firstplay_echo', 'syd_game_firstplay_flow',
            'syd_game_firstplay_resonance', 'syd_sound'
        ];
        sydKeys.forEach(k => localStorage.removeItem(k));

        // ── Reconstruct player object ──────────────────────────────
        const restoredPlayer = {
            name:            data.name,
            stats:           data.stats,
            sig:             data.sig             || 0,
            momentum:        data.momentum         || 1.0,
            capacity:        data.capacity         || 100,
            maxCapacity:     data.maxCapacity      || 100,
            operatorDays:    data.operatorDays     || 1,
            consecutiveDays: data.consecutiveDays  || 1,
            uid:             uid.trim(),
            syncOptedIn:     true,
            completedToday:  [],
            lastQuestDate:   today(),
            lastActiveDate:  today(),
            scanComplete:    true,
            pathComplete:    !!(data.pathData),
            pathData:        data.pathData || null,
            hasSeenBriefing: true
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredPlayer));

        // ── Restore all other keys ─────────────────────────────────
        if (data.careerSkills)       localStorage.setItem(CAREER_SKILLS_KEY,          JSON.stringify(data.careerSkills));
        if (data.pathData)           localStorage.setItem('syd_path_data',            JSON.stringify(data.pathData));
        if (data.scanTraits)         localStorage.setItem('syd_scan_traits',           JSON.stringify(data.scanTraits));
        if (data.scanCommentary)     localStorage.setItem('syd_scan_commentary',       data.scanCommentary);
        if (data.signalTranslation)  localStorage.setItem('syd_signal_translation',   data.signalTranslation);
        if (data.careerDirectives)   localStorage.setItem('syd_career_directives',    data.careerDirectives);
        if (data.careerEncounters)   localStorage.setItem('syd_career_encounters',    data.careerEncounters);
        if (data.fieldNotes)         localStorage.setItem(FIELD_NOTES_KEY,            data.fieldNotes);
        if (data.gear)               localStorage.setItem(GEAR_KEY,                   data.gear);

        return { ok: true, preview: { name: data.name, stats: data.stats } };
    } catch(e) {
        console.warn('[SYD] pullFromCloud failed:', e);
        return { ok: false, error: e.message || 'Network error.' };
    }
}

// ─── RESTORE FROM SYNC ID ────────────────────────────────────
// Renders the Sync ID entry + restore flow.
// onDone: called if operative cancels and returns to caller context.
// On successful restore, reloads the page (cleanest re-boot path).
function renderRestoreFromSyncID(onDone) {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) { if (onDone) onDone(); return; }

    function renderEntry(prefill, errorMsg) {
        container.innerHTML = `
            <div class="restore-wrap">
                <p class="restore-label">[ RESTORE YOUR RECORD ]</p>
                <p class="restore-syd-line">Enter your Sync ID to restore your record on this device.</p>
                <p class="restore-syd-line restore-caveat">Your stats, career path, directives, scan traits, and journal will be restored. Your Gemini key cannot be recovered — it is stored on your original device only.</p>
                ${errorMsg ? `<p class="restore-error">${errorMsg}</p>` : ''}
                <div class="restore-input-group">
                    <input
                        type="text"
                        id="restore-uid-input"
                        class="settings-input restore-uid-input"
                        placeholder="syd_..."
                        spellcheck="false"
                        autocomplete="off"
                        value="${prefill || ''}"
                    />
                </div>
                <button class="btn btn--primary" id="restore-submit-btn">[ RESTORE ]</button>
                <button class="restore-cancel-btn" id="restore-cancel-btn">cancel</button>
            </div>
        `;

        setTimeout(() => {
            const input = document.getElementById('restore-uid-input');
            if (input) input.focus();
        }, 150);

        document.getElementById('restore-submit-btn').addEventListener('click', () => {
            playUIClick();
            const uid = document.getElementById('restore-uid-input').value.trim();
            if (!uid) { showLog('[ ENTER YOUR SYNC ID ]', 'system'); return; }
            renderLoading(uid);
        });

        document.getElementById('restore-cancel-btn').addEventListener('click', () => {
            playUIClick();
            if (onDone) onDone();
        });
    }

    function renderLoading(uid) {
        container.innerHTML = `
            <div class="restore-wrap">
                <p class="restore-label">[ LOCATING RECORD... ]</p>
                <p class="restore-syd-line">Standing by.</p>
            </div>
        `;
        pullFromCloud(uid).then(result => {
            if (!result.ok) {
                const msg = result.error === 'not_found'
                    ? 'No operative found for that Sync ID. Check the ID and try again.'
                    : 'Something went wrong. Check your connection and try again.';
                renderEntry(uid, msg);
            } else {
                renderConfirm(uid, result.preview);
            }
        });
    }

    function renderConfirm(uid, preview) {
        const level = preview.stats
            ? levelFromXP(Math.max(0, earnedXP(preview.stats)))
            : '—';
        const rank = preview.stats ? rankFromLevel(level) : '—';

        container.innerHTML = `
            <div class="restore-wrap">
                <p class="restore-label">[ RECORD LOCATED ]</p>
                <div class="restore-preview">
                    <p class="restore-preview-name">${preview.name}</p>
                    <p class="restore-preview-meta">LEVEL ${level} &middot; ${rank}-RANK</p>
                </div>
                <p class="restore-syd-line">This will replace any data currently on this device.</p>
                <button class="btn btn--primary" id="restore-confirm-btn">[ CONFIRM RESTORE ]</button>
                <button class="restore-cancel-btn" id="restore-cancel2-btn">cancel</button>
            </div>
        `;

        document.getElementById('restore-confirm-btn').addEventListener('click', () => {
            playUIClick();
            // Data already written to localStorage by pullFromCloud.
            // Reload to boot as returning operative cleanly.
            window.location.reload();
        });

        document.getElementById('restore-cancel2-btn').addEventListener('click', () => {
            playUIClick();
            if (onDone) onDone();
        });
    }

    renderEntry('', '');
}

// ─── CLOUD SYNC HELPERS ───────────────────────────────────────
// getCloudSyncEnabled / getCurrentUID are called by dailyloop.js.
// Cloud sync is independent of Neural Link — any operative can opt in.

function getCloudSyncEnabled() {
    return !!(player && player.syncOptedIn);
}

function getCurrentUID() {
    if (!player) return null;
    if (!player.uid) { player.uid = generateUID(); savePlayer(); }
    return player.uid;
}

// Opt the operative into cloud sync. Assigns a UID if none exists,
// sets syncOptedIn on the player object, persists, and fires an
// immediate push so their data is backed up right away.
function enableCloudSync() {
    if (!player) return;
    if (!player.uid) { player.uid = generateUID(); }
    player.syncOptedIn = true;
    savePlayer();
    pushToCloud(true);
}

// Renders the cloud sync opt-in screen.
// onDone: called when operative confirms or skips.
function renderCloudSyncOptIn(onDone) {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) { if (onDone) onDone(); return; }

    function renderEnableMode() {
        container.innerHTML = `
            <div class="cloud-sync-optin-wrap">
                <p class="cso-label">[ CLOUD SYNC ]</p>
                <div class="cso-mode-row">
                    <button class="cso-mode-btn cso-mode-btn--active" id="cso-mode-enable">ENABLE</button>
                    <button class="cso-mode-btn" id="cso-mode-restore">RESTORE FROM ID</button>
                </div>
                <p class="cso-syd-line">Your career path and progress are currently on this device only.</p>
                <p class="cso-syd-line">Enable cloud sync and they follow you — open SYD on any device and pick up exactly where you left off.</p>
                <p class="cso-syd-line">No account needed. Your data is stored under a private ID. Nothing is shared.</p>
                <button class="btn btn--primary" id="cso-enable-btn">[ ENABLE CLOUD SYNC ]</button>
                <button class="cso-skip-btn" id="cso-skip-btn">Not now — keep it local</button>
            </div>
        `;
        document.getElementById('cso-mode-restore').addEventListener('click', () => {
            playUIClick(); renderRestoreMode();
        });
        document.getElementById('cso-enable-btn').addEventListener('click', () => {
            playUIClick();
            enableCloudSync();
            const uid = player && player.uid ? player.uid : '—';
            container.innerHTML = `
                <div class="cloud-sync-optin-wrap">
                    <p class="cso-label">[ CLOUD SYNC ACTIVE ]</p>
                    <p class="cso-syd-line">Your data is now backed up. To access it on another device, use your Sync ID below.</p>
                    <div class="csm-id-block">
                        <span class="csm-id-label">YOUR SYNC ID</span>
                        <span class="csm-id-value" id="cso-uid-display">${uid}</span>
                        <span class="csm-id-note">Copy this. On a new device, tap Manage Sync and enter it to restore your data.</span>
                    </div>
                    <button class="btn btn--primary" id="cso-copy-btn">[ COPY SYNC ID ]</button>
                    <button class="btn btn--primary" id="cso-done-btn">[ CONTINUE ]</button>
                </div>
            `;
            document.getElementById('cso-copy-btn').addEventListener('click', () => {
                playUIClick();
                navigator.clipboard.writeText(uid).then(() => {
                    const btn = document.getElementById('cso-copy-btn');
                    if (btn) { btn.textContent = '✓ COPIED'; setTimeout(() => { btn.textContent = '[ COPY SYNC ID ]'; }, 2500); }
                }).catch(() => {});
            });
            document.getElementById('cso-done-btn').addEventListener('click', () => {
                playUIClick();
                if (onDone) onDone();
            });
            showLog('[ CLOUD SYNC ENABLED — DATA BACKED UP ]', 'accent');
        });

        document.getElementById('cso-skip-btn').addEventListener('click', () => {
            playUIClick();
            if (onDone) onDone();
        });
    }

    function renderRestoreMode() {
        container.innerHTML = `
            <div class="cloud-sync-optin-wrap">
                <p class="cso-label">[ CLOUD SYNC ]</p>
                <div class="cso-mode-row">
                    <button class="cso-mode-btn" id="cso-mode-enable">ENABLE</button>
                    <button class="cso-mode-btn cso-mode-btn--active" id="cso-mode-restore">RESTORE FROM ID</button>
                </div>
                <p class="cso-syd-line">Enter your Sync ID to restore your record on this device.</p>
                <p class="cso-syd-line restore-caveat">Your stats, career path, directives, scan traits, and journal will be restored. Your Gemini key cannot be recovered — it is stored on your original device only.</p>
                <div class="restore-input-group">
                    <input
                        type="text"
                        id="cso-restore-input"
                        class="settings-input restore-uid-input"
                        placeholder="syd_..."
                        spellcheck="false"
                        autocomplete="off"
                    />
                </div>
                <p class="restore-error hidden" id="cso-restore-error"></p>
                <button class="btn btn--primary" id="cso-restore-btn">[ RESTORE ]</button>
                <button class="cso-skip-btn" id="cso-skip-btn2">cancel</button>
            </div>
        `;
        document.getElementById('cso-mode-enable').addEventListener('click', () => {
            playUIClick(); renderEnableMode();
        });
        document.getElementById('cso-restore-btn').addEventListener('click', () => {
            playUIClick();
            const uid = document.getElementById('cso-restore-input').value.trim();
            if (!uid) { showLog('[ ENTER YOUR SYNC ID ]', 'system'); return; }
            const errEl = document.getElementById('cso-restore-error');
            if (errEl) { errEl.textContent = '[ LOCATING RECORD... ]'; errEl.classList.remove('hidden'); }
            pullFromCloud(uid).then(result => {
                if (!result.ok) {
                    const msg = result.error === 'not_found'
                        ? 'No operative found for that ID. Check and try again.'
                        : 'Something went wrong. Check your connection.';
                    if (errEl) errEl.textContent = msg;
                } else {
                    // Data written — reload for clean boot
                    window.location.reload();
                }
            });
        });
        document.getElementById('cso-skip-btn2').addEventListener('click', () => {
            playUIClick();
            if (onDone) onDone();
        });
    }

    renderEnableMode();
}

function renderCloudSyncManage(onDone) {
    showScreen('screen-path');
    const container = document.getElementById('path-content');
    if (!container) { if (onDone) onDone(); return; }

    const uid = player && player.uid ? player.uid : '—';

    container.innerHTML = `
        <div class="csm-wrap">
            <p class="csm-label">[ CLOUD SYNC — ACTIVE ]</p>
            <p class="csm-syd-line">Your data is syncing. To access it on another device, use your Sync ID.</p>
            <div class="csm-id-block">
                <span class="csm-id-label">YOUR SYNC ID</span>
                <span class="csm-id-value">${uid}</span>
                <span class="csm-id-note">Enter this ID on a new device under Manage Sync to restore your data.</span>
            </div>
            <button class="btn btn--primary" id="csm-copy-btn">[ COPY SYNC ID ]</button>
            <p class="csm-syd-line" style="margin-top:8px;">To restore on a new device, open SYD, go to Settings → Enable Cloud Sync → enter your Sync ID.</p>
            <button class="cso-skip-btn" id="csm-done-btn">← BACK</button>
        </div>
    `;

    document.getElementById('csm-copy-btn').addEventListener('click', () => {
        playUIClick();
        navigator.clipboard.writeText(uid).then(() => {
            const btn = document.getElementById('csm-copy-btn');
            if (btn) { btn.textContent = '✓ COPIED'; setTimeout(() => { btn.textContent = '[ COPY SYNC ID ]'; }, 2500); }
        }).catch(() => {});
    });

    document.getElementById('csm-done-btn').addEventListener('click', () => {
        playUIClick();
        if (onDone) onDone();
    });
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
const NAV_EXCLUDE = ['screen-title', 'screen-scan', 'screen-scan-reveal', 'screen-neural-request',
    'screen-path', 'screen-path-chronicler', 'screen-path-reimaginer',
    'screen-path-loading', 'screen-synthesis-reveal', 'screen-orientation'];

function navTo(screenId) { playUIClick(); showScreen(screenId); }

function goBack() {
    playUIClick();
    const dest = NAV_HISTORY.pop() || 'screen-status';
    showScreen(dest, true);
}

// ─── RELAUNCH BOOT ───────────────────────────────────────────
// RESPEC: After boot, lands on STATUS tab (returning operative reference view).
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
            // PASS 2: Show synthesis reveal → signal translation → orientation → createPlayer
            renderSynthesisReveal(pathData, () => {
                renderSignalTranslationScreen(() => {
                    renderCloudSyncOptIn(() => {
                        renderOrientationScreen(() => {
                            createPlayer(name, scanTraits, pathData);
                        });
                    });
                });
            });
        });
    } else {
        createPlayer(name, scanTraits, null);
    }
}

// ─── ONBOARDING BACK NAVIGATION ─────────────────────────────
// Onboarding screens are excluded from NAV_HISTORY (they are one-way
// by design). This function handles explicit back navigation within
// the onboarding flow only. Each screen re-renders its predecessor.
function onboardingBack(fromScreen) {
    playUIClick();
    switch(fromScreen) {
        case 'track-select':
            // Back from track selection → name entry
            showScreen('screen-onboarding');
            renderNameEntry();
            break;
        case 'chronicler':
            // Back from CV paste → track selection
            showScreen('screen-path');
            if (typeof renderPathSelect === 'function') renderPathSelect();
            break;
        case 'reimaginer':
            // Back from re-imaginer → track selection
            showScreen('screen-path');
            if (typeof renderPathSelect === 'function') renderPathSelect();
            break;
        case 'rank-confirm':
            // Back from rank confirmation → role mapping round 0
            if (typeof runRoleMapping === 'function') runRoleMapping(0);
            break;
        default:
            break;
    }
}

// ─── OPS: SIGNAL TRANSLATION ENTRY ──────────────────────────
function openSignalTranslation() {
    if (typeof renderSignalTranslationOPS === 'function') {
        renderSignalTranslationOPS();
    }
}

// ─── PASS 2: POST-SCAN REVEAL SCREEN ─────────────────────────
function renderScanReveal(scanTraits, onDone) {
    showScreen('screen-scan-reveal');
    const container = document.getElementById('scan-reveal-content');
    if (!container) { if (onDone) onDone(); return; }

    const traits = scanTraits || {};

    const sorted  = Object.entries(traits).sort((a, b) => b[1] - a[1]);
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

    const traitExplainers = {
        patternRecognition:   'How quickly you identify structure in unfamiliar information. High scorers read situations fast. Low scorers need more exposure before the pattern clicks.',
        cognitiveFlexibility: 'How well you adapt when the rules change mid-task. High scorers pivot cleanly. Low scorers get anchored to the previous approach.',
        persistence:          'Whether you keep attempting when the task is unclear or time is running out. High scorers stay engaged under uncertainty. Low scorers disengage early.',
        executionSpeed:       'How quickly you act on a clear target. High scorers are fast and decisive. Low scorers are deliberate — this is not always a weakness, but it affects high-velocity roles.',
        executionAccuracy:    'How precisely you hit what you aim at under time pressure. High scorers are clean and efficient. Low scorers sacrifice precision for speed — or freeze trying to be perfect.',
        pressureStability:    'How well your performance holds up as difficulty increases. High scorers are consistent across all conditions. Low scorers degrade under load — the directives address this directly.',
        socialReading:        'How accurately you read social situations and people\'s underlying motivations. High scorers navigate interpersonal dynamics well. Low scorers tend to read the surface, not the signal.'
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
                        <div class="srt-row srt-row--tappable" data-trait="${key}">
                            <div class="srt-row-header">
                                <span class="srt-name">${name}</span>
                                <span class="srt-pct" id="srt-pct-${key}">${score !== null ? pct + '%' : '—'}</span>
                            </div>
                            <div class="srt-bar-wrap">
                                <div class="srt-bar" id="srt-bar-${key}" style="width:0%"></div>
                            </div>
                            <div class="srt-explainer hidden" id="srt-exp-${key}"></div>
                        </div>
                    `;
                }).join('')}
            </div>
            <button class="btn btn--primary scan-reveal-proceed" id="scan-reveal-proceed">
                [ PROCEED TO CLASSIFICATION ]
            </button>
        </div>
    `;

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

    // Wire trait tap explainers
    document.querySelectorAll('.srt-row--tappable').forEach(row => {
        row.addEventListener('click', () => {
            playUIClick();
            const key     = row.dataset.trait;
            const expEl   = document.getElementById('srt-exp-' + key);
            if (!expEl) return;
            const isOpen  = !expEl.classList.contains('hidden');
            // Close all others first
            document.querySelectorAll('.srt-explainer').forEach(e => e.classList.add('hidden'));
            if (!isOpen) {
                expEl.textContent = traitExplainers[key] || '';
                expEl.classList.remove('hidden');
            }
        });
    });

    document.getElementById('scan-reveal-proceed').addEventListener('click', () => {
        playUIClick();
        if (onDone) onDone();
    });
}

// ─── PASS 2: NEURAL KEY REQUEST SCREEN ──────────────────────
function renderNeuralKeyRequest(onDone) {
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
                <p class="nr-syd-line">I can read your record specifically — your actual CV, your actual pattern — and give you roles, career directives, and CV language built for you.</p>
                <p class="nr-syd-line">Without this, I will read you from a local model. It works. But your role matches will be approximate and your CV reframe will be generic — not written from what you actually built.</p>
                <p class="nr-syd-line">To activate the full read, connect a free Gemini key. Takes about 60 seconds.</p>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
               class="btn btn--primary nr-get-key-btn">
                [ GET YOUR FREE GEMINI KEY ]
            </a>
            <div class="nr-input-group">
                <input type="password" id="nr-key-input" class="settings-input nr-key-input"
                    placeholder="Paste your key here — AIza..." autocomplete="off" spellcheck="false" />
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
        if (!key) { showLog('[ PASTE YOUR KEY FIRST, OR TAP SKIP ]', 'system'); return; }
        if (key.length < 8) { showLog('[ KEY TOO SHORT — CHECK YOU COPIED THE FULL KEY ]', 'system'); return; }
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
function renderSynthesisReveal(pathData, onDone) {
    showScreen('screen-synthesis-reveal');
    const container = document.getElementById('synthesis-reveal-content');
    if (!container) { if (onDone) onDone(); return; }
    if (!pathData) { if (onDone) onDone(); return; }

    const pathName    = (pathData.confirmedPath && pathData.confirmedPath.path_name) || 'UNCLASSIFIED';
    const role        = pathData.confirmedRole || pathName;
    const rank        = pathData.confirmedRank || 'F';
    const skills      = (pathData.gapAnalysis && pathData.gapAnalysis.skills) || [];
    const top3Skills  = skills.slice(0, 3);
    const affinity    = pathData.hiddenAffinity;

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
    if (role && role !== pathName) sydLines.push(`Primary role: ${role}. That is where your record points.`);
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
                    <span class="sr-career-rank-label">${typeof careerRankLabel === 'function' ? careerRankLabel(rank) : rank}</span>
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
                <p class="or-syd-line">The <strong>GAMES</strong> section has five games that cost SIG to enter and train specific stats. SIG is earned by completing directives. You start with ${STARTING_SIG} SIG.</p>
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

    // Sound toggle stub — kept for any legacy calls
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) soundToggle.addEventListener('click', cycleSoundState);

    // ── New operative — title screen → onboarding → scan → PATH → createPlayer ─
    if (!player) {
        allQuests = await questsPromise;
        showScreen('screen-title');
        const titleBtn = document.getElementById('title-begin-btn');
        if (titleBtn) {
            titleBtn.addEventListener('click', () => {
                playUIClick();
                showScreen('screen-onboarding');
                runNewOperativeFlow();
            });
        }
        const restoreBtn = document.getElementById('title-restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                playUIClick();
                renderRestoreFromSyncID(() => {
                    showScreen('screen-title');
                });
            });
        }
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

    // RESPEC: Returning operative lands on STATUS tab (reference view)
    showScreen('screen-status');
    if (typeof switchStatusTab === 'function') switchStatusTab('status');

    registerServiceWorker();
    if (typeof initDailyLoop === 'function') initDailyLoop();
}

document.addEventListener('DOMContentLoaded', init);