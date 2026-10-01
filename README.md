# Wax Trax

A cassette-deck music player that runs on your phone. The tape reels turn for
real, the background light breathes with the music, and five original loops ship
inside the app so it works with no network at all.

<p align="center">
  <em>Tap the deck to play. Drag the tape rail to scrub.</em>
</p>

## What's in it

- **A real cassette** — the two reels are driven by the actual playback
  position. The supply reel starts full and empties while the take-up reel
  fills up, and the pack radius feeds back into the rotation speed, so a full
  reel turns slower than an empty one (ω = k / r), exactly like the mechanism it
  imitates. The tape itself visibly travels between the reels and across the
  head block, and the pinch roller spins with the capstan.
- **A room around it** — gradient blooms that pulse with the bass, mids and
  highs taken from a live Web Audio analyser, two oversized echo-reels turning
  behind everything, film grain and a vignette.
- **A deck spectrum** — 44 bars with peak-hold, driven straight from the
  analyser node.
- **Five original tracks**, synthesised from scratch by
  `scripts/generate-tracks.mjs` (pads, bass, plucks, drums) and then run
  through a tape-wear stage: wow, flutter, hiss, crackle and soft saturation.
- **Play your own music** — import audio files from the phone through the tape
  library.
- **Shuffle, repeat, volume, and a sleep timer** that fades out over the last
  four seconds.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Play / pause | tap the deck or the transport button | `space` |
| Scrub | drag the tape rail | `←` / `→` (5s) |
| Next / previous | transport buttons | `n` / `p` |
| Volume | slider | `↑` / `↓` |
| Restart track | — | press "previous" within 4s |

## Running it

```bash
bun install
bun run tracks     # synthesise the demo audio into public/tracks (needs ffmpeg)
bun run dev        # http://localhost:5173
```

## Building the APK

Needs a JDK 17 and the Android SDK (platform 34, build-tools 34.0.0).

```bash
bun run apk        # build web app -> cap sync -> gradlew assembleDebug
```

The APK lands at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

It is debug-signed, so install it with "unknown sources" enabled, or:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

For a signed release build, add a `keystore.properties` and a `release` signing
config in `android/app/build.gradle`, then run `./gradlew assembleRelease`.

The `.github/workflows/android-apk.yml` workflow does the whole thing in CI and
uploads the APK as a build artifact, if you would rather not install the SDK
locally.

## Verifying it

There are no unit tests, but the parts that are easy to break have real checks:

```bash
bun run verify     # functional: reels turn, tape transfers reels, spectrum reacts
bun run shots      # screenshots of idle / playing / scrubbed / library, phone + desktop
```

`verify` measures the mean pixel delta inside the two reel discs between frames
and compares it against a static part of the shell, and reads the pack radii
before and after a seek to prove the tape actually moves.

## Layout

```
src/
  App.tsx                 screen composition, sleep timer
  lib/audio.ts            playback engine, Web Audio graph, playlist logic
  lib/tracks.ts           track model + the bundled catalogue
  components/
    Cassette.tsx          the animated deck (rAF, no React state per frame)
    Backdrop.tsx          audio-reactive room
    Spectrum.tsx          canvas analyser
    Transport.tsx         transport bar
    SeekBar.tsx           tape-position scrubber
    Playlist.tsx          library sheet + file import
scripts/
  generate-tracks.mjs     the synthesiser for the demo audio
  verify-motion.mjs       functional checks
  shoot.mjs               screenshots
android/                  Capacitor Android project
```

### Performance notes

The animations deliberately avoid anything that would force a re-raster every
frame: the backdrop blooms are soft radial gradients rather than `filter: blur()`,
the deck's drop shadow is a static blurred element instead of a filter on the
moving SVG, and per-frame work is limited to `transform`/`opacity` plus direct
attribute writes on the reel elements. The heavy components are memoised so the
11 Hz clock update only re-renders the time labels.
