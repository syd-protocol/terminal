// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'levelup_player';
const MAX_STAT    = 100;
const STAT_NAMES  = ['strength', 'intelligence', 'agility', 'endurance', 'charisma'];

// Answer index (0–3) maps to these starting point values
const ANSWER_WEIGHTS = [10, 15, 22, 30];

const TITLES = [
    { minLevel: 1, label: 'ORDINARY PERSON' },
    { minLevel: 2, label: 'AWAKENED'         },
    { minLevel: 4, label: 'APPRENTICE'       },
    { minLevel: 6, label: 'CHALLENGER'       },
    { minLevel: 8, label: 'PROVEN'           },
    { minLevel: 9, label: 'ELITE'            }
];

const ONBOARD_QUESTIONS = [
    {
        stat: 'strength',
        text: 'How many times did you move your body with purpose this past week?',
        options: ['Not at all', 'Once or twice', 'Three or four times', 'Almost every day']
    },
    {
        stat: 'intelligence',
        text: 'How often do you deliberately learn something outside of work or school?',
        options: ['Rarely or never', 'Occasionally', 'A few times a week', 'Daily']
    },
    {
        stat: 'agility',
        text: 'When your plans change unexpectedly, how do you typically respond?',
        options: [
            'It really unsettles me',
            'I struggle but manage',
            'I adapt fairly well',
            'I adapt quickly and move on'
        ]
    },
    {
        stat: 'endurance',
        text: 'How consistently do you follow through on things when motivation fades?',
        options: ['I often give up', 'I finish sometimes', 'I usually push through', 'I almost always finish']
    },
    {
        stat: 'charisma',
        text: 'How comfortable are you initiating conversations or building new connections?',
        options: ['Very uncomfortable', 'Somewhat uncomfortable', 'Fairly comfortable', 'Very comfortable']
    }
];

// ─── STATE ───────────────────────────────────────────────────────────────────
let player         = null;
let dailyQuests    = [];
let allQuests      = [];
let currentQuestion = 0;
let questionAnswers = {};

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
    allQuests = await loadQuests();
    player    = loadPlayer();

    setupTooltips();

    if (!player) {
        showScreen('screen-onboarding');
        runTypewriter();
        return;
    }

    checkDailyReset();
    dailyQuests = getDailyQuests(allQuests);
    updateStatusScreen();
    showScreen('screen-status');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/levelup/service-worker.js');
    }
}

// ─── TYPEWRITER ───────────────────────────────────────────────────────────────
function runTypewriter() {
    const heading = 'INITIALISING PLAYER DATA';
    const subtext = 'The system reads only what is true. Your answers shape your starting point.';
    const headEl  = document.getElementById('onboard-heading');
    const subEl   = document.getElementById('onboard-sub');

    typeText(headEl, heading, 55, () => {
        setTimeout(() => {
            typeText(subEl, subtext, 28, () => {
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

// ─── NAME SECTION ─────────────────────────────────────────────────────────────
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
    const btn = document.getElementById('start-btn');
    btn.textContent = label;
    btn.classList.remove('hidden');
    btn.onclick = fn;
}

function hideActionBtn() {
    document.getElementById('start-btn').classList.add('hidden');
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────
function proceedToQuestions() {
    const name = document.getElementById('name-input').value.trim();
    if (!name) {
        document.getElementById('name-input').focus();
        return;
    }

    document.getElementById('name-section').classList.add('hidden');
    hideActionBtn();
    document.getElementById('onboard-sub').textContent =
        'Answer honestly — the system rewards truth.';

    currentQuestion  = 0;
    questionAnswers  = {};
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
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            optionsEl.querySelectorAll('.option-btn')
                .forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            questionAnswers[q.stat] = i;

            const isLast = index === ONBOARD_QUESTIONS.length - 1;
            showActionBtn(isLast ? 'AWAKEN' : 'NEXT', () => {
                if (isLast) {
                    createPlayer();
                } else {
                    currentQuestion++;
                    showQuestion(currentQuestion);
                }
            });
        });
        optionsEl.appendChild(btn);
    });
}

// ─── PLAYER MANAGEMENT ───────────────────────────────────────────────────────
function loadPlayer() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
}

function savePlayer() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}

function createPlayer() {
    const name = document.getElementById('name-input').value.trim().toUpperCase();

    // Build stats from answer weights
    const stats = {};
    STAT_NAMES.forEach(stat => {
        const answerIndex = questionAnswers[stat] ?? 0;
        stats[stat] = ANSWER_WEIGHTS[answerIndex];
    });

    player = {
        name,
        stats,
        completedToday: [],
        lastQuestDate:  today()
    };

    savePlayer();
    dailyQuests = getDailyQuests(allQuests);
    updateStatusScreen();
    showScreen('screen-status');
}

// ─── DAILY RESET ──────────────────────────────────────────────────────────────
function checkDailyReset() {
    if (player.lastQuestDate !== today()) {
        player.completedToday = [];
        player.lastQuestDate  = today();
        savePlayer();
    }
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// ─── LOAD QUESTS ──────────────────────────────────────────────────────────────
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

// ─── QUEST COMPLETION ────────────────────────────────────────────────────────
function completeQuest(id, stat, xp) {
    if (player.completedToday.includes(id)) return;
    player.stats[stat] = Math.min(player.stats[stat] + xp, MAX_STAT);
    player.completedToday.push(id);
    savePlayer();
    renderQuests(dailyQuests, player.completedToday);
    updateStatusScreen();
    flashStat(stat);
}

// ─── STATUS SCREEN ───────────────────────────────────────────────────────────
function updateStatusScreen() {
    document.getElementById('player-name').textContent  = player.name;
    document.getElementById('player-level').textContent = calculateLevel();

    const title = calculateTitle();
    const titleEl = document.getElementById('player-title');
    titleEl.textContent = '[ ' + title + ' ]';

    STAT_NAMES.forEach(stat => {
        const val = player.stats[stat];
        document.getElementById('val-' + stat).textContent    = val;
        document.getElementById('bar-' + stat).style.width    = val + '%';
    });

    const luck = calculateLuck();
    document.getElementById('val-luck').textContent  = luck;
    document.getElementById('bar-luck').style.width  = luck + '%';

    setupTooltips();
}

// ─── CALCULATIONS ────────────────────────────────────────────────────────────
function calculateLuck() {
    const total = STAT_NAMES.reduce((sum, s) => sum + player.stats[s], 0);
    return Math.floor(total / STAT_NAMES.length);
}

function calculateLevel() {
    const avg = calculateLuck();
    if (avg < 20) return 1;
    if (avg < 30) return 2;
    if (avg < 40) return 3;
    if (avg < 50) return 4;
    if (avg < 60) return 5;
    if (avg < 70) return 6;
    if (avg < 80) return 7;
    if (avg < 90) return 8;
    return 9;
}

function calculateTitle() {
    const level = calculateLevel();
    let title   = TITLES[0].label;
    for (const t of TITLES) {
        if (level >= t.minLevel) title = t.label;
    }
    return title;
}

// ─── TOOLTIPS ────────────────────────────────────────────────────────────────
function setupTooltips() {
    document.querySelectorAll('.tappable').forEach(el => {
        const fresh = el.cloneNode(true);
        el.parentNode.replaceChild(fresh, el);

        fresh.addEventListener('click', e => {
            e.stopPropagation();
            const tip = fresh.dataset.tip;
            if (!tip) return;
            const box     = document.getElementById('tip-' + tip);
            if (!box) return;
            const isOpen  = box.classList.contains('visible');

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

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'screen-quests') {
        renderQuests(dailyQuests, player.completedToday);
    }
}

function flashStat(stat) {
    const row = document.querySelector(`[data-stat="${stat}"]`);
    if (!row) return;
    row.style.background = '#1a3a2a';
    setTimeout(() => { row.style.background = ''; }, 600);
}

// ─── START ───────────────────────────────────────────────────────────────────
init();