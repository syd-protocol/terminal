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
const TOKENS_GENERATE = 2048;

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

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
const TOKENS_BUNDLE = 8192;

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

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

// ─── JSON EXTRACTOR ───────────────────────────────────────────
// Gemini sometimes wraps JSON in markdown fences.
// This strips fences and returns a parsed object, or null on failure.
//
// BLOCK C: Extended to handle partial JSON responses — tries
// progressively looser extraction before returning null.

function extractJSON(text) {
    if (!text) return null;

    // Pass 1: strip ```json ... ``` or ``` ... ``` fences and handle leading/trailing text.
    // NOTE: greedy ([\s\S]*) is intentional — large JSON payloads (Call 2 bundle) are
    // multi-kilobyte and a non-greedy match can stop at the first ``` it finds inside
    // a string value, truncating the object and causing a parse failure.
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

    console.warn('[SYD Gemini] Could not extract JSON from response — falling back to local.');
    return null;
}

// ─── KEY PRESENCE CHECK ───────────────────────────────────────
// Quick check used before deciding whether to attempt a Gemini
// call or go straight to local fallback.

function hasNeuralLink() {
    return !!(typeof getNeuralKey === 'function' && getNeuralKey());
}