import { expect, test } from "@playwright/test";

test("opens the screenplay version center and exposes recovery controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /版本中心/ }).click();
  await expect(page.getByText(/版本中心/).first()).toBeVisible();
});
