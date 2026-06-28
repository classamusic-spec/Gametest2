/** Reusable health component for the player and enemies. */
export class Health {
  current: number;
  readonly max: number;

  constructor(max: number) {
    this.max = max;
    this.current = max;
  }

  get alive(): boolean {
    return this.current > 0;
  }

  get fraction(): number {
    return Math.max(0, this.current / this.max);
  }

  /** Returns true if this hit was fatal. */
  damage(amount: number): boolean {
    if (this.current <= 0) return false;
    this.current -= amount;
    return this.current <= 0;
  }

  reset() {
    this.current = this.max;
  }
}
