import { AnimatePresence, motion } from "framer-motion";
import { Disc3, ListMusic, Moon, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Backdrop } from "./components/Backdrop";
import { Cassette } from "./components/Cassette";
import { Playlist } from "./components/Playlist";
import { SeekBar } from "./components/SeekBar";
import { Spectrum } from "./components/Spectrum";
import { Transport } from "./components/Transport";
import { usePlayer } from "./lib/audio";
import { formatTime } from "./lib/tracks";

const SLEEP_STEPS = [15, 30, 60];

export default function App() {
  const player = usePlayer();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [hinted, setHinted] = useState(true);

  const current = player.current;
  const accent = current?.accent ?? ["#ff9d4d", "#f0679f"];

  useEffect(() => {
    document.body.classList.add("is-booting");
    const t = window.setTimeout(() => document.getElementById("boot")?.remove(), 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (player.isPlaying) setHinted(false);
  }, [player.isPlaying]);

  const cycleSleep = () => {
    const current = player.sleepMinutes;
    if (current === null) {
      player.setSleepMinutes(SLEEP_STEPS[0]);
      return;
    }
    const at = SLEEP_STEPS.indexOf(current);
    if (at === -1 || at === SLEEP_STEPS.length - 1) player.setSleepMinutes(null);
    else player.setSleepMinutes(SLEEP_STEPS[at + 1]);
  };

  return (
    <div className="relative flex min-h-dvh flex-col text-bone-100">
      <Backdrop metricsRef={player.metricsRef} accent={accent} />

      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06]">
            <Disc3 size={18} className="text-ember-400" />
          </span>
          <div>
            <h1 className="font-display text-[15px] font-extrabold uppercase leading-none tracking-[0.22em]">
              Wax Trax
            </h1>
            <p className="label-text mt-1">Cassette deck</p>
          </div>
        </div>

        <button
          type="button"
          onClick={cycleSleep}
          aria-label="Sleep timer"
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] tabular-nums transition-colors ${
            player.sleepMinutes
              ? "border-ember-400/50 bg-ember-400/10 text-ember-300"
              : "border-white/10 bg-white/[0.04] text-bone-500 hover:text-bone-100"
          }`}
        >
          {player.sleepMinutes ? <Timer size={13} /> : <Moon size={13} />}
          {player.sleepMinutes ? formatTime(player.sleepLeft) : "sleep"}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-5 py-6">
        <div className="flex items-center justify-between">
          <span className="hud-label">Now playing</span>
          <span className="hud-label">C-60 · type II chrome</span>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            <Cassette
              key={current?.id}
              title={current?.title ?? ""}
              artist={current?.artist ?? ""}
              accent={accent}
              isPlaying={player.isPlaying}
              metricsRef={player.metricsRef}
              progressRef={player.progressRef}
              shuttleRef={player.shuttleRef}
              onToggle={player.toggle}
            />
          </AnimatePresence>

          <AnimatePresence>
            {hinted && !player.isPlaying && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-bone-500"
              >
                tap the deck to play
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center">
          <h2 className="truncate font-display text-2xl font-bold tracking-tight" title={current?.title}>
            {current?.title}
          </h2>
          <p className="label-text mt-1.5">{current?.artist}</p>
        </div>

        <SeekBar
          currentTime={player.currentTime}
          duration={player.duration}
          onSeek={player.seek}
          accent={accent}
        />

        <Transport
          isPlaying={player.isPlaying}
          isReady={player.isReady}
          shuffle={player.shuffle}
          repeat={player.repeat}
          volume={player.volume}
          accent={accent}
          onToggle={player.toggle}
          onPrev={player.prev}
          onNext={player.next}
          onShuffle={player.toggleShuffle}
          onCycleRepeat={player.cycleRepeat}
          onVolume={player.setVolume}
        />

        <Spectrum spectrumRef={player.spectrumRef} isPlaying={player.isPlaying} accent={accent} />
      </main>

      <footer
        className="mx-auto w-full max-w-lg px-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 text-sm font-semibold text-bone-100 backdrop-blur-xl transition-colors hover:border-ember-400/40 hover:bg-white/[0.08]"
        >
          <ListMusic size={17} className="text-ember-400" />
          Tape library
          <span className="font-mono text-[11px] text-bone-500">({player.tracks.length})</span>
        </button>
        <p className="label-text mt-3 text-center">
          space play · ← → seek · n / p track
        </p>
      </footer>

      <Playlist
        open={libraryOpen}
        tracks={player.tracks}
        index={player.index}
        isPlaying={player.isPlaying}
        onClose={() => setLibraryOpen(false)}
        onPlayAt={(i) => {
          player.playAt(i);
          setLibraryOpen(false);
        }}
        onImport={(files) => void player.addFiles(files)}
        onRemove={player.removeTrack}
      />
    </div>
  );
}
