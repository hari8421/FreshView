import { memo } from "react";
import { motion } from "framer-motion";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { RepeatMode } from "../lib/audio";

type Props = {
  isPlaying: boolean;
  isReady: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  accent: [string, string];
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onCycleRepeat: () => void;
  onVolume: (v: number) => void;
};

const iconProps = { size: 22, strokeWidth: 1.75 } as const;

export const Transport = memo(function Transport({
  isPlaying,
  isReady,
  shuffle,
  repeat,
  volume,
  accent,
  onToggle,
  onPrev,
  onNext,
  onShuffle,
  onCycleRepeat,
  onVolume,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={onShuffle}
          aria-label="Shuffle"
          aria-pressed={shuffle}
          className={`rounded-full p-2.5 transition-colors ${shuffle ? "text-ember-400" : "text-bone-500 hover:text-bone-100"}`}
        >
          <Shuffle {...iconProps} size={19} />
        </button>

        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous track"
          className="rounded-full p-3 text-bone-100 transition-transform hover:scale-105 active:scale-95"
        >
          <SkipBack {...iconProps} />
        </button>

        <motion.button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          whileTap={{ scale: 0.92 }}
          className="relative grid h-[74px] w-[74px] place-items-center rounded-full text-ink-900"
          style={{
            background: `linear-gradient(150deg, ${accent[0]}, ${accent[1]})`,
            boxShadow: `0 18px 40px -12px ${accent[0]}, inset 0 1px 0 rgba(255,255,255,0.5)`,
          }}
        >
          {isPlaying ? <Pause size={30} strokeWidth={2.2} fill="currentColor" /> : <Play size={30} strokeWidth={2.2} fill="currentColor" className="ml-1" />}
          {!isReady && (
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-white/40" />
          )}
        </motion.button>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next track"
          className="rounded-full p-3 text-bone-100 transition-transform hover:scale-105 active:scale-95"
        >
          <SkipForward {...iconProps} />
        </button>

        <button
          type="button"
          onClick={onCycleRepeat}
          aria-label={`Repeat: ${repeat}`}
          className={`relative rounded-full p-2.5 transition-colors ${repeat === "off" ? "text-bone-500 hover:text-bone-100" : "text-ember-400"}`}
        >
          {repeat === "one" ? <Repeat1 {...iconProps} size={19} /> : <Repeat {...iconProps} size={19} />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {volume === 0 ? <VolumeX size={16} className="shrink-0 text-bone-500" /> : <Volume2 size={16} className="shrink-0 text-bone-500" />}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          aria-label="Volume"
          className="h-1 w-full cursor-pointer rounded-full bg-white/15"
          style={{
            background: `linear-gradient(90deg, ${accent[0]} ${volume * 100}%, rgba(255,255,255,0.15) ${volume * 100}%)`,
          }}
        />
      </div>
    </div>
  );
});
