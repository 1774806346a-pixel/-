import { expect, test } from "@playwright/test";

test("exposes diagnosis and controlled rewrite stages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /剧本诊断/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /版本中心/ })).toBeVisible();
});

