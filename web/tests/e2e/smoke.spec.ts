import { test, expect } from '@playwright/test';

test('homepage loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('EHE Signal');
});

test('homepage displays main heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /ehe signal/i })).toBeVisible();
});
