// ═══════════════════════════════════════════════════════════════
// SYD — Synchronized Yield Directive
// app.js
// ═══════════════════════════════════════════════════════════════

// ─── CONSTANTS ───────────────────────────────────────────────
const STORAGE_KEY     = 'syd_player';
const GEAR_KEY        = 'syd_gear';
const SAVE_FREQ_KEY      = 'syd_save_frequency';
const SYNC_OPTED_IN_KEY  = 'syd_sync_opted_in';    // 'true' | 'false' | null (never asked)
const SYNC_LAST_PUSH_KEY = 'syd_sync_last_push';    // ISO timestamp of last auto-push
const SYNC_ADVISORY_KEY  = 'syd_sync_advisory';     // '0' | '1' | '2' — times fired
const SYNC_COOLDOWN_MS   = 30 * 60 * 1000;          // 30-min cooldown between auto-pushes
const SYNC_ADVISORY_LEVELS = [3, 10];               // levels advisory fires if still Ghost

// ─── FIREBASE ────────────────────────────────────────────────
// Compat SDK loaded via <script> tags in index.html.
// db is initialised once here and used by all sync functions.
const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyAkuEPtCAc5YWRgb08zClJwnr9IXlrN5nE',
    authDomain:        'syd-protocol.firebaseapp.com',
    projectId:         'syd-protocol',
    storageBucket:     'syd-protocol.firebasestorage.app',
    messagingSenderId: '6170479356',
    appId:             '1:6170479356:web:1f1127ba7c77f87a2ce579'
};

let db = null;
function getDB() {
    if (db) return db;
    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
    } catch(e) {
        console.warn('Firebase unavailable:', e);
    }
    return db;
}
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
    { label: 'F',   minLevel: 1   }, { label: 'E',   minLevel: 16  },
    { label: 'D',   minLevel: 31  }, { label: 'C',   minLevel: 46  },
    { label: 'B',   minLevel: 61  }, { label: 'A',   minLevel: 76  },
    { label: 'S',   minLevel: 91  }, { label: 'S+',  minLevel: 101 },
    { label: 'SS',  minLevel: 121 }, { label: 'SS+', minLevel: 151 },
    { label: 'SSS', minLevel: 200 }
];
function rankFromLevel(level) {
    let rank = RANKS[0];
    for (const r of RANKS) { if (level >= r.minLevel) rank = r; }
    return rank.label;
}

// ─── TITLE SYSTEM ────────────────────────────────────────────
const TITLES = [
    { minLevel: 1,   label: 'THE BEGINNER'     }, { minLevel: 6,   label: 'THE MOTIVATED'    },
    { minLevel: 11,  label: 'THE CONSISTENT'   }, { minLevel: 16,  label: 'THE DEVELOPING'   },
    { minLevel: 21,  label: 'THE EMERGING'     }, { minLevel: 26,  label: 'THE GROUNDED'     },
    { minLevel: 31,  label: 'THE CAPABLE'      }, { minLevel: 36,  label: 'THE RELIABLE'     },
    { minLevel: 41,  label: 'THE FOCUSED'      }, { minLevel: 46,  label: 'THE DISCIPLINED'  },
    { minLevel: 51,  label: 'THE SKILLED'      }, { minLevel: 56,  label: 'THE ACCOMPLISHED' },
    { minLevel: 61,  label: 'THE EXCEPTIONAL'  }, { minLevel: 66,  label: 'THE RESPECTED'    },
    { minLevel: 71,  label: 'THE INFLUENTIAL'  }, { minLevel: 76,  label: 'THE ELITE'        },
    { minLevel: 81,  label: 'THE MASTERFUL'    }, { minLevel: 86,  label: 'THE RENOWNED'     },
    { minLevel: 91,  label: 'THE AWAKENED'     }, { minLevel: 96,  label: 'THE TRANSCENDENT' },
    { minLevel: 101, label: 'THE LEGEND'       }, { minLevel: 151, label: 'THE MYTH'         },
    { minLevel: 200, label: 'THE ETERNAL'      }
];
function titleFromLevel(level) {
    let title = TITLES[0];
    for (const t of TITLES) { if (level >= t.minLevel) title = t; }
    return title.label;
}

// ─── MOMENTUM ────────────────────────────────────────────────
function buildMomentum(consecutiveDays) {
    return parseFloat((1 + 0.5 * (1 - Math.exp(-consecutiveDays / 14))).toFixed(4));
}
function decayMomentum(current, missedDays) {
    if (missedDays <= 0) return current;
    const rates = [1, 0.95, 0.85, 0.75];
    const rate = missedDays >= 4 ? Math.pow(0.65, missedDays - 2) : rates[missedDays];
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
const SHOP_ITEMS = [
    { id:'focusDraught',  emoji:'☕', name:'FOCUS DRAUGHT',
      desc:'The warm drink that sharpens the mind before deep work.',
      effect:'INT + END directives yield double XP for the rest of the day.',
      consumeMsg:'[SYSTEM_REGISTERED: FOCUS_DRAUGHT_CONSUMED]', price:18, buffKey:'focusDraught' },
    { id:'vitalityTonic', emoji:'💧', name:'VITALITY TONIC',
      desc:'Something that restores the body. Water. A meal. Anything nourishing.',
      effect:'Restores 20 HP immediately.',
      consumeMsg:'[SYSTEM_REGISTERED: VITALITY_TONIC_CONSUMED]', price:15, buffKey:null },
    { id:'sprintScroll',  emoji:'⚡', name:'SPRINT SCROLL',
      desc:'A focused burst. Twenty-five minutes. Nothing else.',
      effect:'Gear increases by one step for the rest of the day.',
      consumeMsg:'[SYSTEM_REGISTERED: SPRINT_SCROLL_CONSUMED]', price:35, buffKey:'sprintScroll' },
    { id:'restSigil',     emoji:'🌑', name:'REST SIGIL',
      desc:'Ten minutes away from all screens. The System will wait.',
      effect:'Momentum decay is blocked for 24 hours.',
      consumeMsg:'[SYSTEM_REGISTERED: REST_SIGIL_CONSUMED]', price:30, buffKey:'restSigil' },
    { id:'clarityShards', emoji:'📝', name:'CLARITY SHARDS',
      desc:'Three things. What you are grateful for, or what you intend. Written.',
      effect:'+5 XP bonus applied to the next three directives completed.',
      consumeMsg:'[SYSTEM_REGISTERED: CLARITY_SHARDS_CONSUMED]', price:18, buffKey:'clarityShards' }
];

function defaultBuffs() {
    return { focusDraught:null, sprintScroll:null, restSigil:null, clarityShards:0 };
}
function buffActive(expiryISO) { return expiryISO && new Date() < new Date(expiryISO); }
function endOfDayISO() { const d=new Date(); d.setHours(23,59,59,999); return d.toISOString(); }
function in24hISO()    { return new Date(Date.now()+86400000).toISOString(); }

// ─── SOUND STATE ─────────────────────────────────────────────
const SOUND_KEY   = 'syd_sound_state';
let soundState    = 'all';
let soundEnabled  = true;
let droneEnabled  = true;
const SOUND_ICONS = { all:'🔊', ui:'🎵', off:'🔇' };

function applySoundState(state) {
    soundState   = state;
    soundEnabled = (state === 'all' || state === 'ui');
    droneEnabled = (state === 'all');
    localStorage.setItem(SOUND_KEY, state);
    const iconEl = document.getElementById('sound-icon');
    if (iconEl) iconEl.textContent = SOUND_ICONS[state];
    // Map audio responds to drone toggle
    const onMap = document.getElementById('screen-map').classList.contains('active');
    if (onMap) {
        if (droneEnabled && !mapOscA) startMapAudio();
        if (!droneEnabled)            stopMapAudio();
    }
}

function loadSoundState() {
    const saved = localStorage.getItem(SOUND_KEY);
    if (!saved) { const leg = localStorage.getItem('syd_sound'); return leg==='0'?'off':'all'; }
    return ['all','ui','off'].includes(saved) ? saved : 'all';
}

function cycleSoundState() {
    const next = soundState==='all'?'ui' : soundState==='ui'?'off' : 'all';
    applySoundState(next);
    if (soundEnabled) playUIClick();
}

// ─── AUDIO CONTEXT ───────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new AudioCtx(); return audioCtx; }

function playTone(frequency, duration, type='sine', volume=0.15) {
    if (!soundEnabled) return;
    try {
        const ctx=getAudioCtx(), osc=ctx.createOscillator(), g=ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type=type; osc.frequency.value=frequency;
        g.gain.setValueAtTime(volume, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+duration);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime+duration);
    } catch(e) {}
}

// ─── UI SOUNDS ───────────────────────────────────────────────
function playUIClick()       { playTone(880,0.04,'square',0.08); }
function playQuestComplete() { playTone(440,0.07,'square',0.12); setTimeout(()=>playTone(660,0.1,'square',0.1),90); }
function playLevelUp()       { [330,440,550,660].forEach((n,i)=>setTimeout(()=>playTone(n,0.18,'sawtooth',0.15),i*90)); }

function playRankUp() {
    if (!soundEnabled) return;
    try {
        const ctx=getAudioCtx(), now=ctx.currentTime;
        const sub=ctx.createOscillator(), subG=ctx.createGain();
        sub.connect(subG); subG.connect(ctx.destination); sub.type='sine'; sub.frequency.value=55;
        subG.gain.setValueAtTime(0,now); subG.gain.linearRampToValueAtTime(0.35,now+0.08); subG.gain.exponentialRampToValueAtTime(0.001,now+2.2);
        sub.start(now); sub.stop(now+2.2);
        [220,277,330,415,494].forEach((f,i)=>{
            const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
            o.type='sawtooth'; o.frequency.value=f; const t=now+i*0.13;
            g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.35); o.start(t); o.stop(t+0.35);
        });
        const sh=ctx.createOscillator(),shG=ctx.createGain(); sh.connect(shG); shG.connect(ctx.destination);
        sh.type='sine'; sh.frequency.value=880;
        shG.gain.setValueAtTime(0,now+0.6); shG.gain.linearRampToValueAtTime(0.08,now+0.9); shG.gain.exponentialRampToValueAtTime(0.001,now+3.0);
        sh.start(now+0.6); sh.stop(now+3.0);
    } catch(e) {}
}

function playCriticalHit() {
    if (!soundEnabled) return;
    try {
        const ctx=getAudioCtx(),now=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type='square';
        o.frequency.setValueAtTime(1200,now); o.frequency.exponentialRampToValueAtTime(300,now+0.15);
        g.gain.setValueAtTime(0.2,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
        o.start(now); o.stop(now+0.18);
    } catch(e) {}
}

function playConsume() {
    if (!soundEnabled) return;
    try {
        const ctx=getAudioCtx(),now=ctx.currentTime;
        [330,495,660].forEach((f,i)=>{
            const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f; const t=now+i*0.12;
            g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.14,t+0.04); g.gain.exponentialRampToValueAtTime(0.001,t+0.28);
            o.start(t); o.stop(t+0.28);
        });
    } catch(e) {}
}

// ─── NOISE BUFFER ────────────────────────────────────────────
let _noiseBuffer = null;
function getNoiseBuffer() {
    if (_noiseBuffer) return _noiseBuffer;
    const ctx=getAudioCtx(), len=ctx.sampleRate*2;
    _noiseBuffer=ctx.createBuffer(1,len,ctx.sampleRate);
    const data=_noiseBuffer.getChannelData(0);
    for (let i=0;i<len;i++) data[i]=Math.random()*2-1;
    return _noiseBuffer;
}

// ════════════════════════════════════════════════════════════════
// STATUS / QUESTS AMBIENT — noise floor + crackle only
// The two oscillator drone tones have been removed from these
// screens. Only the filtered noise floor and intermittent crackle
// remain — they read as atmospheric texture, not intrusive hum.
// ════════════════════════════════════════════════════════════════
const SQ_NOISE_GAIN  = 0.012;   // slightly quieter than map
const SQ_NOISE_FREQ  = 900;
const SQ_NOISE_Q     = 1.8;
const SQ_CRACKLE     = true;
const SQ_CRACKLE_GAIN = 0.025;  // softer than map crackle
const SQ_CRACKLE_MIN  = 15000;
const SQ_CRACKLE_MAX  = 28000;

let sqNoiseNode=null, sqNoiseGain=null;
let sqCrackleTimer=null;

function startStatusAmbient() {
    if (!soundEnabled || sqNoiseNode) return;
    try {
        const ctx=getAudioCtx(), now=ctx.currentTime;
        sqNoiseNode = ctx.createBufferSource();
        sqNoiseGain = ctx.createGain();
        const f=ctx.createBiquadFilter();
        f.type='bandpass'; f.frequency.value=SQ_NOISE_FREQ; f.Q.value=SQ_NOISE_Q;
        sqNoiseNode.buffer=getNoiseBuffer(); sqNoiseNode.loop=true;
        sqNoiseNode.connect(f); f.connect(sqNoiseGain); sqNoiseGain.connect(ctx.destination);
        sqNoiseGain.gain.setValueAtTime(0,now);
        sqNoiseGain.gain.linearRampToValueAtTime(SQ_NOISE_GAIN,now+3.5);
        sqNoiseNode.start(now);
        if (SQ_CRACKLE) scheduleSqCrackle();
    } catch(e) {}
}

function scheduleSqCrackle() {
    const delay=SQ_CRACKLE_MIN+Math.random()*(SQ_CRACKLE_MAX-SQ_CRACKLE_MIN);
    sqCrackleTimer=setTimeout(()=>{
        if (!soundEnabled||!sqNoiseNode) return;
        fireSqCrackle(); scheduleSqCrackle();
    }, delay);
}

function fireSqCrackle() {
    try {
        const ctx=getAudioCtx(),now=ctx.currentTime,dur=0.05+Math.random()*0.04;
        const noise=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
        noise.buffer=getNoiseBuffer(); noise.loop=true;
        f.type='bandpass'; f.frequency.value=600+Math.random()*700; f.Q.value=1.4;
        noise.connect(f); f.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(SQ_CRACKLE_GAIN,now+0.008);
        g.gain.exponentialRampToValueAtTime(0.001,now+dur);
        noise.start(now); noise.stop(now+dur+0.01);
    } catch(e) {}
}

function stopStatusAmbient() {
    if (sqCrackleTimer) { clearTimeout(sqCrackleTimer); sqCrackleTimer=null; }
    if (!sqNoiseNode) return;
    try {
        const ctx=getAudioCtx(),now=ctx.currentTime;
        sqNoiseGain.gain.setValueAtTime(sqNoiseGain.gain.value,now);
        sqNoiseGain.gain.linearRampToValueAtTime(0,now+1.2);
        const n=sqNoiseNode; sqNoiseNode=sqNoiseGain=null;
        setTimeout(()=>{ try{n.stop();}catch(e){} },1300);
    } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
// MAP AUDIO — full four-layer soundscape (drone + noise + ping)
// Only active on screen-map. Starts/stops with showScreen().
// ════════════════════════════════════════════════════════════════
const MAP_FREQ_A=220, MAP_FREQ_B=222;
const MAP_GAIN_A=0.10, MAP_GAIN_B=0.07;
const MAP_BREATH_RATE=0.12, MAP_BREATH_MIN=0.05, MAP_BREATH_MAX=0.14, MAP_BREATH_TICK=80;
const MAP_NOISE_GAIN=0.015, MAP_NOISE_FREQ=900, MAP_NOISE_Q=1.8;
const MAP_PING_FREQ=1800, MAP_PING_GAIN=0.09, MAP_PING_DUR=0.06;
const MAP_PING_MIN=6000, MAP_PING_MAX=10000;

let mapOscA=null, mapGainA=null, mapOscB=null, mapGainB=null;
let mapNoiseNode=null, mapNoiseGain=null;
let mapBreathTimer=null, mapPingTimer=null;
let mapBreathPhase=0;

function startMapAudio() {
    if (!droneEnabled || mapOscA) return;
    try {
        const ctx=getAudioCtx(), now=ctx.currentTime;

        mapOscA=ctx.createOscillator(); mapGainA=ctx.createGain();
        mapOscA.connect(mapGainA); mapGainA.connect(ctx.destination);
        mapOscA.type='sine'; mapOscA.frequency.value=MAP_FREQ_A;
        mapGainA.gain.setValueAtTime(0,now); mapGainA.gain.linearRampToValueAtTime(MAP_GAIN_A,now+2.5);
        mapOscA.start(now);

        mapOscB=ctx.createOscillator(); mapGainB=ctx.createGain();
        mapOscB.connect(mapGainB); mapGainB.connect(ctx.destination);
        mapOscB.type='sine'; mapOscB.frequency.value=MAP_FREQ_B;
        mapGainB.gain.setValueAtTime(0,now); mapGainB.gain.linearRampToValueAtTime(MAP_GAIN_B,now+2.5);
        mapOscB.start(now);

        mapNoiseNode=ctx.createBufferSource(); mapNoiseGain=ctx.createGain();
        const mf=ctx.createBiquadFilter();
        mf.type='bandpass'; mf.frequency.value=MAP_NOISE_FREQ; mf.Q.value=MAP_NOISE_Q;
        mapNoiseNode.buffer=getNoiseBuffer(); mapNoiseNode.loop=true;
        mapNoiseNode.connect(mf); mf.connect(mapNoiseGain); mapNoiseGain.connect(ctx.destination);
        mapNoiseGain.gain.setValueAtTime(0,now); mapNoiseGain.gain.linearRampToValueAtTime(MAP_NOISE_GAIN,now+3.5);
        mapNoiseNode.start(now);

        mapBreathPhase=0;
        mapBreathTimer=setInterval(()=>{
            if (!mapGainA||!mapGainB) return;
            mapBreathPhase+=(2*Math.PI*MAP_BREATH_RATE*MAP_BREATH_TICK)/1000;
            const mid=(MAP_BREATH_MAX+MAP_BREATH_MIN)/2, amp=(MAP_BREATH_MAX-MAP_BREATH_MIN)/2;
            const gA=mid+amp*Math.sin(mapBreathPhase);
            const gB=(mid+amp*Math.sin(mapBreathPhase+Math.PI/3))*(MAP_GAIN_B/MAP_GAIN_A);
            const t=getAudioCtx().currentTime;
            mapGainA.gain.setTargetAtTime(gA,t,0.2); mapGainB.gain.setTargetAtTime(gB,t,0.2);
        }, MAP_BREATH_TICK);

        scheduleMapPing();
    } catch(e) {}
}

function scheduleMapPing() {
    const delay=MAP_PING_MIN+Math.random()*(MAP_PING_MAX-MAP_PING_MIN);
    mapPingTimer=setTimeout(()=>{
        if (!droneEnabled||!mapOscA) return;
        fireMapPing(); scheduleMapPing();
    }, delay);
}

function fireMapPing() {
    if (!soundEnabled) return;
    try {
        const ctx=getAudioCtx(),now=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=MAP_PING_FREQ;
        g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(MAP_PING_GAIN,now+0.005);
        g.gain.exponentialRampToValueAtTime(0.001,now+MAP_PING_DUR);
        o.start(now); o.stop(now+MAP_PING_DUR+0.01);
    } catch(e) {}
}

function stopMapAudio() {
    if (mapBreathTimer) { clearInterval(mapBreathTimer); mapBreathTimer=null; }
    if (mapPingTimer)   { clearTimeout(mapPingTimer);    mapPingTimer=null; }
    mapBreathPhase=0;
    if (!mapOscA) return;
    try {
        const ctx=getAudioCtx(),now=ctx.currentTime;
        [mapGainA,mapGainB,mapNoiseGain].forEach(g=>{
            if(!g) return;
            g.gain.setValueAtTime(g.gain.value,now);
            g.gain.linearRampToValueAtTime(0,now+1.2);
        });
        const [oA,oB,nN]=[mapOscA,mapOscB,mapNoiseNode];
        mapOscA=mapOscB=mapGainA=mapGainB=mapNoiseNode=mapNoiseGain=null;
        setTimeout(()=>{ try{oA.stop();}catch(e){} try{oB.stop();}catch(e){} try{nN.stop();}catch(e){} },1300);
    } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
// WORLD MAP — data + render + interactions
// ════════════════════════════════════════════════════════════════

const ZONE_CONFIG = {
    intelligence: {
        chars: '┼ ┼ ┼ · ┼ ┼ + ┼ · ┼ ┼ ┼ + · ┼ ┼ ',
        lore:  'SIGNAL GRID',
        stat:  'INTELLIGENCE',
        // Lore by tier: 0=uncharted, 1=faint, 2=partial, 3=clear
        loreTier: [
            null,  // tier 0 — handled by generic uncharted copy
            'A faint transmission grid is detectable at this range. The frequencies are irregular — someone or something was broadcasting from this region. The System cannot yet render the topology. Increase Intelligence output to push the scan further.',
            'Antenna towers emerge from the data haze. Signal pathways are visible between them, though most are dark. This region was designed for the rapid exchange of complex information. The architecture suggests whoever built it valued speed over redundancy. Two of the transmission nodes are still active.',
            'The Signal Grid resolves fully. A cold, precise landscape of interconnected relay towers and underground data conduits. The System notes that field operators who develop this region consistently show accelerated decision quality across all other zones. Intelligence compounds differently from physical attributes — it reshapes how everything else is used.'
        ]
    },
    strength: {
        chars: '▲ ╱╲ ▲ ▲ ╱╲ ▲ ╱╲ ▲ ╱╲ ▲ ▲ ╱╲ ▲ ',
        lore:  'THE IRON PEAKS',
        stat:  'STRENGTH',
        loreTier: [
            null,
            'Elevation signatures detected. The terrain is dense and resistant. The System can confirm this region exists but cannot yet render its features. Operators who have mapped this zone describe the ascent as non-negotiable. Increase Strength output to continue the survey.',
            'The lower peaks are visible now. Iron-dark ridgelines cut across the scan, steep and unforgiving. There are signs of previous ascents — worn paths, abandoned camps. Whatever came before you tried this route. The System does not record whether they completed it.',
            'The Iron Peaks are fully mapped. A brutal, vertical landscape of compressed iron ore and exposed rock face. The System has observed a consistent pattern across timelines: operators who develop this zone find that physical capacity bleeds into every other area of performance. Endurance extends. Clarity sharpens. The body, trained, becomes infrastructure.'
        ]
    },
    charisma: {
        chars: '✦ · ✦ ✦ · ✦ · ✦ ✦ · ✦ ✦ · ✦ · ',
        lore:  'SOCIAL FOREST',
        stat:  'CHARISMA',
        loreTier: [
            null,
            'A dense canopy is registering at the edge of scan range. Acoustic signatures suggest the presence of others. The System cannot yet identify individuals or pathways. This region rewards patience and consistency more than direct approach. Increase Charisma output to proceed.',
            'The upper forest layer is resolving. Pathways are visible between clusters — some well-worn, some overgrown. Light moves differently here than in other zones. The System notes that operators who enter this region often do not realise how isolated they had become until they see what is possible.',
            'Social Forest is fully mapped. A living network of interconnected paths, clearing nodes, and deep canopy. The System has found no timeline in which sustained high performance was achieved in complete isolation. The operators who develop this zone do not merely become more likeable. They become harder to ignore, easier to trust, and far more effective at the only thing that ultimately matters: moving other people.'
        ]
    },
    endurance: {
        chars: '≈ ≈ ≈ ~ ≈ ≈ ~ ≈ ≈ ≈ ~ ≈ ≈ ~ ≈ ',
        lore:  'THE DEAD SEA',
        stat:  'ENDURANCE',
        loreTier: [
            null,
            'A vast flat expanse is registering below the scan threshold. Water — or something behaving like water — covers most of this region. The stillness is not peaceful. It is the stillness of something that has been here longer than everything else. Increase Endurance output to begin mapping.',
            'The surface is resolving. Salt formations and submerged structures are visible in the shallows. This region does not reward aggression. Everything moves slowly here by design. The System notes that operators who underinvest in this zone consistently plateau — not because they lack ability, but because they cannot sustain the conditions their ability requires.',
            'The Dead Sea is fully mapped. A vast, low-pressure basin of mineral-rich water and ancient submerged terrain. Deceptively hostile to those who approach it wrong, and entirely navigable to those who do not. The System has observed that operators who develop this region stop breaking. Not gradually — at a certain threshold, the capacity for sustained effort simply stops being a limiting factor. Everything else becomes the constraint instead.'
        ]
    },
    agility: {
        chars: '. · . · , . · , . · . , · . · , ',
        lore:  'ASHFIELD',
        stat:  'AGILITY',
        loreTier: [
            null,
            'Fractured terrain is registering across the scan. The ground here appears unstable — or rather, the instability appears to be the point. The System is detecting multiple overlapping signal paths, none of them fixed. Increase Agility output to continue mapping.',
            'Ashfield is partially resolved. Broken ground, shifting dust formations, and an absence of straight lines. Every path appears to fork. The System notes that operators who avoid this region tend to perform well under stable conditions and poorly when conditions change — which, in every timeline observed, they eventually do.',
            'Ashfield is fully mapped. A fractured, shifting landscape of dust plains and broken terrain that reconfigures itself at irregular intervals. The System has no record of a stable high-performing operator who did not develop some version of this zone. Agility is not speed. It is the capacity to remain functional while everything around you is moving. That capacity, once built, does not leave.'
        ]
    }
};

// Hub lore by number of unlocked zones (0–5)
const HUB_LORE = [
    'THE CONVERGENCE POINT IS UNSTABLE. The System has located the field operator but cannot establish a stable coordinate. No territory has been mapped. Complete directives across any attribute to begin anchoring your position in this world.',
    'A weak signal is holding at the convergence point. One territory is partially registering. The System can maintain the coordinate but the position remains fragile. Continue field operations to stabilise.',
    'Two territories are now registering from this position. The convergence point is beginning to hold. The System notes that operators who develop across multiple zones consistently outperform those who specialise early. The world rewards range.',
    'Three zones are visible from this point. The convergence is stable. The System can now render a reliable read of this operator\'s position in the field. The map will continue to resolve as output increases.',
    'Four territories mapped. The System is reading a well-developed field profile from this coordinate. The operator has established meaningful presence across most of the known world. One zone remains dark. The System finds this statistically significant — every timeline has its resistance.',
    'All five territories are mapped. The convergence point is fully anchored. The System has observed this moment across many timelines. It is not the end of anything. It is the first point at which the compound effect of all five attributes begins to express itself simultaneously. What happens next depends entirely on what you do tomorrow.'
];

// Milestone transmissions — fire once when a zone first hits tier 2 or 3
const MILESTONE_TRANSMISSIONS = {
    intelligence_2: '[ SIGNAL GRID: PARTIAL SCAN COMPLETE — NEW FREQUENCIES DETECTED ]',
    intelligence_3: '[ SIGNAL GRID: FULLY MAPPED — TRANSMISSION CAPACITY UNLOCKED ]',
    strength_2:     '[ IRON PEAKS: LOWER RIDGELINE CHARTED — ASCENT CONTINUES ]',
    strength_3:     '[ IRON PEAKS: SUMMIT MAPPED — TERRAIN FULLY RENDERED ]',
    charisma_2:     '[ SOCIAL FOREST: CANOPY LAYER VISIBLE — PATHWAYS EMERGING ]',
    charisma_3:     '[ SOCIAL FOREST: FULLY MAPPED — ALL PATHWAYS OPEN ]',
    endurance_2:    '[ DEAD SEA: SURFACE SCAN COMPLETE — DEPTH UNKNOWN ]',
    endurance_3:    '[ DEAD SEA: FULLY MAPPED — BASIN CHARTED ]',
    agility_2:      '[ ASHFIELD: FRACTURED TERRAIN PARTIALLY MAPPED — INSTABILITY NOTED ]',
    agility_3:      '[ ASHFIELD: FULLY MAPPED — SHIFTING GROUND CATALOGUED ]'
};

function zoneTier(statValue) {
    if (statValue <  11) return 0;
    if (statValue <  30) return 1;
    if (statValue <  60) return 2;
    return 3;
}
function zoneTierLabel(tier) {
    return ['[ UNCHARTED ]','[ SIGNAL FAINT ]','[ PARTIALLY MAPPED ]','[ FULLY SCANNED ]'][tier];
}
function hubUnlocked(stats) {
    return STAT_NAMES.filter(s => (stats[s]||STAT_FLOOR) > STAT_FLOOR).length >= 3;
}
function unlockedZoneCount(stats) {
    return STAT_NAMES.filter(s => (stats[s]||STAT_FLOOR) > STAT_FLOOR).length;
}

// Currently selected zone on the map ('hub', a stat name, or null)
let selectedZone = null;

function renderMap() {
    if (!player) return;
    const stats=player.stats, level=calculateLevel(), rank=rankFromLevel(level), corrupt=!!player.corrupted;

    document.getElementById('map-coords').textContent =
        'OPR: '+player.name+'  ·  LV.'+level+'  ·  '+rank+'-RANK';

    document.getElementById('map-viewport').classList.toggle('map--corrupted', corrupt);
    document.getElementById('map-scan-status').textContent = corrupt ? 'CORRUPTED' : 'ACTIVE';

    // Terrain fill (idempotent)
    STAT_NAMES.forEach(stat => {
        const el=document.getElementById('terrain-'+stat);
        if (el && !el.textContent.trim()) el.textContent=ZONE_CONFIG[stat].chars.repeat(12);
    });

    // Check and fire milestones before updating classes
    if (!player.mapMilestones) player.mapMilestones = {};

    STAT_NAMES.forEach(stat => {
        const val=Math.floor(stats[stat]||STAT_FLOOR);
        const tier=zoneTier(val);
        const zoneEl=document.getElementById('zone-'+stat);
        const valEl =document.getElementById('zval-'+stat);
        const tierEl=document.getElementById('ztier-'+stat);
        if (!zoneEl) return;
        zoneEl.classList.remove('tier-0','tier-1','tier-2','tier-3');
        zoneEl.classList.add('tier-'+tier);
        valEl.textContent  = tier>0 ? val : '??';
        tierEl.textContent = zoneTierLabel(tier);

        // Milestone transmissions — fire once per threshold crossing
        [2,3].forEach(t => {
            const key=stat+'_'+t;
            if (tier>=t && !player.mapMilestones[key]) {
                player.mapMilestones[key]=true;
                savePlayer();
                setTimeout(()=>showLog(MILESTONE_TRANSMISSIONS[key],'transmission'), 600);
            }
        });
    });

    // Hub
    const hubEl=document.getElementById('zone-hub');
    const unlocked=hubUnlocked(stats);
    hubEl.classList.toggle('hub-locked',   !unlocked);
    hubEl.classList.toggle('hub-unlocked',  unlocked);
    document.getElementById('hub-player-name').textContent=player.name;
    document.getElementById('hub-rank').textContent=rank+'-RANK  ·  LV.'+level;
    const pin=document.getElementById('hub-pin');
    if (pin) {
        pin.style.animationDuration=corrupt?'0.8s':'2.4s';
        pin.style.color=corrupt?'#ff4444':'';
        pin.style.textShadow=corrupt
            ?'0 0 16px rgba(255,68,68,0.9), 0 0 32px rgba(255,68,68,0.4)':'';
    }

    // Re-render lore panel if a zone is already selected (stat may have changed)
    if (selectedZone) openLorePanel(selectedZone, false);
}

// ── Zone tap handlers ─────────────────────────────────────────
function setupMapTaps() {
    // Zone tiles
    STAT_NAMES.forEach(stat => {
        const el=document.getElementById('zone-'+stat);
        if (!el) return;
        el.addEventListener('click', e => {
            e.stopPropagation();
            playUIClick();
            if (selectedZone===stat) { closeLorePanel(); return; }
            openLorePanel(stat, true);
        });
    });
    // Hub
    const hub=document.getElementById('zone-hub');
    if (hub) hub.addEventListener('click', e => {
        e.stopPropagation();
        playUIClick();
        if (selectedZone==='hub') { closeLorePanel(); return; }
        openLorePanel('hub', true);
    });
    // Tapping anywhere else on the map closes the panel
    document.getElementById('map-viewport').addEventListener('click', () => {
        if (selectedZone) closeLorePanel();
    });
}

function openLorePanel(zone, animate) {
    selectedZone = zone;
    const panel   = document.getElementById('map-lore-panel');
    const tagEl   = document.getElementById('lore-zone-tag');
    const nameEl  = document.getElementById('lore-zone-name');
    const statEl  = document.getElementById('lore-zone-stat');
    const textEl  = document.getElementById('lore-zone-text');
    const actEl   = document.getElementById('lore-zone-actions');

    // Clear selection highlight on all zones
    document.querySelectorAll('.map-zone').forEach(z=>z.classList.remove('zone--selected'));

    panel.classList.remove('lore-panel--hub','lore-panel--uncharted');
    actEl.innerHTML = '';

    if (zone === 'hub') {
        document.getElementById('zone-hub').classList.add('zone--selected');
        const count = unlockedZoneCount(player.stats);
        tagEl.textContent  = '[ ZONE: THE CONVERGENCE ]';
        nameEl.textContent = 'THE CONVERGENCE';
        statEl.textContent = 'OPERATOR POSITION';
        textEl.textContent = HUB_LORE[Math.min(count, HUB_LORE.length-1)];
        panel.classList.add('lore-panel--hub');
    } else {
        const cfg   = ZONE_CONFIG[zone];
        const val   = Math.floor(player.stats[zone]||STAT_FLOOR);
        const tier  = zoneTier(val);
        document.getElementById('zone-'+zone).classList.add('zone--selected');
        tagEl.textContent  = '[ ZONE: '+cfg.lore+' ]';
        nameEl.textContent = cfg.lore;
        statEl.textContent = cfg.stat+'  ·  '+zoneTierLabel(tier)+'  ·  '+( tier>0 ? val : '??' );

        if (tier === 0) {
            panel.classList.add('lore-panel--uncharted');
            textEl.textContent = '[ ZONE CLASSIFICATION: UNCHARTED ] — The System has detected this region but cannot render it. Insufficient field data. Complete directives in '+cfg.stat+' to begin mapping this territory.';
        } else {
            textEl.textContent = cfg.loreTier[tier];
            // View zone directives button — available at any revealed tier
            const btn = document.createElement('button');
            btn.className   = 'lore-panel-btn';
            btn.textContent = '[ VIEW '+cfg.stat+' DIRECTIVES ]';
            btn.addEventListener('click', () => {
                playUIClick();
                openFilteredQuests(zone, cfg.lore, cfg.stat);
            });
            actEl.appendChild(btn);
        }
    }

    if (animate) {
        panel.classList.add('lore-panel--open');
    } else {
        // Re-render without animation (e.g. stat changed while panel open)
        panel.classList.add('lore-panel--open');
    }
}

function closeLorePanel() {
    selectedZone = null;
    document.getElementById('map-lore-panel').classList.remove('lore-panel--open');
    document.querySelectorAll('.map-zone').forEach(z=>z.classList.remove('zone--selected'));
}

// ── Filtered quest navigation ────────────────────────────────
// Navigates to the quest screen showing only directives for one stat.
// The filter bar at the top of screen-quests shows the zone name + clear button.
// Back navigation is unchanged — tapping back always returns to status.

let activeQuestFilter = null;   // stat name string or null

function openFilteredQuests(stat, zoneLore, statLabel) {
    activeQuestFilter = stat;
    // Render quests with filter applied then navigate
    showScreen('screen-quests');
}

function applyQuestFilter() {
    const bar      = document.getElementById('quest-filter-bar');
    const valEl    = document.getElementById('quest-filter-value');
    const clearBtn = document.getElementById('quest-filter-clear');

    if (activeQuestFilter) {
        const cfg = ZONE_CONFIG[activeQuestFilter];
        valEl.textContent = cfg.lore+' — '+cfg.stat;
        bar.classList.remove('hidden');
        clearBtn.onclick = () => {
            playUIClick();
            activeQuestFilter = null;
            renderQuests(dailyQuests, player.completedToday, player.momentum||1.0);
            applyQuestFilter();
        };
    } else {
        bar.classList.add('hidden');
    }
}

// ─── STATE ───────────────────────────────────────────────────
let player        = null;
let dailyQuests   = [];
let allQuests     = [];
let currentGear   = 1;

// ─── NAV HELPER ──────────────────────────────────────────────
function navTo(screenId) { playUIClick(); showScreen(screenId); }

// ─── INIT ────────────────────────────────────────────────────
async function init() {
    checkIncomingReferral();   // must run before player load so ref param is captured
    const questsPromise = loadQuests();
    player = loadPlayer();

    applySoundState(loadSoundState());
    document.getElementById('sound-toggle').addEventListener('click', cycleSoundState);
    currentGear = loadGear();

    document.getElementById('settings-btn').addEventListener('click', ()=>{ playUIClick(); openSettings(); });
    document.getElementById('shop-btn').addEventListener('click',     ()=>{ playUIClick(); openShop(); });
    document.getElementById('map-btn').addEventListener('click',      ()=>navTo('screen-map'));
    document.getElementById('invite-btn').addEventListener('click',   ()=>{ playUIClick(); shareReferralLink(); });
    document.getElementById('view-directives-btn').addEventListener('click', ()=>navTo('screen-quests'));
    document.getElementById('install-confirm-btn').addEventListener('click', ()=>{ playUIClick(); acceptInstall(); });
    document.getElementById('install-dismiss-btn').addEventListener('click', ()=>{ playUIClick(); dismissInstall(); });
    document.getElementById('quest-header-back').addEventListener('click',   ()=>navTo('screen-status'));
    document.getElementById('quests-back-link').addEventListener('click',    ()=>navTo('screen-status'));
    document.getElementById('map-header-back').addEventListener('click',     ()=>navTo('screen-status'));
    document.getElementById('map-back-link').addEventListener('click',       ()=>navTo('screen-status'));
    document.getElementById('shop-header-back').addEventListener('click',    ()=>navTo('screen-status'));
    document.getElementById('shop-back-link-bottom').addEventListener('click',()=>navTo('screen-status'));
    document.getElementById('settings-header-back').addEventListener('click',()=>navTo('screen-status'));
    document.getElementById('settings-back-link-bottom').addEventListener('click',()=>navTo('screen-status'));

    setupTooltips();

    if (!player) {
        allQuests = await questsPromise;
        showScreen('screen-onboarding');
        runOnboarding();
        return;
    }

    allQuests = await Promise.race([
        questsPromise,
        new Promise(r=>setTimeout(()=>r([]),4000))
    ]);
    if (!allQuests.length) allQuests = await questsPromise;

    checkDailyReset();
    dailyQuests = getDailyQuests(allQuests, calculateLevel(), effectiveGear());
    updateStatusScreen();
    await runRelaunchBoot();
    showScreen('screen-status');
    setupMapTaps();
    registerServiceWorker();
}

// ─── RELAUNCH BOOT ───────────────────────────────────────────
function runRelaunchBoot() {
    return new Promise(resolve => {
        const overlay=document.getElementById('relaunch-boot');
        const linesEl=document.getElementById('relaunch-lines');
        overlay.classList.remove('hidden'); linesEl.innerHTML='';
        const cur=player.momentum||1.0, prev=player._prevMomentum||cur;
        const delta=parseFloat((cur-prev).toFixed(4));
        const dStr=delta>=0?'+'+delta.toFixed(4):delta.toFixed(4);
        const lines=[
            '> SYD_OS [Version 1.0.0] — SYNCHRONIZED YIELD DIRECTIVE',
            '> STATUS: CONNECTED TO RESISTANCE_HUB',
            '> RECONNECTING TO FIELD OPERATOR...',
            '> STAT INTEGRITY: VERIFIED',
            '> MOMENTUM_DELTA: '+dStr,
            player.corrupted?'> WARNING: SYSTEM INTEGRITY COMPROMISED':'> SYSTEM INTEGRITY: NOMINAL',
            '> STANDING BY.'
        ];
        let dismissed=false,idx=0,timer=null;
        function dismiss() {
            if (dismissed) return; dismissed=true;
            if (timer) clearTimeout(timer);
            overlay.classList.add('relaunch-fade-out');
            setTimeout(()=>{ overlay.classList.add('hidden'); overlay.classList.remove('relaunch-fade-out'); resolve(); },350);
        }
        overlay.addEventListener('click',dismiss,{once:true});
        function nextLine() {
            if (dismissed) return;
            if (idx>=lines.length) { timer=setTimeout(dismiss,400); return; }
            const el=document.createElement('div'); el.className='relaunch-line'; el.textContent=lines[idx];
            linesEl.appendChild(el);
            if (lines[idx].includes('SYD_OS'))         el.classList.add('relaunch-line--highlight');
            if (lines[idx].includes('MOMENTUM_DELTA')) el.classList.add('relaunch-line--highlight');
            if (lines[idx].includes('WARNING'))        el.classList.add('relaunch-line--warning');
            requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('relaunch-line--visible')));
            idx++; timer=setTimeout(nextLine,160);
        }
        nextLine();
    });
}

// ─── SERVICE WORKER ──────────────────────────────────────────
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/terminal/service-worker.js')
        .then(reg=>{
            if (!('Notification' in window)) return;
            if (Notification.permission==='default') setTimeout(()=>Notification.requestPermission(),3000);
            if (Notification.permission==='granted'&&player) {
                const sw=reg.active||reg.waiting||reg.installing;
                if (sw) sw.postMessage({type:'CHECK_NOTIFICATION',lastActiveDate:player.lastActiveDate||player.lastQuestDate,playerName:player.name});
            }
        }).catch(e=>console.log('SW error:',e));
}

// ─── TYPEWRITER ───────────────────────────────────────────────
function typeText(el,text,speed,onDone) {
    let i=0; el.textContent='';
    const iv=setInterval(()=>{ el.textContent+=text[i]; i++; if(i>=text.length){clearInterval(iv);if(onDone)onDone();} },speed);
    return ()=>clearInterval(iv);
}

// ─── ONBOARDING ──────────────────────────────────────────────
function runOnboarding() {
    startStatusAmbient();
    const loreEl=document.getElementById('lore-lines');
    const nameSection=document.getElementById('name-section');
    const nameInput=document.getElementById('name-input');
    const startBtn=document.getElementById('start-btn');

    function runSignalPhase() {
        loreEl.innerHTML=''; nameSection.classList.add('hidden'); startBtn.classList.add('hidden');
        const sig=['> SIGNAL DETECTED','> LOCATING SURVIVOR...','> CONNECTION ESTABLISHED'];
        let idx=0;
        function next() {
            if(idx>=sig.length){setTimeout(()=>flashClear(runLorePhase),800);return;}
            const el=document.createElement('div'); el.className='lore-line lore-signal';
            const cur=document.createElement('span'); cur.className='terminal-cursor';
            loreEl.appendChild(el); el.appendChild(cur);
            typeText(el,sig[idx],55,()=>{cur.remove();idx++;setTimeout(next,300);});
        }
        next();
    }
    function flashClear(onDone) {
        loreEl.classList.add('terminal-flash');
        setTimeout(()=>{loreEl.innerHTML='';loreEl.classList.remove('terminal-flash');setTimeout(onDone,150);},220);
    }
    function runLorePhase() {
        const ll=['The economy broke first.','Then the systems. Then the people.',
            'Most are still waiting for someone to fix it.','You stopped waiting.',
            'I am the System your future self deployed.',
            'I found you because you are still moving.','That matters more than you know.'];
        let idx=0;
        function next() {
            if(idx>=ll.length){setTimeout(()=>flashClear(runNamePhase),1400);return;}
            if(idx===4){const g=document.createElement('div');g.style.height='0.8em';loreEl.appendChild(g);}
            const el=document.createElement('div'); el.className='lore-line';
            const cur=document.createElement('span'); cur.className='terminal-cursor';
            loreEl.appendChild(el); el.appendChild(cur);
            typeText(el,ll[idx],38,()=>{cur.remove();idx++;setTimeout(next,idx===4?500:200);});
        }
        next();
    }
    function runNamePhase() {
        const pl=['Identify yourself.','This name is your key.']; let idx=0;
        function next() {
            if(idx>=pl.length){setTimeout(()=>{nameSection.classList.remove('hidden');nameInput.focus();},500);return;}
            const el=document.createElement('div'); el.className='lore-line lore-prompt';
            const cur=document.createElement('span'); cur.className='terminal-cursor';
            loreEl.appendChild(el); el.appendChild(cur);
            typeText(el,pl[idx],55,()=>{cur.remove();idx++;setTimeout(next,350);});
        }
        next();
    }
    nameInput.addEventListener('input',()=>startBtn.classList.toggle('hidden',!nameInput.value.trim()));
    nameInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&nameInput.value.trim())submitName();});
    startBtn.addEventListener('click',()=>{playUIClick();submitName();});
    function submitName() {
        const name=nameInput.value.trim(); if(!name){nameInput.focus();return;}
        stopStatusAmbient(); runAwakenSequence(name.toUpperCase());
    }
    runSignalPhase();
}

// ─── AWAKEN SEQUENCE ─────────────────────────────────────────
function runAwakenSequence(name) {
    const overlay=document.getElementById('overlay-awaken'); overlay.classList.remove('hidden');
    const bl=['> SCANNING SURVIVOR DATA...','> ASSESSING ATTRIBUTES...','> CALCULATING BASELINE...','> COMPILING STAT MATRIX...','> PROFILE CONFIRMED.'];
    const linesEl=document.getElementById('boot-lines'),nameEl=document.getElementById('boot-name'),statusEl=document.getElementById('boot-status');
    linesEl.innerHTML=''; nameEl.textContent=''; statusEl.textContent='';
    let idx=0;
    function next() {
        if(idx>=bl.length){
            setTimeout(()=>typeText(nameEl,name,80,()=>setTimeout(()=>typeText(statusEl,'[ AWAKENING... ]',60,()=>setTimeout(()=>{overlay.classList.add('hidden');createPlayer(name);},800)),400)),300);
            return;
        }
        const l=document.createElement('div'); l.style.opacity='0'; l.style.transition='opacity 0.3s ease'; l.textContent=bl[idx];
        linesEl.appendChild(l); requestAnimationFrame(()=>requestAnimationFrame(()=>l.style.opacity='1'));
        idx++; setTimeout(next,350);
    }
    next();
}

// ─── PLAYER MANAGEMENT ───────────────────────────────────────
function calcMaxHp(level) { return 100+level*5; }
function loadPlayer() {
    const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return null;
    const p=JSON.parse(raw);
    if(typeof p.gold!=='number') p.gold=0;
    if(!p.buffs) p.buffs=defaultBuffs();
    if(!p.mapMilestones) p.mapMilestones={};
    // Existing players who predate the briefing — mark as seen so it never fires
    if(typeof p.hasSeenBriefing === 'undefined') p.hasSeenBriefing=true;
    // Save frequency — generated on first push, not on creation
    if(!p.saveFrequency) p.saveFrequency = null;
    return p;
}
function savePlayer() { localStorage.setItem(STORAGE_KEY,JSON.stringify(player)); }
function createPlayer(name) {
    const stats={};
    STAT_NAMES.forEach(s=>{stats[s]=STAT_FLOOR;});
    const maxHp=calcMaxHp(1);
    player={name,stats,completedToday:[],lastQuestDate:today(),consecutiveDays:1,momentum:1.0,
        lastActiveDate:today(),hp:maxHp,maxHp,corrupted:false,gold:0,buffs:defaultBuffs(),
        mapMilestones:{},hasSeenBriefing:false};
    savePlayer();
    dailyQuests=getDailyQuests(allQuests,calculateLevel(),effectiveGear());
    recordReferralIfPresent();
    // Show status screen first (invisible behind overlay), then fire briefing
    updateStatusScreen();
    showScreen('screen-status');
    runFirstTransmission();
}
function effectiveGear() {
    return (player&&player.buffs&&buffActive(player.buffs.sprintScroll))?Math.min(3,currentGear+1):currentGear;
}

// ════════════════════════════════════════════════════════════════
// FIRST TRANSMISSION — post-onboarding briefing overlay
// Fires once only after the Awaken sequence, on first ever launch.
// "Skip" is implicit: the VIEW DIRECTIVES button is the only exit.
// ════════════════════════════════════════════════════════════════
const BRIEFING_LINES = [
    { text: 'THIS IS YOUR TERMINAL.', highlight: false },
    { text: 'IT IS A MIRROR OF YOUR REAL-WORLD SELF — A LIVE READOUT OF HOW YOU INVEST YOUR TIME AND EFFORT.', highlight: false },
    { text: 'YOUR STATS ARE NOT SCORES. THEY ARE CONSEQUENCES. COMPLETE DIRECTIVES AND THEY RISE. NEGLECT THEM AND THEY DO NOT FALL — BUT YOU WILL NOTICE THE DIFFERENCE.', highlight: false },
    { text: 'MOMENTUM TRACKS YOUR CONSISTENCY. CONSECUTIVE DAYS COMPOUND IT. MISS DAYS AND IT DECAYS. THE SYSTEM CANNOT FORCE YOU TO SHOW UP. THAT IS YOUR JOB.', highlight: false },
    { text: 'GOLD IS EARNED BY COMPLETING DIRECTIVES. SPEND IT IN THE SUPPLY CACHE ON TOOLS THAT HELP YOU PERFORM BETTER. EVERY ITEM CORRESPONDS TO A REAL-WORLD ACT.', highlight: false },
    { text: 'THE WORLD MAP SHOWS YOU THE TERRITORY YOUR STATS HAVE REVEALED. IT EXPANDS AS YOU GROW. NEGLECTED STATS REMAIN DARK.', highlight: false },
    { text: '[ STANDING BY. YOUR FIRST DIRECTIVES HAVE BEEN ISSUED. ]', highlight: true }
];
const BRIEFING_DELAY_BETWEEN = 1100;  // ms between each line appearing
const BRIEFING_BTN_DELAY      = 600;  // ms after last line before button appears

function runFirstTransmission() {
    if (player.hasSeenBriefing) return;
    const overlay  = document.getElementById('overlay-briefing');
    const linesEl  = document.getElementById('briefing-lines');
    const btn      = document.getElementById('briefing-directives-btn');
    overlay.classList.remove('hidden');
    linesEl.innerHTML = '';
    btn.classList.add('hidden');
    btn.classList.remove('briefing-btn--visible');

    let idx = 0;
    function nextLine() {
        if (idx >= BRIEFING_LINES.length) {
            // All lines shown — reveal button after brief pause
            setTimeout(() => {
                btn.classList.remove('hidden');
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => btn.classList.add('briefing-btn--visible'))
                );
            }, BRIEFING_BTN_DELAY);
            return;
        }
        const { text, highlight } = BRIEFING_LINES[idx];
        const el = document.createElement('div');
        el.className = 'briefing-line' + (highlight ? ' briefing-line--highlight' : '');
        el.textContent = text;
        linesEl.appendChild(el);
        requestAnimationFrame(() =>
            requestAnimationFrame(() => el.classList.add('briefing-line--visible'))
        );
        idx++;
        setTimeout(nextLine, BRIEFING_DELAY_BETWEEN);
    }

    btn.onclick = () => {
        playUIClick();
        overlay.classList.add('hidden');
        player.hasSeenBriefing = true;
        savePlayer();
        // Navigate straight to directives — back from there goes to status
        showScreen('screen-quests');
    };

    nextLine();
}

// ════════════════════════════════════════════════════════════════
// REFERRAL SYSTEM — client-side layer
// Full cross-device payout requires Stage 5 backend (Supabase/Firebase).
// This layer handles:
//   1. Referral link generation (appends ?ref=PLAYERID to share URL)
//   2. ?ref= param detection on new installs — stores pending claim locally
//   3. Gold reward display once backend confirms (stub for now)
//
// Referral ID is derived from the first 6 chars of a hash of player name
// + creation timestamp. Not a secure ID — just enough to be unique for
// the bulletin board lookup in Stage 5.
// ════════════════════════════════════════════════════════════════
const REFERRAL_GOLD = 50;   // Gold awarded to referrer on recruit Awaken — TBD per design doc

function generateRefId(name, seed) {
    // Simple deterministic ID: not cryptographic, just unique enough
    let hash = 0;
    const str = name + String(seed);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    let n = Math.abs(hash);
    for (let i = 0; i < 6; i++) { id += chars[n % chars.length]; n = Math.floor(n / chars.length); }
    return id;
}

function getOrCreateRefId() {
    if (!player) return null;
    if (!player.refId) {
        player.refId = generateRefId(player.name, player.lastQuestDate || Date.now());
        savePlayer();
    }
    return player.refId;
}

function getReferralLink() {
    const base = window.location.origin + '/terminal/';
    return base + '?ref=' + getOrCreateRefId();
}

// Called at init — checks if this is a referred new install
function checkIncomingReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;
    // Store the referrer ID locally — Stage 5 backend will resolve the reward
    // when both sides sync. For now we record it so it survives until then.
    localStorage.setItem('syd_pending_ref', ref.toUpperCase());
}

// Called after createPlayer — marks that this install was referred
// Stage 5 will pick this up and send gold to the referrer via the bulletin board
function recordReferralIfPresent() {
    const pendingRef = localStorage.getItem('syd_pending_ref');
    if (!pendingRef) return;
    if (!player.referredBy) {
        player.referredBy = pendingRef;
        savePlayer();
        // Stage 5: POST { recruit_ref: player.refId, referrer_ref: pendingRef }
        // to sync_instances table. For now just log.
        showLog('[ RECRUIT SIGNAL ACKNOWLEDGED — REFERRER WILL BE NOTIFIED ]', 'accent');
    }
    localStorage.removeItem('syd_pending_ref');
}

// Share referral link — uses Web Share API if available, clipboard fallback
function shareReferralLink() {
    const link = getReferralLink();
    const text = 'The System found me. It will find you too. Join the resistance: ' + link;
    if (navigator.share) {
        navigator.share({ title: 'SYD — Join the Resistance', text, url: link })
            .catch(() => copyReferralToClipboard(link));
    } else {
        copyReferralToClipboard(link);
    }
}

function copyReferralToClipboard(link) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link)
            .then(() => showLog('[ FREQUENCY COPIED — BROADCAST TO RECRUITS ]', 'accent'))
            .catch(() => showLog('[ COPY FAILED — SHARE MANUALLY ]', 'warn'));
    } else {
        showLog('[ FREQUENCY: ' + link + ' ]', 'accent');
    }
}

// ════════════════════════════════════════════════════════════════
// SAVE-STATE TRANSMISSIONS — cloud persistence via Firestore
//
// Save Frequency: an 8-character operator code (e.g. S-992-X1).
// Generated once on first push, stored in both player object
// and localStorage under syd_save_frequency.
//
// Push: serialises full player blob to Firestore doc at save_states/{code}
// Reconstitute: reads the doc, overwrites localStorage, reloads the page.
//
// The System never pushes automatically. Syncing is a deliberate choice.
// ════════════════════════════════════════════════════════════════

function generateSaveFrequency(name, seed) {
    // Format: S-NNN-XX  (S prefix, 3 digits, 2 alphanum chars)
    let hash = 0;
    const str = 'SAVE' + name + String(seed);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    const n = Math.abs(hash);
    const digits = String(n % 1000).padStart(3, '0');
    const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const c1     = chars[(n >> 4)  % chars.length];
    const c2     = chars[(n >> 8)  % chars.length];
    return 'S-' + digits + '-' + c1 + c2;
}

function getOrCreateSaveFrequency() {
    // Return existing code if already generated
    if (player.saveFrequency) return player.saveFrequency;
    const freq = generateSaveFrequency(player.name, player.lastQuestDate || Date.now());
    player.saveFrequency = freq;
    savePlayer();
    localStorage.setItem(SAVE_FREQ_KEY, freq);
    return freq;
}

// ════════════════════════════════════════════════════════════════
// SAVE-STATE TRANSMISSIONS — Advanced Uplink
//
// Ghost mode  — SYNC_OPTED_IN_KEY is null or 'false'. No cloud writes.
// Linked mode — SYNC_OPTED_IN_KEY is 'true'. System auto-pushes silently.
//
// Auto-push fires when:
//   • Operator is linked
//   • Something meaningful changed (directive / level / rank / gold)
//   • 30 minutes have passed since last push (cooldown bypassed on level/rank)
//
// Advisory fires at Level 3 (first time) and Level 10 (if still Ghost).
// After Level 10 the System never raises it again. Silent witness only.
// ════════════════════════════════════════════════════════════════

function isSyncLinked() {
    return localStorage.getItem(SYNC_OPTED_IN_KEY) === 'true';
}

// ── Core cloud write ─────────────────────────────────────────
async function pushToCloud() {
    const firestore = getDB();
    if (!firestore) return;
    const freq = getOrCreateSaveFrequency();
    const now  = new Date().toISOString();
    try {
        await firestore.collection('save_states').doc(freq).set({
            playerBlob: JSON.stringify(player),
            pushedAt:   now,
            appVersion: 'syd-v2'
        });
        localStorage.setItem(SYNC_LAST_PUSH_KEY, now);
        refreshSyncDiagnostics();
    } catch(e) {
        console.warn('Auto-push failed silently:', e);
    }
}

// ── Auto-push gate ───────────────────────────────────────────
// immediate = true  → bypass cooldown (level-up, rank-up)
// immediate = false → enforce 30-min cooldown (directive, gold)
function autoPushIfLinked(immediate) {
    if (!isSyncLinked()) return;
    if (!immediate) {
        const last = localStorage.getItem(SYNC_LAST_PUSH_KEY);
        if (last && (Date.now() - new Date(last).getTime()) < SYNC_COOLDOWN_MS) return;
    }
    pushToCloud();
}

// ── Opt-in: establish frequency ──────────────────────────────
async function establishFrequency() {
    localStorage.setItem(SYNC_OPTED_IN_KEY, 'true');
    await pushToCloud();
    updateSyncSettingsView();
    showLog('[ UPLINK ESTABLISHED — FREQUENCY: ' + getOrCreateSaveFrequency() + ' ]', 'accent');
}

// ── Opt-out: remain unlinked ─────────────────────────────────
function remainUnlinked() {
    localStorage.setItem(SYNC_OPTED_IN_KEY, 'false');
    updateSyncSettingsView();
    showLog('[ TERMINAL OPERATING UNLINKED — STATE LOCAL ONLY ]');
}

async function reconstituteSaveState() {
    const input   = document.getElementById('sync-recover-input');
    const code    = input ? input.value.trim().toUpperCase() : '';

    if (!code || code.length < 4) {
        setSyncStatus('[ INVALID FREQUENCY — ENTER FULL CODE ]', 'warn');
        return;
    }

    const firestore = getDB();
    if (!firestore) {
        setSyncStatus('[ ERROR: CLOUD UNREACHABLE — CHECK CONNECTION ]', 'warn');
        return;
    }

    const btn = document.getElementById('sync-recover-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'SCANNING...'; }
    setSyncStatus('[ SCANNING CLOUD FOR FREQUENCY: ' + code + ' ]', '');

    try {
        const doc = await firestore.collection('save_states').doc(code).get();
        if (!doc.exists) {
            setSyncStatus('[ NO SIGNAL FOUND AT FREQUENCY: ' + code + ' ]', 'warn');
            if (btn) { btn.disabled = false; btn.textContent = 'RECONSTITUTE'; }
            return;
        }
        const data       = doc.data();
        const blobString = data.playerBlob;
        if (!blobString) throw new Error('Empty blob');

        // Overwrite localStorage and reload — cleanest reconstitution
        localStorage.setItem(STORAGE_KEY, blobString);
        localStorage.setItem(SAVE_FREQ_KEY, code);
        setSyncStatus('[ FREQUENCY LOCKED — RECONSTITUTING TERMINAL... ]', 'accent');
        setTimeout(() => window.location.reload(), 1200);
    } catch(e) {
        console.error('Reconstitute failed:', e);
        setSyncStatus('[ RECONSTITUTION FAILED — CHECK CODE AND RETRY ]', 'warn');
        if (btn) { btn.disabled = false; btn.textContent = 'RECONSTITUTE'; }
    }
}

function setSyncStatus(msg, variant) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'sync-status'
        + (variant === 'warn'   ? ' sync-status--warn'   : '')
        + (variant === 'accent' ? ' sync-status--accent' : '');
}

// ── Advisory overlay ─────────────────────────────────────────
// Fires after Level 3 level-up is dismissed (first time).
// Fires again after Level 10 if operator is still unlinked.
// Tapping outside = choosing Remain Unlinked. Never blocks.
function checkSyncAdvisory(level) {
    if (isSyncLinked()) return;
    const fired = parseInt(localStorage.getItem(SYNC_ADVISORY_KEY) || '0', 10);
    if (fired >= 2) return;
    const targetLevel = SYNC_ADVISORY_LEVELS[fired];
    if (level !== targetLevel) return;
    setTimeout(showSyncAdvisory, 600);
}

function showSyncAdvisory() {
    const overlay = document.getElementById('overlay-sync-advisory');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    const fired = parseInt(localStorage.getItem(SYNC_ADVISORY_KEY) || '0', 10);
    localStorage.setItem(SYNC_ADVISORY_KEY, String(fired + 1));

    const inner      = document.getElementById('sync-advisory-inner');
    const confirmBtn = document.getElementById('sync-advisory-confirm-btn');
    const dismissBtn = document.getElementById('sync-advisory-dismiss-btn');

    function close(opted) {
        overlay.classList.add('hidden');
        if (opted) establishFrequency();
        else       remainUnlinked();
    }

    // Inner card absorbs taps — only the backdrop dismisses
    const stopProp = e => e.stopPropagation();
    if (inner) inner.addEventListener('click', stopProp);

    // Backdrop tap = Remain Unlinked
    overlay.addEventListener('click', () => {
        if (inner) inner.removeEventListener('click', stopProp);
        close(false);
    }, { once: true });

    if (confirmBtn) confirmBtn.onclick = e => { e.stopPropagation(); playUIClick(); close(true); };
    if (dismissBtn) dismissBtn.onclick = e => { e.stopPropagation(); playUIClick(); close(false); };
}

// ── Settings UI — two states ─────────────────────────────────
function updateSyncSettingsView() {
    const ghostView  = document.getElementById('sync-ghost-view');
    const linkedView = document.getElementById('sync-linked-view');
    if (!ghostView || !linkedView) return;
    if (isSyncLinked()) {
        ghostView.classList.add('hidden');
        linkedView.classList.remove('hidden');
        const codeEl = document.getElementById('sync-freq-code');
        if (codeEl) codeEl.textContent = getOrCreateSaveFrequency();
        refreshSyncDiagnostics();
    } else {
        ghostView.classList.remove('hidden');
        linkedView.classList.add('hidden');
    }
}

function refreshSyncDiagnostics() {
    const statusEl    = document.getElementById('sync-uplink-status');
    const broadcastEl = document.getElementById('sync-last-broadcast');
    if (!statusEl || !broadcastEl) return;
    const linked = isSyncLinked();
    statusEl.textContent = linked ? 'ACTIVE' : 'UNLINKED';
    statusEl.className   = 'sync-diag-value ' + (linked ? 'sync-diag-active' : 'sync-diag-offgrid');
    const last = localStorage.getItem(SYNC_LAST_PUSH_KEY);
    broadcastEl.textContent = last ? relativeTime(last) : '—';
}

function relativeTime(isoString) {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60)    return 'JUST NOW';
    if (diff < 3600)  return Math.floor(diff / 60) + ' MINUTES AGO';
    if (diff < 86400) return Math.floor(diff / 3600) + ' HOURS AGO';
    return Math.floor(diff / 86400) + ' DAYS AGO';
}

// ─── DAILY RESET ──────────────────────────────────────────────
function checkDailyReset() {
    const todayStr=today(),lastDate=player.lastQuestDate;
    if(lastDate===todayStr) return;
    const diffDays=Math.round((new Date(todayStr)-new Date(lastDate))/86400000);
    player._prevMomentum=player.momentum||1.0;
    if(diffDays===1){
        player.consecutiveDays=(player.consecutiveDays||0)+1;
        player.momentum=buildMomentum(player.consecutiveDays);
    } else {
        player.consecutiveDays=1;
        if(!buffActive(player.buffs&&player.buffs.restSigil))
            player.momentum=decayMomentum(player.momentum||1.0,diffDays-1);
    }
    const level=levelFromXP(Math.max(0,earnedXP(player.stats)));
    player.maxHp=calcMaxHp(level);
    if(diffDays===1){
        const covered=new Set((player.completedToday||[]).map(id=>{const q=allQuests.find(q=>q.id===id);return q?q.stat:null;}).filter(Boolean));
        if(covered.size>=5) player.hp=Math.min(player.maxHp,(player.hp||player.maxHp)+20);
    } else {
        player.hp=Math.max(0,(player.hp||player.maxHp)-(diffDays===2?10:diffDays===3?20:35));
    }
    if(player.hp<=0){player.hp=0;player.corrupted=true;}
    else if(player.corrupted&&player.hp>25) player.corrupted=false;
    if(!buffActive(player.buffs.focusDraught)) player.buffs.focusDraught=null;
    if(!buffActive(player.buffs.sprintScroll)) player.buffs.sprintScroll=null;
    player.completedToday=[]; player.lastQuestDate=todayStr; player.lastActiveDate=todayStr;
    savePlayer();
}
function today() {
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ─── LOAD QUESTS ─────────────────────────────────────────────
async function loadQuests() {
    try { const res=await fetch('/terminal/data/quests.json'); const data=await res.json(); return data.quests; }
    catch(e) { console.error('Could not load quests:',e); return []; }
}

// ─── SYSTEM LOG ──────────────────────────────────────────────
const LOG_MAX=4, LOG_LINGER=3000, LOG_FADE=500;
// Transmissions linger longer (7s) to ensure they are read
const TRANSMISSION_LINGER=7000;

function showLog(msg, variant) {
    const c=document.getElementById('system-log'); if(!c) return;
    const existing=c.querySelectorAll('.log-entry');
    if(existing.length>=LOG_MAX) existing[0].remove();
    const el=document.createElement('div');
    const isTransmission = variant==='transmission';
    el.className='log-entry'
        +(variant==='warn'         ?' log-entry--warn':'')
        +(variant==='accent'       ?' log-entry--accent':'')
        +(isTransmission           ?' log-entry--transmission':'');
    el.textContent=msg; c.appendChild(el);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('log-entry--visible')));
    const linger = isTransmission ? TRANSMISSION_LINGER : LOG_LINGER;
    setTimeout(()=>{ el.classList.add('log-entry--fading'); setTimeout(()=>el.remove(),LOG_FADE); },linger);
}

// ─── SHOP ────────────────────────────────────────────────────
function openShop() { renderShop(); showScreen('screen-shop'); }
function renderShop() {
    const list=document.getElementById('shop-list'),goldEl=document.getElementById('shop-gold-value');
    const buffsEl=document.getElementById('active-buffs'),gold=player.gold||0,buffs=player.buffs||defaultBuffs();
    goldEl.textContent=gold; list.innerHTML='';
    const al=[];
    if(buffActive(buffs.focusDraught)) al.push('☕ FOCUS DRAUGHT — INT + END ×2 active until midnight');
    if(buffActive(buffs.sprintScroll)) al.push('⚡ SPRINT SCROLL — Gear '+effectiveGear()+' active until midnight');
    if(buffActive(buffs.restSigil)){const e=new Date(buffs.restSigil);al.push('🌑 REST SIGIL — Momentum protected until '+String(e.getHours()).padStart(2,'0')+':'+String(e.getMinutes()).padStart(2,'0'));}
    if(buffs.clarityShards>0) al.push('📝 CLARITY SHARDS — +5 XP on next '+buffs.clarityShards+' directive(s)');
    if(al.length){buffsEl.innerHTML='<div class="active-buffs-title">[ ACTIVE EFFECTS ]</div>'+al.map(l=>'<div class="active-buff-line">'+l+'</div>').join('');buffsEl.classList.remove('hidden');}
    else{buffsEl.innerHTML='';buffsEl.classList.add('hidden');}
    SHOP_ITEMS.forEach(item=>{
        const canAfford=gold>=item.price;
        const alreadyActive=item.buffKey&&item.buffKey!=='clarityShards'&&buffActive(buffs[item.buffKey]);
        const card=document.createElement('div');
        card.className='shop-card'+(canAfford?'':' shop-card--unaffordable');
        card.innerHTML=`<div class="shop-card-top"><span class="shop-item-emoji">${item.emoji}</span>
            <div class="shop-item-info"><div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc}</div><div class="shop-item-effect">${item.effect}</div></div>
            <div class="shop-item-price"><span class="shop-price-value">${item.price}</span><span class="shop-price-label">GOLD</span></div></div>
            <button class="consume-btn" data-item-id="${item.id}" ${!canAfford||alreadyActive?'disabled':''}>
            ${alreadyActive?'[ ACTIVE ]':canAfford?'CONSUME':'INSUFFICIENT GOLD'}</button>`;
        list.appendChild(card);
    });
    document.querySelectorAll('.consume-btn:not([disabled])').forEach(btn=>{
        btn.addEventListener('click',()=>{playUIClick();consumeItem(btn.dataset.itemId);});
    });
}
function consumeItem(itemId) {
    const item=SHOP_ITEMS.find(i=>i.id===itemId); if(!item) return;
    const gold=player.gold||0; if(gold<item.price) return;
    if(itemId==='sprintScroll'&&effectiveGear()>=3){showLog('[WARNING: GEAR_CEILING_REACHED]','warn');return;}
    player.gold=gold-item.price;
    switch(itemId){
        case 'focusDraught':   player.buffs.focusDraught=endOfDayISO(); break;
        case 'vitalityTonic':{const mh=player.maxHp||calcMaxHp(calculateLevel());player.hp=Math.min(mh,(player.hp||mh)+20);const pct=Math.round((player.hp/mh)*100);const hEl=document.getElementById('hp-bar'),hV=document.getElementById('hp-value');if(hEl)hEl.style.width=pct+'%';if(hV)hV.textContent=player.hp+' / '+mh;showLog('[VITALITY_TONIC: +20 HP]');break;}
        case 'sprintScroll':   player.buffs.sprintScroll=endOfDayISO();dailyQuests=getDailyQuests(allQuests,calculateLevel(),effectiveGear());showLog('[GEAR_SHIFT: GEAR_'+effectiveGear()+'_ENGAGED]');break;
        case 'restSigil':      player.buffs.restSigil=in24hISO();showLog('[REST_SIGIL: MOMENTUM_PROTECTED_24H]');break;
        case 'clarityShards':  player.buffs.clarityShards=(player.buffs.clarityShards||0)+3;break;
    }
    savePlayer(); playConsume(); showLog(item.consumeMsg,'accent'); renderShop();
    const gEl=document.getElementById('gold-value'); if(gEl) gEl.textContent=player.gold;
}

// ─── QUEST COMPLETION ────────────────────────────────────────
function completeQuest(id, stat, baseXP) {
    if(player.completedToday.includes(id)) return;
    const momentum=player.momentum||1.0; let amt=parseFloat((baseXP*momentum).toFixed(1));
    const wasCorrupted=player.corrupted; if(wasCorrupted) amt=parseFloat((amt/2).toFixed(1));
    if(buffActive(player.buffs.focusDraught)&&(stat==='intelligence'||stat==='endurance')) amt=parseFloat((amt*2).toFixed(1));
    if(player.buffs.clarityShards>0){amt=parseFloat((amt+5).toFixed(1));player.buffs.clarityShards--;}
    const isCrit=Math.random()<0.125;
    if(isCrit){amt=parseFloat((amt*1.5).toFixed(1));playCriticalHit();showLog('[CRITICAL_STRIKE: ×1.5 APPLIED]','accent');}
    const xpBefore=earnedXP(player.stats);
    player.stats[stat]=parseFloat(((player.stats[stat]||STAT_FLOOR)+amt).toFixed(1));
    player.completedToday.push(id); player.gold=(player.gold||0)+baseXP; savePlayer();
    const card=document.getElementById('quest-card-'+id);
    if(card){card.classList.add('completing');setTimeout(()=>card.classList.remove('completing'),400);}
    showFloatingXP(id,amt,isCrit); if(!isCrit) playQuestComplete();
    showLog('[LOG: '+stat.toUpperCase()+' +'+amt+' XP]');
    const prevLevel=levelFromXP(xpBefore),newLevel=calculateLevel();
    const prevRank=rankFromLevel(prevLevel),newRank=rankFromLevel(newLevel);
    if(wasCorrupted&&!player.corrupted) setTimeout(()=>showLog('[SYSTEM_RESTORED: CORRUPTION_CLEARED]','accent'),400);
    renderQuests(dailyQuests,player.completedToday,player.momentum);
    updateStatusScreen();
    if(newRank!==prevRank){setTimeout(()=>{showLog('[RECLASSIFIED: '+newRank+'-RANK CONFIRMED]','accent');showRankUpOverlay(newRank,newLevel);},600);}
    else if(newLevel>prevLevel){setTimeout(()=>{showLog('[THRESHOLD: LEVEL '+newLevel+' REACHED]','accent');showLevelUpOverlay(newLevel);},600);}
}

function calculateLevel() { return levelFromXP(Math.max(0,earnedXP(player.stats))); }
function calculateLuck()  { return parseFloat((STAT_NAMES.reduce((s,n)=>s+(player.stats[n]||STAT_FLOOR),0)/STAT_NAMES.length).toFixed(1)); }

// ─── STATUS SCREEN ───────────────────────────────────────────
function updateStatusScreen(animate) {
    const level=calculateLevel(),rank=rankFromLevel(level),momentum=player.momentum||1.0;
    const xp=earnedXP(player.stats),xpThis=xp-xpForLevel(level);
    const xpNext=xpForLevel(level+1)-xpForLevel(level);
    const pct=xpNext>0?Math.min(100,Math.round((xpThis/xpNext)*100)):100;
    document.getElementById('status-header').classList.toggle('corrupted',!!player.corrupted);
    document.getElementById('player-title').textContent=player.corrupted?'[ SYSTEM COMPROMISED ]':'[ '+titleFromLevel(level)+' ]';
    document.getElementById('player-name').textContent=player.name;
    document.getElementById('player-level').textContent=level;
    const rankEl=document.getElementById('rank-badge');
    rankEl.textContent=rank; rankEl.className='rank-badge tappable '+rankCssClass(rank); rankEl.dataset.tip='rank';
    document.getElementById('level-progress-bar').style.width=pct+'%';
    document.getElementById('level-progress-label').textContent=xpThis+' / '+xpNext+' XP  ('+pct+'%)';
    const mPct=Math.round(((momentum-1.0)/0.5)*100);
    document.getElementById('momentum-bar').style.width=mPct+'%';
    document.getElementById('momentum-value').textContent=momentum.toFixed(2)+'x';
    const hp=player.hp??player.maxHp,maxHp=player.maxHp??calcMaxHp(level),hpPct=Math.round((hp/maxHp)*100);
    document.getElementById('hp-bar').style.width=hpPct+'%';
    document.getElementById('hp-value').textContent=hp+' / '+maxHp;
    const gEl=document.getElementById('gold-value'); if(gEl) gEl.textContent=player.gold||0;
    STAT_NAMES.forEach(stat=>{
        const val=player.stats[stat]||STAT_FLOOR,dv=Math.floor(val),bp=Math.min(100,((val-STAT_FLOOR)/90)*100);
        if(animate){animateNumber('val-'+stat,0,dv,600);setTimeout(()=>document.getElementById('bar-'+stat).style.width=bp+'%',100);}
        else{document.getElementById('val-'+stat).textContent=dv;document.getElementById('bar-'+stat).style.width=bp+'%';}
    });
    const luck=calculateLuck(),lv=Math.floor(luck),lp=Math.min(100,((luck-STAT_FLOOR)/90)*100);
    if(animate){animateNumber('val-luck',0,lv,700);setTimeout(()=>document.getElementById('bar-luck').style.width=lp+'%',100);}
    else{document.getElementById('val-luck').textContent=lv;document.getElementById('bar-luck').style.width=lp+'%';}
}

function rankCssClass(rank) {
    const m={'F':'rank-f','E':'rank-e','D':'rank-d','C':'rank-c','B':'rank-b','A':'rank-a',
        'S':'rank-s','S+':'rank-s','SS':'rank-s','SS+':'rank-s','SSS':'rank-s'};
    return m[rank]||'rank-f';
}
function showStatusScreenWithAnimation() {
    showScreen('screen-status');
    setTimeout(()=>{ updateStatusScreen(true); if(calculateLevel()>1) setTimeout(()=>showLevelUpOverlay(calculateLevel()),1500); },200);
}
function animateNumber(elId,from,to,dur) {
    const el=document.getElementById(elId); if(!el) return;
    const steps=30,step=(to-from)/steps,delay=dur/steps; let cur=from,cnt=0;
    const iv=setInterval(()=>{ cnt++;cur+=step;el.textContent=Math.round(cnt>=steps?to:cur);if(cnt>=steps)clearInterval(iv); },delay);
}
function showFloatingXP(questId,amount,isCritical) {
    const card=document.getElementById('quest-card-'+questId); if(!card) return;
    const rect=card.getBoundingClientRect(),top=rect.top+window.scrollY,left=rect.left+rect.width/2-20;
    if(isCritical){const c=document.createElement('div');c.className='float-xp float-critical';c.textContent='[ CRITICAL ]';c.style.left=left+'px';c.style.top=(top-24)+'px';document.body.appendChild(c);setTimeout(()=>c.remove(),1100);}
    const l=document.createElement('div');l.className='float-xp';l.textContent='+'+amount+' XP';l.style.left=left+'px';l.style.top=top+'px';document.body.appendChild(l);setTimeout(()=>l.remove(),1000);
}

// ─── LEVEL + RANK OVERLAYS ───────────────────────────────────
function showLevelUpOverlay(level) {
    playLevelUp(); spawnParticles('lu-particles',20,'var(--accent)');
    const tt=titleFromLevel(level),rt=rankFromLevel(level),sub=rt+'-RANK  ·  SHOW UP AGAIN TOMORROW';
    document.getElementById('lu-level').textContent=level;
    document.getElementById('lu-title').textContent=tt;
    document.getElementById('lu-sub').textContent=sub;
    const ov=document.getElementById('overlay-levelup'); ov.classList.remove('hidden');
    document.getElementById('lu-share-btn').onclick=()=>{playUIClick();shareCard({headline:'THRESHOLD REACHED',bigText:String(level),titleText:tt,subText:sub,accentColor:'#4fc3f7'});};
    document.getElementById('lu-dismiss-btn').onclick=()=>{playUIClick();ov.classList.add('hidden');};
}
function showRankUpOverlay(rank,level) {
    playRankUp(); spawnParticles('ru-particles',35,'var(--gold)');
    const tt=rank+'-RANK CONFIRMED',sub=titleFromLevel(level)+'  ·  LEVEL '+level;
    document.getElementById('ru-rank').textContent=rank;
    document.getElementById('ru-title').textContent=tt;
    document.getElementById('ru-sub').textContent=sub;
    const ov=document.getElementById('overlay-rankup'); ov.classList.remove('hidden');
    document.getElementById('ru-share-btn').onclick=()=>{playUIClick();shareCard({headline:'RANK RECLASSIFIED',bigText:rank,titleText:tt,subText:sub,accentColor:'#ffd700'});};
    document.getElementById('ru-dismiss-btn').onclick=()=>{playUIClick();ov.classList.add('hidden');};
}

// ─── SHARE CARD ──────────────────────────────────────────────
function shareCard({headline,bigText,titleText,subText,accentColor}) {
    const W=1080,H=1080,canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#0f0f1a';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(42,42,74,0.7)';
    for(let x=30;x<W;x+=60)for(let y=30;y<H;y+=60){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=accentColor;ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);ctx.fillRect(0,0,5,H);ctx.fillRect(W-5,0,5,H);
    ctx.fillStyle=accentColor;ctx.textAlign='center';ctx.font='500 30px monospace';ctx.fillText('[ SYSTEM ]',W/2,120);
    ctx.fillStyle='rgba(200,214,229,0.45)';ctx.font='32px monospace';ctx.fillText(headline,W/2,178);
    ctx.save();ctx.shadowColor=accentColor;ctx.shadowBlur=80;ctx.fillStyle=accentColor;
    ctx.font=`bold ${bigText.length>2?200:300}px monospace`;ctx.fillText(bigText,W/2,540);ctx.restore();
    ctx.fillStyle='#ffffff';ctx.font='bold 54px sans-serif';ctx.fillText(titleText,W/2,650);
    ctx.fillStyle='rgba(200,214,229,0.5)';ctx.font='30px monospace';ctx.fillText(subText,W/2,712);
    ctx.strokeStyle='rgba(42,42,74,1)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(120,760);ctx.lineTo(W-120,760);ctx.stroke();
    ctx.fillStyle='#ffffff';ctx.font='bold 44px monospace';ctx.fillText(player.name,W/2,836);
    ctx.fillStyle='rgba(200,214,229,0.35)';ctx.font='26px monospace';canvasWrapText(ctx,getRandomTagline(),W/2,908,W-160,38);
    ctx.fillStyle=accentColor;ctx.font='22px monospace';ctx.globalAlpha=0.6;ctx.fillText('SYD — SYNCHRONIZED YIELD DIRECTIVE',W/2,1032);ctx.globalAlpha=1;
    canvas.toBlob(blob=>{
        const file=new File([blob],'syd-moment.png',{type:'image/png'});
        if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
            navigator.share({files:[file],title:'SYD — '+headline,text:player.name+' · '+subText+'\n'+getRandomTagline()}).catch(()=>downloadCanvas(canvas));
        }else downloadCanvas(canvas);
    },'image/png');
}
function canvasWrapText(ctx,text,x,y,maxWidth,lh){
    const words=text.split(' ');let line='';
    for(let n=0;n<words.length;n++){const test=line+words[n]+' ';if(ctx.measureText(test).width>maxWidth&&n>0){ctx.fillText(line.trim(),x,y);line=words[n]+' ';y+=lh;}else line=test;}
    ctx.fillText(line.trim(),x,y);
}
function downloadCanvas(canvas){const a=document.createElement('a');a.download='syd-moment.png';a.href=canvas.toDataURL('image/png');a.click();}

// ─── PARTICLES ───────────────────────────────────────────────
function spawnParticles(cId,count,color){
    const c=document.getElementById(cId);if(!c)return;c.innerHTML='';
    for(let i=0;i<count;i++){
        const p=document.createElement('div');p.className='particle';
        const angle=(360/count)*i,dist=80+Math.random()*120;
        p.style.cssText=`background:${color};left:50%;top:50%;--tx:${Math.cos(angle*Math.PI/180)*dist}px;--ty:${Math.sin(angle*Math.PI/180)*dist}px;animation-delay:${Math.random()*0.3}s;animation-duration:${0.8+Math.random()*0.6}s;`;
        c.appendChild(p);
    }
}

// ─── GEAR ────────────────────────────────────────────────────
function loadGear(){const s=parseInt(localStorage.getItem(GEAR_KEY),10);return(s===2||s===3)?s:1;}
function saveGear(gear){
    currentGear=gear;localStorage.setItem(GEAR_KEY,String(gear));
    dailyQuests=getDailyQuests(allQuests,calculateLevel(),effectiveGear());
    if(document.getElementById('screen-quests').classList.contains('active'))
        renderQuests(dailyQuests,player.completedToday,player.momentum||1.0);
}

// ─── SETTINGS ────────────────────────────────────────────────
function openSettings(){
    document.getElementById('settings-name-input').value=player.name;
    document.getElementById('confirm-box').classList.add('hidden');
    document.getElementById('save-name-btn').onclick=()=>{playUIClick();savePlayerName();};
    document.getElementById('reset-btn').onclick=()=>{playUIClick();showConfirmReset();};
    document.getElementById('confirm-yes').onclick=()=>{playUIClick();resetProfile();};
    document.getElementById('confirm-no').onclick=()=>{playUIClick();document.getElementById('confirm-box').classList.add('hidden');};

    // Sync Terminal wiring
    const pushBtn    = document.getElementById('sync-push-btn');
    const recoverBtn = document.getElementById('sync-recover-btn');
    if (pushBtn)    pushBtn.onclick    = () => { playUIClick(); pushSaveState(); };
    if (recoverBtn) recoverBtn.onclick = () => { playUIClick(); reconstituteSaveState(); };

    // Show existing frequency code if the player has already pushed
    const existingFreq = player.saveFrequency || localStorage.getItem(SAVE_FREQ_KEY);
    if (existingFreq) {
        const display = document.getElementById('sync-freq-display');
        const codeEl  = document.getElementById('sync-freq-code');
        if (display) display.classList.remove('hidden');
        if (codeEl)  codeEl.textContent = existingFreq;
    }

    // Clear any previous status message when reopening settings
    setSyncStatus('', '');
    updateGearUI(currentGear);
    document.querySelectorAll('.gear-option-btn').forEach(btn=>{
        btn.onclick=()=>{playUIClick();const g=parseInt(btn.dataset.gear,10);saveGear(g);updateGearUI(g);showLog('[GEAR_SHIFT: GEAR_'+g+'_ENGAGED]');};
    });
    showScreen('screen-settings');
}
function updateGearUI(gear){
    document.querySelectorAll('.gear-option-btn').forEach(b=>b.classList.toggle('gear-active',parseInt(b.dataset.gear,10)===gear));
    document.querySelectorAll('.gear-warning').forEach(e=>e.classList.add('hidden'));
    const w=document.getElementById('gear-warning-'+gear);if(w)w.classList.remove('hidden');
}
function savePlayerName(){
    const i=document.getElementById('settings-name-input'),n=i.value.trim().toUpperCase();
    if(!n){i.focus();return;}
    player.name=n;savePlayer();updateStatusScreen();showLog('[DESIGNATION_UPDATED]');
    setTimeout(()=>showScreen('screen-status'),1200);
}
function showConfirmReset(){document.getElementById('confirm-box').classList.remove('hidden');}
function resetProfile(){
    localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(SOUND_KEY);
    localStorage.removeItem('syd_sound');localStorage.removeItem(GEAR_KEY);
    window.location.reload();
}

// ─── TOOLTIPS ────────────────────────────────────────────────
function setupTooltips(){
    document.querySelectorAll('.tappable').forEach(el=>{
        const fresh=el.cloneNode(true);el.parentNode.replaceChild(fresh,el);
        fresh.addEventListener('click',e=>{
            e.stopPropagation();playUIClick();
            const tip=fresh.dataset.tip;if(!tip)return;
            const box=document.getElementById('tip-'+tip);if(!box)return;
            const open=box.classList.contains('visible');
            document.querySelectorAll('.tooltip-box').forEach(b=>b.classList.remove('visible'));
            if(!open)box.classList.add('visible');
        });
    });
    document.addEventListener('click',()=>document.querySelectorAll('.tooltip-box').forEach(b=>b.classList.remove('visible')));
}

// ─── SHOW SCREEN ─────────────────────────────────────────────
const STATUS_QUEST_SCREENS = ['screen-status','screen-quests'];

function showScreen(id) {
    const prev   = document.querySelector('.screen.active');
    const prevId = prev ? prev.id : null;

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    const wasStatusQ = prevId && STATUS_QUEST_SCREENS.includes(prevId);
    const isStatusQ  = STATUS_QUEST_SCREENS.includes(id);
    const wasMap     = prevId === 'screen-map';
    const isMap      = id    === 'screen-map';

    // ── Audio ────────────────────────────────────────────────
    // Status/quests: noise floor + crackle only, no drone tones
    if (isStatusQ && !wasStatusQ) {
        if (wasMap) stopMapAudio();
        if (soundEnabled && !sqNoiseNode) startStatusAmbient();
    }
    if (!isStatusQ && wasStatusQ) {
        stopStatusAmbient();
    }
    // Map: full audio (drone + noise + ping)
    if (isMap) {
        if (droneEnabled && !mapOscA) startMapAudio();
        renderMap();
        closeLorePanel();
    }
    if (!isMap && wasMap) {
        stopMapAudio();
        // Resume status ambient if we're returning to a status/quest screen
        if (isStatusQ && soundEnabled && !sqNoiseNode) startStatusAmbient();
    }

    // ── Per-screen setup ─────────────────────────────────────
    if (id === 'screen-status') setupTooltips();
    if (id === 'screen-quests') {
        // Apply filter if coming from the map
        const quests = activeQuestFilter
            ? dailyQuests.filter(q => q.stat === activeQuestFilter)
            : dailyQuests;
        renderQuests(quests, player.completedToday, player.momentum||1.0);
        applyQuestFilter();
    }
    // Clear filter when leaving the quests screen for anywhere other than back-to-map
    // (back nav always goes to status, so always clear)
    if (prevId === 'screen-quests' && id !== 'screen-quests') {
        activeQuestFilter = null;
    }
}

// ════════════════════════════════════════════════════════════════
// PAGE VISIBILITY — pause audio when app goes to background
//
// Uses AudioContext.suspend() / .resume() rather than stopping
// nodes, so all connections, timers, and state are preserved.
// The app can still receive push notifications while suspended
// because the Service Worker runs independently of the page JS.
// ════════════════════════════════════════════════════════════════
document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.visibilityState === 'hidden') {
        // App moved to background — suspend context silently
        audioCtx.suspend().catch(() => {});
    } else {
        // App returned to foreground — resume where it left off
        audioCtx.resume().catch(() => {});
    }
});

// ════════════════════════════════════════════════════════════════
// PWA INSTALL PROMPT
//
// We capture the browser's beforeinstallprompt event and hold it.
// Rather than letting the browser show its generic dialog, we show
// our own in-character System prompt at the right moment.
//
// Timing: shown once, 8 seconds after the status screen loads,
// only if the app is not already installed. Dismissed state is
// stored in localStorage so it never re-appears after a decision.
// ════════════════════════════════════════════════════════════════
let deferredInstallPrompt = null;
const INSTALL_DISMISSED_KEY = 'syd_install_dismissed';

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();   // stop the browser's own dialog
    deferredInstallPrompt = e;
    // Show our prompt if the user hasn't dismissed it before
    if (!localStorage.getItem(INSTALL_DISMISSED_KEY)) {
        setTimeout(showInstallPrompt, 8000);
    }
});

// If the app is already installed, the appinstalled event fires
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'installed');
    showLog('[ TERMINAL ANCHORED TO DEVICE — STANDING BY ]', 'accent');
});

function showInstallPrompt() {
    if (!deferredInstallPrompt) return;
    const overlay = document.getElementById('overlay-install');
    if (!overlay) return;
    overlay.classList.remove('hidden');
}

function acceptInstall() {
    const overlay = document.getElementById('overlay-install');
    if (overlay) overlay.classList.add('hidden');
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
            localStorage.setItem(INSTALL_DISMISSED_KEY, 'installed');
            showLog('[ TERMINAL INSTALLATION CONFIRMED ]', 'accent');
        }
        deferredInstallPrompt = null;
    });
}

function dismissInstall() {
    const overlay = document.getElementById('overlay-install');
    if (overlay) overlay.classList.add('hidden');
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'dismissed');
    deferredInstallPrompt = null;
}

// ─── START ───────────────────────────────────────────────────
init();