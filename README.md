# ARV · ARviz

A mobile-first, audio-reactive music visualizer that lives in a single HTML file.
Open it in a phone browser, let it listen to whatever is playing out loud (YouTube
Music, a speaker, a live room), and watch six different visualizations move with
the song — or install it to your home screen and use it like a native app.

**Live app:** https://sidharth-asthana.github.io/ARV/

## Features

- **Six visualization modes**, each with its own audio reaction and touch behavior:

  | Mode | Reacts to the beat by… | Tap | Drag |
  |---|---|---|---|
  | Particles | jolting a cluster of particles | burst + shockwave ring | stir the field |
  | Waves | surging crests along the lines | send a ripple (real wave physics) | pull the lines |
  | Rings | spiking the circumference, breathing radii | spike the nearest ring | spin the stack |
  | Meteors | launching a volley of streaks | meteor cluster | sweep a trail |
  | Fireflies | blinking the whole swarm in sync | scatter the swarm | lead the swarm |
  | Petals | rolling a gust through the blossoms | gust outward | steer the wind |

- **Nine scenery backgrounds** — Night Peaks, Moonlit Sea, Desert Dusk, Aurora
  Pines, City Nights, Forest Glade, Sakura Dusk, Rainfall, Morning Mist — each a
  painted scene with a subtle living layer (twinkling stars, shooting stars,
  drifting aurora, rain, fog, flickering windows) and its own default palette.
  The visualization anchors to each scene's sky, sea, or glade.
- **Instrument-following audio engine.** Onset detection runs separately on
  drums (low band), keys/strums (mid), and percussion (high). A conductor scores
  each for loudness and rhythmic regularity and elects a *lead instrument* whose
  beat drives the major reactions; the runner-up only adds minor accents. A
  readout in the settings sheet shows the current choice and BPM.
- **Tempo-adaptive feel.** Slow songs lower the onset threshold (soft piano
  strokes register) and soften every reaction; fast songs demand hard hits and
  jolt sharper. Auto-gain keeps quiet rooms and loud speakers comparable.
- **Color cycles** (Aurora, Ember, Ocean, Candy, Spectrum): each scheme drifts
  smoothly through an explicit color list, and the settings chips are built from
  the exact same colors.
- **Gestures:** tap to interact, slow drag to steer, fast horizontal flick to
  reverse the flow direction, two-finger pinch to zoom — all with haptic ticks.
- **PWA:** installable, fullscreen, works offline after the first visit.
- Settings persist between launches; an adaptive performance governor keeps
  older phones smooth; a wake lock keeps the screen on while visualizing.

## Using it

1. Open the live app (or `ARviz.html` directly) in Chrome/Safari on your phone.
2. It starts on a built-in demo beat. Tap **Listen (mic)** and allow microphone
   access, then play music out loud — the visualizer follows what it hears.
3. The round button at the top right hides/shows the translucent settings sheet;
   the other toggles fullscreen.
4. To install: browser menu → **Add to Home Screen** / **Install app**. The
   installed app launches fullscreen with its own icon.

> **Why the microphone?** No mobile API lets a web page read audio playing in
> another app — Android and iOS sandbox app audio completely. Listening through
> the mic is how every mobile visualizer syncs to your music.

## Development

Everything is a single dependency-free file — `ARviz.html` (Canvas 2D + Web
Audio). `sw.js`, `manifest.webmanifest`, and `icons/` are the PWA shell;
`index.html` just redirects the site root into the app.

To work on it locally, serve the folder over HTTP (the service worker and mic
need a secure context; `file://` works for everything except the service
worker):

```bash
python3 -m http.server 8000
# open http://localhost:8000/ARviz.html
```

Deploys are automatic: anything merged to `main` goes live on GitHub Pages.
HTML is served network-first by the service worker, so a new release reaches
devices on their next online visit.
