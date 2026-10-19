import { test, expect } from '@playwright/test';

const API_URL = 'http://backend:8001';

const rutasSensibles = ['/uploads', '/archivos_subidos', '/archivos/senas_referencia'];

test.describe('Exposición pública de archivos', () => {
    for (const ruta of rutasSensibles) {
        test(`${ruta} no es accesible sin autenticación`, async ({ request }) => {
            const res = await request.get(`${API_URL}${ruta}`, { failOnStatusCode: false });
            expect([401, 403, 404]).toContain(res.status());
        });

        test(`${ruta} no lista contenido de directorio`, async ({ request }) => {
            const res = await request.get(`${API_URL}${ruta}/`, { failOnStatusCode: false });
            const cuerpo = await res.text();
            expect(cuerpo.toLowerCase()).not.toContain('index of');
            expect(res.status()).not.toBe(200);
        });
    }

    test('los endpoints protegidos rechazan peticiones sin token', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/v1/usuarios/perfil`, { failOnStatusCode: false });
        expect(res.status()).toBe(401);
    });
});