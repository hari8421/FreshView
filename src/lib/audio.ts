import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILT_IN_TRACKS, type Track } from "./tracks";

export type RepeatMode = "off" | "all" | "one";

export type AudioMetrics = {
  bass: number;
  mid: number;
  high: number;
  level: number;
};

type StoredPrefs = {
  volume?: number;
  repeat?: RepeatMode;
  shuffle?: boolean;
  lastTrackId?: string;
};

const PREFS_KEY = "waxtrax.prefs.v1";
function readPrefs(): StoredPrefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as StoredPrefs;
  } catch {
    return {};
  }
}

function writePrefs(prefs: StoredPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — preferences simply do not persist */
  }
}

const IMPORT_ACCENTS: [string, string][] = [
  ["#ff9d4d", "#f0679f"],
  ["#47e0c8", "#1fc2ab"],
  ["#8ff5e6", "#8f6bff"],
  ["#ffc48a", "#ff7a3d"],
  ["#f0679f", "#8f6bff"],
];

const parseDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.addEventListener("loadedmetadata", () => done(Number.isFinite(probe.duration) ? probe.duration : 0), {
      once: true,
    });
    probe.addEventListener("error", () => done(0), { once: true });
    probe.src = url;
  });

export function usePlayer() {
  const initialPrefs = useMemo(readPrefs, []);

  const [tracks, setTracks] = useState<Track[]>(BUILT_IN_TRACKS);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(BUILT_IN_TRACKS[0].duration);
  const [volume, setVolumeState] = useState(
    typeof initialPrefs.volume === "number" ? Math.min(1, Math.max(0, initialPrefs.volume)) : 0.8,
  );
  const [shuffle, setShuffleState] = useState(Boolean(initialPrefs.shuffle));
  const [repeat, setRepeatState] = useState<RepeatMode>(initialPrefs.repeat ?? "all");
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const binsRef = useRef<Uint8Array>(new Uint8Array(64));
  const indexRef = useRef(index);
  const tracksRef = useRef(tracks);
  const volumeRef = useRef(volume);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const playingRef = useRef(isPlaying);
  const sleepRef = useRef<{ until: number; from: number } | null>(null);
  /** Set when this device cannot run a Web Audio graph, so we stop trying. */
  const graphFailedRef = useRef(false);

  /** Smoothed audio metrics read by the visuals on their own rAF loops. */
  const metricsRef = useRef<AudioMetrics>({ bass: 0, mid: 0, high: 0, level: 0 });
  /** 0..1 tape position, read by the cassette without re-rendering React. */
  const progressRef = useRef(0);
  /** Non-zero while the user scrubs, so the reels can spin. */
  const shuttleRef = useRef(0);

  indexRef.current = index;
  tracksRef.current = tracks;
  volumeRef.current = volume;
  repeatRef.current = repeat;
  shuffleRef.current = shuffle;
  playingRef.current = isPlaying;

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    const el = new Audio();
    el.preload = "auto";
    el.volume = volumeRef.current;
    // The deck has to be cued with tape before it can play anything.
    const first = BUILT_IN_TRACKS[0];
    if (first) {
      el.src = first.src;
      el.load();
    }
    audioRef.current = el;
    return () => {
      el.pause();
      el.removeAttribute("src");
      audioRef.current = null;
    };
  }, []);

  /**
   * Build the Web Audio graph on the first user gesture.
   *
   * Routing the element through a MediaElementSource is one-way: if the context
   * then refuses to run, the deck would go silent. So the context is only asked
   * to run *before* the element is wired into it, and we fall back to plain
   * element playback whenever that is not possible.
   */
  const enableGraph = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;

    if (analyserRef.current) {
      if (ctxRef.current?.state === "suspended") await ctxRef.current.resume().catch(() => undefined);
      return;
    }
    if (graphFailedRef.current) return;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      graphFailedRef.current = true;
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      graphFailedRef.current = true;
      return;
    }
    if (ctx.state !== "running") {
      void ctx.close().catch(() => undefined);
      graphFailedRef.current = true;
      return;
    }

    try {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      const source = ctx.createMediaElementSource(el);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      binsRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      graphFailedRef.current = true;
    }
  }, []);

  const startPlayback = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.getAttribute("src")) {
      const first = tracksRef.current[indexRef.current];
      if (first) {
        el.src = first.src;
        el.load();
      }
    }
    await enableGraph();
    try {
      await el.play();
    } catch {
      /* blocked by the platform until the next gesture */
    }
  }, [enableGraph]);

  /* ------------------------------------------------------------ media events */

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
        setTracks((list) =>
          list.map((t, i) => (i === indexRef.current ? { ...t, duration: el.duration } : t)),
        );
      }
      setIsReady(true);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsReady(false);
    const onCanPlay = () => setIsReady(true);
    const onEnded = () => {
      if (repeatRef.current === "one") {
        el.currentTime = 0;
        void startPlayback();
        return;
      }
      step(1, true);
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("playing", onCanPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("playing", onCanPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPlayback]);

  /* ------------------------------------------------------------- metrics loop */

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPush = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const el = audioRef.current;
      const m = metricsRef.current;
      const analyser = analyserRef.current;

      let bass = 0;
      let mid = 0;
      let high = 0;
      let level = 0;

      if (analyser && el && !el.paused && el.readyState >= 2) {
        const bins = binsRef.current;
        analyser.getByteFrequencyData(bins);
        let b = 0;
        let md = 0;
        let h = 0;
        const lowEnd = Math.max(2, Math.floor(bins.length * 0.08));
        const midEnd = Math.floor(bins.length * 0.32);
        for (let i = 1; i < bins.length; i++) {
          const v = bins[i] / 255;
          if (i < lowEnd) b += v;
          else if (i < midEnd) md += v;
          else h += v;
        }
        bass = b / lowEnd;
        mid = md / Math.max(1, midEnd - lowEnd);
        high = h / Math.max(1, bins.length - midEnd);
        level = (bass * 0.45 + mid * 0.35 + high * 0.2) * 1.35;
      }

      // fast attack, slow release — reads as light reacting to the music
      const follow = (current: number, target: number) => {
        const rate = target > current ? 0.45 : 0.085;
        return current + (target - current) * rate;
      };
      m.bass = follow(m.bass, bass);
      m.mid = follow(m.mid, mid);
      m.high = follow(m.high, high);
      m.level = follow(m.level, Math.min(1.4, level));

      if (el) {
        const len = Number.isFinite(el.duration) ? el.duration : 0;
        progressRef.current = len > 0 ? Math.min(1, el.currentTime / len) : 0;
      }

      shuttleRef.current = Math.max(0, shuttleRef.current - dt * 3.2);

      if (now - lastPush > 90) {
        lastPush = now;
        if (el) setCurrentTime(el.currentTime);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* -------------------------------------------------------------- navigation */

  const load = useCallback(
    (nextIndex: number, autoplay: boolean) => {
      const el = audioRef.current;
      const list = tracksRef.current;
      if (!el || list.length === 0) return;
      const i = ((nextIndex % list.length) + list.length) % list.length;
      indexRef.current = i;
      setIndex(i);
      setIsReady(false);
      el.src = list[i].src;
      el.load();
      setCurrentTime(0);
      progressRef.current = 0;
      if (autoplay) void startPlayback();
    },
    [startPlayback],
  );

  const step = useCallback(
    (delta: number, auto = false) => {
      const list = tracksRef.current;
      if (list.length === 0) return;
      if (shuffleRef.current && list.length > 1) {
        if (auto && repeatRef.current === "off") return;
        let pick = indexRef.current;
        while (pick === indexRef.current) pick = Math.floor(Math.random() * list.length);
        load(pick, true);
        return;
      }
      const next = indexRef.current + delta;
      if (next >= list.length) {
        if (repeatRef.current === "off" && auto) {
          const el = audioRef.current;
          el?.pause();
          return;
        }
        load(0, true);
        return;
      }
      if (next < 0) {
        load(list.length - 1, true);
        return;
      }
      load(next, true);
    },
    [load],
  );

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void startPlayback();
    else el.pause();
  }, [startPlayback]);

  const playAt = useCallback(
    (i: number) => {
      if (i === indexRef.current) {
        toggle();
        return;
      }
      load(i, true);
    },
    [load, toggle],
  );

  const seek = useCallback((ratio: number) => {
    const el = audioRef.current;
    if (!el) return;
    const len = Number.isFinite(el.duration) ? el.duration : 0;
    if (len <= 0) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    shuttleRef.current = 1;
    el.currentTime = clamped * len;
    setCurrentTime(el.currentTime);
    progressRef.current = clamped;
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    const len = Number.isFinite(el.duration) ? el.duration : 0;
    if (len <= 0) return;
    el.currentTime = Math.min(len, Math.max(0, el.currentTime + seconds));
    shuttleRef.current = 1;
    setCurrentTime(el.currentTime);
  }, []);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    writePrefs({ ...readPrefs(), volume: clamped });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleState((prev) => {
      const next = !prev;
      writePrefs({ ...readPrefs(), shuffle: next });
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatState((prev) => {
      const order: RepeatMode[] = ["off", "all", "one"];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      writePrefs({ ...readPrefs(), repeat: next });
      return next;
    });
  }, []);

  /* ------------------------------------------------------------------ import */

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const audio = Array.from(files).filter(
      (f) => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|opus|flac|weba)$/i.test(f.name),
    );
    if (audio.length === 0) return;
    const durations = await Promise.all(audio.map(parseDuration));
    const added: Track[] = audio.map((file, i) => {
      const name = file.name.replace(/\.[^.]+$/, "");
      return {
        id: `local-${Date.now()}-${i}-${name}`,
        title: name || "Untitled",
        artist: "Imported",
        src: URL.createObjectURL(file),
        duration: durations[i],
        accent: IMPORT_ACCENTS[(i + Date.now()) % IMPORT_ACCENTS.length],
      };
    });
    setTracks((list) => [...list, ...added]);
  }, []);

  const removeTrack = useCallback(
    (id: string) => {
      const target = tracksRef.current.find((t) => t.id === id);
      if (target && !target.builtIn) URL.revokeObjectURL(target.src);
      const list = tracksRef.current.filter((t) => t.id !== id);
      setTracks(list);
      const currentId = tracksRef.current[indexRef.current]?.id;
      if (currentId === id) {
        const el = audioRef.current;
        el?.pause();
        if (list.length > 0) load(Math.min(indexRef.current, list.length - 1), false);
      }
    },
    [load],
  );

  /* -------------------------------------------------------------- sleep timer */

  useEffect(() => {
    if (sleepMinutes === null) {
      sleepRef.current = null;
      setSleepLeft(0);
      return;
    }
    const until = Date.now() + sleepMinutes * 60_000;
    sleepRef.current = { until, from: volumeRef.current };
    setSleepLeft(sleepMinutes * 60);
    let raf = 0;
    const tick = () => {
      const sleep = sleepRef.current;
      if (!sleep) return;
      const remaining = sleep.until - Date.now();
      setSleepLeft(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) {
        audioRef.current?.pause();
        const el = audioRef.current;
        if (el) el.volume = sleep.from;
        volumeRef.current = sleep.from;
        setVolumeState(sleep.from);
        setSleepMinutes(null);
        return;
      }
      if (remaining < 4000) {
        const el = audioRef.current;
        const faded = Math.max(0, sleep.from * (remaining / 4000));
        if (el) el.volume = faded;
      }
      raf = window.setTimeout(tick, 250) as unknown as number;
    };
    raf = window.setTimeout(tick, 250) as unknown as number;
    return () => window.clearTimeout(raf);
  }, [sleepMinutes, setVolume]);

  /* ------------------------------------------------------------- media keys */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          toggle();
          break;
        case "ArrowRight":
          seekBy(5);
          break;
        case "ArrowLeft":
          seekBy(-5);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(volumeRef.current + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(volumeRef.current - 0.05);
          break;
        case "n":
          step(1);
          break;
        case "p":
          step(-1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekBy, setVolume, step, toggle]);

  const current = tracks[index] ?? tracks[0];

  useEffect(() => {
    writePrefs({ ...readPrefs(), lastTrackId: current?.id });
  }, [current?.id]);

  return {
    tracks,
    index,
    current,
    isPlaying,
    isReady,
    currentTime,
    duration: duration || current?.duration || 0,
    volume,
    shuffle,
    repeat,
    sleepMinutes,
    sleepLeft,
    metricsRef,
    progressRef,
    shuttleRef,
    spectrumRef: binsRef,
    play: toggle,
    toggle,
    next: () => step(1),
    prev: () => {
      const el = audioRef.current;
      if (el && el.currentTime > 4) {
        el.currentTime = 0;
        setCurrentTime(0);
        shuttleRef.current = 1;
        return;
      }
      step(-1);
    },
    seek,
    seekBy,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    addFiles,
    removeTrack,
    playAt,
    setSleepMinutes,
  };
}

export type PlayerApi = ReturnType<typeof usePlayer>;
