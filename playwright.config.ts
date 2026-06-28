import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_PATH ||
            "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          args: ["--use-gl=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
