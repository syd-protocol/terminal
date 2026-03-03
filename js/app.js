// ═══════════════════════════════════════════════════════════════
// LEVELUP — app.js
// ═══════════════════════════════════════════════════════════════

// ─── CONSTANTS ───────────────────────────────────────────────
const STORAGE_KEY = 'levelup_player';
const GEAR_KEY    = 'levelup_gear';
const STAT_NAMES  = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
const STAT_FLOOR  = 10;

// ─── LEVEL FORMULA ───────────────────────────────────────────
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
    { label: 'F',   minLevel: 1   },
    { label: 'E',   minLevel: 16  },
    { label: 'D',   minLevel: 31  },
    { label: 'C',   minLevel: 46  },
    { label: 'B',   minLevel: 61  },
    { label: 'A',   minLevel: 76  },
    { label: 'S',   minLevel: 91  },
    { label: 'S+',  minLevel: 101 },
    { label: 'SS',  minLevel: 121 },
    { label: 'SS+', minLevel: 151 },
    { label: 'SSS', minLevel: 200 }
];

function rankFromLevel(level) {
    let rank = RANKS[0];
    for (const r of RANKS) {
        if (level >= r.minLevel) rank = r;
    }
    return rank.label;
}

// ─── TITLE SYSTEM ────────────────────────────────────────────
const TITLES = [
    { minLevel: 1,   label: 'THE BEGINNER'     },
    { minLevel: 6,   label: 'THE MOTIVATED'    },
    { minLevel: 11,  label: 'THE CONSISTENT'   },
    { minLevel: 16,  label: 'THE DEVELOPING'   },
    { minLevel: 21,  label: 'THE EMERGING'     },
    { minLevel: 26,  label: 'THE GROUNDED'     },
    { minLevel: 31,  label: 'THE CAPABLE'      },
    { minLevel: 36,  label: 'THE RELIABLE'     },
    { minLevel: 41,  label: 'THE FOCUSED'      },
    { minLevel: 46,  label: 'THE DISCIPLINED'  },
    { minLevel: 51,  label: 'THE SKILLED'      },
    { minLevel: 56,  label: 'THE ACCOMPLISHED' },
    { minLevel: 61,  label: 'THE EXCEPTIONAL'  },
    { minLevel: 66,  label: 'THE RESPECTED'    },
    { minLevel: 71,  label: 'THE INFLUENTIAL'  },
    { minLevel: 76,  label: 'THE ELITE'        },
    { minLevel: 81,  label: 'THE MASTERFUL'    },
    { minLevel: 86,  label: 'THE RENOWNED'     },
    { minLevel: 91,  label: 'THE AWAKENED'     },
    { minLevel: 96,  label: 'THE TRANSCENDENT' },
    { minLevel: 101, label: 'THE LEGEND'       },
    { minLevel: 151, label: 'THE MYTH'         },
    { minLevel: 200, label: 'THE ETERNAL'      }
];

function titleFromLevel(level) {
    let title = TITLES[0];
    for (const t of TITLES) {
        if (level >= t.minLevel) title = t;
    }
    return title.label;
}

// ─── MOMENTUM ────────────────────────────────────────────────
function buildMomentum(consecutiveDays) {
    return parseFloat((1 + 0.5 * (1 - Math.exp(-consecutiveDays / 14))).toFixed(4));
}

function decayMomentum(current, missedDays) {
    if (missedDays <= 0) return current;
    const decayRates = [1, 0.95, 0.85, 0.75];
    const rate = missedDays >= 4
        ? Math.pow(0.65, missedDays - 2)
        : decayRates[missedDays];
    return parseFloat(Math.max(1.0, current * rate).toFixed(4));
}

// ─── SHARE TAGLINES ──────────────────────────────────────────
const SHARE_TAGLINES = [
    'Every day is a directive. Are you executing?',
    'Real life has no respawn. Level up while you can.',
    'The grind never stops — but it does compound.',
    'F-Rank today. The System has seen what comes next.',
    'Stats do not lie. Neither does effort.',
    'The System is watching. Show up again tomorrow.',
    'Progress is invisible — until suddenly it is not.',
    'Your future self deployed this. Do not let them down.',
    'Discipline is delayed gratification done consistently.',
    'One directive at a time. One level at a time.'
];

function getRandomTagline() {
    return SHARE_TAGLINES[Math.floor(Math.random() * SHARE_TAGLINES.length)];
}

// ─── SHOP ITEMS ──────────────────────────────────────────────
// Each item has:
//   id         — unique key, also used as player.buffs key where applicable
//   emoji      — single emoji, the real-world object without naming it explicitly
//   name       — what the System calls it
//   desc       — Bridge principle: third-person description of what it IS
//   effect     — what the System registers when consumed
//   consumeMsg — shown in toast after consumption, present tense, indirect prompt
//   price      — gold cost
//   buffKey    — player.buffs property this affects (null for instant items)

const SHOP_ITEMS = [
    {
        id:         'focusDraught',
        emoji:      '☕',
        name:       'FOCUS DRAUGHT',
        desc:       'The warm drink that sharpens the mind before deep work. Field operatives in every timeline have used a version of this.',
        effect:     'INT + END directives yield double XP for the rest of the day.',
        consumeMsg: '[ FOCUS DRAUGHT ACTIVE ] — The System has registered the intake.',
        price:      18,
        buffKey:    'focusDraught'
    },
    {
        id:         'vitalityTonic',
        emoji:      '💧',
        name:       'VITALITY TONIC',
        desc:       'Something that restores the body. Water. A meal. Anything nourishing.',
        effect:     'Restores 20 HP immediately.',
        consumeMsg: '[ +20 HP ] — Something has been restored. The System registers the change.',
        price:      15,
        buffKey:    null
    },
    {
        id:         'sprintScroll',
        emoji:      '⚡',
        name:       'SPRINT SCROLL',
        desc:       'A focused burst. Twenty-five minutes. Nothing else.',
        effect:     'Gear increases by one step for the rest of the day.',
        consumeMsg: '[ GEAR ELEVATED ] — A focused session has begun. The System is watching.',
        price:      35,
        buffKey:    'sprintScroll'
    },
    {
        id:         'restSigil',
        emoji:      '🌑',
        name:       'REST SIGIL',
        desc:       'Ten minutes away from all screens. The System will wait.',
        effect:     'Momentum decay is blocked for 24 hours. Missing a day will not reduce momentum while the Sigil is active.',
        consumeMsg: '[ REST SIGIL ACTIVE ] — Absence registered. Momentum protected for 24h.',
        price:      30,
        buffKey:    'restSigil'
    },
    {
        id:         'clarityShards',
        emoji:      '📝',
        name:       'CLARITY SHARDS',
        desc:       'Three things. What you are grateful for, or what you intend. Written.',
        effect:     '+5 XP bonus applied to the next three directives completed.',
        consumeMsg: '[ CLARITY SHARDS ACTIVE ] — Three things have been committed to. The System notes the clarity.',
        price:      18,
        buffKey:    'clarityShards'
    }
];

// ─── BUFF HELPERS ────────────────────────────────────────────
// Returns a default buffs object for new / migrated players.
function defaultBuffs() {
    return {
        focusDraught:  null,   // ISO expiry string or null
        sprintScroll:  null,   // ISO expiry string or null
        restSigil:     null,   // ISO expiry string or null (24h from consume)
        clarityShards: 0       // count of remaining bonus directives
    };
}

// Returns true if a timestamped buff is currently active.
function buffActive(expiryISO) {
    if (!expiryISO) return false;
    return new Date() < new Date(expiryISO);
}

// End-of-day ISO — midnight tonight in local time.
function endOfDayISO() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
}

// 24 hours from now as ISO string.
function in24hISO() {
    return new Date(Date.now() + 86400000).toISOString();
}

// ─── SOUND ───────────────────────────────────────────────────
let soundEnabled = false;
const AudioCtx   = window.AudioContext || window.webkitAudioContext;
let audioCtx     = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playTone(frequency, duration, type = 'sine', volume = 0.15) {
    if (!soundEnabled) return;
    try {
        const ctx  = getAudioCtx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type            = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (e) { /* silent fail */ }
}

// ─── UI CLICK ────────────────────────────────────────────────
function playUIClick() {
    playTone(880, 0.04, 'square', 0.08);
}

function playQuestComplete() {
    playTone(440, 0.07, 'square', 0.12);
    setTimeout(() => playTone(660, 0.1, 'square', 0.1), 90);
}

function playLevelUp() {
    const notes = [330, 440, 550, 660];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 0.18, 'sawtooth', 0.15), i * 90));
}

function playRankUp() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;

        const sub     = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.connect(subGain);
        subGain.connect(ctx.destination);
        sub.type            = 'sine';
        sub.frequency.value = 55;
        subGain.gain.setValueAtTime(0.0, now);
        subGain.gain.linearRampToValueAtTime(0.35, now + 0.08);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
        sub.start(now);
        sub.stop(now + 2.2);

        const fanfare = [220, 277, 330, 415, 494];
        fanfare.forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type            = 'sawtooth';
            osc.frequency.value = freq;
            const t = now + i * 0.13;
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.start(t);
            osc.stop(t + 0.35);
        });

        const shimmer     = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmer.connect(shimmerGain);
        shimmerGain.connect(ctx.destination);
        shimmer.type            = 'sine';
        shimmer.frequency.value = 880;
        shimmerGain.gain.setValueAtTime(0.0, now + 0.6);
        shimmerGain.gain.linearRampToValueAtTime(0.08, now + 0.9);
        shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
        shimmer.start(now + 0.6);
        shimmer.stop(now + 3.0);

    } catch (e) { /* silent fail */ }
}

function playCriticalHit() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
    } catch (e) { /* silent fail */ }
}

// ─── CONSUME SOUND ───────────────────────────────────────────
// Rising three-tone sequence — distinct from the two-note quest chime.
// Suggests a buff being applied: low → mid → high, sine wave, smooth fade.
function playConsume() {
    if (!soundEnabled) return;
    try {
        const ctx  = getAudioCtx();
        const now  = ctx.currentTime;
        const seq  = [330, 495, 660];
        seq.forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type            = 'sine';
            osc.frequency.value = freq;
            const t = now + i * 0.12;
            gain.gain.setValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(0.14, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.start(t);
            osc.stop(t + 0.28);
        });
    } catch (e) { /* silent fail */ }
}

// ─── AMBIENT DRONE ───────────────────────────────────────────
let droneOsc  = null;
let droneGain = null;

function startAmbientDrone() {
    if (!soundEnabled) return;
    if (droneOsc) return;
    try {
        const ctx = getAudioCtx();
        droneOsc  = ctx.createOscillator();
        droneGain = ctx.createGain();
        droneOsc.connect(droneGain);
        droneGain.connect(ctx.destination);
        droneOsc.type            = 'sine';
        droneOsc.frequency.value = 90;
        droneGain.gain.setValueAtTime(0.0, ctx.currentTime);
        droneGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.0);
        droneOsc.start(ctx.currentTime);
    } catch (e) { /* silent fail */ }
}

function stopAmbientDrone() {
    if (!droneOsc || !droneGain) return;
    try {
        const ctx = getAudioCtx();
        droneGain.gain.setValueAtTime(droneGain.gain.value, ctx.currentTime);
        droneGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 1.0);
        const osc = droneOsc;
        droneOsc  = null;
        droneGain = null;
        setTimeout(() => { try { osc.stop(); } catch (e) {} }, 1100);
    } catch (e) { /* silent fail */ }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-icon').textContent = soundEnabled ? '🔊' : '🔇';
    localStorage.setItem('levelup_sound', soundEnabled ? '1' : '0');
    playUIClick();
}

// ─── STATE ───────────────────────────────────────────────────
let player      = null;
let dailyQuests = [];
let allQuests   = [];
let currentGear = 1;

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
    allQuests = await loadQuests();
    player    = loadPlayer();

    const savedSound = localStorage.getItem('levelup_sound');
    soundEnabled = savedSound === null ? true : savedSound === '1';
    if (savedSound === null) localStorage.setItem('levelup_sound', '1');

    document.getElementById('sound-icon').textContent = soundEnabled ? '🔊' : '🔇';
    document.getElementById('sound-toggle').addEventListener('click', toggleSound);

    currentGear = loadGear();

    document.getElementById('settings-btn').addEventListener('click', () => {
        playUIClick();
        openSettings();
    });

    document.getElementById('shop-btn').addEventListener('click', () => {
        playUIClick();
        openShop();
    });

    setupTooltips();

    if (!player) {
        showScreen('screen-onboarding');
        runOnboarding();
        return;
    }

    checkDailyReset();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear());
    updateStatusScreen();
    showScreen('screen-status');
    registerServiceWorker();
}

// ─── SERVICE WORKER ──────────────────────────────────────────
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/levelup/service-worker.js')
        .then(reg => {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'default') {
                setTimeout(() => Notification.requestPermission(), 3000);
            }
            if (Notification.permission === 'granted' && player) {
                const sw = reg.active || reg.waiting || reg.installing;
                if (sw) {
                    sw.postMessage({
                        type:           'CHECK_NOTIFICATION',
                        lastActiveDate: player.lastActiveDate || player.lastQuestDate,
                        playerName:     player.name
                    });
                }
            }
        })
        .catch(err => console.log('SW error:', err));
}

// ─── TYPEWRITER UTILITY ───────────────────────────────────────
function typeText(el, text, speed, onDone) {
    let i = 0;
    el.textContent = '';
    const interval = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            if (onDone) onDone();
        }
    }, speed);
    return () => clearInterval(interval);
}

// ─── ONBOARDING ──────────────────────────────────────────────
function runOnboarding() {
    startAmbientDrone();

    const loreEl      = document.getElementById('lore-lines');
    const nameSection = document.getElementById('name-section');
    const nameInput   = document.getElementById('name-input');
    const startBtn    = document.getElementById('start-btn');

    function runSignalPhase() {
        loreEl.innerHTML = '';
        nameSection.classList.add('hidden');
        startBtn.classList.add('hidden');

        const signalLines = [
            '> SIGNAL DETECTED',
            '> LOCATING SURVIVOR...',
            '> CONNECTION ESTABLISHED'
        ];
        let idx = 0;

        function typeNextSignalLine() {
            if (idx >= signalLines.length) {
                setTimeout(() => flashClear(runLorePhase), 800);
                return;
            }
            const lineEl     = document.createElement('div');
            lineEl.className = 'lore-line lore-signal';
            const cursor     = document.createElement('span');
            cursor.className = 'terminal-cursor';
            loreEl.appendChild(lineEl);
            lineEl.appendChild(cursor);

            typeText(lineEl, signalLines[idx], 55, () => {
                cursor.remove();
                idx++;
                setTimeout(typeNextSignalLine, 300);
            });
        }

        typeNextSignalLine();
    }

    function flashClear(onDone) {
        loreEl.classList.add('terminal-flash');
        setTimeout(() => {
            loreEl.innerHTML = '';
            loreEl.classList.remove('terminal-flash');
            setTimeout(onDone, 150);
        }, 220);
    }

    function runLorePhase() {
        const loreLines = [
            'The economy broke first.',
            'Then the systems. Then the people.',
            'Most are still waiting for someone to fix it.',
            'You stopped waiting.',
            'I am the System your future self deployed.',
            'I found you because you are still moving.',
            'That matters more than you know.'
        ];
        let idx = 0;

        function typeNextLoreLine() {
            if (idx >= loreLines.length) {
                setTimeout(() => flashClear(runNamePhase), 1400);
                return;
            }

            if (idx === 4) {
                const gap        = document.createElement('div');
                gap.style.height = '0.8em';
                loreEl.appendChild(gap);
            }

            const lineEl     = document.createElement('div');
            lineEl.className = 'lore-line';
            const cursor     = document.createElement('span');
            cursor.className = 'terminal-cursor';
            loreEl.appendChild(lineEl);
            lineEl.appendChild(cursor);

            typeText(lineEl, loreLines[idx], 38, () => {
                cursor.remove();
                idx++;
                const delay = (idx === 4) ? 500 : 200;
                setTimeout(typeNextLoreLine, delay);
            });
        }

        typeNextLoreLine();
    }

    function runNamePhase() {
        const promptLines = [
            'Identify yourself.',
            'This name is your key.'
        ];
        let idx = 0;

        function typeNextPromptLine() {
            if (idx >= promptLines.length) {
                setTimeout(() => {
                    nameSection.classList.remove('hidden');
                    nameInput.focus();
                }, 500);
                return;
            }

            const lineEl     = document.createElement('div');
            lineEl.className = 'lore-line lore-prompt';
            const cursor     = document.createElement('span');
            cursor.className = 'terminal-cursor';
            loreEl.appendChild(lineEl);
            lineEl.appendChild(cursor);

            typeText(lineEl, promptLines[idx], 55, () => {
                cursor.remove();
                idx++;
                setTimeout(typeNextPromptLine, 350);
            });
        }

        typeNextPromptLine();
    }

    nameInput.addEventListener('input', () => {
        startBtn.classList.toggle('hidden', nameInput.value.trim().length === 0);
    });

    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && nameInput.value.trim().length > 0) submitName();
    });

    startBtn.addEventListener('click', () => {
        playUIClick();
        submitName();
    });

    function submitName() {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        stopAmbientDrone();
        runAwakenSequence(name.toUpperCase());
    }

    runSignalPhase();
}

// ─── AWAKEN BOOT SEQUENCE ─────────────────────────────────────
function runAwakenSequence(name) {
    const overlay = document.getElementById('overlay-awaken');
    overlay.classList.remove('hidden');

    const bootLines = [
        '> SCANNING SURVIVOR DATA...',
        '> ASSESSING ATTRIBUTES...',
        '> CALCULATING BASELINE...',
        '> COMPILING STAT MATRIX...',
        '> PROFILE CONFIRMED.'
    ];

    const linesEl  = document.getElementById('boot-lines');
    const nameEl   = document.getElementById('boot-name');
    const statusEl = document.getElementById('boot-status');
    linesEl.innerHTML    = '';
    nameEl.textContent   = '';
    statusEl.textContent = '';

    let lineIndex = 0;

    function nextLine() {
        if (lineIndex >= bootLines.length) {
            setTimeout(() => {
                typeText(nameEl, name, 80, () => {
                    setTimeout(() => {
                        typeText(statusEl, '[ AWAKENING... ]', 60, () => {
                            setTimeout(() => {
                                overlay.classList.add('hidden');
                                createPlayer(name);
                            }, 800);
                        });
                    }, 400);
                });
            }, 300);
            return;
        }
        const line            = document.createElement('div');
        line.style.opacity    = '0';
        line.style.transition = 'opacity 0.3s ease';
        line.textContent      = bootLines[lineIndex];
        linesEl.appendChild(line);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { line.style.opacity = '1'; });
        });
        lineIndex++;
        setTimeout(nextLine, 350);
    }

    nextLine();
}

// ─── HP HELPERS ──────────────────────────────────────────────
function calcMaxHp(level) {
    return 100 + (level * 5);
}

// ─── PLAYER MANAGEMENT ───────────────────────────────────────
function loadPlayer() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    // Migration: add gold and buffs to existing saves that predate Stage 2
    if (typeof p.gold !== 'number') p.gold = 0;
    if (!p.buffs) p.buffs = defaultBuffs();
    return p;
}

function savePlayer() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}

function createPlayer(name) {
    const stats = {};
    STAT_NAMES.forEach(stat => { stats[stat] = STAT_FLOOR; });

    const maxHp = calcMaxHp(1);

    player = {
        name,
        stats,
        completedToday:  [],
        lastQuestDate:   today(),
        consecutiveDays: 1,
        momentum:        1.0,
        lastActiveDate:  today(),
        hp:              maxHp,
        maxHp,
        corrupted:       false,
        gold:            0,
        buffs:           defaultBuffs()
    };

    savePlayer();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear());
    showStatusScreenWithAnimation();
}

// ─── EFFECTIVE GEAR ──────────────────────────────────────────
// Sprint Scroll raises gear by 1 for the rest of the day.
// This is the single source of truth used everywhere gear is needed.
function effectiveGear() {
    const base = currentGear;
    if (player && player.buffs && buffActive(player.buffs.sprintScroll)) {
        return Math.min(3, base + 1);
    }
    return base;
}

// ─── DAILY RESET ──────────────────────────────────────────────
function checkDailyReset() {
    const todayStr = today();
    const lastDate = player.lastQuestDate;
    if (lastDate === todayStr) return;

    const diffDays = Math.round(
        (new Date(todayStr) - new Date(lastDate)) / 86400000
    );

    if (diffDays === 1) {
        player.consecutiveDays = (player.consecutiveDays || 0) + 1;
        player.momentum        = buildMomentum(player.consecutiveDays);
    } else {
        player.consecutiveDays = 1;

        // Rest Sigil blocks momentum decay for 24h from consumption.
        // If the sigil is still active, skip the decay entirely.
        if (!buffActive(player.buffs && player.buffs.restSigil)) {
            player.momentum = decayMomentum(player.momentum || 1.0, diffDays - 1);
        }
    }

    const level  = levelFromXP(Math.max(0, earnedXP(player.stats)));
    player.maxHp = calcMaxHp(level);

    if (diffDays === 1) {
        const coveredStats = new Set(
            (player.completedToday || [])
                .map(id => {
                    const q = allQuests.find(q => q.id === id);
                    return q ? q.stat : null;
                })
                .filter(Boolean)
        );
        if (coveredStats.size >= 5) {
            player.hp = Math.min(player.maxHp, (player.hp || player.maxHp) + 20);
        }
    } else {
        const missedDays = diffDays - 1;
        const hpDamage   = missedDays === 1 ? 10
                         : missedDays === 2 ? 20
                         : 35;
        player.hp = Math.max(0, (player.hp || player.maxHp) - hpDamage);
    }

    if (player.hp <= 0) {
        player.hp        = 0;
        player.corrupted = true;
    } else if (player.corrupted && player.hp > 25) {
        player.corrupted = false;
    }

    // Clear day-scoped buffs that expired at midnight.
    // focusDraught and sprintScroll are end-of-day buffs — clear them.
    // restSigil is timestamp-based (24h) — left to buffActive() to evaluate.
    // clarityShards are count-based — persist until used up.
    if (!buffActive(player.buffs.focusDraught))  player.buffs.focusDraught = null;
    if (!buffActive(player.buffs.sprintScroll))   player.buffs.sprintScroll  = null;

    player.completedToday = [];
    player.lastQuestDate  = todayStr;
    player.lastActiveDate = todayStr;
    savePlayer();
}

function today() {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
}

// ─── LOAD QUESTS ─────────────────────────────────────────────
async function loadQuests() {
    try {
        const res  = await fetch('/levelup/data/quests.json');
        const data = await res.json();
        return data.quests;
    } catch (e) {
        console.error('Could not load quests:', e);
        return [];
    }
}

// ─── SHOP ────────────────────────────────────────────────────
function openShop() {
    renderShop();
    showScreen('screen-shop');
}

function renderShop() {
    const list      = document.getElementById('shop-list');
    const goldEl    = document.getElementById('shop-gold-value');
    const buffsEl   = document.getElementById('active-buffs');
    const gold      = player.gold || 0;
    const buffs     = player.buffs || defaultBuffs();

    goldEl.textContent = gold;
    list.innerHTML     = '';

    // ── Active buffs panel ───────────────────────────────────
    const activeLines = [];

    if (buffActive(buffs.focusDraught)) {
        activeLines.push('☕ FOCUS DRAUGHT — INT + END ×2 active until midnight');
    }
    if (buffActive(buffs.sprintScroll)) {
        activeLines.push('⚡ SPRINT SCROLL — Gear ' + effectiveGear() + ' active until midnight');
    }
    if (buffActive(buffs.restSigil)) {
        const exp = new Date(buffs.restSigil);
        const hh  = exp.getHours().toString().padStart(2, '0');
        const mm  = exp.getMinutes().toString().padStart(2, '0');
        activeLines.push('🌑 REST SIGIL — Momentum protected until ' + hh + ':' + mm);
    }
    if (buffs.clarityShards > 0) {
        activeLines.push('📝 CLARITY SHARDS — +5 XP on next ' + buffs.clarityShards + ' directive(s)');
    }

    if (activeLines.length > 0) {
        buffsEl.innerHTML =
            '<div class="active-buffs-title">[ ACTIVE EFFECTS ]</div>' +
            activeLines.map(l => '<div class="active-buff-line">' + l + '</div>').join('');
        buffsEl.classList.remove('hidden');
    } else {
        buffsEl.innerHTML = '';
        buffsEl.classList.add('hidden');
    }

    // ── Item cards ───────────────────────────────────────────
    SHOP_ITEMS.forEach(item => {
        const canAfford = gold >= item.price;

        // Determine if this item is already active (for timestamped buffs)
        let alreadyActive = false;
        if (item.buffKey && item.buffKey !== 'clarityShards') {
            alreadyActive = buffActive(buffs[item.buffKey]);
        }

        const card     = document.createElement('div');
        card.className = 'shop-card' + (!canAfford ? ' shop-card--unaffordable' : '');

        card.innerHTML = `
            <div class="shop-card-top">
                <span class="shop-item-emoji">${item.emoji}</span>
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                    <div class="shop-item-effect">${item.effect}</div>
                </div>
                <div class="shop-item-price">
                    <span class="shop-price-value">${item.price}</span>
                    <span class="shop-price-label">GOLD</span>
                </div>
            </div>
            <button
                class="consume-btn"
                data-item-id="${item.id}"
                ${!canAfford || alreadyActive ? 'disabled' : ''}
            >${alreadyActive ? '[ ACTIVE ]' : canAfford ? 'CONSUME' : 'INSUFFICIENT GOLD'}</button>
        `;

        list.appendChild(card);
    });

    // Wire consume buttons
    document.querySelectorAll('.consume-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            consumeItem(btn.dataset.itemId);
        });
    });
}

// ─── CONSUME ITEM ────────────────────────────────────────────
function consumeItem(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    const gold = player.gold || 0;
    if (gold < item.price) return;

    // Guard: Sprint Scroll at Gear 3 — already at max
    if (itemId === 'sprintScroll' && effectiveGear() >= 3) {
        showToast('GEAR CEILING REACHED — SPRINT SCROLL HAS NO EFFECT HERE');
        return;
    }

    player.gold = gold - item.price;

    switch (itemId) {

        case 'focusDraught':
            player.buffs.focusDraught = endOfDayISO();
            break;

        case 'vitalityTonic': {
            const maxHp = player.maxHp || calcMaxHp(calculateLevel());
            player.hp   = Math.min(maxHp, (player.hp || maxHp) + 20);
            // Update HP display on status screen immediately
            const hpPct = Math.round((player.hp / maxHp) * 100);
            const hpEl  = document.getElementById('hp-bar');
            const hpVal = document.getElementById('hp-value');
            if (hpEl)  hpEl.style.width      = hpPct + '%';
            if (hpVal) hpVal.textContent      = player.hp + ' / ' + maxHp;
            break;
        }

        case 'sprintScroll':
            player.buffs.sprintScroll = endOfDayISO();
            // Refresh daily quests immediately to reflect elevated gear
            dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear());
            break;

        case 'restSigil':
            player.buffs.restSigil = in24hISO();
            break;

        case 'clarityShards':
            // Stack on top of any remaining shards
            player.buffs.clarityShards = (player.buffs.clarityShards || 0) + 3;
            break;
    }

    savePlayer();
    playConsume();
    showToast(item.consumeMsg, 'accent');

    // Re-render shop to update gold, active buffs, and button states
    renderShop();

    // Update gold display on status screen
    const goldEl = document.getElementById('gold-value');
    if (goldEl) goldEl.textContent = player.gold;
}

// ─── QUEST COMPLETION ────────────────────────────────────────
function completeQuest(id, stat, baseXP) {
    if (player.completedToday.includes(id)) return;

    const momentum     = player.momentum || 1.0;
    let   earnedAmt    = parseFloat((baseXP * momentum).toFixed(1));

    // Corrupted debuff: XP halved while HP is at 0
    const wasCorrupted = player.corrupted;
    if (wasCorrupted) earnedAmt = parseFloat((earnedAmt / 2).toFixed(1));

    // Focus Draught: double XP for INT and END directives
    if (buffActive(player.buffs.focusDraught) &&
        (stat === 'intelligence' || stat === 'endurance')) {
        earnedAmt = parseFloat((earnedAmt * 2).toFixed(1));
    }

    // Clarity Shards: flat +5 XP on next 3 directives
    if (player.buffs.clarityShards > 0) {
        earnedAmt = parseFloat((earnedAmt + 5).toFixed(1));
        player.buffs.clarityShards -= 1;
    }

    // Critical hit: 1-in-8 chance of a ×1.5 bonus strike
    const isCritical = Math.random() < 0.125;
    if (isCritical) {
        earnedAmt = parseFloat((earnedAmt * 1.5).toFixed(1));
        playCriticalHit();
    }

    const xpBefore = earnedXP(player.stats);

    player.stats[stat] = parseFloat(
        ((player.stats[stat] || STAT_FLOOR) + earnedAmt).toFixed(1)
    );
    player.completedToday.push(id);

    // Gold earned equals the base XP value of the quest (before multipliers)
    player.gold = (player.gold || 0) + baseXP;

    savePlayer();

    const card = document.getElementById('quest-card-' + id);
    if (card) {
        card.classList.add('completing');
        setTimeout(() => card.classList.remove('completing'), 400);
    }

    showFloatingXP(id, earnedAmt, isCritical);
    if (!isCritical) playQuestComplete();

    const prevLevel = levelFromXP(xpBefore);
    const newLevel  = calculateLevel();
    const prevRank  = rankFromLevel(prevLevel);
    const newRank   = rankFromLevel(newLevel);

    if (wasCorrupted && !player.corrupted) {
        setTimeout(() => showToast('[ SYSTEM RESTORED ]', 'accent'), 400);
    }

    renderQuests(dailyQuests, player.completedToday, player.momentum);
    updateStatusScreen();

    if (newRank !== prevRank) {
        setTimeout(() => showRankUpOverlay(newRank, newLevel), 600);
    } else if (newLevel > prevLevel) {
        setTimeout(() => showLevelUpOverlay(newLevel), 600);
    }
}

// ─── CALCULATIONS ────────────────────────────────────────────
function calculateLevel() {
    return levelFromXP(Math.max(0, earnedXP(player.stats)));
}

function calculateLuck() {
    const total = STAT_NAMES.reduce((sum, s) => sum + (player.stats[s] || STAT_FLOOR), 0);
    return parseFloat((total / STAT_NAMES.length).toFixed(1));
}

// ─── STATUS SCREEN ───────────────────────────────────────────
function updateStatusScreen(animate) {
    const level    = calculateLevel();
    const rank     = rankFromLevel(level);
    const momentum = player.momentum || 1.0;
    const xp       = earnedXP(player.stats);
    const xpThis   = xp - xpForLevel(level);
    const xpNext   = xpForLevel(level + 1) - xpForLevel(level);
    const pct      = xpNext > 0 ? Math.min(100, Math.round((xpThis / xpNext) * 100)) : 100;

    const header = document.getElementById('status-header');
    if (header) header.classList.toggle('corrupted', !!player.corrupted);

    const titleEl = document.getElementById('player-title');
    titleEl.textContent = player.corrupted
        ? '[ SYSTEM COMPROMISED ]'
        : '[ ' + titleFromLevel(level) + ' ]';

    document.getElementById('player-name').textContent  = player.name;
    document.getElementById('player-level').textContent = level;

    const rankEl = document.getElementById('rank-badge');
    rankEl.textContent = rank;
    rankEl.className   = 'rank-badge tappable ' + rankCssClass(rank);
    rankEl.dataset.tip = 'rank';

    document.getElementById('level-progress-bar').style.width   = pct + '%';
    document.getElementById('level-progress-label').textContent =
        xpThis + ' / ' + xpNext + ' XP  (' + pct + '%)';

    const mPct = Math.round(((momentum - 1.0) / 0.5) * 100);
    document.getElementById('momentum-bar').style.width   = mPct + '%';
    document.getElementById('momentum-value').textContent = momentum.toFixed(2) + 'x';

    const hp    = player.hp    ?? player.maxHp;
    const maxHp = player.maxHp ?? calcMaxHp(level);
    const hpPct = Math.round((hp / maxHp) * 100);
    document.getElementById('hp-bar').style.width   = hpPct + '%';
    document.getElementById('hp-value').textContent = hp + ' / ' + maxHp;

    // Gold
    const goldEl = document.getElementById('gold-value');
    if (goldEl) goldEl.textContent = player.gold || 0;

    STAT_NAMES.forEach(stat => {
        const val     = player.stats[stat] || STAT_FLOOR;
        const dispVal = Math.floor(val);
        const barPct  = Math.min(100, ((val - STAT_FLOOR) / 90) * 100);

        if (animate) {
            animateNumber('val-' + stat, 0, dispVal, 600);
            setTimeout(() => {
                document.getElementById('bar-' + stat).style.width = barPct + '%';
            }, 100);
        } else {
            document.getElementById('val-' + stat).textContent = dispVal;
            document.getElementById('bar-' + stat).style.width = barPct + '%';
        }
    });

    const luck    = calculateLuck();
    const luckVal = Math.floor(luck);
    const luckPct = Math.min(100, ((luck - STAT_FLOOR) / 90) * 100);
    if (animate) {
        animateNumber('val-luck', 0, luckVal, 700);
        setTimeout(() => {
            document.getElementById('bar-luck').style.width = luckPct + '%';
        }, 100);
    } else {
        document.getElementById('val-luck').textContent = luckVal;
        document.getElementById('bar-luck').style.width = luckPct + '%';
    }
}

function rankCssClass(rank) {
    const map = {
        'F': 'rank-f', 'E': 'rank-e', 'D': 'rank-d',
        'C': 'rank-c', 'B': 'rank-b', 'A': 'rank-a',
        'S': 'rank-s', 'S+': 'rank-s', 'SS': 'rank-s',
        'SS+': 'rank-s', 'SSS': 'rank-s'
    };
    return map[rank] || 'rank-f';
}

function showStatusScreenWithAnimation() {
    showScreen('screen-status');
    setTimeout(() => {
        updateStatusScreen(true);
        const level = calculateLevel();
        if (level > 1) {
            setTimeout(() => showLevelUpOverlay(level), 1500);
        }
    }, 200);
}

// ─── ANIMATE NUMBER ──────────────────────────────────────────
function animateNumber(elId, from, to, duration) {
    const el = document.getElementById(elId);
    if (!el) return;
    const steps = 30;
    const step  = (to - from) / steps;
    const delay = duration / steps;
    let current = from;
    let count   = 0;
    const interval = setInterval(() => {
        count++;
        current += step;
        el.textContent = Math.round(count >= steps ? to : current);
        if (count >= steps) clearInterval(interval);
    }, delay);
}

// ─── FLOATING XP ─────────────────────────────────────────────
function showFloatingXP(questId, amount, isCritical) {
    const card = document.getElementById('quest-card-' + questId);
    if (!card) return;
    const rect     = card.getBoundingClientRect();
    const baseTop  = rect.top + window.scrollY;
    const baseLeft = rect.left + rect.width / 2 - 20;

    if (isCritical) {
        const crit       = document.createElement('div');
        crit.className   = 'float-xp float-critical';
        crit.textContent = '[ CRITICAL ]';
        crit.style.left  = baseLeft + 'px';
        crit.style.top   = (baseTop - 24) + 'px';
        document.body.appendChild(crit);
        setTimeout(() => crit.remove(), 1100);
    }

    const label       = document.createElement('div');
    label.className   = 'float-xp';
    label.textContent = '+' + amount + ' XP';
    label.style.left  = baseLeft + 'px';
    label.style.top   = baseTop + 'px';
    document.body.appendChild(label);
    setTimeout(() => label.remove(), 1000);
}

// ─── LEVEL UP OVERLAY ────────────────────────────────────────
function showLevelUpOverlay(level) {
    playLevelUp();
    spawnParticles('lu-particles', 20, 'var(--accent)');

    const titleText = titleFromLevel(level);
    const rankText  = rankFromLevel(level);
    const subText   = rankText + '-RANK  ·  SHOW UP AGAIN TOMORROW';

    document.getElementById('lu-level').textContent = level;
    document.getElementById('lu-title').textContent = titleText;
    document.getElementById('lu-sub').textContent   = subText;

    const overlay = document.getElementById('overlay-levelup');
    overlay.classList.remove('hidden');

    document.getElementById('lu-share-btn').onclick = () => {
        playUIClick();
        shareCard({ headline: 'THRESHOLD REACHED', bigText: String(level), titleText, subText, accentColor: '#4fc3f7' });
    };
    document.getElementById('lu-dismiss-btn').onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
    };
}

// ─── RANK UP OVERLAY ─────────────────────────────────────────
function showRankUpOverlay(rank, level) {
    playRankUp();
    spawnParticles('ru-particles', 35, 'var(--gold)');

    const titleText = rank + '-RANK CONFIRMED';
    const subText   = titleFromLevel(level) + '  ·  LEVEL ' + level;

    document.getElementById('ru-rank').textContent  = rank;
    document.getElementById('ru-title').textContent = titleText;
    document.getElementById('ru-sub').textContent   = subText;

    const overlay = document.getElementById('overlay-rankup');
    overlay.classList.remove('hidden');

    document.getElementById('ru-share-btn').onclick = () => {
        playUIClick();
        shareCard({ headline: 'RANK RECLASSIFIED', bigText: rank, titleText, subText, accentColor: '#ffd700' });
    };
    document.getElementById('ru-dismiss-btn').onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
    };
}

// ─── SHARE CARD GENERATOR ────────────────────────────────────
function shareCard({ headline, bigText, titleText, subText, accentColor }) {
    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(42, 42, 74, 0.7)';
    for (let x = 30; x < W; x += 60) {
        for (let y = 30; y < H; y += 60) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, W, 5);
    ctx.fillRect(0, H - 5, W, 5);
    ctx.fillRect(0, 0, 5, H);
    ctx.fillRect(W - 5, 0, 5, H);

    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.font      = '500 30px monospace';
    ctx.fillText('[ SYSTEM ]', W / 2, 120);

    ctx.fillStyle = 'rgba(200, 214, 229, 0.45)';
    ctx.font      = '32px monospace';
    ctx.fillText(headline, W / 2, 178);

    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur  = 80;
    ctx.fillStyle   = accentColor;
    const bigFontSize = bigText.length > 2 ? 200 : 300;
    ctx.font = `bold ${bigFontSize}px monospace`;
    ctx.fillText(bigText, W / 2, 540);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 54px sans-serif';
    ctx.fillText(titleText, W / 2, 650);

    ctx.fillStyle = 'rgba(200, 214, 229, 0.5)';
    ctx.font      = '30px monospace';
    ctx.fillText(subText, W / 2, 712);

    ctx.strokeStyle = 'rgba(42, 42, 74, 1)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(120, 760);
    ctx.lineTo(W - 120, 760);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 44px monospace';
    ctx.fillText(player.name, W / 2, 836);

    ctx.fillStyle = 'rgba(200, 214, 229, 0.35)';
    ctx.font      = '26px monospace';
    canvasWrapText(ctx, getRandomTagline(), W / 2, 908, W - 160, 38);

    ctx.fillStyle   = accentColor;
    ctx.font        = '22px monospace';
    ctx.globalAlpha = 0.6;
    ctx.fillText('LEVELUP', W / 2, 1032);
    ctx.globalAlpha = 1;

    canvas.toBlob(blob => {
        const file = new File([blob], 'levelup-moment.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                files: [file],
                title: 'LevelUp — ' + headline,
                text:  player.name + ' · ' + subText + '\n' + getRandomTagline()
            }).catch(() => downloadCanvas(canvas));
        } else {
            downloadCanvas(canvas);
        }
    }, 'image/png');
}

function canvasWrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const test    = line + words[n] + ' ';
        const metrics = ctx.measureText(test);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line.trim(), x, y);
            line = words[n] + ' ';
            y   += lineHeight;
        } else {
            line = test;
        }
    }
    ctx.fillText(line.trim(), x, y);
}

function downloadCanvas(canvas) {
    const a    = document.createElement('a');
    a.download = 'levelup-moment.png';
    a.href     = canvas.toDataURL('image/png');
    a.click();
}

// ─── PARTICLES ───────────────────────────────────────────────
function spawnParticles(containerId, count, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const p     = document.createElement('div');
        p.className = 'particle';
        const angle = (360 / count) * i;
        const dist  = 80 + Math.random() * 120;
        const tx    = Math.cos(angle * Math.PI / 180) * dist + 'px';
        const ty    = Math.sin(angle * Math.PI / 180) * dist + 'px';
        p.style.cssText = `
            background:${color}; left:50%; top:50%;
            --tx:${tx}; --ty:${ty};
            animation-delay:${Math.random() * 0.3}s;
            animation-duration:${0.8 + Math.random() * 0.6}s;
        `;
        container.appendChild(p);
    }
}

// ─── GEAR ────────────────────────────────────────────────────
function loadGear() {
    const saved = parseInt(localStorage.getItem(GEAR_KEY), 10);
    return (saved === 2 || saved === 3) ? saved : 1;
}

function saveGear(gear) {
    currentGear = gear;
    localStorage.setItem(GEAR_KEY, String(gear));
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear());
    if (document.getElementById('screen-quests').classList.contains('active')) {
        renderQuests(dailyQuests, player.completedToday, player.momentum || 1.0);
    }
}

// ─── SETTINGS ────────────────────────────────────────────────
function openSettings() {
    document.getElementById('settings-name-input').value = player.name;
    document.getElementById('confirm-box').classList.add('hidden');

    document.getElementById('save-name-btn').onclick = () => { playUIClick(); savePlayerName(); };
    document.getElementById('reset-btn').onclick     = () => { playUIClick(); showConfirmReset(); };
    document.getElementById('confirm-yes').onclick   = () => { playUIClick(); resetProfile(); };
    document.getElementById('confirm-no').onclick    = () => {
        playUIClick();
        document.getElementById('confirm-box').classList.add('hidden');
    };

    updateGearUI(currentGear);

    document.querySelectorAll('.gear-option-btn').forEach(btn => {
        btn.onclick = () => {
            playUIClick();
            const gear = parseInt(btn.dataset.gear, 10);
            saveGear(gear);
            updateGearUI(gear);
            showToast('GEAR ' + gear + ' ENGAGED');
        };
    });

    showScreen('screen-settings');
}

function updateGearUI(gear) {
    document.querySelectorAll('.gear-option-btn').forEach(btn => {
        const isActive = parseInt(btn.dataset.gear, 10) === gear;
        btn.classList.toggle('gear-active', isActive);
    });
    document.querySelectorAll('.gear-warning').forEach(el => el.classList.add('hidden'));
    const activeWarning = document.getElementById('gear-warning-' + gear);
    if (activeWarning) activeWarning.classList.remove('hidden');
}

function savePlayerName() {
    const input   = document.getElementById('settings-name-input');
    const newName = input.value.trim().toUpperCase();
    if (!newName) { input.focus(); return; }
    player.name = newName;
    savePlayer();
    updateStatusScreen();
    showToast('DESIGNATION UPDATED');
    setTimeout(() => showScreen('screen-status'), 1200);
}

function showConfirmReset() {
    document.getElementById('confirm-box').classList.remove('hidden');
}

function resetProfile() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('levelup_sound');
    localStorage.removeItem(GEAR_KEY);
    window.location.reload();
}

function showToast(message, colour) {
    const existing = document.getElementById('levelup-toast');
    if (existing) existing.remove();

    const toast       = document.createElement('div');
    toast.id          = 'levelup-toast';
    toast.className   = 'save-toast' + (colour === 'accent' ? ' save-toast--accent' : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease';
        toast.style.opacity    = '0';
        setTimeout(() => toast.remove(), 400);
    }, 2000);
}

// ─── TOOLTIPS ────────────────────────────────────────────────
function setupTooltips() {
    document.querySelectorAll('.tappable').forEach(el => {
        const fresh = el.cloneNode(true);
        el.parentNode.replaceChild(fresh, el);
        fresh.addEventListener('click', e => {
            e.stopPropagation();
            playUIClick();
            const tip = fresh.dataset.tip;
            if (!tip) return;
            const box    = document.getElementById('tip-' + tip);
            if (!box) return;
            const isOpen = box.classList.contains('visible');
            document.querySelectorAll('.tooltip-box')
                .forEach(b => b.classList.remove('visible'));
            if (!isOpen) box.classList.add('visible');
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.tooltip-box')
            .forEach(b => b.classList.remove('visible'));
    });
}

// ─── UI HELPERS ──────────────────────────────────────────────
function showScreen(id) {
    const prev      = document.querySelector('.screen.active');
    const wasQuests = prev && prev.id === 'screen-quests';

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    if (id === 'screen-status') setupTooltips();
    if (id === 'screen-quests') {
        renderQuests(dailyQuests, player.completedToday, player.momentum || 1.0);
        startAmbientDrone();
    }
    if (wasQuests && id !== 'screen-quests') stopAmbientDrone();
}

// ─── START ───────────────────────────────────────────────────
init();