import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || process.env.PLAYWRIGHT_PORT || 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`;
const localNoProxy = mergeNoProxy(process.env.NO_PROXY || process.env.no_proxy || "");

process.env.NO_PROXY = localNoProxy;
process.env.no_proxy = localNoProxy;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1" ? undefined : {
    command: `node --use-env-proxy ./node_modules/next/dist/bin/next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      NO_PROXY: localNoProxy,
      no_proxy: localNoProxy
    }
  }
});

function mergeNoProxy(value) {
  const entries = new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  for (const entry of ["127.0.0.1", "localhost", "::1"]) {
    entries.add(entry);
  }

  return [...entries].join(",");
}
