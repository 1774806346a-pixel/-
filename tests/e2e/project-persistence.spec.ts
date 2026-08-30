import { expect, test } from '@playwright/test';

test('creates a project, opens its source workspace, and shows it in recent projects', async ({ page }) => {
  await page.goto('/');
  const name = `E2E ${Date.now()}`;
  await page.getByLabel('项目名称').fill(name);
  await page.getByRole('button', { name: '新建项目' }).click();
  await expect(page.getByRole('button', { name })).toBeVisible();
  await expect(page.getByLabel('创意或剧本')).toBeVisible();
  await page.getByLabel('创意或剧本').fill('原稿内容');
  await page.getByRole('button', { name: '保存原稿' }).click();
  await expect(page.getByText(/字符数/)).toBeVisible();
  await expect(page.getByText(/SHA-256/)).toBeVisible();
});
