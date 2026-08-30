import { expect, test } from "@playwright/test";

test("shows two screenplay entry cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /创意中心/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /剧本演练/ })).toBeVisible();
});

test("opens episodic workspace with episode controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /创意中心/ }).click();
  await expect(page.getByRole("heading", { name: "我的短剧项目" })).toBeVisible();
  await expect(page.getByLabel("目标集数")).toBeVisible();
  await expect(page.getByLabel("主体大纲")).toBeVisible();
  await expect(page.getByRole("button", { name: /创建下一集/ })).toBeVisible();
  await page.getByRole("button", { name: /创建下一集/ }).click();
  await expect(page.getByLabel("目标集数")).toHaveValue("2");
});
