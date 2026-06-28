import { test, expect } from "@playwright/test";

test("game loads, renders, and exposes a working state machine", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  // Canvas exists and has real dimensions.
  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);

  // The render loop sets this flag after the first frame.
  await page.waitForFunction(() => (window as any).__gameReady === true, {
    timeout: 15_000,
  });

  // WebGL context is alive.
  const hasGL = await page.evaluate(() => {
    const c = document.getElementById("game") as HTMLCanvasElement;
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });
  expect(hasGL).toBeTruthy();

  // Start screen is visible at launch.
  await expect(page.locator("#screen")).toBeVisible();
  await expect(page.locator("#screen-button")).toHaveText("DEPLOY");

  // Debug hook reports the menu state.
  const state = await page.evaluate(() => (window as any).__game.getState());
  expect(state).toBe("menu");

  // Driving into a level via the debug hook spawns enemies.
  await page.evaluate(() => (window as any).__game.startGame());
  await page.evaluate(() => (window as any).__game.spawnCurrentWave());
  const remaining = await page.evaluate(() => (window as any).__game.enemiesRemaining());
  expect(remaining).toBeGreaterThan(0);

  // Level 4 spawns the Reptilian Warlord boss.
  await page.evaluate(() => (window as any).__game.forcePlay(3));
  const hasBoss = await page.evaluate(() => (window as any).__game.hasBoss());
  expect(hasBoss).toBe(true);

  await page.screenshot({ path: "test-results/start-screen.png" });

  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
