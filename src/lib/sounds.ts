// Simple WebAudio-generated sound effects for the Koki game.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Short whoosh/flap sound for the jump. */
export function playFlap() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Noise burst (whoosh)
  const bufferSize = Math.floor(ac.sampleRate * 0.18);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1200, now);
  bp.frequency.exponentialRampToValueAtTime(400, now + 0.18);
  bp.Q.value = 1.2;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  noise.connect(bp).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.2);
}

/** Cat meow synthesized with a pitch-swept oscillator + formant filter. */
export function playMeow() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const dur = 0.45;

  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  // "mi-aaau" pitch contour
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.linearRampToValueAtTime(780, now + 0.12);
  osc.frequency.linearRampToValueAtTime(560, now + 0.28);
  osc.frequency.linearRampToValueAtTime(380, now + dur);

  const formant = ac.createBiquadFilter();
  formant.type = "bandpass";
  formant.Q.value = 6;
  formant.frequency.setValueAtTime(900, now);
  formant.frequency.linearRampToValueAtTime(1600, now + 0.15);
  formant.frequency.linearRampToValueAtTime(800, now + dur);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
  gain.gain.setValueAtTime(0.3, now + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(formant).connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}
