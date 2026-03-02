// ═══════════════════════════════════════════════════════════════
// LEVELUP — app.js
// ═══════════════════════════════════════════════════════════════

// ─── CONSTANTS ───────────────────────────────────────────────
const STORAGE_KEY = 'levelup_player';
const GEAR_KEY    = 'levelup_gear';
const STAT_NAMES  = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];
const STAT_FLOOR  = 10;

const ANSWER_WEIGHTS = [10, 14, 18, 23];

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
    'Every day is a quest. Are you playing?',
    'Real life has no respawn. Level up while you can.',
    'The grind never stops — but it does compound.',
    'F-Rank today. What about tomorrow?',
    'Stats don\'t lie. Effort doesn\'t either.',
    'The system is watching. Are you showing up?',
    'Progress is invisible until suddenly it isn\'t.',
    'Your future self is watching. Don\'t let them down.',
    'Discipline is just delayed gratification done consistently.',
    'One quest at a time. One level at a time.'
];

function getRandomTagline() {
    return SHARE_TAGLINES[Math.floor(Math.random() * SHARE_TAGLINES.length)];
}

// ─── ONBOARDING QUESTIONS ────────────────────────────────────
const ONBOARD_QUESTIONS = [
    {
        stat: 'strength',
        text: 'Physical activity and taking care of my body is a regular part of how I live.',
        options: ['Strongly Disagree', 'Mostly Disagree', 'Mostly Agree', 'Strongly Agree']
    },
    {
        stat: 'intelligence',
        text: 'I actively seek out new knowledge and enjoy learning outside of what I have to.',
        options: ['Strongly Disagree', 'Mostly Disagree', 'Mostly Agree', 'Strongly Agree']
    },
    {
        stat: 'agility',
        text: "When things don't go to plan, I tend to adjust and keep moving rather than getting stuck.",
        options: ['Strongly Disagree', 'Mostly Disagree', 'Mostly Agree', 'Strongly Agree']
    },
    {
        stat: 'endurance',
        text: 'I generally follow through on commitments even when the initial motivation has faded.',
        options: ['Strongly Disagree', 'Mostly Disagree', 'Mostly Agree', 'Strongly Agree']
    },
    {
        stat: 'charisma',
        text: 'I find it natural to connect with people and tend to build relationships without much friction.',
        options: ['Strongly Disagree', 'Mostly Disagree', 'Mostly Agree', 'Strongly Agree']
    }
];

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

function playQuestComplete() {
    playTone(523, 0.12);
    setTimeout(() => playTone(659, 0.12), 100);
    setTimeout(() => playTone(784, 0.2),  200);
}

function playLevelUp() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 0.25, 'sine', 0.2), i * 120));
}

function playRankUp() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 0.3, 'triangle', 0.25), i * 100));
    setTimeout(() => playTone(1568, 0.6, 'sine', 0.3), 550);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-icon').textContent = soundEnabled ? '🔊' : '🔇';
    localStorage.setItem('levelup_sound', soundEnabled ? '1' : '0');
}

function showSoundPrompt() {
    const prompt = document.createElement('div');
    prompt.style.cssText = `
        position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
        background:#1a1a2e; border:1px solid #4fc3f7; color:#c8d6e5;
        font-family:'Share Tech Mono',monospace; font-size:0.7rem;
        letter-spacing:1px; padding:12px 20px; z-index:9999;
        text-align:center; max-width:320px; width:90%;
        animation:fadeIn 0.4s ease; line-height:1.6; pointer-events:none;
    `;
    prompt.innerHTML = `🔊 SOUND IS ON<br>
        <span style="color:#5a6a7a;font-size:0.65rem;">
            Enables immersive audio feedback.<br>
            Toggle anytime with the icon above.
        </span>`;
    document.body.appendChild(prompt);
    setTimeout(() => {
        prompt.style.transition = 'opacity 0.5s ease';
        prompt.style.opacity    = '0';
        setTimeout(() => prompt.remove(), 500);
    }, 3000);
}

// ─── STATE ───────────────────────────────────────────────────
let player          = null;
let dailyQuests     = [];
let allQuests       = [];
let currentQuestion = 0;
let questionAnswers = {};
let currentGear     = 1; // 1, 2, or 3 — loaded from localStorage on init

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
    allQuests = await loadQuests();
    player    = loadPlayer();

    const savedSound = localStorage.getItem('levelup_sound');
    if (savedSound === null) {
        soundEnabled = true;
        localStorage.setItem('levelup_sound', '1');
        showSoundPrompt();
    } else {
        soundEnabled = savedSound === '1';
    }
    document.getElementById('sound-icon').textContent = soundEnabled ? '🔊' : '🔇';
    document.getElementById('sound-toggle').addEventListener('click', toggleSound);

    // Load saved gear (defaults to 1 if never set)
    currentGear = loadGear();

    // Settings gear button
    document.getElementById('settings-btn').addEventListener('click', openSettings);

    setupTooltips();

    if (!player) {
        showScreen('screen-onboarding');
        runTypewriter();
        return;
    }

    checkDailyReset();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), currentGear);
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

// ─── TYPEWRITER ───────────────────────────────────────────────
function runTypewriter() {
    const heading = 'INITIALISING PLAYER DATA';
    const subtext = 'The system reads only what is true. Your answers shape your destiny.';
    const headEl  = document.getElementById('onboard-heading');
    const subEl   = document.getElementById('onboard-sub');

    typeText(headEl, heading, 50, () => {
        setTimeout(() => {
            typeText(subEl, subtext, 25, () => {
                setTimeout(() => {
                    document.getElementById('name-section').classList.remove('hidden');
                    document.getElementById('name-input').focus();
                    setupNameSection();
                }, 300);
            });
        }, 200);
    });
}

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
}

// ─── NAME SECTION ─────────────────────────────────────────────
function setupNameSection() {
    const input = document.getElementById('name-input');
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') proceedToQuestions();
    });
    input.addEventListener('input', () => {
        if (input.value.trim().length > 0) {
            showActionBtn('CONTINUE', proceedToQuestions);
        } else {
            hideActionBtn();
        }
    });
}

function showActionBtn(label, fn) {
    const btn       = document.getElementById('start-btn');
    btn.textContent = label;
    btn.classList.remove('hidden');
    btn.onclick     = fn;
}

function hideActionBtn() {
    document.getElementById('start-btn').classList.add('hidden');
}

// ─── QUESTIONS ────────────────────────────────────────────────
function proceedToQuestions() {
    const name = document.getElementById('name-input').value.trim();
    if (!name) { document.getElementById('name-input').focus(); return; }

    document.getElementById('name-section').classList.add('hidden');
    hideActionBtn();
    document.getElementById('onboard-sub').textContent =
        'Answer honestly — the system rewards truth.';

    currentQuestion = 0;
    questionAnswers = {};
    document.getElementById('question-section').classList.remove('hidden');
    showQuestion(0);
}

function showQuestion(index) {
    const q = ONBOARD_QUESTIONS[index];
    document.getElementById('q-stat').textContent =
        '[ ' + q.stat.toUpperCase() + ' ASSESSMENT ]';
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('q-progress').textContent =
        'QUESTION ' + (index + 1) + ' OF ' + ONBOARD_QUESTIONS.length;

    const optionsEl = document.getElementById('q-options');
    optionsEl.innerHTML = '';
    hideActionBtn();

    q.options.forEach((opt, i) => {
        const btn       = document.createElement('button');
        btn.className   = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            optionsEl.querySelectorAll('.option-btn')
                .forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            questionAnswers[q.stat] = i;
            const isLast = index === ONBOARD_QUESTIONS.length - 1;
            showActionBtn(isLast ? 'AWAKEN' : 'NEXT', () => {
                if (isLast) { runAwakenSequence(); }
                else        { showQuestion(index + 1); }
            });
        });
        optionsEl.appendChild(btn);
    });
}

// ─── AWAKEN BOOT SEQUENCE ─────────────────────────────────────
function runAwakenSequence() {
    const name    = document.getElementById('name-input').value.trim().toUpperCase();
    const overlay = document.getElementById('overlay-awaken');
    overlay.classList.remove('hidden');

    const bootLines = [
        '> SCANNING PLAYER DATA...',
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

// ─── PLAYER MANAGEMENT ───────────────────────────────────────
function loadPlayer() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
}

function savePlayer() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}

function createPlayer(name) {
    const stats = {};
    STAT_NAMES.forEach(stat => {
        const idx   = questionAnswers[stat] ?? 0;
        stats[stat] = ANSWER_WEIGHTS[idx];
    });

    player = {
        name,
        stats,
        completedToday:  [],
        lastQuestDate:   today(),
        consecutiveDays: 1,
        momentum:        1.0,
        lastActiveDate:  today()
    };

    savePlayer();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), currentGear);
    showStatusScreenWithAnimation();
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
        player.momentum        = decayMomentum(player.momentum || 1.0, diffDays - 1);
    }

    player.completedToday = [];
    player.lastQuestDate  = todayStr;
    player.lastActiveDate = todayStr;
    savePlayer();
}

function today() {
    return new Date().toISOString().slice(0, 10);
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

// ─── QUEST COMPLETION ────────────────────────────────────────
function completeQuest(id, stat, baseXP) {
    if (player.completedToday.includes(id)) return;

    const momentum  = player.momentum || 1.0;
    const earnedAmt = parseFloat((baseXP * momentum).toFixed(1));
    const xpBefore  = earnedXP(player.stats);

    player.stats[stat] = parseFloat(
        ((player.stats[stat] || STAT_FLOOR) + earnedAmt).toFixed(1)
    );
    player.completedToday.push(id);
    savePlayer();

    const card = document.getElementById('quest-card-' + id);
    if (card) {
        card.classList.add('completing');
        setTimeout(() => card.classList.remove('completing'), 400);
    }

    showFloatingXP(id, earnedAmt);
    playQuestComplete();

    const prevLevel = levelFromXP(xpBefore);
    const newLevel  = calculateLevel();
    const prevRank  = rankFromLevel(prevLevel);
    const newRank   = rankFromLevel(newLevel);

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
    const title    = titleFromLevel(level);
    const xp       = earnedXP(player.stats);
    const xpThis   = xp - xpForLevel(level);
    const xpNext   = xpForLevel(level + 1) - xpForLevel(level);
    const pct      = xpNext > 0 ? Math.min(100, Math.round((xpThis / xpNext) * 100)) : 100;
    const momentum = player.momentum || 1.0;

    setupTooltips();

    document.getElementById('player-name').textContent  = player.name;
    document.getElementById('player-level').textContent = level;
    document.getElementById('player-title').textContent = '[ ' + title + ' ]';

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
function showFloatingXP(questId, amount) {
    const card = document.getElementById('quest-card-' + questId);
    if (!card) return;
    const rect        = card.getBoundingClientRect();
    const label       = document.createElement('div');
    label.className   = 'float-xp';
    label.textContent = '+' + amount + ' XP';
    label.style.left  = (rect.left + rect.width / 2 - 20) + 'px';
    label.style.top   = (rect.top + window.scrollY) + 'px';
    document.body.appendChild(label);
    setTimeout(() => label.remove(), 1000);
}

// ─── LEVEL UP OVERLAY ────────────────────────────────────────
// Overlays are now interactive — they do NOT auto-dismiss.
// User must tap Share or Dismiss.
function showLevelUpOverlay(level) {
    playLevelUp();
    spawnParticles('lu-particles', 20, 'var(--accent)');

    const titleText = titleFromLevel(level);
    const rankText  = rankFromLevel(level);
    const subText   = rankText + '-RANK  ·  KEEP GOING';

    document.getElementById('lu-level').textContent = level;
    document.getElementById('lu-title').textContent = titleText;
    document.getElementById('lu-sub').textContent   = subText;

    const overlay = document.getElementById('overlay-levelup');
    overlay.classList.remove('hidden');

    // Share button — generates canvas card and triggers native share / download
    document.getElementById('lu-share-btn').onclick = () => shareCard({
        headline:    'LEVEL UP',
        bigText:     String(level),
        titleText,
        subText,
        accentColor: '#4fc3f7'
    });

    // Dismiss button
    document.getElementById('lu-dismiss-btn').onclick = () =>
        overlay.classList.add('hidden');
}

// ─── RANK UP OVERLAY ─────────────────────────────────────────
function showRankUpOverlay(rank, level) {
    playRankUp();
    spawnParticles('ru-particles', 35, 'var(--gold)');

    const titleText = rank + '-RANK ACHIEVED';
    const subText   = titleFromLevel(level) + '  ·  LEVEL ' + level;

    document.getElementById('ru-rank').textContent  = rank;
    document.getElementById('ru-title').textContent = titleText;
    document.getElementById('ru-sub').textContent   = subText;

    const overlay = document.getElementById('overlay-rankup');
    overlay.classList.remove('hidden');

    // Share button
    document.getElementById('ru-share-btn').onclick = () => shareCard({
        headline:    'RANK UP',
        bigText:     rank,
        titleText,
        subText,
        accentColor: '#ffd700'
    });

    // Dismiss button
    document.getElementById('ru-dismiss-btn').onclick = () =>
        overlay.classList.add('hidden');
}

// ─── SHARE CARD GENERATOR ────────────────────────────────────
// Draws a 1080×1080 branded share image on a canvas.
// On mobile: triggers native share sheet with the image file.
// On desktop: downloads the image directly.

function shareCard({ headline, bigText, titleText, subText, accentColor }) {
    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Background ──────────────────────────────────
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, W, H);

    // Subtle dot-grid overlay
    ctx.fillStyle = 'rgba(42, 42, 74, 0.7)';
    for (let x = 30; x < W; x += 60) {
        for (let y = 30; y < H; y += 60) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Accent border lines ──────────────────────────
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, W, 5);       // top
    ctx.fillRect(0, H - 5, W, 5);   // bottom
    ctx.fillRect(0, 0, 5, H);       // left
    ctx.fillRect(W - 5, 0, 5, H);   // right

    // ── [ SYSTEM ] label ────────────────────────────
    ctx.fillStyle   = accentColor;
    ctx.textAlign   = 'center';
    ctx.font        = '500 30px monospace';
    ctx.fillText('[ SYSTEM ]', W / 2, 120);

    // ── Headline ─────────────────────────────────────
    ctx.fillStyle = 'rgba(200, 214, 229, 0.45)';
    ctx.font      = '32px monospace';
    ctx.fillText(headline, W / 2, 178);

    // ── Big number / rank — glowing ──────────────────
    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur  = 80;
    ctx.fillStyle   = accentColor;

    // Scale font down for long rank strings like SS+, SSS
    const bigFontSize = bigText.length > 2 ? 200 : 300;
    ctx.font = `bold ${bigFontSize}px monospace`;
    ctx.fillText(bigText, W / 2, 540);
    ctx.restore();

    // ── Title ────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 54px sans-serif';
    ctx.fillText(titleText, W / 2, 650);

    // ── Sub (rank · level) ───────────────────────────
    ctx.fillStyle = 'rgba(200, 214, 229, 0.5)';
    ctx.font      = '30px monospace';
    ctx.fillText(subText, W / 2, 712);

    // ── Divider line ────────────────────────────────
    ctx.strokeStyle = 'rgba(42, 42, 74, 1)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(120, 760);
    ctx.lineTo(W - 120, 760);
    ctx.stroke();

    // ── Player name ──────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 44px monospace';
    ctx.fillText(player.name, W / 2, 836);

    // ── Tagline ──────────────────────────────────────
    ctx.fillStyle = 'rgba(200, 214, 229, 0.35)';
    ctx.font      = '26px monospace';
    canvasWrapText(ctx, getRandomTagline(), W / 2, 908, W - 160, 38);

    // ── Watermark ────────────────────────────────────
    ctx.fillStyle = accentColor;
    ctx.font      = '22px monospace';
    ctx.globalAlpha = 0.6;
    ctx.fillText('LEVELUP', W / 2, 1032);
    ctx.globalAlpha = 1;

    // ── Share / download ─────────────────────────────
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
// Gear is stored independently of the player object so it persists
// across profile resets and is not affected by daily resets.

function loadGear() {
    const saved = parseInt(localStorage.getItem(GEAR_KEY), 10);
    return (saved === 2 || saved === 3) ? saved : 1;
}

function saveGear(gear) {
    currentGear = gear;
    localStorage.setItem(GEAR_KEY, String(gear));
    // Immediately regenerate today's quest list with the new gear
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), currentGear);
    // If the quest screen is currently visible, re-render it live
    if (document.getElementById('screen-quests').classList.contains('active')) {
        renderQuests(dailyQuests, player.completedToday, player.momentum || 1.0);
    }
}

// ─── SETTINGS ────────────────────────────────────────────────
function openSettings() {
    // Pre-fill current name
    document.getElementById('settings-name-input').value = player.name;
    // Always hide confirm box when opening
    document.getElementById('confirm-box').classList.add('hidden');
    // Wire buttons fresh each time (avoids duplicate listeners)
    document.getElementById('save-name-btn').onclick = savePlayerName;
    document.getElementById('reset-btn').onclick     = showConfirmReset;
    document.getElementById('confirm-yes').onclick   = resetProfile;
    document.getElementById('confirm-no').onclick    = () =>
        document.getElementById('confirm-box').classList.add('hidden');

    // Sync gear selector to current gear
    updateGearUI(currentGear);

    // Wire gear option buttons
    document.querySelectorAll('.gear-option-btn').forEach(btn => {
        btn.onclick = () => {
            const gear = parseInt(btn.dataset.gear, 10);
            saveGear(gear);
            updateGearUI(gear);
            showToast('✓ GEAR ' + gear + ' ACTIVATED');
        };
    });

    showScreen('screen-settings');
}

function updateGearUI(gear) {
    document.querySelectorAll('.gear-option-btn').forEach(btn => {
        const isActive = parseInt(btn.dataset.gear, 10) === gear;
        btn.classList.toggle('gear-active', isActive);
    });
    // Show the warning for the selected gear
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
    showToast('✓ NAME UPDATED');
    // Return to status after a beat so they see the change
    setTimeout(() => showScreen('screen-status'), 1200);
}

function showConfirmReset() {
    document.getElementById('confirm-box').classList.remove('hidden');
}

function resetProfile() {
    // Wipe all stored data and reload cleanly from onboarding
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('levelup_sound');
    localStorage.removeItem(GEAR_KEY);
    window.location.reload();
}

function showToast(message) {
    const existing = document.getElementById('levelup-toast');
    if (existing) existing.remove();

    const toast     = document.createElement('div');
    toast.id        = 'levelup-toast';
    toast.className = 'save-toast';
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
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'screen-quests') {
        renderQuests(dailyQuests, player.completedToday, player.momentum || 1.0);
    }
}

// ─── START ───────────────────────────────────────────────────
init();