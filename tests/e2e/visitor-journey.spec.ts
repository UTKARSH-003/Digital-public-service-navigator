import { expect, test } from '@playwright/test';

test('visitor: search, open a service, complete eligibility, see result and official source', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Not an official government website/).first()).toBeVisible();

  await page.getByRole('searchbox', { name: /what government service/i }).or(page.getByLabel(/what government service/i)).first().fill('scholarship');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/services\?q=scholarship/);

  await page.getByRole('link', { name: /Post-matric scholarship/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Post-matric scholarship/ })).toBeVisible();
  await expect(page.getByText('Demonstration record').first()).toBeVisible();

  await page.getByRole('link', { name: 'Check my eligibility' }).click();
  await page.getByLabel('Current status').selectOption('student');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel(/Annual family income/).fill('100000');
  await page.getByRole('button', { name: 'See result' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Likely eligible' })).toBeVisible();
  await expect(page.getByText(/not a government decision/i)).toBeVisible();
  const source = page.locator('#main').getByRole('link', { name: /National Scholarship Portal/ });
  await expect(source).toHaveAttribute('href', 'https://scholarships.gov.in/');
  await expect(source).toHaveAttribute('rel', /noopener/);
});

test('eligibility reports "likely not eligible" when a required condition fails', async ({ page }) => {
  await page.goto('/services/demo-old-age-pension/eligibility');
  await page.getByLabel('Age in years').fill('40');
  await page.getByRole('button', { name: 'See result' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Likely not eligible' })).toBeVisible();
});

test('assistant answers from records with official sources and no AI configured', async ({ page }) => {
  await page.goto('/assistant');
  await page.getByRole('button', { name: /Which scholarships can I apply for/ }).click();
  await expect(page.getByText('Official sources').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Post-matric scholarship/ })).toBeVisible();
});

test('language switcher changes the interface language', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Language').selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.getByRole('link', { name: 'सेवाएं' }).first()).toBeVisible();
});

test('mobile navigation opens and works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: /menu/i }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Services' }).click();
  await expect(page).toHaveURL(/\/services/);
});

test('anonymous visitors cannot reach protected pages or the admin API', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get('http://localhost:4000/api/admin/services')).status()).toBe(401);
  expect((await request.post('http://localhost:4000/api/admin/services', { data: {} })).status()).toBe(401);
});
