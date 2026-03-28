// ═══════════════════════════════════════════════════════════════
// SYD GES — gemini.js  (Batch 6)
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
// ═══════════════════════════════════════════════════════════════

// ─── MODEL CONSTANTS ─────────────────────────────────────────
// [TUNING TARGET] Model names — update if Google renames endpoints
const GEMINI_MODEL_CLASSIFY   = 'gemini-2.0-flash-lite';   // classification calls
const GEMINI_MODEL_GENERATE   = 'gemini-2.0-flash';        // generative calls
const GEMINI_API_BASE         = 'https://generativelanguage.googleapis.com/v1beta/models';

// [TUNING TARGET] Temperature per call type
const TEMP_CLASSIFY = 0.2;
const TEMP_GENERATE = 0.7;

// [TUNING TARGET] Max tokens per call type
const TOKENS_CLASSIFY = 1024;
const TOKENS_GENERATE = 2048;

// ─── CORE API CALL ───────────────────────────────────────────
// All Gemini calls go through here.
// Returns { ok: true, text: '...' } on success.
// Returns { ok: false, error: '...', quota: bool } on failure.
// quota: true signals quota exhaustion — caller should try fallback model.

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
            const errBody = await res.json().catch(() => ({}));
            const errMsg  = (errBody.error && errBody.error.message) || `HTTP ${res.status}`;
            return { ok: false, error: errMsg, quota: isQuota };
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) return { ok: false, error: 'Empty response from model.', quota: false };

        return { ok: true, text };

    } catch (e) {
        return { ok: false, error: e.message || 'Network error.', quota: false };
    }
}

// ─── MODEL FALLBACK ROUTER ────────────────────────────────────
// Implements the fallback chain from the master design doc.
// Classification: Flash-Lite first, Flash if quota hit.
// Generation: Flash first, Flash-Lite if quota hit.
// Returns the same shape as geminiCall.

async function geminiClassify(prompt) {
    let result = await geminiCall({
        prompt,
        model:       GEMINI_MODEL_CLASSIFY,
        temperature: TEMP_CLASSIFY,
        maxTokens:   TOKENS_CLASSIFY
    });

    if (!result.ok && result.quota) {
        // Quota hit — try the heavier model
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
        // Quota hit — fall back to lite
        result = await geminiCall({
            prompt,
            model:       GEMINI_MODEL_CLASSIFY,
            temperature: TEMP_GENERATE,
            maxTokens:   TOKENS_GENERATE
        });
    }

    return result;
}

// ─── JSON EXTRACTOR ───────────────────────────────────────────
// Gemini sometimes wraps JSON in markdown fences.
// This strips fences and returns a parsed object, or null on failure.

function extractJSON(text) {
    try {
        // Strip ```json ... ``` or ``` ... ``` fences if present
        const cleaned = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/,      '')
            .replace(/\s*```$/,      '')
            .trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // Try a fallback: find the first {...} block
        try {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch (_) { /* fall through */ }

        return null;
    }
}

// ─── KEY PRESENCE CHECK ───────────────────────────────────────
// Quick check used by path.js and encounter.js before deciding
// whether to attempt a Gemini call or go straight to local fallback.

function hasNeuralLink() {
    return !!(typeof getNeuralKey === 'function' && getNeuralKey());
}
