import reactionDiffusion from 'butterchurn-presets/presets/converted/Geiss - Reaction Diffusion 2.json';
import sherwinMaxawow from 'butterchurn-presets/presets/converted/Flexi, martin + geiss - dedicated to the sherwin maxawow.json';
import reflectionsOnBlackTiles from 'butterchurn-presets/presets/converted/martin - reflections on black tiles.json';
import motherOfPearl from 'butterchurn-presets/presets/converted/cope + martin - mother-of-pearl.json';
import stainedGlass from 'butterchurn-presets/presets/converted/Eo.S. + Zylot - skylight (Stained Glass Majesty mix).json';
import paintSpill from 'butterchurn-presets/presets/converted/Zylot - Paint Spill (Music Reactive Paint Mix).json';
import desertRose from 'butterchurn-presets/presets/converted/_Geiss - Desert Rose 2.json';
import angelFlight from 'butterchurn-presets/presets/converted/martin - angel flight.json';
import frostyCaves from 'butterchurn-presets/presets/converted/martin - frosty caves 2.json';
import liquidArrows from 'butterchurn-presets/presets/converted/Martin - liquid arrows.json';
import alienFishPond from 'butterchurn-presets/presets/converted/Flexi - alien fish pond.json';
import astralProjection from 'butterchurn-presets/presets/converted/Flexi + Martin - astral projection.json';
import castleInTheAir from 'butterchurn-presets/presets/converted/martin - castle in the air.json';
import spiralArtifact from 'butterchurn-presets/presets/converted/Geiss - Spiral Artifact.json';
import glassCorridor from 'butterchurn-presets/presets/converted/martin - glass corridor.json';
import wildVort from 'butterchurn-presets/presets/converted/Goody - The Wild Vort.json';
import acidWiring from 'butterchurn-presets/presets/converted/Martin - acid wiring.json';
import redLiquidFire from 'butterchurn-presets/presets/converted/Cope - The Neverending Explosion of Red Liquid Fire.json';
import predatorPreySpirals from 'butterchurn-presets/presets/converted/Flexi - predator-prey-spirals.json';
import funnyMadness from 'butterchurn-presets/presets/converted/Halfbreak - Funny Madness.json';
import charisma from 'butterchurn-presets/presets/converted/Martin - charisma.json';
import glowsticks from 'butterchurn-presets/presets/converted/Eo.S. - glowsticks v2 03 music.json';
import thumbDrum from 'butterchurn-presets/presets/converted/Geiss - Thumb Drum.json';
import anotherKindOfGroove from 'butterchurn-presets/presets/converted/martin - another kind of groove.json';
import discoMix from 'butterchurn-presets/presets/converted/martin - disco mix 4.json';
import bouncingBalls from 'butterchurn-presets/presets/converted/flexi - bouncing balls [double mindblob neon mix].json';
import {
  BUTTERCHURN_PRESET_MODES,
  DEFAULT_BUTTERCHURN_PRESET_ID,
} from '../../shared/lyricVideoVisualizer.js';

export const BUTTERCHURN_PRESET_GROUPS = Object.freeze([
  { id: 'calm', label: 'Calm / Worship-Friendly' },
  { id: 'moderate', label: 'Moderate Motion' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'audio-reactive', label: 'Audio-Reactive' },
]);

export const BUTTERCHURN_PRESET_OPTIONS = Object.freeze([
  { id: 'mother-of-pearl', label: 'Mother of Pearl', author: 'Cope + Martin', group: 'calm', preset: motherOfPearl },
  { id: 'stained-glass', label: 'Stained Glass Majesty', author: 'Eo.S. + Zylot', group: 'calm', preset: stainedGlass },
  { id: 'black-tiles', label: 'Reflections on Black Tiles', author: 'Martin', group: 'calm', preset: reflectionsOnBlackTiles },
  { id: 'desert-rose', label: 'Desert Rose', author: 'Geiss', group: 'calm', preset: desertRose },
  { id: 'angel-flight', label: 'Angel Flight', author: 'Martin', group: 'calm', preset: angelFlight },
  { id: 'frosty-caves', label: 'Frosty Caves', author: 'Martin', group: 'calm', preset: frostyCaves },
  { id: 'liquid-arrows', label: 'Liquid Arrows', author: 'Martin', group: 'calm', preset: liquidArrows },

  { id: 'reaction-diffusion', label: 'Reaction Bloom', author: 'Geiss', group: 'moderate', preset: reactionDiffusion },
  { id: 'sherwin-maxawow', label: 'Neon Flow', author: 'Flexi, Martin + Geiss', group: 'moderate', preset: sherwinMaxawow },
  { id: 'alien-fish-pond', label: 'Alien Fish Pond', author: 'Flexi', group: 'moderate', preset: alienFishPond },
  { id: 'astral-projection', label: 'Astral Projection', author: 'Flexi + Martin', group: 'moderate', preset: astralProjection },
  { id: 'castle-in-the-air', label: 'Castle in the Air', author: 'Martin', group: 'moderate', preset: castleInTheAir },
  { id: 'spiral-artifact', label: 'Spiral Artifact', author: 'Geiss', group: 'moderate', preset: spiralArtifact },
  { id: 'glass-corridor', label: 'Glass Corridor', author: 'Martin', group: 'moderate', preset: glassCorridor },

  { id: 'paint-spill', label: 'Paint Spill', author: 'Zylot', group: 'energetic', preset: paintSpill },
  { id: 'wild-vort', label: 'The Wild Vort', author: 'Goody', group: 'energetic', preset: wildVort },
  { id: 'acid-wiring', label: 'Acid Wiring', author: 'Martin', group: 'energetic', preset: acidWiring },
  { id: 'red-liquid-fire', label: 'Red Liquid Fire', author: 'Cope', group: 'energetic', preset: redLiquidFire },
  { id: 'predator-prey-spirals', label: 'Predator-Prey Spirals', author: 'Flexi', group: 'energetic', preset: predatorPreySpirals },
  { id: 'funny-madness', label: 'Funny Madness', author: 'Halfbreak', group: 'energetic', preset: funnyMadness },
  { id: 'charisma', label: 'Charisma', author: 'Martin', group: 'energetic', preset: charisma },

  { id: 'glowsticks', label: 'Glowsticks', author: 'Eo.S.', group: 'audio-reactive', preset: glowsticks },
  { id: 'thumb-drum', label: 'Thumb Drum', author: 'Geiss', group: 'audio-reactive', preset: thumbDrum },
  { id: 'another-kind-of-groove', label: 'Another Kind of Groove', author: 'Martin', group: 'audio-reactive', preset: anotherKindOfGroove },
  { id: 'disco-mix', label: 'Disco Mix', author: 'Martin', group: 'audio-reactive', preset: discoMix },
  { id: 'bouncing-balls', label: 'Bouncing Balls', author: 'Flexi', group: 'audio-reactive', preset: bouncingBalls },
]);

const PRESETS_BY_ID = new Map(
  BUTTERCHURN_PRESET_OPTIONS.map((option) => [option.id, option.preset])
);

export const getButterchurnPreset = (presetId) => (
  PRESETS_BY_ID.get(presetId)
  || PRESETS_BY_ID.get(DEFAULT_BUTTERCHURN_PRESET_ID)
  || BUTTERCHURN_PRESET_OPTIONS[0]?.preset
);

export const resolveButterchurnPresetId = ({
  presetId,
  presetMode,
  seed,
} = {}) => {
  if (presetMode !== BUTTERCHURN_PRESET_MODES.RANDOM) {
    return PRESETS_BY_ID.has(presetId) ? presetId : DEFAULT_BUTTERCHURN_PRESET_ID;
  }

  if (BUTTERCHURN_PRESET_OPTIONS.length === 0) return DEFAULT_BUTTERCHURN_PRESET_ID;
  const numericSeed = Math.abs(Math.round(Number(seed) || 1));
  const mixedSeed = Math.imul(numericSeed ^ 0x9e3779b9, 2654435761) >>> 0;
  return BUTTERCHURN_PRESET_OPTIONS[mixedSeed % BUTTERCHURN_PRESET_OPTIONS.length].id;
};
