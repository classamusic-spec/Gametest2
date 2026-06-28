export type AlienType = "grey" | "insectoid" | "nordic" | "reptilian";

export interface LevelConfig {
  id: number;
  name: string;
  alienType: AlienType;
  /** Total enemies to defeat to clear the level. */
  count: number;
  /** Max alive at once. */
  maxAlive: number;
  /** Seconds between spawns. */
  spawnInterval: number;
  /** Briefing shown on the intro card. */
  briefing: string;
  /** If set, a boss spawns at the start and must also be defeated. */
  boss?: boolean;
  /** Neon palette for this planet. */
  palette: {
    fog: number;
    skyTop: number;
    skyBottom: number;
    hemiSky: number;
    hemiGround: number;
    sun: number;
    ground: number;
    grid: number;
  };
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "GREYS — OUTPOST ZETA",
    alienType: "grey",
    count: 10,
    maxAlive: 4,
    spawnInterval: 1.6,
    briefing:
      "The <span class='accent'>Greys</span> have infiltrated Outpost Zeta. " +
      "Slow and fragile, but they come in numbers. Clear the sector.",
    palette: {
      fog: 0x0a1430,
      skyTop: 0x0a1838,
      skyBottom: 0x050a1a,
      hemiSky: 0x6fb7ff,
      hemiGround: 0x10203a,
      sun: 0x9fd8ff,
      ground: 0x0c1426,
      grid: 0x2f6fff,
    },
  },
  {
    id: 2,
    name: "INSECTOIDS — HIVE BIOME",
    alienType: "insectoid",
    count: 16,
    maxAlive: 7,
    spawnInterval: 1.0,
    briefing:
      "A <span class='accent'>Insectoid</span> swarm boils out of the hive. " +
      "Fast and relentless — keep moving and don't let them surround you.",
    palette: {
      fog: 0x0c1f0a,
      skyTop: 0x10240c,
      skyBottom: 0x040a04,
      hemiSky: 0x9dff5a,
      hemiGround: 0x12260c,
      sun: 0xc6ff7a,
      ground: 0x0e1c0a,
      grid: 0x57d23a,
    },
  },
  {
    id: 3,
    name: "EVIL NORDICS — FROZEN CITADEL",
    alienType: "nordic",
    count: 14,
    maxAlive: 5,
    spawnInterval: 1.3,
    briefing:
      "The <span class='accent'>Evil Nordics</span> defend their frozen citadel. " +
      "Tall, armored and resilient — aim true, they take more punishment.",
    palette: {
      fog: 0x101a2e,
      skyTop: 0x16263f,
      skyBottom: 0x070d18,
      hemiSky: 0xbfe2ff,
      hemiGround: 0x1a2436,
      sun: 0xe6f3ff,
      ground: 0x101a2c,
      grid: 0x6fa8ff,
    },
  },
  {
    id: 4,
    name: "EVIL REPTILIANS — THE WARRENS",
    alienType: "reptilian",
    count: 8,
    maxAlive: 3,
    spawnInterval: 2.2,
    boss: true,
    briefing:
      "Deep in the Warrens, the <span class='danger'>Reptilian Warlord</span> rises — " +
      "a towering boss flanked by its brood. Destroy it and the Federation prevails.",
    palette: {
      fog: 0x1e0a14,
      skyTop: 0x2a0c18,
      skyBottom: 0x0a0306,
      hemiSky: 0xff7a9c,
      hemiGround: 0x24101a,
      sun: 0xffc46f,
      ground: 0x1a0c12,
      grid: 0xff4f7a,
    },
  },
];
