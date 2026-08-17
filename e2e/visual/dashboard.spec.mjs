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

  test('يغطي تدفق Audit Explorer والبحث وتسجيل الخروج بمصادقة اصطناعية', async ({ page }) => {
    let authenticated = false;
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror:${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(`console:${message.text()}`); });
    const auditRows = [{
      id: 'audit-1', event_type: 'dashboard_action', entity_type: 'review_queue', entity_id: 'review-1',
      actor_type: 'dashboard_admin', actor_id: 'operator', reason: 'مراجعة يدوية', correlation_id: 'corr-audit-1', created_at: '2026-08-17T10:00:00Z',
    }];
    const dashboardPayload = (view = 'all') => ({
      ok: true,
      view,
      metrics: { properties: 1, leads: 1 },
      brand: { brand: 'Aqarat Test' },
      audit_events: auditRows,
      pagination: { audit_events: { limit: 50, offset: 0, returned: auditRows.length, has_more: false, next_offset: null } },
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/dashboard/login')) {
        authenticated = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      if (url.pathname.endsWith('/dashboard/logout')) {
        authenticated = false;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      if (!authenticated && url.pathname.endsWith('/dashboard/data')) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'AUTH' }) });
        return;
      }
      const body = url.pathname.endsWith('/public-config') ? { brand: 'Aqarat Test' } : dashboardPayload(url.searchParams.get('view') || 'all');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' });
    await page.locator('#password').fill('synthetic-test-secret');
    await page.locator('#loginButton').click();
    await page.waitForTimeout(250);
    if (await page.locator('#app').getAttribute('hidden') !== null) throw new Error(`authenticated boot failed: ${runtimeErrors.join(' | ') || 'no runtime error captured'}`);
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#logoutButton')).toBeVisible();

    await page.locator('[data-view="audit"]').click();
    await expect(page.locator('h2', { hasText: 'سجل التدقيق' })).toBeVisible();
    await expect(page.locator('tbody tr')).toContainText('dashboard_action');
    await page.locator('#searchInput').fill('dashboard_action');
    await page.locator('#searchForm button[type="submit"]').click();
    await expect(page.locator('tbody tr')).toContainText('مراجعة يدوية');

    await page.locator('#logoutButton').click();
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
  });
});
