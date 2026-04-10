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
//
// CRITICAL (from master design doc):
//   When free text is present, Gemini is explicitly told the operative
//   may have supplemented or OVERRIDDEN their option choice.
//   Free text that contradicts the chosen option is the MOST IMPORTANT signal.
//   This is built into EVERY Call 3 — not noted and ignored.
//   The free-text override rule is a top-level prompt instruction, not
//   a conditional block — it appears regardless of whether free text
//   is present, so Gemini is always primed to weight it correctly.
//
// Gemini integration (Call 3 — judgment evaluation):
//   evaluateJudgmentEncounter() — Type A evaluation + SYD feedback voice
//   Teaching encounters do not call Gemini — teaching text is pre-written.
//
// BLOCK D changes:
//   - Career domain tag added below [ TRANSMISSION INCOMING ] header.
//     Shown when the encounter has a domain field (career encounters from
//     syd_career_encounters always have one; life-stat encounters may not).
//   - Call 3 free-text override rule promoted to top-level prompt instruction.
//     Was buried inside the conditional freeTextBlock variable — now it is
//     rule #1 in the evaluation rules list, present in every single call.
//   - getTodaysCareerEncounter() added — surfaces a career encounter from
//     syd_career_encounters when available. Used by openEncounter() to
//     supplement or replace the life-stat encounter pool on career days.
//   - Career encounter pool loader added alongside life-stat pool.
//
// Local fallback: rule-based feedback from option + reasoning alignment.
// ═══════════════════════════════════════════════════════════════

// ─── ENCOUNTER POOL ──────────────────────────────────────────
const ENCOUNTER_KEY           = 'syd_encounter_today';
const ENCOUNTER_DONE_KEY      = 'syd_encounter_done';
// CAREER_ENCOUNTERS_KEY lives in path.js as the owner of career encounter storage.
// encounter.js reads directly from the storage key string to avoid const collision.

// [TUNING TARGET] Encounter tier unlock levels — same as directives
const ENCOUNTER_TIER_UNLOCK = { 1: 1, 2: 10, 3: 25 };

// Live encounter pool — loaded from data/encounters.json at boot.
// Graceful fallback: empty pool serves no encounter rather than breaking.
let ENCOUNTER_POOL = [];
let encounterPoolLoaded = false;

// ─── POOL LOADER ─────────────────────────────────────────────
// Called once at app boot (from app.js initDailyLoop or openEncounter).
// Subsequent calls are no-ops. All screen-rendering functions check
// encounterPoolLoaded before accessing ENCOUNTER_POOL.

async function loadEncounterPool() {
    if (encounterPoolLoaded) return;
    try {
        const res  = await fetch('data/encounters.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        ENCOUNTER_POOL      = data.encounters || [];
        encounterPoolLoaded = true;
    } catch (e) {
        console.warn('[SYD] Could not load encounters.json — encounters unavailable today.', e);
        ENCOUNTER_POOL      = [];
        encounterPoolLoaded = true;   // mark loaded so we do not retry on every open
    }
}

// ─── ENCOUNTER STATE ─────────────────────────────────────────
let encounterState = {
    encounter:         null,
    selectedOption:    null,
    selectedReasoning: null,
    freeText:          ''
};

// ─── TODAY'S ENCOUNTER SELECTION ─────────────────────────────
// Life-stat encounters: seeded from encounters.json pool.
// Career encounters: pulled from syd_career_encounters cache (Block D).
// Career encounters are surfaced when the cache is populated AND the
// operative is past Tier 0. Falls back to life-stat pool silently.

function getTodaysEncounter(level) {
    const done = localStorage.getItem(ENCOUNTER_DONE_KEY);
    if (done === new Date().toISOString().slice(0, 10)) return null;

    // Try career encounter first (Block D) — only after Tier 0
    const careerEncounter = getTodaysCareerEncounter(level);
    if (careerEncounter) return careerEncounter;

    // Fall back to life-stat pool
    const tier    = getCurrentEncounterTier(level);
    const dateNum = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
    const pool    = getEncounterPoolWithFallback(ENCOUNTER_POOL, tier);

    if (!pool.length) return null;
    return pool[dateNum % pool.length];
}

// ─── CAREER ENCOUNTER SELECTOR ───────────────────────────────
// Reads the syd_career_encounters cache (seeded by Call 2, refreshed by
// Call 4). Returns a date-seeded career encounter, or null if the cache
// is absent, malformed, or the operative is in Tier 0.
//
// Career encounters are marked with _isCareerEncounter: true so the
// domain tag renders correctly in the header.

function getTodaysCareerEncounter(level) {
    // No career encounters during Tier 0 (operatorDays 1–7)
    const operatorDays = (typeof player !== 'undefined' && player)
        ? (player.operatorDays || 0)
        : 0;
    if (operatorDays <= 7) return null;

    try {
        const raw = localStorage.getItem('syd_career_encounters');
        if (!raw) return null;
        const pool = JSON.parse(raw);
        if (!Array.isArray(pool) || pool.length === 0) return null;

        const dateNum = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
        const enc     = pool[dateNum % pool.length];
        if (!enc) return null;

        // Tag as career encounter so domain tag renders
        return { ...enc, _isCareerEncounter: true };

    } catch (e) {
        console.warn('[SYD] Could not load career encounter cache:', e);
        return null;
    }
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
                showLog('[ TIER ' + targetTier + ' ENCOUNTERS LOADING — OPERATING ON CURRENT BEST ]', 'system');
            }
            return filtered;
        }
    }
    return [];
}

// ─── ENCOUNTER ENTRY POINT ───────────────────────────────────
// Loads the encounter pool if not already loaded, then renders.
// Async load is fast (cached JSON) and only happens once per session.
function openEncounter(level) {
    showScreen('screen-encounter');

    // Show a brief loading state while the pool fetches
    const container = document.getElementById('encounter-content');
    if (container && !encounterPoolLoaded) {
        container.innerHTML = '<div class="encounter-wrap"><div class="encounter-loading"><div class="enc-loading-icon">&#x2B21;</div><p class="enc-loading-label">[ LOADING TRANSMISSION... ]</p></div></div>';
    }

    loadEncounterPool().then(() => {
        const encounter = getTodaysEncounter(level);
        encounterState.encounter         = encounter;
        encounterState.selectedOption    = null;
        encounterState.selectedReasoning = null;
        encounterState.freeText          = '';

        if (!encounter) {
            renderEncounterDone();
            return;
        }
        renderEncounterSituation();
    });
}

// ─── SITUATION SCREEN ────────────────────────────────────────
// BLOCK D: Career domain tag added below the header label when
// the encounter has a domain field. Rendered as a small muted tag —
// never labelled "CAREER" explicitly; just the domain name.
// Life-stat encounters without a domain field show nothing there.

function renderEncounterSituation() {
    const enc       = encounterState.encounter;
    const container = document.getElementById('encounter-content');
    if (!container || !enc) return;

    // Domain tag: shown for career encounters and any encounter with a domain field
    const domainTag = enc.domain
        ? `<span class="enc-domain-tag">${enc.domain.toUpperCase()}</span>`
        : '';

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <button class="enc-back-btn" id="enc-back">← BACK</button>
                <div class="enc-header-labels">
                    <span class="enc-label">[ STEP 1 OF 2 — READ THE SITUATION ]</span>
                    ${domainTag}
                </div>
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
                    [ CONTINUE → ]
                </button>
            </div>
        </div>
    `;

    document.getElementById('enc-back').addEventListener('click', () => {
        playUIClick(); goBack();
    });

    document.getElementById('enc-skip').addEventListener('click', () => {
        playUIClick(); markEncounterSkipped(); renderEncounterDone();
    });

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

    const selectedOpt = (enc.options || []).find(o => o.id === encounterState.selectedOption);
    const freeTextPreview = encounterState.freeText;

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <span class="enc-label">[ STEP 2 OF 2 — WHY THAT CALL? ]</span>
            </div>
            ${selectedOpt || freeTextPreview ? `
                <div class="enc-reasoning-anchor">
                    <span class="enc-reasoning-anchor-label">YOUR RESPONSE</span>
                    <p class="enc-reasoning-anchor-text">${selectedOpt ? selectedOpt.text : freeTextPreview}</p>
                </div>
                <p class="enc-reasoning-prompt">What was driving that?</p>
            ` : ''}
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
// Routes to Gemini (Type A) or pre-written teaching text (Type B).
// Shows a loading state while Gemini evaluates.

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

    markEncounterComplete();

    if (enc.type === 'teaching' && enc.teaching) {
        const hasFreeText = encounterState.freeText && encounterState.freeText.length > 10;
        if (hasFreeText && hasNeuralLink()) {
            // Free text present — call Gemini to acknowledge the operative's thinking
            // alongside the pre-written teaching content.
            evaluateTeachingEncounter(enc).then(feedback => {
                renderTeachingFeedback(enc, feedback);
            });
        } else {
            // No free text or no neural link — reveal pre-written teaching only
            setTimeout(() => renderTeachingFeedback(enc), 900);
        }
        return;
    }

    // Judgment encounters: call Gemini (Call 3) for personalised evaluation
    evaluateJudgmentEncounter(enc).then(feedback => {
        console.log('[SYD DEBUG] feedback object:', JSON.stringify(feedback));
        renderJudgmentFeedback(enc, feedback);
    });
}

// ─── GEMINI CALL 3a: TEACHING ENCOUNTER FREE TEXT ACKNOWLEDGEMENT ────────────
// Only fires when: enc.type === 'teaching' AND free text present AND neural link active.
// Does NOT evaluate — the teaching text is pre-written and authoritative.
// SYD's job here is only to acknowledge the operative's specific thinking,
// then transition into the teaching reveal.
// Returns { text, geminiEnhanced: bool }

async function evaluateTeachingEncounter(enc) {
    try {
        const freeText = encounterState.freeText;

        const prompt = `
You are SYD — a direct, honest career intelligence system. An operative wrote a free-text response to a situation, and now you are about to reveal the expert thinking on that situation.

SITUATION:
"${enc.situation}"

OPERATIVE'S FREE TEXT:
"${freeText}"

EXPERT THINKING (what you are about to reveal):
"${enc.teaching}"

Your task: Write 1–2 sentences ONLY that acknowledge what the operative wrote before the expert thinking is shown. Do not repeat the teaching text. Do not evaluate whether they were right or wrong — that is not the point of a teaching encounter. Simply acknowledge the instinct or thinking behind what they wrote, then hand off to the transmission.

SYD voice: direct, clipped, no flattery. End with a colon or a dash — signal that the teaching is coming.
Output ONLY the acknowledgement text. No labels. No JSON. No preamble.
`.trim();

        const result = await geminiGenerate(prompt);

        if (!result.ok || !result.text || result.text.trim().length < 10) {
            return { text: '', geminiEnhanced: false };
        }

        return { text: result.text.trim(), geminiEnhanced: true };
    } catch (e) {
        console.warn('[SYD] evaluateTeachingEncounter failed:', e.message || e);
        return { text: '', geminiEnhanced: false };
    }
}

// ─── GEMINI CALL 3: JUDGMENT EVALUATION ──────────────────────
// Sends the operative's full response to Gemini for evaluation.
//
// FREE TEXT OVERRIDE RULE (BLOCK D — promoted to top-level prompt rule):
//   The rule that free text overrides option choice when they conflict
//   is now rule #1 in the evaluation rules list — present in every
//   single Call 3 regardless of whether the operative used free text.
//   This ensures Gemini is always primed for the override case, not
//   just conditionally aware of it.
//
//   Previous approach: the critical instruction was inside the
//   freeTextBlock conditional variable. If no free text was provided,
//   Gemini was never told the rule existed.
//
//   New approach: rule #1 states the override policy. The freeTextBlock
//   then states whether free text was provided and, if so, what it was.
//   Gemini can apply rule #1 correctly in all cases.
//
// [RESEARCH] Source: Anthropic prompting docs — prompt structure.
// Finding: instructions placed prominently in a rules list are followed
//          more reliably than instructions embedded in conditional blocks.
// Applied: free-text override rule extracted to top-level rule position.
//
// Returns { text, geminiEnhanced: bool }

async function evaluateJudgmentEncounter(enc) {
    try {
    if (!hasNeuralLink()) {
        return buildLocalJudgmentFeedback(enc);
    }

    const selectedOpt = (enc.options || []).find(o => o.id === encounterState.selectedOption);
    const selectedRsn = (enc.reasonings || []).find(r => r.id === encounterState.selectedReasoning);
    const freeText    = encounterState.freeText;

    // Free text block — states whether free text was provided and what it was.
    // Rule #1 in the prompt handles the override logic; this block only provides the content.
    const hasFreeText   = freeText && freeText.length > 0;
    const freeTextBlock = hasFreeText
        ? `FREE TEXT RESPONSE: "${freeText}"`
        : `FREE TEXT: none provided.`;

    // Domain context for career encounters — included when available
    const domainContext = enc.domain
        ? `\nENCOUNTER DOMAIN: ${enc.domain}`
        : '';

    const prompt = `
You are SYD — a direct, honest career intelligence system. Evaluate an operative's response to a real-world judgment scenario.

SITUATION:
"${enc.situation}"
${domainContext}

OPERATIVE'S CHOSEN OPTION: ${selectedOpt ? '"' + selectedOpt.text + '"' : 'none selected'}
OPERATIVE'S REASONING: ${selectedRsn ? '"' + selectedRsn.text + '"' : 'none selected'}
${freeTextBlock}

Evaluation rules:
1. FREE TEXT OVERRIDE RULE — THIS IS THE MOST IMPORTANT RULE: If the operative provided free text AND it contradicts or meaningfully differs from their chosen option, treat the free text as the primary signal. The option choice is secondary. Acknowledge the free text instinct before anything else. Always apply this rule, even when the free text only partially overrides the option.
2. Acknowledge the RIGHT INSTINCT first — even if the phrasing or option label was imprecise.
3. Semantic equivalence matters: if the operative got the right idea but called it something different, recognise the instinct and frame the vocabulary as just packaging.
4. If there is a gap in their thinking, name it specifically — not vaguely.
5. Tell the operative what the NEXT LEVEL of this response looks like.
6. 3 to 4 sentences maximum.
7. SYD voice: direct, short sentences, no flattery, no filler, no "great job".
8. Do not use the word "journey" or "passion" — too soft.
9. Output ONLY the feedback text. No labels. No JSON. No preamble.
`.trim();

    const result = await geminiGenerate(prompt);

    if (!result.ok || !result.text || result.text.trim().length < 20) {
        console.warn('[SYD] Judgment evaluation fell back to local:', result.error);
        // Surface error inline — wrap in a rejected promise shape so callers
        // can offer retry. Return a special marker so the caller renders error UI.
        if (!result.ok) {
            return { text: null, geminiEnhanced: false, error: result, localFallback: buildLocalJudgmentFeedback(enc) };
        }
        return buildLocalJudgmentFeedback(enc);
    }

    return { text: result.text.trim(), geminiEnhanced: true };
    } catch(e) {
        console.warn('[SYD] evaluateJudgmentEncounter threw unexpectedly — using local fallback:', e.message || e);
        return buildLocalJudgmentFeedback(enc);
    }
}

// Local fallback: rule-based feedback from option + reasoning alignment.
// Designed to be genuinely useful — not a placeholder.
//
// Logic:
//   - Option B (transparency/accuracy) + reason about accuracy → strong alignment
//   - Option A (confident bluff) → name the risk
//   - Option C (seek info first) → acknowledge the instinct, add the missing piece
//   - Free text present → acknowledge it specifically

function buildLocalJudgmentFeedback(enc) {
    const optId    = encounterState.selectedOption;
    const freeText = encounterState.freeText;

    // Generic but honest fallback reads per option — designed per encounter stat domain
    // This will be replaced per-encounter at content phase when encounters are written
    // with their own teaching logic. For now, stat-based guidance.
    const statFallbacks = {
        intelligence: {
            a: 'Confidence without information is a form of guessing. The instinct to not look unprepared is understandable — but accuracy builds more trust over time than the appearance of preparation.',
            b: 'That is the right call. Accuracy over appearance is the intelligence move. The next level is knowing how to ask for more time without losing credibility — framing matters as much as the request.',
            c: 'Solid instinct. Gathering context before reporting is the right move. The next level is being explicit about why — your manager will trust someone who knows their information limits over someone who fills gaps with guesswork.',
            default: 'The right instinct in this kind of situation is information over performance. What looks like weakness in the short term — admitting you do not know something — is actually the highest-trust move available.'
        },
        charisma: {
            a: 'Context before acknowledgement almost never works. Frustrated people do not hear information until they feel heard first. The sequence matters as much as the content.',
            b: 'Right call. Acknowledgement before information is the social intelligence move. You can give the same information five minutes later — after the person feels understood — and it lands completely differently.',
            c: 'That is the highest-order move. Asking what they want reframes the conversation from complaint to goal. Most people never get there because they are too focused on the content of the complaint rather than the purpose of the conversation.',
            default: 'Social intelligence in this situation means emotional sequencing — frustration first, information second. The content of what you say matters less than when you say it.'
        },
        default: {
            default: 'The instinct behind your pick matters more than the label on the option. What you were reaching for — accuracy, relationship, or better information — is the real signal. The next level is executing that instinct more precisely under pressure.'
        }
    };

    const stat   = enc.stat || 'default';
    const pool   = statFallbacks[stat] || statFallbacks.default;
    let   text   = pool[optId] || pool.default || statFallbacks.default.default;

    // If free text is present, prepend an acknowledgement
    if (freeText && freeText.length > 10) {
        text = `What you wrote shows the right instinct. ${text}`;
    }

    return { text, geminiEnhanced: false };
}

// ─── FEEDBACK: JUDGMENT TYPE ──────────────────────────────────
function renderJudgmentFeedback(enc, feedback) {
    console.log('[SYD DEBUG] renderJudgmentFeedback called, feedback:', feedback, 'feedbackText:', feedback ? feedback.text : '(feedback is falsy)');
    const container = document.getElementById('encounter-content');
    if (!container) return;

    const selectedOpt  = (enc.options || []).find(o => o.id === encounterState.selectedOption);
    const freeText     = encounterState.freeText;
    const feedbackText = feedback ? feedback.text : '';
    const isGemini     = feedback && feedback.geminiEnhanced;

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
                    <p class="enc-feedback-text">${feedbackText}</p>
                    ${!isGemini ? `
                        <p class="enc-feedback-neural-note">
                            [ Connect Neural Link for personalised SYD evaluation ]
                        </p>
                    ` : ''}
                </div>
            </div>
            <div class="enc-footer-actions">
                <button class="btn btn--primary" id="enc-done">[ ACKNOWLEDGED ]</button>
            </div>
        </div>
    `;

    document.getElementById('enc-done').addEventListener('click', () => {
        playUIClick(); goBack();
    });
}

// ─── FEEDBACK: TEACHING TYPE ──────────────────────────────────
// Teaching encounters do not call Gemini — the expert thinking is pre-written.
// SYD reveals it as a transmission, not a correction.
function renderTeachingFeedback(enc, geminiAck) {
    const container = document.getElementById('encounter-content');
    if (!container) return;

    const ackText = geminiAck && geminiAck.geminiEnhanced && geminiAck.text
        ? geminiAck.text
        : '';

    container.innerHTML = `
        <div class="encounter-wrap">
            <div class="encounter-header">
                <span class="enc-label">[ SYD — EXPERT THINKING ]</span>
            </div>
            <div class="enc-feedback enc-feedback--teaching">
                ${ackText ? `<p class="enc-feedback-teaching-ack">${ackText}</p>` : ''}
                <p class="enc-feedback-text">${enc.teaching}</p>
            </div>
            <div class="enc-footer-actions">
                <button class="btn btn--primary" id="enc-done">[ ACKNOWLEDGED ]</button>
            </div>
        </div>
    `;

    document.getElementById('enc-done').addEventListener('click', () => {
        playUIClick(); goBack();
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
        playUIClick(); goBack();
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