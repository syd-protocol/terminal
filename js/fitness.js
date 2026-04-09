// ═══════════════════════════════════════════════════════════════
// SYD GES — fitness.js
// FITNESS PROTOCOL — optional physical baseline system.
//
// Flow:
//   Opt-in (OPS panel) → 8-question scan → Fitness Rank assigned →
//   Gemini processes free-text conditions (if Neural Link active) →
//   Pre-authored directives served from static library, calibrated
//   to rank and filtered by conditions.
//
// Stats integration: directives map to Endurance, Strength, Agility.
// No new stats created. Fitness Rank is stored separately.
//
// Web Speech API: directive form descriptions read aloud on tap.
// Available in all major browsers, free, no library needed.
//
// All exercises: bodyweight only, no equipment, floor-based.
// Safe for any location — gym, bedroom, office, outdoors.
// ═══════════════════════════════════════════════════════════════

// ─── STORAGE ─────────────────────────────────────────────────
const FITNESS_DIRECTIVES_KEY = 'syd_fitness_directives';

// ─── FITNESS RANK LABELS ──────────────────────────────────────
const FITNESS_RANK_LABELS = {
    'F': 'BASELINE',
    'E': 'DEVELOPING',
    'D': 'FUNCTIONAL',
    'C': 'CAPABLE',
    'B': 'STRONG',
    'A': 'CONDITIONED'
};

// ─── SCAN QUESTIONS ───────────────────────────────────────────
// 8 questions. Answers drive scoring and routing.
// Questions 1–5 produce numeric scores (0–12 total).
// Questions 6–8 are contextual: free text, conditions, and goals.
const FITNESS_QUESTIONS = [
    {
        id:      'freq',
        q:       'How many times a week do you do something that raises your heart rate for 20 or more minutes?',
        hint:    'Any movement counts — walking, climbing stairs, dancing, sport. Not just formal exercise.',
        type:    'choice',
        options: [
            { id: 'freq_0', text: 'Rarely or never',   score: 0 },
            { id: 'freq_1', text: '1–2 times',         score: 1 },
            { id: 'freq_2', text: '3–4 times',         score: 2 },
            { id: 'freq_3', text: '5 or more times',   score: 3 }
        ]
    },
    {
        id:      'stairs',
        q:       'Can you walk up 3 flights of stairs without stopping to catch your breath?',
        hint:    'Be honest. This is a cardio baseline check, not a test.',
        type:    'choice',
        options: [
            { id: 'stairs_no',     text: 'No — I need to stop or rest',    score: 0 },
            { id: 'stairs_effort', text: 'Yes, but it takes real effort',   score: 1 },
            { id: 'stairs_yes',    text: 'Yes, without much effort',        score: 2 }
        ]
    },
    {
        id:      'pushup',
        q:       'How many push-ups can you do before stopping?',
        hint:    'Full push-ups from the floor. If unsure, try it now — even one counts.',
        type:    'choice',
        options: [
            { id: 'pu_0',  text: 'None — I cannot do a full push-up',  score: 0 },
            { id: 'pu_5',  text: '1–5',                                score: 1 },
            { id: 'pu_15', text: '6–15',                               score: 2 },
            { id: 'pu_16', text: '16 or more',                         score: 3 }
        ]
    },
    {
        id:      'sitting',
        q:       'How much of your typical day do you spend sitting?',
        hint:    'Include desk work, commuting, and screen time.',
        type:    'choice',
        options: [
            { id: 'sit_most', text: 'Most of it — 6+ hours seated',       score: 0 },
            { id: 'sit_half', text: 'About half — some movement each day', score: 1 },
            { id: 'sit_move', text: 'Mostly moving — on my feet a lot',    score: 2 }
        ]
    },
    {
        id:      'pain',
        q:       'Do you have regular back pain or joint pain that affects how you move?',
        hint:    'Knee, hip, shoulder, lower back — anything that changes what you can comfortably do.',
        type:    'choice',
        options: [
            { id: 'pain_yes',  text: 'Yes — it limits what I can do',          score: 0 },
            { id: 'pain_some', text: 'Sometimes — flares up occasionally',     score: 1 },
            { id: 'pain_no',   text: 'No — I move without recurring pain',     score: 2 }
        ]
    },
    {
        id:      'recent',
        q:       'What physical activity did you do most recently, and when?',
        hint:    'Anything — a walk, a gym session, carrying shopping, playing with a child.',
        type:    'freetext',
        placeholder: 'e.g. Walked 20 minutes yesterday, or nothing in the past two weeks...'
    },
    {
        id:         'conditions',
        q:          'Do you have any injuries, medical conditions, or physical limitations we should know about?',
        hint:       "Include anything that affects what movements are safe or comfortable for you — past injuries, chronic conditions, doctor's advice.",
        type:       'conditions',
        options: [
            { id: 'cond_no',  text: 'No — no known limitations' },
            { id: 'cond_yes', text: 'Yes — I have something to flag' }
        ],
        placeholder: 'Describe your condition, injury, or limitation here. Be as specific as you like — SYD will use this to modify your directives.'
    },
    {
        id:          'goal',
        q:           'What would you like the Fitness Protocol to help you with?',
        hint:        'Pick the closest option. Then describe your actual goal in your own words below — SYD uses this to shape which directives you see.',
        type:        'goal',
        options: [
            { id: 'goal_energy',    text: 'Feel less physically tired day to day'  },
            { id: 'goal_strength',  text: 'Build basic strength'                   },
            { id: 'goal_mobility',  text: 'Improve movement and flexibility'       },
            { id: 'goal_general',   text: 'General fitness — no specific goal'     },
            { id: 'goal_none',      text: 'No goal — just track what I do'        }
        ],
        placeholder: 'Optional — describe your goal in your own words.\n\nExamples:\n"I want to lose weight and reduce belly fat"\n"I want to be able to run without getting winded"\n"I want to build visible muscle and get stronger"\n"My back aches from sitting at a desk all day — I need to move more"\n"I just want more energy and to feel less tired"\n"I want to improve my posture"\n\nThe more specific you are, the better SYD can calibrate your directives.'
    }
];

// ─── FITNESS RANK DERIVATION ──────────────────────────────────
// Score range 0–12 from questions 1–5 (scored choices only).
// [TUNING TARGET] Score thresholds per rank
function deriveFitnessRank(score) {
    if (score <= 1)  return 'F';
    if (score <= 3)  return 'E';
    if (score <= 6)  return 'D';
    if (score <= 8)  return 'C';
    if (score <= 10) return 'B';
    return 'A';
}

// ─── GOAL → STAT WEIGHT ──────────────────────────────────────
// Maps fitness goal to which stat the directive pool should
// weight toward when selecting daily fitness directives.
const GOAL_STAT_WEIGHT = {
    goal_energy:   'endurance',
    goal_strength: 'strength',
    goal_mobility: 'agility',
    goal_general:  null,   // balanced — no weight
    goal_none:     null
};

// ─── GOAL FREE TEXT PARSING ───────────────────────────────────
// Maps keywords in the goal free text to a primary stat weight.
// Used as local fallback when Gemini is unavailable.
// Returns: { primaryStat, voiceLine } or null if no signal found.
const GOAL_KEYWORD_MAP = [
    {
        keywords: ['run', 'cardio', 'breath', 'winded', 'stamina', 'fat', 'weight',
                   'belly', 'tummy', 'stomach', 'slim', 'lose', 'tired', 'energy',
                   'endurance', 'aerobic'],
        stat:      'endurance',
        voiceLine: 'Signal read: endurance. Directives weighted toward sustained output and cardio work — the primary driver for your goal.'
    },
    {
        keywords: ['strong', 'strength', 'muscle', 'lift', 'push', 'weak', 'arms',
                   'chest', 'upper body', 'build', 'tone', 'defined'],
        stat:      'strength',
        voiceLine: 'Signal read: strength. Directives weighted toward progressive loading — build the base before the definition follows.'
    },
    {
        keywords: ['flexible', 'stiff', 'mobility', 'stretch', 'posture', 'back',
                   'hip', 'sit', 'desk', 'pain', 'ache', 'joint', 'tight', 'move'],
        stat:      'agility',
        voiceLine: 'Signal read: mobility. Directives weighted toward movement quality — fixing how you move is the fastest path to feeling better.'
    }
];

function parseGoalFreeText(text) {
    if (!text || text.trim().length < 3) return null;
    const lower = text.toLowerCase();
    const scores = GOAL_KEYWORD_MAP.map(entry => ({
        stat:      entry.stat,
        voiceLine: entry.voiceLine,
        hits:      entry.keywords.filter(kw => lower.includes(kw)).length
    }));
    const best = scores.reduce((a, b) => b.hits > a.hits ? b : a);
    return best.hits > 0 ? { primaryStat: best.stat, voiceLine: best.voiceLine } : null;
}

async function processGoalWithGemini(goalFreeText, goalKey, fitnessRank) {
    if (!goalFreeText || goalFreeText.trim().length < 5) return null;
    if (typeof hasNeuralLink !== 'function' || !hasNeuralLink()) return null;

    const rankLabel = FITNESS_RANK_LABELS[fitnessRank] || fitnessRank;
    const prompt = `
You are SYD — a physical training intelligence system. An operative has described their fitness goal in their own words:

"${goalFreeText}"

Their current Fitness Rank is ${rankLabel}.

Your task: return a JSON object with exactly two fields:
{
  "primaryStat": "endurance" | "strength" | "agility",
  "voiceLine": "One sentence in SYD's voice confirming what signal was read and what it means for their directives. Clipped, honest, no softening. Max 20 words."
}

Rules:
- primaryStat must be one of the three exact strings above.
- "lose belly fat", "lose weight", "slim down" → endurance (fat loss is systemic, driven by sustained cardio output).
- "run", "cardio", "breath", "stamina" → endurance.
- "build muscle", "get stronger", "tone up" → strength.
- "back pain", "stiff", "sit all day", "posture", "flexibility" → agility.
- If the goal is genuinely ambiguous, return the stat that best matches their selected category: ${goalKey}.

Return ONLY the JSON object. No preamble. No markdown.
`.trim();

    try {
        const result = await geminiGenerate(prompt, 0.1);
        if (result && result.ok && result.text) {
            const clean = result.text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);
            if (parsed.primaryStat && parsed.voiceLine) return parsed;
        }
    } catch(e) {
        console.warn('[SYD] Goal Gemini parse failed:', e);
    }
    return null;
}

// ─── CONDITION TAG KEYWORDS ───────────────────────────────────
// If conditions free text contains these keywords, tag the fitness
// data so directive filtering can exclude relevant movements.
// Used locally when Gemini is not available.
const CONDITION_EXCLUDE_TAGS = {
    knee:      ['lunges', 'squats', 'jumping', 'step-ups'],
    back:      ['sit-ups', 'crunches', 'deadbug-full', 'leg-raises-double'],
    shoulder:  ['push-ups', 'plank', 'downward-dog'],
    wrist:     ['push-ups', 'plank', 'mountain-climbers'],
    hip:       ['lunges', 'squats', 'leg-raises'],
    ankle:     ['jumping', 'calf-raises', 'walking-lunges']
};

function detectLocalConditionTags(conditionsText) {
    const lower = (conditionsText || '').toLowerCase();
    const tags  = [];
    for (const [keyword] of Object.entries(CONDITION_EXCLUDE_TAGS)) {
        if (lower.includes(keyword)) tags.push(keyword);
    }
    return tags;
}

// ─── GEMINI: PROCESS CONDITIONS ───────────────────────────────
// Fires only if Neural Link is active and conditions text is present.
// Returns a short modification note SYD stores and surfaces in directives.
async function processConditionsWithGemini(conditionsText, fitnessRank, goalKey) {
    if (!conditionsText || conditionsText.trim().length < 5) return null;
    if (typeof hasNeuralLink !== 'function' || !hasNeuralLink()) return null;

    const rankLabel = FITNESS_RANK_LABELS[fitnessRank] || fitnessRank;
    const goalLabel = {
        goal_energy:   'improve daily energy',
        goal_strength: 'build strength',
        goal_mobility: 'improve mobility',
        goal_general:  'general fitness',
        goal_none:     'no specific goal'
    }[goalKey] || 'general fitness';

    const prompt = `
You are SYD — a physical training intelligence system. An operative has flagged the following physical condition, injury, or medical limitation before starting a bodyweight fitness programme:

"${conditionsText}"

Their current Fitness Rank is ${rankLabel} and their goal is to ${goalLabel}.

Your task: write a concise modification note (2–3 sentences maximum) that:
1. Acknowledges what they have flagged.
2. Names the specific movement categories they should avoid or modify (e.g. knee flexion under load, spinal flexion, overhead pressing).
3. Names the movements that remain safe and effective for them given this limitation.

Be specific and direct. Do not give medical advice. Do not tell them to see a doctor — assume they already know. Write in SYD's voice: clipped, honest, no softening.

Return ONLY the 2–3 sentence note. No preamble. No labels. No markdown.
`.trim();

    try {
        const result = await geminiGenerate(prompt, 0.2);
        if (result && result.ok && result.text) return result.text.trim();
    } catch(e) {
        console.warn('[SYD] Fitness condition Gemini call failed:', e);
    }
    return null;
}

// ─── DIRECTIVE LIBRARY ────────────────────────────────────────
// Loaded from /terminal/data/fitness.json at first use.
// Cached in _fitnessDirectivesCache after the first fetch.
// Tiers:
//   Tier 0 — F/E rank: foundational. Zero impact. Safe for anyone.
//   Tier 1 — D/C rank: progressive. Moderate load. Standard bodyweight movements.
//   Tier 2 — B/A rank: demanding. Complex combinations, sustained effort, advanced holds.
//   category:'stretch' — always available from rank F, served daily regardless of goal.

let _fitnessDirectivesCache = null;

async function _loadFitnessDirectives() {
    if (_fitnessDirectivesCache) return _fitnessDirectivesCache;
    try {
        const res  = await fetch('/terminal/data/fitness.json');
        const data = await res.json();
        _fitnessDirectivesCache = data.directives || [];
    } catch (e) {
        console.warn('[SYD] Could not load fitness.json — using empty library.', e);
        _fitnessDirectivesCache = [];
    }
    return _fitnessDirectivesCache;
}

// Legacy sync accessor — returns cache if already loaded, else empty array.
// Always call _loadFitnessDirectives() first in any async context.
function _getFitnessDirectivesSync() {
    return _fitnessDirectivesCache || [];
}

const _REMOVED_FITNESS_DIRECTIVES_ARRAY = [

    // ── TIER 0 — Endurance ───────────────────────────────────
    {
        id: 'fit_t0_e01', tier: 0, rank: 'F', stat: 'endurance',
        title: 'Walk for 20 minutes without stopping',
        desc:  'Step outside and walk continuously for 20 minutes at a pace that keeps you moving but lets you hold a conversation. No phone in hand. Pay attention to your breathing and posture.',
        formDesc: 'Walk at a steady pace — not a stroll, not a race. Your breathing should be elevated but controlled. Keep your head up, shoulders back, and land through your heel to mid-foot. If you need to slow down, do — the goal is 20 unbroken minutes.',
        excludeTags: ['ankle']
    },
    {
        id: 'fit_t0_e02', tier: 0, rank: 'F', stat: 'endurance',
        title: 'March in place for 5 minutes',
        desc:  'Stand and march on the spot, lifting your knees to hip height with each step. 5 minutes continuous. Use it as a warm-up or a standalone movement break.',
        formDesc: 'Stand tall. Drive each knee up to hip height — not just shuffling. Swing your opposite arm naturally. Land softly on the ball of your foot. Keep the pace steady for the full 5 minutes.',
        excludeTags: ['knee', 'hip']
    },
    {
        id: 'fit_t0_e03', tier: 0, rank: 'F', stat: 'endurance',
        title: 'Walk up and down stairs for 10 minutes',
        desc:  'Find a flight of stairs. Walk up and down continuously for 10 minutes at a controlled pace. No rushing. Focus on foot placement and breathing.',
        formDesc: 'Step fully onto each stair — whole foot, not just the ball. Use the handrail if you need it. Go up at a pace that elevates your breathing, come down steadily. Full 10 minutes.',
        excludeTags: ['knee', 'ankle', 'hip']
    },
    {
        id: 'fit_t0_e04', tier: 0, rank: 'F', stat: 'endurance',
        title: 'Seated leg lifts — 3 sets of 10',
        desc:  'Sit upright in a chair. Straighten one leg and hold it parallel to the floor for 2 seconds, then lower. 10 reps per leg. 3 sets. No equipment needed.',
        formDesc: 'Sit at the front edge of the chair, back straight, not leaning. Straighten the leg fully — no bend at the knee at the top. Hold 2 seconds. Lower with control. Keep your core slightly braced throughout.',
        excludeTags: ['hip']
    },

    // ── TIER 0 — Strength ────────────────────────────────────
    {
        id: 'fit_t0_s01', tier: 0, rank: 'F', stat: 'strength',
        title: 'Wall push-ups — 3 sets of 10',
        desc:  'Stand arm-length from a wall. Place palms flat on the wall at shoulder height. Lower your chest toward the wall, then push back. 10 reps. 3 sets.',
        formDesc: 'Stand with feet together, about arm-length from the wall. Hands at shoulder width and shoulder height. Keep your body in a straight line from head to heels — do not let your hips sag or push back. Lower your chest until it nearly touches the wall, then push back to straight arms.',
        excludeTags: ['shoulder', 'wrist']
    },
    {
        id: 'fit_t0_s02', tier: 0, rank: 'F', stat: 'strength',
        title: 'Chair-assisted squat — 3 sets of 10',
        desc:  'Stand in front of a sturdy chair. Lower yourself toward the seat, stop just before sitting, then stand back up. 10 reps. 3 sets. The chair is there if you need it.',
        formDesc: 'Stand with feet shoulder-width apart, toes pointing slightly out. Lower by pushing your hips back and bending your knees — not by folding your back. Touch the chair lightly if needed, do not sit fully. Keep your chest tall and your weight through your whole foot.',
        excludeTags: ['knee', 'hip']
    },
    {
        id: 'fit_t0_s03', tier: 0, rank: 'F', stat: 'strength',
        title: 'Dead bug — 3 sets of 6 per side',
        desc:  'Lie on your back, arms pointing toward the ceiling, knees bent at 90° in the air. Lower one arm and the opposite leg toward the floor simultaneously, then return. 6 per side. 3 sets.',
        formDesc: 'Press your lower back firmly into the floor and keep it there throughout. Breathe out as you lower your arm and leg. Move slowly — 3 seconds down, 2 seconds back up. If your back lifts off the floor, you have gone too far. Reduce the range until you can hold it flat.',
        excludeTags: ['back']
    },
    {
        id: 'fit_t0_s04', tier: 0, rank: 'F', stat: 'strength',
        title: 'Glute bridge — 3 sets of 12',
        desc:  'Lie on your back, knees bent, feet flat on the floor. Drive your hips up until your body forms a straight line from shoulders to knees. Hold 2 seconds. Lower slowly. 12 reps. 3 sets.',
        formDesc: 'Feet hip-width apart, flat on the floor about 30cm from your hips. Press through your heels — not your toes. Squeeze your glutes at the top and hold for 2 full seconds. Lower with control; do not let your hips slam down. Keep your arms flat at your sides for balance.',
        excludeTags: ['back', 'hip']
    },

    // ── TIER 0 — Agility / Mobility ──────────────────────────
    {
        id: 'fit_t0_a01', tier: 0, rank: 'F', stat: 'agility',
        title: 'Standing hip circles — 2 minutes',
        desc:  'Stand with feet shoulder-width apart, hands on hips. Draw large slow circles with your hips — 10 circles clockwise, then 10 counter-clockwise. Full range, controlled speed.',
        formDesc: 'Keep your feet flat and still throughout. The movement is in the hips, not the upper body. Draw the biggest circle you comfortably can. Breathe slowly. If you feel tightness on one side, slow down there rather than pushing through.',
        excludeTags: ['hip']
    },
    {
        id: 'fit_t0_a02', tier: 0, rank: 'F', stat: 'agility',
        title: 'Cat-cow stretch — 10 slow cycles',
        desc:  'Start on hands and knees. Arch your back upward like a cat, then lower it into a curve like a cow. Move slowly through the full range. 10 complete cycles.',
        formDesc: 'Hands under shoulders, knees under hips. For the cat: tuck your tailbone, round your spine upward, and drop your head. For the cow: let your belly drop, lift your tailbone and chest, and look forward. Move on your breath — exhale into cat, inhale into cow.',
        excludeTags: ['wrist', 'back']
    },
    {
        id: 'fit_t0_a03', tier: 0, rank: 'F', stat: 'agility',
        title: 'Neck and shoulder mobility — 5 minutes',
        desc:  'Slow, controlled neck rolls and shoulder circles. Each movement held for 3–5 seconds at the end range. No forcing, no bouncing.',
        formDesc: 'Drop your ear toward your shoulder and breathe. Do not pull. Let gravity do the work. Hold 5 seconds, return, repeat other side. For shoulder circles: roll them backward in large slow circles, 10 times each direction. Focus on the range, not the speed.',
        excludeTags: ['shoulder']
    },
    {
        id: 'fit_t0_a04', tier: 0, rank: 'F', stat: 'agility',
        title: 'Ankle and calf mobility — 2 minutes each side',
        desc:  'Stand near a wall for balance. Lift one foot and draw slow circles with your ankle — 10 clockwise, 10 counter-clockwise. Then press the ball of your foot against the floor and hold a calf stretch for 30 seconds. Both sides.',
        formDesc: 'For ankle circles: lift the foot off the ground and move only from the ankle — not the whole leg. Full range, slow speed. For the calf stretch: stand a step from the wall, press one heel firmly into the floor with the leg straight. Keep the heel down and hold.',
        excludeTags: ['ankle']
    },

    // ── TIER 1 — Endurance ───────────────────────────────────
    {
        id: 'fit_t1_e01', tier: 1, rank: 'D', stat: 'endurance',
        title: 'Jog in place — 4 rounds of 90 seconds',
        desc:  'Jog on the spot at a steady pace. 90 seconds on, 30 seconds rest. 4 rounds. Focus on rhythm and breathing — not speed.',
        formDesc: 'Land softly on the ball of your foot, not flat-footed. Keep your arms at 90 degrees, driving them forward and back — not crossing your body. Breathe in through your nose for 3 steps, out through your mouth for 3 steps. If you cannot hold a conversation, slow down.',
        excludeTags: ['knee', 'ankle']
    },
    {
        id: 'fit_t1_e02', tier: 1, rank: 'D', stat: 'endurance',
        title: 'Step-touch intervals — 5 minutes continuous',
        desc:  'Side step left, touch right foot to left, then step right, touch left foot to right. Continuous for 5 minutes. Add arm movement to increase intensity.',
        formDesc: 'Step wide enough that you feel your weight shift fully. Do not drag your feet — lift them. Keep your chest up and look forward, not at your feet. Add a small arm swing outward as you step — it keeps the movement rhythmic and slightly elevates your heart rate.',
        excludeTags: ['knee', 'ankle', 'hip']
    },
    {
        id: 'fit_t1_e03', tier: 1, rank: 'D', stat: 'endurance',
        title: 'Plank hold — 3 sets, hold to fatigue',
        desc:  'Hold a forearm plank for as long as you can maintain form. 3 sets. Rest 60 seconds between sets. Record your hold time on the first set.',
        formDesc: 'Forearms flat on the floor, elbows under shoulders. Keep your hips level — do not let them sag or pike upward. Squeeze your glutes and brace your core as if bracing for a light punch. Look at the floor 30cm in front of you. When your form breaks, stop — that is your set.',
        excludeTags: ['shoulder', 'wrist', 'back']
    },
    {
        id: 'fit_t1_e04', tier: 1, rank: 'D', stat: 'endurance',
        title: 'Shadow boxing — 5 rounds of 2 minutes',
        desc:  'Stand in a slight stance and throw punches, slips, and movement for 2 minutes. Rest 60 seconds between rounds. 5 rounds total. Stay light on your feet.',
        formDesc: 'Guard up — fists near your cheeks. Throw punches from your shoulder, not your elbow. Move your feet between combinations — step, punch, move, do not stand still. Keep your weight balanced and your chin slightly down. No need to throw hard — the goal is 10 continuous minutes of output.',
        excludeTags: ['shoulder', 'ankle']
    },

    // ── TIER 1 — Strength ────────────────────────────────────
    {
        id: 'fit_t1_s01', tier: 1, rank: 'D', stat: 'strength',
        title: 'Standard push-ups — 4 sets to near-failure',
        desc:  'Full push-ups from the floor. 4 sets. Stop 1–2 reps before complete failure. Rest 60–90 seconds between sets.',
        formDesc: 'Hands slightly wider than shoulder-width. Body in a straight line from head to heels — hips neither sagging nor piked. Lower until your chest is one fist-height from the floor. Push back to full arm extension. Breathe in on the way down, out on the way up. If your form breaks, drop to your knees and continue — that counts.',
        excludeTags: ['shoulder', 'wrist']
    },
    {
        id: 'fit_t1_s02', tier: 1, rank: 'D', stat: 'strength',
        title: 'Bodyweight squats — 4 sets of 15',
        desc:  'Full depth squat, no weight. 15 reps. 4 sets. Rest 60 seconds between sets. Focus on depth and knee tracking.',
        formDesc: 'Feet shoulder-width apart, toes out 15–30 degrees. Sit your hips back and down — as if lowering onto a chair that is too far behind you. Go until your thighs are parallel to the floor or deeper if you can. Keep your chest tall, your heels flat, and your knees tracking over your middle toe throughout.',
        excludeTags: ['knee', 'hip']
    },
    {
        id: 'fit_t1_s03', tier: 1, rank: 'D', stat: 'strength',
        title: 'Reverse lunges — 3 sets of 10 per leg',
        desc:  'Step backward into a lunge, lower your back knee toward the floor, then return. 10 per leg. 3 sets. Safer on the knees than forward lunges.',
        formDesc: 'Step directly backward — not to the side. Your front knee stays over your ankle, not pushing forward past your toes. Lower your back knee toward (not onto) the floor. Keep your torso upright. Drive through your front heel to return. If balance is difficult, hold a wall with one hand.',
        excludeTags: ['knee', 'hip', 'ankle']
    },
    {
        id: 'fit_t1_s04', tier: 1, rank: 'D', stat: 'strength',
        title: 'Tricep dips off a chair — 3 sets of 12',
        desc:  'Sit at the edge of a sturdy chair, hands gripping the seat edge. Lower your body toward the floor by bending your elbows, then press back up. 12 reps. 3 sets.',
        formDesc: 'Hands shoulder-width on the edge of the seat, fingers forward. Walk your feet out slightly. Keep your back close to the chair as you lower — do not drift forward. Lower until your elbows are at 90 degrees, then press back to straight arms. Keep your shoulders down, not hunched toward your ears.',
        excludeTags: ['shoulder', 'wrist']
    },
    {
        id: 'fit_t1_s05', tier: 1, rank: 'D', stat: 'strength',
        title: 'Sit-ups — 3 sets of 15',
        desc:  'Full sit-ups from the floor. 15 reps. 3 sets. Controlled on the way down — do not crash back.',
        formDesc: 'Lie flat, knees bent, feet flat on the floor. Cross your arms on your chest or place fingertips behind your ears — do not pull on your neck. Sit all the way up until your elbows touch your thighs. Lower slowly — 2 seconds back down. Breathe out on the way up.',
        excludeTags: ['back', 'hip']
    },
    {
        id: 'fit_t1_s06', tier: 1, rank: 'D', stat: 'strength',
        title: 'Leg raises — 3 sets of 12',
        desc:  'Lie on your back, legs straight. Raise both legs to 90 degrees, then lower slowly without touching the floor. 12 reps. 3 sets.',
        formDesc: 'Press your lower back into the floor and keep it there. Raise both legs together until they are vertical. Lower slowly — 3 to 4 seconds — stopping just above the floor before the next rep. If your back lifts, raise your legs higher (less range) until you build the strength to go lower.',
        excludeTags: ['back', 'hip']
    },

    // ── TIER 1 — Agility / Core ──────────────────────────────
    {
        id: 'fit_t1_a01', tier: 1, rank: 'D', stat: 'agility',
        title: 'Side plank — 3 sets of 30 seconds each side',
        desc:  'Lie on your side, prop yourself up on your forearm. Lift your hips off the floor and hold a straight line from head to feet. 30 seconds each side. 3 sets.',
        formDesc: 'Elbow directly under your shoulder. Stack your feet, or stagger them if balance is difficult. Lift your hips until your body is in a straight line — do not let them sag. Keep your top arm along your side or pointed at the ceiling. Breathe steadily.',
        excludeTags: ['shoulder', 'wrist']
    },
    {
        id: 'fit_t1_a02', tier: 1, rank: 'D', stat: 'agility',
        title: 'Bicycle crunches — 3 sets of 20',
        desc:  'Lie on your back, hands behind your head. Bring opposite elbow to opposite knee in a twisting motion. 20 total reps (10 per side). 3 sets.',
        formDesc: 'Keep both hands lightly behind your head — do not pull. Rotate from your core, not your neck. Fully extend the straightening leg each rep. Move with control — 2 seconds each rep — not fast. Your lower back should stay in contact with the floor throughout.',
        excludeTags: ['back', 'hip']
    },
    {
        id: 'fit_t1_a03', tier: 1, rank: 'D', stat: 'agility',
        title: "World's greatest stretch — 5 reps per side",
        desc:  'A full-body mobility sequence: lunge, rotate, reach. 5 slow reps each side. Used by athletes worldwide as a daily movement prep.',
        formDesc: 'Step forward into a deep lunge. Place the same-side hand on the floor inside your front foot. Rotate your upper body, reaching that arm toward the ceiling. Hold 2 seconds. Return hand to floor. Drive back hip forward and drop your back knee if needed for depth. This is one rep.',
        excludeTags: ['knee', 'wrist', 'hip', 'shoulder']
    },
    {
        id: 'fit_t1_a04', tier: 1, rank: 'D', stat: 'agility',
        title: 'Inchworm — 3 sets of 8',
        desc:  'Stand tall, fold forward and walk your hands out to a plank position. Pause. Walk your feet back to your hands. Stand. 8 reps. 3 sets.',
        formDesc: 'Keep your legs as straight as you can when you fold — a slight bend is fine, no forcing. Walk your hands out one at a time until you are in a full plank. Pause one second. Walk your feet in one step at a time. Stand fully before the next rep. Move with control throughout.',
        excludeTags: ['wrist', 'shoulder', 'back']
    },
    {
        id: 'fit_t1_a05', tier: 1, rank: 'D', stat: 'agility',
        title: 'Hollow body hold — 3 sets of 20 seconds',
        desc:  'Lie on your back. Press your lower back into the floor, lift your shoulders and legs slightly off the ground, and hold. Arms by your sides or extended overhead. 20 seconds. 3 sets.',
        formDesc: 'The lower back must stay flat on the floor — this is the whole exercise. If it lifts, raise your legs higher. Tuck your chin slightly. Keep your legs together and toes pointed. Breathe shallowly — you will feel your core working to maintain the position. When your back peels off the floor, the set is over.',
        excludeTags: ['back', 'hip']
    },

    // ── TIER 2 — Endurance ───────────────────────────────────
    {
        id: 'fit_t2_e01', tier: 2, rank: 'B', stat: 'endurance',
        title: 'Burpees — 5 sets of 10',
        desc:  'Full burpee: squat, jump back to plank, chest to floor, push up, jump forward, jump up with arms overhead. 10 reps. 5 sets. Rest 90 seconds between sets.',
        formDesc: 'Squat and place hands on the floor. Jump or step both feet back to a full plank. Lower your chest to the floor — actually touch it. Push up. Jump your feet back to your hands. Stand and jump with arms overhead. That is one rep. Maintain this sequence even when fatigued — sloppy burpees train sloppiness.',
        excludeTags: ['knee', 'shoulder', 'wrist', 'ankle', 'back']
    },
    {
        id: 'fit_t2_e02', tier: 2, rank: 'B', stat: 'endurance',
        title: 'Jump squats — 4 sets of 12',
        desc:  'Squat down to parallel, then explode upward into a jump. Land softly and immediately lower into the next squat. 12 reps. 4 sets. Rest 60 seconds.',
        formDesc: 'Lower with control — same mechanics as a regular squat. Drive through the floor at the bottom and explode upward. Reach your arms overhead at the top. Land softly on the balls of your feet, absorb through your knees and hips, and go directly into the next rep. Never land stiff-legged.',
        excludeTags: ['knee', 'ankle', 'hip', 'back']
    },
    {
        id: 'fit_t2_e03', tier: 2, rank: 'B', stat: 'endurance',
        title: 'Mountain climbers — 4 sets of 30 seconds',
        desc:  'From a plank position, drive alternate knees toward your chest as fast as you can maintain form. 30 seconds. 4 sets. Rest 30 seconds between sets.',
        formDesc: 'Set up in a full plank — hands under shoulders, body in a straight line. Drive one knee toward your chest, then snap it back while the other comes forward. Keep your hips level — do not let them rise as you speed up. Your shoulders should stay directly over your wrists throughout.',
        excludeTags: ['shoulder', 'wrist', 'knee', 'back']
    },
    {
        id: 'fit_t2_e04', tier: 2, rank: 'B', stat: 'endurance',
        title: 'Tabata protocol — any movement, 4 minutes',
        desc:  'Choose one exercise (squats, push-ups, mountain climbers, or jumping jacks). 20 seconds maximum effort. 10 seconds rest. 8 rounds. Total: 4 minutes.',
        formDesc: 'The 20 seconds must be genuine maximum effort — not a comfortable pace. The 10 second rest is exact — do not extend it. Pick one movement and do not switch. Your form will degrade as fatigue sets in: accept minor degradation in speed, do not accept breakdown in the fundamental position.',
        excludeTags: []
    },

    // ── TIER 2 — Strength ────────────────────────────────────
    {
        id: 'fit_t2_s01', tier: 2, rank: 'B', stat: 'strength',
        title: 'Diamond push-ups — 4 sets of 8',
        desc:  'Push-up with hands forming a diamond shape directly under your chest. Targets the triceps heavily. 8 reps. 4 sets.',
        formDesc: 'Bring your thumbs and index fingers together to form a diamond shape. Place them directly under your sternum. Lower your chest toward your hands — keeping elbows tracking backward, not flaring out. Press back to full arm extension. This is significantly harder than a standard push-up — reduce reps before reducing form.',
        excludeTags: ['shoulder', 'wrist']
    },
    {
        id: 'fit_t2_s02', tier: 2, rank: 'B', stat: 'strength',
        title: 'Bulgarian split squat — 3 sets of 10 per leg',
        desc:  'Stand a step in front of a chair. Rest one foot on the seat behind you. Lower your body until your front thigh is parallel to the floor. 10 reps. Switch legs. 3 sets.',
        formDesc: 'Your front foot should be far enough forward that your front shin is vertical at the bottom of the movement. Drive through your front heel to stand. Keep your torso upright — do not fold forward. This is a balance challenge as much as a strength one. Use a wall for balance if needed on the first attempt.',
        excludeTags: ['knee', 'hip', 'ankle']
    },
    {
        id: 'fit_t2_s03', tier: 2, rank: 'B', stat: 'strength',
        title: 'Pike push-ups — 4 sets of 10',
        desc:  'From a downward-dog position, lower your head toward the floor by bending your elbows, then press back up. Targets shoulders. 10 reps. 4 sets.',
        formDesc: 'Start in a standard push-up position, then walk your feet toward your hands until your hips are high — forming an inverted V. Lower your head toward the floor between your hands by bending your elbows out to the side. Press back up. The closer your feet to your hands, the more vertical the press angle.',
        excludeTags: ['shoulder', 'wrist', 'back']
    },
    {
        id: 'fit_t2_s04', tier: 2, rank: 'B', stat: 'strength',
        title: 'Decline push-ups — 4 sets of 12',
        desc:  'Feet elevated on a chair, hands on the floor. Push-up from this elevated foot position. Shifts the load toward the upper chest and shoulders. 12 reps. 4 sets.',
        formDesc: 'Feet on the seat of a sturdy chair, hands on the floor at shoulder width. Keep your body in a straight line from feet to head — do not let your hips sag. Lower your chest toward the floor with full control. The higher your feet, the harder the movement. Start with feet at knee height if you have not done these before.',
        excludeTags: ['shoulder', 'wrist']
    },
    {
        id: 'fit_t2_s05', tier: 2, rank: 'B', stat: 'strength',
        title: 'V-sit hold — 3 sets of 20 seconds',
        desc:  'Sit on the floor, lean back slightly, and lift both legs straight to form a V shape with your body. Hold. 20 seconds. 3 sets.',
        formDesc: 'Sit on the floor and place your hands lightly on the ground beside your hips for the first attempt. Lean your torso back about 45 degrees and raise your legs to match — creating a V shape. Point your toes. Hold the position with your core — do not grip the floor with your hands unless your balance gives out. When you cannot maintain the V without your back rounding, the set is done.',
        excludeTags: ['back', 'hip']
    },

    // ── TIER 2 — Agility / Core ──────────────────────────────
    {
        id: 'fit_t2_a01', tier: 2, rank: 'B', stat: 'agility',
        title: 'Bear crawl — 4 sets of 20 metres',
        desc:  'On all fours, crawl forward keeping your knees 2–3cm off the floor. 20 metres forward and back. 4 sets. Rest 60 seconds between sets.',
        formDesc: 'Start on hands and knees. Lift your knees just off the floor. Move the opposite hand and foot together — right hand with left foot. Keep your back flat — no sagging or piking. Move slowly and deliberately. The slower you go, the harder this is. Your hips should stay low and level throughout.',
        excludeTags: ['wrist', 'shoulder', 'knee']
    },
    {
        id: 'fit_t2_a02', tier: 2, rank: 'B', stat: 'agility',
        title: 'Lateral bounds — 3 sets of 10 per side',
        desc:  'Jump sideways from one foot to the other, landing on a single leg and holding the landing for 1 second before the next jump. 10 per side. 3 sets.',
        formDesc: 'Push off from one foot and jump laterally, landing on the opposite foot. Absorb the landing by bending the knee — do not land stiff. Hold the landing for 1 full second before the next jump. Keep the distance manageable — the landing mechanics matter more than the distance.',
        excludeTags: ['knee', 'ankle', 'hip']
    },
    {
        id: 'fit_t2_a03', tier: 2, rank: 'B', stat: 'agility',
        title: 'Turkish get-up — 3 reps per side (slow)',
        desc:  'Lie on the floor. Using only your bodyweight, move from flat on your back to standing, following the specific sequence of the Turkish get-up. Then reverse back down. 3 reps per side.',
        formDesc: 'Lie on your back. Extend one arm straight toward the ceiling. Roll onto your opposite elbow, then your hand. Sweep the opposite leg back into a kneeling position. Stand. Reverse the sequence back to lying. Keep the raised arm vertical throughout. Move slowly — this is a mobility and coordination exercise, not a speed test. Each rep should take 60 seconds.',
        excludeTags: ['wrist', 'shoulder', 'knee', 'hip']
    },
    {
        id: 'fit_t2_a04', tier: 2, rank: 'B', stat: 'agility',
        title: 'Broad jumps — 3 sets of 6',
        desc:  'Stand with feet shoulder-width apart. Jump forward as far as possible with both feet, land softly, hold the landing for 2 seconds. Walk back. 6 reps. 3 sets.',
        formDesc: 'Load by swinging your arms back and bending your knees. Drive your arms forward and jump from both feet. Land on both feet simultaneously, absorbing through the ankles, knees, and hips. Hold the landing completely still for 2 seconds before the next rep. Distance is secondary — landing quality is the target.',
        excludeTags: ['knee', 'ankle', 'hip', 'back']
    },
    {
        id: 'fit_t2_a05', tier: 2, rank: 'B', stat: 'agility',
        title: 'Dynamic plank complex — 3 rounds',
        desc:  'One round: 10 shoulder taps, 10 hip dips, 10 mountain climbers (slow). Rest 45 seconds. 3 rounds total. All from the plank position.',
        formDesc: 'Shoulder taps: from a full plank, lift one hand to tap the opposite shoulder, alternating. Keep your hips still. Hip dips: from a forearm plank, rotate your hips to dip one side toward the floor, alternating. Mountain climbers (slow): drive each knee to the chest with a 2-second hold at the top. The goal is control throughout all three movements.',
        excludeTags: ['wrist', 'shoulder', 'back']
    },

    // ── ADDITIONAL CORE — distributed across tiers ───────────
    {
        id: 'fit_t1_c01', tier: 1, rank: 'D', stat: 'strength',
        title: 'Crunches — 4 sets of 20',
        desc:  'Lie on your back, knees bent. Curl your shoulders off the floor, hold 1 second, lower. 20 reps. 4 sets. Controlled tempo throughout.',
        formDesc: 'Hands crossed on your chest or fingertips at your temples — do not pull your neck. Curl your upper back off the floor using your abs — not your momentum. Hold 1 second at the top. Lower slowly. Only your shoulder blades leave the floor; your lower back stays down throughout.',
        excludeTags: ['back']
    },
    {
        id: 'fit_t1_c02', tier: 1, rank: 'D', stat: 'strength',
        title: 'Plank to downward dog — 3 sets of 10',
        desc:  'Start in a plank. Push your hips up into a downward-dog position, then lower back to plank. 10 reps. 3 sets.',
        formDesc: 'From the plank, push through your hands and drive your hips toward the ceiling. Your body forms an inverted V at the top — heels reaching toward the floor. Hold 1 second. Lower back to a flat plank under control. Keep your core braced throughout and do not let your lower back sag in the plank position.',
        excludeTags: ['shoulder', 'wrist', 'back']
    },
    {
        id: 'fit_t0_c01', tier: 0, rank: 'F', stat: 'strength',
        title: 'Lying leg raises — single leg — 3 sets of 10 per side',
        desc:  'Lie on your back. Keep one leg flat on the floor, raise the other to 45 degrees, then lower without touching. 10 reps. Switch legs. 3 sets.',
        formDesc: 'Press your lower back firmly into the floor. Keep the working leg straight. Lower it slowly — 3 seconds — and stop just above the floor before the next rep. If your back arches, raise your foot higher. The leg on the floor stays flat and still throughout.',
        excludeTags: ['back', 'hip']
    }
];
// NOTE: _REMOVED_FITNESS_DIRECTIVES_ARRAY above is kept temporarily so git diff is readable.
// It is never referenced — all directive access goes through _loadFitnessDirectives().

// ─── DIRECTIVE FILTERING ──────────────────────────────────────
// Returns directives appropriate for the operative's Fitness Rank,
// filtered by their condition tags.
// Rank progression: F includes Tier 0 only, D includes Tier 0+1, B includes all.
// Stretch directives (category:'stretch') are always included regardless of tier cap.
const RANK_MAX_TIER = { 'F': 0, 'E': 0, 'D': 1, 'C': 1, 'B': 2, 'A': 2 };

function getFitnessDirectivesForRank(rank, conditionTags) {
    const allDirectives = _getFitnessDirectivesSync();
    const maxTier  = RANK_MAX_TIER[rank] ?? 0;
    const excluded = (conditionTags || []).flatMap(tag =>
        CONDITION_EXCLUDE_TAGS[tag] || []
    );

    return allDirectives.filter(d => {
        // Stretch directives bypass the tier cap — always available
        const isStretch = d.category === 'stretch';
        if (!isStretch && d.tier > maxTier) return false;
        if ((d.excludeTags || []).some(tag => excluded.includes(tag))) return false;
        return true;
    });
}

// Returns today's fitness directives — 2 per day (1 main + 1 stretch), date-seeded.
// Uses resolvedStat (from goal free text) over goalKey mapping when available.
// Daily assignment is stored in fitnessData.assignedToday so the same pair
// shows all day even after individual directives are marked done.
function getTodaysFitnessDirectives(fitnessData) {
    if (!fitnessData || !fitnessData.rank) return [];

    const todayStr     = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);
    const allDirectives = _getFitnessDirectivesSync();

    // If today's directives are already assigned, return them directly
    if (fitnessData.lastAssignedDate === todayStr && (fitnessData.assignedToday || []).length > 0) {
        return (fitnessData.assignedToday || [])
            .map(id => allDirectives.find(d => d.id === id))
            .filter(Boolean);
    }

    // Otherwise pick fresh directives for today
    const rank         = fitnessData.rank;
    const condTags     = fitnessData.conditionTags || [];
    // resolvedStat from goal free text takes priority over goalKey mapping
    const goalStat     = fitnessData.resolvedStat || GOAL_STAT_WEIGHT[fitnessData.goalKey] || null;
    const completedIds = fitnessData.completedIds || [];

    const pool = getFitnessDirectivesForRank(rank, condTags);
    if (pool.length === 0) return [];

    const dateNum = parseInt(todayStr.replace(/-/g, ''), 10);
    const pick    = (arr, offset) => arr.length > 0 ? arr[(dateNum + offset) % arr.length] : null;

    // ── Always pick one stretch ────────────────────────────────
    const stretches           = pool.filter(d => d.category === 'stretch');
    const incompleteStretches = stretches.filter(d => !completedIds.includes(d.id));
    const stretchPick         = pick(incompleteStretches.length > 0 ? incompleteStretches : stretches, 2);

    // ── Pick main directive (non-stretch, goal-weighted) ───────
    const mainPool    = pool.filter(d => d.category !== 'stretch');
    const incomplete  = mainPool.filter(d => !completedIds.includes(d.id));
    const goalAligned = incomplete.filter(d => goalStat && d.stat === goalStat);
    const other       = incomplete.filter(d => !goalStat || d.stat !== goalStat);
    const mainPick    = goalAligned.length > 0 ? pick(goalAligned, 0) : pick(other, 0);

    const assigned = [mainPick, stretchPick].filter(Boolean);

    // Persist today's assignment so it stays stable all day
    fitnessData.lastAssignedDate = todayStr;
    fitnessData.assignedToday    = assigned.map(d => d.id);
    if (typeof saveFitness === 'function') saveFitness(fitnessData);

    return assigned;
}

// ─── WEB SPEECH API ───────────────────────────────────────────
const FITNESS_VOICE_KEY = 'syd_fitness_voice';
let _speechActive = false;

function _getFitnessVoiceSettings() {
    try { return JSON.parse(localStorage.getItem(FITNESS_VOICE_KEY) || '{}'); }
    catch(e) { return {}; }
}

function _saveFitnessVoiceSettings(s) {
    localStorage.setItem(FITNESS_VOICE_KEY, JSON.stringify(s));
}

// Transforms text for paced guided-exercise reading.
// Applied only to the speech string — stored/displayed text is never modified.
function _paceTextForSpeech(text) {
    return text
        .replace(/\. /g,        '... ')
        .replace(/ — /g,        '... ')
        .replace(/\. Then /g,   '... Then ')
        .replace(/\. Keep /g,   '... Keep ')
        .replace(/\. Your /g,   '... Your ')
        .replace(/\. Do not /g, '... Do not ')
        .replace(/\. Lower /g,  '... Lower ')
        .replace(/\. Press /g,  '... Press ')
        .replace(/\. Breathe /g,'... Breathe ')
        .replace(/\. Hold /g,   '... Hold ');
}

function readFormDescription(text) {
    if (!window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel();

    if (_speechActive) {
        _speechActive = false;
        return;
    }

    const settings  = _getFitnessVoiceSettings();
    const paced     = _paceTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(paced);
    utterance.rate   = settings.rate  ?? 0.78;
    utterance.pitch  = settings.pitch ?? 0.95;
    utterance.volume = 1.0;

    if (settings.voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const match  = voices.find(v => v.name === settings.voiceName);
        if (match) utterance.voice = match;
    }

    utterance.onstart = () => { _speechActive = true; };
    utterance.onend   = () => { _speechActive = false; };
    utterance.onerror = () => { _speechActive = false; };

    window.speechSynthesis.speak(utterance);
}

// ─── VOICE PICKER ─────────────────────────────────────────────
function _renderVoicePicker(container, fitnessData) {
    const voices   = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    const settings = _getFitnessVoiceSettings();
    const preview  = 'Feet flat on the floor... press through your heels... hold for two full seconds.';

    const voiceRows = voices.length > 0
        ? voices.map(v => `
            <button class="fp-scan-opt ${settings.voiceName === v.name ? 'fp-scan-opt--selected' : ''}"
                data-voice-name="${v.name.replace(/"/g, '&quot;')}">
                ${v.name}${v.localService ? '' : ' ↗'}
            </button>`).join('')
        : `<p class="fp-result-body" style="opacity:0.6;">No English voices found on this device.</p>`;

    container.innerHTML = `
        <div class="fp-all-wrap">
            <button class="fp-back-btn" id="fp-voice-back">← BACK</button>
            <p class="fp-all-label">[ VOICE SETTINGS ]</p>
            <p class="fp-all-sub">Choose the voice SYD uses to read exercise instructions aloud.</p>
            <div class="fp-scan-opts" style="margin-bottom:20px;">${voiceRows}</div>
            <p class="fp-all-sub" style="margin-bottom:8px;">Reading speed</p>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-secondary);">SLOW</span>
                <input type="range" id="fp-rate-slider" min="0.5" max="1.1" step="0.05"
                    value="${settings.rate ?? 0.78}" style="flex:1;">
                <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-secondary);">FAST</span>
            </div>
            <button class="btn btn--secondary" id="fp-voice-preview">[ PREVIEW ]</button>
        </div>
    `;

    container.querySelectorAll('.fp-scan-opt[data-voice-name]').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            container.querySelectorAll('.fp-scan-opt[data-voice-name]')
                .forEach(b => b.classList.remove('fp-scan-opt--selected'));
            btn.classList.add('fp-scan-opt--selected');
            const s = _getFitnessVoiceSettings();
            s.voiceName = btn.dataset.voiceName;
            _saveFitnessVoiceSettings(s);
        });
    });

    const rateSlider = document.getElementById('fp-rate-slider');
    if (rateSlider) {
        rateSlider.addEventListener('input', () => {
            const s = _getFitnessVoiceSettings();
            s.rate = parseFloat(rateSlider.value);
            _saveFitnessVoiceSettings(s);
        });
    }

    document.getElementById('fp-voice-preview').addEventListener('click', () => {
        readFormDescription(preview);
    });

    document.getElementById('fp-voice-back').addEventListener('click', () => {
        playUIClick();
        _renderFitnessActive(container, fitnessData);
    });
}

// ─── OPS SEGMENT ENTRY POINT ──────────────────────────────────
// Called by renderOpsSegment() in status.js.
function renderFitnessSegment(container) {
    if (!container) return;

    const fitnessData = (typeof loadFitness === 'function') ? loadFitness() : null;

    if (!fitnessData || !fitnessData.rank) {
        // Not activated — show opt-in panel
        _renderFitnessOptIn(container);
    } else {
        // Activated — show active panel
        _renderFitnessActive(container, fitnessData);
    }
}

// ─── OPT-IN PANEL ─────────────────────────────────────────────
function _renderFitnessOptIn(container) {
    container.innerHTML = `
        <div class="fp-optin-wrap">
            <p class="fp-optin-label">[ PHYSICAL SIGNAL — NOT YET ACTIVE ]</p>
            <p class="fp-optin-body">
                SYD reads career and mind. It does not read body — that is an option.
            </p>
            <p class="fp-optin-body">
                The Fitness Protocol assigns you a baseline rank from 8 questions,
                then delivers daily bodyweight directives calibrated to where you actually are —
                not where you think you should be. No equipment. Works anywhere.
            </p>
            <button class="btn btn--primary fp-optin-btn" id="fp-optin-btn">
                [ ACTIVATE FITNESS PROTOCOL ]
            </button>
        </div>
    `;

    document.getElementById('fp-optin-btn').addEventListener('click', () => {
        playUIClick();
        _renderFitnessScan(container);
    });
}

// ─── SCAN ─────────────────────────────────────────────────────
let _fitScanAnswers = {};

function _renderFitnessScan(container) {
    _fitScanAnswers = {};
    _renderFitnessScanQuestion(container, 0);
}

function _renderFitnessScanQuestion(container, idx) {
    const q       = FITNESS_QUESTIONS[idx];
    const total   = FITNESS_QUESTIONS.length;
    const pct     = Math.round((idx / total) * 100);
    const isLast  = idx === total - 1;

    // Determine if conditions free-text should show
    const prevCondAnswer = _fitScanAnswers['conditions_choice'];
    const showCondText   = q.id === 'conditions' && prevCondAnswer === 'cond_yes';

    let optionsHTML = '';

    if (q.type === 'choice') {
        optionsHTML = q.options.map(opt => `
            <button class="fp-scan-opt ${_fitScanAnswers[q.id] === opt.id ? 'fp-scan-opt--selected' : ''}"
                data-opt-id="${opt.id}" data-q-id="${q.id}">
                ${opt.text}
            </button>
        `).join('');
    } else if (q.type === 'freetext') {
        optionsHTML = `
            <textarea class="fp-scan-textarea" id="fp-scan-freetext"
                placeholder="${q.placeholder || ''}"
                maxlength="400">${_fitScanAnswers[q.id] || ''}</textarea>
        `;
    } else if (q.type === 'goal') {
        optionsHTML = q.options.map(opt => `
            <button class="fp-scan-opt ${_fitScanAnswers[q.id] === opt.id ? 'fp-scan-opt--selected' : ''}"
                data-opt-id="${opt.id}" data-q-id="${q.id}">
                ${opt.text}
            </button>
        `).join('');
        optionsHTML += `
            <div class="fp-conditions-text-wrap" style="margin-top:8px;">
                <textarea class="fp-scan-textarea" id="fp-goal-freetext"
                    placeholder="${q.placeholder || ''}"
                    maxlength="300">${_fitScanAnswers['goal_text'] || ''}</textarea>
            </div>
        `;
    } else if (q.type === 'conditions') {
        optionsHTML = q.options.map(opt => `
            <button class="fp-scan-opt ${_fitScanAnswers['conditions_choice'] === opt.id ? 'fp-scan-opt--selected' : ''}"
                data-opt-id="${opt.id}" data-q-id="conditions_choice">
                ${opt.text}
            </button>
        `).join('');

        if (showCondText || _fitScanAnswers['conditions_choice'] === 'cond_yes') {
            optionsHTML += `
                <div class="fp-conditions-text-wrap" id="fp-conditions-text-wrap">
                    <p class="fp-scan-hint">Describe your condition or limitation below. Be specific — SYD uses this to filter and modify your directives.</p>
                    <textarea class="fp-scan-textarea" id="fp-conditions-freetext"
                        placeholder="${q.placeholder || ''}"
                        maxlength="600">${_fitScanAnswers['conditions_text'] || ''}</textarea>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div class="fp-scan-wrap">
            <div class="fp-scan-progress-bar">
                <div class="fp-scan-progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="fp-scan-step">QUESTION ${idx + 1} OF ${total}</p>
            <p class="fp-scan-q">${q.q}</p>
            ${q.hint ? `<p class="fp-scan-hint">${q.hint}</p>` : ''}
            <div class="fp-scan-opts" id="fp-scan-opts">
                ${optionsHTML}
            </div>
            <div class="fp-scan-actions">
                ${idx > 0 ? `<button class="fp-scan-back-btn" id="fp-scan-back">← BACK</button>` : ''}
                <button class="btn btn--primary fp-scan-next-btn" id="fp-scan-next">
                    ${isLast ? '[ PROCESS SIGNAL ]' : '[ NEXT ]'}
                </button>
            </div>
        </div>
    `;

    // Wire choice buttons
    container.querySelectorAll('.fp-scan-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            const qId  = btn.dataset.qId;
            const optId = btn.dataset.optId;
            _fitScanAnswers[qId] = optId;

            // Re-render question to show/hide conditions free text
            if (qId === 'conditions_choice') {
                _renderFitnessScanQuestion(container, idx);
                return;
            }

            container.querySelectorAll(`[data-q-id="${qId}"]`).forEach(b => {
                b.classList.toggle('fp-scan-opt--selected', b.dataset.optId === optId);
            });
        });
    });

    // Wire back
    const backBtn = document.getElementById('fp-scan-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            playUIClick();
            _renderFitnessScanQuestion(container, idx - 1);
        });
    }

    // Wire next
    const nextBtn = document.getElementById('fp-scan-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            playUIClick();

            // Save current answer
            if (q.type === 'freetext') {
                const ta = document.getElementById('fp-scan-freetext');
                _fitScanAnswers[q.id] = ta ? ta.value.trim() : '';
            } else if (q.type === 'goal') {
                const ta = document.getElementById('fp-goal-freetext');
                if (ta) _fitScanAnswers['goal_text'] = ta.value.trim();
            } else if (q.type === 'conditions') {
                const ta = document.getElementById('fp-conditions-freetext');
                if (ta) _fitScanAnswers['conditions_text'] = ta.value.trim();
            }

            if (isLast) {
                _processFitnessScan(container);
            } else {
                _renderFitnessScanQuestion(container, idx + 1);
            }
        });
    }
}

// ─── SCAN PROCESSING ──────────────────────────────────────────
async function _processFitnessScan(container) {
    // Show processing state
    container.innerHTML = `
        <div class="fp-processing-wrap">
            <p class="fp-processing-label">[ READING YOUR SIGNAL ]</p>
            <div class="fp-loading-bar"><div class="fp-loading-fill"></div></div>
            <p class="fp-processing-sub">Calibrating directives to your baseline.</p>
        </div>
    `;

    // Ensure directive library is loaded before scoring
    await _loadFitnessDirectives();

    // ── Compute score from questions 1–5 ──────────────────────
    let score = 0;
    const scoredQIds = ['freq', 'stairs', 'pushup', 'sitting', 'pain'];

    scoredQIds.forEach(qId => {
        const question  = FITNESS_QUESTIONS.find(q => q.id === qId);
        const answerId  = _fitScanAnswers[qId];
        if (!question || !answerId) return;
        const option = (question.options || []).find(o => o.id === answerId);
        if (option && typeof option.score === 'number') score += option.score;
    });

    const rank           = deriveFitnessRank(score);
    const goalKey        = _fitScanAnswers['goal'] || 'goal_general';
    const goalFreeText   = _fitScanAnswers['goal_text'] || '';
    const conditionsText = _fitScanAnswers['conditions_text'] || '';
    const conditionTags  = detectLocalConditionTags(conditionsText);

    // ── Process goal free text ─────────────────────────────────
    // Try Gemini first, fall back to local keyword parsing.
    // Result: resolved primaryStat overrides goalKey weighting.
    let goalSignal = null;
    if (goalFreeText.length > 4) {
        goalSignal = await processGoalWithGemini(goalFreeText, goalKey, rank);
        if (!goalSignal) {
            goalSignal = parseGoalFreeText(goalFreeText);
        }
    }
    // Resolved stat: from goal free text signal, else from goalKey mapping
    const resolvedStat = (goalSignal && goalSignal.primaryStat)
        || GOAL_STAT_WEIGHT[goalKey]
        || null;

    // ── Gemini: process conditions if available ────────────────
    let modNote = null;
    if (conditionsText.length > 5) {
        modNote = await processConditionsWithGemini(conditionsText, rank, goalKey);
    }

    // ── Build local mod note if Gemini unavailable ─────────────
    if (!modNote && conditionTags.length > 0) {
        modNote = `Condition flagged: ${conditionTags.join(', ')} involvement noted. Directives involving these movement patterns have been filtered from your queue. If anything still feels wrong, skip that directive — the System will not penalise you for it.`;
    }

    // ── Local interpretation: recent activity ─────────────────
    const recentText   = (_fitScanAnswers['recent'] || '').toLowerCase();
    const longInactive = recentText.includes('week') || recentText.includes('month') ||
                         recentText.includes('year')  || recentText.includes('nothing') ||
                         recentText.includes("don't") || recentText.includes('havent') ||
                         recentText.includes("haven't");
    if ((longInactive && rank === 'F') || (longInactive && rank === 'E')) {
        modNote = (modNote ? modNote + ' ' : '') +
            'Extended inactivity detected. Your first week of directives will be Tier 0 only — build the pattern before the load.';
    }

    // ── Goal voice line ────────────────────────────────────────
    // Use Gemini/local signal voice line if goal free text was provided,
    // otherwise fall back to the standard key-based line.
    const GOAL_VOICE_LINES = {
        goal_energy:   'Directives weighted toward endurance — sustained output builds daily energy.',
        goal_strength: 'Directives weighted toward strength — load accumulates over time.',
        goal_mobility: 'Directives weighted toward agility — movement quality first.',
        goal_general:  'Balanced directive pool — no single stat weighted.',
        goal_none:     'Full directive pool available. No weighting applied.'
    };
    const goalVoiceLine = (goalSignal && goalSignal.voiceLine)
        || GOAL_VOICE_LINES[goalKey];

    // ── Save fitness data ──────────────────────────────────────
    const fitnessData = {
        rank,
        score,
        goalKey,
        goalFreeText,
        resolvedStat,
        goalVoiceLine,
        conditionsText,
        conditionTags,
        modNote,
        completedIds:   [],
        lastAssignedDate: '',
        assignedToday:    [],
        scanDate: (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10)
    };

    if (typeof saveFitness === 'function') saveFitness(fitnessData);

    // ── Render result ─────────────────────────────────────────
    _renderFitnessScanResult(container, fitnessData);
}

// ─── SCAN RESULT ──────────────────────────────────────────────
function _renderFitnessScanResult(container, fitnessData) {
    const rankLabel  = FITNESS_RANK_LABELS[fitnessData.rank] || fitnessData.rank;
    const goalLabels = {
        goal_energy:   'Feel less physically tired',
        goal_strength: 'Build basic strength',
        goal_mobility: 'Improve movement and flexibility',
        goal_general:  'General fitness',
        goal_none:     'No specific goal'
    };

    container.innerHTML = `
        <div class="fp-result-wrap">
            <p class="fp-result-label">[ PHYSICAL SIGNAL ACQUIRED ]</p>
            <div class="fp-result-rank-block">
                <p class="fp-result-rank-tag">FITNESS RANK</p>
                <p class="fp-result-rank">${fitnessData.rank} &mdash; ${rankLabel}</p>
            </div>
            <p class="fp-result-goal-line">Goal: ${goalLabels[fitnessData.goalKey] || 'General fitness'}</p>
            ${fitnessData.goalVoiceLine ? `<p class="fp-result-body" style="margin-top:-4px;opacity:0.7;font-style:italic;">${fitnessData.goalVoiceLine}</p>` : ''}
            ${fitnessData.modNote ? `
                <div class="fp-result-modnote">
                    <p class="fp-result-modnote-label">[ CONDITION NOTE ]</p>
                    <p class="fp-result-modnote-text">${fitnessData.modNote}</p>
                </div>
            ` : ''}
            <p class="fp-result-body">
                Your directives are calibrated to ${rankLabel} baseline.
                Two fitness directives will appear in this panel each day,
                filtered to what is safe and appropriate for you.
            </p>
            <button class="btn btn--primary" id="fp-result-begin">[ BEGIN PROTOCOL ]</button>
        </div>
    `;

    document.getElementById('fp-result-begin').addEventListener('click', () => {
        playUIClick();
        _renderFitnessActive(container, fitnessData);
    });
}

// ─── ACTIVE PANEL ─────────────────────────────────────────────
function _renderFitnessActive(container, fitnessData) {
    const rankLabel    = FITNESS_RANK_LABELS[fitnessData.rank] || fitnessData.rank;
    const todayDirs    = getTodaysFitnessDirectives(fitnessData);
    const completedIds = fitnessData.completedIds || [];
    const allDone      = todayDirs.length > 0 &&
                         todayDirs.every(d => completedIds.includes(d.id));
    const speechAvailable = typeof window !== 'undefined' && !!window.speechSynthesis;

    const dirsHTML = allDone
        ? `<p class="fp-empty-msg" style="color:#66bb6a;opacity:0.9;">Protocol complete. Return tomorrow for your next directives.</p>`
        : todayDirs.length > 0
            ? todayDirs.map(d => _buildFitnessDirectiveCard(d, completedIds)).join('')
            : `<p class="fp-empty-msg">No directives assigned yet. Tap RESCAN to calibrate.</p>`;

    container.innerHTML = `
        <div class="fp-active-wrap">
            <div class="fp-active-header">
                <div>
                    <p class="fp-active-label">[ FITNESS PROTOCOL ]</p>
                    <p class="fp-active-rank">${fitnessData.rank} &mdash; ${rankLabel}</p>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    ${speechAvailable ? `<button class="fp-rescan-btn" id="fp-voice-btn">VOICE</button>` : ''}
                    <button class="fp-rescan-btn" id="fp-rescan-btn">RESCAN</button>
                </div>
            </div>

            ${fitnessData.modNote ? `
                <div class="fp-modnote-bar">
                    <p class="fp-modnote-bar-text">&#x26A0; ${fitnessData.modNote}</p>
                </div>
            ` : ''}

            ${speechAvailable && !allDone ? `<p class="fp-speech-note">Tap &#x1F50A; on any directive to hear the form description read aloud.</p>` : ''}

            <div class="fp-directives-list">
                ${dirsHTML}
            </div>
        </div>
    `;

    // Wire complete buttons
    container.querySelectorAll('.fp-complete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUIClick();
            _completeFitnessDirective(btn.dataset.dirId, container);
        });
    });

    // Wire speech buttons
    container.querySelectorAll('.fp-speech-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            readFormDescription(btn.dataset.formDesc);
        });
    });

    // Wire voice picker
    const voiceBtn = document.getElementById('fp-voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            playUIClick();
            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = () => _renderVoicePicker(container, fitnessData);
            } else {
                _renderVoicePicker(container, fitnessData);
            }
        });
    }

    // Wire rescan
    const rescanBtn = document.getElementById('fp-rescan-btn');
    if (rescanBtn) {
        rescanBtn.addEventListener('click', () => {
            playUIClick();
            _renderFitnessScan(container);
        });
    }
}

// ─── DIRECTIVE CARD BUILDER ───────────────────────────────────
function _buildFitnessDirectiveCard(d, completedIds) {
    const isDone         = completedIds.includes(d.id);
    const statColours    = {
        strength: 'var(--stat-str)', endurance: 'var(--stat-end)', agility: 'var(--stat-agi)'
    };
    const colour         = statColours[d.stat] || 'var(--accent)';
    const speechAvailable = typeof window !== 'undefined' && !!window.speechSynthesis;

    return `
        <div class="fp-dir-card ${isDone ? 'fp-dir-card--done' : ''}">
            <div class="fp-dir-header">
                <span class="fp-dir-stat-tag" style="color:${colour}">${(d.stat || '').toUpperCase()}</span>
                <span class="fp-dir-tier-badge">T${d.tier}</span>
                ${isDone ? '<span class="fp-dir-done-mark">&#x2713; DONE</span>' : ''}
                ${speechAvailable && d.formDesc ? `
                    <button class="fp-speech-btn" data-form-desc="${d.formDesc.replace(/"/g, '&quot;')}"
                        title="Read form description aloud">&#x1F50A;</button>
                ` : ''}
            </div>
            <p class="fp-dir-title">${d.title}</p>
            <p class="fp-dir-desc">${d.desc}</p>
            ${d.formDesc ? `
                <details class="fp-dir-details">
                    <summary class="fp-dir-details-summary">Form guide</summary>
                    <p class="fp-dir-form-desc">${d.formDesc}</p>
                </details>
            ` : ''}
            ${!isDone ? `
                <button class="fp-complete-btn" data-dir-id="${d.id}">[ MARK DONE ]</button>
            ` : ''}
        </div>
    `;
}

// ─── COMPLETE A DIRECTIVE ─────────────────────────────────────
function _completeFitnessDirective(dirId, container) {
    const fitnessData  = (typeof loadFitness === 'function') ? loadFitness() : null;
    if (!fitnessData) return;

    if (!(fitnessData.completedIds || []).includes(dirId)) {
        fitnessData.completedIds = [...(fitnessData.completedIds || []), dirId];
    }
    if (typeof saveFitness === 'function') saveFitness(fitnessData);

    if (typeof showLog === 'function') showLog('[ FITNESS DIRECTIVE COMPLETE ]', 'accent');

    // Re-render active panel
    _renderFitnessActive(container, fitnessData);
}