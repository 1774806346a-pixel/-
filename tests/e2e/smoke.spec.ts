import { expect, test } from '@playwright/test';

test('opens the two-entry screenplay workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '戏匠' })).toBeVisible();
  await expect(page.getByRole('button', { name: /创意中心/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /剧本演练/ })).toBeVisible();
});
