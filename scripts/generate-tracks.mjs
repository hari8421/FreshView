/**
 * Wax Trax — original demo track generator.
 *
 * Renders five short instrumental loops with a small subtractive synth
 * (pads, bass, plucks, drums), then runs them through a tape-wear stage
 * (wow & flutter, hiss, crackle) and encodes to MP3 with ffmpeg.
 *
 * Usage: node scripts/generate-tracks.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SR = 44100;
const OUT_DIR = path.resolve("public/tracks");
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "waxtrax-"));

/* ---------------------------------------------------------------- utilities */

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeStereo(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), n, seconds };
}

/** One-pole / state-variable style low pass, per channel. */
function makeFilter() {
  let z1 = 0;
  let z2 = 0;
  return (x, cutoff, q = 0.707) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR * 0.45)) / SR);
    const damp = Math.min(2 * (1 - Math.pow(q, 1 / 1.4)), Math.min(2, 2 / f - f * 0.5));
    const hp = x - damp * z2;
    const bp = f * z1 + hp;
    const lp = f * bp + z2;
    z2 += bp;
    z1 += f * bp;
    return lp;
  };
}

function makeHPF() {
  let prevIn = 0;
  let prevOut = 0;
  return (x, cutoff) => {
    const a = Math.min(1, (2 * Math.PI * cutoff) / SR);
    const out = a * (prevOut + x - prevIn);
    prevIn = x;
    prevOut = out;
    return out;
  };
}

/** Deterministic noise so every build renders identical audio. */
let seed = 0x2f6e2b1;
function rnd() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 4294967296) * 2 - 1;
}

const env = (t, a, d, s, r, dur) => {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 + (s - 1) * ((t - a) / d);
  if (t < dur) return s;
  const rt = t - dur;
  return rt < r ? s * (1 - rt / r) : 0;
};

const osc = (type, phase) => {
  switch (type) {
    case "sine":
      return Math.sin(2 * Math.PI * phase);
    case "tri":
      return 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1;
    case "square":
      return phase % 1 < 0.5 ? 1 : -1;
    case "saw":
    default:
      return 2 * (phase % 1) - 1;
  }
};

/* --------------------------------------------------------------- instruments */

function addPad(buf, { start, dur, notes, gain = 0.12, cutoff = 1400, detune = 0.006, type = "saw" }) {
  const s0 = Math.floor(start * SR);
  const voices = [];
  for (const n of notes) {
    for (let d = -1; d <= 1; d++) {
      voices.push({ freq: mtof(n) * (1 + detune * d), pan: d * 0.5 + (n % 2 ? 0.06 : -0.06) });
    }
  }
  const total = Math.ceil((dur + 1.4) * SR);
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const amp = env(t, 0.6, 0.5, 0.75, 1.1, dur) * gain;
    if (amp <= 0) continue;
    // slow filter breathing
    const fc = cutoff * (0.7 + 0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.09 * t + start)));
    const fL = makeFilter();
    const fR = makeFilter();
    let l = 0;
    let r = 0;
    for (const v of voices) {
      const phase = v.freq * t;
      l += osc(type, phase) * (0.5 - v.pan * 0.35);
      r += osc(type, phase) * (0.5 + v.pan * 0.35);
    }
    l = fL(l / voices.length, fc);
    r = fR(r / voices.length, fc);
    buf.L[idx] += l * amp;
    buf.R[idx] += r * amp;
  }
}

function addBass(buf, { start, dur, midi, gain = 0.3, cutoff = 520 }) {
  const s0 = Math.floor(start * SR);
  const total = Math.ceil((dur + 0.25) * SR);
  const f = mtof(midi);
  const fL = makeFilter();
  const fR = makeFilter();
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const amp = env(t, 0.012, 0.14, 0.72, 0.12, dur) * gain;
    if (amp <= 0) continue;
    const wob = 1 + 0.0015 * Math.sin(2 * Math.PI * 5.5 * t);
    const x = Math.tanh(osc("saw", f * wob * t) * 0.7 + osc("sine", f * wob * t * 0.5) * 0.5);
    buf.L[idx] += fL(x, cutoff * (1 + 0.25 * Math.exp(-t * 12))) * amp;
    buf.R[idx] += fR(x, cutoff * (1 + 0.25 * Math.exp(-t * 12))) * amp;
  }
}

function addPluck(buf, { start, dur, midi, gain = 0.12, cutoff = 2600, pan = 0 }) {
  const s0 = Math.floor(start * SR);
  const total = Math.ceil((dur + 0.3) * SR);
  const f = mtof(midi);
  const fL = makeFilter();
  const fR = makeFilter();
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const amp = env(t, 0.004, dur * 0.8, 0.05, 0.22, dur) * gain;
    if (amp <= 0) continue;
    const x = osc("square", f * t) * 0.6 + osc("saw", f * t * 1.005) * 0.4;
    buf.L[idx] += fL(x, cutoff * Math.exp(-t * 3.2) + 320) * amp * (1 - Math.max(pan, 0) * 0.5);
    buf.R[idx] += fR(x, cutoff * Math.exp(-t * 3.2) + 320) * amp * (1 + Math.min(pan, 0) * 0.5);
  }
}

function addBell(buf, { start, midi, gain = 0.09, pan = 0 }) {
  const s0 = Math.floor(start * SR);
  const dur = 2.6;
  const total = Math.ceil((dur + 0.6) * SR);
  const f = mtof(midi);
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const a = Math.exp(-t * 2.1) * gain;
    const x =
      osc("sine", f * t) * 0.6 +
      osc("sine", f * 2.01 * t) * 0.25 +
      osc("sine", f * 3.02 * t) * 0.12;
    buf.L[idx] += x * a * (1 - Math.max(pan, 0) * 0.6);
    buf.R[idx] += x * a * (1 + Math.min(pan, 0) * 0.6);
  }
}

function addKick(buf, start, gain = 0.85) {
  const s0 = Math.floor(start * SR);
  const total = Math.floor(0.42 * SR);
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const f = 46 + 118 * Math.exp(-t * 34);
    const a = Math.exp(-t * 8.2) * gain;
    const x = Math.sin(2 * Math.PI * f * t) * a + (t < 0.004 ? rnd() * 0.25 * (1 - t / 0.004) : 0);
    buf.L[idx] += x;
    buf.R[idx] += x;
  }
}

function addSnare(buf, start, gain = 0.4, brush = 0.5) {
  const s0 = Math.floor(start * SR);
  const total = Math.floor(0.3 * SR);
  const hp = makeHPF();
  const f = makeFilter();
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const noise = rnd();
    const body = Math.sin(2 * Math.PI * 186 * t) * 0.35 + Math.sin(2 * Math.PI * 331 * t) * 0.2;
    const a = Math.exp(-t * (brush > 0.5 ? 11 : 19)) * gain;
    const x = f(hp(noise, 900), 5200) * (1 - brush * 0.45) * a + body * a * 0.55;
    buf.L[idx] += x;
    buf.R[idx] += x;
  }
}

function addHat(buf, start, gain = 0.13, open = false) {
  const s0 = Math.floor(start * SR);
  const dur = open ? 0.22 : 0.055;
  const total = Math.floor(dur * SR);
  const hp = makeHPF();
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const a = Math.exp(-t * (open ? 14 : 62)) * gain;
    const x = hp(rnd(), 7200) * a;
    buf.L[idx] += x * 1.08;
    buf.R[idx] += x * 0.92;
  }
}

function addRim(buf, start, gain = 0.16) {
  const s0 = Math.floor(start * SR);
  const total = Math.floor(0.09 * SR);
  for (let i = 0; i < total; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.n) continue;
    const t = i / SR;
    const a = Math.exp(-t * 48) * gain;
    const x = (Math.sin(2 * Math.PI * 1720 * t) * 0.6 + rnd() * 0.4) * a;
    buf.L[idx] += x;
    buf.R[idx] += x * 0.85;
  }
}

/* ------------------------------------------------------------ master & tape */

function tapeWear(buf, { wow = 0.0022, flutter = 0.0006, hiss = 0.0055, crackle = 0.5, sat = 1.25 }) {
  const n = buf.n;
  const srcL = Float32Array.from(buf.L);
  const srcR = Float32Array.from(buf.R);

  // tape hiss + a gentle high-pass so it sits behind the music
  const hpL = makeHPF();
  const hpR = makeHPF();
  let crackleAt = 0;
  for (let i = 0; i < n; i++) {
    const nz = hpL(rnd(), 1400);
    const nz2 = hpR(rnd(), 1400);
    buf.L[i] = srcL[i] + nz * hiss;
    buf.R[i] = srcR[i] + nz2 * hiss;
  }

  // vinyl / shell crackle: sparse short pops
  for (let i = 0; i < n; i += 1) {
    if (i < crackleAt) continue;
    if (rnd() > 0.9985) {
      const len = Math.floor((0.002 + Math.abs(rnd()) * 0.01) * SR);
      const amp = (0.05 + Math.abs(rnd()) * 0.22) * crackle;
      for (let k = 0; k < len && i + k < n; k++) {
        const envk = 1 - k / len;
        buf.L[i + k] += rnd() * amp * envk;
        buf.R[i + k] += rnd() * amp * envk;
      }
      crackleAt = i + len;
    }
  }

  // wow & flutter via variable-rate resampling
  let rpL = 0;
  let rpR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const mod = 1 + wow * Math.sin(2 * Math.PI * 0.55 * t) + flutter * Math.sin(2 * Math.PI * 6.3 * t + 1.1);
    rpL += mod;
    rpR += mod;
    const i0 = Math.floor(rpL);
    const fL = rpL - i0;
    const j0 = Math.floor(rpR);
    const fR = rpR - j0;
    const a = i0 < n - 1 ? i0 : n - 1;
    const b = i0 + 1 < n ? i0 + 1 : n - 1;
    const c = j0 < n - 1 ? j0 : n - 1;
    const d = j0 + 1 < n ? j0 + 1 : n - 1;
    buf.L[i] = buf.L[a] * (1 - fL) + buf.L[b] * fL;
    buf.R[i] = buf.R[c] * (1 - fR) + buf.R[d] * fR;
  }

  // soft saturation + fade tails
  const fade = Math.floor(1.2 * SR);
  for (let i = 0; i < n; i++) {
    const tail = i > n - fade ? (n - i) / fade : 1;
    buf.L[i] = Math.tanh(buf.L[i] * sat) / Math.tanh(sat) * tail;
    buf.R[i] = Math.tanh(buf.R[i] * sat) / Math.tanh(sat) * tail;
  }

  // normalize to -1.2 dBFS
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  const g = peak > 0 ? 0.86 / peak : 1;
  for (let i = 0; i < n; i++) {
    buf.L[i] *= g;
    buf.R[i] *= g;
  }
}

function writeWav(buf, file) {
  const n = buf.n;
  const bytes = Buffer.alloc(44 + n * 4);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + n * 4, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, buf.L[i]));
    const r = Math.max(-1, Math.min(1, buf.R[i]));
    bytes.writeInt16LE((l * 32767) | 0, 44 + i * 4);
    bytes.writeInt16LE((r * 32767) | 0, 46 + i * 4);
  }
  fs.writeFileSync(file, bytes);
}

/* ------------------------------------------------------------------- songs */

const CH = {
  min7: (r) => [r, r + 3, r + 7, r + 10],
  maj7: (r) => [r, r + 4, r + 7, r + 11],
  dom7: (r) => [r, r + 4, r + 7, r + 10],
  min9: (r) => [r, r + 3, r + 7, r + 10, r + 14],
  maj9: (r) => [r, r + 4, r + 7, r + 11, r + 14],
  sus2: (r) => [r, r + 2, r + 7, r + 12],
  dim: (r) => [r, r + 3, r + 6, r + 9],
  open: (r) => [r, r + 7, r + 10, r + 14],
};

function renderSong(cfg) {
  const { bpm, bars, beatsPerBar = 4, progression, drums = true, style } = cfg;
  const beat = 60 / bpm;
  const barLen = beat * beatsPerBar;
  const total = barLen * bars + 2.6;
  const buf = makeStereo(total);
  const chords = progression;

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barLen;
    const chord = chords[bar % chords.length];
    const notes = CH[chord.type](chord.root);
    const root = chord.root - 12;

    if (style !== "ambient") {
      addPad(buf, {
        start: t0,
        dur: barLen * 0.92,
        notes: notes.map((n) => n + (style === "padUp" ? 0 : 0)),
        gain: style === "ambient" ? 0.13 : 0.085,
        cutoff: style === "padDark" ? 950 : 1500,
        detune: style === "padDark" ? 0.009 : 0.006,
      });
    } else {
      addPad(buf, {
        start: t0,
        dur: barLen * 1.6,
        notes: notes,
        gain: 0.14,
        cutoff: 1200,
        detune: 0.008,
        type: "tri",
      });
    }

    // bass
    if (style === "drive") {
      for (let b = 0; b < beatsPerBar; b++) {
        const n = b === 3 ? root + (chord.alt ?? 7) : root;
        addBass(buf, { start: t0 + b * beat, dur: beat * 0.55, midi: n, gain: 0.34, cutoff: 420 });
      }
    } else if (style === "blues") {
      const walk = [0, chord.walk ?? 3, 5, 7];
      for (let b = 0; b < beatsPerBar; b++) {
        addBass(buf, {
          start: t0 + b * beat,
          dur: beat * 0.78,
          midi: root + walk[b % walk.length],
          gain: 0.3,
          cutoff: 380,
        });
      }
    } else if (style !== "ambient") {
      addBass(buf, { start: t0, dur: beat * 1.6, midi: root, gain: 0.28, cutoff: 360 });
      addBass(buf, { start: t0 + beat * 2.5, dur: beat * 1.1, midi: root + 7, gain: 0.2, cutoff: 360 });
    } else {
      addBass(buf, { start: t0, dur: barLen * 0.9, midi: root - 12, gain: 0.16, cutoff: 260 });
    }

    // arpeggio / melody
    if (style === "lofi") {
      const arp = [0, 2, 3, 2, 1, 2, 3, 1];
      for (let s = 0; s < 8; s++) {
        const n = notes[arp[s] % notes.length] + 12;
        addPluck(buf, {
          start: t0 + s * (beat / 2),
          dur: beat * 0.4,
          midi: n,
          gain: 0.075,
          cutoff: 2400 + (s % 3) * 700,
          pan: s % 2 ? 0.35 : -0.35,
        });
      }
    } else if (style === "ambient") {
      if (bar % 2 === 0) {
        addBell(buf, { start: t0, midi: notes[notes.length - 1] + 12, gain: 0.1, pan: -0.4 });
        addBell(buf, { start: t0 + beat * 2, midi: notes[1] + 12, gain: 0.08, pan: 0.45 });
      }
    } else if (style === "blues") {
      if (bar % 2 === 1) {
        for (let s = 0; s < 4; s++) {
          addPluck(buf, {
            start: t0 + s * beat + beat / 2,
            dur: beat * 0.35,
            midi: notes[(s + bar) % notes.length] + 12,
            gain: 0.055,
            cutoff: 2200,
            pan: s % 2 ? 0.3 : -0.3,
          });
        }
      }
    } else if (style === "drive") {
      for (let s = 0; s < 8; s++) {
        addPluck(buf, {
          start: t0 + s * (beat / 2),
          dur: beat * 0.3,
          midi: notes[s % notes.length] + 12,
          gain: 0.05,
          cutoff: 3200,
          pan: s % 2 ? 0.4 : -0.4,
        });
      }
    }

    // drums
    if (drums) {
      if (style === "drive") {
        for (let b = 0; b < beatsPerBar; b++) {
          addKick(buf, t0 + b * beat, 0.9);
          addHat(buf, t0 + b * beat + beat / 2, 0.1, true);
        }
        addSnare(buf, t0 + beat, 0.3);
        addSnare(buf, t0 + beat * 3, 0.3);
      } else if (style === "blues") {
        for (let b = 0; b < beatsPerBar; b++) {
          addKick(buf, t0 + b * beat, 0.5);
        }
        addSnare(buf, t0 + beat, 0.22, 1);
        addSnare(buf, t0 + beat * 3, 0.22, 1);
        for (let b = 0; b < beatsPerBar; b++) addHat(buf, t0 + b * beat + beat / 2, 0.06);
      } else if (style === "ambient") {
        if (bar % 2 === 0) addKick(buf, t0, 0.45);
        if (bar % 4 === 2) addSnare(buf, t0 + beat * 2, 0.1, 1);
      } else {
        for (let b = 0; b < beatsPerBar; b++) {
          addKick(buf, t0 + b * beat, 0.62);
        }
        addSnare(buf, t0 + beat * 2, 0.26, 0.7);
        if (bar % 2 === 1) addSnare(buf, t0 + beat * 3.5, 0.12, 1);
        for (let s = 0; s < 8; s++) {
          addHat(buf, t0 + s * (beat / 2), s % 2 ? 0.05 : 0.08, s === 7 && bar % 4 === 3);
        }
        if (bar % 4 === 0) addRim(buf, t0 + beat * 3.5);
      }
    }
  }

  tapeWear(buf, cfg.tape ?? {});
  return buf;
}

const SONGS = [
  {
    file: "neon-rain",
    title: "Neon Rain",
    artist: "Wax Trax Sessions",
    bpm: 74,
    bars: 16,
    style: "lofi",
    progression: [
      { type: "min7", root: 57 },
      { type: "maj7", root: 53 },
      { type: "min7", root: 50 },
      { type: "dom7", root: 52, alt: 10 },
    ],
    tape: { wow: 0.0026, flutter: 0.0008, hiss: 0.006, crackle: 0.7 },
  },
  {
    file: "tape-hiss-blues",
    title: "Tape Hiss Blues",
    artist: "Wax Trax Sessions",
    bpm: 66,
    bars: 12,
    style: "blues",
    progression: [
      { type: "dom7", root: 57, walk: 4 },
      { type: "dom7", root: 52, walk: 3 },
      { type: "dom7", root: 55, walk: 4 },
      { type: "dom7", root: 50, walk: 3 },
      { type: "dom7", root: 57, walk: 4 },
      { type: "dom7", root: 55, walk: 3 },
      { type: "dom7", root: 50, walk: 5 },
      { type: "dom7", root: 45, walk: 4 },
    ],
    tape: { wow: 0.003, flutter: 0.001, hiss: 0.008, crackle: 1.1 },
  },
  {
    file: "midnight-drive",
    title: "Midnight Drive",
    artist: "Wax Trax Sessions",
    bpm: 108,
    bars: 24,
    style: "drive",
    progression: [
      { type: "min9", root: 57 },
      { type: "maj7", root: 53 },
      { type: "maj7", root: 48 },
      { type: "maj7", root: 55 },
    ],
    tape: { wow: 0.0016, flutter: 0.0004, hiss: 0.004, crackle: 0.4 },
  },
  {
    file: "slow-ferry",
    title: "Slow Ferry",
    artist: "Wax Trax Sessions",
    bpm: 68,
    bars: 16,
    style: "padDark",
    drums: true,
    progression: [
      { type: "maj9", root: 50 },
      { type: "min7", root: 47 },
      { type: "maj7", root: 43 },
      { type: "sus2", root: 45 },
    ],
    tape: { wow: 0.0024, flutter: 0.0009, hiss: 0.0065, crackle: 0.6 },
  },
  {
    file: "static-bloom",
    title: "Static Bloom",
    artist: "Wax Trax Sessions",
    bpm: 60,
    bars: 12,
    style: "ambient",
    drums: false,
    progression: [
      { type: "min9", root: 57 },
      { type: "min7", root: 52 },
      { type: "maj7", root: 48 },
      { type: "maj7", root: 55 },
    ],
    tape: { wow: 0.0032, flutter: 0.0012, hiss: 0.0075, crackle: 0.9, sat: 1.1 },
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];

for (const song of SONGS) {
  const started = Date.now();
  const buf = renderSong(song);
  const wav = path.join(TMP_DIR, `${song.file}.wav`);
  const mp3 = path.join(OUT_DIR, `${song.file}.mp3`);
  writeWav(buf, wav);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    wav,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "112k",
    "-ar",
    "44100",
    mp3,
  ]);
  const kb = Math.round(fs.statSync(mp3).size / 1024);
  const seconds = Math.round(buf.seconds * 10) / 10;
  manifest.push({ id: song.file, title: song.title, artist: song.artist, src: `./tracks/${song.file}.mp3`, duration: seconds });
  console.log(`  ${song.title.padEnd(18)} ${seconds}s -> ${kb} KB  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.rmSync(TMP_DIR, { recursive: true, force: true });
console.log("Done. Wrote", SONGS.length, "tracks to", OUT_DIR);
