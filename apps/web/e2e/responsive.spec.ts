/**
 * Revisión responsive: viewports 320px y 375px.
 * Ver docs/responsive-checklist.md
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
] as const;

test.describe('responsive: sin overflow horizontal', () => {
  for (const viewport of VIEWPORTS) {
    test(`viewport ${viewport.width}x${viewport.height}: /feed carga y sin scroll horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/feed');
      await page.waitForTimeout(2000);
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(innerWidth + 2); // 2px tolerancia
      // Con o sin login: algo de contenido visible (feed o login)
      const feedContent = page
        .getByRole('link', { name: 'Modo Lista' })
        .or(page.getByText(/No hay|Crear búsqueda/));
      const loginContent = page
        .getByText(/Iniciar sesión|Enviar link/)
        .or(page.getByLabel('Email'));
      await expect(feedContent.or(loginContent)).toBeVisible({ timeout: 8000 });
    });

    test(`viewport ${viewport.width}x${viewport.height}: /feed/list carga y sin scroll horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/feed/list');
      await page.waitForTimeout(2000);
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(innerWidth + 2);
      const listContent = page
        .getByText('Alertas')
        .or(page.getByText('Cambiar'))
        .or(page.getByText(/Sin búsqueda activa|No hay resultados|Crear búsqueda/))
        .or(page.locator('a[href^="/listing/"]'));
      const loginContent = page
        .getByText(/Iniciar sesión|Enviar link/)
        .or(page.getByLabel('Email'));
      await expect(listContent.or(loginContent)).toBeVisible({ timeout: 8000 });
    });

    test(`viewport ${viewport.width}x${viewport.height}: /assistant carga y sin scroll horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/assistant');
      await page.waitForTimeout(1000);
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(innerWidth + 2);
      // Con o sin login: asistente (textarea) o login
      const heading = page.getByRole('heading', { name: 'Asistente de búsqueda' });
      const textarea = page.locator('textarea').first();
      const loginContent = page
        .getByText(/Iniciar sesión|Enviar link/)
        .or(page.getByLabel('Email'));
      await expect(heading.or(loginContent)).toBeVisible({ timeout: 8000 });
      await expect(textarea.or(loginContent)).toBeVisible({ timeout: 5000 });
    });
  }
});
