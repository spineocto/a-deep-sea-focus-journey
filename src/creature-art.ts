// Creature sprites, keyed by codex card id. Drawn by art/render_creatures.py.
import moonJellyfish from '../art/out/creature-moon-jellyfish.webp';
import barreleye from '../art/out/creature-barreleye.webp';
import anglerfish from '../art/out/creature-humpback-anglerfish.webp';
import dumbo from '../art/out/creature-dumbo-octopus.webp';
import snailfish from '../art/out/creature-mariana-snailfish.webp';
import amphipod from '../art/out/creature-supergiant-amphipod.webp';

export const CREATURE_ART: Readonly<Record<string, string>> = {
  'moon-jellyfish': moonJellyfish,
  'barreleye': barreleye,
  'humpback-anglerfish': anglerfish,
  'dumbo-octopus': dumbo,
  'mariana-snailfish': snailfish,
  'supergiant-amphipod': amphipod,
};
