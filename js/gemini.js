// ═══════════════════════════════════════════════════════════════
// SYD GES — gemini.js
// Shared Gemini API utility layer.
// All AI calls in SYD route through this module.
//
// Model routing (from master design doc):
//   Flash-Lite @ 0.2 temperature — classification calls
//     (skill verify, role cards, encounter evaluation)
//   Flash @ 0.7 temperature — generative calls
//     (stat explainers, SYD voice lines, encounter feedback)
//   Fallback chain: Flash-Lite → Flash on quota hit
//                   Flash → Flash-Lite on quota hit
//
// All Gemini keys are stored locally only (localStorage).
// Never transmitted except directly to Google's API.
//
// Every call has a local fallback. AI enhances — local handles reliability.
//
// BLOCK C changes:
//   - Silent failure handling tightened: every call returns { ok: false }
//     on any failure — quota, network, parse, empty response.
//     Callers fall through to local fallback without ever surfacing errors.
//   - geminiSilentCall() wrapper added — single-call wrapper that always
//     returns a safe result; used internally to enforce silent degradation.
//   - CALL_4_REFRESH_INTERVAL_DAYS constant added (Block D uses this).
//   - CAREER_DIRECTIVE_CACHE_THRESHOLD constant added (Block D uses this).
//   - Research citations on key design decisions.
// ═══════════════════════════════════════════════════════════════

// ─── MODEL CONSTANTS ─────────────────────────────────────────
// [TUNING TARGET] Model names — update if Google renames endpoints
const GEMINI_MODEL_CLASSIFY   = 'gemini-2.5-flash-lite';   // classification calls
const GEMINI_MODEL_GENERATE   = 'gemini-2.5-flash';        // generative calls
const GEMINI_API_BASE         = 'https://generativelanguage.googleapis.com/v1beta/models';

// [TUNING TARGET] Temperature per call type
const TEMP_CLASSIFY = 0.2;
const TEMP_GENERATE = 0.7;

// [TUNING TARGET] Max tokens per call type
const TOKENS_CLASSIFY = 1024;
const TOKENS_GENERATE = 4096; // Raised: 2.5-Flash thinking tokens consume part of this budget

// ─── QUOTA AND REFRESH CONSTANTS ─────────────────────────────
// [TUNING TARGET] Days between Call 4 career content refreshes.
// Block D triggers Call 4 when both conditions are met:
//   1. CALL_4_REFRESH_INTERVAL_DAYS have passed since last refresh
//   2. Career directive cache is below CAREER_DIRECTIVE_CACHE_THRESHOLD
const CALL_4_REFRESH_INTERVAL_DAYS    = 5;    // [TUNING TARGET]
const CAREER_DIRECTIVE_CACHE_THRESHOLD = 2;   // [TUNING TARGET] remaining directives before refresh

// ─── CORE API CALL ───────────────────────────────────────────
// All Gemini calls go through here.
// Returns { ok: true, text: '...' } on success.
// Returns { ok: false, error: '...', quota: bool } on ANY failure.
//
// BLOCK C: quota: true signals quota exhaustion for fallback routing.
// All other failures (network, parse, empty) also return ok: false.
// No failure ever surfaces to the operative — callers must handle silently.
//
// [RESEARCH] Source: Anthropic prompting docs — reliability patterns.
// Finding: structured error types allow callers to implement fallback
//          chains without nested try/catch in every consumer.
// Applied: every failure mode returns the same { ok: false, ... } shape.

async function geminiCall({ prompt, model, temperature, maxTokens }) {
    const key = (typeof getNeuralKey === 'function') ? getNeuralKey() : null;
    if (!key) return { ok: false, error: 'No Neural Link key set.', quota: false };

    const url  = `${GEMINI_API_BASE}/${model}:generateContent?key=${key}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature:     temperature,
            maxOutputTokens: maxTokens
        }
    };

    try {
        const res  = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        if (!res.ok) {
            const isQuota = res.status === 429;
            let errMsg    = `HTTP ${res.status}`;
            try {
                const errBody = await res.json();
                errMsg = (errBody.error && errBody.error.message) || errMsg;
            } catch (_) { /* ignore parse error on error body */ }
            // Silent: log to console, never surface to operative
            console.warn('[SYD Gemini] Call failed:', errMsg, '— falling back to local.');
            return { ok: false, error: errMsg, quota: isQuota };
        }

        const data  = await res.json();
        // Thinking models (gemini-2.5-flash) may return thought parts before the text part.
        // Find the first part that actually has a non-empty text field.
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text  = (parts.find(p => p.text && p.text.trim().length > 0) || {}).text || '';
        if (!text) {
            console.warn('[SYD Gemini] Empty response from model — falling back to local.');
            return { ok: false, error: 'Empty response from model.', quota: false };
        }

        return { ok: true, text };

    } catch (e) {
        // Network error, AbortError, or any other exception
        console.warn('[SYD Gemini] Network error — falling back to local:', e.message || e);
        return { ok: false, error: e.message || 'Network error.', quota: false };
    }
}

// ─── MODEL FALLBACK ROUTER ────────────────────────────────────
// Implements the fallback chain from the master design doc.
// Classification: Flash-Lite first, Flash if quota hit.
// Generation: Flash first, Flash-Lite if quota hit.
// Returns the same shape as geminiCall.
//
// BLOCK C: All quota-fallback paths also return { ok: false } if
// the secondary model fails — callers should treat any !ok as
// "use local fallback now", never as a retry trigger.

async function geminiClassify(prompt) {
    let result = await geminiCall({
        prompt,
        model:       GEMINI_MODEL_CLASSIFY,
        temperature: TEMP_CLASSIFY,
        maxTokens:   TOKENS_CLASSIFY
    });

    if (!result.ok && result.quota) {
        console.warn('[SYD Gemini] Flash-Lite quota hit — trying Flash.');
        result = await geminiCall({
            prompt,
            model:       GEMINI_MODEL_GENERATE,
            temperature: TEMP_CLASSIFY,
            maxTokens:   TOKENS_CLASSIFY
        });
    }

    return result;
}

async function geminiGenerate(prompt) {
    let result = await geminiCall({
        prompt,
        model:       GEMINI_MODEL_GENERATE,
        temperature: TEMP_GENERATE,
        maxTokens:   TOKENS_GENERATE
    });

    if (!result.ok && result.quota) {
        console.warn('[SYD Gemini] Flash quota hit — trying Flash-Lite.');
        result = await geminiCall({
            prompt,
            model:       GEMINI_MODEL_CLASSIFY,
            temperature: TEMP_GENERATE,
            maxTokens:   TOKENS_GENERATE
        });
    }

    return result;
}

// ─── LARGE PAYLOAD GENERATOR ─────────────────────────────────
// Call 2 (PATH + career bundle) is larger than standard calls.
// Uses a higher token ceiling and the Flash model for quality.
// [TUNING TARGET] Max tokens for bundled calls
const TOKENS_BUNDLE = 12288;

async function geminiGenerateLarge(prompt, temperature) {
    const key = (typeof getNeuralKey === 'function') ? getNeuralKey() : null;
    if (!key) return { ok: false, error: 'No Neural Link key set.', quota: false };

    const url  = `${GEMINI_API_BASE}/${GEMINI_MODEL_GENERATE}:generateContent?key=${key}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature:     (temperature !== undefined) ? temperature : TEMP_GENERATE,
            maxOutputTokens: TOKENS_BUNDLE
        }
    };

    try {
        const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        if (!res.ok) {
            const isQuota = res.status === 429;
            let errMsg    = `HTTP ${res.status}`;
            try {
                const errBody = await res.json();
                errMsg = (errBody.error && errBody.error.message) || errMsg;
            } catch (_) {}
            console.warn('[SYD Gemini] Large call failed:', errMsg, '— falling back to local.');
            return { ok: false, error: errMsg, quota: isQuota };
        }

        const data  = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text  = (parts.find(p => p.text && p.text.trim().length > 0) || {}).text || '';
        if (!text) {
            console.warn('[SYD Gemini] Large call returned empty — falling back to local.');
            return { ok: false, error: 'Empty response.', quota: false };
        }

        return { ok: true, text };

    } catch (e) {
        console.warn('[SYD Gemini] Large call network error — falling back to local:', e.message || e);
        return { ok: false, error: e.message || 'Network error.', quota: false };
    }
}

// ─── LITE-LARGE GENERATOR ────────────────────────────────────
// Call A (JOB OPS Profile), Call B Stage 2 (market synthesis), and
// Call 4 (directive refresh) use this model.
// Separate quota pool from GEMINI_MODEL_GENERATE (~20 RPD Flash).
// gemini-3.1-flash-lite-preview: 15 RPM, 500 RPD — confirmed clean
// (finishReason STOP, text extraction works, no thoughtsTokenCount burn).
// No fallback chain — if this fails, caller keeps local skeleton / cache.
// [TUNING TARGET] Model name if Google renames this endpoint.
const GEMINI_MODEL_LITE_LARGE = 'gemini-3.1-flash-lite-preview';

async function geminiGenerateLiteLarge(prompt, temperature) {
    const key = (typeof getNeuralKey === 'function') ? getNeuralKey() : null;
    if (!key) return { ok: false, error: 'No Neural Link key set.', quota: false };

    const url  = `${GEMINI_API_BASE}/${GEMINI_MODEL_LITE_LARGE}:generateContent?key=${key}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature:     (temperature !== undefined) ? temperature : TEMP_GENERATE,
            maxOutputTokens: TOKENS_BUNDLE
        }
    };

    try {
        const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        if (!res.ok) {
            const isQuota = res.status === 429;
            let errMsg    = `HTTP ${res.status}`;
            try {
                const errBody = await res.json();
                errMsg = (errBody.error && errBody.error.message) || errMsg;
            } catch (_) {}
            console.warn('[SYD Gemini] Lite-Large call failed:', errMsg, '— keeping local state.');
            return { ok: false, error: errMsg, quota: isQuota };
        }

        const data  = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text  = (parts.find(p => p.text && p.text.trim().length > 0) || {}).text || '';
        if (!text) {
            console.warn('[SYD Gemini] Lite-Large call returned empty — keeping local state.');
            return { ok: false, error: 'Empty response.', quota: false };
        }

        return { ok: true, text };

    } catch (e) {
        console.warn('[SYD Gemini] Lite-Large call network error — keeping local state:', e.message || e);
        return { ok: false, error: e.message || 'Network error.', quota: false };
    }
}

// ─── JSON EXTRACTOR ───────────────────────────────────────────
// Gemini sometimes wraps JSON in markdown fences.
// This strips fences and returns a parsed object, or null on failure.
//
// BLOCK C: Extended to handle partial JSON responses — tries
// progressively looser extraction before returning null.

function extractJSON(text) {
    if (!text) return null;

    // Pass 1: strip ```json ... ``` or ``` ... ``` fences.
    // NOTE: greedy ([\s\S]*) is intentional — large JSON payloads (Call 2 bundle) are
    // multi-kilobyte; a non-greedy match can stop at the first ``` inside a string value.
    try {
        const cleaned = text
            .replace(/```json\s*([\s\S]*)\s*```/i, '$1')
            .replace(/```\s*([\s\S]*)\s*```/g,      '$1')
            .trim();
        return JSON.parse(cleaned);
    } catch (_) { /* try next */ }

    // Pass 2: find the first {...} block in the text
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
    } catch (_) { /* try next */ }

    // Pass 3: find the first [...] block (for array responses)
    try {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) return JSON.parse(match[0]);
    } catch (_) { /* fall through */ }

    // Pass 4: truncated-string repair.
    // Handles MAX_TOKENS cut-off mid-string (observed in market signal grounding calls
    // where finishReason is MAX_TOKENS and the last token lands inside a JSON string value).
    // Strategy: find the last complete key-value pair boundary, truncate there, then close
    // open brackets. This recovers partial arrays with at least one complete element.
    try {
        const startArr = text.indexOf('[');
        const startObj = text.indexOf('{');
        const start    = startArr === -1 ? startObj
                       : startObj === -1 ? startArr
                       : Math.min(startArr, startObj);
        if (start !== -1) {
            let fragment = text.slice(start);
            // If there's an unclosed string, truncate before the last complete object.
            // Find the last '}' that isn't inside a string.
            let lastSafeClose = -1;
            let inStr = false, escaped = false;
            for (let i = 0; i < fragment.length; i++) {
                const ch = fragment[i];
                if (escaped)     { escaped = false; continue; }
                if (ch === '\\') { escaped = true;  continue; }
                if (ch === '"')  { inStr = !inStr;  continue; }
                if (!inStr && ch === '}') lastSafeClose = i;
            }
            // If we're still in a string at EOF, the response was cut mid-value.
            // Truncate to the last safe '}' and rebalance brackets.
            if (inStr && lastSafeClose !== -1) {
                fragment = fragment.slice(0, lastSafeClose + 1);
                const stack = [];
                inStr = false; escaped = false;
                for (let i = 0; i < fragment.length; i++) {
                    const ch = fragment[i];
                    if (escaped)     { escaped = false; continue; }
                    if (ch === '\\') { escaped = true;  continue; }
                    if (ch === '"')  { inStr = !inStr;  continue; }
                    if (inStr)       continue;
                    if (ch === '{')  stack.push('}');
                    if (ch === '[')  stack.push(']');
                    if ((ch === '}' || ch === ']') && stack.length && stack[stack.length - 1] === ch) stack.pop();
                }
                const repaired = fragment.trimEnd() + stack.reverse().join('');
                const result   = JSON.parse(repaired);
                console.warn('[SYD Gemini] extractJSON: recovered truncated response, kept up to last safe close.');
                return result;
            }
        }
    } catch (_) { /* fall through */ }

    // Pass 5: bracket-balancing repair.
    // Handles Gemini dropping a closing brace mid-object — observed consistently
    // in Call 2 responses where finishReason is STOP but a } is missing inside paths[].
    // Walks every character tracking bracket depth, string state, and escape sequences.
    // Appends missing closers in reverse stack order and re-attempts parse.
    try {
        const startObj = text.indexOf('{');
        const startArr = text.indexOf('[');
        const start    = startObj === -1 ? startArr
                       : startArr === -1 ? startObj
                       : Math.min(startObj, startArr);
        if (start !== -1) {
            let   fragment = text.slice(start);
            const stack    = [];
            let   inStr    = false;
            let   escaped  = false;

            for (let i = 0; i < fragment.length; i++) {
                const ch = fragment[i];
                if (escaped)     { escaped = false; continue; }
                if (ch === '\\') { escaped = true;  continue; }
                if (ch === '"')  { inStr = !inStr;  continue; }
                if (inStr)       continue;
                if (ch === '{')  stack.push('}');
                if (ch === '[')  stack.push(']');
                if (ch === '}' || ch === ']') {
                    if (stack.length && stack[stack.length - 1] === ch) stack.pop();
                }
            }

            const repaired = fragment.trimEnd() + stack.reverse().join('');
            const result   = JSON.parse(repaired);
            if (stack.length > 0) {
                console.warn('[SYD Gemini] extractJSON: repaired', stack.length, 'missing bracket(s).');
            }
            return result;
        }
    } catch (_) { /* fall through to null */ }

    console.warn('[SYD Gemini] Could not extract JSON from response — falling back to local.');
    return null;
}

// ─── SEARCH-GROUNDED CALL ────────────────────────────────────
// Uses Gemini's native Google Search grounding tool.
// Returns the same { ok, text } shape as geminiCall.
// Only use for calls that genuinely need live web data — the grounding
// tool adds latency and is not available with all model versions.
// gemini-2.5-flash supports it via the tools parameter.
async function geminiCallWithSearch({ prompt, temperature, maxTokens }) {
    const key = (typeof getNeuralKey === 'function') ? getNeuralKey() : null;
    if (!key) return { ok: false, error: 'No Neural Link key set.', quota: false };

    const url  = `${GEMINI_API_BASE}/${GEMINI_MODEL_GENERATE}:generateContent?key=${key}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        tools:    [{ google_search: {} }],
        generationConfig: {
            temperature:     temperature !== undefined ? temperature : 0.3,
            // Search grounding adds ~800 tool-use prompt tokens overhead.
            // 4096 output tokens gives comfortable headroom for 3-role signal JSON.
            maxOutputTokens: maxTokens   !== undefined ? maxTokens  : 4096
        }
    };

    try {
        const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        if (!res.ok) {
            const isQuota = res.status === 429;
            let errMsg    = `HTTP ${res.status}`;
            try {
                const errBody = await res.json();
                errMsg = (errBody.error && errBody.error.message) || errMsg;
            } catch (_) {}
            console.warn('[SYD Gemini] Search-grounded call failed:', errMsg);
            return { ok: false, error: errMsg, quota: isQuota };
        }

        const data  = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text  = (parts.find(p => p.text && p.text.trim().length > 0) || {}).text || '';
        if (!text) {
            console.warn('[SYD Gemini] Search-grounded call returned empty.');
            return { ok: false, error: 'Empty response.', quota: false };
        }

        return { ok: true, text };
    } catch (e) {
        console.warn('[SYD Gemini] Search-grounded call network error:', e.message || e);
        return { ok: false, error: e.message || 'Network error.', quota: false };
    }
}

// ─── KEY PRESENCE CHECK ───────────────────────────────────────
function hasNeuralLink() {
    return !!(typeof getNeuralKey === 'function' && getNeuralKey());
}

// ─── NEURAL LINK ERROR SYSTEM ────────────────────────────────
// Every AI call failure is classified, translated into plain language,
// and surfaced to the operative — either inline (when they are watching)
// or via a queued modal (when the call was background).
//
// The operative gave SYD their key to get smart answers.
// Silent fallbacks without notice break that contract.

const _NEURAL_ERROR_QUEUE_KEY = 'syd_neural_error_queue';

// ── Error classifier ──────────────────────────────────────────
// Translates raw API error into plain-language copy.
// canRetry: true → show [ RETRY ] button
// canRetry: false (quota/auth) → show [ USE LOCAL VERSION ] only
function _classifyNeuralError(result) {
    const msg   = (result && result.error) || '';
    const lower = msg.toLowerCase();

    if (result && result.quota) {
        return {
            type:     'quota',
            headline: 'Neural Link has reached its request limit.',
            detail:   'Your AI key is fine — it just needs a short break. Limits reset automatically, usually within the hour. For now, SYD will use its built-in version.',
            canRetry: false
        };
    }
    if (lower.includes('401') || lower.includes('403') ||
        lower.includes('api key') || lower.includes('permission denied')) {
        return {
            type:     'auth',
            headline: 'Neural Link key not accepted.',
            detail:   'SYD could not connect using your key. Check that it is correct and active in Settings → Neural Link.',
            canRetry: false,
            canSettings: true
        };
    }
    if (lower.includes('503') || lower.includes('502') || lower.includes('504') ||
        lower.includes('unavailable') || lower.includes('overloaded')) {
        return {
            type:     'unavailable',
            headline: 'Neural Link is temporarily unavailable.',
            detail:   'The AI service is overloaded right now. This usually clears up within a few minutes. You can retry or continue with SYD\'s built-in version.',
            canRetry: true
        };
    }
    if (lower.includes('network') || lower.includes('fetch') ||
        lower.includes('failed to fetch') || lower.includes('connection')) {
        return {
            type:     'network',
            headline: 'Could not reach Neural Link.',
            detail:   'SYD lost the connection before the response arrived. Check your internet and try again, or continue with the built-in version.',
            canRetry: true
        };
    }
    return {
        type:     'other',
        headline: 'Neural Link returned an unexpected error.',
        detail:   'Something went wrong on the AI side. You can retry or continue with SYD\'s built-in version.',
        canRetry: true
    };
}

// ── Inline error renderer ────────────────────────────────────
// Renders into a container the operative is currently looking at.
// onRetry: re-runs the original call (only offered when canRetry)
// onLocal: proceeds with local fallback
// context: short label for the panel, e.g. 'ENCOUNTER' or 'MARKET READ'
function geminiShowError(container, result, { onRetry, onLocal, context } = {}) {
    if (!container) { if (onLocal) onLocal(); return; }

    const info = _classifyNeuralError(result);
    const lbl  = context ? `[ ${context} — NEURAL LINK ]` : '[ NEURAL LINK ]';

    const retryHTML = (info.canRetry && onRetry) ? `
        <button class="btn btn--primary gem-err-btn" id="gem-err-retry">[ RETRY ]</button>
    ` : '';

    const localLabel = info.canRetry ? 'Continue with built-in version →' : '[ CONTINUE WITH BUILT-IN VERSION ]';
    const localHTML  = onLocal ? `
        <button class="gem-err-local-btn" id="gem-err-local">${localLabel}</button>
    ` : '';

    const settingsHTML = info.canSettings ? `
        <button class="gem-err-local-btn" id="gem-err-settings">Check Neural Link settings →</button>
    ` : '';

    container.innerHTML = `
        <div class="gem-err-wrap">
            <p class="gem-err-label">${lbl}</p>
            <p class="gem-err-headline">&#x26A0;&nbsp;${info.headline}</p>
            <p class="gem-err-detail">${info.detail}</p>
            <div class="gem-err-actions">
                ${retryHTML}
                ${localHTML}
                ${settingsHTML}
            </div>
        </div>
    `;

    const retryEl    = document.getElementById('gem-err-retry');
    const localEl    = document.getElementById('gem-err-local');
    const settingsEl = document.getElementById('gem-err-settings');

    if (retryEl)    retryEl.addEventListener('click',    () => { if (typeof playUIClick === 'function') playUIClick(); onRetry(); });
    if (localEl)    localEl.addEventListener('click',    () => { if (typeof playUIClick === 'function') playUIClick(); onLocal(); });
    if (settingsEl) settingsEl.addEventListener('click', () => { if (typeof playUIClick === 'function') playUIClick(); if (typeof navTo === 'function') navTo('screen-neural'); });
}

// ── Background error queue ────────────────────────────────────
// For calls that fired in the background with no visible container.
// Queued errors are shown as a modal when the operative navigates
// to the relevant screen.
// screen: which screen/segment should trigger the modal ('jobops', 'encounter', 'fitness', 'career', 'any')
// onLocal: stored as a key name — the modal will call the matching handler
function _queueNeuralError(result, { screen, callLabel, onLocalKey }) {
    try {
        const queue = JSON.parse(localStorage.getItem(_NEURAL_ERROR_QUEUE_KEY) || '[]');
        // Deduplicate: don't stack identical errors
        const isDupe = queue.some(e => e.type === _classifyNeuralError(result).type && e.screen === screen);
        if (!isDupe) {
            queue.push({
                result,
                screen,
                callLabel,
                onLocalKey,
                queuedAt: Date.now()
            });
            localStorage.setItem(_NEURAL_ERROR_QUEUE_KEY, JSON.stringify(queue));
        }
    } catch(e) { /* non-critical */ }
}

function _clearNeuralErrorQueue(screen) {
    try {
        const queue   = JSON.parse(localStorage.getItem(_NEURAL_ERROR_QUEUE_KEY) || '[]');
        const filtered = queue.filter(e => e.screen !== screen && e.screen !== 'any');
        localStorage.setItem(_NEURAL_ERROR_QUEUE_KEY, JSON.stringify(filtered));
    } catch(e) {}
}

// ── Modal: show queued errors for a given screen ──────────────
// Call this at the top of each screen/segment renderer.
// If a queued error exists for this screen, shows the modal.
// onLocalHandlers: map of key → function, called when operative chooses local.
function geminiCheckQueuedErrors(screen, onLocalHandlers) {
    try {
        const queue = JSON.parse(localStorage.getItem(_NEURAL_ERROR_QUEUE_KEY) || '[]');
        const match = queue.find(e => e.screen === screen || e.screen === 'any');
        if (!match) return;

        const info    = _classifyNeuralError(match.result);
        const overlay = document.getElementById('overlay-neural-error');
        if (!overlay) return;

        const inner   = overlay.querySelector('.neural-err-inner');
        if (!inner) return;

        const lbl = match.callLabel ? `[ ${match.callLabel} — NEURAL LINK ]` : '[ NEURAL LINK ]';

        const retryHTML = (info.canRetry) ? `
            <button class="btn btn--primary" id="ne-retry-btn">[ RETRY ]</button>
        ` : '';

        const localLabel = info.canRetry ? 'Continue with built-in version →' : '[ CONTINUE WITH BUILT-IN VERSION ]';

        const settingsHTML = info.canSettings ? `
            <button class="gem-err-local-btn" id="ne-settings-btn">Check Neural Link settings →</button>
        ` : '';

        inner.innerHTML = `
            <p class="neural-err-label">${lbl}</p>
            <p class="neural-err-headline">&#x26A0;&nbsp;${info.headline}</p>
            <p class="neural-err-detail">${info.detail}</p>
            <div class="neural-err-actions">
                ${retryHTML}
                <button class="gem-err-local-btn" id="ne-local-btn">${localLabel}</button>
                ${settingsHTML}
            </div>
        `;

        overlay.classList.remove('hidden');

        const dismiss = () => {
            overlay.classList.add('hidden');
            _clearNeuralErrorQueue(screen);
        };

        const localEl    = document.getElementById('ne-local-btn');
        const settingsEl = document.getElementById('ne-settings-btn');
        const retryEl    = document.getElementById('ne-retry-btn');

        if (localEl) {
            localEl.addEventListener('click', () => {
                if (typeof playUIClick === 'function') playUIClick();
                dismiss();
                // Call the registered local handler if provided
                const handler = onLocalHandlers && match.onLocalKey && onLocalHandlers[match.onLocalKey];
                if (typeof handler === 'function') handler();
            });
        }

        if (settingsEl) {
            settingsEl.addEventListener('click', () => {
                if (typeof playUIClick === 'function') playUIClick();
                dismiss();
                if (typeof navTo === 'function') navTo('screen-neural');
            });
        }

        if (retryEl) {
            retryEl.addEventListener('click', () => {
                if (typeof playUIClick === 'function') playUIClick();
                dismiss();
                // Re-fire the relevant call based on screen
                if (screen === 'jobops' && typeof fireJobOpsMarket === 'function') {
                    fireJobOpsMarket();
                    if (typeof fireJobOpsProfile === 'function') fireJobOpsProfile();
                } else if (screen === 'career' && typeof fireCall4 === 'function') {
                    fireCall4();
                }
            });
        }

    } catch(e) { /* non-critical */ }
}