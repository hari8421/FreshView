import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { AudioMetrics } from "../lib/audio";

const CX_L = 112;
const CX_R = 228;
const CY = 132;
const R_EMPTY = 22;
const R_FULL = 37;
/** angular velocity = TAPE_K / packRadius, so the full reel turns slower. */
const TAPE_K = 225;

type Props = {
  title: string;
  artist: string;
  accent: [string, string];
  isPlaying: boolean;
  metricsRef: React.MutableRefObject<AudioMetrics>;
  progressRef: React.MutableRefObject<number>;
  shuttleRef: React.MutableRefObject<number>;
  onToggle: () => void;
};

const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export const Cassette = memo(function Cassette({
  title,
  artist,
  accent,
  isPlaying,
  metricsRef,
  progressRef,
  shuttleRef,
  onToggle,
}: Props) {
  const deckRef = useRef<HTMLDivElement>(null);
  const reelLRef = useRef<SVGGElement>(null);
  const reelRRef = useRef<SVGGElement>(null);
  const packLRef = useRef<SVGCircleElement>(null);
  const packRRef = useRef<SVGCircleElement>(null);
  const tapeLRef = useRef<SVGLineElement>(null);
  const tapeRRef = useRef<SVGLineElement>(null);
  const rollerRef = useRef<SVGGElement>(null);
  const ledRef = useRef<SVGCircleElement>(null);

  const stateRef = useRef({ a: 0, b: 120, t: 0, playing: isPlaying });
  const ids = `grad-${title.replace(/\W/g, "")}`;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      s.t += dt;
      s.playing = isPlaying;

      const p = progressRef.current;
      const shuttle = shuttleRef.current;
      const rL = R_EMPTY + (R_FULL - R_EMPTY) * (1 - p);
      const rR = R_EMPTY + (R_FULL - R_EMPTY) * p;

      let omegaL: number;
      let omegaR: number;
      if (shuttle > 0.01) {
        // fast rewind / fast-forward wind
        const boost = shuttle * 34;
        omegaL = -boost;
        omegaR = -boost;
      } else if (isPlaying) {
        omegaL = TAPE_K / rL;
        omegaR = TAPE_K / rR;
      } else {
        omegaL = 0;
        omegaR = 0;
      }
      s.a += omegaL * dt;
      s.b += omegaR * dt;

      if (reelLRef.current) reelLRef.current.setAttribute("transform", `rotate(${s.a} ${CX_L} ${CY})`);
      if (reelRRef.current) reelRRef.current.setAttribute("transform", `rotate(${s.b} ${CX_R} ${CY})`);
      if (packLRef.current) packLRef.current.setAttribute("r", rL.toFixed(2));
      if (packRRef.current) packRRef.current.setAttribute("r", rR.toFixed(2));
      if (tapeLRef.current) tapeLRef.current.setAttribute("y1", (CY + rL).toFixed(2));
      if (tapeRRef.current) tapeRRef.current.setAttribute("y1", (CY + rR).toFixed(2));
      if (rollerRef.current) rollerRef.current.setAttribute("transform", `rotate(${s.b * 1.4} 214 196)`);

      const level = metricsRef.current.level;
      if (ledRef.current) ledRef.current.setAttribute("opacity", isPlaying ? (0.55 + level * 0.45).toFixed(2) : "0.12");
      if (deckRef.current) {
        const jitter = isPlaying ? Math.min(0.75, level * 0.9) : 0.16;
        const w = Math.sin(s.t * 26) * jitter;
        const tilt = Math.sin(s.t * 19 + 1.2) * jitter * 0.22;
        deckRef.current.style.transform = `translate3d(${w.toFixed(2)}px, ${(Math.cos(s.t * 23) * jitter * 0.6).toFixed(2)}px, 0) rotate(${tilt.toFixed(3)}deg)`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, metricsRef, progressRef, shuttleRef]);

  const side = isPlaying ? "PLAY" : "STOP";

  return (
    <motion.div
      key={title}
      initial={{ opacity: 0, y: 26, rotate: -3, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, y: -22, rotate: 3, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="w-full"
    >
      <motion.button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        whileTap={{ scale: 0.985 }}
        className="block w-full focus:outline-none"
      >
        <div className="relative isolate">
          {/* static soft shadow behind the deck: a filter here would have to be
              re-rasterised on every frame because the reels are always moving */}
          <div className="pointer-events-none absolute inset-x-[8%] top-[22%] z-0 h-[62%] rounded-[50%] bg-black/70 blur-2xl" />
          <div ref={deckRef} className="relative z-10 will-change-transform">
          <svg viewBox="0 0 340 224" className="relative w-full">
            <title>{`${title} — ${artist}`}</title>
            <defs>
              <linearGradient id={`${ids}-shell`} x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                <stop offset="45%" stopColor="#ffffff" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.14" />
              </linearGradient>
              <linearGradient id={`${ids}-label`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={accent[0]} />
                <stop offset="100%" stopColor={accent[1]} />
              </linearGradient>
              <radialGradient id={`${ids}-tape`} cx="0.4" cy="0.35" r="0.8">
                <stop offset="0%" stopColor="#4a2f21" />
                <stop offset="70%" stopColor="#241610" />
                <stop offset="100%" stopColor="#150c08" />
              </radialGradient>
              <linearGradient id={`${ids}-glass`} x1="0" y1="0" x2="0.7" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="42%" stopColor="#ffffff" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.14" />
              </linearGradient>
              <clipPath id={`${ids}-window`}>
                <rect x="40" y="90" width="260" height="84" rx="12" />
              </clipPath>
            </defs>

            {/* shell */}
            <rect x="5" y="5" width="330" height="214" rx="20" fill={`url(#${ids}-shell)`} />
            <rect
              x="5.75"
              y="5.75"
              width="328.5"
              height="212.5"
              rx="19.5"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <rect
              x="5.75"
              y="5.75"
              width="328.5"
              height="212.5"
              rx="19.5"
              fill="none"
              stroke={accent[0]}
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />

            {/* screws */}
            {[
              [20, 20],
              [320, 20],
              [20, 204],
              [320, 204],
            ].map(([cx, cy]) => (
              <g key={`${cx}-${cy}`}>
                <circle cx={cx} cy={cy} r="4" fill="#0d0918" fillOpacity="0.85" stroke="#ffffff" strokeOpacity="0.3" />
                <line x1={cx - 2.4} y1={cy} x2={cx + 2.4} y2={cy} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
              </g>
            ))}

            {/* label */}
            <rect x="32" y="20" width="276" height="64" rx="9" fill={`url(#${ids}-label)`} />
            <rect x="32" y="20" width="276" height="64" rx="9" fill="#0a0713" fillOpacity="0.12" />
            <text
              x="46"
              y="50"
              fill="#0d0918"
              fontSize="17"
              fontWeight="800"
              letterSpacing="-0.3"
              fontFamily="system-ui, sans-serif"
            >
              {short(title, 24)}
            </text>
            <text
              x="46"
              y="70"
              fill="#0d0918"
              fillOpacity="0.72"
              fontSize="9.5"
              letterSpacing="2.2"
              fontFamily="ui-monospace, monospace"
            >
              {artist.toUpperCase()}
            </text>
            <text
              x="296"
              y="42"
              fill="#0d0918"
              fillOpacity="0.8"
              fontSize="9"
              letterSpacing="2"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
            >
              SIDE A
            </text>
            {/* pencil lines on the label */}
            <line x1="46" y1="76" x2="294" y2="76" stroke="#0d0918" strokeOpacity="0.25" strokeWidth="1" />
            <line x1="46" y1="32" x2="294" y2="32" stroke="#0d0918" strokeOpacity="0.18" strokeWidth="1" />

            {/* window interior */}
            <g clipPath={`url(#${ids}-window)`}>
              <rect x="40" y="90" width="260" height="84" rx="12" fill="#0c0817" fillOpacity="0.92" />
              <rect x="40" y="90" width="260" height="84" fill={accent[0]} opacity="0.07" />

              {/* tape path across the bottom of the window */}
              <line ref={tapeLRef} x1={CX_L} y1={CY + R_FULL} x2={CX_L} y2="180" stroke="#1a100b" strokeWidth="4" />
              <line ref={tapeRRef} x1={CX_R} y1={CY + R_EMPTY} x2={CX_R} y2="180" stroke="#1a100b" strokeWidth="4" />
              <rect x="104" y="177" width="132" height="8" rx="3" fill="#1a100b" />
              <rect x="104" y="177" width="132" height="2.5" rx="1" fill="#6b4a35" fillOpacity="0.7" />

              {/* supply reel */}
              <g ref={reelLRef}>
                <circle ref={packLRef} cx={CX_L} cy={CY} r={R_FULL} fill={`url(#${ids}-tape)`} />
                <circle cx={CX_L} cy={CY} r={R_FULL} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="1" />
                <circle cx={CX_L} cy={CY} r={R_FULL - 3} fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1" />
                {Array.from({ length: 3 }, (_, i) => (
                  <circle
                    key={i}
                    cx={CX_L}
                    cy={CY}
                    r={R_EMPTY + 2 + i * 4.5}
                    fill="none"
                    stroke="#00000022"
                    strokeWidth="1"
                  />
                ))}
                <g className="hub">
                  <circle cx={CX_L} cy={CY} r="13" fill="#efe6d6" />
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <rect
                      key={deg}
                      x={CX_L - 2}
                      y={CY - 13}
                      width="4"
                      height="5"
                      rx="1"
                      fill="#0d0918"
                      fillOpacity="0.75"
                      transform={`rotate(${deg} ${CX_L} ${CY})`}
                    />
                  ))}
                  <circle cx={CX_L} cy={CY} r="5" fill="#0d0918" />
                  <circle cx={CX_L} cy={CY} r="2" fill="#efe6d6" fillOpacity="0.6" />
                </g>
              </g>

              {/* take-up reel */}
              <g ref={reelRRef}>
                <circle ref={packRRef} cx={CX_R} cy={CY} r={R_EMPTY} fill={`url(#${ids}-tape)`} />
                <circle cx={CX_R} cy={CY} r={R_FULL} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="1" />
                <circle cx={CX_R} cy={CY} r={R_FULL} fill={accent[0]} opacity="0.05" />
                {Array.from({ length: 3 }, (_, i) => (
                  <circle
                    key={i}
                    cx={CX_R}
                    cy={CY}
                    r={R_EMPTY + 2 + i * 4.5}
                    fill="none"
                    stroke="#00000022"
                    strokeWidth="1"
                  />
                ))}
                <g className="hub">
                  <circle cx={CX_R} cy={CY} r="13" fill="#efe6d6" />
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <rect
                      key={deg}
                      x={CX_R - 2}
                      y={CY - 13}
                      width="4"
                      height="5"
                      rx="1"
                      fill="#0d0918"
                      fillOpacity="0.75"
                      transform={`rotate(${deg} ${CX_R} ${CY})`}
                    />
                  ))}
                  <circle cx={CX_R} cy={CY} r="5" fill="#0d0918" />
                  <circle cx={CX_R} cy={CY} r="2" fill="#efe6d6" fillOpacity="0.6" />
                </g>
              </g>

              {/* glass */}
              <rect x="40" y="90" width="260" height="84" rx="12" fill={`url(#${ids}-glass)`} />
              <path d="M52 90 L124 90 L64 174 L40 174 Z" fill="#ffffff" opacity="0.07" />
            </g>
            <rect
              x="40"
              y="90"
              width="260"
              height="84"
              rx="12"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />

            {/* head block, capstan and pinch roller */}
            <rect x="146" y="184" width="48" height="22" rx="5" fill="#171126" stroke="#ffffff" strokeOpacity="0.18" />
            <rect x="152" y="188" width="10" height="14" rx="3" fill="#efe6d6" fillOpacity="0.85" />
            <rect x="178" y="188" width="10" height="14" rx="3" fill="#efe6d6" fillOpacity="0.85" />
            <circle cx="206" cy="196" r="3" fill="#0d0918" fillOpacity="0.7" />
            <g ref={rollerRef}>
              <circle cx="222" cy="196" r="9" fill="#1b1526" stroke="#ffffff" strokeOpacity="0.25" />
              <rect x="221" y="188" width="2" height="16" fill="#ffffff" fillOpacity="0.35" />
              <rect x="215" y="195" width="14" height="2" fill="#ffffff" fillOpacity="0.35" />
            </g>
            <circle cx="104" cy="181" r="4" fill="#efe6d6" fillOpacity="0.7" />
            <circle cx="238" cy="181" r="4" fill="#efe6d6" fillOpacity="0.7" />

            {/* bottom print */}
            <text x="36" y="211" fill="#ffffff" fillOpacity="0.5" fontSize="8" letterSpacing="2.4" fontFamily="ui-monospace, monospace">
              WAX TRAX
            </text>
            <text
              x="304"
              y="211"
              fill="#ffffff"
              fillOpacity="0.5"
              fontSize="8"
              letterSpacing="2.4"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
            >
              {side} · CHROME
            </text>

            {/* record LED */}
            <circle ref={ledRef} cx="300" cy="40" r="3.4" fill={accent[0]} opacity="0.12" />
          </svg>
          </div>
        </div>
      </motion.button>
    </motion.div>
  );
});
