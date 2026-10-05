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

## Status: research phase

The [`research/`](research/) folder contains the complete collected
documentation of both reference apps — curricula, song libraries, engine
mechanics, grading thresholds, mic DSP notes, and the commercial original
they emulate. Start at [research/README.md](research/README.md).

## Plan

1. ✅ Collect documentation + learning levels/methods from both apps → `research/`
2. ⬜ Synthesize a unified curriculum & feature spec for openpiano
3. ⬜ Choose stack (candidate: Vue 3 + Vite, hash routing, Web Audio synth,
     localStorage profiles — keeping the zero-backend, offline-first ethos)
4. ⬜ Build

## License

TBD (both references are Apache-2.0 / private-permissive).
