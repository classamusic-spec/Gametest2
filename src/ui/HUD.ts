/** Thin wrapper over the DOM HUD elements declared in index.html. */
export class HUD {
  private root = document.getElementById("hud")!;
  private levelName = document.getElementById("level-name")!;
  private enemiesRemaining = document.getElementById("enemies-remaining")!;
  private healthFill = document.getElementById("health-fill")!;
  private scoreValue = document.getElementById("score-value")!;
  private ammoValue = document.getElementById("ammo-value")!;
  private vignette = document.getElementById("damage-vignette")!;
  private reloadIndicator = document.getElementById("reload-indicator")!;

  show() {
    this.root.classList.remove("hidden");
  }
  hide() {
    this.root.classList.add("hidden");
  }

  setLevel(name: string) {
    this.levelName.textContent = name;
  }
  setEnemiesRemaining(n: number) {
    this.enemiesRemaining.textContent = `ENEMIES: ${n}`;
  }
  setScore(n: number) {
    this.scoreValue.textContent = String(n);
  }
  setAmmo(text: string) {
    this.ammoValue.textContent = text;
  }
  setReloading(on: boolean) {
    this.reloadIndicator.classList.toggle("hidden", !on);
  }

  setHealth(fraction: number) {
    this.healthFill.style.width = `${Math.round(fraction * 100)}%`;
    // Shift bar toward red as health drops.
    if (fraction > 0.5) {
      this.healthFill.style.background = "linear-gradient(90deg, #4dff9e, #36e3ff)";
    } else if (fraction > 0.25) {
      this.healthFill.style.background = "linear-gradient(90deg, #ffd24d, #ff9e4d)";
    } else {
      this.healthFill.style.background = "linear-gradient(90deg, #ff3b6b, #ff6b3b)";
    }
  }

  /** Flash the red damage vignette. */
  flashDamage() {
    this.vignette.style.opacity = "0.9";
    setTimeout(() => {
      this.vignette.style.opacity = "0";
    }, 90);
  }
}
