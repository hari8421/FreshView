export type Track = {
  id: string;
  title: string;
  artist: string;
  src: string;
  /** Seconds. 0 when unknown (imported files resolve on load). */
  duration: number;
  /** Two-stop gradient used for the label, reels and backdrop bloom. */
  accent: [string, string];
  builtIn?: boolean;
};

const base = import.meta.env.BASE_URL || "./";

export const BUILT_IN_TRACKS: Track[] = [
  {
    id: "neon-rain",
    title: "Neon Rain",
    artist: "Wax Trax Sessions",
    src: `${base}tracks/neon-rain.mp3`,
    duration: 54.5,
    accent: ["#ff9d4d", "#f0679f"],
    builtIn: true,
  },
  {
    id: "tape-hiss-blues",
    title: "Tape Hiss Blues",
    artist: "Wax Trax Sessions",
    src: `${base}tracks/tape-hiss-blues.mp3`,
    duration: 46.2,
    accent: ["#47e0c8", "#1fc2ab"],
    builtIn: true,
  },
  {
    id: "midnight-drive",
    title: "Midnight Drive",
    artist: "Wax Trax Sessions",
    src: `${base}tracks/midnight-drive.mp3`,
    duration: 55.9,
    accent: ["#f0679f", "#8f6bff"],
    builtIn: true,
  },
  {
    id: "slow-ferry",
    title: "Slow Ferry",
    artist: "Wax Trax Sessions",
    src: `${base}tracks/slow-ferry.mp3`,
    duration: 59.1,
    accent: ["#ffc48a", "#ff7a3d"],
    builtIn: true,
  },
  {
    id: "static-bloom",
    title: "Static Bloom",
    artist: "Wax Trax Sessions",
    src: `${base}tracks/static-bloom.mp3`,
    duration: 50.6,
    accent: ["#8ff5e6", "#8f6bff"],
    builtIn: true,
  },
];

export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};
