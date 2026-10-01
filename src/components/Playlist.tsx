import { AnimatePresence, motion } from "framer-motion";
import { Music4, Plus, Trash2, X } from "lucide-react";
import { useRef } from "react";
import { formatTime, type Track } from "../lib/tracks";

type Props = {
  open: boolean;
  tracks: Track[];
  index: number;
  isPlaying: boolean;
  onClose: () => void;
  onPlayAt: (i: number) => void;
  onImport: (files: FileList) => void;
  onRemove: (id: string) => void;
};

export function Playlist({ open, tracks, index, isPlaying, onClose, onPlayAt, onImport, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close library"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-ink-900/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[78vh] w-full max-w-lg flex-col rounded-t-3xl border-t border-white/10 bg-ink-800/95 shadow-[0_-30px_80px_-30px_rgba(0,0,0,1)] backdrop-blur-2xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">Tape library</h2>
                <p className="label-text mt-0.5">{tracks.length} reels in the drawer</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-2 text-bone-500 transition-colors hover:bg-white/5 hover:text-bone-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
              {tracks.map((track, i) => {
                const active = i === index;
                return (
                  <div
                    key={track.id}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                      active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPlayAt(i)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10"
                        style={{
                          background: `linear-gradient(140deg, ${track.accent[0]}44, ${track.accent[1]}22)`,
                        }}
                      >
                        {active && isPlaying ? (
                          <span className="flex h-3.5 items-end gap-[3px]">
                            <span className="w-[3px] animate-bounce rounded-full bg-bone-100" style={{ height: "60%", animationDelay: "0ms" }} />
                            <span className="w-[3px] animate-bounce rounded-full bg-bone-100" style={{ height: "100%", animationDelay: "140ms" }} />
                            <span className="w-[3px] animate-bounce rounded-full bg-bone-100" style={{ height: "45%", animationDelay: "280ms" }} />
                          </span>
                        ) : (
                          <Music4 size={16} className="text-bone-100/70" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-semibold ${active ? "text-ember-300" : "text-bone-100"}`}>
                          {track.title}
                        </span>
                        <span className="label-text block truncate">{track.artist}</span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-bone-500">
                        {formatTime(track.duration)}
                      </span>
                    </button>
                    {!track.builtIn && (
                      <button
                        type="button"
                        onClick={() => onRemove(track.id)}
                        aria-label={`Remove ${track.title}`}
                        className="rounded-full p-2 text-bone-500 opacity-0 transition hover:bg-white/10 hover:text-rose-400 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}

              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) onImport(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm text-bone-300 transition-colors hover:border-ember-400/60 hover:text-bone-100"
              >
                <Plus size={17} />
                Load your own music
              </button>
              <p className="label-text mt-2 text-center leading-relaxed">
                Imported tracks stay in this session — the deck is offline-first.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
