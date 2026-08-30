import { expect, test } from "@playwright/test";
test("exposes production stages", async ({ page }) => { await page.goto("/"); await expect(page.getByRole("button", { name: /资产/ })).toBeVisible(); await expect(page.getByRole("button", { name: /分镜/ })).toBeVisible(); });

