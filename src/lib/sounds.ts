// Simple WebAudio-generated sound effects + background music for Koki.
import bgmAsset from "@/assets/background-music.mp3.asset.json";
import logoAsset from "@/assets/logo-sound.mp3.asset.json";
import bossStartUrl from "@/assets/boss-start.mp3";

let ctx: AudioContext | null = null;

const LS_MUSIC = "koki-vol-music";
const LS_SFX = "koki-vol-sfx";

let musicVolume = 0.3;
let sfxVolume = 1.0;

function loadFromStorage() {
  if (typeof window === "undefined") return;
  const m = window.localStorage.getItem(LS_MUSIC);
  const s = window.localStorage.getItem(LS_SFX);
  if (m !== null) musicVolume = Math.max(0, Math.min(1, Number(m)));
  if (s !== null) sfxVolume = Math.max(0, Math.min(1, Number(s)));
}
loadFromStorage();

export function getMusicVolume() { return musicVolume; }
export function getSfxVolume() { return sfxVolume; }

let bgmEl: HTMLAudioElement | null = null;

function ensureBgm(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!bgmEl) {
    bgmEl = new Audio(bgmAsset.url);
    bgmEl.loop = true;
    bgmEl.preload = "auto";
    bgmEl.volume = musicVolume;
  }
  return bgmEl;
}

/** Starts the background music. Resolves false if the browser blocked it (no tap yet). */
export function startMusic(): Promise<boolean> {
  const el = ensureBgm();
  if (!el) return Promise.resolve(false);
  el.volume = musicVolume;
  if (!el.paused) return Promise.resolve(true);
  try {
    const p = el.play();
    return p && typeof p.then === "function" ? p.then(() => true, () => false) : Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function stopMusic() {
  if (bgmEl) {
    bgmEl.pause();
  }
}

export function setMusicVolume(v: number) {
  musicVolume = Math.max(0, Math.min(1, v));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_MUSIC, String(musicVolume));
  }
  if (bgmEl) bgmEl.volume = musicVolume;
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.max(0, Math.min(1, v));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_SFX, String(sfxVolume));
  }
}

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
  if (!ac || sfxVolume <= 0) return;
  const now = ac.currentTime;

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
  const peak = 0.35 * sfxVolume;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  noise.connect(bp).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.2);
}

/** Cat meow synthesized with a pitch-swept oscillator + formant filter. */
export function playMeow() {
  const ac = getCtx();
  if (!ac || sfxVolume <= 0) return;
  const now = ac.currentTime;
  const dur = 0.45;

  const osc = ac.createOscillator();
  osc.type = "sawtooth";
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
  const peak = 0.3 * sfxVolume;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.05);
  gain.gain.setValueAtTime(Math.max(0.0002, peak), now + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(formant).connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

// --- Logo sound (menu) ---

let logoEl: HTMLAudioElement | null = null;

/** Plays the uploaded Koki jingle when tapping the menu logo. */
let bossStartEl: HTMLAudioElement | null = null;

/** Played when a boss fight begins. */
export function playBossStart() {
  if (typeof window === "undefined" || sfxVolume <= 0) return;
  if (!bossStartEl) {
    bossStartEl = new Audio(bossStartUrl);
    bossStartEl.preload = "auto";
  }
  bossStartEl.currentTime = 0;
  bossStartEl.volume = sfxVolume;
  const p = bossStartEl.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

export function playLogoSound() {
  if (typeof window === "undefined" || sfxVolume <= 0) return;
  if (!logoEl) {
    logoEl = new Audio(logoAsset.url);
    logoEl.preload = "auto";
  }
  logoEl.currentTime = 0;
  logoEl.volume = sfxVolume;
  const p = logoEl.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}
