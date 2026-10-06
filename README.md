# openpiano

An open-source piano-learning web app — a community remake fusing the best of
two excellent open reference apps:

- **[Simple Piano](https://github.com/foxzi/simplepiano)** (foxzi) — deep,
  well-structured curriculum (32 lessons, 48 topics, 86 practices, i18n,
  staff rendering, ear training, Web MIDI).
- **[Simpli Piano](https://github.com/ConikerSystems/simpli-piano)**
  (ConikerSystems) — gamified learning loop (dual course paths, star grading,
  falling-notes engine, real-piano microphone grading, streaks, daily
  workout, multi-player profiles).

**Live: https://itpick.github.io/openpiano/**

## Features (current)

- **Course** — 39 units on a winding visual path: Soloist (Beginner →
  Intermediate) 🩵, Chords (Basics → Progressions) 🩷, and Lead Sheet
  convergence courses. Sequential unlock, **80% accuracy pass gate**, stars
  at 90/70/40%.
- **Lessons** — falling-notes engine with *step* mode (waits for you) and
  *moving* mode (timed, metronome + **backing track** bass chords, ±0.4-beat
  window, 4-beat count-in). Chord grading via remaining-set within 1.2 s.
  Lesson recap of the previous unit.
- **Three input methods** — on-screen keys (pointer + glissando + computer
  keyboard), 🎤 **real-piano microphone grading** (ACF2+ autocorrelation,
  onset detection, echo suppression — monophonic), and 🎚 **Web MIDI**
  (cable input, hot-plug aware).
- **Read Notes trainer** — real SVG staff (treble/bass, ledger lines,
  accidentals), expanding range on streaks, 30/60-note timed tests with
  notes/min and personal bests.
- **Songs** — 59 pieces (40 library + 19 exercises) parsed from simpli-piano's
  text notation, genre filters, per-song stars; "in time" mode unlocks at 2★.
- **Sheet Music** — melody strips rendered as mini-staff SVGs, unlocked as
  rewards per song star, printable.
- **Engagement** — onboarding funnel (goal/experience/minutes), 🔥 daily
  streak (local-day, ≥60 s), daily goal, up to 5 player profiles with
  isolated progress, motivational callouts, daily workout builder.
- **🖐 Hands overlay** — typing-tutor SVG hands with numbered fingertip
  badges (default OFF, per the research).
- **i18n** — EN / RU / ES with fallback-to-source.
- **PWA** — installable, offline-capable, robust update flow.

## Development

Static site — no build step. Serve and open:

```bash
python3 -m http.server 8791
# open http://127.0.0.1:8791
```

### Tests

E2E via Playwright — 88 tests, including a virtual microphone that renders
melodies to WAV and plays them through the real DSP pipeline, sweeping all
songs and course units:

```bash
npm install
npx playwright install chromium
npm test          # full suite (~13–20 min)
npm run test:mic  # mechanics only
npm run test:sweep # all-content sweep only
```

## Status

Prototype complete through the Simply Piano core loop. Remaining ideas:
fingering-specific hand articulation per song, community lesson/song
contributions, chord-via-mic (the "MusicSense" moat), speed-racer mode.

## Research

The `research/` folder (local, gitignored) contains the full collected
documentation of both reference apps — curricula, song libraries, engine
mechanics, grading thresholds, mic DSP notes, and the commercial original.

## License

TBD (both references are Apache-2.0 / private-permissive).
