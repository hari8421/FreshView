import { useEffect, useRef } from "react";
import type { AudioMetrics } from "../lib/audio";

type Props = {
  metricsRef: React.MutableRefObject<AudioMetrics>;
  accent: [string, string];
};

/**
 * The room the deck sits in: drifting colour blooms that breathe with the
 * music, two oversized echo-reels turning behind everything, plus grain and a
 * vignette.
 *
 * Everything here is deliberately cheap: the blooms are soft radial gradients
 * (never `filter: blur()`, which would force a re-raster every frame), and the
 * per-frame work is limited to opacity and transform, which the compositor
 * handles without repainting.
 */
export function Backdrop({ metricsRef, accent }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = rootRef.current;
      if (!el) return;
      const m = metricsRef.current;
      const s = el.style;
      s.setProperty("--bass", m.bass.toFixed(3));
      s.setProperty("--mid", m.mid.toFixed(3));
      s.setProperty("--high", m.high.toFixed(3));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [metricsRef]);

  return (
    <div ref={rootRef} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-900">
      {/* base wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, ${accent[0]}22 0%, transparent 60%),
                       radial-gradient(90% 60% at 80% 100%, ${accent[1]}1f 0%, transparent 65%),
                       linear-gradient(180deg, #0b0715 0%, #05030a 55%, #0a0611 100%)`,
        }}
      />

      {/* drifting blooms — soft gradients, compositor-only animation */}
      <div
        className="absolute -left-[30%] -top-[22%] aspect-square w-[95%] rounded-full will-change-transform"
        style={{
          background: `radial-gradient(circle, ${accent[0]} 0%, transparent 68%)`,
          opacity: "calc(0.14 + var(--bass) * 0.34)",
          transform: "translate3d(0,0,0) scale(calc(0.92 + var(--bass) * 0.24))",
        }}
      />
      <div
        className="absolute -right-[28%] top-[12%] aspect-square w-[88%] rounded-full will-change-transform"
        style={{
          background: "radial-gradient(circle, #1fc2ab 0%, transparent 70%)",
          opacity: "calc(0.1 + var(--mid) * 0.3)",
          transform: "translate3d(0,0,0) scale(calc(0.94 + var(--mid) * 0.2))",
        }}
      />
      <div
        className="absolute -bottom-[26%] left-[6%] aspect-square w-[85%] rounded-full will-change-transform"
        style={{
          background: `radial-gradient(circle, ${accent[1]} 0%, transparent 70%)`,
          opacity: "calc(0.12 + var(--high) * 0.28)",
          transform: "translate3d(0,0,0) scale(calc(0.92 + var(--high) * 0.18))",
        }}
      />

      {/* echo reels — the deck, echoed into the room */}
      <div className="absolute inset-0 flex items-center justify-between opacity-[0.14]">
        <div className="aspect-square w-[86vw] rounded-full border border-bone-100/25 animate-spin-slow" style={{ animationDuration: "54s" }} />
        <div className="aspect-square w-[56vw] rounded-full border border-ember-400/30 animate-spin-slow" style={{ animationDuration: "31s", animationDirection: "reverse" }} />
      </div>

      {/* vignette + static grain */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(115% 85% at 50% 45%, transparent 45%, rgba(0,0,0,0.72) 100%)" }}
      />
      <div className="grain absolute inset-0 opacity-[0.07]" />
    </div>
  );
}
