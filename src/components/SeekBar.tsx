import { useCallback, useRef, useState } from "react";
import { formatTime } from "../lib/tracks";

type Props = {
  currentTime: number;
  duration: number;
  onSeek: (ratio: number) => void;
  accent: [string, string];
};

/** Tape position scrubber — drag anywhere on the rail. */
export function SeekBar({ currentTime, duration, onSeek, accent }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const ratioAt = useCallback((clientX: number) => {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const shown = dragRatio ?? hover;

  return (
    <div className="w-full select-none">
      <div
        ref={railRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(duration))}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        className="group relative -my-2 flex h-11 cursor-pointer touch-none items-center py-3"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* capture is an optimisation; scrubbing works without it */
          }
          const r = ratioAt(e.clientX);
          setDragging(true);
          setDragRatio(r);
          onSeek(r);
        }}
        onPointerMove={(e) => {
          const r = ratioAt(e.clientX);
          setHover(r);
          if (dragging) {
            setDragRatio(r);
            onSeek(r);
          }
        }}
        onPointerUp={() => {
          setDragging(false);
          setDragRatio(null);
        }}
        onPointerCancel={() => {
          setDragging(false);
          setDragRatio(null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-white/10 shadow-inner">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${(shown ?? progress) * 100}%`,
              background: `linear-gradient(90deg, ${accent[0]}, ${accent[1]})`,
              boxShadow: `0 0 18px -2px ${accent[0]}`,
            }}
          />
          <div
            className="absolute inset-y-0 w-6 -translate-x-1/2 rounded-full bg-bone-100 opacity-0 shadow-[0_0_0_4px_rgba(255,157,77,0.25)] transition-opacity group-hover:opacity-100"
            style={{ left: `${(shown ?? progress) * 100}%`, opacity: dragging ? 1 : undefined }}
          />
        </div>
        {shown !== null && (
          <div
            className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-md border border-white/15 bg-ink-700/95 px-1.5 py-0.5 font-mono text-[10px] text-bone-100"
            style={{ left: `${shown * 100}%` }}
          >
            {formatTime(shown * duration)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-bone-500">
        <span className="text-bone-100">{formatTime(currentTime)}</span>
        <span className="hud-label">tape position</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
