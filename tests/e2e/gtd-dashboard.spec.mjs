import { expect, test } from "@playwright/test";
import { ACCESS_COOKIE, createSessionForPasscode, getAccessState } from "../../src/access-passcode.js";

const SORT_LABELS = ["任务", "状态", "优先级", "截止"];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!hasFlowUsAuthConfig(), "Set FLOWUS_ACCESS_TOKEN, or FLOWUS_PROXY_BASE + GTD_PROXY_SECRET.");
  await seedSessionCookie(page, testInfo);
});

test("authenticated dashboard renders core regions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "任务视图" })).toBeVisible();
  await expect(page.locator(".list-nav")).toBeVisible();
  await expect(page.locator(".task-table")).toBeVisible();
  await expect(page.locator(".detail-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "新增任务" })).toBeVisible();
});

test("table headers toggle sort direction", async ({ page }) => {
  await page.goto("/");
  await waitForTasksSettled(page);

  for (const label of SORT_LABELS) {
    const button = page.locator(".sort-button").filter({ hasText: label });
    await button.click();
    await expect(button.locator("span").nth(1)).toHaveText("▲");

    await button.click();
    await expect(button.locator("span").nth(1)).toHaveText("▼");
  }
});

test("task detail controls stay collapsed until opened", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForTasksSettled(page);

  const hasTask = await selectFirstNonEmptyList(page);
  if (!hasTask) {
    testInfo.annotations.push({
      type: "note",
      description: "No FlowUs task rows were available for detail-control checks."
    });
    return;
  }

  await page.locator(".task-row").first().click();
  await expect(page.locator(".detail-select")).toHaveCount(3);
  await expect(page.locator(".date-toggle")).toBeVisible();
  await expect(page.locator(".calendar-box")).toHaveCount(0);

  await page.locator(".date-toggle").click();
  await expect(page.locator(".calendar-box")).toBeVisible();
});

async function waitForTasksSettled(page) {
  await expect(page.locator(".state-line").filter({ hasText: "正在读取 FlowUs。" })).toHaveCount(0, {
    timeout: 45_000
  });
}

async function seedSessionCookie(page, testInfo) {
  const baseURL = String(testInfo.project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100");
  const state = await getAccessState(process.env);
  if (!state.passcode) {
    throw new Error("FlowUs access passcode page did not return a passcode.");
  }

  const session = await createSessionForPasscode(state.passcode, process.env);
  if (!session.ok) {
    throw new Error(`Could not create test session: ${session.code || "unknown_error"}`);
  }

  const url = new URL(baseURL);
  await page.context().addCookies([{
    name: ACCESS_COOKIE,
    value: session.cookieValue,
    url: baseURL,
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "Lax"
  }]);
}

async function selectFirstNonEmptyList(page) {
  return page.locator(".list-nav button").evaluateAll((buttons) => {
    const nonEmpty = buttons.find((button) => {
      const count = Number(button.querySelector("strong")?.textContent || "0");
      return count > 0;
    });

    if (!nonEmpty) return false;
    nonEmpty.click();
    return true;
  });
}

function hasFlowUsAuthConfig() {
  return Boolean(
    process.env.FLOWUS_ACCESS_TOKEN ||
    (process.env.FLOWUS_PROXY_BASE && (process.env.GTD_PROXY_SECRET || process.env.FLOWUS_PROXY_SECRET))
  );
}
