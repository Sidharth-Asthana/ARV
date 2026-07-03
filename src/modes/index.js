import particles from './particles.js';
import waves from './waves.js';
import rings from './rings.js';
import petals from './petals.js';
import ribbons from './ribbons.js';
import equalizer from './equalizer.js';
import tendrils from './tendrils.js';
import ripples from './ripples.js';
import lanterns from './lanterns.js';
import galaxy from './galaxy.js';

/* order matches the scenery list: each scenery's default mode sits at
   the same index, but every mode works with every scenery */
export const MODES = [
  particles,   // Night Peaks
  waves,       // Moonlit Sea
  rings,       // Desert Dusk
  ribbons,     // Aurora Pines
  equalizer,   // City Nights
  tendrils,    // Forest Glade
  petals,      // Sakura Dusk
  ripples,     // Rainfall
  lanterns,    // Morning Mist
  galaxy,      // Nebula
];
export const modeByName = n => MODES.find(m => m.name === n) || MODES[0];
