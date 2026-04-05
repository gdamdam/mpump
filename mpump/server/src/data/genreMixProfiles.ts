/**
 * Genre-specific mix profiles — distilled from docs/genre-mix-profiles.md.
 * Each profile maps to HEADER_SCENES-compatible params (eq, drive, width, lowCut, mb).
 * Keys match GENRE_KEYWORDS in Layout.tsx.
 */

export interface GenreMixProfile {
  name: string;
  desc: string;
  eq: { low: number; mid: number; high: number };
  drive: number;
  width: number;
  lowCut: number;
  mbOn: boolean;
  mbAmount: number;
  bestScene: string; // closest aesthetic scene for badge logic
}

export const GENRE_MIX_PROFILES: Record<string, GenreMixProfile> = {
  techno: {
    name: "Techno", desc: "punchy kick, clear separation",
    eq: { low: 2, mid: -2, high: 1 }, drive: 1, width: 0.6, lowCut: 35,
    mbOn: true, mbAmount: 0.3, bestScene: "Punchy",
  },
  "acid-techno": {
    name: "Acid", desc: "resonant mid, driving",
    eq: { low: 2, mid: -1, high: 1 }, drive: 2, width: 0.55, lowCut: 30,
    mbOn: true, mbAmount: 0.3, bestScene: "Punchy",
  },
  house: {
    name: "House", desc: "warm low-mid, groovy",
    eq: { low: 2, mid: -1, high: 0 }, drive: 1, width: 0.65, lowCut: 25,
    mbOn: true, mbAmount: 0.3, bestScene: "Warm",
  },
  "deep-house": {
    name: "Deep House", desc: "warm, wide pads",
    eq: { low: 2, mid: -1, high: 0 }, drive: 1, width: 0.7, lowCut: 20,
    mbOn: true, mbAmount: 0.25, bestScene: "Warm",
  },
  trance: {
    name: "Trance", desc: "bright air, wide supersaws",
    eq: { low: 1, mid: -1, high: 2 }, drive: 1, width: 0.7, lowCut: 25,
    mbOn: true, mbAmount: 0.35, bestScene: "Airy",
  },
  psytrance: {
    name: "Psytrance", desc: "tight bass, strong pump",
    eq: { low: 2, mid: -2, high: 2 }, drive: 2, width: 0.6, lowCut: 30,
    mbOn: true, mbAmount: 0.4, bestScene: "Crisp",
  },
  "drum-and-bass": {
    name: "DnB", desc: "co-dominant bass, crisp breaks",
    eq: { low: 2, mid: -2, high: 2 }, drive: 2, width: 0.6, lowCut: 30,
    mbOn: true, mbAmount: 0.25, bestScene: "Tight",
  },
  jungle: {
    name: "Jungle", desc: "heavy sub, wide breaks",
    eq: { low: 2, mid: -2, high: 1 }, drive: 1, width: 0.65, lowCut: 25,
    mbOn: true, mbAmount: 0.25, bestScene: "Tight",
  },
  dubstep: {
    name: "Dubstep", desc: "deep sub, weight",
    eq: { low: 3, mid: -1, high: 1 }, drive: 2, width: 0.5, lowCut: 20,
    mbOn: true, mbAmount: 0.35, bestScene: "Heavy",
  },
  ambient: {
    name: "Ambient", desc: "wide, soft, spacious",
    eq: { low: 1, mid: -1, high: 1 }, drive: 0, width: 0.8, lowCut: 0,
    mbOn: true, mbAmount: 0.1, bestScene: "Spacious",
  },
  "dub-techno": {
    name: "Dub Techno", desc: "deep, filtered, wide reverb",
    eq: { low: 1, mid: -1, high: 0 }, drive: 0, width: 0.75, lowCut: 15,
    mbOn: true, mbAmount: 0.15, bestScene: "Spacious",
  },
  idm: {
    name: "IDM", desc: "textural, wide, experimental",
    eq: { low: 1, mid: -1, high: 1 }, drive: 1, width: 0.75, lowCut: 20,
    mbOn: true, mbAmount: 0.2, bestScene: "Airy",
  },
  glitch: {
    name: "Glitch", desc: "processed, wide, angular",
    eq: { low: 1, mid: -1, high: 1 }, drive: 1, width: 0.7, lowCut: 20,
    mbOn: true, mbAmount: 0.2, bestScene: "Airy",
  },
  electro: {
    name: "Electro", desc: "808 body, cutting leads",
    eq: { low: 2, mid: -1, high: 1 }, drive: 1, width: 0.55, lowCut: 30,
    mbOn: true, mbAmount: 0.3, bestScene: "Crisp",
  },
  breakbeat: {
    name: "Breakbeat", desc: "wide breaks, exciter top",
    eq: { low: 1, mid: -1, high: 1 }, drive: 1, width: 0.65, lowCut: 25,
    mbOn: true, mbAmount: 0.25, bestScene: "Tight",
  },
  downtempo: {
    name: "Downtempo", desc: "dark, soft, relaxed",
    eq: { low: 1, mid: -1, high: -1 }, drive: 0, width: 0.6, lowCut: 0,
    mbOn: true, mbAmount: 0.15, bestScene: "Mellow",
  },
  "lo-fi": {
    name: "Lo-fi", desc: "tape warmth, rolled-off highs",
    eq: { low: 1, mid: -1, high: -1 }, drive: 0, width: 0.5, lowCut: 0,
    mbOn: true, mbAmount: 0.15, bestScene: "Mellow",
  },
  synthwave: {
    name: "Synthwave", desc: "warm analog, lush chorus",
    eq: { low: 2, mid: -1, high: 1 }, drive: 1, width: 0.65, lowCut: 20,
    mbOn: true, mbAmount: 0.25, bestScene: "Warm",
  },
  garage: {
    name: "Garage", desc: "crisp kick, swung sub",
    eq: { low: 2, mid: -1, high: 1 }, drive: 1, width: 0.6, lowCut: 25,
    mbOn: true, mbAmount: 0.25, bestScene: "Warm",
  },
  edm: {
    name: "EDM", desc: "full, compressed, loud",
    eq: { low: 2, mid: -1, high: 1 }, drive: 2, width: 0.65, lowCut: 25,
    mbOn: true, mbAmount: 0.4, bestScene: "Loud",
  },
};
