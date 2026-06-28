/** Tracks keyboard + mouse button state and one-shot edge events. */
export class Input {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  mouseDown = false;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key was first pressed. Call after using. */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** Clear per-frame edge events. Call at end of each update. */
  endFrame() {
    this.pressedThisFrame.clear();
  }
}
