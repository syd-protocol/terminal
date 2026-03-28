// ═══════════════════════════════════════════════════════════════
// SYD GES — dailyloop.js
// The daily loop: morning transmission, mid-day nudge,
// close-of-day sequence.
//
// SYD narrates every transition. Not UI labels — a voice.
// Morning: specific, honest, short. Based on yesterday's data.
// Mid-day: one line if no engagement by noon.
// Close-of-day: momentum update, capacity summary, journal prompt.
//
// The loop is goal-paced, not time-paced. SYD pushes.
// The operative pulls. Always present, never overwhelming.
// ═══════════════════════════════════════════════════════════════

// ─── DAILY LOOP KEYS ─────────────────────────────────────────
const MORNING_TX_KEY     = 'syd_morning_tx';    // date of last morning transmission shown
const DAY_CLOSED_KEY     = 'syd_day_closed';    // date of last close-of-day sequence
const MIDDAY_NUDGE_KEY   = 'syd_midday_nudge';  // date of last mid-day nudge shown

// ─── MORNING TRANSMISSION ────────────────────────────────────
// Fires once per day on first open. SYD's voice.
// Short, specific, honest. Based on previous day's data.
// Not motivational. Not a greeting. A briefing.
//
// Check: has the morning transmission been shown today?
// If not, show it after relaunch boot resolves.

function shouldShowMorningTransmission() {
    const last = localStorage.getItem(MORNING_TX_KEY);
    return last !== today();
}

function markMorningTransmissionShown() {
    localStorage.setItem(MORNING_TX_KEY, today());
}

// The morning transmission overlay renders over the status screen.
// The operative dismisses it by tapping VIEW DIRECTIVES.
function showMorningTransmission() {
    if (!player) return;
    markMorningTransmissionShown();

    const overlay = document.getElementById('overlay-morning');
    const linesEl = document.getElementById('morning-lines');
    const btn     = document.getElementById('morning-directives-btn');
    if (!overlay || !linesEl || !btn) return;

    overlay.classList.remove('hidden');
    linesEl.innerHTML = '';
    btn.classList.add('hidden');
    btn.classList.remove('morning-btn--visible');

    const lines = buildMorningLines();
    let idx = 0;

    function nextLine() {
        if (idx >= lines.length) {
            setTimeout(() => {
                btn.classList.remove('hidden');
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => btn.classList.add('morning-btn--visible'))
                );
            }, 350);
            return;
        }
        const el = document.createElement('div');
        el.className   = 'morning-line';
        el.textContent = lines[idx];
        if (lines[idx].startsWith('[') || lines[idx].startsWith('>')) {
            el.classList.add('morning-line--highlight');
        }
        linesEl.appendChild(el);
        requestAnimationFrame(() =>
            requestAnimationFrame(() => el.classList.add('morning-line--visible'))
        );
        idx++;
        setTimeout(nextLine, 950);
    }

    btn.onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
        // Switch to directives tab so operative sees today's mission
        if (typeof switchStatusTab === 'function') switchStatusTab('directives');
    };

    nextLine();
}

// Builds the morning lines based on operative state.
// Specific, honest, no fluff. SYD reads the numbers.
function buildMorningLines() {
    const level      = calculateLevel ? calculateLevel() : 1;
    const momentum   = player.momentum || 1.0;
    const capacity   = player.capacity ?? player.maxCapacity ?? 100;
    const maxCap     = player.maxCapacity || 100;
    const dayNum     = player.operatorDays || 1;
    const completed  = (player.completedToday || []).length;
    const totalToday = (dailyQuests || []).length;
    const capPct     = Math.round((capacity / maxCap) * 100);

    const lines = [];

    // Opening
    lines.push('> SYD MORNING TRANSMISSION');
    lines.push(`> OPERATIVE: ${player.name}  //  DAY ${dayNum}`);
    lines.push('');

    // Momentum read
    if (momentum >= 1.4) {
        lines.push(`MOMENTUM AT ${momentum.toFixed(2)}×. You are compounding. Do not break the chain.`);
    } else if (momentum >= 1.2) {
        lines.push(`MOMENTUM: ${momentum.toFixed(2)}×. Building. Keep showing up.`);
    } else if (momentum >= 1.05) {
        lines.push(`MOMENTUM: ${momentum.toFixed(2)}×. Early stages. The compounding is not visible yet. Trust the system.`);
    } else {
        lines.push(`MOMENTUM: ${momentum.toFixed(2)}×. You missed days. The system registered it. Today is the reset.`);
    }

    // Capacity read
    if (capPct >= 80) {
        lines.push(`CAPACITY: ${capacity} / ${maxCap}. You are recovered. Use it.`);
    } else if (capPct >= 50) {
        lines.push(`CAPACITY: ${capacity} / ${maxCap}. Functional. Include a rest directive if you can.`);
    } else if (capPct >= 25) {
        lines.push(`CAPACITY: ${capacity} / ${maxCap}. Below midpoint. Complete directives — do not push past them.`);
    } else {
        lines.push(`CAPACITY: ${capacity} / ${maxCap}. Low. Today's directives are your floor, not your ceiling.`);
    }

    // Directives context
    if (totalToday > 0 && completed === totalToday) {
        lines.push(`Yesterday's directives: complete. That matters.`);
    } else if (totalToday > 0 && completed > 0) {
        lines.push(`${completed} of ${totalToday} directives completed yesterday. Partial counts.`);
    }

    // Day-specific context
    if (dayNum === 1) {
        lines.push('This is your first day. Five directives. That is all.');
    } else if (dayNum <= 7) {
        lines.push(`Day ${dayNum} of your foundation week. Seven days builds the baseline.`);
    } else if (dayNum % 30 === 0) {
        lines.push(`${Math.floor(dayNum / 30)} month${dayNum >= 60 ? 's' : ''} in. The operative you are becoming is not visible yet from the inside.`);
    }

    lines.push('');
    lines.push(`[ ${totalToday} DIRECTIVE${totalToday !== 1 ? 'S' : ''} QUEUED FOR TODAY ]`);

    return lines;
}

// ─── MID-DAY NUDGE ────────────────────────────────────────────
// Fired if the operative opens the app between noon and 6pm
// and has not completed any directives that day.
// One line from SYD. Not a warning. A check-in.
// Shown in the system log, not a separate overlay.

function checkMidDayNudge() {
    if (!player) return;
    const hour = new Date().getHours();
    if (hour < 12 || hour >= 18) return;                              // only noon to 6pm

    const alreadyNudged = localStorage.getItem(MIDDAY_NUDGE_KEY) === today();
    if (alreadyNudged) return;

    const completed = (player.completedToday || []).length;
    if (completed > 0) return;                                        // already started — no nudge

    localStorage.setItem(MIDDAY_NUDGE_KEY, today());
    if (typeof showLog === 'function') {
        showLog('[ SYD — MID-DAY CHECK. DIRECTIVES STILL QUEUED. ]', 'accent');
    }
}

// ─── CLOSE-OF-DAY SEQUENCE ───────────────────────────────────
// Shown when the operative taps [ CLOSE DAY ] or at midnight.
// Summarises what happened: momentum, capacity, directives completed.
// Opens journal prompt after summary.
// The operative can also trigger this manually from the directives tab.

function shouldShowCloseOfDay() {
    return localStorage.getItem(DAY_CLOSED_KEY) !== today();
}

function triggerCloseOfDay() {
    if (!shouldShowCloseOfDay()) return;
    localStorage.setItem(DAY_CLOSED_KEY, today());

    const overlay = document.getElementById('overlay-close-day');
    const linesEl = document.getElementById('close-day-lines');
    const btn     = document.getElementById('close-day-journal-btn');
    const skipBtn = document.getElementById('close-day-skip-btn');
    if (!overlay || !linesEl) return;

    overlay.classList.remove('hidden');
    linesEl.innerHTML = '';
    if (btn)     btn.classList.add('hidden');
    if (skipBtn) skipBtn.classList.add('hidden');

    const lines = buildCloseOfDayLines();
    let idx = 0;

    function nextLine() {
        if (idx >= lines.length) {
            setTimeout(() => {
                if (btn)     { btn.classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => btn.classList.add('close-day-btn--visible'))); }
                if (skipBtn) { skipBtn.classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => skipBtn.classList.add('close-day-btn--visible'))); }
            }, 300);
            return;
        }
        const el = document.createElement('div');
        el.className   = 'close-day-line';
        el.textContent = lines[idx];
        if (lines[idx].startsWith('[') || lines[idx].startsWith('>')) {
            el.classList.add('close-day-line--highlight');
        }
        linesEl.appendChild(el);
        requestAnimationFrame(() =>
            requestAnimationFrame(() => el.classList.add('close-day-line--visible'))
        );
        idx++;
        setTimeout(nextLine, 900);
    }

    if (btn) {
        btn.onclick = () => {
            playUIClick();
            overlay.classList.add('hidden');
            if (typeof switchStatusTab === 'function') switchStatusTab('directives');
            // Scroll to journal — brief delay so tab renders first
            setTimeout(() => {
                const journalWrap = document.getElementById('journal-prompt-wrap');
                if (journalWrap) journalWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        };
    }

    if (skipBtn) {
        skipBtn.onclick = () => {
            playUIClick();
            overlay.classList.add('hidden');
        };
    }

    nextLine();
    playTone(330, 0.2, 'sine', 0.08);
}

// Builds close-of-day summary lines. Honest read of the day.
function buildCloseOfDayLines() {
    const completed  = (player.completedToday || []).length;
    const totalToday = (dailyQuests || []).length;
    const momentum   = player.momentum || 1.0;
    const capacity   = player.capacity ?? player.maxCapacity ?? 100;
    const maxCap     = player.maxCapacity || 100;
    const lines      = [];

    lines.push('> END OF DAY TRANSMISSION');
    lines.push('');

    // Directives read
    if (totalToday === 0) {
        lines.push('No directives were issued today.');
    } else if (completed === totalToday) {
        lines.push(`${completed} of ${totalToday} directives executed.`);
        lines.push('Full day. Momentum held.');
    } else if (completed > 0) {
        lines.push(`${completed} of ${totalToday} directives executed.`);
        lines.push('Partial day. Better than nothing. Not as good as complete.');
    } else {
        lines.push('No directives executed today.');
        lines.push('The day happened anyway. Register it honestly and move on.');
    }

    lines.push('');

    // Momentum projection
    const nextMomentum = completed === totalToday
        ? buildMomentum((player.consecutiveDays || 0) + 1)
        : decayMomentum(momentum, 1);
    const mDelta = parseFloat((nextMomentum - momentum).toFixed(4));
    const mDir   = mDelta >= 0 ? '+' + mDelta.toFixed(4) : mDelta.toFixed(4);
    lines.push(`MOMENTUM PROJECTION: ${nextMomentum.toFixed(4)} (${mDir})`);
    lines.push(`CAPACITY: ${capacity} / ${maxCap}`);

    lines.push('');
    lines.push(`[ LOG THE DAY BEFORE IT FADES ]`);

    return lines;
}

// ─── DAY-AWARE JOURNAL PROMPTS ────────────────────────────────
// The journal prompt changes based on what stats were trained today
// and how many days the operative has been active.
// At the Gemini phase, SYD generates a personalised prompt from
// the specific directives completed. For now: 5 rotating prompts
// weighted toward the most-trained stat of the day.

function getTodaysJournalPrompt() {
    if (!player) return getDefaultJournalPrompt();

    // Find which stat was trained most today
    const completedIds = player.completedToday || [];
    const statCounts   = { strength: 0, intelligence: 0, agility: 0, endurance: 0, charisma: 0 };

    if (typeof dailyQuests !== 'undefined') {
        dailyQuests.forEach(q => {
            if (completedIds.includes(q.id) && statCounts[q.stat] !== undefined) {
                statCounts[q.stat]++;
            }
        });
    }

    const topStat = Object.entries(statCounts).sort((a, b) => b[1] - a[1])[0];
    if (!topStat || topStat[1] === 0) return getDefaultJournalPrompt();

    return getStatJournalPrompt(topStat[0]);
}

function getStatJournalPrompt(stat) {
    // [TUNING TARGET] Journal prompts per stat — these rotate daily via date seed
    const prompts = {
        strength: [
            'What did your body or energy tell you today that your head was trying to override?',
            'Where did you push through something you normally would have avoided? What made the difference?',
            'What did you actually do today versus what you planned to do? Be specific.'
        ],
        intelligence: [
            'What did you read, hear, or observe today that you want to remember? Why does it matter?',
            'Where did your understanding of something shift today, even slightly?',
            'What question came up today that you do not yet have a good answer to?'
        ],
        agility: [
            'Where did something not go as planned today? How did you respond?',
            'What assumption did you hold at the start of today that turned out to be wrong?',
            'Where were you most uncomfortable today? What did that discomfort signal?'
        ],
        endurance: [
            'What did you keep going on today when the obvious move was to stop?',
            'Where did the work feel heavy? Where did it feel light? What was the difference?',
            'What would tomorrow\'s version of you thank you for doing today?'
        ],
        charisma: [
            'What interaction today left you with useful information about how someone else sees the world?',
            'Where did you read a room correctly today? Where did you miss it?',
            'Who showed up for you today, in any form? Did you acknowledge it?'
        ]
    };

    const pool    = prompts[stat] || prompts.intelligence;
    const dateNum = parseInt(today().replace(/-/g, ''), 10);
    return pool[dateNum % pool.length];
}

function getDefaultJournalPrompt() {
    const defaults = [
        'What actually happened today? Not the ideal version — the real one.',
        'One thing that went as planned. One thing that did not.',
        'What is the honest version of today?',
        'What do you know at the end of today that you did not know at the start?',
        'If tomorrow you needed to explain what today was for — what would you say?'
    ];
    const dateNum = parseInt(today().replace(/-/g, ''), 10);
    return defaults[dateNum % defaults.length];
}

// ─── JOURNAL SAVE / LOAD ─────────────────────────────────────
const JOURNAL_KEY_PREFIX = 'syd_journal_';

function loadTodaysJournal() {
    return localStorage.getItem(JOURNAL_KEY_PREFIX + today()) || '';
}

function saveTodaysJournal(text) {
    localStorage.setItem(JOURNAL_KEY_PREFIX + today(), text);
}

// ─── DAILY LOOP INIT ─────────────────────────────────────────
// Called from app.js after init() resolves for returning operatives.
// Checks which daily loop events should fire.
function initDailyLoop() {
    if (!player) return;

    // Morning transmission: show once per day, after relaunch boot
    if (shouldShowMorningTransmission()) {
        setTimeout(() => showMorningTransmission(), 600);
    }

    // Mid-day nudge: passive check on open
    checkMidDayNudge();

    // Schedule midnight close-of-day check
    scheduleMidnightCheck();
}

// ─── MIDNIGHT CLOSE CHECK ────────────────────────────────────
// Fires at midnight (or near) to prompt the operative to close the day.
// Uses setTimeout to the next midnight. If the app is open at midnight,
// the close-of-day sequence fires automatically.
function scheduleMidnightCheck() {
    const now       = new Date();
    const midnight  = new Date(now);
    midnight.setHours(24, 0, 30, 0);   // 30 seconds past midnight for buffer
    const msUntil   = midnight - now;

    // Only schedule if the window is reasonably small (< 24h) to avoid drift
    if (msUntil > 0 && msUntil < 86400000) {
        setTimeout(() => {
            if (typeof triggerCloseOfDay === 'function') triggerCloseOfDay();
        }, msUntil);
    }
}

// ─── WINDOW ALIASES FOR STATUS.JS DELEGATION ─────────────────
// status.js delegates to these via window.loadTodaysJournal_dl
// and window.saveTodaysJournal_dl. This avoids naming conflicts
// while keeping dailyloop.js as the single source of truth for
// all journal persistence logic.
window.loadTodaysJournal_dl = loadTodaysJournal;
window.saveTodaysJournal_dl = saveTodaysJournal;
