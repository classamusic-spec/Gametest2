import { Weapon } from "./Weapon";
import { WEAPONS, WEAPON_ORDER, type WeaponId } from "./WeaponTypes";

interface Slot {
  owned: boolean;
  mag: number;
  reserve: number;
}

export interface WeaponSlotView {
  id: WeaponId;
  tag: string;
  owned: boolean;
  current: boolean;
}

/**
 * Inventory of weapons: which are owned, their stored ammo, and the currently
 * equipped one. Handles switching, loot pickups, and auto-swap to the pistol
 * when the active weapon runs dry.
 */
export class Arsenal {
  private weapon: Weapon;
  private slots: Record<WeaponId, Slot>;
  private current: WeaponId = "pistol";

  /** Notifies the HUD when the inventory or selection changes. */
  onInventoryChange?: () => void;

  constructor(weapon: Weapon) {
    this.weapon = weapon;
    this.slots = {} as Record<WeaponId, Slot>;
    this.reset();
  }

  /** Player starts with the pistol and machine gun; the rest are looted. */
  reset() {
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id];
      const starter = id === "pistol" || id === "machinegun";
      this.slots[id] = { owned: starter, mag: def.magazine, reserve: def.reserve };
    }
    this.current = "pistol";
    this.weapon.equip(WEAPONS.pistol, this.slots.pistol.mag, this.slots.pistol.reserve);
    this.onInventoryChange?.();
  }

  get currentId(): WeaponId {
    return this.current;
  }

  /** Store the live weapon ammo back into its slot (before switching). */
  private stash() {
    const s = this.slots[this.current];
    s.mag = this.weapon.ammo;
    s.reserve = this.weapon.reserve;
  }

  equip(id: WeaponId) {
    if (!this.slots[id].owned || id === this.current) return;
    this.stash();
    this.current = id;
    const s = this.slots[id];
    this.weapon.equip(WEAPONS[id], s.mag, s.reserve);
    this.onInventoryChange?.();
  }

  /** Select by HUD index (0-based over WEAPON_ORDER). */
  selectIndex(i: number) {
    const id = WEAPON_ORDER[i];
    if (id) this.equip(id);
  }

  /** Cycle to the next owned weapon. */
  next() {
    const owned = WEAPON_ORDER.filter((id) => this.slots[id].owned);
    const idx = owned.indexOf(this.current);
    const nextId = owned[(idx + 1) % owned.length];
    this.equip(nextId);
  }

  /** If the active weapon is empty, fall back to the pistol. */
  checkDry() {
    if (this.current !== "pistol" && this.weapon.dry) {
      this.equip("pistol");
    }
  }

  /**
   * Grant a weapon from loot. Unlocks + auto-equips if new; refills reserve if
   * already owned. @returns a short label for the pickup toast.
   */
  giveWeapon(id: WeaponId): string {
    const def = WEAPONS[id];
    const s = this.slots[id];
    if (!s.owned) {
      s.owned = true;
      s.mag = def.magazine;
      s.reserve = def.reserve;
      this.equip(id);
      this.onInventoryChange?.();
      return `${def.name} ACQUIRED`;
    }
    // Already owned — top up its reserve.
    s.reserve = def.reserve;
    if (this.current === id) {
      this.weapon.reserve = def.reserve;
      this.weapon.onAmmoChange?.();
    }
    this.onInventoryChange?.();
    return `${def.tag} AMMO +`;
  }

  /** Refill reserves for every owned weapon and top up the current magazine. */
  giveAmmo(): string {
    for (const id of WEAPON_ORDER) {
      const s = this.slots[id];
      if (!s.owned) continue;
      s.reserve = WEAPONS[id].reserve;
    }
    const cur = this.slots[this.current];
    cur.mag = WEAPONS[this.current].magazine;
    this.weapon.ammo = cur.mag;
    this.weapon.reserve = cur.reserve;
    this.weapon.onAmmoChange?.();
    this.onInventoryChange?.();
    return "AMMO REPLENISHED";
  }

  /** A random weapon the player does not yet own (for loot seeding/drops). */
  randomUnowned(): WeaponId | null {
    const locked = WEAPON_ORDER.filter((id) => !this.slots[id].owned);
    if (locked.length === 0) return null;
    return locked[Math.floor(Math.random() * locked.length)];
  }

  /** Snapshot for the HUD weapon strip. */
  view(): WeaponSlotView[] {
    return WEAPON_ORDER.map((id) => ({
      id,
      tag: WEAPONS[id].tag,
      owned: this.slots[id].owned,
      current: id === this.current,
    }));
  }
}
