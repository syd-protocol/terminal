// ═══════════════════════════════════════════════════════════════
// SYD GES — encounter.js
// One encounter per day. Two types — no labels shown.
// Both feel like SYD presenting a situation.
//
// Type A — Judgment: operative responds, SYD evaluates, feedback given.
// Type B — Teaching: SYD walks through expert thinking as revelation.
//
// Response mechanic: pick option → pick reasoning → two taps, one flow.
// Optional free text supplements or replaces option choice.
// When free text contradicts option: most important signal.
//
// STUB — AI evaluation is placeholder. Screen layout, response mechanic,
// option/reasoning flow, and feedback display are fully wired.
// Real Gemini evaluation is built at the Gemini integration phase.
// ═══════════════════════════════════════════════════════════════

// ─── ENCOUNTER POOL ──────────────────────────────────────────
// Pool is loaded from the dummy encounter array during build/test phase.
// Real pool of 160 encounters drops in at the content phase.
// Graceful fallback: if current tier pool is empty, serve best available lower tier.

const ENCOUNTER_KEY      = 'syd_encounter_today';
const ENCOUNTER_DONE_KEY = 'syd_encounter_done';

// [TUNING TARGET] Encounter tier unlock levels — same as directives
const ENCOUNTER_TIER_UNLOCK = { 1: 1, 2: 10, 3: 25 };

// Dummy encounter pool — replaced at content phase
const DUMMY_ENCOUNTERS = [
    {
        id:         'enc_dummy_t1_a',
        tier:       1,
        type:       'judgment',
        stat:       'intelligence',
        situation:  'You are three days into a new role. Your manager asks for a status update on a project you have barely had time to understand. What do you do?',
        options: [
            { id: 'a', text: 'Give a confident-sounding update based on what you have gathered so far.' },
            { id: 'b', text: 'Tell your manager you need more time to understand the project before reporting.' },
            { id: 'c', text: 'Ask a colleague for a quick brief before the meeting.' }
        ],
        reasonings: [
            { id: 'r1', text: 'To avoid looking unprepared in front of my manager.' },
            { id: 'r2', text: 'Because accuracy matters more than the appearance of competence.' },
            { id: 'r3', text: 'Because early relationships with colleagues are as important as early impressions with managers.' }
        ]
    },
    {
        id:         'enc_dummy_t1_b',
        tier:       1,
        type:       'teaching',
        stat:       'charisma',
        situation:  'A colleague sends you a long message complaining about a decision made by the team. They are clearly frustrated. What does the best response look like?',
        options: [
            { id: 'a', text: 'Explain the reasoning behind the decision so they understand it better.' },
            { id: 'b', text: 'Acknowledge their frustration first, then provide context if they want it.' },
            { id: 'c', text: 'Ask what outcome they are hoping for from this conversation.' }
        ],
        reasonings: [
            { id: 'r1', text: 'Because people want to feel understood before they want to be corrected.' },
            { id: 'r2', text: 'Because information without emotional acknowledgement lands as dismissal.' },
            { id: 'r3', text: 'Because the goal of the conversation matters more than the content of the complaint.' }
        ],
        teaching: 'The best practitioners know: frustrated people are not asking for information. They are asking to feel heard. The answer that works is always acknowledgement first, information second — and only if asked for. Option C goes even further: it reframes the conversation entirely by asking what they actually want. That is not a deflection. That is the highest-order social move in this situation.'
    }
];

// ─── ENCOUNTER STATE ─────────────────────────────────────────
let encounterState = {
    encounter:        null,
    selectedOption:   null,
    selectedReasoning: null,
    freeText:         ''
};

// ─── TODAY'S ENCOUNTER SELECTION ─────────────────────────────
// Selects one encounter per day, seeded by date.
// Scales with operative level and rank.
// Graceful fallback to lower tier if current tier pool is empty.

function getTodaysEncounter(level) {
    const done = localStorage.getItem(ENCOUNTER_DONE_KEY);
    if (done === new Date().toISOString().slice(0, 10)) return null; // already done today

    const tier      = getCurrentEncounterTier(level);
    const dateNum   = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
    const pool      = getEncounterPoolWithFallback(DUMMY_ENCOUNTERS, tier);

    if (!pool.length) return null;

    const picked = pool[dateNum % pool.length];
    return picked;
}

function getCurrentEncounterTier(level) {
    if (level >= 25) return 3;
    if (level >= 10) return 2;
    return 1;
}

function getEncounterPoolWithFallback(pool, targetTier) {
    let filtered = pool.filter(e => e.tier === targetTier);
    if (filtered.length > 0) return filtered;

    for (let t = targetTier - 1; t >= 1; t--) {
        filtered = pool.filter(e => e.tier === t);
        if (filtered.length > 0) {
            if (typeof showLog === 'function') {
                showLog(`[ TIER ${targetTier} ENCOUNTERS LOADING — OPERATING ON CURRENT BEST ]`, 'system');
            }
            return filtered;
        }
    }
    return [];
}

// ─── ENCOUNTER ENTRY POINT ───────────────────────────────────
// Called from the directives screen when the operative taps the encounter card.
// If no encounter is available today (already done, or skipped), shows the skipped state.

function openEncounter(level) {
    const encounter = getTodaysEncounter(level);
    encounterState.encounter = encounter;
    encounterState.selectedOption    = null;
    encounterState.selectedReasoning = null;
    encounterState.freeText          = '';

    showScreen('screen-encounter');

    if (!encounter) {
        renderEncounterDone();
        return;
    }

    renderEncounterSituation();
}

// ─── SITUATION SCREEN ────────────────────────────────────────
function renderEncounterSituation() {
    const enc       = encounterState.encounter;
    const container = document.getElementById('encounter-content');
    if (!container || !enc) return;

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <button class="enc-back-btn" id="enc-back">← BACK</button>
                <span class="enc-label">[ TRANSMISSION INCOMING ]</span>
            </div>
            <div class="encounter-situation">
                <p class="enc-situation-text">${enc.situation}</p>
            </div>
            <div class="enc-options" id="enc-options">
                ${(enc.options || []).map(opt => `
                    <button class="enc-option-btn" data-option-id="${opt.id}">
                        ${opt.text}
                    </button>
                `).join('')}
            </div>
            <div class="enc-free-text-wrap">
                <p class="enc-free-text-label">[ OPTIONAL — TYPE YOUR OWN RESPONSE ]</p>
                <textarea
                    id="enc-free-text"
                    class="enc-textarea"
                    placeholder="Your read on this situation..."
                    maxlength="500"
                ></textarea>
            </div>
            <div class="enc-footer-actions">
                <button class="enc-skip-btn" id="enc-skip">SKIP TODAY</button>
                <button class="btn btn--primary enc-submit-btn" id="enc-to-reasoning">
                    [ PICK YOUR REASONING ]
                </button>
            </div>
        </div>
    `;

    document.getElementById('enc-back').addEventListener('click', () => {
        playUIClick();
        goBack();
    });

    document.getElementById('enc-skip').addEventListener('click', () => {
        playUIClick();
        markEncounterSkipped();
        renderEncounterDone();
    });

    // Option selection — highlights picked option
    document.querySelectorAll('.enc-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.enc-option-btn').forEach(b => b.classList.remove('enc-option-btn--selected'));
            btn.classList.add('enc-option-btn--selected');
            encounterState.selectedOption = btn.dataset.optionId;
        });
    });

    document.getElementById('enc-to-reasoning').addEventListener('click', () => {
        playUIClick();
        encounterState.freeText = document.getElementById('enc-free-text').value.trim();
        if (!encounterState.selectedOption && !encounterState.freeText) {
            // Must pick option OR write free text before advancing
            document.getElementById('enc-free-text').focus();
            if (typeof showLog === 'function') {
                showLog('[ PICK A RESPONSE OR TYPE YOUR READ BEFORE ADVANCING ]', 'system');
            }
            return;
        }
        renderEncounterReasoning();
    });
}

// ─── REASONING SCREEN ────────────────────────────────────────
function renderEncounterReasoning() {
    const enc       = encounterState.encounter;
    const container = document.getElementById('encounter-content');
    if (!container || !enc) return;

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <span class="enc-label">[ WHAT IS DRIVING THAT RESPONSE? ]</span>
            </div>
            <div class="enc-options" id="enc-reasonings">
                ${(enc.reasonings || []).map(r => `
                    <button class="enc-option-btn" data-reasoning-id="${r.id}">
                        ${r.text}
                    </button>
                `).join('')}
            </div>
            <div class="enc-footer-actions">
                <button class="btn btn--primary enc-submit-btn" id="enc-submit">
                    [ SUBMIT ]
                </button>
            </div>
        </div>
    `;

    document.querySelectorAll('.enc-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            document.querySelectorAll('.enc-option-btn').forEach(b => b.classList.remove('enc-option-btn--selected'));
            btn.classList.add('enc-option-btn--selected');
            encounterState.selectedReasoning = btn.dataset.reasoningId;
        });
    });

    document.getElementById('enc-submit').addEventListener('click', () => {
        playUIClick();
        if (!encounterState.selectedReasoning) return;
        submitEncounterResponse();
    });
}

// ─── ENCOUNTER RESPONSE SUBMISSION ───────────────────────────
// Sends to Gemini at integration phase.
// CRITICAL: when free text is present, it supplements or overrides the option choice.
// Free text that contradicts the chosen option is the most important signal.
// This instruction MUST be explicitly built into every Gemini encounter prompt.
// [See Gemini prompt design — encounter evaluation prompt]

function submitEncounterResponse() {
    const enc = encounterState.encounter;
    if (!enc) return;

    const container = document.getElementById('encounter-content');
    if (!container) return;

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-loading">
                <div class="enc-loading-icon">⬡</div>
                <p class="enc-loading-label">[ SYD IS READING YOUR RESPONSE... ]</p>
            </div>
        </div>
    `;

    // [STUB] Simulate Gemini evaluation — replaced at Gemini integration phase.
    // At that point: if enc.type === 'judgment', call Gemini with operative's
    // option + reasoning + free text. If enc.type === 'teaching', render teaching content.
    setTimeout(() => {
        markEncounterComplete();
        if (enc.type === 'teaching' && enc.teaching) {
            renderTeachingFeedback(enc);
        } else {
            renderJudgmentFeedback(enc);
        }
    }, 1600);
}

// ─── FEEDBACK: JUDGMENT TYPE ──────────────────────────────────
function renderJudgmentFeedback(enc) {
    const container = document.getElementById('encounter-content');
    if (!container) return;

    const selectedOpt = (enc.options || []).find(o => o.id === encounterState.selectedOption);
    const freeText    = encounterState.freeText;

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <span class="enc-label">[ SYD EVALUATION ]</span>
            </div>
            <div class="enc-feedback">
                ${selectedOpt ? `
                    <div class="enc-feedback-picked">
                        <span class="enc-feedback-picked-label">YOUR PICK</span>
                        <p>${selectedOpt.text}</p>
                    </div>
                ` : ''}
                ${freeText ? `
                    <div class="enc-feedback-free">
                        <span class="enc-feedback-free-label">YOUR READ</span>
                        <p>${freeText}</p>
                    </div>
                ` : ''}
                <div class="enc-feedback-body">
                    <p class="enc-feedback-text">
                        [ DUMMY FEEDBACK — Gemini evaluation drops in at integration phase. ]
                    </p>
                    <p class="enc-feedback-sub">
                        The instinct behind your pick is the hard part. Here is how you package it at the next level.
                    </p>
                </div>
            </div>
            <div class="enc-footer-actions">
                <button class="btn btn--primary" id="enc-done">[ ACKNOWLEDGED ]</button>
            </div>
        </div>
    `;

    document.getElementById('enc-done').addEventListener('click', () => {
        playUIClick();
        goBack();
    });
}

// ─── FEEDBACK: TEACHING TYPE ──────────────────────────────────
function renderTeachingFeedback(enc) {
    const container = document.getElementById('encounter-content');
    if (!container) return;

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <span class="enc-label">[ SYD — EXPERT THINKING ]</span>
            </div>
            <div class="enc-feedback enc-feedback--teaching">
                <p class="enc-feedback-text">${enc.teaching}</p>
            </div>
            <div class="enc-footer-actions">
                <button class="btn btn--primary" id="enc-done">[ ACKNOWLEDGED ]</button>
            </div>
        </div>
    `;

    document.getElementById('enc-done').addEventListener('click', () => {
        playUIClick();
        goBack();
    });
}

// ─── ALREADY-DONE STATE ───────────────────────────────────────
function renderEncounterDone() {
    const container = document.getElementById('encounter-content');
    if (!container) return;

    container.innerHTML = `
        <div class="encounter-wrap encounter-wrap--done">
            <div class="encounter-header">
                <button class="enc-back-btn" id="enc-done-back">← BACK</button>
                <span class="enc-label">[ ENCOUNTER ]</span>
            </div>
            <div class="enc-done-body">
                <div class="enc-done-icon">⬡</div>
                <p class="enc-done-label">[ TODAY'S ENCOUNTER LOGGED ]</p>
                <p class="enc-done-sub">Another transmission arrives tomorrow.</p>
            </div>
        </div>
    `;

    document.getElementById('enc-done-back').addEventListener('click', () => {
        playUIClick();
        goBack();
    });
}

// ─── COMPLETION HELPERS ───────────────────────────────────────
function markEncounterComplete() {
    localStorage.setItem(ENCOUNTER_DONE_KEY, new Date().toISOString().slice(0, 10));
}

function markEncounterSkipped() {
    localStorage.setItem(ENCOUNTER_DONE_KEY, new Date().toISOString().slice(0, 10));
}

function hasCompletedEncounterToday() {
    return localStorage.getItem(ENCOUNTER_DONE_KEY) === new Date().toISOString().slice(0, 10);
}
