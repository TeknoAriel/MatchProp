import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'smoke-ux@matchprop.com';

async function loginWithDevLink(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
  await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
  const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
  await expect(devLink).toBeVisible();
  const href = await devLink.getAttribute('href');
  expect(href).toBeTruthy();
  await page.goto(href!, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });
}

test.describe('alerts: UI unificada', () => {
  test('Mis alertas: heading y botonera (suscripciones o empty)', async ({ page }) => {
    await loginWithDevLink(page);
    await page.goto('/alerts');
    await expect(page.getByRole('heading', { name: 'Mis alertas' })).toBeVisible({
      timeout: 10000,
    });

    const hasCards = await page
      .getByRole('button', { name: 'Acciones de alerta' })
      .first()
      .isVisible();
    const hasEmpty = await page.getByText('No tenés alertas activas').isVisible();
    const hasDeliveries = await page
      .getByRole('button', { name: 'Acciones del aviso' })
      .first()
      .isVisible();

    expect(hasCards || hasEmpty || hasDeliveries).toBe(true);

    if (hasCards) {
      await page.getByRole('button', { name: 'Acciones de alerta' }).first().click();
      await expect(page.getByRole('heading', { name: 'Gestionar alerta' })).toBeVisible({
        timeout: 5000,
      });
      await page.getByRole('button', { name: 'Cerrar' }).click();
    }

    if (hasDeliveries) {
      await page.getByRole('button', { name: 'Acciones del aviso' }).first().click();
      await expect(page.getByRole('heading', { name: 'Aviso disparado' })).toBeVisible({
        timeout: 5000,
      });
      await page.getByRole('button', { name: 'Cerrar' }).click();
    }
  });
});
