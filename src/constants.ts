/** Central tunables for the whole game. */
export const ARENA = {
  /** Half-extent of the playable square (meters). */
  halfSize: 36,
  groundY: 0,
  eyeHeight: 1.7,
  wallHeight: 8,
};

export const PLAYER = {
  moveSpeed: 9, // m/s
  sprintSpeed: 14, // m/s while holding Shift
  radius: 0.6, // collision radius vs cover
  maxHealth: 100,
  /** Seconds of invulnerability after taking a hit (avoids instant melt). */
  hitCooldown: 0.35,
  /** Seconds without damage before health starts regenerating (CoD style). */
  regenDelay: 4.0,
  /** Health per second once regen kicks in. */
  regenRate: 22,
};

export const CAMERA = {
  baseFov: 78,
  sprintFov: 86,
  adsFov: 52,
  /** Additive FOV punch per shot, decays back. */
  firePunch: 2.5,
};

export const WEAPON = {
  damage: 34,
  range: 140,
  fireRate: 9, // shots per second
  magazine: 24,
  reserve: Infinity, // unlimited reserve, must still reload
  reloadTime: 1.05, // seconds
  /** Bullet spread (radians) at the hip; tighter while aiming. */
  hipSpread: 0.022,
  adsSpread: 0.004,
};

export const PROJECTILE = {
  radius: 0.28,
  /** Lifetime seconds before despawn. */
  life: 5,
};
