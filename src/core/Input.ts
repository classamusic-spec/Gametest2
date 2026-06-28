/** Tracks keyboard + mouse button state and one-shot edge events. */
export class Input {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  mouseDown = false;
  rightMouseDown = false;
  private mousePressed = false;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      if (!this.mouseDown) this.mousePressed = true;
      this.mouseDown = true;
    }
    if (e.button === 2) this.rightMouseDown = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key was first pressed. Call after using. */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** True only on the frame the left mouse button was first pressed. */
  wasMousePressed(): boolean {
    return this.mousePressed;
  }

  /** Clear per-frame edge events. Call at end of each update. */
  endFrame() {
    this.pressedThisFrame.clear();
    this.mousePressed = false;
  }
}
