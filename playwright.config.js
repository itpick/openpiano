// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,          // full-course sweeps are long
  expect: { timeout: 30_000 },
  fullyParallel: false,      // one browser mic at a time
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8791",
    headless: true,
    // fake device flags give Chromium a silent audio input; we inject our own
    // WebAudio-based "virtual mic" (renderWav → MediaStream) via init script
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
    permissions: ["microphone"],
  },
  webServer: {
    command: "python3 -m http.server 8791",
    port: 8791,
    reuseExistingServer: false,
    cwd: ".",
    timeout: 15_000,
  },
});
