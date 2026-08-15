import reactionDiffusion from 'butterchurn-presets/presets/converted/Geiss - Reaction Diffusion 2.json';
import sherwinMaxawow from 'butterchurn-presets/presets/converted/Flexi, martin + geiss - dedicated to the sherwin maxawow.json';
import reflectionsOnBlackTiles from 'butterchurn-presets/presets/converted/martin - reflections on black tiles.json';
import motherOfPearl from 'butterchurn-presets/presets/converted/cope + martin - mother-of-pearl.json';
import stainedGlass from 'butterchurn-presets/presets/converted/Eo.S. + Zylot - skylight (Stained Glass Majesty mix).json';
import paintSpill from 'butterchurn-presets/presets/converted/Zylot - Paint Spill (Music Reactive Paint Mix).json';
import { DEFAULT_BUTTERCHURN_PRESET_ID } from '../../shared/lyricVideoVisualizer.js';

export const BUTTERCHURN_PRESET_OPTIONS = Object.freeze([
  {
    id: 'reaction-diffusion',
    label: 'Reaction Bloom — Geiss',
    preset: reactionDiffusion,
  },
  {
    id: 'sherwin-maxawow',
    label: 'Neon Flow — Flexi, Martin + Geiss',
    preset: sherwinMaxawow,
  },
  {
    id: 'black-tiles',
    label: 'Prism Tiles — Martin',
    preset: reflectionsOnBlackTiles,
  },
  {
    id: 'mother-of-pearl',
    label: 'Mother of Pearl — Cope + Martin',
    preset: motherOfPearl,
  },
  {
    id: 'stained-glass',
    label: 'Stained Glass — Eo.S. + Zylot',
    preset: stainedGlass,
  },
  {
    id: 'paint-spill',
    label: 'Paint Spill — Zylot',
    preset: paintSpill,
  },
]);

const PRESETS_BY_ID = new Map(
  BUTTERCHURN_PRESET_OPTIONS.map((option) => [option.id, option.preset])
);

export const getButterchurnPreset = (presetId) => (
  PRESETS_BY_ID.get(presetId)
  || PRESETS_BY_ID.get(DEFAULT_BUTTERCHURN_PRESET_ID)
  || BUTTERCHURN_PRESET_OPTIONS[0]?.preset
);
