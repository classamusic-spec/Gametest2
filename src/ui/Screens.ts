/** Full-screen overlay (start / level intro / game over / victory). */
export class Screens {
  private root = document.getElementById("screen")!;
  private title = document.getElementById("screen-title")!;
  private subtitle = document.getElementById("screen-subtitle")!;
  private body = document.getElementById("screen-body")!;
  private button = document.getElementById("screen-button") as HTMLButtonElement;
  private hint = this.root.querySelector(".screen-hint") as HTMLElement;
  private handler: (() => void) | null = null;

  constructor() {
    this.button.addEventListener("click", () => {
      const h = this.handler;
      this.handler = null;
      h?.();
    });
  }

  private render(opts: {
    title: string;
    subtitle: string;
    body: string;
    button: string;
    showHint: boolean;
    onConfirm: () => void;
  }) {
    this.title.textContent = opts.title;
    this.subtitle.textContent = opts.subtitle;
    this.body.innerHTML = opts.body;
    this.button.textContent = opts.button;
    this.hint.style.display = opts.showHint ? "" : "none";
    this.handler = opts.onConfirm;
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }

  showStart(onConfirm: () => void) {
    this.render({
      title: "GALACTIC FEDERATION",
      subtitle: "ALIEN SHOOTER",
      body:
        "Federation trooper, four hostile species have overrun our sectors. " +
        "Push through <span class='accent'>four planets</span> and drive them out:<br><br>" +
        "<span class='accent'>Greys</span> · <span class='accent'>Insectoids</span> · " +
        "<span class='accent'>Evil Nordics</span> · <span class='danger'>Evil Reptilians</span>",
      button: "DEPLOY",
      showHint: true,
      onConfirm,
    });
  }

  showLevelIntro(level: number, name: string, briefing: string, onConfirm: () => void) {
    this.render({
      title: `LEVEL ${level}`,
      subtitle: name,
      body: briefing,
      button: "ENGAGE",
      showHint: true,
      onConfirm,
    });
  }

  showLevelComplete(level: number, score: number, onConfirm: () => void) {
    this.render({
      title: "SECTOR CLEARED",
      subtitle: `LEVEL ${level} COMPLETE`,
      body: `Score: <span class='accent'>${score}</span><br>The Federation advances.`,
      button: "NEXT SECTOR",
      showHint: false,
      onConfirm,
    });
  }

  showGameOver(score: number, onConfirm: () => void) {
    this.render({
      title: "TROOPER DOWN",
      subtitle: "MISSION FAILED",
      body: `Final score: <span class='danger'>${score}</span><br>The aliens overran your position.`,
      button: "REDEPLOY",
      showHint: false,
      onConfirm,
    });
  }

  showVictory(score: number, onConfirm: () => void) {
    this.render({
      title: "VICTORY",
      subtitle: "THE FEDERATION PREVAILS",
      body:
        `All four species repelled. Final score: <span class='accent'>${score}</span><br>` +
        "The galaxy is safe — for now.",
      button: "PLAY AGAIN",
      showHint: false,
      onConfirm,
    });
  }
}
