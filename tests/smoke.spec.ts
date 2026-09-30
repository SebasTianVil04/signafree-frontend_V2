import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8001';

test.describe('Pruebas de humo', () => {
    test('la aplicación carga y muestra contenido', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('app-root')).toBeVisible();
        await expect(page).toHaveTitle(/.+/);
        const texto = await page.locator('body').innerText();
        expect(texto.trim().length).toBeGreaterThan(0);
    });

    test('no hay errores de consola al cargar', async ({ page }) => {
        const errores: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() !== 'error') return;
            const texto = msg.text();
            if (texto.includes('status of 401')) return;
            errores.push(texto);
        });
        page.on('pageerror', (err) => errores.push(err.message));
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        expect(errores).toEqual([]);
    });

    test('sin sesión solo responden 401 el perfil y el refresh de la API', async ({ page }) => {
        const noAutorizadas: string[] = [];
        page.on('response', (res) => {
            if (res.status() === 401) noAutorizadas.push(res.url());
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const permitidas = [`${API_URL}/api/v1/usuarios/perfil`, `${API_URL}/api/v1/auth/refresh`];
        const inesperadas = noAutorizadas.filter((url) => !permitidas.includes(url));
        expect(inesperadas).toEqual([]);
    });

    test('ninguna petición responde con error de servidor', async ({ page }) => {
        const fallidas: string[] = [];
        page.on('response', (res) => {
            if (res.status() >= 500) fallidas.push(`${res.status()} ${res.url()}`);
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        expect(fallidas).toEqual([]);
    });

    test('una ruta inexistente no rompe la aplicación', async ({ page }) => {
        const errores: string[] = [];
        page.on('pageerror', (err) => errores.push(err.message));
        await page.goto('/ruta-que-no-existe');
        await expect(page.locator('app-root')).toBeVisible();
        expect(errores).toEqual([]);
    });

    test('los enlaces de navegación principales responden', async ({ page }) => {
        await page.goto('/');
        const enlaces = await page.locator('a[href^="/"]').evaluateAll((els) =>
            Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href') as string)))
        );
        for (const href of enlaces.slice(0, 10)) {
            const res = await page.goto(href);
            expect(res?.status()).toBeLessThan(400);
            await expect(page.locator('app-root')).toBeVisible();
        }
    });

    test('el diseño no genera scroll horizontal', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const desborda = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(desborda).toBe(false);
    });
});