import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const PDF_ENDPOINT = '/api/print-pdf';

const sanitizeFileName = (name: unknown) => {
  const base = typeof name === 'string' ? name : 'comic-kpmg';
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'comic-kpmg';
};

const readRequestBody = (req: NodeJS.ReadableStream) =>
  new Promise<string>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error('El payload excede el máximo permitido.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const pdfApiPlugin = () => {
  const handler = async (req: any, res: any, next: () => void) => {
    if (req.method !== 'POST' || req.url !== PDF_ENDPOINT) {
      next();
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const html = typeof payload.html === 'string' ? payload.html : '';

      if (!html.trim()) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('HTML de impresión inválido.');
        return;
      }

      const browser = await chromium.launch({ headless: true });

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.emulateMedia({ media: 'print' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
        });

        const fileName = sanitizeFileName(payload.fileName);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
        res.end(Buffer.from(pdfBuffer));
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('Error generando PDF con Playwright:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('No se pudo generar el PDF en servidor.');
    }
  };

  return {
    name: 'playwright-pdf-api',
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    }
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), pdfApiPlugin()],

      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
