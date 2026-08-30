import { expect, test } from "@playwright/test";

test("exposes model settings and screenplay entries", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "模型设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: /剧本演练/ })).toBeVisible();
});
