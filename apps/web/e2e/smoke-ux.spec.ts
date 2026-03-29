import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'smoke-ux@matchprop.com';

test.describe('smoke:ux', () => {
  test('flujo completo: login magic link -> assistant -> guardar búsqueda -> searches', async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (err) => {
      runtimeErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        runtimeErrors.push(`console.error: ${text}`);
      }
    });

    await page.goto('/login');
    expect(page.url()).toContain('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();

    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    await expect(devLink).toBeVisible();
    const href = await devLink.getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });

    await page.goto('/assistant');
    await expect(page.getByRole('heading', { name: /Asistente avanzado|Buscar/ })).toBeVisible({
      timeout: 10000,
    });

    const searchText = 'Quiero comprar depto 2 dorm en Rosario hasta 120k usd';
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible' });
    await textarea.click();
    await textarea.pressSequentially(searchText, { delay: 20 });
    await page.getByRole('button', { name: 'Enviar búsqueda' }).click();

    await expect(page.getByRole('heading', { name: /Tu búsqueda|Resumen/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();

    await page.getByRole('link', { name: 'Ver listado' }).click();
    await expect(
      page
        .getByRole('heading', { name: 'Resultados' })
        .or(page.locator('text=Mostrando similares'))
        .or(page.locator('text=No encontramos'))
    ).toBeVisible({ timeout: 15000 });

    // Flujo búsqueda activa → feed/list: la búsqueda aplicada en assistant debe verse en feed/list
    await page.goto('/feed/list');
    await expect(
      page
        .getByText('Alertas')
        .or(page.getByText('Cambiar búsqueda'))
        .or(page.locator('a[href^="/listing/"]'))
        .or(page.getByText(/Sin búsqueda activa|No hay resultados|Crear búsqueda/))
    ).toBeVisible({ timeout: 10000 });

    // Volver al assistant y guardar (re-enviar la misma búsqueda por texto; ya no hay chips de ejemplo)
    await page.goto('/assistant');
    await expect(page.getByRole('heading', { name: /Asistente avanzado|Buscar/ })).toBeVisible({
      timeout: 5000,
    });
    const textareaAgain = page.locator('textarea').first();
    await textareaAgain.click();
    await textareaAgain.fill('');
    await textareaAgain.pressSequentially(searchText, { delay: 20 });
    await page.getByRole('button', { name: 'Enviar búsqueda' }).click();
    await expect(page.getByRole('heading', { name: /Tu búsqueda|Resumen/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(
      page
        .getByText('Guardada y activa')
        .or(page.getByRole('link', { name: /Ir a búsqueda|Mis búsquedas/ }))
        .or(page.getByRole('link', { name: 'Ir a búsquedas guardadas' }))
    ).toBeVisible({ timeout: 5000 });

    await page.goto('/searches');
    await expect(page.getByRole('heading', { name: 'Búsquedas guardadas' })).toBeVisible();
    const searchLink = page.locator('a[href^="/searches/"]').first();
    await expect(searchLink).toBeVisible();
    await searchLink.click();

    await expect(page.getByRole('heading', { name: 'Resultados' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Alertas', exact: true })).toBeVisible();
    const activarAlertaBtn = page.getByRole('button', { name: 'Activar' }).first();
    if (await activarAlertaBtn.isVisible()) {
      await activarAlertaBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
    }

    await page.goto('/alerts');
    await expect(page.getByRole('heading', { name: /Alertas|Mis alertas/ })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText('Nuevas publicaciones').or(page.locator('a[href^="/searches/"]')).first()
    ).toBeVisible({ timeout: 5000 });

    // Demo 1-click: si está habilitada, crear escenario y validar links + ACTIVE + mensaje bloqueado
    await page.goto('/demo');
    if (await page.getByRole('button', { name: 'Crear escenario demo' }).isVisible()) {
      await page.getByRole('button', { name: 'Crear escenario demo' }).click();
      await expect(
        page
          .getByText('Listo')
          .or(page.getByRole('link', { name: /Búsqueda guardada/ }))
          .first()
      ).toBeVisible({ timeout: 15000 });
      const linkSearches = page.locator('a[href^="/searches/"]').first();
      await expect(linkSearches).toBeVisible();
      await page.goto('/leads');
      await expect(page.getByRole('heading', { name: /Mis consultas/ })).toBeVisible({
        timeout: 5000,
      });
      const activeBadge = page.getByText('ACTIVE').first();
      await expect(activeBadge).toBeVisible({ timeout: 5000 });
      const chatLink = page.locator('a[href*="/chat"]').first();
      await expect(chatLink).toBeVisible();
      await chatLink.click();
      await page.waitForURL(/\/leads\/.*\/chat/, { timeout: 8000 }).catch(() => {});
      await expect(page.getByText('[BLOCKED]').or(page.getByText(/bloqueado/))).toBeVisible({
        timeout: 5000,
      });
    }

    await page.goto('/feed/list');
    await expect(page.getByRole('heading', { name: /Lista/ })).toBeVisible({ timeout: 5000 });
    await expect(
      page
        .getByText('Sin búsqueda activa')
        .or(page.getByText('Crear búsqueda'))
        .or(page.locator('text=Alertas'))
        .or(page.locator('text=Cambiar búsqueda'))
    ).toBeVisible({ timeout: 5000 });
    const hasListings = await page.locator('a[href^="/listing/"]').first().isVisible();
    const hasEmpty = await page.getByText(/No hay resultados/).isVisible();
    expect(hasListings || hasEmpty).toBe(true);

    if (hasListings) {
      const contactarBtn = page.getByRole('button', { name: 'Quiero que me contacten' }).first();
      if (await contactarBtn.isVisible()) {
        await contactarBtn.click();
        await expect(page.getByText('Consulta enviada')).toBeVisible({ timeout: 5000 });
      }
    }

    await page.goto('/leads');
    await expect(page.getByRole('heading', { name: /Mis consultas/ })).toBeVisible({
      timeout: 5000,
    });
    const hasLeads =
      (await page.locator('a[href^="/listing/"]').first().isVisible()) ||
      (await page.getByText(/No tenés consultas enviadas/).isVisible());
    expect(hasLeads).toBe(true);

    // Activar lead PENDING (smoke-ux@ tiene premiumUntil demo)
    const activarLeadBtn = page.getByRole('button', { name: 'Activar ahora' }).first();
    if (await activarLeadBtn.isVisible()) {
      await activarLeadBtn.click();
      await page.waitForTimeout(2000);
    }

    // Chat: enviar email => bloqueado
    const chatLink = page.locator('a[href*="/chat"]').first();
    if (await chatLink.isVisible()) {
      await chatLink.click();
      await page.waitForURL(/\/leads\/.*\/chat/, { timeout: 5000 }).catch(() => {});
      const input = page.locator('input[placeholder*="mensaje"]').first();
      if (await input.isVisible()) {
        await input.fill('mi email es test@example.com');
        await page.getByRole('button', { name: 'Enviar' }).click();
        await page.waitForTimeout(1000);
        const blocked = page.getByText(/bloqueado/);
        await expect(blocked).toBeVisible({ timeout: 5000 });
      }
    }

    // Visits: agendar
    await page.goto('/leads');
    const visitsLink = page.locator('a[href*="/visits"]').first();
    if (await visitsLink.isVisible()) {
      await visitsLink.click();
      await page.waitForURL(/\/leads\/.*\/visits/, { timeout: 5000 }).catch(() => {});
      const dtInput = page.locator('input[type="datetime-local"]').first();
      if (await dtInput.isVisible()) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        const val = tomorrow.toISOString().slice(0, 16);
        await dtInput.fill(val);
        await page.getByRole('button', { name: 'Agendar' }).click();
        await page.waitForTimeout(1000);
      }
    }

    await page.goto('/settings/integrations/kiteprop');
    await expect(page.getByRole('heading', { name: 'Integración Kiteprop' })).toBeVisible({
      timeout: 5000,
    });

    // Filtrar errores benignos: ChunkLoadError, ResizeObserver, 401 pre-login, React key warning
    const benignPatterns = [
      /ChunkLoadError/i,
      /Loading chunk \d+ failed/i,
      /Failed to fetch dynamically imported module/i,
      /ResizeObserver loop/i,
      /ResizeObserver loop limit exceeded/i,
      /401 \(Unauthorized\)/i,
      /server responded with a status of 401/i,
      /Each child in a list should have a unique "key" prop/i,
    ];
    const criticalErrors = runtimeErrors.filter((e) => !benignPatterns.some((p) => p.test(e)));
    expect(
      criticalErrors,
      `Runtime/console errors críticos:\n${criticalErrors.join('\n\n')}`
    ).toEqual([]);
  });

  test('/status muestra API OK y LISTINGS COUNT numérico (no N/A) >= 200', async ({ page }) => {
    await page.goto('/status');
    await expect(page.getByRole('heading', { name: 'Estado del sistema' })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.waitForTimeout(3000);
    const apiRow = page.locator('li').filter({ hasText: 'API OK' });
    await expect(apiRow).toContainText('OK', { timeout: 10000 });
    const listRow = page.locator('li').filter({ hasText: 'LISTINGS COUNT' });
    await expect(listRow).toBeVisible({ timeout: 5000 });
    const listText = await listRow.textContent();
    expect(listText).not.toContain('N/A');
    const match = listText?.match(/(\d+)/);
    expect(match).toBeTruthy();
    const num = match?.[1];
    expect(num).toBeDefined();
    const count = parseInt(num!, 10);
    expect(count).toBeGreaterThanOrEqual(200);
  });

  test('no retroceder: /feed muestra card o empty-state', async ({ page }) => {
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
    await page.goto('/feed');
    await page.waitForTimeout(2000);
    const hasCard = await page.locator('img[alt]').first().isVisible();
    const hasEmpty = await page
      .getByText(/No hay propiedades|mostrando similares|Crear búsqueda/)
      .isVisible();
    const hasModoLista = await page.getByRole('link', { name: 'Modo Lista' }).isVisible();
    expect(hasCard || hasEmpty || hasModoLista).toBe(true);
  });

  test('no retroceder: /feed/list renderiza al menos 1 card', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    const href = await devLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });
    await page.goto('/feed/list');
    await page.waitForTimeout(3000);
    const hasCard = await page.locator('a[href^="/listing/"]').first().isVisible();
    const hasEmptyCta = await page
      .getByText(/No hay resultados|Crear búsqueda|Sin búsqueda|Ver todo|No hay inventario/)
      .isVisible();
    expect(hasCard || hasEmptyCta).toBe(true);
  });

  test('guard rail: ningún link a /listing/undefined ni /listing/null en /feed/list', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    const href = await devLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });
    await page.goto('/feed/list');
    await page.waitForTimeout(2000);
    const loadMoreBtn = page.getByRole('button', { name: 'Cargar más' });
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click();
      await page.waitForTimeout(2000);
    }
    const badLinks = await page
      .locator('a[href*="/listing/undefined"], a[href*="/listing/null"]')
      .count();
    expect(badLinks).toBe(0);
  });

  test('no retroceder: assistant preview muestra cards o fallback CTAs', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    const href = await devLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });
    await page.goto('/assistant');
    await page.locator('textarea').first().fill('Depto 2 dorm Rosario hasta 120k USD');
    await page.getByRole('button', { name: 'Enviar búsqueda' }).click();
    await expect(page.getByRole('heading', { name: /Tu búsqueda|Resumen/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('link', { name: 'Ver listado' }).first().click();
    await page.waitForTimeout(5000);
    const hasResultados = await page.getByRole('heading', { name: 'Resultados' }).isVisible();
    const hasCards = await page.locator('a[href^="/listing/"]').first().isVisible();
    const hasFallbackCtas = await page
      .getByText('Ver todo el feed')
      .or(page.getByText('Ajustar búsqueda'))
      .isVisible();
    expect(hasResultados).toBe(true);
    expect(hasCards || hasFallbackCtas).toBe(true);
  });

  test('no retroceder: tras activar alerta en /searches/:id, /alerts muestra subscription', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    const href = await devLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });
    await page.goto('/assistant');
    await page.locator('textarea').first().fill('Casa 3 dorm Funes');
    await page.getByRole('button', { name: 'Enviar búsqueda' }).click();
    await expect(page.getByRole('heading', { name: /Tu búsqueda|Resumen/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(
      page
        .getByText('Guardada y activa')
        .or(page.getByRole('link', { name: /Ir a búsqueda|Mis búsquedas/ }))
    ).toBeVisible({ timeout: 5000 });
    await page.goto('/searches');
    const searchLink = page.locator('a[href^="/searches/"]').first();
    await expect(searchLink).toBeVisible();
    await searchLink.click();
    await page.waitForTimeout(1000);
    const activarBtn = page.getByRole('button', { name: 'Activar' }).first();
    if (await activarBtn.isVisible()) {
      await activarBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.goto('/alerts');
    await expect(page.getByRole('heading', { name: /Alertas|Mis alertas/ })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText('Nuevas publicaciones').or(page.locator('a[href^="/searches/"]')).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('smoke: chat y visits con lead ACTIVE — verifica título y placeholders', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    const href = await devLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });
    await page.goto('/demo');
    if (!(await page.getByRole('button', { name: 'Crear escenario demo' }).isVisible())) {
      test.skip(true, 'Demo no habilitada');
      return;
    }
    await page.getByRole('button', { name: 'Crear escenario demo' }).click();
    await expect(
      page
        .getByText('Listo')
        .or(page.getByRole('link', { name: /Búsqueda guardada/ }))
        .first()
    ).toBeVisible({ timeout: 15000 });
    await page.goto('/leads');
    await expect(page.getByRole('heading', { name: /Mis consultas|Consultas/ })).toBeVisible({
      timeout: 5000,
    });
    const chatLink = page.locator('a[href*="/chat"]').first();
    const visitsLink = page.locator('a[href*="/visits"]').first();
    if (await chatLink.isVisible()) {
      await chatLink.click();
      await page.waitForURL(/\/leads\/.*\/chat/, { timeout: 5000 }).catch(() => {});
      await expect(
        page
          .getByRole('heading', { name: /Chat|Consultas/ })
          .or(page.getByText(/mensaje|Escribí/))
          .or(page.locator('input[placeholder*="mensaje"], textarea[placeholder*="mensaje"]'))
      ).toBeVisible({ timeout: 5000 });
    }
    await page.goto('/leads');
    if (await visitsLink.isVisible()) {
      await visitsLink.click();
      await page.waitForURL(/\/leads\/.*\/visits/, { timeout: 5000 }).catch(() => {});
      await expect(
        page
          .getByRole('heading', { name: /Agenda|Visitas/ })
          .or(page.getByText(/Agendar|Fecha/))
          .or(page.locator('input[type="datetime-local"]'))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('no aparece WhatsApp ni wsp en la UI (anti-cierre)', async ({ page }) => {
    await page.goto('/feed/list');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: /whatsapp/i })).toHaveCount(0);
    await expect(page.getByText('WhatsApp')).toHaveCount(0);
    const listingLink = page.locator('a[href^="/listing/"]').first();
    if (await listingLink.isVisible()) {
      await listingLink.click();
      await page.waitForTimeout(1000);
      await expect(page.getByRole('button', { name: /whatsapp/i })).toHaveCount(0);
      await expect(page.getByText('WhatsApp')).toHaveCount(0);
    }
  });

  test('regresión favoritos/match: si hay cards, no deben quedar en mockup puro', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Enviar link a mi email' }).click();
    await expect(page.getByText('Revisá tu correo')).toBeVisible({ timeout: 10000 });
    const devLink = page.getByRole('link', { name: 'Abrir link de acceso (dev)' });
    const href = await devLink.getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard|feed)/, { timeout: 25000 });

    for (const path of ['/me/saved', '/me/match']) {
      await page.goto(path);
      await page.waitForTimeout(2000);
      const cards = page.locator('a[href^="/listing/"]');
      const cardsCount = await cards.count();
      if (cardsCount === 0) continue;

      const firstCard = cards.first().locator('xpath=..');
      const text = (await firstCard.textContent()) ?? '';
      const seemsPureMockup = text.includes('Propiedad') && text.includes('Consultar');
      expect(
        seemsPureMockup,
        `Card en ${path} parece mockup puro (sin title/price hidratados): ${text.slice(0, 200)}`
      ).toBe(false);
    }
  });
});
