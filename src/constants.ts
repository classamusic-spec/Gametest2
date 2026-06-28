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
  maxHealth: 100,
  /** Seconds of invulnerability after taking a hit (avoids instant melt). */
  hitCooldown: 0.4,
};

export const WEAPON = {
  damage: 34,
  range: 120,
  fireRate: 7, // shots per second
  magazine: 18,
  reserve: Infinity, // unlimited reserve, must still reload
  reloadTime: 1.1, // seconds
};

/** Tag used so the raycaster knows which meshes are damageable. */
export const ENEMY_HIT_LAYER = 1;
