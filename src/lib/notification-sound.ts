// ── Shared, gesture-unlocked AudioContext ───────────────────────────────────
// Browsers block audio until the user interacts with the page. Creating a fresh
// AudioContext per sound leaves it "suspended" and nothing plays. Instead keep
// one shared context and resume it on the first user gesture.
let sharedCtx: AudioContext | null = null;
function getSharedCtx(): AudioContext | null {
    try {
        if (!sharedCtx) sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
        return sharedCtx;
    } catch {
        return null;
    }
}
if (typeof window !== "undefined") {
    const unlock = () => { getSharedCtx(); };
    ["click", "keydown", "touchstart", "pointerdown"].forEach((ev) =>
        window.addEventListener(ev, unlock, { once: false, passive: true })
    );
}

// De-duplicated new-order chime: the same order id won't chime twice even if
// both the socket handler and the polling detector fire for it.
let lastChimedOrderId: string | null = null;
export function chimeNewOrder(orderId?: string | null) {
    if (orderId && orderId === lastChimedOrderId) return;
    lastChimedOrderId = orderId || null;
    playNewOrderSound();
}

/**
 * Plays a pleasant "new order" notification sound using the Web Audio API.
 * No external audio files required.
 */
export function playNewOrderSound() {
    try {
        const ctx = getSharedCtx();
        if (!ctx) return;

        // A loud, repeating siren-like alarm for a noisy kitchen
        // 32 beeps * 0.25s (0.15 + 0.1) = ~8 seconds long
        const beeps = 32;
        const beepDuration = 0.15;
        const pauseDuration = 0.1;

        for (let i = 0; i < beeps; i++) {
            const start = i * (beepDuration + pauseDuration);

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = "square"; // best for cutting through noise
            oscillator.frequency.setValueAtTime(880, ctx.currentTime + start); // High pitch (A5)
            oscillator.frequency.setValueAtTime(1100, ctx.currentTime + start + (beepDuration / 2)); // slight warble

            // Extremely Loud Volume (Gain 5.0)
            gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
            gainNode.gain.linearRampToValueAtTime(5.0, ctx.currentTime + start + 0.02);
            gainNode.gain.setValueAtTime(5.0, ctx.currentTime + start + beepDuration - 0.02);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + start + beepDuration);

            oscillator.start(ctx.currentTime + start);
            oscillator.stop(ctx.currentTime + start + beepDuration);
        }

        // Close context after sound finishes to free resources
        // shared context — not closed
    } catch (e) {
        console.warn("Could not play notification sound:", e);
    }
}

/**
 * Plays a louder "success" sound for order placement.
 * Uses a cheerful major chord arpeggio.
 */
export function playOrderPlacedSound() {
    try {
        const ctx = getSharedCtx();
        if (!ctx) return;

        // Major chord arpeggio (C6, E6, G6, C7)
        const notes = [
            { freq: 1046.50, start: 0, duration: 0.15 }, // C6
            { freq: 1318.51, start: 0.15, duration: 0.15 }, // E6
            { freq: 1567.98, start: 0.30, duration: 0.15 }, // G6
            { freq: 2093.00, start: 0.45, duration: 0.4 }, // C7
        ];

        notes.forEach(({ freq, start, duration }) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = "triangle"; // Triangle wave for a clearer, game-like sound
            oscillator.frequency.setValueAtTime(freq, ctx.currentTime + start);

            // High Volume (Gain 3.0)
            gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
            gainNode.gain.linearRampToValueAtTime(3.0, ctx.currentTime + start + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

            oscillator.start(ctx.currentTime + start);
            oscillator.stop(ctx.currentTime + start + duration + 0.1);
        });

        // shared context — not closed
    } catch (e) {
        console.warn("Could not play success sound:", e);
    }
}

/**
 * Plays a warm, loud bell-chime notification for incoming chat messages.
 * Uses sine harmonics + DynamicsCompressor for max loudness and a pleasing tone.
 */
export function playChatSound() {
    try {
        const ctx = getSharedCtx();
        if (!ctx) return;
        const sampleRate = ctx.sampleRate;

        // Render TWO bell notes (E5 → A5) directly into a buffer at ±1.0 amplitude.
        // AudioBuffer approach bypasses oscillator gain limitations — samples are
        // literally at the maximum digital amplitude the browser audio pipeline allows.
        const totalDuration = 1.5; // seconds
        const bufLen = Math.ceil(sampleRate * totalDuration);
        const buffer = ctx.createBuffer(1, bufLen, sampleRate);
        const data = buffer.getChannelData(0);

        const addNote = (freq: number, startSec: number, durationSec: number) => {
            const startSample = Math.floor(startSec * sampleRate);
            const endSample = Math.min(startSample + Math.floor(durationSec * sampleRate), bufLen);
            for (let i = startSample; i < endSample; i++) {
                const t = (i - startSample) / sampleRate;
                // Full amplitude sine at target freq + harmonics for bell richness
                const env = Math.exp(-4.5 * t / durationSec); // exponential decay envelope
                const wave = Math.sin(2 * Math.PI * freq * t)             // fundamental
                    + 0.5 * Math.sin(2 * Math.PI * freq * 2 * t)  // 2nd harmonic
                    + 0.25 * Math.sin(2 * Math.PI * freq * 3 * t); // 3rd harmonic
                data[i] += wave * env; // accumulate (may go > ±1, normalised below)
            }
        };

        addNote(659.25, 0, 0.9); // E5
        addNote(880.00, 0.40, 0.9); // A5

        // Normalise to ±1.0 so the buffer plays at maximum possible amplitude
        let peak = 0;
        for (let i = 0; i < bufLen; i++) { if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]); }
        if (peak > 0) { for (let i = 0; i < bufLen; i++) { data[i] /= peak; } }

        // Play it 3 times in a row
        const playAt = (when: number) => {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);
            src.start(when);
        };

        playAt(ctx.currentTime);
        playAt(ctx.currentTime + totalDuration);
        playAt(ctx.currentTime + totalDuration * 2);

        // shared context — not closed
    } catch (e) {
        console.warn("Could not play chat sound:", e);
    }
}

