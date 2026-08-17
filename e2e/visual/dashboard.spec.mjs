import { test, expect } from '@playwright/test';

const dashboardPath = '/dashboard/';

test.describe('لوحة المشغّل — العقد المرئي والوصولي', () => {
  test('يعرض صفحة دخول دلالية دون أخطاء console أو overflow', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(dashboardPath, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle('Aqarat OS — Control Plane');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.locator('#loginButton')).toHaveRole('button', { name: 'دخول' });

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(consoleErrors).toEqual([]);
  });

  test('يُظهر التركيز المرئي عند التنقل بلوحة المفاتيح', async ({ page }) => {
    await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
  });

  test('يحافظ على مظهر شاشة الدخول', async ({ page }) => {
    await page.goto(dashboardPath, { waitUntil: 'networkidle' });
    await expect(page).toHaveScreenshot('dashboard-login.png', { fullPage: true });
  });
});
