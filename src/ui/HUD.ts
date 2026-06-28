import type { WeaponSlotView } from "../weapons/Arsenal";

/** Thin wrapper over the DOM HUD elements declared in index.html. */
export class HUD {
  private root = document.getElementById("hud")!;
  private levelName = document.getElementById("level-name")!;
  private enemiesRemaining = document.getElementById("enemies-remaining")!;
  private healthFill = document.getElementById("health-fill")!;
  private scoreValue = document.getElementById("score-value")!;
  private ammoValue = document.getElementById("ammo-value")!;
  private weaponName = document.getElementById("weapon-name")!;
  private weaponStrip = document.getElementById("weapon-strip")!;
  private pickupToast = document.getElementById("pickup-toast")!;
  private vignette = document.getElementById("damage-vignette")!;
  private lowVignette = document.getElementById("lowhealth-vignette")!;
  private reloadIndicator = document.getElementById("reload-indicator")!;
  private crosshair = document.getElementById("crosshair")!;
  private hitmarker = document.getElementById("hitmarker")!;
  private bossBar = document.getElementById("boss-bar")!;
  private bossName = document.getElementById("boss-name")!;
  private bossFill = document.getElementById("boss-fill")!;
  private killFeed = document.getElementById("kill-feed")!;
  private crosshairTimer = 0;

  show() {
    this.root.classList.remove("hidden");
  }
  hide() {
    this.root.classList.add("hidden");
    this.hideBoss();
    this.killFeed.innerHTML = "";
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
  setWeaponName(name: string) {
    this.weaponName.textContent = name;
  }

  /** Render the weapon selector strip from the arsenal snapshot. */
  setWeapons(slots: WeaponSlotView[]) {
    this.weaponStrip.innerHTML = "";
    slots.forEach((s, i) => {
      const el = document.createElement("div");
      el.className =
        "weap-slot " + (s.current ? "current" : s.owned ? "owned" : "locked");
      el.innerHTML = `<span class="num">${i + 1}</span>${s.tag}`;
      this.weaponStrip.appendChild(el);
    });
  }

  /** Flash a pickup message (loot collected). */
  showPickup(text: string) {
    this.pickupToast.textContent = text;
    this.pickupToast.classList.remove("show");
    void this.pickupToast.offsetWidth;
    this.pickupToast.classList.add("show");
  }
  setReloading(on: boolean) {
    this.reloadIndicator.classList.toggle("hidden", !on);
  }

  setHealth(fraction: number) {
    this.healthFill.style.width = `${Math.round(fraction * 100)}%`;
    if (fraction > 0.5) {
      this.healthFill.style.background = "linear-gradient(90deg, #4dff9e, #36e3ff)";
    } else if (fraction > 0.25) {
      this.healthFill.style.background = "linear-gradient(90deg, #ffd24d, #ff9e4d)";
    } else {
      this.healthFill.style.background = "linear-gradient(90deg, #ff3b6b, #ff6b3b)";
    }
    this.lowVignette.classList.toggle("on", fraction <= 0.3 && fraction > 0);
  }

  /** Flash the red damage vignette. */
  flashDamage() {
    this.vignette.style.opacity = "0.9";
    setTimeout(() => {
      this.vignette.style.opacity = "0";
    }, 90);
  }

  // ---------- Crosshair ----------
  setAds(on: boolean) {
    this.crosshair.classList.toggle("ads", on);
  }
  /** Briefly expand the crosshair on fire. */
  pulseCrosshair() {
    this.crosshair.classList.add("firing");
    this.crosshairTimer = 0.12;
  }
  update(dt: number) {
    if (this.crosshairTimer > 0) {
      this.crosshairTimer -= dt;
      if (this.crosshairTimer <= 0) this.crosshair.classList.remove("firing");
    }
  }

  // ---------- Hitmarker ----------
  showHitmarker(kill: boolean) {
    this.hitmarker.classList.remove("show");
    this.hitmarker.classList.toggle("kill", kill);
    // Force reflow so the animation restarts on rapid hits.
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add("show");
  }

  // ---------- Boss bar ----------
  showBoss(name: string) {
    this.bossName.textContent = name;
    this.bossFill.style.width = "100%";
    this.bossBar.classList.remove("hidden");
  }
  setBossHealth(fraction: number) {
    this.bossFill.style.width = `${Math.max(0, Math.round(fraction * 100))}%`;
  }
  hideBoss() {
    this.bossBar.classList.add("hidden");
  }

  // ---------- Kill feed ----------
  addKill(label: string, points: number, boss = false) {
    const el = document.createElement("div");
    el.className = "kill-entry" + (boss ? " boss" : "");
    el.innerHTML = `${label}<span class="pts">+${points}</span>`;
    this.killFeed.prepend(el);
    while (this.killFeed.childElementCount > 4) {
      this.killFeed.lastElementChild?.remove();
    }
    setTimeout(() => el.classList.add("fade"), 2600);
    setTimeout(() => el.remove(), 3100);
  }
}
