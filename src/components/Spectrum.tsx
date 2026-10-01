import { memo, useEffect, useRef } from "react";

type Props = {
  spectrumRef: React.MutableRefObject<Uint8Array>;
  isPlaying: boolean;
  accent: [string, string];
  bars?: number;
};

/**
 * Deck spectrum: reads the live analyser bins straight into a canvas so it
 * never triggers a React render, with slowly falling peak markers.
 */
export const Spectrum = memo(function Spectrum({ spectrumRef, isPlaying, accent, bars = 44 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let peaks = new Float32Array(bars);
    const smooth = new Float32Array(bars);
    let grad: CanvasGradient | null = null;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      grad = null;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const data = spectrumRef.current;
      const usable = isPlaying && data && data.length ? data : null;
      if (!grad) {
        grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, accent[0]);
        grad.addColorStop(0.55, accent[1]);
        grad.addColorStop(1, "#ffffff");
      }

      const gap = 2;
      const barW = Math.max(1.5, (w - gap * (bars - 1)) / bars);

      for (let i = 0; i < bars; i++) {
        // logarithmic bucket mapping so the low end is not squashed
        const lo = Math.floor(Math.pow(i / bars, 1.7) * (usable ? usable.length : 1));
        const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / bars, 1.7) * (usable ? usable.length : 1)));
        let sum = 0;
        let count = 0;
        if (usable) {
          for (let k = lo; k < hi && k < usable.length; k++) {
            sum += usable[k] / 255;
            count++;
          }
        }
        const raw = count ? (sum / count) * (1 + i / bars) * 1.15 : 0;
        smooth[i] = raw > smooth[i] ? raw : smooth[i] * 0.86 + raw * 0.14;

        const barH = Math.max(2, smooth[i] * (h - 6));
        const x = i * (barW + gap);
        const y = h - barH;

        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.35 + smooth[i] * 0.65;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, Math.min(barW / 2, 2));
        ctx.fill();

        peaks[i] = Math.max(peaks[i] - 0.011, smooth[i]);
        if (peaks[i] > 0.02) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = "#f7f1e6";
          ctx.fillRect(x, Math.max(0, h - peaks[i] * (h - 6) - 2), barW, 1.5);
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [accent, bars, isPlaying, spectrumRef]);

  return (
    <div className="relative h-11 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 shadow-inner">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
    </div>
  );
});
