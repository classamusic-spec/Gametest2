export type WeaponId = "pistol" | "machinegun" | "shotgun" | "sniper" | "laser";
export type WeaponModel = WeaponId;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Short tag shown in the HUD weapon strip. */
  tag: string;
  model: WeaponModel;
  /** True = hold to fire; false = one shot per click. */
  auto: boolean;
  damage: number;
  fireRate: number; // shots per second
  pellets: number; // >1 for shotgun spread
  range: number;
  magazine: number;
  /** Spare ammo carried; Infinity for the pistol. */
  reserve: number;
  reloadTime: number; // seconds
  hipSpread: number; // radians
  adsSpread: number; // radians
  adsFov: number; // field of view while aiming
  /** Tracer / muzzle glow color. */
  color: number;
  /** Recoil kick magnitude per shot. */
  recoil: number;
  /** Thicker, brighter tracer for the laser beam look. */
  beam?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol",
    name: "M9 SIDEARM",
    tag: "PISTOL",
    model: "pistol",
    auto: false,
    damage: 32,
    fireRate: 5,
    pellets: 1,
    range: 120,
    magazine: 14,
    reserve: Infinity,
    reloadTime: 0.9,
    hipSpread: 0.02,
    adsSpread: 0.003,
    adsFov: 55,
    color: 0x36e3ff,
    recoil: 1.4,
  },
  machinegun: {
    id: "machinegun",
    name: "PULSE RIFLE",
    tag: "M.GUN",
    model: "machinegun",
    auto: true,
    damage: 19,
    fireRate: 13,
    pellets: 1,
    range: 130,
    magazine: 40,
    reserve: 200,
    reloadTime: 1.6,
    hipSpread: 0.03,
    adsSpread: 0.008,
    adsFov: 58,
    color: 0x36e3ff,
    recoil: 1.0,
  },
  shotgun: {
    id: "shotgun",
    name: "BREACH SCATTERGUN",
    tag: "SHOTGUN",
    model: "shotgun",
    auto: false,
    damage: 13,
    fireRate: 1.4,
    pellets: 9,
    range: 45,
    magazine: 6,
    reserve: 42,
    reloadTime: 1.9,
    hipSpread: 0.12,
    adsSpread: 0.07,
    adsFov: 62,
    color: 0xffae3b,
    recoil: 2.6,
  },
  sniper: {
    id: "sniper",
    name: "RAILCOIL DMR",
    tag: "SNIPER",
    model: "sniper",
    auto: false,
    damage: 170,
    fireRate: 1.0,
    pellets: 1,
    range: 220,
    magazine: 5,
    reserve: 25,
    reloadTime: 2.1,
    hipSpread: 0.05,
    adsSpread: 0.0006,
    adsFov: 26,
    color: 0x9ff4ff,
    recoil: 3.2,
  },
  laser: {
    id: "laser",
    name: "ARC BLASTER",
    tag: "LASER",
    model: "laser",
    auto: true,
    damage: 24,
    fireRate: 16,
    pellets: 1,
    range: 150,
    magazine: 60,
    reserve: 300,
    reloadTime: 1.4,
    hipSpread: 0.012,
    adsSpread: 0.002,
    adsFov: 56,
    color: 0x57ff8f,
    recoil: 0.7,
    beam: true,
  },
};

/** Display order for the HUD strip and number-key selection. */
export const WEAPON_ORDER: WeaponId[] = [
  "pistol",
  "machinegun",
  "shotgun",
  "sniper",
  "laser",
];
