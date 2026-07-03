# ARV · ARviz

A mobile-first, audio-reactive music visualizer. Open it in a phone or laptop
browser, let it listen to whatever is playing (microphone — or lossless
browser-tab capture on desktop), and watch ten WebGL-rendered visualizations
move with the song. Install it to your home screen and it behaves like a
native app.

**Live app:** https://sidharth-asthana.github.io/ARV/

## Features

- **Ten visualization modes**, each paired to a scenery as its default but all
  freely interchangeable, and each with its own settings sliders (stored
  separately per mode):

  | Mode | Default scenery | Beat reaction | Touch |
  |---|---|---|---|
  | Particles | Night Peaks | a cluster gets jolted | tap bursts · drag stirs |
  | Waves | Moonlit Sea | crests surge (real wave physics) | tap/drag ripples |
  | Rings | Desert Dusk | circumference spikes, radii breathe | tap spikes · drag spins |
  | Ribbons | Aurora Pines | the silk billows | tap ripples · drag bends |
  | Equalizer | City Nights | spectrum towers pulse | tap/drag excites bars |
  | Tendrils | Forest Glade | growth branches | tap plants · drag guides |
  | Petals | Sakura Dusk | a gust rolls through | tap gusts · drag steers |
  | Ripples | Rainfall | beats land as rain rings | tap splashes · drag trails |
  | Lanterns | Morning Mist | lanterns surge upward | tap releases · drag breezes |
  | Galaxy | Nebula | core flash + spin kick | tap pulses gravity · drag spins |

- **WebGL2 renderer**: instanced primitives (tens of thousands of glowing
  points), real bloom post-processing, and motion-trail persistence buffers —
  with an automatic Canvas2D fallback for devices without WebGL2.
- **Ten painted sceneries** with faint living ambient layers (twinkling stars,
  shooting stars, drifting aurora, rain, fog, flickering windows), each
  bringing its own default palette and mode.
- **Beat-phase audio engine**: 24 mel-spaced bands, autocorrelation tempo
  tracking with next-beat prediction (visuals subtly anticipate the beat),
  per-instrument onset detection (drums / keys / percussion) with a conductor
  that follows the song's lead instrument, auto-gain, and tempo-adaptive
  reaction intensity — slow songs respond softly and often, fast songs jolt
  hard on real hits.
- **Audio sources**: synthetic demo beat, microphone, and — on desktop —
  **tab capture** (`getDisplayMedia`), which syncs losslessly to the audio of
  a chosen browser tab, e.g. YouTube Music.
- **Gestures**: tap to interact, slow drag to steer, fast horizontal flick to
  reverse the flow direction, two-finger pinch to zoom — all with haptic ticks.
- **Keyboard** (desktop): `F` fullscreen · `Space`/`H` panel · `←/→` scenery ·
  `↑/↓` mode · `1–5` palettes · `R` reverse flow.
- **PWA**: installable, fullscreen, offline app shell; settings persist;
  adaptive quality governor; screen wake lock.

## Using it

1. Open the live app on your phone or laptop.
2. It starts on a built-in demo beat. Tap **Listen (mic)** (or **Capture tab**
   on desktop) to follow real music.
3. The top-right buttons toggle fullscreen and the translucent settings sheet.
4. Install: browser menu → **Add to Home Screen** / **Install app**.

> **Why the microphone on mobile?** No mobile API lets a web page read audio
> playing in another app. Desktop browsers can capture a tab's audio, which is
> why the tab-capture source only appears there.

## Development

```
src/
  main.js            app wiring + render loop
  state.js           global state + persistence (incl. per-mode configs)
  audio/engine.js    mel bands, tempo/phase tracking, conductor, sources
  render/painter-gl.js   WebGL2 instanced renderer, trails, bloom
  render/painter-2d.js   Canvas2D fallback (same painter API)
  color/palettes.js  exact-color cycling schemes
  scenery/           10 painted scenes + living ambient layers
  modes/             10 visualization modes (one file each)
  ui/                panel, gestures, keyboard, haptics, toast
public/              PWA shell: sw.js, manifest, icons, root redirect
```

```bash
npm install
npm run dev      # hot-reload dev server
npm run build    # emits a single self-contained dist/ARviz.html + PWA shell
```

Modes implement `{ name, hint, params, reset, step, draw, tap, drag }` against
the painter API (`dot / disc / seg / poly / ring`), so a new mode is one small
file registered in `modes/index.js`. Sceneries implement
`{ draw, ambient, z0, z1, fx, fy, defPal, defMode }` in `scenery/index.js`.

Deploys are automatic: GitHub Actions builds `dist/` and publishes it to
GitHub Pages on every merge to `main` (repo Settings → Pages → Source:
**GitHub Actions**). The service worker serves HTML network-first, so new
releases reach devices on their next online visit.
